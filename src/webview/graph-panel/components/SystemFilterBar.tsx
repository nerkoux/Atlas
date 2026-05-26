import React from 'react';
import type { ArchitectureSystem } from '../../../types';
import { withAlpha } from '../../theme/colors';
import { graphStyles as S } from '../styles';

interface Props {
  systems: ArchitectureSystem[];
  selected: string | null;
  onSelect: (id: string | null) => void;
}

export function SystemFilterBar({ systems, selected, onSelect }: Props): React.ReactElement {
  return (
    <div style={S.filterBar} role="toolbar" aria-label="Filter by system">
      <button
        style={{ ...S.filterPill, ...(selected === null ? S.filterPillActive : {}) }}
        onClick={() => onSelect(null)}
        aria-pressed={selected === null}
      >
        All systems
      </button>
      {systems
        .filter((s) => s.files.length > 0)
        .map((sys) => {
          const isActive = selected === sys.id;
          return (
            <button
              key={sys.id}
              style={{
                ...S.filterPill,
                ...(isActive
                  ? {
                      ...S.filterPillActive,
                      borderColor: sys.color,
                      color: sys.color,
                      background: withAlpha(sys.color, 0.12),
                    }
                  : {}),
              }}
              onClick={() => onSelect(isActive ? null : sys.id)}
              aria-pressed={isActive}
              aria-label={`Filter: ${sys.name}`}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: sys.color,
                  display: 'inline-block',
                  flexShrink: 0,
                }}
                aria-hidden="true"
              />
              <span>{sys.name}</span>
              <span style={S.filterPillCount}>{sys.files.length}</span>
            </button>
          );
        })}
    </div>
  );
}
