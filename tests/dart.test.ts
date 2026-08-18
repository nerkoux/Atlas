import { describe, it, expect, beforeAll } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { detectLanguage, parseFile } from '../src/engine/parser';
import {
  parseDartImports,
  parseDartExports,
  isDartEntryPoint,
  isDartGeneratedFile,
  discoverDartPackages,
  parsePubspecName,
  resolveDartRelativeImport,
  resolveDartPackageImport,
  DartWorkspaceContext,
} from '../src/engine/dartParser';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function createTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-dart-test-'));
}

function writeFile(dir: string, relativePath: string, content: string): string {
  const fullPath = path.join(dir, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content, 'utf8');
  return fullPath;
}

// ─── A. Language Detection ────────────────────────────────────────────────────

describe('Language Detection', () => {
  it('detects .dart files as dart', () => {
    expect(detectLanguage('foo.dart')).toBe('dart');
    expect(detectLanguage('/path/to/lib/main.dart')).toBe('dart');
  });

  it('still detects .ts files as typescript', () => {
    expect(detectLanguage('foo.ts')).toBe('typescript');
    expect(detectLanguage('foo.tsx')).toBe('typescript');
  });

  it('still detects .js files as javascript', () => {
    expect(detectLanguage('foo.js')).toBe('javascript');
    expect(detectLanguage('foo.jsx')).toBe('javascript');
  });

  it('returns unknown for unsupported extensions', () => {
    expect(detectLanguage('foo.txt')).toBe('unknown');
    expect(detectLanguage('foo.md')).toBe('unknown');
  });
});

// ─── B. Relative Imports ──────────────────────────────────────────────────────

describe('Dart Relative Imports', () => {
  let tmpDir: string;

  beforeAll(() => {
    tmpDir = createTempDir();
    writeFile(tmpDir, 'lib/features/a.dart', "import '../services/b.dart';");
    writeFile(tmpDir, 'lib/services/b.dart', 'class B {}');
  });

  it('resolves relative import correctly', () => {
    const filePath = path.join(tmpDir, 'lib/features/a.dart');
    const resolved = resolveDartRelativeImport('../services/b.dart', filePath, tmpDir);
    expect(resolved).toBe('lib/services/b.dart');
  });

  it('resolves relative import in parsed file', () => {
    const filePath = path.join(tmpDir, 'lib/features/a.dart');
    const ctx: DartWorkspaceContext = { packagesByName: new Map() };
    const content = fs.readFileSync(filePath, 'utf8');
    const imports = parseDartImports(content, filePath, tmpDir, ctx);
    expect(imports.length).toBe(1);
    expect(imports[0].source).toBe('../services/b.dart');
    expect(imports[0].resolvedPath).toBe('lib/services/b.dart');
    expect(imports[0].isExternal).toBe(false);
  });
});

// ─── C. Local Package Import ──────────────────────────────────────────────────

describe('Dart Local Package Import', () => {
  let tmpDir: string;

  beforeAll(() => {
    tmpDir = createTempDir();
    writeFile(tmpDir, 'pubspec.yaml', 'name: my_app\nversion: 1.0.0');
    writeFile(tmpDir, 'lib/services/b.dart', 'class B {}');
    writeFile(tmpDir, 'lib/a.dart', "import 'package:my_app/services/b.dart';");
  });

  it('resolves local package import to lib/ path', () => {
    const ctx: DartWorkspaceContext = { packagesByName: new Map([['my_app', tmpDir]]) };
    const filePath = path.join(tmpDir, 'lib/a.dart');
    const content = fs.readFileSync(filePath, 'utf8');
    const imports = parseDartImports(content, filePath, tmpDir, ctx);
    expect(imports.length).toBe(1);
    expect(imports[0].resolvedPath).toBe('lib/services/b.dart');
    expect(imports[0].isExternal).toBe(false);
  });
});

// ─── D. Monorepo Package Import ──────────────────────────────────────────────

