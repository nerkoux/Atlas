import * as path from 'path';
import * as fs from 'fs';
import { FileNode, ImportEntry, ExportEntry, Language } from '../types';

export function detectLanguage(filePath: string): Language {
  const ext = path.extname(filePath).toLowerCase();
  const extMap: Record<string, Language> = {
    '.ts': 'typescript',
    '.tsx': 'typescript',
    '.mts': 'typescript',
    '.cts': 'typescript',
    '.js': 'javascript',
    '.jsx': 'javascript',
    '.mjs': 'javascript',
    '.cjs': 'javascript',
    '.py': 'python',
    '.go': 'go',
    '.rs': 'rust',
    '.java': 'java',
    '.cs': 'csharp',
  };
  return extMap[ext] ?? 'unknown';
}

export function parseFile(filePath: string, workspaceRoot: string): FileNode | null {
  try {
    const stat = fs.statSync(filePath);
    if (!stat.isFile()) return null;

    const content = fs.readFileSync(filePath, 'utf8');
    const language = detectLanguage(filePath);
    if (language === 'unknown') return null;

    const relativePath = path.relative(workspaceRoot, filePath).replace(/\\/g, '/');
    const name = path.basename(filePath);
    const ext = path.extname(filePath);
    const id = relativePath;

    let imports: ImportEntry[] = [];
    let exports: ExportEntry[] = [];
    let isEntryPoint = false;

    if (language === 'typescript' || language === 'javascript') {
      imports = parseJSImports(content, filePath, workspaceRoot);
      exports = parseJSExports(content);
      isEntryPoint = isJSEntryPoint(name, relativePath);
    } else if (language === 'python') {
      imports = parsePythonImports(content, filePath, workspaceRoot);
      exports = parsePythonExports(content);
      isEntryPoint = isPythonEntryPoint(name);
    } else if (language === 'go') {
      imports = parseGoImports(content, filePath, workspaceRoot);
      exports = parseGoExports(content);
      isEntryPoint = isGoEntryPoint(content, name);
    } else if (language === 'rust') {
      imports = parseRustImports(content);
      exports = parseRustExports(content);
      isEntryPoint = name === 'main.rs' || name === 'lib.rs';
    } else if (language === 'java') {
      imports = parseJavaImports(content);
      exports = parseJavaExports(content);
      isEntryPoint = content.includes('public static void main');
    } else if (language === 'csharp') {
      imports = parseCSharpImports(content);
      exports = parseCSharpExports(content);
      isEntryPoint = content.includes('static void Main') || content.includes('static async Task Main');
    }

    return {
      id,
      path: filePath,
      relativePath,
      name,
      extension: ext,
      language,
      size: stat.size,
      imports,
      exports,
      isEntryPoint,
      lastModified: stat.mtimeMs,
    };
  } catch {
    return null;
  }
}

function resolveImportPath(
  importSource: string,
  fromFile: string,
  workspaceRoot: string
): string | undefined {
  if (!importSource.startsWith('.') && !importSource.startsWith('/')) return undefined;

  const fromDir = path.dirname(fromFile);
  const resolved = path.resolve(fromDir, importSource);

  const extensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '/index.ts', '/index.tsx', '/index.js'];
  for (const ext of extensions) {
    const candidate = resolved + ext;
    if (fs.existsSync(candidate)) {
      return path.relative(workspaceRoot, candidate).replace(/\\/g, '/');
    }
  }

  if (fs.existsSync(resolved)) {
    return path.relative(workspaceRoot, resolved).replace(/\\/g, '/');
  }

  return path.relative(workspaceRoot, resolved).replace(/\\/g, '/');
}

