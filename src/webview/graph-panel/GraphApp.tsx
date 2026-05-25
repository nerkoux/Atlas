import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GraphData, GraphNode, ArchitectureSystem, MessageToWebview } from '../../types';
import { postMessage, onMessage } from '../vscode';
import { Logo } from '../components/Logo';

declare const cytoscape: any;
declare const cytoscapeDagre: any;
declare const dagre: any;

// Register cytoscape-dagre extension once
if (typeof cytoscape !== 'undefined') {
  try {
    const ext = (typeof cytoscapeDagre !== 'undefined') ? cytoscapeDagre : (typeof window !== 'undefined' ? (window as any).cytoscapeDagre : undefined);
    if (ext && typeof ext === 'function') {
      cytoscape.use(ext);
    }
  } catch {
    // already registered or not available
  }
}



type LayoutName = 'cose' | 'dagre' | 'concentric';

interface AppState {
  graphData: GraphData | null;
  selectedSystem: string | null;
  focusedNode: string | null;
  layout: LayoutName;
  isLoading: boolean;
}

interface ThemeColors {
  isDark: boolean;
  background: string;
  foreground: string;
  border: string;
  mutedForeground: string;
  focusBorder: string;
}


function readThemeColors(): ThemeColors {
  const root = document.documentElement;
  const cs = getComputedStyle(root);
  const get = (name: string, fallback: string): string => {
    const v = cs.getPropertyValue(name).trim();
    return v || fallback;
  };
  // Detect light vs dark from background brightness
  const bg = get('--vscode-editor-background', '#1e1e1e');
  const isDark = isColorDark(bg);
  return {
    isDark,
    background: bg,
    foreground: get('--vscode-foreground', isDark ? '#cccccc' : '#3b3b3b'),
    border: get('--vscode-editorGroup-border', isDark ? '#2b2b2b' : '#e5e5e5'),
    mutedForeground: get('--vscode-descriptionForeground', isDark ? '#9d9d9d' : '#717171'),
    focusBorder: get('--vscode-focusBorder', '#007fd4'),
  };
}

function isColorDark(color: string): boolean {
  // Handle hex
  let hex = color.replace('#', '').trim();
  if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
  if (hex.length === 6) {
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return (r * 0.299 + g * 0.587 + b * 0.114) < 128;
  }
  // Handle rgb / rgba
  const m = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (m) {
    const [r, g, b] = [+m[1], +m[2], +m[3]];
    return (r * 0.299 + g * 0.587 + b * 0.114) < 128;
  }
  return true; // default to dark
}

function withAlpha(color: string, alpha: number): string {
  // Convert hex/rgb to rgba with given alpha
  let hex = color.replace('#', '').trim();
  if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
  if (hex.length === 6) {
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }
  const m = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (m) return `rgba(${m[1]},${m[2]},${m[3]},${alpha})`;
  return color;
}


