/**
 * Cytoscape stylesheet for the Atlas graph.
 *
 * Two modes:
 *  - `systems`: one node per architectural system; cheap to render at any size.
 *  - `files`:   one node per file. Above 300 nodes we drop expensive features
 *               (compound parents, glow shadows, text outlines) automatically.
 */
import { ThemeColors, withAlpha } from '../../theme/colors';

export type StyleMode = 'systems' | 'files';

export interface StyleOptions {
  theme: ThemeColors;
  mode: StyleMode;
  /** Total file-node count — used to switch into "lite" rendering for big graphs. */
  fileCount: number;
}

export function getCyStyle({ theme: t, mode, fileCount }: StyleOptions): object[] {
  if (mode === 'systems') return buildSystemStyles(t);

  const isLarge = fileCount > 300;
  return buildFileStyles(t, isLarge);
}

// ─── System view ──────────────────────────────────────────────────────────────

function buildSystemStyles(t: ThemeColors): object[] {
  const haloColor = t.background;

  return [
    {
      selector: 'node',
      style: {
        'background-color': 'data(systemColor)',
        'background-opacity': 0.92,
        label: 'data(label)',
        'font-size': '12px',
        'font-family': 'system-ui, -apple-system, "Segoe UI", sans-serif',
        'font-weight': 600,
        'text-valign': 'center',
        'text-halign': 'center',
        color: '#ffffff',
        'text-outline-width': 2,
        'text-outline-color': 'data(systemColor)',
        'text-outline-opacity': 1,
        width: 'data(weight)',
        height: 'data(weight)',
        'border-width': 2,
        'border-color': haloColor,
        'border-opacity': 1,
        'text-max-width': 100,
        'text-wrap': 'ellipsis',
        'min-zoomed-font-size': 8,
        'transition-property': 'border-color, border-width, background-opacity',
        'transition-duration': '0.2s',
      },
    },
    {
      selector: 'node.hovered',
      style: {
        'border-width': 3,
        'border-color': t.foreground,
      },
    },
    {
      selector: 'node.highlighted',
      style: {
        'border-width': 3,
        'border-color': t.focusBorder,
      },
    },
    {
      selector: 'node.dimmed',
      style: { opacity: 0.3 },
    },
    {
      selector: 'edge',
      style: {
        width: 'data(thickness)',
        'line-color': withAlpha(t.foreground, 0.35),
        'target-arrow-color': withAlpha(t.foreground, 0.5),
        'target-arrow-shape': 'triangle',
        'curve-style': 'bezier',
        'arrow-scale': 1.2,
        opacity: 0.7,
        'transition-property': 'opacity, line-color',
        'transition-duration': '0.2s',
      },
    },
    {
      selector: 'edge.highlighted',
      style: {
        opacity: 1,
        'line-color': t.focusBorder,
        'target-arrow-color': t.focusBorder,
      },
    },
    {
      selector: 'edge.dimmed',
      style: { opacity: 0.08 },
    },
  ];
}

// ─── File view ────────────────────────────────────────────────────────────────