function parseJSImports(content: string, filePath: string, workspaceRoot: string): ImportEntry[] {
  const imports: ImportEntry[] = [];
  const lines = content.split('\n');

  const patterns = [
    { re: /^\s*import\s+.*?\s+from\s+['"]([^'"]+)['"]/gm, dynamic: false },
    { re: /^\s*import\s+['"]([^'"]+)['"]/gm, dynamic: false },
    { re: /(?:import|require)\s*\(\s*['"]([^'"]+)['"]\s*\)/gm, dynamic: true },
    { re: /require\s*\(\s*['"]([^'"]+)['"]\s*\)/gm, dynamic: false },
    { re: /^\s*export\s+.*?\s+from\s+['"]([^'"]+)['"]/gm, dynamic: false },
  ];

  for (const { re, dynamic } of patterns) {
    re.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = re.exec(content)) !== null) {
      const source = match[1];
      const lineNum = content.substring(0, match.index).split('\n').length;
      const isExternal = !source.startsWith('.') && !source.startsWith('/');
      const resolvedPath = isExternal
        ? undefined
        : resolveImportPath(source, filePath, workspaceRoot);

      const existingIdx = imports.findIndex((i) => i.source === source);
      if (existingIdx === -1) {
        imports.push({
          source,
          resolvedPath,
          specifiers: extractSpecifiers(lines[lineNum - 1] ?? ''),
          isExternal,
          isDynamic: dynamic,
          line: lineNum,
        });
      }
    }
  }

  return imports;
}

function extractSpecifiers(line: string): string[] {
  const namedMatch = line.match(/\{([^}]+)\}/);
  if (namedMatch) {
    return namedMatch[1].split(',').map((s) => s.trim().split(' as ')[0].trim()).filter(Boolean);
  }
  const defaultMatch = line.match(/import\s+(\w+)\s+from/);
  if (defaultMatch) return [defaultMatch[1]];
  return [];
}

function parseJSExports(content: string): ExportEntry[] {
  const exports: ExportEntry[] = [];
  const patterns: Array<{ re: RegExp; type: ExportEntry['type'] }> = [
    { re: /^\s*export\s+(?:async\s+)?function\s+(\w+)/gm, type: 'function' },
    { re: /^\s*export\s+class\s+(\w+)/gm, type: 'class' },
    { re: /^\s*export\s+(?:const|let|var)\s+(\w+)/gm, type: 'const' },
    { re: /^\s*export\s+type\s+(\w+)/gm, type: 'type' },
    { re: /^\s*export\s+interface\s+(\w+)/gm, type: 'interface' },
    { re: /^\s*export\s+default\b/gm, type: 'default' },
    { re: /^\s*module\.exports\s*=/gm, type: 'default' },
  ];

  for (const { re, type } of patterns) {
    re.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = re.exec(content)) !== null) {
      const lineNum = content.substring(0, match.index).split('\n').length;
      exports.push({ name: match[1] ?? 'default', type, line: lineNum });
    }
  }

  return exports;
}

function isJSEntryPoint(name: string, relativePath: string): boolean {
  const entryNames = ['index.ts', 'index.tsx', 'index.js', 'main.ts', 'main.js', 'app.ts', 'app.tsx', 'app.js', 'server.ts', 'server.js'];
  const entryDirs = ['src/', 'app/', 'pages/', 'routes/'];
  if (entryNames.includes(name.toLowerCase())) return true;
  if (entryDirs.some((d) => relativePath.startsWith(d)) && entryNames.includes(name.toLowerCase())) return true;
  if (relativePath === name) return entryNames.includes(name.toLowerCase());
  return false;
}

function parsePythonImports(content: string, filePath: string, workspaceRoot: string): ImportEntry[] {
  const imports: ImportEntry[] = [];
  const lines = content.split('\n');

  lines.forEach((line, idx) => {
    const fromMatch = line.match(/^\s*from\s+(\S+)\s+import\s+(.+)/);
    const importMatch = line.match(/^\s*import\s+(\S+)/);

    if (fromMatch) {
      const source = fromMatch[1];
      const specifiers = fromMatch[2].split(',').map((s) => s.trim()).filter(Boolean);
      const isExternal = !source.startsWith('.');
      const resolvedPath = isExternal ? undefined : resolvePythonPath(source, filePath, workspaceRoot);
      imports.push({ source, resolvedPath, specifiers, isExternal, isDynamic: false, line: idx + 1 });
    } else if (importMatch) {
      const source = importMatch[1];
      const isExternal = !source.startsWith('.');
      imports.push({ source, specifiers: [], isExternal, isDynamic: false, line: idx + 1 });
    }
  });

  return imports;
}