export function GraphApp(): React.ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<any>(null);
  const themeRef = useRef<ThemeColors>(readThemeColors());

  const [theme, setTheme] = useState<ThemeColors>(themeRef.current);
  const [state, setState] = useState<AppState>({
    graphData: null,
    selectedSystem: null,
    focusedNode: null,
    layout: 'cose',
    isLoading: true,
  });
  const [tooltip, setTooltip] = useState<{ node: GraphNode; x: number; y: number } | null>(null);

  // Watch for theme changes (VS Code theme switches add/remove classes on body)
  useEffect(() => {
    const observer = new MutationObserver(() => {
      const next = readThemeColors();
      themeRef.current = next;
      setTheme(next);
    });
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  // Listen for messages from extension
  useEffect(() => {
    const dispose = onMessage((msg: MessageToWebview) => {
      if (msg.type === 'graphData') {
        setState(s => ({ ...s, graphData: msg.data, isLoading: false }));
      } else if (msg.type === 'focusNode') {
        setState(s => ({ ...s, focusedNode: msg.nodeId }));
      }
    });
    return dispose;
  }, []);

  // Build graph when data, theme or filter changes
  useEffect(() => {
    if (!state.graphData || !containerRef.current) return;
    buildGraph();
    return () => { cyRef.current?.destroy(); cyRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.graphData, state.selectedSystem, theme]);

  // Re-layout when layout type changes
  useEffect(() => {
    if (!cyRef.current) return;
    runLayout(cyRef.current, state.layout);
  }, [state.layout]);

  // Focus node animation
  useEffect(() => {
    if (!cyRef.current || !state.focusedNode) return;
    const node = cyRef.current.$(`#${CSS.escape(state.focusedNode)}`);
    if (node.length) {
      cyRef.current.animate({ fit: { eles: node.neighborhood().add(node), padding: 100 } }, { duration: 500 });
      highlightNode(state.focusedNode);
    }
  }, [state.focusedNode]);

  function getFilteredData(data: GraphData, systemId: string | null) {
    if (!systemId) return data;
    const system = data.systems.find(s => s.id === systemId);
    if (!system) return data;
    const fileSet = new Set(system.files);
    const nodes = data.nodes.filter(n => fileSet.has(n.id));
    const nodeIds = new Set(nodes.map(n => n.id));
    const edges = data.edges.filter(e => nodeIds.has(e.source) && nodeIds.has(e.target));
    return { ...data, nodes, edges };
  }

  function buildGraph() {
    if (!containerRef.current || !state.graphData || typeof cytoscape === 'undefined') return;
    if (cyRef.current) { cyRef.current.destroy(); cyRef.current = null; }

    const filtered = getFilteredData(state.graphData, state.selectedSystem);
    const t = themeRef.current;

    // Build compound parent nodes (one per system) so files are visually grouped
    const usedSystems = new Set(filtered.nodes.map(n => n.systemId));
    const systemParents = filtered.systems
      .filter(s => usedSystems.has(s.id))
      .map(s => ({
        data: {
          id: `__system__${s.id}`,
          label: s.name.toUpperCase(),
          systemColor: s.color,
          isSystem: true,
        },
        classes: 'system-group',
      }));

    const elements = [
      ...systemParents,
      ...filtered.nodes.map(n => ({
        data: {
          id: n.id,
          label: n.label,
          path: n.path,
          parent: `__system__${n.systemId}`,
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
          // Sizing based on importance — clamped for readability
          weight: Math.max(28, Math.min(54, 28 + Math.sqrt(n.dependentCount) * 6)),
        },
        classes: [n.isEntryPoint ? 'entry' : '', n.isDeadCode ? 'dead' : ''].filter(Boolean).join(' '),
      })),
      ...filtered.edges.map(e => ({
        data: { id: e.id, source: e.source, target: e.target, type: e.type, weight: e.weight },
        classes: e.type === 'dynamic-import' ? 'dynamic' : '',
      })),
    ];

    const cy = cytoscape({
      container: containerRef.current,
      elements,
      style: getCyStyle(t),
      layout: { name: 'preset' },
      wheelSensitivity: 0.2,
      minZoom: 0.1,
      maxZoom: 3,
      boxSelectionEnabled: false,
      pixelRatio: 'auto',
      textureOnViewport: true,
    });

    bindEvents(cy, filtered.nodes);
    cyRef.current = cy;
    runLayout(cy, state.layout);
  }

  function bindEvents(cy: any, nodes: GraphNode[]) {
    // Hover — soft glow (only on file nodes)
    cy.on('mouseover', 'node[!isSystem]', (evt: any) => {
      evt.target.addClass('hovered');
      evt.target.connectedEdges().addClass('edge-hovered');
      if (containerRef.current) containerRef.current.style.cursor = 'pointer';
    });
    cy.on('mouseout', 'node[!isSystem]', (evt: any) => {
      evt.target.removeClass('hovered');
      evt.target.connectedEdges().removeClass('edge-hovered');
      if (containerRef.current) containerRef.current.style.cursor = 'default';
    });

    // Click on file — select & show details
    cy.on('tap', 'node[!isSystem]', (evt: any) => {
      const id = evt.target.data('id');
      const graphNode = nodes.find(n => n.id === id);
      if (!graphNode) return;
      highlightNode(id);
      const pos = evt.target.renderedPosition();
      const rect = containerRef.current!.getBoundingClientRect();
      setTooltip({
        node: graphNode,
        x: Math.min(Math.max(16, pos.x + 16), rect.width - 256),
        y: Math.min(Math.max(16, pos.y + 8), rect.height - 240),
      });
      setState(s => ({ ...s, focusedNode: id }));
    });

    // Click on system parent — focus that system
    cy.on('tap', 'node.system-group', (evt: any) => {
      const sysId = evt.target.data('id').replace('__system__', '');
      setState(s => ({ ...s, selectedSystem: s.selectedSystem === sysId ? null : sysId }));
    });

    // Background click — clear
    cy.on('tap', (evt: any) => {
      if (evt.target === cy) {
        cy.nodes().removeClass('highlighted dimmed selected');
        cy.edges().removeClass('highlighted dimmed');
        setTooltip(null);
        setState(s => ({ ...s, focusedNode: null }));
      }
    });

    // Double-click — open file
    cy.on('dbltap', 'node[!isSystem]', (evt: any) => {
      const p = evt.target.data('path');
      if (p) postMessage({ type: 'openFile', path: p });
    });

    // Right-click — open file
    cy.on('cxttap', 'node[!isSystem]', (evt: any) => {
      const p = evt.target.data('path');
      if (p) postMessage({ type: 'openFile', path: p });
    });
  }

  function highlightNode(nodeId: string) {
    if (!cyRef.current) return;
    const cy = cyRef.current;
    const node = cy.$(`#${CSS.escape(nodeId)}`);
    // Only dim file nodes; keep system groups visible
    cy.nodes('[!isSystem]').removeClass('highlighted selected').addClass('dimmed');
    cy.edges().removeClass('highlighted').addClass('dimmed');
    node.removeClass('dimmed').addClass('highlighted selected');
    node.connectedEdges().removeClass('dimmed').addClass('highlighted');
    node.connectedEdges().connectedNodes().removeClass('dimmed').addClass('highlighted');
  }

  const handleFitAll = useCallback(() => cyRef.current?.animate({ fit: { padding: 60 } }, { duration: 400 }), []);
  const handleZoomIn = useCallback(() => {
    if (!cyRef.current || !containerRef.current) return;
    const center = { x: containerRef.current.clientWidth / 2, y: containerRef.current.clientHeight / 2 };
    cyRef.current.animate({ zoom: { level: cyRef.current.zoom() * 1.4, renderedPosition: center } }, { duration: 250 });
  }, []);
  const handleZoomOut = useCallback(() => {
    if (!cyRef.current || !containerRef.current) return;
    const center = { x: containerRef.current.clientWidth / 2, y: containerRef.current.clientHeight / 2 };
    cyRef.current.animate({ zoom: { level: cyRef.current.zoom() / 1.4, renderedPosition: center } }, { duration: 250 });
  }, []);

  if (state.isLoading || !state.graphData) return <LoadingView />;

  const { graphData } = state;
  const systems = graphData.systems ?? [];
  const filteredCount = state.selectedSystem
    ? graphData.nodes.filter(n => n.systemId === state.selectedSystem).length
    : graphData.nodes.length;

  return (
    <div style={S.root}>
      {/* Top bar */}
      <header style={S.topBar} role="banner">
        <div style={S.topBarLeft}>
          <Logo size={28} />
          <span style={S.logoText}>Atlas</span>
          <span style={S.divider} aria-hidden="true" />
          <span style={S.statChip}><b>{filteredCount}</b> files</span>
          <span style={S.statChip}><b>{systems.length}</b> systems</span>
          <span style={S.statChip}><b>{graphData.edges.length}</b> links</span>
          {graphData.circularDeps.length > 0 && (
            <span style={{ ...S.statChip, ...S.statChipWarn }}><b>{graphData.circularDeps.length}</b> cycles</span>
          )}
        </div>
        <div style={S.topBarRight}>
          <LayoutPicker
            active={state.layout}
            onChange={l => setState(s => ({ ...s, layout: l }))}
          />
        </div>
      </header>

      {/* System filter row */}
      <div style={S.filterBar} role="toolbar" aria-label="Filter by system">
        <button
          style={{ ...S.filterPill, ...(state.selectedSystem === null ? S.filterPillActive : {}) }}
          onClick={() => setState(s => ({ ...s, selectedSystem: null }))}
          aria-pressed={state.selectedSystem === null}
        >
          All systems
        </button>
        {systems.filter(s => s.files.length > 0).map(sys => (
          <button
            key={sys.id}
            style={{
              ...S.filterPill,
              ...(state.selectedSystem === sys.id
                ? { ...S.filterPillActive, borderColor: sys.color, color: sys.color, background: withAlpha(sys.color, 0.12) }
                : {}),
            }}
            onClick={() => setState(s => ({ ...s, selectedSystem: s.selectedSystem === sys.id ? null : sys.id }))}
            aria-pressed={state.selectedSystem === sys.id}
            aria-label={`Filter: ${sys.name}`}
          >
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: sys.color, display: 'inline-block', flexShrink: 0 }} aria-hidden="true" />
            <span>{sys.name}</span>
            <span style={S.filterPillCount}>{sys.files.length}</span>
          </button>
        ))}
      </div>

      {/* Graph canvas */}
      <div style={S.graphArea}>
        <div ref={containerRef} style={S.graphCanvas} role="img" aria-label="Architecture dependency graph" />

        {/* Empty state */}
        {filteredCount === 0 && (
          <div style={S.emptyOverlay}>
            <p style={S.emptyText}>No files in this system</p>
          </div>
        )}

        {/* No-edges hint — when files exist but have no internal links */}
        {filteredCount > 0 && graphData.edges.length === 0 && (
          <div style={S.hint} role="status">
            <span aria-hidden="true">ⓘ</span>
            <span>No imports detected between these files. Files are grouped by detected architectural systems.</span>
          </div>
        )}

        {/* Zoom toolbar */}
        <nav style={S.toolbar} aria-label="Graph controls">
          <ToolBtn onClick={handleZoomIn} label="Zoom in">
            <PlusIcon />
          </ToolBtn>
          <ToolBtn onClick={handleZoomOut} label="Zoom out">
            <MinusIcon />
          </ToolBtn>
          <div style={S.toolbarDivider} aria-hidden="true" />
          <ToolBtn onClick={handleFitAll} label="Fit to screen">
            <FitIcon />
          </ToolBtn>
        </nav>

        {/* Legend */}
        <div style={S.legend} aria-label="Graph legend">
          <LegendItem color={theme.focusBorder} label="Selected" />
          <LegendItem color="var(--vscode-editorWarning-foreground, #d19a00)" label="Entry point" />
          <LegendItem color="var(--vscode-errorForeground, #f14c4c)" label="Unreachable" dashed />
        </div>

        {/* Node tooltip */}
        {tooltip && (
          <NodeTooltip
            node={tooltip.node}
            x={tooltip.x}
            y={tooltip.y}
            onClose={() => { setTooltip(null); setState(s => ({ ...s, focusedNode: null })); cyRef.current?.nodes().removeClass('highlighted dimmed selected'); cyRef.current?.edges().removeClass('highlighted dimmed'); }}
            onOpen={path => postMessage({ type: 'openFile', path })}
          />
        )}
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function LayoutPicker({ active, onChange }: { active: LayoutName; onChange: (l: LayoutName) => void }): React.ReactElement {
  const dagreOk = isLayoutAvailable('dagre');
  const options: { id: LayoutName; label: string; title: string }[] = [
    { id: 'cose', label: 'Force', title: 'Force-directed layout — natural clustering' },
    { id: 'dagre', label: 'Hierarchy', title: dagreOk ? 'Hierarchical top-down layout' : 'Hierarchical layout (using built-in fallback)' },
    { id: 'concentric', label: 'Radial', title: 'Concentric layout — most-used files in the center' },
  ];
  return (
    <div style={S.layoutPicker} role="group" aria-label="Graph layout">
      {options.map(o => (
        <button
          key={o.id}
          style={{ ...S.layoutBtn, ...(active === o.id ? S.layoutBtnActive : {}) }}
          onClick={() => onChange(o.id)}
          title={o.title}
          aria-pressed={active === o.id}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function ToolBtn({ onClick, label, children }: { onClick: () => void; label: string; children: React.ReactNode }): React.ReactElement {
  return (
    <button style={S.toolBtn} onClick={onClick} title={label} aria-label={label}>{children}</button>
  );
}

function LegendItem({ color, label, dashed }: { color: string; label: string; dashed?: boolean }): React.ReactElement {
  return (
    <div style={S.legendItem}>
      <span style={{
        width: 10,
        height: 10,
        borderRadius: '50%',
        border: `2px ${dashed ? 'dashed' : 'solid'} ${color}`,
        flexShrink: 0,
      }} aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

function PlusIcon(): React.ReactElement {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function MinusIcon(): React.ReactElement {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function FitIcon(): React.ReactElement {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M8 3H5a2 2 0 0 0-2 2v3" /><path d="M21 8V5a2 2 0 0 0-2-2h-3" />
      <path d="M3 16v3a2 2 0 0 0 2 2h3" /><path d="M16 21h3a2 2 0 0 0 2-2v-3" />
    </svg>
  );
}

function NodeTooltip({ node, x, y, onClose, onOpen }: {
  node: GraphNode; x: number; y: number;
  onClose: () => void;
  onOpen: (path: string) => void;
}): React.ReactElement {
  const LANG: Record<string, string> = { typescript: 'TS', javascript: 'JS', python: 'PY', go: 'GO', rust: 'RS', java: 'JV', csharp: 'C#', unknown: '?' };
  return (
    <div style={{ ...S.tooltip, left: x, top: y }} role="dialog" aria-label={`Details for ${node.label}`}>
      <div style={S.tooltipHead}>
        <span style={{ ...S.tooltipLang, background: node.systemColor }}>{LANG[node.language] ?? '?'}</span>
        <span style={S.tooltipName}>{node.label}</span>
        <button style={S.tooltipClose} onClick={onClose} aria-label="Close">×</button>
      </div>
      <p style={S.tooltipPath}>{node.relativePath}</p>
      <div style={S.tooltipStats}>
        {([['Imports', node.importCount], ['Exports', node.exportCount], ['Deps', node.dependencyCount], ['Used by', node.dependentCount]] as [string, number][]).map(([k, v]) => (
          <div key={k} style={S.tooltipStat}>
            <span style={S.tooltipStatVal}>{v}</span>
            <span style={S.tooltipStatKey}>{k}</span>
          </div>
        ))}
      </div>
      {node.isEntryPoint && <p style={S.tooltipBadge}>◆ Entry Point</p>}
      {node.isDeadCode && <p style={{ ...S.tooltipBadge, color: 'var(--vscode-errorForeground, #ef4444)' }}>☠ Unreachable</p>}
      <button style={S.tooltipOpenBtn} onClick={() => onOpen(node.path)}>Open in Editor</button>
    </div>
  );
}

function LoadingView(): React.ReactElement {
  return (
    <div style={S.loading} role="status" aria-label="Loading graph">
      <div style={S.loadingSpinner} aria-hidden="true" />
      <span style={S.loadingText}>Building graph…</span>
    </div>
  );
}


function isLayoutAvailable(name: string): boolean {
  try {
    return typeof cytoscape !== 'undefined' && !!cytoscape('layout', name);
  } catch {
    return false;
  }
}

function runLayout(cy: any, name: LayoutName): void {
  // If dagre layout requested but not registered, fall back to breadthfirst (built-in)
  let actualName: string = name;
  if (name === 'dagre' && !isLayoutAvailable('dagre')) {
    actualName = 'breadthfirst';
  }
  const config = getLayoutConfig(actualName);
  cy.layout(config).run();
}

function getLayoutConfig(name: string): object {
  const common = { animate: true, animationDuration: 600, animationEasing: 'ease-out-cubic' };
  switch (name) {
    case 'dagre':
      return {
        ...common,
        name: 'dagre',
        rankDir: 'TB',
        nodeSep: 60,
        rankSep: 100,
        edgeSep: 24,
        padding: 50,
        fit: true,
        spacingFactor: 1.0,
      };
    case 'breadthfirst':
      // Fallback for hierarchy when dagre is unavailable
      return {
        ...common,
        name: 'breadthfirst',
        directed: true,
        spacingFactor: 1.4,
        padding: 50,
        fit: true,
        grid: false,
        circle: false,
      };
    case 'concentric':
      return {
        ...common,
        name: 'concentric',
        padding: 50,
        fit: true,
        concentric: (n: any) => n.data('dependentCount') + 1,
        levelWidth: () => 3,
        minNodeSpacing: 50,
      };
    default:
      return {
        ...common,
        name: 'cose',
        nodeRepulsion: () => 14000,
        idealEdgeLength: () => 100,
        edgeElasticity: () => 0.4,
        nestingFactor: 1.5,
        gravity: 0.35,
        numIter: 2000,
        initialTemp: 1000,
        coolingFactor: 0.98,
        minTemp: 1.0,
        padding: 50,
        fit: true,
        componentSpacing: 80,
      };
  }
}



function getCyStyle(t: ThemeColors): object[] {
  // Use solid foreground color for labels — text-outline removed for clarity
  const labelColor = t.foreground;
  const labelHaloColor = t.background;
  // Edges need to be clearly visible — use foreground with moderate alpha
  const edgeColor = t.isDark ? withAlpha(t.foreground, 0.32) : withAlpha(t.foreground, 0.4);
  const edgeArrowColor = t.isDark ? withAlpha(t.foreground, 0.5) : withAlpha(t.foreground, 0.55);
  const edgeHoverColor = t.foreground;
  const dimmedOpacity = 0.15;

  return [

    {
      selector: 'node.system-group',
      style: {
        'background-color': 'data(systemColor)',
        'background-opacity': t.isDark ? 0.06 : 0.05,
        'border-width': 1,
        'border-color': 'data(systemColor)',
        'border-opacity': t.isDark ? 0.35 : 0.45,
        'border-style': 'solid',
        'shape': 'round-rectangle',
        'label': 'data(label)',
        'font-size': '10px',
        'font-weight': 700,
        'color': 'data(systemColor)',
        'text-valign': 'top',
        'text-halign': 'center',
        'text-margin-y': '-6px',
        'text-outline-width': '3px',
        'text-outline-color': labelHaloColor,
        'text-outline-opacity': 1,
        'padding': 16,
        'corner-radius': 12,
        'min-zoomed-font-size': 6,
        'transition-property': 'opacity, border-opacity, background-opacity',
        'transition-duration': '0.25s',
      },
    },

    {
      selector: 'node[!isSystem]',
      style: {
        'background-color': 'data(systemColor)',
        'background-opacity': 0.95,
        'label': 'data(label)',
        'font-size': '10px',
        'font-family': 'system-ui, -apple-system, "Segoe UI", sans-serif',
        'font-weight': 500,
        'text-valign': 'bottom',
        'text-halign': 'center',
        'text-margin-y': '6px',
        'color': labelColor,
        // Halo: thin, same as background — keeps text crisp
        'text-outline-width': '3px',
        'text-outline-color': labelHaloColor,
        'text-outline-opacity': 1,
        'width': 'data(weight)',
        'height': 'data(weight)',
        'border-width': '2px',
        'border-color': labelHaloColor,
        'border-opacity': 1,
        'text-max-width': '110px',
        'text-wrap': 'ellipsis',
        'min-zoomed-font-size': 7,
        'opacity': 1,
        'shadow-blur': 0,
        'shadow-opacity': 0,
        'transition-property': 'opacity, border-color, border-width, background-opacity, shadow-blur, shadow-opacity',
        'transition-duration': '0.25s',
        'transition-timing-function': 'ease-out',
      },
    },


    {
      selector: 'node[!isSystem].entry',
      style: {
        'border-width': '3px',
        'border-color': '#d19a00',
      },
    },

    {
      selector: 'node[!isSystem].dead',
      style: {
        'opacity': 0.4,
        'background-opacity': 0.5,
        'border-style': 'dashed',
        'border-color': '#f14c4c',
      },
    },

    {
      selector: 'node[!isSystem].hovered',
      style: {
        'border-width': '3px',
        'border-color': labelColor,
        'shadow-blur': '18px',
        'shadow-color': 'data(systemColor)',
        'shadow-opacity': 0.6,
        'shadow-offset-x': 0,
        'shadow-offset-y': 0,
        'z-index': 50,
      },
    },

    {
      selector: 'node[!isSystem].highlighted, node[!isSystem].selected',
      style: {
        'border-width': '3px',
        'border-color': t.focusBorder,
        'shadow-blur': '24px',
        'shadow-color': 'data(systemColor)',
        'shadow-opacity': 0.7,
        'shadow-offset-x': 0,
        'shadow-offset-y': 0,
        'opacity': 1,
        'z-index': 100,
      },
    },

    {
      selector: 'node[!isSystem].dimmed',
      style: {
        'opacity': dimmedOpacity,
        'shadow-opacity': 0,
        'shadow-blur': 0,
      },
    },


    {
      selector: 'edge',
      style: {
        'width': 1.5,
        'line-color': edgeColor,
        'target-arrow-color': edgeArrowColor,
        'target-arrow-shape': 'triangle',
        'curve-style': 'bezier',
        'arrow-scale': 1.1,
        'opacity': 0.85,
        'transition-property': 'opacity, line-color, width, target-arrow-color',
        'transition-duration': '0.25s',
        'transition-timing-function': 'ease-out',
      },
    },

    {
      selector: 'edge.dynamic',
      style: {
        'line-style': 'dashed',
        'line-dash-pattern': [5, 4],
      },
    },

    {
      selector: 'edge.edge-hovered',
      style: {
        'opacity': 1,
        'width': 2.5,
        'line-color': edgeHoverColor,
        'target-arrow-color': edgeHoverColor,
      },
    },

    {
      selector: 'edge.highlighted',
      style: {
        'opacity': 1,
        'width': 2.5,
        'line-color': t.focusBorder,
        'target-arrow-color': t.focusBorder,
        'z-index': 10,
      },
    },

    {
      selector: 'edge.dimmed',
      style: { 'opacity': 0.05 },
    },
  ];
}



const S: Record<string, React.CSSProperties> = {
  root: {
    display: 'flex',
    flexDirection: 'column',
    width: '100vw',
    height: '100vh',
    background: 'var(--vscode-editor-background)',
    color: 'var(--vscode-foreground)',
    fontFamily: 'var(--vscode-font-family)',
    overflow: 'hidden',
  },
  topBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 16px',
    height: '44px',
    borderBottom: '1px solid var(--vscode-editorGroup-border)',
    flexShrink: 0,
    gap: '12px',
  },
  topBarLeft: { display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 },
  topBarRight: { display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 },
  logo: { fontSize: '16px', color: 'var(--vscode-focusBorder)', lineHeight: 1 },
  logoText: { fontSize: '13px', fontWeight: 700, letterSpacing: '0.3px', color: 'var(--vscode-foreground)' },
  divider: { width: '1px', height: '14px', background: 'var(--vscode-editorGroup-border)', margin: '0 4px' },
  statChip: {
    fontSize: '11px',
    color: 'var(--vscode-descriptionForeground)',
    padding: '2px 8px',
    borderRadius: '10px',
    background: 'var(--vscode-badge-background)',
    whiteSpace: 'nowrap',
  },
  statChipWarn: {
    background: 'var(--vscode-inputValidation-warningBackground, rgba(245,158,11,0.15))',
    color: 'var(--vscode-editorWarning-foreground, #d19a00)',
  },

  // Filter bar
  filterBar: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 16px',
    borderBottom: '1px solid var(--vscode-editorGroup-border)',
    flexShrink: 0,
    overflowX: 'auto',
    background: 'var(--vscode-editor-background)',
  },
  filterPill: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '4px 10px',
    borderRadius: '14px',
    border: '1px solid var(--vscode-editorGroup-border)',
    cursor: 'pointer',
    fontSize: '11px',
    fontWeight: 500,
    whiteSpace: 'nowrap',
    background: 'transparent',
    color: 'var(--vscode-descriptionForeground)',
    transition: 'all 0.15s ease',
    flexShrink: 0,
  },
  filterPillActive: {
    background: 'var(--vscode-toolbar-activeBackground, var(--vscode-list-activeSelectionBackground))',
    borderColor: 'var(--vscode-focusBorder)',
    color: 'var(--vscode-foreground)',
  },
  filterPillCount: {
    fontSize: '10px',
    opacity: 0.7,
    fontWeight: 600,
  },

  // Layout picker
  layoutPicker: {
    display: 'flex',
    gap: '0',
    background: 'var(--vscode-input-background)',
    borderRadius: '6px',
    padding: '2px',
    border: '1px solid var(--vscode-editorGroup-border)',
  },
  layoutBtn: {
    padding: '4px 12px',
    background: 'transparent',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '11px',
    color: 'var(--vscode-descriptionForeground)',
    fontWeight: 500,
    transition: 'all 0.15s ease',
  },
  layoutBtnActive: {
    background: 'var(--vscode-button-background)',
    color: 'var(--vscode-button-foreground)',
  },

  // Graph area
  graphArea: {
    flex: 1,
    overflow: 'hidden',
    position: 'relative',
    background: 'var(--vscode-editor-background)',
  },
  graphCanvas: {
    width: '100%',
    height: '100%',
  },

  // Empty overlay
  emptyOverlay: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none',
  },
  emptyText: {
    fontSize: '13px',
    color: 'var(--vscode-descriptionForeground)',
    margin: 0,
  },
  hint: {
    position: 'absolute',
    top: '16px',
    left: '50%',
    transform: 'translateX(-50%)',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '6px 14px',
    background: 'var(--vscode-editorWidget-background)',
    border: '1px solid var(--vscode-editorWidget-border, var(--vscode-editorGroup-border))',
    borderRadius: '14px',
    fontSize: '11px',
    color: 'var(--vscode-descriptionForeground)',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    maxWidth: '500px',
  },

  // Toolbar
  toolbar: {
    position: 'absolute',
    right: '16px',
    bottom: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    background: 'var(--vscode-editorWidget-background, var(--vscode-editor-background))',
    border: '1px solid var(--vscode-editorWidget-border, var(--vscode-editorGroup-border))',
    borderRadius: '8px',
    padding: '4px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
  },
  toolbarDivider: {
    height: '1px',
    background: 'var(--vscode-editorGroup-border)',
    margin: '2px 4px',
  },
  toolBtn: {
    width: '30px',
    height: '30px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    color: 'var(--vscode-foreground)',
    borderRadius: '6px',
    transition: 'background 0.15s ease',
  },

  // Legend
  legend: {
    position: 'absolute',
    left: '16px',
    bottom: '16px',
    display: 'flex',
    gap: '12px',
    padding: '6px 12px',
    background: 'var(--vscode-editorWidget-background, var(--vscode-editor-background))',
    border: '1px solid var(--vscode-editorWidget-border, var(--vscode-editorGroup-border))',
    borderRadius: '8px',
    fontSize: '10px',
    color: 'var(--vscode-descriptionForeground)',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    whiteSpace: 'nowrap',
  },

  // Tooltip
  tooltip: {
    position: 'absolute',
    background: 'var(--vscode-editorWidget-background)',
    border: '1px solid var(--vscode-editorWidget-border, var(--vscode-editorGroup-border))',
    borderRadius: '10px',
    padding: '14px',
    width: '240px',
    zIndex: 1000,
    boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
    animation: 'fadeIn 0.18s ease',
  },
  tooltipHead: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' },
  tooltipLang: {
    fontSize: '9px',
    fontWeight: 700,
    padding: '2px 6px',
    borderRadius: '4px',
    color: '#fff',
    flexShrink: 0,
    letterSpacing: '0.3px',
  },
  tooltipName: {
    fontSize: '12px',
    fontWeight: 600,
    color: 'var(--vscode-foreground)',
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  tooltipClose: {
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    color: 'var(--vscode-descriptionForeground)',
    fontSize: '18px',
    lineHeight: 1,
    flexShrink: 0,
    padding: '0 4px',
    borderRadius: '4px',
  },
  tooltipPath: {
    fontSize: '10px',
    color: 'var(--vscode-descriptionForeground)',
    fontFamily: 'var(--vscode-editor-font-family, monospace)',
    margin: '0 0 12px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  tooltipStats: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr 1fr',
    gap: '4px',
    marginBottom: '12px',
    padding: '8px 0',
    borderTop: '1px solid var(--vscode-editorGroup-border)',
    borderBottom: '1px solid var(--vscode-editorGroup-border)',
  },
  tooltipStat: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' },
  tooltipStatVal: { fontSize: '15px', fontWeight: 700, color: 'var(--vscode-foreground)', lineHeight: 1 },
  tooltipStatKey: {
    fontSize: '9px',
    color: 'var(--vscode-descriptionForeground)',
    textTransform: 'uppercase',
    letterSpacing: '0.3px',
  },
  tooltipBadge: { fontSize: '10px', color: 'var(--vscode-editorWarning-foreground, #d19a00)', margin: '4px 0' },
  tooltipOpenBtn: {
    width: '100%',
    padding: '7px',
    background: 'var(--vscode-button-background)',
    color: 'var(--vscode-button-foreground)',
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer',
    fontSize: '11px',
    fontWeight: 600,
    marginTop: '4px',
  },

  // Loading
  loading: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
    gap: '14px',
    background: 'var(--vscode-editor-background)',
  },
  loadingSpinner: {
    width: '28px',
    height: '28px',
    border: '2px solid var(--vscode-editorGroup-border)',
    borderTopColor: 'var(--vscode-focusBorder)',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  loadingText: { fontSize: '12px', color: 'var(--vscode-descriptionForeground)' },
};