describe('Dart Monorepo Package Import', () => {
  let tmpDir: string;

  beforeAll(() => {
    tmpDir = createTempDir();
    writeFile(tmpDir, 'packages/models/pubspec.yaml', 'name: models\nversion: 1.0.0');
    writeFile(tmpDir, 'packages/models/lib/user.dart', 'class User {}');
    writeFile(tmpDir, 'apps/client/pubspec.yaml', 'name: client\nversion: 1.0.0');
    writeFile(tmpDir, 'apps/client/lib/a.dart', "import 'package:models/user.dart';");
  });

  it('resolves cross-package import in monorepo', () => {
    const modelsRoot = path.join(tmpDir, 'packages/models');
    const ctx: DartWorkspaceContext = {
      packagesByName: new Map([
        ['models', modelsRoot],
        ['client', path.join(tmpDir, 'apps/client')],
      ]),
    };
    const filePath = path.join(tmpDir, 'apps/client/lib/a.dart');
    const content = fs.readFileSync(filePath, 'utf8');
    const imports = parseDartImports(content, filePath, tmpDir, ctx);
    expect(imports.length).toBe(1);
    expect(imports[0].resolvedPath).toBe('packages/models/lib/user.dart');
    expect(imports[0].isExternal).toBe(false);
  });

  it('discovers packages from pubspec.yaml files', () => {
    const ctx = discoverDartPackages(tmpDir, new Set(), 10);
    expect(ctx.packagesByName.get('models')).toBe(path.join(tmpDir, 'packages/models'));
    expect(ctx.packagesByName.get('client')).toBe(path.join(tmpDir, 'apps/client'));
  });
});

// ─── E. External Imports ──────────────────────────────────────────────────────

describe('Dart External Imports', () => {
  it('marks flutter package as external when not in workspace', () => {
    const ctx: DartWorkspaceContext = { packagesByName: new Map() };
    const content = "import 'package:flutter/material.dart';";
    const imports = parseDartImports(content, '/tmp/test.dart', '/tmp', ctx);
    expect(imports.length).toBe(1);
    expect(imports[0].isExternal).toBe(true);
    expect(imports[0].resolvedPath).toBeUndefined();
  });

  it('marks riverpod package as external', () => {
    const ctx: DartWorkspaceContext = { packagesByName: new Map() };
    const content = "import 'package:riverpod/riverpod.dart';";
    const imports = parseDartImports(content, '/tmp/test.dart', '/tmp', ctx);
    expect(imports.length).toBe(1);
    expect(imports[0].isExternal).toBe(true);
  });
});

// ─── F. dart: Imports ─────────────────────────────────────────────────────────

describe('Dart SDK Imports', () => {
  it('ignores dart:async import', () => {
    const ctx: DartWorkspaceContext = { packagesByName: new Map() };
    const content = "import 'dart:async';";
    const imports = parseDartImports(content, '/tmp/test.dart', '/tmp', ctx);
    expect(imports.length).toBe(0);
  });

  it('ignores dart:convert import', () => {
    const ctx: DartWorkspaceContext = { packagesByName: new Map() };
    const content = "import 'dart:convert';\nimport 'dart:io';";
    const imports = parseDartImports(content, '/tmp/test.dart', '/tmp', ctx);
    expect(imports.length).toBe(0);
  });

  it('only parses non-SDK imports when mixed with dart: imports', () => {
    const ctx: DartWorkspaceContext = { packagesByName: new Map() };
    const content = [
      "import 'dart:async';",
      "import 'dart:io';",
      "import 'package:flutter/material.dart';",
      "import '../utils/helpers.dart';",
    ].join('\n');
    const imports = parseDartImports(content, '/tmp/lib/test.dart', '/tmp', ctx);
    expect(imports.length).toBe(2);
  });
});

// ─── G. Export Directives ─────────────────────────────────────────────────────