function resolvePythonPath(source: string, fromFile: string, workspaceRoot: string): string | undefined {
  const fromDir = path.dirname(fromFile);
  const parts = source.replace(/^\.+/, '').split('.');
  const fileCandidates = [
    path.join(fromDir, ...parts) + '.py',
    path.join(fromDir, ...parts, '__init__.py'),
    path.join(workspaceRoot, ...parts) + '.py',
    path.join(workspaceRoot, ...parts, '__init__.py'),
  ];

  for (const c of fileCandidates) {
    if (fs.existsSync(c)) return path.relative(workspaceRoot, c).replace(/\\/g, '/');
  }
  return undefined;
}

function parsePythonExports(content: string): ExportEntry[] {
  const exports: ExportEntry[] = [];
  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    const fnMatch = line.match(/^(?:async\s+)?def\s+(\w+)/);
    const clsMatch = line.match(/^class\s+(\w+)/);
    if (fnMatch) exports.push({ name: fnMatch[1], type: 'function', line: idx + 1 });
    if (clsMatch) exports.push({ name: clsMatch[1], type: 'class', line: idx + 1 });
  });
  return exports;
}

function isPythonEntryPoint(name: string): boolean {
  return ['main.py', '__main__.py', 'app.py', 'server.py', 'manage.py', 'wsgi.py', 'asgi.py'].includes(name.toLowerCase());
}

function parseGoImports(content: string, _filePath: string, _workspaceRoot: string): ImportEntry[] {
  const imports: ImportEntry[] = [];
  const blockMatch = content.match(/import\s*\(([\s\S]*?)\)/);
  const singleMatch = content.match(/^import\s+"([^"]+)"/m);

  if (blockMatch) {
    const block = blockMatch[1];
    const re = /(?:\w+\s+)?"([^"]+)"/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(block)) !== null) {
      const source = m[1];
      imports.push({ source, specifiers: [], isExternal: !source.startsWith('.'), isDynamic: false, line: 0 });
    }
  } else if (singleMatch) {
    imports.push({ source: singleMatch[1], specifiers: [], isExternal: true, isDynamic: false, line: 0 });
  }

  return imports;
}

function parseGoExports(content: string): ExportEntry[] {
  const exports: ExportEntry[] = [];
  const fnRe = /^func\s+([A-Z]\w*)/gm;
  const typeRe = /^type\s+([A-Z]\w*)\s+(?:struct|interface)/gm;
  let m: RegExpExecArray | null;
  while ((m = fnRe.exec(content)) !== null) {
    exports.push({ name: m[1], type: 'function', line: content.substring(0, m.index).split('\n').length });
  }
  while ((m = typeRe.exec(content)) !== null) {
    exports.push({ name: m[1], type: 'class', line: content.substring(0, m.index).split('\n').length });
  }
  return exports;
}

function isGoEntryPoint(content: string, name: string): boolean {
  return name === 'main.go' && content.includes('func main()');
}


// ─── Rust Parsing ─────────────────────────────────────────────────────────────

function parseRustImports(content: string): ImportEntry[] {
  const imports: ImportEntry[] = [];
  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    const useMatch = line.match(/^\s*use\s+([^;]+)/);
    if (useMatch) {
      const source = useMatch[1].trim();
      const isExternal = !source.startsWith('crate::') && !source.startsWith('super::') && !source.startsWith('self::');
      imports.push({ source, specifiers: [], isExternal, isDynamic: false, line: idx + 1 });
    }
    const modMatch = line.match(/^\s*mod\s+(\w+)\s*;/);
    if (modMatch) {
      imports.push({ source: modMatch[1], specifiers: [], isExternal: false, isDynamic: false, line: idx + 1 });
    }
  });
  return imports;
}