function buildFileStyles(t: ThemeColors, isLarge: boolean): object[] {
  const labelColor = t.foreground;
  const labelHaloColor = t.background;
  const edgeColor = t.isDark ? withAlpha(t.foreground, 0.28) : withAlpha(t.foreground, 0.36);
  const edgeArrowColor = t.isDark ? withAlpha(t.foreground, 0.45) : withAlpha(t.foreground, 0.5);
  const edgeHoverColor = t.foreground;
  const dimmedOpacity = 0.12;

  // Big graphs: hide labels until the user zooms in, drop shadows entirely,
  // shrink nodes, and fade edges to keep the canvas legible.
  const labelMinZoom = isLarge ? 1.2 : 0.5;
  const baseNodeSize = isLarge ? 12 : 28;
  const maxNodeSize = isLarge ? 28 : 54;

  return [
    // ─── System group (compound parent) ───────────────────────────────────
    {
      selector: 'node.system-group',
      style: {
        'background-color': 'data(systemColor)',
        'background-opacity': t.isDark ? 0.05 : 0.04,
        'border-width': 1,
        'border-color': 'data(systemColor)',
        'border-opacity': 0.3,
        'border-style': 'solid',
        shape: 'round-rectangle',
        label: 'data(label)',
        'font-size': '11px',
        'font-weight': 700,
        color: 'data(systemColor)',
        'text-valign': 'top',
        'text-halign': 'center',
        'text-margin-y': '-6px',
        'text-outline-width': 3,
        'text-outline-color': labelHaloColor,
        'text-outline-opacity': 1,
        padding: 14,
        'corner-radius': 10,
        'min-zoomed-font-size': 7,
      },
    },

    // ─── File node ────────────────────────────────────────────────────────
    {
      selector: 'node[!isSystem]',
      style: {
        'background-color': 'data(systemColor)',
        'background-opacity': 0.95,
        label: isLarge ? '' : 'data(label)',
        'font-size': isLarge ? '9px' : '10px',
        'font-family': 'system-ui, -apple-system, "Segoe UI", sans-serif',
        'font-weight': 500,
        'text-valign': 'bottom',
        'text-halign': 'center',
        'text-margin-y': '6px',
        color: labelColor,
        'text-outline-width': isLarge ? 0 : 3,
        'text-outline-color': labelHaloColor,
        'text-outline-opacity': isLarge ? 0 : 1,
        width: clampSize(baseNodeSize, maxNodeSize),
        height: clampSize(baseNodeSize, maxNodeSize),
        'border-width': isLarge ? 1 : 2,
        'border-color': labelHaloColor,
        'border-opacity': 1,
        'text-max-width': 110,
        'text-wrap': 'ellipsis',
        'min-zoomed-font-size': labelMinZoom * 8,
        opacity: 1,
      },
    },

    // ─── Entry point ──────────────────────────────────────────────────────
    {
      selector: 'node[!isSystem].entry',
      style: { 'border-width': isLarge ? 2 : 3, 'border-color': '#d19a00' },
    },

    // ─── Dead code ────────────────────────────────────────────────────────
    {
      selector: 'node[!isSystem].dead',
      style: {
        opacity: 0.35,
        'background-opacity': 0.45,
        'border-style': 'dashed',
        'border-color': '#f14c4c',
      },
    },

    // ─── Hover (skip glow on big graphs — the canvas can't keep up) ───────
    {
      selector: 'node[!isSystem].hovered',
      style: isLarge
        ? {
            'border-width': 2,
            'border-color': labelColor,
            'z-index': 50,
          }
        : {
            'border-width': 3,
            'border-color': labelColor,
            'shadow-blur': 18,
            'shadow-color': 'data(systemColor)',
            'shadow-opacity': 0.6,
            'shadow-offset-x': 0,
            'shadow-offset-y': 0,
            'z-index': 50,
          },
    },

    // ─── Highlighted / selected ───────────────────────────────────────────
    {
      selector: 'node[!isSystem].highlighted, node[!isSystem].selected',
      style: isLarge
        ? {
            'border-width': 2.5,
            'border-color': t.focusBorder,
            'z-index': 100,
          }
        : {
            'border-width': 3,
            'border-color': t.focusBorder,
            'shadow-blur': 24,
            'shadow-color': 'data(systemColor)',
            'shadow-opacity': 0.7,
            'shadow-offset-x': 0,
            'shadow-offset-y': 0,
            opacity: 1,
            'z-index': 100,
          },
    },

    // ─── Dimmed ───────────────────────────────────────────────────────────
    {
      selector: 'node[!isSystem].dimmed',
      style: { opacity: dimmedOpacity },
    },

    // ─── Edge defaults ────────────────────────────────────────────────────
    {
      selector: 'edge',
      style: {
        width: isLarge ? 0.8 : 1.5,
        'line-color': edgeColor,
        'target-arrow-color': edgeArrowColor,
        'target-arrow-shape': isLarge ? 'none' : 'triangle',
        'curve-style': isLarge ? 'haystack' : 'bezier',
        'haystack-radius': 0.5,
        'arrow-scale': 1.0,
        opacity: isLarge ? 0.5 : 0.85,
      },
    },

    // ─── Dynamic-import edges ─────────────────────────────────────────────
    {
      selector: 'edge.dynamic',
      style: { 'line-style': 'dashed', 'line-dash-pattern': [5, 4] },
    },

    // ─── Edge hover ───────────────────────────────────────────────────────
    {
      selector: 'edge.edge-hovered',
      style: {
        opacity: 1,
        width: 2.5,
        'line-color': edgeHoverColor,
        'target-arrow-color': edgeHoverColor,
      },
    },

    // ─── Edge highlighted ─────────────────────────────────────────────────
    {
      selector: 'edge.highlighted',
      style: {
        opacity: 1,
        width: 2.5,
        'line-color': t.focusBorder,
        'target-arrow-color': t.focusBorder,
        'z-index': 10,
      },
    },

    // ─── Edge dimmed ──────────────────────────────────────────────────────
    {
      selector: 'edge.dimmed',
      style: { opacity: 0.04 },
    },
  ];
}

function clampSize(min: number, max: number) {
  // Cytoscape supports a function/expression for size, but for simplicity here
  // we just return a constant — node weights are baked into element data.
  return `data(weight)` as unknown as number;
}