describe('Dart Export Directives', () => {
  it('creates dependency for export directive', () => {
    const ctx: DartWorkspaceContext = { packagesByName: new Map() };
    const content = "export 'foo.dart';";
    const imports = parseDartImports(content, '/tmp/lib/bar.dart', '/tmp', ctx);
    expect(imports.length).toBe(1);
    expect(imports[0].source).toBe('foo.dart');
    expect(imports[0].isExternal).toBe(false);
  });

  it('handles export with show clause', () => {
    const ctx: DartWorkspaceContext = { packagesByName: new Map() };
    const content = "export 'foo.dart' show Foo, Bar;";
    const imports = parseDartImports(content, '/tmp/lib/bar.dart', '/tmp', ctx);
    expect(imports.length).toBe(1);
    expect(imports[0].specifiers).toEqual(['Foo', 'Bar']);
  });

  it('handles export with hide clause', () => {
    const ctx: DartWorkspaceContext = { packagesByName: new Map() };
    const content = "export 'foo.dart' hide Baz;";
    const imports = parseDartImports(content, '/tmp/lib/bar.dart', '/tmp', ctx);
    expect(imports.length).toBe(1);
    expect(imports[0].specifiers).toEqual(['Baz']);
  });
});

// ─── H. Part Directives ───────────────────────────────────────────────────────

describe('Dart Part Directives', () => {
  it('creates dependency for part directive', () => {
    const ctx: DartWorkspaceContext = { packagesByName: new Map() };
    const content = "part 'foo.g.dart';";
    const imports = parseDartImports(content, '/tmp/lib/bar.dart', '/tmp', ctx);
    expect(imports.length).toBe(1);
    expect(imports[0].source).toBe('foo.g.dart');
    expect(imports[0].isExternal).toBe(false);
  });

  it('does not create dependency for part of directive', () => {
    const ctx: DartWorkspaceContext = { packagesByName: new Map() };
    const content = "part of 'bar.dart';";
    const imports = parseDartImports(content, '/tmp/lib/foo.dart', '/tmp', ctx);
    expect(imports.length).toBe(0);
  });
});

// ─── I. Symbols ───────────────────────────────────────────────────────────────

describe('Dart Symbol Extraction', () => {
  it('detects public classes', () => {
    const content = [
      'class MyClass {}',
      'abstract class BaseWidget {}',
      'sealed class Shape {}',
      'final class ImmutableData {}',
      'interface class Serializable {}',
      'base class Animal {}',
    ].join('\n');
    const exports = parseDartExports(content);
    const names = exports.map((e) => e.name);
    expect(names).toContain('MyClass');
    expect(names).toContain('BaseWidget');
    expect(names).toContain('Shape');
    expect(names).toContain('ImmutableData');
    expect(names).toContain('Serializable');
    expect(names).toContain('Animal');
  });

  it('excludes private declarations', () => {
    const content = [
      'class _PrivateClass {}',
      'void _privateFunction() {}',
      'class PublicClass {}',
      'void publicFunction() {}',
    ].join('\n');
    const exports = parseDartExports(content);
    const names = exports.map((e) => e.name);
    expect(names).not.toContain('_PrivateClass');
    expect(names).not.toContain('_privateFunction');
    expect(names).toContain('PublicClass');
    expect(names).toContain('publicFunction');
  });

  it('detects top-level functions', () => {
    const content = [
      'void main() {}',
      'Future<void> loadData() async {}',
      'String formatName(String s) => s;',
    ].join('\n');
    const exports = parseDartExports(content);
    const names = exports.map((e) => e.name);
    expect(names).toContain('main');
    expect(names).toContain('loadData');
    expect(names).toContain('formatName');
  });

  it('detects mixin, enum, extension, typedef', () => {
    const content = [
      'mixin Draggable {}',
      'enum Color { red, green, blue }',
      'extension StringExtension on String {}',
      'typedef JsonMap = Map<String, dynamic>;',
    ].join('\n');
    const exports = parseDartExports(content);
    const names = exports.map((e) => e.name);
    expect(names).toContain('Draggable');
    expect(names).toContain('Color');
    expect(names).toContain('StringExtension');
    expect(names).toContain('JsonMap');
  });
});

// ─── J. Entry Points ─────────────────────────────────────────────────────────

