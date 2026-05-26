/**
 * Hook that owns the lifecycle of the underlying Cytoscape instance.
 *
 * The host component supplies graph data, layout choice, theme, and a few
 * event callbacks. The hook is responsible for:
 *  - constructing / destroying the Cytoscape instance,
 *  - re-styling on theme change,
 *  - re-running the layout when the layout choice changes,
 *  - re-building elements when data, view mode, or system filter changes,
 *  - exposing imperative helpers (`fit`, `zoom`, `highlightNode`).
 */
import { useCallback, useEffect, useRef } from 'react';
import type { GraphData, GraphNode } from '../../../types';
import type { ThemeColors } from '../../theme/colors';
import { buildElements, filterBySystem } from '../cytoscape/elements';
import { LayoutName, runLayout } from '../cytoscape/layout';
import { getCyStyle } from '../cytoscape/style';
import { buildSystemElements } from '../cytoscape/systemView';
import type { ViewMode } from '../components/ViewModePicker';

declare const cytoscape: any;
declare const cytoscapeDagre: any;
declare const cytoscapeCoseBilkent: any;

// Register cytoscape extensions once per page load.
if (typeof cytoscape !== 'undefined') {
  try {
    const dagreExt =
      typeof cytoscapeDagre !== 'undefined'
        ? cytoscapeDagre
        : typeof window !== 'undefined'
          ? (window as any).cytoscapeDagre
          : undefined;
    if (dagreExt && typeof dagreExt === 'function') cytoscape.use(dagreExt);
  } catch {
    // Already registered or not available — fallback handled in runLayout().
  }
  try {
    const bilkentExt =
      typeof cytoscapeCoseBilkent !== 'undefined'
        ? cytoscapeCoseBilkent
        : typeof window !== 'undefined'
          ? (window as any).cytoscapeCoseBilkent
          : undefined;
    if (bilkentExt && typeof bilkentExt === 'function') cytoscape.use(bilkentExt);
  } catch {
    // Already registered or not available — fallback handled in runLayout().
  }
}

export interface UseGraphInstanceParams {
  containerRef: React.RefObject<HTMLDivElement>;
  graphData: GraphData | null;
  selectedSystem: string | null;
  layout: LayoutName;
  viewMode: ViewMode;
  theme: ThemeColors;

  onNodeTap: (node: GraphNode, screenX: number, screenY: number) => void;
  onSystemTap: (systemId: string) => void;
  onBackgroundTap: () => void;
  onNodeOpen: (path: string) => void;
}

export interface GraphInstanceApi {
  fitAll: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  highlightNode: (nodeId: string) => void;
  focusNodeNeighbourhood: (nodeId: string) => void;
}

