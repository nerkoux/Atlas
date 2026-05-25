import React, { useEffect, useReducer, useCallback } from 'react';
import { GraphData, ScanProgress, MessageToWebview } from '../types';
import { postMessage, onMessage } from './vscode';
import { Sidebar } from './components/Sidebar';
import { LoadingScreen } from './components/LoadingScreen';
import { Logo } from './components/Logo';

// ─── State ────────────────────────────────────────────────────────────────────

interface AppState {
  graphData: GraphData | null;
  progress: ScanProgress | null;
  selectedSystem: string | null;
  focusedNode: string | null;
  error: string | null;
  workspaceName: string;
  workspacePath: string;
  isLoading: boolean;
  searchQuery: string;
}

type Action =
  | { type: 'SET_GRAPH'; data: GraphData }
  | { type: 'SET_PROGRESS'; data: ScanProgress }
  | { type: 'SET_ERROR'; message: string }
  | { type: 'SET_WORKSPACE'; name: string; path: string }
  | { type: 'SELECT_SYSTEM'; systemId: string | null }
  | { type: 'FOCUS_NODE'; nodeId: string }
  | { type: 'SET_SEARCH'; query: string };

const initialState: AppState = {
  graphData: null,
  progress: null,
  selectedSystem: null,
  focusedNode: null,
  error: null,
  workspaceName: 'Workspace',
  workspacePath: '',
  isLoading: false,
  searchQuery: '',
};

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_GRAPH':
      return { ...state, graphData: action.data, progress: null, isLoading: false, error: null };
    case 'SET_PROGRESS':
      return { ...state, progress: action.data, isLoading: action.data.phase !== 'complete' && action.data.phase !== 'error' };
    case 'SET_ERROR':
      return { ...state, error: action.message, isLoading: false, progress: null };
    case 'SET_WORKSPACE':
      return { ...state, workspaceName: action.name, workspacePath: action.path };
    case 'SELECT_SYSTEM':
      return { ...state, selectedSystem: action.systemId };
    case 'FOCUS_NODE':
      return { ...state, focusedNode: action.nodeId };
    case 'SET_SEARCH':
      return { ...state, searchQuery: action.query };
    default:
      return state;
  }
}

// ─── App ──────────────────────────────────────────────────────────────────────

