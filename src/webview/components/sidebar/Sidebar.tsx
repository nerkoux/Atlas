/**
 * Architecture Explorer sidebar (rendered inside the activity-bar webview).
 *
 * Renders three tabs:
 *  - Systems: file tree grouped by detected architectural systems,
 *  - Issues: layer violations and circular dependency reports,
 *  - Dead: unreachable files and dead-zone summaries.
 *
 * Each tab body lives in its own component; this file only owns the active
 * tab state and the shared `nodeMap` lookup.
 */
import React, { useMemo, useState } from 'react';
import type {
  ArchitectureSystem,
  CircularDependency,
  DeadZone,
  GraphNode,
  LayerViolation,
  SystemExplanation,
} from '../../../types';
import { DeadZonesTab } from './DeadZonesTab';
import { SidebarTab, SidebarTabs } from './SidebarTabs';
import { sidebarStyles as S } from './styles';
import { SystemsTab } from './SystemsTab';
import { ViolationsTab } from './ViolationsTab';

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

  const nodeMap = useMemo(() => {
    const m = new Map<string, GraphNode>();
    for (const n of nodes) m.set(n.id, n);
    return m;
  }, [nodes]);

  const violationCount = layerViolations.length + circularDeps.length;
  const deadCount = deadZones.reduce((sum, z) => sum + z.files.length, 0);

  return (
    <div style={S.container} role="navigation" aria-label="Architecture explorer">
      <SidebarTabs
        active={tab}
        onChange={setTab}
        violationCount={violationCount}
        deadCount={deadCount}
      />

      {tab === 'systems' && (
        <SystemsTab
          systems={systems}
          nodeMap={nodeMap}
          explanations={explanations}
          selectedSystem={selectedSystem}
          searchQuery={searchQuery}
          focusedNode={focusedNode}
          onSelectSystem={onSelectSystem}
          onOpenFile={onOpenFile}
          onFocusNode={onFocusNode}
        />
      )}

      {tab === 'violations' && (
        <ViolationsTab
          circularDeps={circularDeps}
          layerViolations={layerViolations}
          onOpenFile={onOpenFile}
        />
      )}

      {tab === 'dead' && (
        <DeadZonesTab deadZones={deadZones} nodeMap={nodeMap} onOpenFile={onOpenFile} />
      )}
    </div>
  );
}
