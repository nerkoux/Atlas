import React, { useState, useMemo, useCallback } from 'react';
import {
  ArchitectureSystem, GraphNode, CircularDependency,
  LayerViolation, DeadZone, SystemExplanation,
} from '../../types';

// ─── Types ────────────────────────────────────────────────────────────────────

type SidebarTab = 'systems' | 'violations' | 'dead';

interface Props {
  systems: ArchitectureSystem[];
  nodes: GraphNode[];
  circularDeps: CircularDependency[];
  layerViolations?: LayerViolation[];
  deadZones?: DeadZone[];
  explanations?: Record<string, SystemExplanation>;
  selectedSystem: string | null;
  searchQuery: string;
  focusedNode: string | null;
  onSelectSystem: (systemId: string | null) => void;
  onOpenFile: (path: string, line?: number) => void;
  onFocusNode: (nodeId: string) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const LANG_COLORS: Record<string, string> = {
  typescript: '#3178c6',
  javascript: '#f7df1e',
  python: '#3572a5',
  go: '#00add8',
  rust: '#dea584',
  java: '#b07219',
  csharp: '#178600',
  unknown: '#64748b',
};

function severityColor(s: string): string {
  if (s === 'high') return '#ef4444';
  if (s === 'medium') return '#f59e0b';
  return '#94a3b8';
}

function shortenPath(p: string): string {
  const parts = p.split('/');
  return parts[parts.length - 1] ?? p;
}

// ─── Main Sidebar Component ───────────────────────────────────────────────────

export function Sidebar({
  systems,
  nodes,
  circularDeps,
  layerViolations = [],
  deadZones = [],
  explanations = {},
  selectedSystem,
  searchQuery,
  focusedNode,
  onSelectSystem,
  onOpenFile,
  onFocusNode,
}: Props): React.ReactElement {
  const [tab, setTab] = useState<SidebarTab>('systems');
  const [expandedSystems, setExpandedSystems] = useState<Set<string>>(
    () => new Set(systems.filter(s => s.files.length > 0).slice(0, 4).map(s => s.id))
  );
  const [explainSystem, setExplainSystem] = useState<string | null>(null);

  const nodeMap = useMemo(() => {
    const m = new Map<string, GraphNode>();
    for (const n of nodes) m.set(n.id, n);
    return m;
  }, [nodes]);

  const filteredSystems = useMemo(() => {
    if (!searchQuery) return systems.filter(s => s.files.length > 0);
    const q = searchQuery.toLowerCase();
    return systems
      .map(sys => ({
        ...sys,
        files: sys.files.filter(fid => {
          const node = nodeMap.get(fid);
          return node && (
            node.label.toLowerCase().includes(q) ||
            node.relativePath.toLowerCase().includes(q)
          );
        }),
      }))
      .filter(sys => sys.files.length > 0 || sys.name.toLowerCase().includes(q));
  }, [systems, searchQuery, nodeMap]);

  const toggleSystem = useCallback((systemId: string) => {
    setExpandedSystems(prev => {
      const next = new Set(prev);
      if (next.has(systemId)) next.delete(systemId);
      else next.add(systemId);
      return next;
    });
  }, []);

  const totalDeadFiles = deadZones.reduce((s, z) => s + z.files.length, 0);

  return (
    <div style={S.container} role="navigation" aria-label="Architecture explorer">
      {/* Tab bar */}
      <div style={S.tabBar} role="tablist" aria-label="Explorer sections">
        <TabBtn id="systems" active={tab === 'systems'} onClick={() => setTab('systems')}>
          Systems
        </TabBtn>
        <TabBtn id="violations" active={tab === 'violations'} onClick={() => setTab('violations')} badge={layerViolations.length + circularDeps.length}>
          Issues
        </TabBtn>
        <TabBtn id="dead" active={tab === 'dead'} onClick={() => setTab('dead')} badge={totalDeadFiles}>
          Dead
        </TabBtn>
      </div>

      {/* Systems tab */}
      {tab === 'systems' && (
        <div style={S.scrollArea} role="tabpanel" aria-labelledby="tab-systems">
          {filteredSystems.map(system => (
            <SystemSection
              key={system.id}
              system={system}
              nodeMap={nodeMap}
              isSelected={selectedSystem === system.id}
              isExpanded={expandedSystems.has(system.id)}
              isExplaining={explainSystem === system.id}
              explanation={explanations[system.id]}
              focusedNode={focusedNode}
              searchQuery={searchQuery}
              onToggle={() => toggleSystem(system.id)}
              onSelect={() => onSelectSystem(selectedSystem === system.id ? null : system.id)}
              onExplain={() => setExplainSystem(prev => prev === system.id ? null : system.id)}
              onOpenFile={onOpenFile}
              onFocusNode={onFocusNode}
            />
          ))}
          {filteredSystems.length === 0 && (
            <div style={S.emptyTab} role="status">No systems match your search</div>
          )}
        </div>
      )}

      {/* Violations tab */}
      {tab === 'violations' && (
        <div style={S.scrollArea} role="tabpanel" aria-labelledby="tab-violations">
          {circularDeps.length > 0 && (
            <section style={S.violationGroup} aria-label="Circular dependencies">
              <h3 style={S.violationGroupHeader}>
                <span aria-hidden="true" style={{ color: '#f59e0b' }}>↺</span>
                <span>Circular Dependencies ({circularDeps.length})</span>
              </h3>
              {circularDeps.slice(0, 8).map((cd, i) => (
                <div key={i} style={S.violationCard}>
                  <span style={{ ...S.severityDot, background: severityColor(cd.severity) }} aria-hidden="true" />
                  <div style={S.violationContent}>
                    <p style={S.violationDesc}>{cd.cycle.map(shortenPath).join(' → ')}</p>
                    <p style={S.violationMeta}>{cd.cycle.length} files · {cd.severity} severity</p>
                  </div>
                </div>
              ))}
            </section>
          )}
          {layerViolations.length > 0 && (
            <section style={S.violationGroup} aria-label="Layer violations">
              <h3 style={S.violationGroupHeader}>
                <span aria-hidden="true" style={{ color: '#ef4444' }}>⛔</span>
                <span>Layer Violations ({layerViolations.length})</span>
              </h3>
              {layerViolations.map((v, i) => (
                <div key={i} style={S.violationCard}>
                  <span style={{ ...S.severityDot, background: severityColor(v.severity) }} aria-hidden="true" />
                  <div style={S.violationContent}>
                    <p style={S.violationDesc}>{v.description}</p>
                    <div style={S.violationFiles}>
                      <button style={S.violationFile} onClick={() => onOpenFile(v.fromFile)} title={v.fromFile}>
                        {shortenPath(v.fromFile)}
                      </button>
                      <span style={S.violationArrow} aria-hidden="true">→</span>
                      <button style={S.violationFile} onClick={() => onOpenFile(v.toFile)} title={v.toFile}>
                        {shortenPath(v.toFile)}
                      </button>
                    </div>
                    <p style={S.violationMeta}>{v.fromLayer} → {v.toLayer}</p>
                  </div>
                </div>
              ))}
            </section>
          )}
          {layerViolations.length === 0 && circularDeps.length === 0 && (
            <div style={S.emptyTab} role="status">
              <span aria-hidden="true" style={{ fontSize: '20px', marginBottom: '8px' }}>✓</span>
              <span>No architectural violations detected</span>
            </div>
          )}
        </div>
      )}

      {/* Dead zones tab */}
      {tab === 'dead' && (
        <div style={S.scrollArea} role="tabpanel" aria-labelledby="tab-dead">
          {deadZones.map(zone => (
            <section key={zone.id} style={S.deadZone} aria-label={`Dead zone: ${zone.name}`}>
              <div style={S.deadZoneHeader}>
                <span style={S.deadZoneIcon} aria-hidden="true">☠</span>
                <h3 style={S.deadZoneTitle}>{zone.name}</h3>
                <span style={S.deadZoneCount} aria-label={`${zone.files.length} files`}>{zone.files.length}</span>
              </div>
              <p style={S.deadZoneReason}>{zone.reason}</p>
              <ul style={S.deadZoneFiles}>
                {zone.files.slice(0, 5).map(fid => {
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
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: LANG_COLORS[n.language] ?? '#64748b', flexShrink: 0 }} aria-hidden="true" />
                        <span style={S.deadZoneFileName}>{n.label}</span>
                      </button>
                    </li>
                  );
                })}
                {zone.files.length > 5 && (
                  <li style={S.deadZoneMore}>+{zone.files.length - 5} more files</li>
                )}
              </ul>
            </section>
          ))}
          {totalDeadFiles === 0 && (
            <div style={S.emptyTab} role="status">
              <span aria-hidden="true" style={{ fontSize: '20px', marginBottom: '8px' }}>✓</span>
              <span>No dead code detected</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Tab Button ───────────────────────────────────────────────────────────────

function TabBtn({ id, active, onClick, children, badge }: {
  id: string;
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  badge?: number;
}): React.ReactElement {
  return (
    <button
      id={`tab-${id}`}
      role="tab"
      aria-selected={active}
      aria-controls={`panel-${id}`}
      style={{ ...S.tabBtn, ...(active ? S.tabBtnActive : {}) }}
      onClick={onClick}
      tabIndex={active ? 0 : -1}
    >
      {children}
      {badge !== undefined && badge > 0 && (
        <span style={S.tabBadge} aria-label={`${badge} items`}>{badge}</span>
      )}
    </button>
  );
}

// ─── System Section ───────────────────────────────────────────────────────────

function SystemSection({
  system, nodeMap, isSelected, isExpanded, isExplaining, explanation,
  focusedNode, searchQuery, onToggle, onSelect, onExplain, onOpenFile, onFocusNode,
}: {
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
}): React.ReactElement {
  const systemNodes = useMemo(() =>
    system.files
      .map(fid => nodeMap.get(fid))
      .filter((n): n is GraphNode => !!n)
      .sort((a, b) => {
        if (a.isEntryPoint !== b.isEntryPoint) return a.isEntryPoint ? -1 : 1;
        return b.dependentCount - a.dependentCount;
      }),
    [system.files, nodeMap]
  );

  const displayNodes = useMemo(() => {
    if (!searchQuery) return systemNodes;
    const q = searchQuery.toLowerCase();
    return systemNodes.filter(n =>
      n.label.toLowerCase().includes(q) || n.relativePath.toLowerCase().includes(q)
    );
  }, [systemNodes, searchQuery]);

  return (
    <section
      style={{ ...S.systemSection, borderLeftColor: isSelected ? system.color : 'transparent' }}
      aria-label={`${system.name} system`}
    >
      <button
        style={S.systemHeader}
        onClick={() => { onToggle(); onSelect(); }}
        aria-expanded={isExpanded}
        aria-label={`${system.name} — ${system.files.length} files`}
      >
        <div style={S.systemHeaderLeft}>
          <span style={S.chevron} aria-hidden="true">{isExpanded ? '▾' : '▸'}</span>
          <span style={{ ...S.systemDot, background: system.color }} aria-hidden="true" />
          <span style={S.systemName}>{system.name.toUpperCase()}</span>
        </div>
        <div style={S.systemHeaderRight}>
          {system.metrics.hasCircularDeps && (
            <span style={S.circBadge} title="Has circular dependencies" aria-label="Has circular dependencies">↺</span>
          )}
          <span style={S.systemCount}>{system.files.length}</span>
        </div>
      </button>

      {isExpanded && (
        <>
          <button
            style={{ ...S.explainBtn, ...(isExplaining ? S.explainBtnActive : {}) }}
            onClick={(e) => { e.stopPropagation(); onExplain(); }}
            aria-expanded={isExplaining}
            aria-label={`Explain ${system.name} system`}
          >
            <span aria-hidden="true" style={{ fontSize: '9px' }}>◉</span>
            <span>Explain this system</span>
          </button>

          {isExplaining && explanation && (
            <ExplanationPanel explanation={explanation} />
          )}

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

// ─── Explanation Panel ────────────────────────────────────────────────────────

function ExplanationPanel({ explanation }: { explanation: SystemExplanation }): React.ReactElement {
  return (
    <div style={S.explainPanel} role="region" aria-label="System explanation">
      <p style={S.explainSummary}>{explanation.summary}</p>
      {explanation.responsibilities.length > 0 && (
        <div style={S.explainSection}>
          <h4 style={S.explainSectionTitle}>Responsibilities</h4>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {explanation.responsibilities.map((r, i) => (
              <li key={i} style={S.explainBullet}>· {r}</li>
            ))}
          </ul>
        </div>
      )}
      {explanation.usedBy.length > 0 && (
        <div style={S.explainSection}>
          <h4 style={S.explainSectionTitle}>Used by</h4>
          <div style={S.explainTags}>
            {explanation.usedBy.map(u => <span key={u} style={S.explainTag}>{u}</span>)}
          </div>
        </div>
      )}
      {explanation.uses.length > 0 && (
        <div style={S.explainSection}>
          <h4 style={S.explainSectionTitle}>Depends on</h4>
          <div style={S.explainTags}>
            {explanation.uses.map(u => <span key={u} style={S.explainTag}>{u}</span>)}
          </div>
        </div>
      )}
      {explanation.warnings.length > 0 && (
        <div style={S.explainWarnings} role="alert">
          {explanation.warnings.map((w, i) => (
            <p key={i} style={S.explainWarning}>⚠ {w}</p>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── File List ────────────────────────────────────────────────────────────────

function FileList({ nodes, focusedNode, systemColor, onOpenFile, onFocusNode }: {
  nodes: GraphNode[];
  focusedNode: string | null;
  systemColor: string;
  onOpenFile: (path: string, line?: number) => void;
  onFocusNode: (nodeId: string) => void;
}): React.ReactElement {
  return (
    <ul style={S.fileList} role="list" aria-label="Files in system">
      {nodes.slice(0, 50).map(node => (
        <li key={node.id}>
          <button
            style={{
              ...S.fileItem,
              ...(focusedNode === node.id ? { ...S.fileItemFocused, borderLeftColor: systemColor } : {}),
            }}
            onClick={() => { onFocusNode(node.id); onOpenFile(node.path); }}
            title={node.relativePath}
            aria-label={`${node.label}${node.isEntryPoint ? ' (entry point)' : ''}${node.isDeadCode ? ' (unreachable)' : ''}`}
            aria-current={focusedNode === node.id ? 'true' : undefined}
          >
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: LANG_COLORS[node.language] ?? '#64748b', flexShrink: 0 }} aria-hidden="true" />
            <span style={{ ...S.fileName, ...(node.isDeadCode ? S.fileNameDead : {}) }}>
              {node.isEntryPoint && <span style={S.entryMark} aria-hidden="true">◆</span>}
              {node.label}
            </span>
            <span style={S.fileMetrics}>
              {node.isDeadCode && <span style={S.deadMark} aria-label="Unreachable">☠</span>}
              {node.dependentCount > 0 && (
                <span style={S.depCount} aria-label={`${node.dependentCount} dependents`}>
                  {node.dependentCount}
                </span>
              )}
            </span>
          </button>
        </li>
      ))}
      {nodes.length > 50 && (
        <li style={S.moreFiles}>+{nodes.length - 50} more files</li>
      )}
    </ul>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const S: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    overflow: 'hidden',
  },
  tabBar: {
    display: 'flex',
    borderBottom: '1px solid var(--vscode-widget-border)',
    flexShrink: 0,
  },
  tabBtn: {
    flex: 1,
    padding: '7px 4px',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: '11px',
    fontWeight: 500,
    color: 'var(--vscode-descriptionForeground)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '4px',
    borderBottom: '2px solid transparent',
    transition: 'color 0.15s, border-color 0.15s',
  },
  tabBtnActive: {
    color: 'var(--vscode-foreground)',
    borderBottomColor: 'var(--vscode-focusBorder)',
    fontWeight: 700,
  },
  tabBadge: {
    borderRadius: '8px',
    padding: '0 5px',
    fontSize: '9px',
    fontWeight: 700,
    color: '#fff',
    background: 'var(--vscode-badge-background)',
    lineHeight: '14px',
  },
  scrollArea: {
    flex: 1,
    overflowY: 'auto',
    padding: '4px 0 8px',
  },
  emptyTab: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '32px 16px',
    gap: '6px',
    fontSize: '11px',
    color: 'var(--vscode-descriptionForeground)',
    textAlign: 'center',
    opacity: 0.7,
  },

  // System section
  systemSection: {
    borderLeft: '2px solid transparent',
    transition: 'border-color 0.15s',
  },
  systemHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    padding: '7px 10px',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: 'var(--vscode-foreground)',
    textAlign: 'left',
  },
  systemHeaderLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    minWidth: 0,
    overflow: 'hidden',
  },
  systemHeaderRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    flexShrink: 0,
  },
  chevron: {
    fontSize: '9px',
    color: 'var(--vscode-descriptionForeground)',
    flexShrink: 0,
    width: '10px',
  },
  systemDot: {
    width: '8px',
    height: '8px',
    borderRadius: '2px',
    flexShrink: 0,
  },
  systemName: {
    fontSize: '10px',
    fontWeight: 700,
    letterSpacing: '0.5px',
    color: 'var(--vscode-foreground)',
    textOverflow: 'ellipsis',
    overflow: 'hidden',
    whiteSpace: 'nowrap',
  },
  circBadge: {
    fontSize: '11px',
    color: '#f59e0b',
    fontWeight: 700,
  },
  systemCount: {
    fontSize: '10px',
    color: 'var(--vscode-badge-foreground)',
    background: 'var(--vscode-badge-background)',
    borderRadius: '8px',
    padding: '0 5px',
    minWidth: '18px',
    textAlign: 'center',
    lineHeight: '16px',
  },

  // Explain button & panel
  explainBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    margin: '0 10px 4px 26px',
    padding: '4px 8px',
    background: 'none',
    border: '1px solid var(--vscode-widget-border)',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '10px',
    color: 'var(--vscode-descriptionForeground)',
    width: 'calc(100% - 36px)',
    textAlign: 'left',
  },
  explainBtnActive: {
    background: 'rgba(99,102,241,0.1)',
    borderColor: '#6366f1',
    color: '#a5b4fc',
  },
  explainPanel: {
    margin: '0 10px 6px 26px',
    padding: '10px 12px',
    background: 'rgba(99,102,241,0.06)',
    border: '1px solid rgba(99,102,241,0.18)',
    borderRadius: '6px',
    fontSize: '10px',
    lineHeight: 1.5,
  },
  explainSummary: {
    color: 'var(--vscode-foreground)',
    marginBottom: '8px',
    lineHeight: 1.5,
    fontSize: '10px',
    margin: '0 0 8px',
  },
  explainSection: { marginBottom: '6px' },
  explainSectionTitle: {
    fontSize: '9px',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    color: '#6366f1',
    marginBottom: '3px',
    margin: '0 0 3px',
  },
  explainBullet: {
    color: 'var(--vscode-descriptionForeground)',
    paddingLeft: '4px',
    fontSize: '10px',
  },
  explainTags: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '3px',
  },
  explainTag: {
    fontSize: '9px',
    padding: '1px 6px',
    borderRadius: '10px',
    background: 'var(--vscode-badge-background)',
    color: 'var(--vscode-badge-foreground)',
  },
  explainWarnings: {
    marginTop: '6px',
    display: 'flex',
    flexDirection: 'column',
    gap: '3px',
  },
  explainWarning: {
    fontSize: '10px',
    color: '#f59e0b',
    lineHeight: 1.4,
    margin: 0,
  },

  // File list
  fileList: {
    listStyle: 'none',
    padding: '0 0 4px',
    margin: 0,
  },
  fileItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    width: '100%',
    padding: '4px 10px 4px 30px',
    cursor: 'pointer',
    borderLeft: '2px solid transparent',
    background: 'none',
    border: 'none',
    borderLeftWidth: '2px',
    borderLeftStyle: 'solid',
    borderLeftColor: 'transparent',
    textAlign: 'left',
    color: 'inherit',
    fontSize: 'inherit',
    fontFamily: 'inherit',
    transition: 'background 0.1s',
  },
  fileItemFocused: {
    background: 'var(--vscode-list-activeSelectionBackground)',
  },
  fileName: {
    fontSize: '11px',
    color: 'var(--vscode-foreground)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    flex: 1,
  },
  fileNameDead: {
    opacity: 0.4,
    textDecoration: 'line-through',
  },
  entryMark: {
    color: '#f59e0b',
    fontSize: '7px',
    marginRight: '3px',
  },
  fileMetrics: {
    display: 'flex',
    alignItems: 'center',
    gap: '3px',
    flexShrink: 0,
  },
  deadMark: {
    fontSize: '9px',
    color: '#ef4444',
    opacity: 0.7,
  },
  depCount: {
    fontSize: '9px',
    color: 'var(--vscode-descriptionForeground)',
    opacity: 0.6,
    minWidth: '12px',
    textAlign: 'right',
  },
  moreFiles: {
    fontSize: '10px',
    color: 'var(--vscode-descriptionForeground)',
    padding: '4px 30px',
    opacity: 0.6,
  },

  // Violations
  violationGroup: {
    padding: '6px 0 4px',
    borderBottom: '1px solid var(--vscode-widget-border)',
  },
  violationGroupHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '4px 10px 6px',
    fontSize: '10px',
    fontWeight: 700,
    color: 'var(--vscode-foreground)',
    margin: 0,
  },
  violationCard: {
    display: 'flex',
    gap: '8px',
    padding: '5px 10px',
    alignItems: 'flex-start',
  },
  severityDot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    flexShrink: 0,
    marginTop: '4px',
  },
  violationContent: { flex: 1, minWidth: 0 },
  violationDesc: {
    fontSize: '10px',
    color: 'var(--vscode-foreground)',
    lineHeight: 1.4,
    marginBottom: '3px',
    margin: '0 0 3px',
  },
  violationFiles: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    flexWrap: 'wrap',
  },
  violationFile: {
    fontSize: '9px',
    color: '#6366f1',
    cursor: 'pointer',
    fontFamily: 'var(--vscode-editor-font-family, monospace)',
    textDecoration: 'underline',
    background: 'none',
    border: 'none',
    padding: 0,
    maxWidth: '90px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  violationArrow: {
    fontSize: '9px',
    color: 'var(--vscode-descriptionForeground)',
  },
  violationMeta: {
    fontSize: '9px',
    color: 'var(--vscode-descriptionForeground)',
    marginTop: '2px',
    margin: '2px 0 0',
  },

  // Dead zones
  deadZone: {
    padding: '8px 10px',
    borderBottom: '1px solid var(--vscode-widget-border)',
  },
  deadZoneHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    marginBottom: '4px',
  },
  deadZoneIcon: {
    fontSize: '12px',
    color: '#ef4444',
    opacity: 0.7,
  },
  deadZoneTitle: {
    fontSize: '11px',
    fontWeight: 600,
    color: 'var(--vscode-foreground)',
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    margin: 0,
  },
  deadZoneCount: {
    fontSize: '10px',
    color: 'var(--vscode-badge-foreground)',
    background: 'var(--vscode-badge-background)',
    borderRadius: '8px',
    padding: '0 5px',
    lineHeight: '16px',
  },
  deadZoneReason: {
    fontSize: '10px',
    color: 'var(--vscode-descriptionForeground)',
    lineHeight: 1.4,
    marginBottom: '6px',
    margin: '0 0 6px',
  },
  deadZoneFiles: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  deadZoneFile: {
    display: 'flex',
    alignItems: 'center',
  },
  deadZoneFileBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    cursor: 'pointer',
    padding: '2px 0',
    opacity: 0.6,
    background: 'none',
    border: 'none',
    color: 'inherit',
    fontSize: 'inherit',
    fontFamily: 'inherit',
    textAlign: 'left',
  },
  deadZoneFileName: {
    fontSize: '10px',
    color: 'var(--vscode-foreground)',
    fontFamily: 'var(--vscode-editor-font-family, monospace)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    textDecoration: 'line-through',
  },
  deadZoneMore: {
    fontSize: '9px',
    color: 'var(--vscode-descriptionForeground)',
    padding: '2px 0',
    opacity: 0.6,
  },
};
