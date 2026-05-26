/**
 * Atlas Force layout — a custom, deterministic system-bubble arrangement.
 *
 * Why a custom layout?
 *
 * Cytoscape's built-in force layouts (cose, cose-bilkent) are designed for
 * graphs with many similar-sized nodes and lots of edges. The Atlas system
 * view is the opposite: a handful of large bubbles of varying sizes, often
 * with several disconnected components (e.g. "API Layer" and "Validators"
 * that don't import each other). Generic force layouts produce overlap and
 * leave clusters floating in awkward places.
 *
 * This layout instead treats each connected component independently:
 *   1. Find connected components.
 *   2. The largest component gets a "hub-and-spoke" treatment: the biggest
 *      bubble sits in the centre and its neighbours orbit around it on a
 *      circle whose radius is sized to prevent overlap.
 *   3. Smaller components are placed in a clean grid below the main one.
 *
 * The result is a layout that looks designed rather than simulated, with no
 * overlapping bubbles, predictable spacing, and a clear visual hierarchy.
 */

interface NodeRecord {
  id: string;
  weight: number; // node diameter in px
  cyNode: any;
  fileCount: number;
}

interface EdgeRecord {
  source: string;
  target: string;
  weight: number;
}

interface AtlasForceOptions {
  /** Padding around the entire layout. */
  padding?: number;
  /** Extra empty space between any two bubbles. */
  bubbleGap?: number;
  /** Animation duration in ms. 0 = no animation. */
  animationDuration?: number;
}

const DEFAULTS: Required<AtlasForceOptions> = {
  padding: 60,
  bubbleGap: 60,
  animationDuration: 600,
};

/**
 * Run the Atlas force layout against a Cytoscape instance.
 *
 * Returns a Promise that resolves once the animation completes.
 */
export function runAtlasForceLayout(cy: any, options: AtlasForceOptions = {}): Promise<void> {
  const opts = { ...DEFAULTS, ...options };

  const nodes = collectNodes(cy);
  const edges = collectEdges(cy, nodes);

  if (nodes.length === 0) return Promise.resolve();
  if (nodes.length === 1) {
    return animateTo(cy, [{ id: nodes[0].id, x: 0, y: 0 }], opts.animationDuration, opts.padding);
  }

  // Find connected components.
  const adjacency = buildAdjacency(nodes, edges);
  const components = findComponents(nodes, adjacency);

  // Sort components by total node weight (biggest first).
  components.sort((a, b) => totalWeight(b) - totalWeight(a));

  // Position each component in its own bounding box.
  const componentLayouts = components.map((comp, i) =>
    layoutComponent(comp, adjacency, opts, i === 0)
  );

  // Arrange the component bounding boxes themselves on the canvas.
  const finalPositions = arrangeComponents(componentLayouts, opts);

  return animateTo(cy, finalPositions, opts.animationDuration, opts.padding);
}

// ─── Step 1 — Collect input ───────────────────────────────────────────────────

function collectNodes(cy: any): NodeRecord[] {
  const result: NodeRecord[] = [];
  cy.nodes().forEach((n: any) => {
    const weight = Number(n.data('weight')) || 60;
    result.push({
      id: n.data('id'),
      weight,
      fileCount: Number(n.data('fileCount')) || 0,
      cyNode: n,
    });
  });
  return result;
}

function collectEdges(cy: any, nodes: NodeRecord[]): EdgeRecord[] {
  const idSet = new Set(nodes.map((n) => n.id));
  const result: EdgeRecord[] = [];
  cy.edges().forEach((e: any) => {
    const s = e.data('source');
    const t = e.data('target');
    if (!idSet.has(s) || !idSet.has(t) || s === t) return;
    result.push({ source: s, target: t, weight: Number(e.data('weight')) || 1 });
  });
  return result;
}

// ─── Step 2 — Connected components ────────────────────────────────────────────

function buildAdjacency(nodes: NodeRecord[], edges: EdgeRecord[]): Map<string, Set<string>> {
  const adj = new Map<string, Set<string>>();
  for (const n of nodes) adj.set(n.id, new Set());
  for (const e of edges) {
    adj.get(e.source)?.add(e.target);
    adj.get(e.target)?.add(e.source);
  }
  return adj;
}

