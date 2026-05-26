/**
 * Atlas Hierarchy layout — a custom layered DAG arrangement for system view.
 *
 * Why a custom layout?
 *
 * Dagre produces correct hierarchical layouts but with two awkward defaults
 * for our use case:
 *   1. It pushes orphan (no-edge) nodes off to the side of the canvas, which
 *      looks like a bug when the system view has 2-3 disconnected systems.
 *   2. It assigns ranks by longest-path with no awareness of node size, so
 *      large bubbles can be placed too close to small ones above/below them.
 *   3. Cycle handling reverses arrows silently which confuses architectural
 *      reading.
 *
 * This layout uses a tailored Sugiyama-style pipeline:
 *   1. Break cycles by demoting back-edges to an "implicit" set (kept in the
 *      data, but ignored for ranking).
 *   2. Assign each node a rank using longest-path layering.
 *   3. Promote source-only nodes (no incoming edges) to rank 0 so the
 *      hierarchy reads top-down: dependents at the top, dependencies at the
 *      bottom.
 *   4. Within each rank, reorder nodes using one pass of the barycentric
 *      heuristic to minimise edge crossings.
 *   5. Compute x-positions per rank with size-aware spacing.
 *   6. Compute y-positions with rank gaps proportional to the maximum bubble
 *      diameter in adjacent ranks.
 *
 * The result is deterministic, has clean rank lines, no overlapping bubbles,
 * and looks like a hand-drawn architecture diagram.
 */

interface HierarchyNode {
  id: string;
  weight: number;
  fileCount: number;
  cyNode: any;
}

interface HierarchyEdge {
  source: string;
  target: string;
}

interface HierarchyOptions {
  /** Outer canvas padding after fit. */
  padding?: number;
  /** Min horizontal gap between any two bubbles in the same rank. */
  nodeGap?: number;
  /** Min vertical gap between adjacent ranks. */
  rankGap?: number;
  /** Animation duration. 0 = no animation. */
  animationDuration?: number;
}

const DEFAULTS: Required<HierarchyOptions> = {
  padding: 60,
  nodeGap: 60,
  rankGap: 110,
  animationDuration: 600,
};

interface FinalPosition {
  id: string;
  x: number;
  y: number;
}

export function runAtlasHierarchyLayout(
  cy: any,
  options: HierarchyOptions = {}
): Promise<void> {
  const opts = { ...DEFAULTS, ...options };
  const nodes = collectNodes(cy);
  if (nodes.length === 0) return Promise.resolve();

  const edges = collectEdges(cy, nodes);
  const positions = computePositions(nodes, edges, opts);
  return animateTo(cy, positions, opts.animationDuration, opts.padding);
}

// ─── Step 1 — Collect input ───────────────────────────────────────────────────

function collectNodes(cy: any): HierarchyNode[] {
  const result: HierarchyNode[] = [];
  cy.nodes().forEach((n: any) => {
    result.push({
      id: n.data('id'),
      weight: Number(n.data('weight')) || 60,
      fileCount: Number(n.data('fileCount')) || 0,
      cyNode: n,
    });
  });
  return result;
}

function collectEdges(cy: any, nodes: HierarchyNode[]): HierarchyEdge[] {
  const ids = new Set(nodes.map((n) => n.id));
  const result: HierarchyEdge[] = [];
  cy.edges().forEach((e: any) => {
    const s = e.data('source');
    const t = e.data('target');
    if (!ids.has(s) || !ids.has(t) || s === t) return;
    result.push({ source: s, target: t });
  });
  return result;
}

// ─── Step 2 — Cycle removal ──────────────────────────────────────────────────

/**
 * Greedy feedback-arc-set removal: walk nodes in DFS order and drop any edge
 * that would re-enter a node already on the active stack. The dropped edges
 * (`backEdges`) are excluded from rank assignment but kept in the cytoscape
 * graph so the user still sees the relationship.
 */
function breakCycles(
  nodes: HierarchyNode[],
  edges: HierarchyEdge[]
): { forwardEdges: HierarchyEdge[]; backEdges: HierarchyEdge[] } {
  const adj = new Map<string, string[]>();
  for (const n of nodes) adj.set(n.id, []);
  for (const e of edges) adj.get(e.source)!.push(e.target);

  const visited = new Set<string>();
  const stack = new Set<string>();
  const backSet = new Set<string>();

  const dfs = (id: string): void => {
    visited.add(id);
    stack.add(id);
    for (const next of adj.get(id) ?? []) {
      const key = `${id}→${next}`;
      if (stack.has(next)) {
        backSet.add(key);
      } else if (!visited.has(next)) {
        dfs(next);
      }
    }
    stack.delete(id);
  };

  for (const n of nodes) if (!visited.has(n.id)) dfs(n.id);

  const forward: HierarchyEdge[] = [];
  const back: HierarchyEdge[] = [];
  for (const e of edges) {
    if (backSet.has(`${e.source}→${e.target}`)) back.push(e);
    else forward.push(e);
  }
  return { forwardEdges: forward, backEdges: back };
}

// ─── Step 3 — Rank assignment (longest-path layering) ────────────────────────

