# Changelog

All notable changes to the Atlas extension are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] — Initial release

### Added
- Repository scanning with configurable exclude patterns and depth
- Multi-language import/export parsing for TypeScript, JavaScript, Python, Go, Rust, Java, and C#
- Dependency graph construction with weighted edges
- Circular dependency detection with severity scoring
- Dead code detection via reachability analysis from entry points
- Layer violation detection (UI → data, service → UI, etc.)
- Semantic system classification across 12 architectural categories
- Auto-generated system explanations with responsibilities, callers, and dependencies
- Activity bar Architecture Explorer panel (webview)
- Native Explorer integration (`Ctrl+Shift+E` → "Atlas Architecture")
- Interactive architecture graph with three layouts: Force, Hierarchy, Radial
- System filter pills, search, and click-to-open navigation
- Incremental cache: only changed files are re-parsed on rescan
- Live file watcher with 3-second debounce
- Theme-aware UI (light, dark, high-contrast)