describe('Dart Entry Points', () => {
  it('detects void main()', () => {
    const content = 'void main() {\n  runApp(MyApp());\n}';
    expect(isDartEntryPoint(content, 'main.dart', 'lib/main.dart')).toBe(true);
  });

  it('detects Future<void> main() async', () => {
    const content = 'Future<void> main() async {\n  await init();\n}';
    expect(isDartEntryPoint(content, 'main.dart', 'lib/main.dart')).toBe(true);
  });

  it('detects bin/ entry points', () => {
    const content = 'void main(List<String> args) {\n  print("hello");\n}';
    expect(isDartEntryPoint(content, 'cli.dart', 'bin/cli.dart')).toBe(true);
  });

  it('does not detect file without main as entry point', () => {
    const content = 'class Foo {}';
    expect(isDartEntryPoint(content, 'foo.dart', 'lib/foo.dart')).toBe(false);
  });
});

// ─── K. Mixed-Language Workspace ──────────────────────────────────────────────

describe('Mixed-Language Workspace', () => {
  let tmpDir: string;

  beforeAll(() => {
    tmpDir = createTempDir();
    // TypeScript files
    writeFile(tmpDir, 'web/src/app.ts', "import { api } from './api';");
    writeFile(tmpDir, 'web/src/api.ts', "export const api = {};");
    // Dart files
    writeFile(tmpDir, 'flutter_app/pubspec.yaml', 'name: flutter_app\nversion: 1.0.0');
    writeFile(tmpDir, 'flutter_app/lib/main.dart', "import 'package:flutter_app/services/api.dart';\nvoid main() { }");
    writeFile(tmpDir, 'flutter_app/lib/services/api.dart', 'class ApiService {}');
  });

  it('discovers both TS and Dart files', () => {
    const tsFile = path.join(tmpDir, 'web/src/app.ts');
    const dartFile = path.join(tmpDir, 'flutter_app/lib/main.dart');

    expect(detectLanguage(tsFile)).toBe('typescript');
    expect(detectLanguage(dartFile)).toBe('dart');
  });

  it('parses TS files correctly', () => {
    const filePath = path.join(tmpDir, 'web/src/app.ts');
    const fileNode = parseFile(filePath, tmpDir);
    expect(fileNode).not.toBeNull();
    expect(fileNode!.language).toBe('typescript');
    expect(fileNode!.imports.length).toBeGreaterThan(0);
  });

  it('parses Dart files correctly', () => {
    const ctx = discoverDartPackages(tmpDir, new Set(), 10);
    const filePath = path.join(tmpDir, 'flutter_app/lib/main.dart');
    const fileNode = parseFile(filePath, tmpDir, ctx);
    expect(fileNode).not.toBeNull();
    expect(fileNode!.language).toBe('dart');
    expect(fileNode!.imports.length).toBe(1);
    expect(fileNode!.isEntryPoint).toBe(true);
  });

  it('resolves Dart package imports using discovered packages', () => {
    const ctx = discoverDartPackages(tmpDir, new Set(), 10);
    expect(ctx.packagesByName.get('flutter_app')).toBe(path.join(tmpDir, 'flutter_app'));

    const filePath = path.join(tmpDir, 'flutter_app/lib/main.dart');
    const fileNode = parseFile(filePath, tmpDir, ctx);
    expect(fileNode!.imports[0].resolvedPath).toBe('flutter_app/lib/services/api.dart');
  });
});

// ─── L. Generated Files ───────────────────────────────────────────────────────

describe('Dart Generated Files', () => {
  it('identifies *.g.dart as generated', () => {
    expect(isDartGeneratedFile('/path/to/user.g.dart')).toBe(true);
  });

  it('identifies *.freezed.dart as generated', () => {
    expect(isDartGeneratedFile('/path/to/state.freezed.dart')).toBe(true);
  });

  it('identifies *.gr.dart as generated', () => {
    expect(isDartGeneratedFile('/path/to/router.gr.dart')).toBe(true);
  });

  it('identifies *.gen.dart as generated', () => {
    expect(isDartGeneratedFile('/path/to/api.gen.dart')).toBe(true);
  });

  it('identifies *.mocks.dart as generated', () => {
    expect(isDartGeneratedFile('/path/to/service.mocks.dart')).toBe(true);
  });

  it('does not flag normal dart files as generated', () => {
    expect(isDartGeneratedFile('/path/to/main.dart')).toBe(false);
    expect(isDartGeneratedFile('/path/to/user_model.dart')).toBe(false);
  });
});

