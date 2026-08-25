import * as path from 'path';
import * as fs from 'fs';
import { ImportEntry, ExportEntry } from '../types';

// ─── Dart Workspace Context ───────────────────────────────────────────────────

export interface DartWorkspaceContext {
  /** Maps package name to the absolute path of the package root (directory containing pubspec.yaml) */
  packagesByName: Map<string, string>;
}

/** Generated file patterns that should be excluded by default */
export const DART_GENERATED_PATTERNS = [
  /\.g\.dart$/,
  /\.freezed\.dart$/,
  /\.gr\.dart$/,
  /\.gen\.dart$/,
  /\.mocks\.dart$/,
];

/** Directories to skip when discovering Dart packages */
const DART_PACKAGE_EXCLUDE_DIRS = new Set([
  '.git',
  'node_modules',
  '.dart_tool',
  'build',
  '.pub-cache',
  '.pub',
  '.fvm',
  '.symlinks',
]);

// ─── Package Discovery ────────────────────────────────────────────────────────

/**
 * Discovers all Dart packages in the workspace by locating pubspec.yaml files
 * and reading their package names.
 */
export function discoverDartPackages(
  workspaceRoot: string,
  excludeDirs: Set<string>,
  maxDepth: number
): DartWorkspaceContext {
  const packagesByName = new Map<string, string>();
  const allExcludes = new Set([...excludeDirs, ...DART_PACKAGE_EXCLUDE_DIRS]);

  findPubspecFiles(workspaceRoot, allExcludes, maxDepth, 0, packagesByName);

  return { packagesByName };
}

function findPubspecFiles(
  dir: string,
  excludeDirs: Set<string>,
  maxDepth: number,
  currentDepth: number,
  result: Map<string, string>
): void {
  if (currentDepth > maxDepth) return;

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }

  // Check if this directory has a pubspec.yaml
  const pubspecPath = path.join(dir, 'pubspec.yaml');
  if (fs.existsSync(pubspecPath)) {
    const packageName = parsePubspecName(pubspecPath);
    if (packageName) {
      result.set(packageName, dir);
    }
  }

  // Recurse into subdirectories
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith('.') && entry.name !== '.dart_tool') continue;
    if (excludeDirs.has(entry.name)) continue;

    findPubspecFiles(path.join(dir, entry.name), excludeDirs, maxDepth, currentDepth + 1, result);
  }
}

/**
 * Parses the `name:` field from a pubspec.yaml file.
 * Uses simple line-based parsing since we only need the name field.
 */
