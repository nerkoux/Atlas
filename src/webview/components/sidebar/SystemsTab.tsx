import React, { useMemo, useState } from 'react';
import type {
  ArchitectureSystem,
  GraphNode,
  SystemExplanation,
} from '../../../types';
import { SystemSection } from './SystemSection';
import { sidebarStyles as S } from './styles';

interface Props {
  systems: ArchitectureSystem[];
  nodeMap: Map<string, GraphNode>;
  explanations: Record<string, SystemExplanation>;
  selectedSystem: string | null;
  searchQuery: string;
  focusedNode: string | null;
  onSelectSystem: (systemId: string | null) => void;
  onOpenFile: (path: string, line?: number) => void;
  onFocusNode: (nodeId: string) => void;
}

export function SystemsTab({
  systems,
  nodeMap,
  explanations,
  selectedSystem,
  searchQuery,
  focusedNode,
  onSelectSystem,
  onOpenFile,
  onFocusNode,
}: Props): React.ReactElement {
  const [expandedSystems, setExpandedSystems] = useState<Set<string>>(
    () => new Set(systems.filter((s) => s.files.length > 0).slice(0, 4).map((s) => s.id))
  );
  const [explainSystem, setExplainSystem] = useState<string | null>(null);

  const filteredSystems = useMemo(() => {
    if (!searchQuery) return systems.filter((s) => s.files.length > 0);
    const q = searchQuery.toLowerCase();
    return systems
      .map((sys) => ({
        ...sys,
        files: sys.files.filter((fid) => {
          const node = nodeMap.get(fid);
          return (
            node &&
            (node.label.toLowerCase().includes(q) ||
              node.relativePath.toLowerCase().includes(q))
          );
        }),
      }))
      .filter((sys) => sys.files.length > 0 || sys.name.toLowerCase().includes(q));
  }, [systems, searchQuery, nodeMap]);

  const toggleSystem = (systemId: string) => {
    setExpandedSystems((prev) => {
      const next = new Set(prev);
      if (next.has(systemId)) next.delete(systemId);
      else next.add(systemId);
      return next;
    });
  };

  return (
    <div style={S.scrollArea} role="tabpanel" aria-labelledby="tab-systems">
      {filteredSystems.map((system) => (
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
          onSelect={() =>
            onSelectSystem(selectedSystem === system.id ? null : system.id)
          }
          onExplain={() =>
            setExplainSystem((prev) => (prev === system.id ? null : system.id))
          }
          onOpenFile={onOpenFile}
          onFocusNode={onFocusNode}
        />
      ))}

      {filteredSystems.length === 0 && (
        <div style={S.emptyTab} role="status">
          No systems match your search
        </div>
      )}
    </div>
  );
}
