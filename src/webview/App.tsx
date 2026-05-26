/**
 * Root component of the Atlas activity-bar webview.
 *
 * Owns the top-level message bridge with the extension host and dispatches
 * incoming messages into the {@link appReducer}. All presentation is delegated
 * to focused subcomponents under `components/`.
 */
import React, { useCallback, useEffect, useReducer } from 'react';
import type { MessageToWebview } from '../types';
import { appReducer, INITIAL_APP_STATE } from './appState';
import { AppHeader } from './components/AppHeader';
import { EmptyState } from './components/EmptyState';
import { LoadingScreen } from './components/LoadingScreen';
import { Sidebar } from './components/sidebar/Sidebar';
import { onMessage, postMessage } from './vscode';

export function App(): React.ReactElement {
  const [state, dispatch] = useReducer(appReducer, INITIAL_APP_STATE);

  // Subscribe to messages from the extension host.
  useEffect(() => {
    const dispose = onMessage((message: MessageToWebview) => {
      switch (message.type) {
        case 'graphData':
          dispatch({ type: 'SET_GRAPH', data: message.data });
          break;
        case 'progress':
          dispatch({ type: 'SET_PROGRESS', data: message.data });
          break;
        case 'error':
          dispatch({ type: 'SET_ERROR', message: message.message });
          break;
        case 'workspaceInfo':
          dispatch({
            type: 'SET_WORKSPACE',
            name: message.name,
            path: message.path,
          });
          break;
        case 'focusNode':
          dispatch({ type: 'FOCUS_NODE', nodeId: message.nodeId });
          break;
      }
    });
    postMessage({ type: 'ready' });
    return dispose;
  }, []);

  const handleScan = useCallback(() => {
    dispatch({
      type: 'SET_PROGRESS',
      data: { phase: 'discovering', current: 0, total: 0, message: 'Starting scan...' },
    });
    postMessage({ type: 'scan' });
  }, []);

  const handleOpenFile = useCallback((path: string, line?: number) => {
    postMessage({ type: 'openFile', path, line });
  }, []);

  const handleSelectSystem = useCallback((systemId: string | null) => {
    dispatch({ type: 'SELECT_SYSTEM', systemId });
    if (systemId) postMessage({ type: 'focusSystem', systemId });
  }, []);

  const handleFocusNode = useCallback((nodeId: string) => {
    dispatch({ type: 'FOCUS_NODE', nodeId });
  }, []);

  const handleSearch = useCallback((query: string) => {
    dispatch({ type: 'SET_SEARCH', query });
  }, []);

  const handleOpenGraphPanel = useCallback(() => {
    postMessage({ type: 'focusSystem', systemId: '__open_graph__' });
  }, []);

  // Loading state.
  if (state.isLoading || state.progress) {
    return <LoadingScreen progress={state.progress} workspaceName={state.workspaceName} />;
  }

  // Empty state — no scan data yet.
  if (!state.graphData) {
    return (
      <EmptyState
        workspaceName={state.workspaceName}
        onScan={handleScan}
        error={state.error}
      />
    );
  }

  return (
    <div className="atlas-root" style={styles.root}>
      <AppHeader
        workspaceName={state.workspaceName}
        workspacePath={state.workspacePath}
        graphData={state.graphData}
        searchQuery={state.searchQuery}
        onSearch={handleSearch}
        onOpenGraph={handleOpenGraphPanel}
      />

      <main style={styles.main} role="main">
        <Sidebar
          systems={state.graphData.systems}
          nodes={state.graphData.nodes}
          circularDeps={state.graphData.circularDeps}
          layerViolations={state.graphData.layerViolations}
          deadZones={state.graphData.deadZones}
          explanations={state.graphData.explanations}
          selectedSystem={state.selectedSystem}
          searchQuery={state.searchQuery}
          focusedNode={state.focusedNode}
          onSelectSystem={handleSelectSystem}
          onOpenFile={handleOpenFile}
          onFocusNode={handleFocusNode}
        />
      </main>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    background: 'var(--vscode-sideBar-background)',
    color: 'var(--vscode-foreground)',
    fontFamily: 'var(--vscode-font-family)',
    fontSize: '12px',
    overflow: 'hidden',
  },
  main: {
    flex: 1,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
};
