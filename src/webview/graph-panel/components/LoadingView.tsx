import React from 'react';
import { graphStyles as S } from '../styles';

export function LoadingView(): React.ReactElement {
  return (
    <div style={S.loading} role="status" aria-label="Loading graph">
      <div style={S.loadingSpinner} aria-hidden="true" />
      <span style={S.loadingText}>Building graph…</span>
    </div>
  );
}
