import React from 'react';
import { ScanProgress } from '../../types';

interface Props {
  progress: ScanProgress | null;
  workspaceName: string;
}

const PHASE_LABELS: Record<string, string> = {
  discovering: 'Discovering files',
  parsing: 'Parsing source files',
  analyzing: 'Building dependency graph',
  classifying: 'Classifying systems',
  complete: 'Complete',
  error: 'Error',
};

export function LoadingScreen({ progress, workspaceName }: Props): React.ReactElement {
  const percent = progress && progress.total > 0
    ? Math.round((progress.current / progress.total) * 100)
    : null;

  return (
    <div style={S.container} role="status" aria-live="polite" aria-label="Analyzing workspace">
      <div style={S.spinner} aria-hidden="true">
        <svg viewBox="0 0 50 50" style={S.spinnerSvg}>
          <circle
            cx="25" cy="25" r="20"
            fill="none"
            stroke="var(--vscode-progressBar-background)"
            strokeWidth="3"
            strokeDasharray="100 26"
            strokeLinecap="round"
          />
        </svg>
      </div>

      <div style={S.info}>
        <h2 style={S.title}>Analyzing {workspaceName}</h2>
        <p style={S.phase}>
          {progress ? PHASE_LABELS[progress.phase] ?? progress.phase : 'Initializing...'}
        </p>
        {progress?.currentFile && (
          <p style={S.currentFile} title={progress.currentFile}>
            {truncatePath(progress.currentFile, 40)}
          </p>
        )}
      </div>

      <div style={S.progressBar} role="progressbar" aria-valuenow={percent ?? undefined} aria-valuemin={0} aria-valuemax={100}>
        <div style={{ ...S.progressFill, width: `${percent ?? 30}%` }} />
      </div>

      {progress && progress.total > 0 && (
        <p style={S.counter}>{progress.current} / {progress.total} files</p>
      )}
    </div>
  );
}

function truncatePath(p: string, max: number): string {
  if (p.length <= max) return p;
  return '…' + p.slice(-(max - 1));
}

const S: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
    gap: '12px',
    padding: '24px',
  },
  spinner: {
    width: '40px',
    height: '40px',
  },
  spinnerSvg: {
    width: '40px',
    height: '40px',
    animation: 'spin 1.2s linear infinite',
  },
  info: {
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  title: {
    fontSize: '13px',
    fontWeight: 600,
    color: 'var(--vscode-foreground)',
    margin: 0,
  },
  phase: {
    fontSize: '11px',
    color: 'var(--vscode-descriptionForeground)',
    fontWeight: 500,
    margin: 0,
  },
  currentFile: {
    fontSize: '10px',
    color: 'var(--vscode-descriptionForeground)',
    opacity: 0.7,
    fontFamily: 'var(--vscode-editor-font-family, monospace)',
    maxWidth: '220px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    margin: 0,
  },
  progressBar: {
    width: '200px',
    height: '3px',
    background: 'var(--vscode-widget-border)',
    borderRadius: '2px',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    background: 'var(--vscode-progressBar-background)',
    borderRadius: '2px',
    transition: 'width 0.3s ease',
  },
  counter: {
    fontSize: '10px',
    color: 'var(--vscode-descriptionForeground)',
    margin: 0,
  },
};
