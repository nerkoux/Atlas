import React from 'react';
import type { ThemeColors } from '../../theme/colors';
import { graphStyles as S } from '../styles';

interface Props {
  theme: ThemeColors;
}

export function GraphLegend({ theme }: Props): React.ReactElement {
  return (
    <div style={S.legend} aria-label="Graph legend">
      <LegendItem color={theme.focusBorder} label="Selected" />
      <LegendItem color="var(--vscode-editorWarning-foreground, #d19a00)" label="Entry point" />
      <LegendItem color="var(--vscode-errorForeground, #f14c4c)" label="Unreachable" dashed />
    </div>
  );
}

function LegendItem({
  color,
  label,
  dashed,
}: {
  color: string;
  label: string;
  dashed?: boolean;
}): React.ReactElement {
  return (
    <div style={S.legendItem}>
      <span
        style={{
          width: 10,
          height: 10,
          borderRadius: '50%',
          border: `2px ${dashed ? 'dashed' : 'solid'} ${color}`,
          flexShrink: 0,
        }}
        aria-hidden="true"
      />
      <span>{label}</span>
    </div>
  );
}
