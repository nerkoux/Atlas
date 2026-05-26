/**
 * Atlas Radial layout — a custom concentric arrangement for the system view.
 *
 * Cytoscape's built-in `concentric` layout doesn't handle small graphs well:
 * with one node per ring it stacks them all at the start angle (straight up),
 * collapsing into a vertical line. This implementation bins systems into a
 * small number of clean rings and distributes them evenly around each one.
 *
 * Algorithm:
 *   1. Compute a "tier" for each system from its connectedness (edge degree)
 *      and file count. Hubs get tier 0 (innermost), leaves get higher tiers.
 *   2. Bucket tiers into at most 3 rings so each ring has multiple nodes.
 *   3. Distribute each ring's members evenly around the circle, sorted by
 *      size so visually-similar bubbles end up together.
 *   4. Ring radii are computed from the largest bubble in each ring plus
 *      a configurable gap, so big bubbles never overlap their neighbours.
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
  /** Maximum number of concentric rings. */
  maxRings?: number;
}

const DEFAULTS: Required<RadialOptions> = {
  padding: 60,
  bubbleGap: 70,
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

// ─── Step 2 — Tiering and ring placement ─────────────────────────────────────

function computePositions(nodes: RadialNode[], opts: Required<RadialOptions>): FinalPosition[] {
  // Single node: just centre it.
  if (nodes.length === 1) {
    return [{ id: nodes[0].id, x: 0, y: 0 }];
  }

  // Score = how "central" a system is. High-degree systems sit closer to
  // the centre; small disconnected systems orbit on the outer rings.
  const scored = nodes.map((n) => ({
    node: n,
    score: n.degree * 100 + Math.sqrt(n.fileCount),
  }));

  // Sort high-score → low-score (highest-degree first).
  scored.sort((a, b) => b.score - a.score);

  // The single highest-scoring system always sits at the centre (tier 0)
  // when there are 4+ nodes. With fewer nodes we skip the centre and put
  // everything on rings to avoid a lonely middle bubble.
  const useCentre = nodes.length >= 4;

  const positions: FinalPosition[] = [];
  let ringStart = 0;

  if (useCentre) {
    const hub = scored[0];
    positions.push({ id: hub.node.id, x: 0, y: 0 });
    ringStart = 1;
  }

  // Distribute the remaining nodes across at most `maxRings` concentric rings.
  const remaining = scored.slice(ringStart);
  const ringBuckets = bucketIntoRings(remaining, opts.maxRings);

  // The first ring sits outside the centre bubble (or starts from origin).
  const innerRadius = useCentre ? scored[0].node.weight / 2 + opts.bubbleGap : 0;
  let prevRadius = innerRadius;

  ringBuckets.forEach((ring, ringIndex) => {
    if (ring.length === 0) return;

    const maxNode = Math.max(...ring.map((s) => s.node.weight));

    // Required radius — combination of:
    //   - previous ring + biggest node in this ring + gap
    //   - circumference must fit all ring members without overlap
    let radius = prevRadius + maxNode / 2 + opts.bubbleGap;

    const totalArc = ring.reduce((sum, s) => sum + s.node.weight + opts.bubbleGap * 0.7, 0);
    const minRadius = totalArc / (2 * Math.PI);
    if (minRadius > radius) radius = minRadius;

    placeOnRing(ring, radius, positions, ringIndex);
    prevRadius = radius + maxNode / 2;
  });

  return positions;
}

/**
 * Split `scored` (already sorted by score, highest first) into `maxRings`
 * groups. Earlier groups are inner rings.
 *
 * We don't bin by score directly because that produces uneven rings when
 * scores are clustered (e.g. five systems with degree 2 and two with degree 0
 * would give a tiny inner ring and a massive outer one). Instead we slice
 * the sorted list into roughly equal chunks, with the constraint that the
 * outermost ring should always have at least 3 nodes for a clean radial fan.
 */
function bucketIntoRings<T>(items: T[], maxRings: number): T[][] {
  if (items.length === 0) return [];
  if (items.length <= 3) return [items];

  const targetRings = Math.min(maxRings, Math.ceil(items.length / 3));
  const baseSize = Math.ceil(items.length / targetRings);

  const rings: T[][] = [];
  for (let i = 0; i < items.length; i += baseSize) {
    rings.push(items.slice(i, i + baseSize));
  }

  // If the last ring has only one element, merge it into the previous ring
  // — a single-node ring looks awkward in a radial layout.
  if (rings.length > 1 && rings[rings.length - 1].length === 1) {
    const last = rings.pop()!;
    rings[rings.length - 1].push(...last);
  }

  return rings;
}

/**
 * Distribute ring members evenly around a circle of the given radius.
 *
 * - Even rings start at the top (-π/2) so the first item is always at 12 o'clock.
 * - Odd rings are offset by half an angular slice so concentric rings don't
 *   line up on the same radial axis.
 * - Within a ring, larger bubbles are interleaved with smaller ones to avoid
 *   clumping the heaviest items together.
 */
function placeOnRing(
  ring: { node: RadialNode; score: number }[],
  radius: number,
  positions: FinalPosition[],
  ringIndex: number
): void {
  // Sort by size desc, then interleave so big and small alternate around the ring.
  const sorted = [...ring].sort((a, b) => b.node.weight - a.node.weight);
  const interleaved = interleaveLargeSmall(sorted);

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
  // Take from both ends of the sorted list to alternate sizes.
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
