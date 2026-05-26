/**
 * Root component of the Atlas architecture-graph webview.
 *
 * GraphApp is intentionally thin. It wires together:
 *  - the inbound message stream from the extension host (with a `graphReady`
 *    handshake that prevents a race where the initial dataset got dropped),
 *  - the active VS Code theme (via {@link useTheme}),
 *  - the imperative Cytoscape instance (via {@link useGraphInstance}),
 *  - presentational components for the chrome around the canvas.
 *
 * The `viewMode` toggle is the headline performance feature: `systems` mode
 * collapses each architectural system into a single bubble, which scales to
 * arbitrarily large repositories. `files` mode shows individual files and
 * automatically switches into a "lite" rendering profile above 300 nodes.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { GraphData, GraphNode, MessageToWebview } from '../../types';
import { onMessage, postMessage } from '../vscode';
import { GraphLegend } from './components/GraphLegend';
import { GraphToolbar } from './components/GraphToolbar';
import { GraphTopBar } from './components/GraphTopBar';
import { HintBanner } from './components/HintBanner';
import { LoadingView } from './components/LoadingView';
import { NodeTooltip } from './components/NodeTooltip';
import { SystemFilterBar } from './components/SystemFilterBar';
import { ViewMode, ViewModePicker } from './components/ViewModePicker';
import type { LayoutName } from './cytoscape/layout';
import { useGraphInstance } from './hooks/useGraphInstance';
import { useTheme } from './hooks/useTheme';
import { graphStyles as S } from './styles';

interface AppState {
  graphData: GraphData | null;
  selectedSystem: string | null;
  focusedNode: string | null;
  layout: LayoutName;
  viewMode: ViewMode;
  isLoading: boolean;
}

interface Tooltip {
  node: GraphNode;
  x: number;
  y: number;
}

const INITIAL_STATE: AppState = {
  graphData: null,
  selectedSystem: null,
  focusedNode: null,
  layout: 'cose',
  viewMode: 'systems', // start with the cheap, scalable view
  isLoading: true,
};

/** Above this file count, default to systems view to keep the canvas usable. */
const SYSTEMS_VIEW_THRESHOLD = 150;

export function GraphApp(): React.ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);
  const { theme } = useTheme();
  const [state, setState] = useState<AppState>(INITIAL_STATE);
  const [tooltip, setTooltip] = useState<Tooltip | null>(null);
  const initialModeApplied = useRef(false);

  // Inbound messages — `graphReady` handshake replaces the brittle setTimeout
  // that previously caused "Building graph…" to hang on the first open.
  useEffect(() => {
    const dispose = onMessage((msg: MessageToWebview) => {
      if (msg.type === 'graphData') {
        setState((s) => ({ ...s, graphData: msg.data, isLoading: false }));
      } else if (msg.type === 'focusNode') {
        setState((s) => ({ ...s, focusedNode: msg.nodeId }));
      }
    });
    postMessage({ type: 'graphReady' });
    return dispose;
  }, []);

  // Auto-pick a sensible initial mode based on repo size. Only run once so
  // we don't fight the user if they explicitly switch to files view.
  useEffect(() => {
    if (initialModeApplied.current || !state.graphData) return;
    initialModeApplied.current = true;
    const fileCount = state.graphData.nodes.length;
    setState((s) => ({
      ...s,
      viewMode: fileCount > SYSTEMS_VIEW_THRESHOLD ? 'systems' : 'files',
    }));
  }, [state.graphData]);

  // Imperative graph engine.
  const graph = useGraphInstance({
    containerRef,
    graphData: state.graphData,
    selectedSystem: state.selectedSystem,
    layout: state.layout,
    viewMode: state.viewMode,
    theme,
    onNodeTap: (graphNode, screenX, screenY) => {
      const rect = containerRef.current!.getBoundingClientRect();
      setTooltip({
        node: graphNode,
        x: Math.min(Math.max(16, screenX + 16), rect.width - 256),
        y: Math.min(Math.max(16, screenY + 8), rect.height - 240),
      });
      setState((s) => ({ ...s, focusedNode: graphNode.id }));
    },
    onSystemTap: (systemId) => {
      // Drill from system view into file view, scoped to that system.
      setState((s) => ({
        ...s,
        viewMode: 'files',
        selectedSystem: systemId,
      }));
    },
    onBackgroundTap: () => {
      setTooltip(null);
      setState((s) => ({ ...s, focusedNode: null }));
    },
    onNodeOpen: (path) => postMessage({ type: 'openFile', path }),
  });

  // External focus request (e.g. from sidebar).
  useEffect(() => {
    if (state.focusedNode && state.viewMode === 'files') {
      graph.focusNodeNeighbourhood(state.focusedNode);
    }
  }, [state.focusedNode, state.viewMode, graph]);

  const filteredCount = useMemo(() => {
    if (!state.graphData) return 0;
    if (state.viewMode === 'systems') return state.graphData.nodes.length;
    return state.selectedSystem
      ? state.graphData.nodes.filter((n) => n.systemId === state.selectedSystem).length
      : state.graphData.nodes.length;
  }, [state.graphData, state.viewMode, state.selectedSystem]);

  if (state.isLoading || !state.graphData) return <LoadingView />;

  const { graphData } = state;
  const showFilterBar = state.viewMode === 'files';
  const showNoEdgesHint =
    state.viewMode === 'files' && filteredCount > 0 && graphData.edges.length === 0;

  return (
    <div style={S.root}>
      <GraphTopBar
        graphData={graphData}
        filteredCount={filteredCount}
        layout={state.layout}
        onLayoutChange={(l) => setState((s) => ({ ...s, layout: l }))}
        viewModePicker={
          <ViewModePicker
            mode={state.viewMode}
            fileCount={graphData.nodes.length}
            onChange={(viewMode) =>
              setState((s) => ({
                ...s,
                viewMode,
                // Returning to systems view clears any per-system filter.
                selectedSystem: viewMode === 'systems' ? null : s.selectedSystem,
              }))
            }
          />
        }
      />

      {showFilterBar && (
        <SystemFilterBar
          systems={graphData.systems}
          selected={state.selectedSystem}
          onSelect={(id) => setState((s) => ({ ...s, selectedSystem: id }))}
        />
      )}

      <div style={S.graphArea}>
        <div
          ref={containerRef}
          style={S.graphCanvas}
          role="img"
          aria-label="Architecture dependency graph"
        />

        {filteredCount === 0 && (
          <div style={S.emptyOverlay}>
            <p style={S.emptyText}>No files to display</p>
          </div>
        )}

        {showNoEdgesHint && (
          <HintBanner>
            No imports detected between these files. Files are grouped by detected architectural systems.
          </HintBanner>
        )}

        {state.viewMode === 'systems' && (
          <HintBanner>
            Click a system to drill into its files. Switch to <b>Files</b> view for the full graph.
          </HintBanner>
        )}

        <GraphToolbar
          onZoomIn={graph.zoomIn}
          onZoomOut={graph.zoomOut}
          onFitAll={graph.fitAll}
        />

        {state.viewMode === 'files' && <GraphLegend theme={theme} />}

        {tooltip && state.viewMode === 'files' && (
          <NodeTooltip
            node={tooltip.node}
            x={tooltip.x}
            y={tooltip.y}
            onClose={() => {
              setTooltip(null);
              setState((s) => ({ ...s, focusedNode: null }));
            }}
            onOpen={(path) => postMessage({ type: 'openFile', path })}
          />
        )}
      </div>
    </div>
  );
}
