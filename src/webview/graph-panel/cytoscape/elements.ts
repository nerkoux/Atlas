/**
 * Builds Cytoscape element data from Atlas graph data.
 *
 * For small/medium graphs (up to 300 file nodes) we render compound parent
 * nodes per system so the architectural grouping is visible even when files
 * have no internal imports. Above 300 nodes we drop the compound parents:
 * they double the node count and dramatically increase layout cost without
 * adding value at that scale (use the `systems` view instead).
 */
import type { GraphData, GraphNode } from '../../../types';

export interface BuildElementsOptions {
  data: GraphData;
  /** Skip compound parent nodes — recommended for graphs with > 300 file nodes. */
  flat?: boolean;
}

const COMPOUND_NODE_THRESHOLD = 300;

export function buildElements({ data, flat }: BuildElementsOptions): unknown[] {
  const useCompound = !flat && data.nodes.length <= COMPOUND_NODE_THRESHOLD;
  const usedSystems = new Set(data.nodes.map((n) => n.systemId));

  const systemParents = useCompound
    ? data.systems
        .filter((s) => usedSystems.has(s.id))
        .map((s) => ({
          data: {
            id: `__system__${s.id}`,
            label: s.name.toUpperCase(),
            systemColor: s.color,
            isSystem: true,
          },
          classes: 'system-group',
        }))
    : [];

  const fileNodes = data.nodes.map((n) => ({
    data: {
      id: n.id,
      label: n.label,
      path: n.path,
      ...(useCompound ? { parent: `__system__${n.systemId}` } : {}),
      systemId: n.systemId,
      systemColor: n.systemColor,
      language: n.language,
      isEntryPoint: n.isEntryPoint,
      isDeadCode: n.isDeadCode,
      dependentCount: n.dependentCount,
      dependencyCount: n.dependencyCount,
      importCount: n.importCount,
      exportCount: n.exportCount,
      relativePath: n.relativePath,
      weight: nodeWeight(n, data.nodes.length),
    },
    classes: nodeClasses(n),
  }));

  const edges = data.edges.map((e) => ({
    data: { id: e.id, source: e.source, target: e.target, type: e.type, weight: e.weight },
    classes: e.type === 'dynamic-import' ? 'dynamic' : '',
  }));

  return [...systemParents, ...fileNodes, ...edges];
}

/**
 * Filter graph data to a single system. Edges are kept only when both
 * endpoints survive the filter.
 */
export function filterBySystem(data: GraphData, systemId: string | null): GraphData {
  if (!systemId) return data;
  const system = data.systems.find((s) => s.id === systemId);
  if (!system) return data;

  const fileSet = new Set(system.files);
  const nodes = data.nodes.filter((n) => fileSet.has(n.id));
  const nodeIds = new Set(nodes.map((n) => n.id));
  const edges = data.edges.filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target));
  return { ...data, nodes, edges };
}

function nodeWeight(n: GraphNode, totalCount: number): number {
  // Smaller nodes for big graphs so the canvas isn't overwhelmed.
  if (totalCount > 300) {
    return Math.max(10, Math.min(28, 10 + Math.sqrt(n.dependentCount) * 4));
  }
  return Math.max(28, Math.min(54, 28 + Math.sqrt(n.dependentCount) * 6));
}

function nodeClasses(n: GraphNode): string {
  const classes: string[] = [];
  if (n.isEntryPoint) classes.push('entry');
  if (n.isDeadCode) classes.push('dead');
  return classes.join(' ');
}
