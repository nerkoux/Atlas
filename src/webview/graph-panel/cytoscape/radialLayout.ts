/**
 * Atlas Radial layout — a custom concentric arrangement for the system view.
 *
 * Cytoscape's built-in `concentric` layout doesn't handle small graphs well:
 * with one node per ring it stacks them all at the start angle (straight up),
 * collapsing into a vertical line. This implementation bins systems into a
 * small number of clean rings and distributes them evenly around each one.
 *
 * Algorithm:
 *   1. Compute a "centrality" score for each system from a normalized
 *      combination of edge degree and file count. This survives the case
 *      where one system has hundreds of files but few cross-system edges.
 *   2. Pick a single hub (the highest-centrality system) when the graph
 *      has 4+ nodes — it goes in the centre.
 *   3. Bucket the remaining systems into at most 3 rings using the score
 *      distribution, with a guarantee that no ring has fewer than 2 nodes
 *      (single-node rings look awkward in radial layouts).
 *   4. Within each ring, sort by size and interleave large/small to balance
 *      the visual weight around the circle.
 *   5. Compute ring radii from the largest bubble in each ring plus a gap.
 *      The minimum radius is also bounded by the circumference required
 *      to fit every ring member without overlap.
 *   6. Stagger ring start angles so concentric rings never line up on the
 *      same radial axis.
 */

interface RadialNode {
  id: string;
  weight: number;
  fileCount: number;
  degree: number;
  cyNode: any;
}

interface RadialOptions {
  padding?: number;
  bubbleGap?: number;
  animationDuration?: number;
  /** Maximum number of concentric rings (excluding the centre bubble). */
  maxRings?: number;
}

const DEFAULTS: Required<RadialOptions> = {
  padding: 60,
  bubbleGap: 80,
  animationDuration: 600,
  maxRings: 3,
};

interface FinalPosition {
  id: string;
  x: number;
  y: number;
}

export function runAtlasRadialLayout(cy: any, options: RadialOptions = {}): Promise<void> {
  const opts = { ...DEFAULTS, ...options };
  const nodes = collectNodes(cy);
  if (nodes.length === 0) return Promise.resolve();

  const positions = computePositions(nodes, opts);
  return animateTo(cy, positions, opts.animationDuration, opts.padding);
}

// ─── Step 1 — Collect nodes ──────────────────────────────────────────────────

function collectNodes(cy: any): RadialNode[] {
  const result: RadialNode[] = [];
  cy.nodes().forEach((n: any) => {
    result.push({
      id: n.data('id'),
      weight: Number(n.data('weight')) || 60,
      fileCount: Number(n.data('fileCount')) || 0,
      degree: typeof n.degree === 'function' ? n.degree(false) : 0,
      cyNode: n,
    });
  });
  return result;
}

// ─── Step 2 — Compute positions ──────────────────────────────────────────────

function computePositions(nodes: RadialNode[], opts: Required<RadialOptions>): FinalPosition[] {
  if (nodes.length === 1) return [{ id: nodes[0].id, x: 0, y: 0 }];
  if (nodes.length === 2) {
    // Two nodes: side-by-side, deterministic.
    const distance = (nodes[0].weight + nodes[1].weight) / 2 + opts.bubbleGap;
    const sorted = [...nodes].sort((a, b) => b.weight - a.weight);
    return [
      { id: sorted[0].id, x: -distance / 2, y: 0 },
      { id: sorted[1].id, x: distance / 2, y: 0 },
    ];
  }

  // Centrality score: degree dominates (×100) so an actual hub goes to the
  // centre even if a leaf system has more files. The sqrt(fileCount) tail
  // breaks ties between nodes of equal degree.
  const scored = nodes.map((n) => ({
    node: n,
    score: n.degree * 100 + Math.sqrt(n.fileCount),
  }));
  scored.sort((a, b) => b.score - a.score);

  const useCentre = nodes.length >= 4;
  const positions: FinalPosition[] = [];

  if (useCentre) {
    const hub = scored[0];
    positions.push({ id: hub.node.id, x: 0, y: 0 });
  }

  const orbiters = useCentre ? scored.slice(1) : scored;
  const ringBuckets = bucketIntoRings(orbiters, opts.maxRings);

  const innerRadius = useCentre ? scored[0].node.weight / 2 + opts.bubbleGap : 0;
  let prevRadius = innerRadius;

  ringBuckets.forEach((ring, ringIndex) => {
    if (ring.length === 0) return;

    const maxNode = Math.max(...ring.map((s) => s.node.weight));

    let radius = prevRadius + maxNode / 2 + opts.bubbleGap;

    // Circumference constraint — each ring member needs at least its diameter
    // plus a fraction of the gap as arc length.
    const totalArc = ring.reduce((sum, s) => sum + s.node.weight + opts.bubbleGap * 0.7, 0);
    const minRadius = totalArc / (2 * Math.PI);
    if (minRadius > radius) radius = minRadius;

    placeOnRing(ring, radius, positions, ringIndex);
    prevRadius = radius + maxNode / 2;
  });

  return positions;
}