function findComponents(
  nodes: NodeRecord[],
  adj: Map<string, Set<string>>
): NodeRecord[][] {
  const visited = new Set<string>();
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const components: NodeRecord[][] = [];

  for (const start of nodes) {
    if (visited.has(start.id)) continue;
    const queue = [start.id];
    const group: NodeRecord[] = [];
    while (queue.length) {
      const id = queue.shift()!;
      if (visited.has(id)) continue;
      visited.add(id);
      const node = byId.get(id);
      if (node) group.push(node);
      for (const neighbour of adj.get(id) ?? []) {
        if (!visited.has(neighbour)) queue.push(neighbour);
      }
    }
    components.push(group);
  }

  return components;
}

function totalWeight(comp: NodeRecord[]): number {
  return comp.reduce((sum, n) => sum + n.weight + n.fileCount, 0);
}

// ─── Step 3 — Per-component layout ────────────────────────────────────────────

interface ComponentLayout {
  positions: Map<string, { x: number; y: number }>;
  width: number;
  height: number;
  nodes: NodeRecord[];
}

/**
 * Layout a single connected component.
 *
 * Strategy:
 *  - 1 node → centre.
 *  - 2 nodes → side by side.
 *  - 3+ nodes → put the heaviest bubble at the centre; arrange neighbours
 *    on a circle around it with arc lengths proportional to neighbour size
 *    so big bubbles don't crowd small ones. Any remaining nodes (more than
 *    one hop away) are placed on a second outer ring.
 */
function layoutComponent(
  comp: NodeRecord[],
  adj: Map<string, Set<string>>,
  opts: Required<AtlasForceOptions>,
  isPrimary: boolean
): ComponentLayout {
  const positions = new Map<string, { x: number; y: number }>();

  if (comp.length === 1) {
    positions.set(comp[0].id, { x: 0, y: 0 });
    return finalizeBox(positions, comp);
  }

  if (comp.length === 2) {
    const [a, b] = comp;
    const distance = (a.weight + b.weight) / 2 + opts.bubbleGap;
    positions.set(a.id, { x: -distance / 2, y: 0 });
    positions.set(b.id, { x: distance / 2, y: 0 });
    return finalizeBox(positions, comp);
  }

  // Pick the centre: highest-weight node (most files / most connections).
  const sortedByWeight = [...comp].sort(
    (a, b) => b.weight + b.fileCount - (a.weight + a.fileCount)
  );
  const centre = sortedByWeight[0];

  // BFS depth from the centre — controls which ring each bubble lands on.
  const depths = bfsDepths(centre.id, adj);

  positions.set(centre.id, { x: 0, y: 0 });

  // Group nodes by depth ring.
  const rings = new Map<number, NodeRecord[]>();
  for (const n of comp) {
    if (n.id === centre.id) continue;
    const d = depths.get(n.id) ?? 1;
    if (!rings.has(d)) rings.set(d, []);
    rings.get(d)!.push(n);
  }

  // Place each ring at an increasing radius.
  let prevRadius = centre.weight / 2;
  const sortedDepths = [...rings.keys()].sort((a, b) => a - b);

  for (const depth of sortedDepths) {
    const ringNodes = rings.get(depth)!;
    // Sort each ring so visually-similar bubbles end up together (looks tidy).
    ringNodes.sort((a, b) => b.weight - a.weight);

    // Required radius: previous ring + biggest bubble in this ring + gap.
    const maxNodeSize = Math.max(...ringNodes.map((n) => n.weight));
    let radius = prevRadius + maxNodeSize / 2 + opts.bubbleGap;

    // Make sure circumference can fit all ring members without overlap.
    const totalArc = ringNodes.reduce((sum, n) => sum + n.weight + opts.bubbleGap * 0.6, 0);
    const minRadius = totalArc / (2 * Math.PI);
    if (minRadius > radius) radius = minRadius;

    placeOnRing(ringNodes, radius, positions, depth);

    prevRadius = radius + maxNodeSize / 2;
  }

  return finalizeBox(positions, comp);
}

function bfsDepths(start: string, adj: Map<string, Set<string>>): Map<string, number> {
  const depth = new Map<string, number>();
  depth.set(start, 0);
  const queue = [start];
  while (queue.length) {
    const id = queue.shift()!;
    const d = depth.get(id)!;
    for (const neighbour of adj.get(id) ?? []) {
      if (!depth.has(neighbour)) {
        depth.set(neighbour, d + 1);
        queue.push(neighbour);
      }
    }
  }
  return depth;
}

