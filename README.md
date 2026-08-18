<div align="center">
  <img src="resources/atlaslogo.png" alt="Atlas" width="128" />
  <h1>Atlas — Architecture Explorer</h1>
  <p><strong>Google Maps for codebases.</strong> Stop browsing folders. Start navigating systems.</p>
</div>

---

## Why Atlas

Large codebases are hard to read. The native VS Code Explorer shows you a folder tree, but folders are a filing cabinet, not an architecture. Atlas reads your repository, detects the systems inside it (auth, API, data, state, payment, UI…), and gives you a way to navigate **by meaning** instead of by directory.

You get:

- A **system-grouped explorer** in the sidebar so you can jump straight into "Auth" or "Payments" without remembering where the files live
- A **dependency graph** that visualises how files actually connect at runtime
- **Architectural insights** — circular dependencies, dead code, layer violations, hot spots — surfaced automatically
- A **plain-English explanation** for each system: what it does, who uses it, what it depends on, what's risky

It's a read-only layer on top of your code. It doesn't refactor, doesn't move files, doesn't call any external service.

## Features

### Semantic system explorer
Atlas scans your workspace and groups files into architectural systems based on path patterns, naming conventions, exports, and dependency relationships. You see "Auth System / Payment System / UI Components" instead of `src/auth/ src/billing/ src/components/`.

### Interactive architecture graph
A full-canvas graph view (Force, Hierarchy, or Radial layouts) shows files as nodes coloured by system, with import edges between them. Click a file to highlight its connections, double-click to open it, or filter to a single system to focus.

### Native Explorer integration
A second tree view appears under the built-in VS Code Explorer (`Ctrl+Shift+E` → **Atlas Architecture**) so you can navigate by system without leaving your usual file workflow. Files are sorted by importance — entry points first, then by how many other files depend on them.

### Architectural diagnostics
Atlas surfaces problems passively while you work:
- **Circular dependencies** with severity scoring
- **Layer violations** like UI importing directly from the data layer
- **Dead zones** — files unreachable from any entry point
- **Hot spots** — files that everything else depends on

### System explanations
Each system gets an auto-generated summary: what it's responsible for, which other systems use it, which it depends on, and any architectural warnings worth knowing about.

### Incremental and fast
The first scan parses every file; subsequent scans only re-parse files whose hashes changed. A 3-second debounced file watcher keeps the analysis live as you edit.

## Supported languages

| Language    | Imports | Exports | Entry detection |
|-------------|:-------:|:-------:|:---------------:|
| TypeScript  | ✅      | ✅      | ✅              |
| JavaScript  | ✅      | ✅      | ✅              |
| Python      | ✅      | ✅      | ✅              |
| Go          | ✅      | ✅      | ✅              |
| Rust        | ✅      | ✅      | ✅              |
| Java        | ✅      | ✅      | ✅              |
| C#          | ✅      | ✅      | ✅              |
| Dart        | ✅      | ✅      | ✅              |

Atlas is language-agnostic internally. New languages can be added by extending the parser.

### Dart & Flutter support

Atlas provides first-class support for Dart and Flutter projects:

- **Relative imports** - `import '../services/foo.dart';` resolved relative to the importing file
- **Local `package:` imports** - `import 'package:my_app/services/foo.dart';` resolved via `pubspec.yaml` package names to the corresponding `lib/` directory
- **Multi-package monorepos** - Atlas discovers all `pubspec.yaml` files in the workspace and builds a package-name to package-root lookup, enabling cross-package import resolution
- **External packages** - `package:flutter/material.dart` and other third-party packages are marked as external dependencies (not scanned)
- **SDK imports ignored** - `dart:async`, `dart:io`, etc. do not create internal dependency edges
- **Generated file exclusions** - `*.g.dart`, `*.freezed.dart`, `*.gr.dart`, `*.gen.dart`, `*.mocks.dart` are excluded from analysis by default
- **Symbol detection** - public classes, mixins, enums, extensions, typedefs, and top-level functions are extracted
- **Entry point detection** - files with a top-level `main()` function (including `bin/` scripts) are recognized as entry points
- **Mixed-language workspaces** - a repository containing both TypeScript/JavaScript and Dart/Flutter code is analyzed together in a single scan

Atlas performs source-level dependency analysis for Dart. It does not invoke the Dart Analysis Server or perform full semantic analysis.

## Getting started

1. Install **Atlas — Architecture Explorer** from the VS Code Marketplace
2. Open any repository
3. Click the Atlas icon in the activity bar (left edge of the window)
4. Click **Scan Workspace**