export function useGraphInstance(params: UseGraphInstanceParams): GraphInstanceApi {
  const { containerRef, graphData, selectedSystem, layout, viewMode, theme } = params;
  const cyRef = useRef<any>(null);

  // Keep callbacks in refs so we don't tear down/re-build the graph on every render.
  const callbacksRef = useRef(params);
  callbacksRef.current = params;

  // Build / rebuild graph when data, mode, filter, or theme changes.
  useEffect(() => {
    if (!graphData || !containerRef.current || typeof cytoscape === 'undefined') return;

    if (cyRef.current) {
      cyRef.current.destroy();
      cyRef.current = null;
    }

    // System view ignores per-file filter (it's already aggregated).
    const filtered = viewMode === 'systems' ? graphData : filterBySystem(graphData, selectedSystem);
    const fileCount = filtered.nodes.length;

    const elements =
      viewMode === 'systems'
        ? buildSystemElements(filtered)
        : buildElements({ data: filtered });

    const elementCount = (elements as unknown[]).length;
    const isLargeGraph = elementCount > 800;

    const cy = cytoscape({
      container: containerRef.current,
      elements,
      style: getCyStyle({ theme, mode: viewMode, fileCount }),
      layout: { name: 'preset' },
      wheelSensitivity: 0.2,
      minZoom: 0.05,
      maxZoom: 4,
      boxSelectionEnabled: false,
      pixelRatio: isLargeGraph ? 1 : 'auto',
      textureOnViewport: true,
      hideEdgesOnViewport: isLargeGraph,
      hideLabelsOnViewport: isLargeGraph,
      motionBlur: false,
    });

    if (viewMode === 'systems') {
      bindSystemEvents(cy, callbacksRef);
    } else {
      bindFileEvents(cy, filtered.nodes, callbacksRef, containerRef);
    }

    cyRef.current = cy;

    // Layout cost scales with element count — pass it through so adaptive
    // tuning can lower iteration counts for big graphs.
    runLayout(cy, layout, elementCount);

    return () => {
      cyRef.current?.destroy();
      cyRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graphData, selectedSystem, viewMode, theme]);

  // Re-run layout when only the layout choice changes.
  useEffect(() => {
    if (!cyRef.current) return;
    runLayout(cyRef.current, layout, cyRef.current.elements().length);
  }, [layout]);

  const fitAll = useCallback(() => {
    cyRef.current?.animate({ fit: { padding: 60 } }, { duration: 400 });
  }, []);

  const zoomIn = useCallback(() => {
    if (!cyRef.current || !containerRef.current) return;
    const center = {
      x: containerRef.current.clientWidth / 2,
      y: containerRef.current.clientHeight / 2,
    };
    cyRef.current.animate(
      { zoom: { level: cyRef.current.zoom() * 1.4, renderedPosition: center } },
      { duration: 250 }
    );
  }, [containerRef]);

  const zoomOut = useCallback(() => {
    if (!cyRef.current || !containerRef.current) return;
    const center = {
      x: containerRef.current.clientWidth / 2,
      y: containerRef.current.clientHeight / 2,
    };
    cyRef.current.animate(
      { zoom: { level: cyRef.current.zoom() / 1.4, renderedPosition: center } },
      { duration: 250 }
    );
  }, [containerRef]);

  const highlightNode = useCallback((nodeId: string) => {
    if (!cyRef.current) return;
    const cy = cyRef.current;
    const node = cy.$(`#${CSS.escape(nodeId)}`);
    if (!node.length) return;
    cy.nodes('[!isSystem]').removeClass('highlighted selected').addClass('dimmed');
    cy.edges().removeClass('highlighted').addClass('dimmed');
    node.removeClass('dimmed').addClass('highlighted selected');
    node.connectedEdges().removeClass('dimmed').addClass('highlighted');
    node.connectedEdges().connectedNodes().removeClass('dimmed').addClass('highlighted');
  }, []);

  const focusNodeNeighbourhood = useCallback(
    (nodeId: string) => {
      if (!cyRef.current) return;
      const node = cyRef.current.$(`#${CSS.escape(nodeId)}`);
      if (!node.length) return;
      cyRef.current.animate(
        { fit: { eles: node.neighborhood().add(node), padding: 100 } },
        { duration: 500 }
      );
      highlightNode(nodeId);
    },
    [highlightNode]
  );

  return { fitAll, zoomIn, zoomOut, highlightNode, focusNodeNeighbourhood };
}

// ─── Event binding ────────────────────────────────────────────────────────────

function bindFileEvents(
  cy: any,
  nodes: GraphNode[],
  callbacksRef: React.MutableRefObject<UseGraphInstanceParams>,
  containerRef: React.RefObject<HTMLDivElement>
): void {
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

  cy.on('tap', 'node[!isSystem]', (evt: any) => {
    const id = evt.target.data('id');
    const graphNode = nodes.find((n) => n.id === id);
    if (!graphNode) return;
    const pos = evt.target.renderedPosition();
    callbacksRef.current.onNodeTap(graphNode, pos.x, pos.y);
  });

  cy.on('tap', (evt: any) => {
    if (evt.target === cy) callbacksRef.current.onBackgroundTap();
  });

  cy.on('dbltap', 'node[!isSystem]', (evt: any) => {
    const p = evt.target.data('path');
    if (p) callbacksRef.current.onNodeOpen(p);
  });

  cy.on('cxttap', 'node[!isSystem]', (evt: any) => {
    const p = evt.target.data('path');
    if (p) callbacksRef.current.onNodeOpen(p);
  });
}

function bindSystemEvents(cy: any, callbacksRef: React.MutableRefObject<UseGraphInstanceParams>): void {
  cy.on('mouseover', 'node', (evt: any) => evt.target.addClass('hovered'));
  cy.on('mouseout', 'node', (evt: any) => evt.target.removeClass('hovered'));

  cy.on('tap', 'node', (evt: any) => {
    const sysId = evt.target.data('id');
    if (sysId) callbacksRef.current.onSystemTap(sysId);
  });

  cy.on('tap', (evt: any) => {
    if (evt.target === cy) callbacksRef.current.onBackgroundTap();
  });
}