export function App(): React.ReactElement {
  const [state, dispatch] = useReducer(reducer, initialState);

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
          dispatch({ type: 'SET_WORKSPACE', name: message.name, path: message.path });
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
    dispatch({ type: 'SET_PROGRESS', data: { phase: 'discovering', current: 0, total: 0, message: 'Starting scan...' } });
    postMessage({ type: 'scan' });
  }, []);

  const handleOpenFile = useCallback((filePath: string, line?: number) => {
    postMessage({ type: 'openFile', path: filePath, line });
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

  // Loading state
  if (state.isLoading || state.progress) {
    return <LoadingScreen progress={state.progress} workspaceName={state.workspaceName} />;
  }

  // Empty state — no data yet
  if (!state.graphData) {
    return <EmptyState workspaceName={state.workspaceName} onScan={handleScan} error={state.error} />;
  }

  const { graphData } = state;

  return (
    <div className="atlas-root" style={styles.root}>
      {/* Header */}
      <header style={styles.header} role="banner">
        <div style={styles.headerTop}>
          <h1 style={styles.workspaceName} title={state.workspacePath || state.workspaceName}>
            {state.workspaceName}
          </h1>
          <button
            style={styles.graphBtn}
            onClick={() => postMessage({ type: 'focusSystem', systemId: '__open_graph__' })}
            title="Open architecture graph view"
            aria-label="Open architecture graph"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="3" /><circle cx="4" cy="6" r="2" /><circle cx="20" cy="6" r="2" />
              <circle cx="4" cy="18" r="2" /><circle cx="20" cy="18" r="2" />
              <line x1="6" y1="7" x2="10" y2="11" /><line x1="18" y1="7" x2="14" y2="11" />
              <line x1="6" y1="17" x2="10" y2="13" /><line x1="18" y1="17" x2="14" y2="13" />
            </svg>
            <span>Graph</span>
          </button>
        </div>

        {/* Stats */}
        <div style={styles.stats} role="status" aria-label="Repository statistics">
          <StatChip value={graphData.stats.totalFiles} label="files" />
          <StatDivider />
          <StatChip value={graphData.systems.length} label="systems" />
          <StatDivider />
          <StatChip value={graphData.edges.length} label="links" />
          {graphData.circularDeps.length > 0 && (
            <>
              <StatDivider />
              <StatChip value={graphData.circularDeps.length} label="issues" warn />
            </>
          )}
        </div>

        {/* Search */}
        <div style={styles.searchWrap}>
          <label htmlFor="atlas-search" className="sr-only" style={{ position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', clip: 'rect(0,0,0,0)' }}>
            Search files and systems
          </label>
          <svg style={styles.searchIcon} width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            id="atlas-search"
            style={styles.searchInput}
            type="search"
            placeholder="Search files, systems…"
            value={state.searchQuery}
            onChange={(e) => handleSearch((e.target as HTMLInputElement).value)}
            aria-label="Search files and systems"
          />
          {state.searchQuery && (
            <button
              style={styles.searchClear}
              onClick={() => handleSearch('')}
              aria-label="Clear search"
              title="Clear search"
            >
              ×
            </button>
          )}
        </div>
      </header>

      {/* Main content */}
      <main style={styles.main} role="main">
        <Sidebar
          systems={graphData.systems}
          nodes={graphData.nodes}
          circularDeps={graphData.circularDeps}
          layerViolations={graphData.layerViolations}
          deadZones={graphData.deadZones}
          explanations={graphData.explanations}
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

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatChip({ value, label, warn }: { value: number; label: string; warn?: boolean }): React.ReactElement {
  return (
    <div style={styles.stat} aria-label={`${value} ${label}`}>
      <span style={{ ...styles.statValue, ...(warn ? styles.statValueWarn : {}) }}>{value}</span>
      <span style={styles.statLabel}>{label}</span>
    </div>
  );
}

function StatDivider(): React.ReactElement {
  return <div style={styles.statDivider} aria-hidden="true" />;
}

function EmptyState({ workspaceName, onScan, error }: {
  workspaceName: string;
  onScan: () => void;
  error: string | null;
}): React.ReactElement {
  const noFolder = workspaceName === 'Workspace';

  return (
    <div style={styles.empty} role="main" aria-label="Atlas welcome screen">
      <div style={styles.emptyIcon}>
        <Logo size={96} alt="Atlas logo" />
      </div>
      <h1 style={styles.emptyTitle}>Atlas</h1>
      <p style={styles.emptyDesc}>
        {error ? error : noFolder ? 'Open a folder to begin' : 'Ready to analyze your architecture'}
      </p>
      {!noFolder && !error && (
        <button style={styles.emptyBtn} onClick={onScan} aria-label="Scan workspace to analyze architecture">
          Scan Workspace
        </button>
      )}
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

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
  header: {
    padding: '12px 12px 0',
    flexShrink: 0,
    borderBottom: '1px solid var(--vscode-sideBarSectionHeader-border, var(--vscode-widget-border))',
  },
  headerTop: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '10px',
  },
  brand: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  workspaceName: {
    fontSize: '13px',
    fontWeight: 700,
    color: 'var(--vscode-foreground)',
    letterSpacing: '0.2px',
    margin: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    flex: 1,
    minWidth: 0,
  },
  logo: {
    fontSize: '20px',
    color: 'var(--vscode-focusBorder)',
    lineHeight: 1,
  },
  title: {
    fontSize: '13px',
    fontWeight: 700,
    color: 'var(--vscode-foreground)',
    letterSpacing: '0.3px',
    lineHeight: 1.2,
    margin: 0,
  },
  subtitle: {
    fontSize: '10px',
    color: 'var(--vscode-descriptionForeground)',
    lineHeight: 1.2,
    margin: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    maxWidth: '130px',
  },
  graphBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    padding: '4px 10px',
    background: 'var(--vscode-button-secondaryBackground)',
    color: 'var(--vscode-button-secondaryForeground)',
    border: '1px solid var(--vscode-button-border, transparent)',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '11px',
    fontWeight: 500,
    flexShrink: 0,
  },
  stats: {
    display: 'flex',
    alignItems: 'center',
    marginBottom: '10px',
  },
  stat: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '0 8px',
    minWidth: '36px',
  },
  statValue: {
    fontSize: '16px',
    fontWeight: 700,
    color: 'var(--vscode-foreground)',
    lineHeight: 1,
  },
  statValueWarn: {
    color: '#f59e0b',
  },
  statLabel: {
    fontSize: '9px',
    color: 'var(--vscode-descriptionForeground)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.4px',
    marginTop: '1px',
  },
  statDivider: {
    width: '1px',
    height: '20px',
    background: 'var(--vscode-widget-border)',
  },
  searchWrap: {
    display: 'flex',
    alignItems: 'center',
    position: 'relative' as const,
    background: 'var(--vscode-input-background)',
    border: '1px solid var(--vscode-input-border, transparent)',
    borderRadius: '4px',
    padding: '0 8px',
    gap: '6px',
    marginBottom: '8px',
  },
  searchIcon: {
    color: 'var(--vscode-input-placeholderForeground)',
    flexShrink: 0,
  },
  searchInput: {
    flex: 1,
    background: 'none',
    border: 'none',
    outline: 'none',
    fontSize: '11px',
    color: 'var(--vscode-input-foreground)',
    padding: '5px 0',
    fontFamily: 'var(--vscode-font-family)',
  },
  searchClear: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: 'var(--vscode-descriptionForeground)',
    fontSize: '14px',
    lineHeight: 1,
    padding: '2px',
  },
  main: {
    flex: 1,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  empty: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
    padding: '24px',
    textAlign: 'center' as const,
    gap: '10px',
  },
  emptyIcon: {
    color: 'var(--vscode-descriptionForeground)',
    marginBottom: '4px',
  },
  emptyTitle: {
    fontSize: '15px',
    fontWeight: 700,
    color: 'var(--vscode-foreground)',
    letterSpacing: '0.3px',
    margin: 0,
  },
  emptyDesc: {
    fontSize: '11px',
    color: 'var(--vscode-descriptionForeground)',
    lineHeight: 1.5,
    maxWidth: '200px',
    margin: 0,
  },
  emptyBtn: {
    marginTop: '6px',
    background: 'var(--vscode-button-background)',
    color: 'var(--vscode-button-foreground)',
    border: 'none',
    borderRadius: '4px',
    padding: '7px 16px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 500,
  },
};