The first scan typically takes a few seconds for small projects and up to a minute for large monorepos. Once complete, the systems appear in the sidebar and the graph becomes available.

## Commands

All commands are available through the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`):

| Command                                    | Description                                            |
|--------------------------------------------|--------------------------------------------------------|
| `Atlas: Open Architecture Explorer`        | Focus the Atlas sidebar                                |
| `Atlas: Scan Workspace`                    | Re-analyse the current workspace                       |
| `Atlas: Refresh Graph`                     | Rebuild the architecture graph                         |
| `Atlas: Open Architecture Graph`           | Open the full-canvas graph view in the editor          |
| `Atlas: Focus Current File in Graph`       | Highlight the currently-open editor file in the graph  |
| `Atlas: Refresh Architecture Tree`         | Refresh the Explorer tree view                         |

## Configuration

```json
{
  "atlas.autoScan": true,
  "atlas.scanDepth": 10,
  "atlas.excludePatterns": [
    "**/node_modules/**",
    "**/.git/**",
    "**/dist/**",
    "**/build/**",
    "**/.next/**",
    "**/__pycache__/**",
    "**/.dart_tool/**",
    "**/.pub-cache/**",
    "**/*.g.dart",
    "**/*.freezed.dart",
    "**/*.gr.dart",
    "**/*.gen.dart",
    "**/*.mocks.dart"
  ],
  "atlas.languages": ["typescript", "javascript", "python", "go", "dart"]
}
```

| Setting                  | Default                                  | Description                                                |
|--------------------------|------------------------------------------|------------------------------------------------------------|
| `atlas.autoScan`         | `true`                                   | Scan automatically when a workspace is opened              |
| `atlas.scanDepth`        | `10`                                     | Maximum directory depth to recurse                         |
| `atlas.excludePatterns`  | common build/cache dirs                  | Glob patterns to skip during scanning                      |
| `atlas.languages`        | `[ts, js, py, go, dart]`                 | Languages to analyse (controls file selection during scan) |

## Graph interactions

| Action               | Result                                                 |
|----------------------|--------------------------------------------------------|
| Hover node           | Soft glow, connected edges brighten                    |
| Click node           | Show details popup, dim unrelated nodes                |
| Double-click node    | Open the source file in the editor                     |
| Right-click node     | Open the source file in the editor                     |
| Click background     | Clear selection                                        |
| Click system pill    | Filter the graph to that system only                   |
| Mouse wheel          | Zoom                                                   |
| Drag                 | Pan                                                    |
| Layout buttons       | Switch between Force, Hierarchy, Radial layouts        |

## Privacy

Atlas runs entirely on your machine. It does **not**:

- Send any code, file paths, or telemetry to any external service
- Make network requests of any kind
- Read files outside your workspace folder

The analysis cache is stored locally in `.atlas-cache.json` at the workspace root. You can safely add this file to `.gitignore` if you don't want to commit it.

## Performance

- Files are parsed in batches of 50 with event-loop yields between batches, so the editor stays responsive even on large repositories
- Hash-based incremental scanning means only changed files are re-parsed after the initial scan
- The graph uses Cytoscape.js with Canvas rendering for smooth interaction up to several thousand nodes

## Known limitations

- Re-exports across module boundaries may not always be tracked perfectly
- Type-only imports are treated identically to value imports
- Dynamic imports are detected but not always resolved to a concrete target

## Contributing

Contributions are welcome. The codebase is organised as:

```
src/
├── extension.ts            VS Code extension entry point
├── SidebarProvider.ts      Activity-bar webview provider + messaging
├── GraphPanelProvider.ts   Editor-area graph webview provider
├── AtlasTreeProvider.ts    Native Explorer tree provider
├── types.ts                Shared type definitions
├── engine/                 Language-agnostic analysis core
│   ├── parser.ts           Per-language import/export parsing
│   ├── dartParser.ts       Dart/Flutter-specific parsing & resolution
│   ├── graph.ts            Dependency graph + cycle/dead-code detection
│   ├── classifier.ts       System classification rules
│   ├── intelligence.ts     Layer violations + dead zones + explanations
│   ├── cache.ts            Hash-based incremental cache
│   └── scanner.ts          File discovery + orchestration
└── webview/                React UI for both panels
```

To build locally:

```bash
npm install
npm run build
```

Press `F5` in VS Code to launch an Extension Development Host with the extension loaded.

## License

[MIT](LICENSE)