// ─── Additional: Import Parsing Robustness ────────────────────────────────────

describe('Dart Import Parsing Robustness', () => {
  const ctx: DartWorkspaceContext = { packagesByName: new Map() };

  it('handles double quotes', () => {
    const content = 'import "package:flutter/material.dart";';
    const imports = parseDartImports(content, '/tmp/test.dart', '/tmp', ctx);
    expect(imports.length).toBe(1);
    expect(imports[0].source).toBe('package:flutter/material.dart');
  });

  it('handles as clause', () => {
    const content = "import 'foo.dart' as foo;";
    const imports = parseDartImports(content, '/tmp/lib/test.dart', '/tmp', ctx);
    expect(imports.length).toBe(1);
    expect(imports[0].source).toBe('foo.dart');
  });

  it('handles show clause', () => {
    const content = "import 'foo.dart' show Foo, Bar;";
    const imports = parseDartImports(content, '/tmp/lib/test.dart', '/tmp', ctx);
    expect(imports.length).toBe(1);
    expect(imports[0].specifiers).toEqual(['Foo', 'Bar']);
  });

  it('handles hide clause', () => {
    const content = "import 'foo.dart' hide Baz;";
    const imports = parseDartImports(content, '/tmp/lib/test.dart', '/tmp', ctx);
    expect(imports.length).toBe(1);
    expect(imports[0].specifiers).toEqual(['Baz']);
  });

  it('ignores commented-out imports', () => {
    const content = [
      "// import 'should_be_ignored.dart';",
      "import 'real_import.dart';",
      "/* import 'also_ignored.dart'; */",
    ].join('\n');
    const imports = parseDartImports(content, '/tmp/lib/test.dart', '/tmp', ctx);
    expect(imports.length).toBe(1);
    expect(imports[0].source).toBe('real_import.dart');
  });

  it('handles trailing comments', () => {
    const content = "import 'foo.dart'; // This is a comment";
    const imports = parseDartImports(content, '/tmp/lib/test.dart', '/tmp', ctx);
    expect(imports.length).toBe(1);
    expect(imports[0].source).toBe('foo.dart');
  });

  it('handles whitespace before import', () => {
    const content = "  \t  import 'foo.dart';";
    const imports = parseDartImports(content, '/tmp/lib/test.dart', '/tmp', ctx);
    expect(imports.length).toBe(1);
  });
});

// ─── pubspec.yaml Parsing ─────────────────────────────────────────────────────

describe('pubspec.yaml Parsing', () => {
  let tmpDir: string;

  beforeAll(() => {
    tmpDir = createTempDir();
  });

  it('parses valid package name', () => {
    const pubspecPath = writeFile(tmpDir, 'valid/pubspec.yaml', 'name: my_app\nversion: 1.0.0');
    expect(parsePubspecName(pubspecPath)).toBe('my_app');
  });

  it('handles quoted package name', () => {
    const pubspecPath = writeFile(tmpDir, 'quoted/pubspec.yaml', "name: 'my_app'\nversion: 1.0.0");
    expect(parsePubspecName(pubspecPath)).toBe('my_app');
  });

  it('returns null for malformed pubspec', () => {
    const pubspecPath = writeFile(tmpDir, 'bad/pubspec.yaml', 'this is not yaml at all');
    expect(parsePubspecName(pubspecPath)).toBeNull();
  });

  it('returns null for invalid package name', () => {
    const pubspecPath = writeFile(tmpDir, 'invalid/pubspec.yaml', 'name: Invalid-Name\nversion: 1.0.0');
    expect(parsePubspecName(pubspecPath)).toBeNull();
  });

  it('handles missing file gracefully', () => {
    expect(parsePubspecName('/nonexistent/pubspec.yaml')).toBeNull();
  });
});