export function parsePubspecName(pubspecPath: string): string | null {
  try {
    const content = fs.readFileSync(pubspecPath, 'utf8');
    const lines = content.split('\n');
    for (const line of lines) {
      // Match top-level `name:` field (not indented)
      const match = line.match(/^name:\s*(.+)/);
      if (match) {
        const name = match[1].trim().replace(/['"`]/g, '');
        if (name && /^[a-z_][a-z0-9_]*$/.test(name)) {
          return name;
        }
      }
    }
  } catch {
    // Malformed pubspec - skip gracefully
  }
  return null;
}

// ─── Generated File Detection ─────────────────────────────────────────────────

export function isDartGeneratedFile(filePath: string): boolean {
  const basename = path.basename(filePath);
  return DART_GENERATED_PATTERNS.some((pattern) => pattern.test(basename));
}

// ─── Comment Stripping ────────────────────────────────────────────────────────

function stripDartComments(content: string): string {
  // Remove single-line comments
  let result = content.replace(/\/\/.*$/gm, '');
  // Remove multi-line comments
  result = result.replace(/\/\*[\s\S]*?\*\//g, '');
  return result;
}

// ─── Import Parsing ───────────────────────────────────────────────────────────

export function parseDartImports(
  content: string,
  filePath: string,
  workspaceRoot: string,
  dartContext: DartWorkspaceContext
): ImportEntry[] {
  const imports: ImportEntry[] = [];
  const stripped = stripDartComments(content);
  const lines = stripped.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Match import directives
    const importMatch = line.match(/^\s*import\s+['"]([^'"]+)['"]/);
    if (importMatch) {
      const source = importMatch[1];
      const entry = buildDartImportEntry(source, filePath, workspaceRoot, dartContext, i + 1, false);
      if (entry) {
        // Extract specifiers from show/hide
        entry.specifiers = extractDartSpecifiers(line);
        imports.push(entry);
      }

      // Handle conditional imports on subsequent lines
      const conditionalImports = parseConditionalImports(lines, i, filePath, workspaceRoot, dartContext);
      imports.push(...conditionalImports);
      continue;
    }

    // Match export directives (treated as re-export dependencies)
    const exportMatch = line.match(/^\s*export\s+['"]([^'"]+)['"]/);
    if (exportMatch) {
      const source = exportMatch[1];
      const entry = buildDartImportEntry(source, filePath, workspaceRoot, dartContext, i + 1, false);
      if (entry) {
        entry.specifiers = extractDartSpecifiers(line);
        imports.push(entry);
      }
      continue;
    }

    // Match part directives
    const partMatch = line.match(/^\s*part\s+['"]([^'"]+)['"]/);
    if (partMatch) {
      const source = partMatch[1];
      // part directives are always relative to the current file
      const entry = buildDartImportEntry(source, filePath, workspaceRoot, dartContext, i + 1, false);
      if (entry) {
        imports.push(entry);
      }
      continue;
    }

    // Skip `part of` - not an outgoing dependency
    // Skip `library` - not a dependency
  }

  return imports;
}

function parseConditionalImports(
  lines: string[],
  importLineIdx: number,
  filePath: string,
  workspaceRoot: string,
  dartContext: DartWorkspaceContext
): ImportEntry[] {
  const results: ImportEntry[] = [];
  // Look at lines following the import for `if (...)` clauses
  for (let j = importLineIdx + 1; j < lines.length && j < importLineIdx + 10; j++) {
    const condMatch = lines[j].match(/^\s*if\s*\([^)]*\)\s*['"]([^'"]+)['"]/);
    if (condMatch) {
      const source = condMatch[1];
      const entry = buildDartImportEntry(source, filePath, workspaceRoot, dartContext, j + 1, false);
      if (entry) {
        results.push(entry);
      }
    } else if (lines[j].match(/^\s*;/) || lines[j].match(/^\s*(import|export|part|class|void|abstract|final|sealed|mixin|enum|extension|typedef)/)) {
      break;
    }
  }
  return results;
}

function buildDartImportEntry(
  source: string,
  filePath: string,
  workspaceRoot: string,
  dartContext: DartWorkspaceContext,
  line: number,
  isDynamic: boolean
): ImportEntry | null {
  // Skip dart: SDK imports
  if (source.startsWith('dart:')) {
    return null;
  }

  // package: imports
  if (source.startsWith('package:')) {
    return resolveDartPackageImport(source, workspaceRoot, dartContext, line, isDynamic);
  }

  // Relative imports
  const resolvedPath = resolveDartRelativeImport(source, filePath, workspaceRoot);
  return {
    source,
    resolvedPath,
    specifiers: [],
    isExternal: false,
    isDynamic,
    line,
  };
}

function extractDartSpecifiers(line: string): string[] {
  const showMatch = line.match(/\bshow\s+([^;]+)/);
  const hideMatch = line.match(/\bhide\s+([^;]+)/);
  if (showMatch) {
    return showMatch[1].split(',').map((s) => s.trim()).filter(Boolean);
  }
  if (hideMatch) {
    return hideMatch[1].split(',').map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

// ─── Import Resolution ────────────────────────────────────────────────────────

export function resolveDartRelativeImport(
  source: string,
  filePath: string,
  workspaceRoot: string
): string | undefined {
  const fromDir = path.dirname(filePath);
  const resolved = path.resolve(fromDir, source);
  const relativePath = path.relative(workspaceRoot, resolved).replace(/\\/g, '/');

  // Verify the file exists
  if (fs.existsSync(resolved)) {
    return relativePath;
  }

  // Return the computed path even if file doesn't exist (for graph edge matching)
  return relativePath;
}

export function resolveDartPackageImport(
  source: string,
  workspaceRoot: string,
  dartContext: DartWorkspaceContext,
  line: number,
  isDynamic: boolean
): ImportEntry {
  // source format: package:package_name/path/to/file.dart
  const withoutPrefix = source.replace(/^package:/, '');
  const slashIdx = withoutPrefix.indexOf('/');

  if (slashIdx === -1) {
    // Malformed package import
    return {
      source,
      resolvedPath: undefined,
      specifiers: [],
      isExternal: true,
      isDynamic,
      line,
    };
  }

  const packageName = withoutPrefix.substring(0, slashIdx);
  const packagePath = withoutPrefix.substring(slashIdx + 1);

  // Check if this is a local workspace package
  const packageRoot = dartContext.packagesByName.get(packageName);
  if (packageRoot) {
    // Resolve to <package-root>/lib/<path>
    const resolvedAbsolute = path.join(packageRoot, 'lib', packagePath);
    const resolvedRelative = path.relative(workspaceRoot, resolvedAbsolute).replace(/\\/g, '/');
    return {
      source,
      resolvedPath: resolvedRelative,
      specifiers: [],
      isExternal: false,
      isDynamic,
      line,
    };
  }

  // External package
  return {
    source,
    resolvedPath: undefined,
    specifiers: [],
    isExternal: true,
    isDynamic,
    line,
  };
}

// ─── Export (Symbol) Parsing ──────────────────────────────────────────────────

export function parseDartExports(content: string): ExportEntry[] {
  const exports: ExportEntry[] = [];
  const stripped = stripDartComments(content);
  const lines = stripped.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Skip private declarations (starting with _)
    // We check after extracting the name

    // Class declarations (abstract, base, final, interface, sealed, mixin class)
    const classMatch = line.match(
      /^\s*(?:abstract\s+|base\s+|final\s+|interface\s+|sealed\s+)*class\s+([A-Za-z_]\w*)/
    );
    if (classMatch) {
      const name = classMatch[1];
      if (!name.startsWith('_')) {
        exports.push({ name, type: 'class', line: i + 1 });
      }
      continue;
    }

    // Mixin declarations
    const mixinMatch = line.match(/^\s*(?:base\s+)?mixin\s+([A-Za-z_]\w*)/);
    if (mixinMatch && !line.match(/^\s*(?:base\s+)?mixin\s+class\s/)) {
      const name = mixinMatch[1];
      if (!name.startsWith('_')) {
        exports.push({ name, type: 'class', line: i + 1 });
      }
      continue;
    }

    // Enum declarations
    const enumMatch = line.match(/^\s*enum\s+([A-Za-z_]\w*)/);
    if (enumMatch) {
      const name = enumMatch[1];
      if (!name.startsWith('_')) {
        exports.push({ name, type: 'class', line: i + 1 });
      }
      continue;
    }

    // Extension declarations
    const extMatch = line.match(/^\s*extension\s+(?:type\s+)?([A-Za-z_]\w*)/);
    if (extMatch) {
      const name = extMatch[1];
      if (!name.startsWith('_') && name !== 'on') {
        exports.push({ name, type: 'class', line: i + 1 });
      }
      continue;
    }

    // Typedef
    const typedefMatch = line.match(/^\s*typedef\s+([A-Za-z_]\w*)/);
    if (typedefMatch) {
      const name = typedefMatch[1];
      if (!name.startsWith('_')) {
        exports.push({ name, type: 'type', line: i + 1 });
      }
      continue;
    }

    // Top-level functions (various return types)
    const fnMatch = line.match(
      /^\s*(?:Future<[^>]*>|Stream<[^>]*>|[A-Za-z_]\w*(?:<[^>]*>)?(?:\?)?)\s+([A-Za-z_]\w*)\s*[<(]/
    );
    if (fnMatch) {
      const name = fnMatch[1];
      // Skip if it looks like a class/mixin/enum/extension/typedef (already handled)
      if (!name.startsWith('_') && !['class', 'mixin', 'enum', 'extension', 'typedef', 'abstract', 'final', 'sealed', 'base', 'interface'].includes(name)) {
        exports.push({ name, type: 'function', line: i + 1 });
      }
      continue;
    }

    // void functions
    const voidFnMatch = line.match(/^\s*void\s+([A-Za-z_]\w*)\s*[<(]/);
    if (voidFnMatch) {
      const name = voidFnMatch[1];
      if (!name.startsWith('_')) {
        exports.push({ name, type: 'function', line: i + 1 });
      }
      continue;
    }

    // Top-level constants/variables
    const constMatch = line.match(/^\s*(?:const|final|late\s+final|var)\s+(?:[A-Za-z_]\w*(?:<[^>]*>)?\s+)?([A-Za-z_]\w*)\s*[=;]/);
    if (constMatch) {
      const name = constMatch[1];
      if (!name.startsWith('_')) {
        exports.push({ name, type: 'const', line: i + 1 });
      }
      continue;
    }
  }

  return exports;
}

// ─── Entry Point Detection ────────────────────────────────────────────────────

export function isDartEntryPoint(content: string, name: string, relativePath: string): boolean {
  const stripped = stripDartComments(content);

  // Check for top-level main function
  const hasMain = /^\s*(?:Future<void>|void)\s+main\s*\(/m.test(stripped);
  if (!hasMain) return false;

  // bin/*.dart files with main() are entry points
  if (relativePath.match(/(^|\/)bin\//)) return true;

  // lib/main.dart is a common Flutter entry point
  if (name === 'main.dart') return true;

  // Any file with a top-level main() is an entry point
  return true;
}
