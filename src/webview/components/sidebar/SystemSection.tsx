import React, { useMemo } from 'react';
import type { ArchitectureSystem, GraphNode, SystemExplanation } from '../../../types';
import { ExplanationPanel } from './ExplanationPanel';
import { FileList } from './FileList';
import { sidebarStyles as S } from './styles';

interface Props {
  system: ArchitectureSystem;
  nodeMap: Map<string, GraphNode>;
  isSelected: boolean;
  isExpanded: boolean;
  isExplaining: boolean;
  explanation?: SystemExplanation;
  focusedNode: string | null;
  searchQuery: string;
  onToggle: () => void;
  onSelect: () => void;
  onExplain: () => void;
  onOpenFile: (path: string, line?: number) => void;
  onFocusNode: (nodeId: string) => void;
}

export function SystemSection({
  system,
  nodeMap,
  isSelected,
  isExpanded,
  isExplaining,
  explanation,
  focusedNode,
  searchQuery,
  onToggle,
  onSelect,
  onExplain,
  onOpenFile,
  onFocusNode,
}: Props): React.ReactElement {
  const systemNodes = useMemo(
    () =>
      system.files
        .map((fid) => nodeMap.get(fid))
        .filter((n): n is GraphNode => Boolean(n))
        .sort((a, b) => {
          if (a.isEntryPoint !== b.isEntryPoint) return a.isEntryPoint ? -1 : 1;
          return b.dependentCount - a.dependentCount;
        }),
    [system.files, nodeMap]
  );

  const displayNodes = useMemo(() => {
    if (!searchQuery) return systemNodes;
    const q = searchQuery.toLowerCase();
    return systemNodes.filter(
      (n) =>
        n.label.toLowerCase().includes(q) || n.relativePath.toLowerCase().includes(q)
    );
  }, [systemNodes, searchQuery]);

  return (
    <section
      style={{
        ...S.systemSection,
        borderLeftColor: isSelected ? system.color : 'transparent',
      }}
      aria-label={`${system.name} system`}
    >
      <button
        style={S.systemHeader}
        onClick={() => {
          onToggle();
          onSelect();
        }}
        aria-expanded={isExpanded}
        aria-label={`${system.name} — ${system.files.length} files`}
      >
        <div style={S.systemHeaderLeft}>
          <span style={S.chevron} aria-hidden="true">
            {isExpanded ? '▾' : '▸'}
          </span>
          <span style={{ ...S.systemDot, background: system.color }} aria-hidden="true" />
          <span style={S.systemName}>{system.name.toUpperCase()}</span>
        </div>
        <div style={S.systemHeaderRight}>
          {system.metrics.hasCircularDeps && (
            <span
              style={S.circBadge}
              title="Has circular dependencies"
              aria-label="Has circular dependencies"
            >
              ↺
            </span>
          )}
          <span style={S.systemCount}>{system.files.length}</span>
        </div>
      </button>

      {isExpanded && (
        <>
          <button
            style={{ ...S.explainBtn, ...(isExplaining ? S.explainBtnActive : {}) }}
            onClick={(e) => {
              e.stopPropagation();
              onExplain();
            }}
            aria-expanded={isExplaining}
            aria-label={`Explain ${system.name} system`}
          >
            <span aria-hidden="true" style={{ fontSize: '9px' }}>
              ◉
            </span>
            <span>Explain this system</span>
          </button>

          {isExplaining && explanation && <ExplanationPanel explanation={explanation} />}

          <FileList
            nodes={displayNodes}
            focusedNode={focusedNode}
            systemColor={system.color}
            onOpenFile={onOpenFile}
            onFocusNode={onFocusNode}
          />
        </>
      )}
    </section>
  );
}
