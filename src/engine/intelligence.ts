import {
  FileNode, GraphNode, GraphEdge, ArchitectureSystem,
  ArchitecturalLayer, LayerViolation, DeadZone,
  SystemExplanation, GraphDataV2, GraphData,
} from '../types';

const LAYER_ORDER: ArchitecturalLayer[] = ['ui', 'api', 'service', 'data', 'infra', 'config', 'test', 'unknown'];

const LAYER_RULES: Array<{ layer: ArchitecturalLayer; patterns: RegExp[] }> = [
  { layer: 'ui',      patterns: [/\.(tsx|jsx)$/, /\/pages?\//i, /\/components?\//i, /\/views?\//i, /\/screens?\//i, /\/layouts?\//i, /\/ui\//i] },
  { layer: 'api',     patterns: [/\/routes?\//i, /\/controllers?\//i, /\/handlers?\//i, /\/endpoints?\//i, /\/api\//i, /\.route\./i, /\.controller\./i] },
  { layer: 'service', patterns: [/\/services?\//i, /\/managers?\//i, /\.service\./i, /\/usecases?\//i, /\/domain\//i] },
  { layer: 'data',    patterns: [/\/models?\//i, /\/schemas?\//i, /\/repositories?\//i, /\/migrations?\//i, /\/entities?\//i, /\.model\./i, /\.schema\./i, /\/db\//i, /\/database\//i] },
  { layer: 'infra',   patterns: [/\/infra\//i, /\/infrastructure\//i, /\/adapters?\//i, /\/providers?\//i, /\/clients?\//i, /\/cache\//i, /\/queue\//i] },
  { layer: 'config',  patterns: [/\/config\//i, /\/settings?\//i, /\/constants?\//i, /\.config\./i, /\/env\//i] },
  { layer: 'test',    patterns: [/\.test\./i, /\.spec\./i, /__tests__/i, /\/tests?\//i, /\/specs?\//i, /\/e2e\//i, /\/mocks?\//i, /\/fixtures?\//i] },
];

export function detectLayer(relativePath: string): ArchitecturalLayer {
  const p = relativePath.toLowerCase();
  for (const { layer, patterns } of LAYER_RULES) {
    if (patterns.some((r) => r.test(p))) return layer;
  }
  return 'unknown';
}

const ILLEGAL_IMPORTS: Array<{ from: ArchitecturalLayer; to: ArchitecturalLayer; description: string; severity: LayerViolation['severity'] }> = [
  { from: 'ui',      to: 'data',    description: 'UI layer directly imports data/database layer', severity: 'high' },
  { from: 'ui',      to: 'infra',   description: 'UI layer directly imports infrastructure', severity: 'high' },
  { from: 'api',     to: 'data',    description: 'Route/controller bypasses service layer to access data directly', severity: 'medium' },
  { from: 'service', to: 'ui',      description: 'Service layer imports UI components (inverted dependency)', severity: 'high' },
  { from: 'data',    to: 'ui',      description: 'Data layer imports UI components', severity: 'high' },
  { from: 'data',    to: 'api',     description: 'Data layer imports API layer', severity: 'medium' },
  { from: 'infra',   to: 'ui',      description: 'Infrastructure imports UI layer', severity: 'medium' },
];

export function detectLayerViolations(
  nodes: GraphNode[],
  edges: GraphEdge[],
  fileLayerMap: Record<string, ArchitecturalLayer>
): LayerViolation[] {
  const violations: LayerViolation[] = [];
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  for (const edge of edges) {
    const fromLayer = fileLayerMap[edge.source];
    const toLayer = fileLayerMap[edge.target];
    if (!fromLayer || !toLayer || fromLayer === toLayer) continue;
    if (fromLayer === 'unknown' || toLayer === 'unknown') continue;

    const rule = ILLEGAL_IMPORTS.find((r) => r.from === fromLayer && r.to === toLayer);
    if (rule) {
      const fromNode = nodeMap.get(edge.source);
      const toNode = nodeMap.get(edge.target);
      if (!fromNode || !toNode) continue;
      violations.push({
        fromFile: edge.source,
        toFile: edge.target,
        fromLayer,
        toLayer,
        description: rule.description,
        severity: rule.severity,
      });
    }
  }

  return violations;
}

export function detectDeadZones(
  nodes: GraphNode[],
  systems: ArchitectureSystem[]
): DeadZone[] {
  const deadNodes = nodes.filter((n) => n.isDeadCode);
  if (deadNodes.length === 0) return [];

  const systemMap = new Map(systems.map((s) => [s.id, s]));
  const zoneMap = new Map<string, string[]>();

  for (const n of deadNodes) {
    const key = n.systemId ?? 'unknown';
    if (!zoneMap.has(key)) zoneMap.set(key, []);
    zoneMap.get(key)!.push(n.id);
  }

  const zones: DeadZone[] = [];
  for (const [systemId, files] of zoneMap) {
    const sys = systemMap.get(systemId);
    const totalInSystem = sys?.files.length ?? 0;
    const ratio = totalInSystem > 0 ? files.length / totalInSystem : 1;

    let reason: string;
    if (ratio > 0.8) reason = 'Entire system appears unreachable — possibly legacy or abandoned';
    else if (ratio > 0.5) reason = 'Majority of system files are unreachable from any entry point';
    else reason = `${files.length} file${files.length > 1 ? 's' : ''} unreachable from any entry point`;

    zones.push({
      id: `dead-${systemId}`,
      name: sys?.name ?? 'Unknown System',
      files,
      reason,
    });
  }

  return zones.sort((a, b) => b.files.length - a.files.length);
}

export function generateSystemExplanations(
  systems: ArchitectureSystem[],
  nodes: GraphNode[],
  edges: GraphEdge[]
): Record<string, SystemExplanation> {
  const explanations: Record<string, SystemExplanation> = {};
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  const systemFileSet = new Map<string, Set<string>>();
  for (const sys of systems) {
    systemFileSet.set(sys.id, new Set(sys.files));
  }

  for (const sys of systems) {
    const sysFiles = new Set(sys.files);
    const entryPoints: string[] = [];
    const responsibilities: string[] = [];
    const warnings: string[] = [];

    const usedBySystemIds = new Set<string>();
    const usesSystemIds = new Set<string>();

    for (const fileId of sys.files) {
      const node = nodeMap.get(fileId);
      if (!node) continue;
      if (node.isEntryPoint) entryPoints.push(node.label);

      for (const edge of edges) {
        if (edge.target === fileId && !sysFiles.has(edge.source)) {
          const srcNode = nodeMap.get(edge.source);
          if (srcNode?.systemId && srcNode.systemId !== sys.id) {
            usedBySystemIds.add(srcNode.systemId);
          }
        }
        if (edge.source === fileId && !sysFiles.has(edge.target)) {
          const tgtNode = nodeMap.get(edge.target);
          if (tgtNode?.systemId && tgtNode.systemId !== sys.id) {
            usesSystemIds.add(tgtNode.systemId);
          }
        }
      }
    }

    if (sys.metrics.hasCircularDeps) {
      warnings.push('Contains circular dependencies — may cause runtime initialization issues');
    }
    if (sys.metrics.couplingScore > 1.5) {
      warnings.push('High coupling score — this system has many external dependencies');
    }

    const deadInSystem = sys.files.filter((f) => nodeMap.get(f)?.isDeadCode).length;
    if (deadInSystem > 0) {
      warnings.push(`${deadInSystem} file${deadInSystem > 1 ? 's' : ''} unreachable from entry points`);
    }

    responsibilities.push(...inferResponsibilities(sys, nodes, nodeMap));

    const usedBy = [...usedBySystemIds]
      .map((id) => systems.find((s) => s.id === id)?.name)
      .filter(Boolean) as string[];
    const uses = [...usesSystemIds]
      .map((id) => systems.find((s) => s.id === id)?.name)
      .filter(Boolean) as string[];

    explanations[sys.id] = {
      systemId: sys.id,
      summary: buildSummary(sys, usedBy, uses, entryPoints),
      responsibilities,
      usedBy,
      uses,
      entryPoints,
      warnings,
    };
  }

  return explanations;
}

function inferResponsibilities(
  sys: ArchitectureSystem,
  nodes: GraphNode[],
  nodeMap: Map<string, GraphNode>
): string[] {
  const responsibilities: string[] = [];
  const sysNodes = sys.files.map((f) => nodeMap.get(f)).filter(Boolean) as GraphNode[];

  const exportCount = sysNodes.reduce((s, n) => s + n.exportCount, 0);
  const importCount = sysNodes.reduce((s, n) => s + n.importCount, 0);

  if (exportCount > importCount * 1.5) {
    responsibilities.push('Primarily a provider — exports more than it consumes');
  }
  if (importCount > exportCount * 1.5) {
    responsibilities.push('Primarily a consumer — orchestrates multiple dependencies');
  }

  switch (sys.type) {
    case 'auth':
      responsibilities.push('Handles identity verification and access control');
      if (sysNodes.some((n) => /jwt|token/i.test(n.label))) responsibilities.push('Issues and validates JWT tokens');
      if (sysNodes.some((n) => /session/i.test(n.label))) responsibilities.push('Manages user session lifecycle');
      if (sysNodes.some((n) => /guard|protect/i.test(n.label))) responsibilities.push('Guards protected routes and resources');
      break;
    case 'api':
      responsibilities.push('Exposes HTTP endpoints and handles request routing');
      if (sysNodes.some((n) => /middleware/i.test(n.label))) responsibilities.push('Applies request middleware pipeline');
      break;
    case 'database':
      responsibilities.push('Manages data persistence and retrieval');
      if (sysNodes.some((n) => /migration/i.test(n.label))) responsibilities.push('Handles schema migrations');
      if (sysNodes.some((n) => /repository|dao/i.test(n.label))) responsibilities.push('Abstracts database access through repository pattern');
      break;
    case 'state':
      responsibilities.push('Manages application-wide state');
      if (sysNodes.some((n) => /store/i.test(n.label))) responsibilities.push('Defines global state stores');
      if (sysNodes.some((n) => /action|reducer/i.test(n.label))) responsibilities.push('Handles state mutations through actions');
      break;
    case 'ui':
      responsibilities.push('Renders user interface components');
      if (sysNodes.some((n) => /page|route/i.test(n.label))) responsibilities.push('Defines page-level route components');
      if (sysNodes.some((n) => /layout/i.test(n.label))) responsibilities.push('Provides layout and page structure');
      break;
    case 'service':
      responsibilities.push('Implements core business logic');
      break;
    case 'payment':
      responsibilities.push('Orchestrates payment processing and billing');
      if (sysNodes.some((n) => /stripe|webhook/i.test(n.label))) responsibilities.push('Handles Stripe webhooks and payment events');
      if (sysNodes.some((n) => /subscription/i.test(n.label))) responsibilities.push('Manages subscription lifecycle');
      break;
    case 'middleware':
      responsibilities.push('Intercepts and transforms request/response pipeline');
      break;
    case 'util':
      responsibilities.push('Provides shared utilities and helper functions');
      break;
    case 'config':
      responsibilities.push('Centralizes configuration and environment variables');
      break;
    case 'test':
      responsibilities.push('Contains test suites and test utilities');
      break;
  }

  return [...new Set(responsibilities)];
}

function buildSummary(
  sys: ArchitectureSystem,
  usedBy: string[],
  uses: string[],
  entryPoints: string[]
): string {
  const parts: string[] = [];

  const typeLabels: Record<string, string> = {
    auth: 'the authentication and authorization system',
    api: 'the API routing and controller layer',
    database: 'the data persistence and database layer',
    state: 'the application state management layer',
    ui: 'the UI component layer',
    service: 'the business logic service layer',
    payment: 'the payment and billing system',
    middleware: 'the request/response middleware pipeline',
    util: 'shared utilities and helper functions',
    config: 'application configuration and environment management',
    test: 'the test suite',
    core: 'the core application bootstrap',
    unknown: `the ${sys.name} module`,
  };

  parts.push(`${sys.name} is ${typeLabels[sys.type] ?? sys.name}.`);

  if (usedBy.length > 0) {
    parts.push(`Used by: ${usedBy.slice(0, 3).join(', ')}${usedBy.length > 3 ? ` and ${usedBy.length - 3} more` : ''}.`);
  }

  if (uses.length > 0) {
    parts.push(`Depends on: ${uses.slice(0, 3).join(', ')}${uses.length > 3 ? ` and ${uses.length - 3} more` : ''}.`);
  }

  parts.push(`Contains ${sys.files.length} file${sys.files.length !== 1 ? 's' : ''}.`);

  return parts.join(' ');
}

export function buildGraphDataV2(base: GraphData, parsedFiles: FileNode[]): GraphDataV2 {
  const fileLayerMap: Record<string, ArchitecturalLayer> = {};
  for (const node of base.nodes) {
    fileLayerMap[node.id] = detectLayer(node.relativePath);
  }

  const layerViolations = detectLayerViolations(base.nodes, base.edges, fileLayerMap);
  const deadZones = detectDeadZones(base.nodes, base.systems);
  const explanations: Record<string, SystemExplanation> = generateSystemExplanations(base.systems, base.nodes, base.edges);

  return {
    ...base,
    layerViolations,
    deadZones,
    explanations,
    fileLayerMap,
  };
}