/**
 * Arrange nodes around a circle of the given radius, with each node's
 * angular slice proportional to its size.
 */
function placeOnRing(
  nodes: NodeRecord[],
  radius: number,
  positions: Map<string, { x: number; y: number }>,
  depth: number
): void {
  const totalSize = nodes.reduce((sum, n) => sum + n.weight + 30, 0);
  // Stagger ring start angles so concentric rings don't all line up vertically.
  let angle = -Math.PI / 2 + (depth % 2 === 0 ? 0 : Math.PI / nodes.length);

  for (const node of nodes) {
    const arcShare = ((node.weight + 30) / totalSize) * Math.PI * 2;
    const centreAngle = angle + arcShare / 2;
    positions.set(node.id, {
      x: Math.cos(centreAngle) * radius,
      y: Math.sin(centreAngle) * radius,
    });
    angle += arcShare;
  }
}

function finalizeBox(
  positions: Map<string, { x: number; y: number }>,
  nodes: NodeRecord[]
): ComponentLayout {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const n of nodes) {
    const p = positions.get(n.id);
    if (!p) continue;
    const r = n.weight / 2;
    minX = Math.min(minX, p.x - r);
    minY = Math.min(minY, p.y - r);
    maxX = Math.max(maxX, p.x + r);
    maxY = Math.max(maxY, p.y + r);
  }

  return {
    positions,
    width: maxX - minX,
    height: maxY - minY,
    nodes,
  };
}

// ─── Step 4 — Arrange components on the canvas ────────────────────────────────

interface FinalPosition {
  id: string;
  x: number;
  y: number;
}

/**
 * Pack component bounding boxes into a clean grid.
 *
 * The first (largest) component sits at the top, centred. Smaller components
 * are arranged in rows below it, balancing row width to keep the overall
 * shape close to square. This produces a layout that feels deliberate
 * regardless of how many disconnected systems there are.
 */
function arrangeComponents(
  layouts: ComponentLayout[],
  opts: Required<AtlasForceOptions>
): FinalPosition[] {
  const out: FinalPosition[] = [];
  const componentGap = opts.bubbleGap * 1.5;

  if (layouts.length === 0) return out;

  // Primary component centred at origin.
  const primary = layouts[0];
  for (const n of primary.nodes) {
    const p = primary.positions.get(n.id);
    if (p) out.push({ id: n.id, x: p.x, y: p.y });
  }

  if (layouts.length === 1) return out;

  // Pack remaining components in rows under the primary, balancing widths.
  const remaining = layouts.slice(1);
  const targetRowWidth = Math.max(primary.width, 600);

  // Greedy row packing.
  type Row = { items: ComponentLayout[]; width: number; height: number };
  const rows: Row[] = [];
  let currentRow: Row = { items: [], width: 0, height: 0 };
  for (const layout of remaining) {
    const itemWidth = layout.width + componentGap;
    if (currentRow.items.length > 0 && currentRow.width + itemWidth > targetRowWidth) {
      rows.push(currentRow);
      currentRow = { items: [], width: 0, height: 0 };
    }
    currentRow.items.push(layout);
    currentRow.width += itemWidth;
    currentRow.height = Math.max(currentRow.height, layout.height);
  }
  if (currentRow.items.length > 0) rows.push(currentRow);

  // Place each row centred horizontally below the primary.
  let cursorY = primary.height / 2 + componentGap;
  for (const row of rows) {
    const rowWidth = row.width - componentGap; // last item shouldn't have trailing gap
    let cursorX = -rowWidth / 2;
    const rowCentreY = cursorY + row.height / 2;

    for (const layout of row.items) {
      // Component-local origin is at its centre — translate to cursorX.
      const localCentreX = cursorX + layout.width / 2;
      const localCentreY = rowCentreY;

      for (const n of layout.nodes) {
        const p = layout.positions.get(n.id);
        if (p) {
          out.push({
            id: n.id,
            x: p.x + localCentreX,
            y: p.y + localCentreY,
          });
        }
      }

      cursorX += layout.width + componentGap;
    }

    cursorY += row.height + componentGap;
  }

  return out;
}

// ─── Step 5 — Apply positions and animate ─────────────────────────────────────

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
