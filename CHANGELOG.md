# Changelog

All notable changes to the Atlas extension are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.4] — Custom Radial layout

### Fixed
- **Radial mode in system view no longer collapses to a vertical line.** Replaced Cytoscape's built-in `concentric` (which placed every node at the start angle when there was one node per ring) with a custom Atlas Radial layout that buckets systems into clean concentric rings, distributes them evenly around each ring, and interleaves large and small bubbles so similar sizes don't clump.

### Added
- Hubs (high-degree systems) automatically sit at the centre when the graph has 4+ systems; smaller systems orbit on outer rings.
- Concentric rings stagger their start angles so the layout looks balanced instead of stacked along one axis.

## [0.1.3] — Smarter classification & better Force layout

### Added
- **Atlas custom Force layout** for the system view — a deterministic hub-and-spoke arrangement that places the heaviest system at the centre, orbits its neighbours on auto-sized rings, and packs disconnected clusters in a balanced grid below. Replaces the generic physics simulation that left bubbles overlapping or floating in awkward positions.
- **Smarter classifier** with strong path-anchored rules. Files like `lib/auth/*`, `lib/services/*.service.ts`, `lib/models/*`, `lib/db/*`, `_hooks/*`, `_logic/*`, `_components/*`, `validators/*`, `config/*`, `types/*`, and Next.js `app/api/*/route.ts` are now correctly grouped instead of falling into a single "Other" bucket.
- **Folder-based fallback grouping** — anything still unclassified is grouped by its top-level directory name (e.g. `discord`, `proxy`) instead of dumping into "Other", preserving architectural shape on the graph.
- **Validators**, **Types**, and **Tests** as first-class system buckets.
- **Bilkent + Dagre vendor scripts** are now properly registered before use, fixing the silent extension-registration race that previously caused Hierarchy mode to fall back to breadthfirst.

### Changed
- **Tree provider switched from `registerTreeDataProvider` to `createTreeView`** so the "Atlas Architecture" panel under the native Explorer (`Ctrl+Shift+E`) populates immediately on workspace open. No more "There is no data provider registered" error.
- **Auto-scan now triggers from extension activation**, not from the activity-bar webview's `ready` message. Opening a folder kicks off the scan whether you visit the Atlas panel first or not.
- **Radial layout in system view** uses a degree-weighted concentric formula with `spacingFactor: 1.5`, fixing the earlier degenerate vertical-line arrangement and producing a proper radial fan.
- **Tree shows a friendly placeholder** ("Atlas is analysing your workspace…") while the initial scan is running instead of appearing broken.
- **Cache version bumped to v3** so existing `.atlas-cache.json` files are invalidated and re-classified with the new rules.

### Fixed
- File-view Force layout no longer overlaps system-coloured nodes thanks to `avoidOverlap` on the supported tunings.
- Layer detection (used for layer-violation analysis) now correctly classifies `_logic/`, `_hooks/`, `_components/`, `validators/`, and Next.js route segments.
- Force-layout drag interactions are smoother now that node positions are deterministic instead of converging from a random seed.

## [0.1.2] — Performance & UX

### Added
- **Systems view** — collapses each architectural system into one bubble. Default for repos with > 150 files. Click a system to drill into its files. Scales to thousands of files.
- **Adaptive rendering** — File view automatically switches into a "lite" profile above 300 nodes: smaller nodes, no glow shadows, edges drawn as straight lines, labels hidden until zoomed in.
- **Graph-ready handshake** — Webview now signals readiness to the host instead of relying on a 300ms timeout, fixing the race where the graph would hang on "Building graph…" until clicked twice.

### Changed
- COSE layout iteration counts now scale with graph size (1500 → 800 → 400 for big repos) so the canvas settles instead of churning.
- Compound parent nodes are skipped above 300 file nodes to halve element count.
- Edge rendering uses `haystack` curves and no arrowheads on large graphs for smoother panning.

### Fixed
- Graph panel no longer drops the initial dataset on cold open.
- Empty/zero-result systems are filtered out before rendering.

## [0.1.1] — Metadata update

### Changed
- Updated repository, bugs, and homepage URLs in `package.json`

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
