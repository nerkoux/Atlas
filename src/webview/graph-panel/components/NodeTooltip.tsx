import React from 'react';
import type { GraphNode } from '../../../types';
import { LANG_LABELS } from '../../theme/languageColors';
import { graphStyles as S } from '../styles';

interface Props {
  node: GraphNode;
  x: number;
  y: number;
  onClose: () => void;
  onOpen: (path: string) => void;
}

export function NodeTooltip({ node, x, y, onClose, onOpen }: Props): React.ReactElement {
  const stats: Array<[string, number]> = [
    ['Imports', node.importCount],
    ['Exports', node.exportCount],
    ['Deps', node.dependencyCount],
    ['Used by', node.dependentCount],
  ];

  return (
    <div
      style={{ ...S.tooltip, left: x, top: y }}
      role="dialog"
      aria-label={`Details for ${node.label}`}
    >
      <div style={S.tooltipHead}>
        <span style={{ ...S.tooltipLang, background: node.systemColor }}>
          {LANG_LABELS[node.language] ?? '?'}
        </span>
        <span style={S.tooltipName}>{node.label}</span>
        <button style={S.tooltipClose} onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>

      <p style={S.tooltipPath}>{node.relativePath}</p>

      <div style={S.tooltipStats}>
        {stats.map(([k, v]) => (
          <div key={k} style={S.tooltipStat}>
            <span style={S.tooltipStatVal}>{v}</span>
            <span style={S.tooltipStatKey}>{k}</span>
          </div>
        ))}
      </div>

      {node.isEntryPoint && <p style={S.tooltipBadge}>◆ Entry Point</p>}
      {node.isDeadCode && (
        <p style={{ ...S.tooltipBadge, color: 'var(--vscode-errorForeground, #ef4444)' }}>
          ☠ Unreachable
        </p>
      )}

      <button style={S.tooltipOpenBtn} onClick={() => onOpen(node.path)}>
        Open in Editor
      </button>
    </div>
  );
}
