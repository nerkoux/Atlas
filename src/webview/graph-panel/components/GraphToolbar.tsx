import React from 'react';
import { FitIcon, MinusIcon, PlusIcon } from '../../shared/icons';
import { graphStyles as S } from '../styles';

interface Props {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitAll: () => void;
}

export function GraphToolbar({ onZoomIn, onZoomOut, onFitAll }: Props): React.ReactElement {
  return (
    <nav style={S.toolbar} aria-label="Graph controls">
      <ToolBtn onClick={onZoomIn} label="Zoom in">
        <PlusIcon />
      </ToolBtn>
      <ToolBtn onClick={onZoomOut} label="Zoom out">
        <MinusIcon />
      </ToolBtn>
      <div style={S.toolbarDivider} aria-hidden="true" />
      <ToolBtn onClick={onFitAll} label="Fit to screen">
        <FitIcon />
      </ToolBtn>
    </nav>
  );
}

function ToolBtn({
  onClick,
  label,
  children,
}: {
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <button style={S.toolBtn} onClick={onClick} title={label} aria-label={label}>
      {children}
    </button>
  );
}
