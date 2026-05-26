import React from 'react';
import type { GraphData } from '../../types';
import { GraphIcon, SearchIcon } from '../shared/icons';
import { StatChip, StatDivider } from './StatChip';

interface Props {
  workspaceName: string;
  workspacePath: string;
  graphData: GraphData;
  searchQuery: string;
  onSearch: (query: string) => void;
  onOpenGraph: () => void;
}

export function AppHeader({
  workspaceName,
  workspacePath,
  graphData,
  searchQuery,
  onSearch,
  onOpenGraph,
}: Props): React.ReactElement {
  const issueCount = graphData.circularDeps.length + (graphData.layerViolations?.length ?? 0);

  return (
    <header style={styles.header} role="banner">
      <div style={styles.headerTop}>
        <h1 style={styles.workspaceName} title={workspacePath || workspaceName}>
          {workspaceName}
        </h1>
        <button
          style={styles.graphBtn}
          onClick={onOpenGraph}
          title="Open architecture graph view"
          aria-label="Open architecture graph"
        >
          <GraphIcon size={12} />
          <span>Graph</span>
        </button>
      </div>

      <div style={styles.stats} role="status" aria-label="Repository statistics">
        <StatChip value={graphData.stats.totalFiles} label="files" />
        <StatDivider />
        <StatChip value={graphData.systems.length} label="systems" />
        <StatDivider />
        <StatChip value={graphData.edges.length} label="links" />
        {issueCount > 0 && (
          <>
            <StatDivider />
            <StatChip value={issueCount} label="issues" warn />
          </>
        )}
      </div>

      <SearchInput value={searchQuery} onChange={onSearch} />
    </header>
  );
}

function SearchInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}): React.ReactElement {
  return (
    <div style={styles.searchWrap}>
      <label htmlFor="atlas-search" style={visuallyHidden}>
        Search files and systems
      </label>
      <SearchIcon size={11} style={styles.searchIcon} />
      <input
        id="atlas-search"
        style={styles.searchInput}
        type="search"
        placeholder="Search files, systems…"
        value={value}
        onChange={(e) => onChange((e.target as HTMLInputElement).value)}
        aria-label="Search files and systems"
      />
      {value && (
        <button
          style={styles.searchClear}
          onClick={() => onChange('')}
          aria-label="Clear search"
          title="Clear search"
        >
          ×
        </button>
      )}
    </div>
  );
}

const visuallyHidden: React.CSSProperties = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  overflow: 'hidden',
  clip: 'rect(0,0,0,0)',
};

const styles: Record<string, React.CSSProperties> = {
  header: {
    padding: '12px 12px 0',
    flexShrink: 0,
    borderBottom:
      '1px solid var(--vscode-sideBarSectionHeader-border, var(--vscode-widget-border))',
  },
  headerTop: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '10px',
    gap: '10px',
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
  searchWrap: {
    display: 'flex',
    alignItems: 'center',
    position: 'relative',
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
};