/**
 * Split `scored` (sorted highest first) into `maxRings` rings.
 *
 * We don't bucket by score directly because that produces uneven rings when
 * scores are clustered. Instead we slice the sorted list into roughly equal
 * chunks, then rebalance so no ring ends up with one item.
 */
function bucketIntoRings<T>(items: T[], maxRings: number): T[][] {
  if (items.length === 0) return [];
  if (items.length <= 4) return [items];

  const targetRings = Math.min(maxRings, Math.ceil(items.length / 4));
  const baseSize = Math.ceil(items.length / targetRings);

  const rings: T[][] = [];
  for (let i = 0; i < items.length; i += baseSize) {
    rings.push(items.slice(i, i + baseSize));
  }

  // Rebalance: move stragglers up so no ring has fewer than 2 items.
  for (let i = rings.length - 1; i > 0; i--) {
    if (rings[i].length < 2) {
      rings[i - 1].push(...rings[i]);
      rings.splice(i, 1);
    }
  }

  return rings;
}

/**
 * Distribute ring members evenly around a circle of the given radius.
 *
 * - Even rings start at the top (-π/2).
 * - Odd rings rotate by half a slice so concentric rings don't line up.
 * - Members are interleaved large→small→large so visual weight is balanced.
 */
function placeOnRing(
  ring: { node: RadialNode; score: number }[],
  radius: number,
  positions: FinalPosition[],
  ringIndex: number
): void {
  const sortedDesc = [...ring].sort((a, b) => b.node.weight - a.node.weight);
  const interleaved = interleaveLargeSmall(sortedDesc);

  const slice = (Math.PI * 2) / interleaved.length;
  const startAngle = -Math.PI / 2 + (ringIndex % 2 === 1 ? slice / 2 : 0);

  interleaved.forEach((item, i) => {
    const angle = startAngle + i * slice;
    positions.push({
      id: item.node.id,
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
    });
  });
}

function interleaveLargeSmall<T>(sortedDesc: T[]): T[] {
  // Take from both ends of the sorted list so big and small alternate.
  const result: T[] = [];
  let left = 0;
  let right = sortedDesc.length - 1;
  let pickLeft = true;
  while (left <= right) {
    if (pickLeft) result.push(sortedDesc[left++]);
    else result.push(sortedDesc[right--]);
    pickLeft = !pickLeft;
  }
  return result;
}

// ─── Step 3 — Animate ────────────────────────────────────────────────────────

function animateTo(
  cy: any,
  positions: FinalPosition[],
  duration: number,
  padding: number
): Promise<void> {
  return new Promise((resolve) => {
    if (positions.length === 0) {
      resolve();
      return;
    }

    if (duration === 0) {
      cy.startBatch();
      for (const p of positions) {
        const node = cy.$id(p.id);
        if (node.length) node.position({ x: p.x, y: p.y });
      }
      cy.endBatch();
      cy.fit(undefined, padding);
      resolve();
      return;
    }

    let pending = positions.length;
    const done = () => {
      if (--pending === 0) {
        cy.animate({ fit: { padding } }, { duration: 300, complete: () => resolve() });
      }
    };

    cy.startBatch();
    for (const p of positions) {
      const node = cy.$id(p.id);
      if (!node.length) {
        done();
        continue;
      }
      node.animate(
        { position: { x: p.x, y: p.y } },
        { duration, easing: 'ease-out-cubic', complete: done }
      );
    }
    cy.endBatch();
  });
}
