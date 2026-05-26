/**
 * Layout configurations for the Atlas graph.
 *
 * Three layouts are exposed: Force (cose), Hierarchy (dagre), Radial (concentric).
 * Layout cost scales aggressively with node count, so we tune iteration counts
 * and repulsion based on graph size to keep big repos responsive.
 *
 * In **system view**, Force mode uses {@link runAtlasForceLayout} — a custom,
 * deterministic layout that produces a clean designed-looking arrangement
 * regardless of how the system graph happens to be connected. Hierarchy and
 * Radial keep their built-in Cytoscape layouts.
 *
 * In **file view**, Force mode uses Cytoscape's `cose` algorithm with size-
 * adaptive tuning (lower iteration counts for big repos to stay responsive).
 */

import { runAtlasForceLayout } from './forceLayout';

declare const cytoscape: any;

export type LayoutName = 'cose' | 'dagre' | 'concentric';

const COMMON = {
  animate: true,
  animationDuration: 500,
  animationEasing: 'ease-out-cubic',
} as const;

export function isLayoutAvailable(name: string): boolean {
  try {
    return typeof cytoscape !== 'undefined' && Boolean(cytoscape('layout', name));
  } catch {
    return false;
  }
}

/**
 * Run the requested layout against a Cytoscape instance.
 *
 * Detects system-view automatically by checking the `isSystemNode` flag on
 * the first node (set by `buildSystemElements()`). System view routes Force
 * mode to the custom Atlas layout; Hierarchy and Radial use the standard
 * Cytoscape layouts in both views.
 */
export function runLayout(cy: any, name: LayoutName, nodeCount: number): void {
  let actual: string = name;
  if (name === 'dagre' && !isLayoutAvailable('dagre')) actual = 'breadthfirst';

  const isSystemView =
    cy.nodes().length > 0 && cy.nodes()[0].data('isSystemNode') === true;

  // Force mode in system view → custom Atlas layout.
  if (actual === 'cose' && isSystemView) {
    runAtlasForceLayout(cy, { animationDuration: 600, padding: 60, bubbleGap: 80 });
    return;
  }

  cy.layout(getLayoutConfig(actual, nodeCount, isSystemView)).run();
}

export function getLayoutConfig(
  name: string,
  nodeCount: number,
  isSystemView = false
): object {
  switch (name) {
    case 'dagre':
      return dagreConfig(nodeCount, isSystemView);

    case 'breadthfirst':
      return {
        ...COMMON,
        animate: nodeCount <= 200,
        name: 'breadthfirst',
        directed: true,
        spacingFactor: isSystemView ? 1.6 : nodeCount > 200 ? 0.9 : 1.4,
        padding: 50,
        fit: true,
        grid: false,
        circle: false,
      };

    case 'concentric':
      return concentricConfig(nodeCount, isSystemView);

    default: // cose — only used for file view, system view is short-circuited
      return coseConfigForFiles(nodeCount);
  }
}

// ─── Hierarchy (dagre) ────────────────────────────────────────────────────────

function dagreConfig(nodeCount: number, isSystemView: boolean): object {
  if (isSystemView) {
    return {
      ...COMMON,
      animate: true,
      name: 'dagre',
      rankDir: 'TB',
      nodeSep: 90,
      rankSep: 130,
      edgeSep: 30,
      padding: 80,
      fit: true,
      spacingFactor: 1.2,
    };
  }
  return {
    ...COMMON,
    animate: nodeCount <= 200,
    name: 'dagre',
    rankDir: 'TB',
    nodeSep: nodeCount > 200 ? 20 : 60,
    rankSep: nodeCount > 200 ? 50 : 100,
    edgeSep: 16,
    padding: 50,
    fit: true,
  };
}

// ─── Radial (concentric) ──────────────────────────────────────────────────────

function concentricConfig(nodeCount: number, isSystemView: boolean): object {
  if (isSystemView) {
    // Tier systems by their connectedness (how many other systems they
    // talk to). Hubs go in the centre, leaves on outer rings. Using the
    // edge degree gives a wide spread of values and a real radial fan
    // instead of collapsing into a single ring.
    return {
      ...COMMON,
      animate: true,
      name: 'concentric',
      padding: 80,
      fit: true,
      concentric: (n: any) => {
        const degree = (n.degree && typeof n.degree === 'function') ? n.degree(false) : 0;
        const fileCount = n.data('fileCount') ?? 0;
        // Mix degree (primary) with sqrt(fileCount) so similarly-connected
        // systems still get split by size — avoids ties that would line
        // them up on the same ring axis.
        return degree * 100 + Math.sqrt(fileCount);
      },
      levelWidth: () => 1,
      minNodeSpacing: 90,
      avoidOverlap: true,
      // `spacingFactor` pads the rings horizontally so even small graphs
      // get a recognisable circular shape instead of collapsing inward.
      spacingFactor: 1.5,
      // Sweep across nearly the full circle so leaves on the outer ring
      // don't all clump at the top of the canvas.
      startAngle: (3 / 2) * Math.PI,
      sweep: undefined,
      clockwise: true,
    };
  }
  return {
    ...COMMON,
    animate: nodeCount <= 200,
    name: 'concentric',
    padding: 50,
    fit: true,
    concentric: (n: any) => (n.data('dependentCount') ?? 0) + 1,
    levelWidth: () => 4,
    minNodeSpacing: nodeCount > 200 ? 12 : 50,
  };
}

// ─── Force (cose) — file view only ────────────────────────────────────────────

function coseConfigForFiles(nodeCount: number): object {
  // Scale iterations down hard for large graphs — cose is O(n²) per iteration.
  if (nodeCount > 500) {
    return {
      ...COMMON,
      animate: false,
      name: 'cose',
      nodeRepulsion: () => 6000,
      idealEdgeLength: () => 50,
      edgeElasticity: () => 0.3,
      nestingFactor: 1,
      gravity: 0.5,
      numIter: 400,
      initialTemp: 600,
      coolingFactor: 0.96,
      minTemp: 2.0,
      padding: 30,
      fit: true,
      componentSpacing: 40,
    };
  }
  if (nodeCount > 200) {
    return {
      ...COMMON,
      animate: false,
      name: 'cose',
      nodeRepulsion: () => 9000,
      idealEdgeLength: () => 70,
      edgeElasticity: () => 0.35,
      nestingFactor: 1.2,
      gravity: 0.4,
      numIter: 800,
      initialTemp: 800,
      coolingFactor: 0.97,
      minTemp: 1.5,
      padding: 40,
      fit: true,
      componentSpacing: 60,
    };
  }
  return {
    ...COMMON,
    name: 'cose',
    nodeRepulsion: () => 14000,
    idealEdgeLength: () => 100,
    edgeElasticity: () => 0.4,
    nestingFactor: 1.5,
    gravity: 0.35,
    numIter: 1500,
    initialTemp: 1000,
    coolingFactor: 0.98,
    minTemp: 1.0,
    padding: 50,
    fit: true,
    componentSpacing: 80,
  };
}