function assignRanks(
  nodes: HierarchyNode[],
  forwardEdges: HierarchyEdge[]
): Map<string, number> {
  // Build forward adjacency and indegrees.
  const inEdges = new Map<string, string[]>();
  const outEdges = new Map<string, string[]>();
  for (const n of nodes) {
    inEdges.set(n.id, []);
    outEdges.set(n.id, []);
  }
  for (const e of forwardEdges) {
    outEdges.get(e.source)!.push(e.target);
    inEdges.get(e.target)!.push(e.source);
  }

  // Topological sort — Kahn's algorithm.
  const ranks = new Map<string, number>();
  const inDeg = new Map<string, number>();
  for (const n of nodes) inDeg.set(n.id, inEdges.get(n.id)!.length);

  const queue: string[] = [];
  for (const n of nodes) {
    if (inDeg.get(n.id) === 0) {
      ranks.set(n.id, 0);
      queue.push(n.id);
    }
  }

  while (queue.length) {
    const id = queue.shift()!;
    const myRank = ranks.get(id)!;
    for (const next of outEdges.get(id) ?? []) {
      const candidate = myRank + 1;
      const existing = ranks.get(next);
      if (existing === undefined || candidate > existing) ranks.set(next, candidate);
      inDeg.set(next, inDeg.get(next)! - 1);
      if (inDeg.get(next) === 0) queue.push(next);
    }
  }

  // Any node without a rank (unreachable from roots) goes to rank 0.
  for (const n of nodes) if (!ranks.has(n.id)) ranks.set(n.id, 0);

  return ranks;
}

// ─── Step 4 — Within-rank ordering (one pass of barycentric heuristic) ───────

/**
 * Reorder nodes within each rank to minimise edge crossings.
 *
 * A single barycentric pass is enough for graphs of ≤ ~30 nodes per rank,
 * which is far above what the system view ever produces.
 */
function orderRanks(
  rankNodes: Map<number, string[]>,
  forwardEdges: HierarchyEdge[]
): Map<number, string[]> {
  const sortedRanks = [...rankNodes.keys()].sort((a, b) => a - b);
  const inNeighbours = new Map<string, string[]>();
  for (const e of forwardEdges) {
    if (!inNeighbours.has(e.target)) inNeighbours.set(e.target, []);
    inNeighbours.get(e.target)!.push(e.source);
  }

  for (let i = 1; i < sortedRanks.length; i++) {
    const rank = sortedRanks[i];
    const prev = rankNodes.get(sortedRanks[i - 1])!;
    const indexInPrev = new Map(prev.map((id, idx) => [id, idx]));

    const items = rankNodes.get(rank)!;
    const withBary = items.map((id) => {
      const ins = inNeighbours.get(id) ?? [];
      const indices = ins
        .map((src) => indexInPrev.get(src))
        .filter((v): v is number => v !== undefined);
      const bary =
        indices.length > 0
          ? indices.reduce((a, b) => a + b, 0) / indices.length
          : indexInPrev.size / 2;
      return { id, bary };
    });
    withBary.sort((a, b) => a.bary - b.bary);
    rankNodes.set(rank, withBary.map((x) => x.id));
  }

  return rankNodes;
}

// ─── Step 5 — Coordinate assignment ──────────────────────────────────────────

function computePositions(
  nodes: HierarchyNode[],
  edges: HierarchyEdge[],
  opts: Required<HierarchyOptions>
): FinalPosition[] {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  const { forwardEdges } = breakCycles(nodes, edges);
  const ranks = assignRanks(nodes, forwardEdges);

  // Group node ids by rank.
  const rankNodes = new Map<number, string[]>();
  for (const [id, rank] of ranks) {
    if (!rankNodes.has(rank)) rankNodes.set(rank, []);
    rankNodes.get(rank)!.push(id);
  }

  // Reorder within each rank to minimise edge crossings.
  orderRanks(rankNodes, forwardEdges);

  const sortedRanks = [...rankNodes.keys()].sort((a, b) => a - b);

  // ── Y coordinates: each rank's centre line.
  // Vertical gap between two ranks is (max bubble in upper rank + max in
  // lower rank) / 2 + opts.rankGap. This guarantees no top-edge of a lower
  // bubble can clip into the bottom-edge of an upper bubble.
  const rankY = new Map<number, number>();
  let cursorY = 0;
  let prevMaxRadius = 0;
  for (const rank of sortedRanks) {
    const ids = rankNodes.get(rank)!;
    const maxRadius = Math.max(...ids.map((id) => (nodeMap.get(id)?.weight ?? 60) / 2));
    if (rank === sortedRanks[0]) {
      cursorY = maxRadius;
    } else {
      cursorY += prevMaxRadius + opts.rankGap + maxRadius;
    }
    rankY.set(rank, cursorY);
    prevMaxRadius = maxRadius;
  }

  // ── X coordinates per rank: lay each rank's bubbles out on a centred row.
  // Each bubble takes (its own diameter + nodeGap), so big bubbles get more
  // horizontal space than small ones.
  const positions: FinalPosition[] = [];
  for (const rank of sortedRanks) {
    const ids = rankNodes.get(rank)!;
    const widths = ids.map((id) => (nodeMap.get(id)?.weight ?? 60) + opts.nodeGap);
    const totalWidth = widths.reduce((a, b) => a + b, 0) - opts.nodeGap;
    let cursorX = -totalWidth / 2;
    const y = rankY.get(rank)!;

    ids.forEach((id, i) => {
      const node = nodeMap.get(id)!;
      const x = cursorX + node.weight / 2;
      positions.push({ id, x, y });
      cursorX += widths[i];
    });
  }

  return positions;
}

// ─── Step 6 — Animate ────────────────────────────────────────────────────────

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