function parseRustExports(content: string): ExportEntry[] {
  const exports: ExportEntry[] = [];
  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    const fnMatch = line.match(/^\s*pub\s+(?:async\s+)?fn\s+(\w+)/);
    if (fnMatch) exports.push({ name: fnMatch[1], type: 'function', line: idx + 1 });
    const structMatch = line.match(/^\s*pub\s+struct\s+(\w+)/);
    if (structMatch) exports.push({ name: structMatch[1], type: 'class', line: idx + 1 });
    const enumMatch = line.match(/^\s*pub\s+enum\s+(\w+)/);
    if (enumMatch) exports.push({ name: enumMatch[1], type: 'class', line: idx + 1 });
    const traitMatch = line.match(/^\s*pub\s+trait\s+(\w+)/);
    if (traitMatch) exports.push({ name: traitMatch[1], type: 'interface', line: idx + 1 });
  });
  return exports;
}

// ─── Java Parsing ─────────────────────────────────────────────────────────────

function parseJavaImports(content: string): ImportEntry[] {
  const imports: ImportEntry[] = [];
  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    const match = line.match(/^\s*import\s+(?:static\s+)?([^;]+)/);
    if (match) {
      imports.push({ source: match[1].trim(), specifiers: [], isExternal: true, isDynamic: false, line: idx + 1 });
    }
  });
  return imports;
}

function parseJavaExports(content: string): ExportEntry[] {
  const exports: ExportEntry[] = [];
  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    const classMatch = line.match(/^\s*public\s+(?:abstract\s+)?class\s+(\w+)/);
    if (classMatch) exports.push({ name: classMatch[1], type: 'class', line: idx + 1 });
    const ifaceMatch = line.match(/^\s*public\s+interface\s+(\w+)/);
    if (ifaceMatch) exports.push({ name: ifaceMatch[1], type: 'interface', line: idx + 1 });
    const methodMatch = line.match(/^\s*public\s+(?:static\s+)?(?:\w+\s+)+(\w+)\s*\(/);
    if (methodMatch && !classMatch && !ifaceMatch) {
      exports.push({ name: methodMatch[1], type: 'function', line: idx + 1 });
    }
  });
  return exports;
}

// ─── C# Parsing ───────────────────────────────────────────────────────────────

function parseCSharpImports(content: string): ImportEntry[] {
  const imports: ImportEntry[] = [];
  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    const match = line.match(/^\s*using\s+(?:static\s+)?([^;]+)/);
    if (match) {
      imports.push({ source: match[1].trim(), specifiers: [], isExternal: true, isDynamic: false, line: idx + 1 });
    }
  });
  return imports;
}

function parseCSharpExports(content: string): ExportEntry[] {
  const exports: ExportEntry[] = [];
  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    const classMatch = line.match(/^\s*public\s+(?:abstract\s+|sealed\s+|static\s+)?class\s+(\w+)/);
    if (classMatch) exports.push({ name: classMatch[1], type: 'class', line: idx + 1 });
    const ifaceMatch = line.match(/^\s*public\s+interface\s+(\w+)/);
    if (ifaceMatch) exports.push({ name: ifaceMatch[1], type: 'interface', line: idx + 1 });
    const methodMatch = line.match(/^\s*public\s+(?:static\s+|async\s+|virtual\s+|override\s+)*\w+\s+(\w+)\s*\(/);
    if (methodMatch && !classMatch && !ifaceMatch) {
      exports.push({ name: methodMatch[1], type: 'function', line: idx + 1 });
    }
  });
  return exports;
}
