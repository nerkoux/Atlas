// ─── Language & Core Types ────────────────────────────────────────────────────

export type Language =
  | 'typescript'
  | 'javascript'
  | 'python'
  | 'go'
  | 'rust'
  | 'java'
  | 'csharp'
  | 'unknown';

export type SystemType =
  | 'api'
  | 'auth'
  | 'database'
  | 'state'
  | 'ui'
  | 'service'
  | 'util'
  | 'config'
  | 'test'
  | 'middleware'
  | 'model'
  | 'payment'
  | 'core'
  | 'unknown';

export type ArchitecturalLayer =
  | 'ui'
  | 'api'
  | 'service'
  | 'data'
  | 'infra'
  | 'config'
  | 'test'
  | 'unknown';

// ─── File & Dependency Types ──────────────────────────────────────────────────

export interface FileNode {
  id: string;
  path: string;
  relativePath: string;
  name: string;
  extension: string;
  language: Language;
  size: number;
  imports: ImportEntry[];
  exports: ExportEntry[];
  systemId?: string;
  isEntryPoint: boolean;
  isDeadCode?: boolean;
  lastModified?: number;
}

export interface ImportEntry {
  source: string;
  resolvedPath?: string;
  specifiers: string[];
  isExternal: boolean;
  isDynamic: boolean;
  line: number;
}

export interface ExportEntry {
  name: string;
  type: 'function' | 'class' | 'const' | 'default' | 'type' | 'interface' | 'unknown';
  line: number;
}

export interface DependencyEdge {
  id: string;
  source: string;
  target: string;
  type: 'import' | 'dynamic-import' | 're-export';
  weight: number;
}

// ─── Architecture Types ───────────────────────────────────────────────────────

export interface ArchitectureSystem {
  id: string;
  name: string;
  type: SystemType;
  files: string[];
  entryPoints: string[];
  color: string;
  description?: string;
  metrics: SystemMetrics;
}

export interface SystemMetrics {
  fileCount: number;
  totalImports: number;
  totalExports: number;
  couplingScore: number;
  cohesionScore: number;
  hasCircularDeps: boolean;
}

export interface CircularDependency {
  cycle: string[];
  severity: 'low' | 'medium' | 'high';
}

export interface LayerViolation {
  fromFile: string;
  toFile: string;
  fromLayer: ArchitecturalLayer;
  toLayer: ArchitecturalLayer;
  description: string;
  severity: 'low' | 'medium' | 'high';
}

export interface DeadZone {
  id: string;
  name: string;
  files: string[];
  reason: string;
  lastReachableFrom?: string;
}

export interface SystemExplanation {
  systemId: string;
  summary: string;
  responsibilities: string[];
  usedBy: string[];
  uses: string[];
  entryPoints: string[];
  warnings: string[];
}

// ─── Graph Data ───────────────────────────────────────────────────────────────

export interface GraphNode {
  id: string;
  label: string;
  path: string;
  relativePath: string;
  language: Language;
  systemId: string;
  systemColor: string;
  isEntryPoint: boolean;
  isDeadCode: boolean;
  importCount: number;
  exportCount: number;
  dependencyCount: number;
  dependentCount: number;
  size: number;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: 'import' | 'dynamic-import' | 're-export';
  weight: number;
}

export interface RepoStats {
  totalFiles: number;
  totalSystems: number;
  totalEdges: number;
  circularDepsCount: number;
  deadCodeCount: number;
  languageBreakdown: Record<string, number>;
  mostConnectedFiles: Array<{ path: string; connections: number }>;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  systems: ArchitectureSystem[];
  circularDeps: CircularDependency[];
  stats: RepoStats;
  layerViolations?: LayerViolation[];
  deadZones?: DeadZone[];
  explanations?: Record<string, SystemExplanation>;
  fileLayerMap?: Record<string, ArchitecturalLayer>;
}

export interface GraphDataV2 extends GraphData {
  layerViolations: LayerViolation[];
  deadZones: DeadZone[];
  explanations: Record<string, SystemExplanation>;
  fileLayerMap: Record<string, ArchitecturalLayer>;
}

// ─── Progress & Messaging ─────────────────────────────────────────────────────

export interface ScanProgress {
  phase: 'discovering' | 'parsing' | 'analyzing' | 'classifying' | 'complete' | 'error';
  current: number;
  total: number;
  currentFile?: string;
  message: string;
}

export type MessageToWebview =
  | { type: 'graphData'; data: GraphData }
  | { type: 'progress'; data: ScanProgress }
  | { type: 'focusNode'; nodeId: string }
  | { type: 'error'; message: string }
  | { type: 'workspaceInfo'; name: string; path: string };

export type MessageFromWebview =
  | { type: 'ready' }
  | { type: 'scan' }
  | { type: 'openFile'; path: string; line?: number }
  | { type: 'focusSystem'; systemId: string }
  | { type: 'requestStats' }
  | { type: 'explainSystem'; systemId: string }
  | { type: 'traceFile'; fileId: string };

// ─── Cache ────────────────────────────────────────────────────────────────────

export interface FileCache {
  version: number;
  workspaceRoot: string;
  files: Record<string, FileCacheEntry>;
  graphData: GraphData;
  timestamp: number;
}

export interface FileCacheEntry {
  hash: number;
  size: number;
  lastModified: number;
}
