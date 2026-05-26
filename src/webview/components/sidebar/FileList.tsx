import React from 'react';
import type { GraphNode } from '../../../types';
import { LANG_COLORS } from '../../theme/languageColors';
import { sidebarStyles as S } from './styles';

interface Props {
  nodes: GraphNode[];
  focusedNode: string | null;
  systemColor: string;
  onOpenFile: (path: string, line?: number) => void;
  onFocusNode: (nodeId: string) => void;
}

const VISIBLE_FILE_LIMIT = 50;

export function FileList({
  nodes,
  focusedNode,
  systemColor,
  onOpenFile,
  onFocusNode,
}: Props): React.ReactElement {
  return (
    <ul style={S.fileList} role="list" aria-label="Files in system">
      {nodes.slice(0, VISIBLE_FILE_LIMIT).map((node) => (
        <li key={node.id}>
          <FileRow
            node={node}
            focused={focusedNode === node.id}
            systemColor={systemColor}
            onOpen={() => {
              onFocusNode(node.id);
              onOpenFile(node.path);
            }}
          />
        </li>
      ))}
      {nodes.length > VISIBLE_FILE_LIMIT && (
        <li style={S.moreFiles}>+{nodes.length - VISIBLE_FILE_LIMIT} more files</li>
      )}
    </ul>
  );
}

function FileRow({
  node,
  focused,
  systemColor,
  onOpen,
}: {
  node: GraphNode;
  focused: boolean;
  systemColor: string;
  onOpen: () => void;
}): React.ReactElement {
  const ariaLabel = [
    node.label,
    node.isEntryPoint ? '(entry point)' : '',
    node.isDeadCode ? '(unreachable)' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      style={{
        ...S.fileItem,
        ...(focused ? { ...S.fileItemFocused, borderLeftColor: systemColor } : {}),
      }}
      onClick={onOpen}
      title={node.relativePath}
      aria-label={ariaLabel}
      aria-current={focused ? 'true' : undefined}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: LANG_COLORS[node.language] ?? '#64748b',
          flexShrink: 0,
        }}
        aria-hidden="true"
      />
      <span style={{ ...S.fileName, ...(node.isDeadCode ? S.fileNameDead : {}) }}>
        {node.isEntryPoint && (
          <span style={S.entryMark} aria-hidden="true">
            ◆
          </span>
        )}
        {node.label}
      </span>
      <span style={S.fileMetrics}>
        {node.isDeadCode && (
          <span style={S.deadMark} aria-label="Unreachable">
            ☠
          </span>
        )}
        {node.dependentCount > 0 && (
          <span style={S.depCount} aria-label={`${node.dependentCount} dependents`}>
            {node.dependentCount}
          </span>
        )}
      </span>
    </button>
  );
}
