import React from 'react';
import type { GraphData } from '../../../types';
import { Logo } from '../../components/Logo';
import { LayoutPicker } from './LayoutPicker';
import { LayoutName } from '../cytoscape/layout';
import { graphStyles as S } from '../styles';

interface Props {
  graphData: GraphData;
  filteredCount: number;
  layout: LayoutName;
  onLayoutChange: (l: LayoutName) => void;
  /** Slot for the systems/files view-mode picker. */
  viewModePicker?: React.ReactNode;
}

export function GraphTopBar({
  graphData,
  filteredCount,
  layout,
  onLayoutChange,
  viewModePicker,
}: Props): React.ReactElement {
  return (
    <header style={S.topBar} role="banner">
      <div style={S.topBarLeft}>
        <Logo size={28} />
        <span style={S.logoText}>Atlas</span>
        <span style={S.divider} aria-hidden="true" />
        <span style={S.statChip}>
          <b>{filteredCount}</b> files
        </span>
        <span style={S.statChip}>
          <b>{graphData.systems.length}</b> systems
        </span>
        <span style={S.statChip}>
          <b>{graphData.edges.length}</b> links
        </span>
        {graphData.circularDeps.length > 0 && (
          <span style={{ ...S.statChip, ...S.statChipWarn }}>
            <b>{graphData.circularDeps.length}</b> cycles
          </span>
        )}
      </div>
      <div style={S.topBarRight}>
        {viewModePicker}
        <LayoutPicker active={layout} onChange={onLayoutChange} />
      </div>
    </header>
  );
}
