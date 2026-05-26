import React from 'react';
import type { DeadZone, GraphNode } from '../../../types';
import { LANG_COLORS } from '../../theme/languageColors';
import { sidebarStyles as S } from './styles';

interface Props {
  deadZones: DeadZone[];
  nodeMap: Map<string, GraphNode>;
  onOpenFile: (path: string, line?: number) => void;
}

const FILE_PREVIEW_LIMIT = 5;

export function DeadZonesTab({ deadZones, nodeMap, onOpenFile }: Props): React.ReactElement {
  const totalDeadFiles = deadZones.reduce((sum, z) => sum + z.files.length, 0);

  return (
    <div style={S.scrollArea} role="tabpanel" aria-labelledby="tab-dead">
      {deadZones.map((zone) => (
        <DeadZoneCard key={zone.id} zone={zone} nodeMap={nodeMap} onOpenFile={onOpenFile} />
      ))}

      {totalDeadFiles === 0 && (
        <div style={S.emptyTab} role="status">
          <span aria-hidden="true" style={{ fontSize: '20px', marginBottom: '8px' }}>
            ✓
          </span>
          <span>No dead code detected</span>
        </div>
      )}
    </div>
  );
}

function DeadZoneCard({
  zone,
  nodeMap,
  onOpenFile,
}: {
  zone: DeadZone;
  nodeMap: Map<string, GraphNode>;
  onOpenFile: (path: string, line?: number) => void;
}): React.ReactElement {
  return (
    <section style={S.deadZone} aria-label={`Dead zone: ${zone.name}`}>
      <div style={S.deadZoneHeader}>
        <span style={S.deadZoneIcon} aria-hidden="true">
          ☠
        </span>
        <h3 style={S.deadZoneTitle}>{zone.name}</h3>
        <span style={S.deadZoneCount} aria-label={`${zone.files.length} files`}>
          {zone.files.length}
        </span>
      </div>

      <p style={S.deadZoneReason}>{zone.reason}</p>

      <ul style={S.deadZoneFiles}>
        {zone.files.slice(0, FILE_PREVIEW_LIMIT).map((fid) => {
          const n = nodeMap.get(fid);
          if (!n) return null;
          return (
            <li key={fid} style={S.deadZoneFile}>
              <button
                style={S.deadZoneFileBtn}
                onClick={() => onOpenFile(n.path)}
                title={n.relativePath}
                aria-label={`Open ${n.label}`}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: LANG_COLORS[n.language] ?? '#64748b',
                    flexShrink: 0,
                  }}
                  aria-hidden="true"
                />
                <span style={S.deadZoneFileName}>{n.label}</span>
              </button>
            </li>
          );
        })}
        {zone.files.length > FILE_PREVIEW_LIMIT && (
          <li style={S.deadZoneMore}>+{zone.files.length - FILE_PREVIEW_LIMIT} more files</li>
        )}
      </ul>
    </section>
  );
}
