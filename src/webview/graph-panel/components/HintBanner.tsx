import React from 'react';
import { graphStyles as S } from '../styles';

interface Props {
  children: React.ReactNode;
}

/**
 * Subtle banner that hovers over the graph canvas to communicate non-error
 * states (e.g. "no imports detected between these files").
 */
export function HintBanner({ children }: Props): React.ReactElement {
  return (
    <div style={S.hint} role="status">
      <span aria-hidden="true">ⓘ</span>
      <span>{children}</span>
    </div>
  );
}
