/**
 * Builds a system-level Cytoscape model.
 *
 * In `systems` view, each architectural system collapses to a single bubble
 * sized by file count. Edges aggregate all file-to-file imports between two
 * systems into one weighted edge. This makes huge repositories navigable —
 * 200 files × 341 edges becomes maybe 10 nodes and 20 edges.
 */
import type { GraphData } from '../../../types';

export function buildSystemElements(data: GraphData): unknown[] {
  // Map every file id to its system id for O(1) edge resolution.
  const fileToSystem = new Map<string, string>();
  for (const sys of data.systems) {
    for (const fileId of sys.files) fileToSystem.set(fileId, sys.id);
  }
  // Fall back via the node's own systemId if the file isn't in any system.files list.
  for (const node of data.nodes) {
    if (!fileToSystem.has(node.id)) fileToSystem.set(node.id, node.systemId);
  }

  // System nodes — sized by sqrt(fileCount) to keep huge systems manageable.
  const systemsWithFiles = data.systems.filter((s) => s.files.length > 0);
  const maxFiles = Math.max(1, ...systemsWithFiles.map((s) => s.files.length));

  const systemNodes = systemsWithFiles.map((s) => {
    const ratio = Math.sqrt(s.files.length / maxFiles);
    const size = Math.round(40 + ratio * 60); // 40–100 px
    return {
      data: {
        id: s.id,
        label: s.name,
        systemColor: s.color,
        fileCount: s.files.length,
        weight: size,
        isSystemNode: true,
      },
    };
  });

  // Aggregate edges between systems.
  const edgeWeights = new Map<string, number>();
  for (const e of data.edges) {
    const from = fileToSystem.get(e.source);
    const to = fileToSystem.get(e.target);
    if (!from || !to || from === to) continue;
    const key = `${from}→${to}`;
    edgeWeights.set(key, (edgeWeights.get(key) ?? 0) + 1);
  }

  const maxWeight = Math.max(1, ...edgeWeights.values());

  const systemEdges = [...edgeWeights.entries()].map(([key, weight], i) => {
    const [source, target] = key.split('→');
    return {
      data: {
        id: `sys-edge-${i}`,
        source,
        target,
        weight,
        thickness: 1 + Math.min(8, Math.round((weight / maxWeight) * 8)),
      },
    };
  });

  return [...systemNodes, ...systemEdges];
}
