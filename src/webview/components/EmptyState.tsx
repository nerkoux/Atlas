import React from 'react';
import { Logo } from './Logo';

interface Props {
  workspaceName: string;
  onScan: () => void;
  error: string | null;
}

export function EmptyState({ workspaceName, onScan, error }: Props): React.ReactElement {
  const noFolder = workspaceName === 'Workspace';

  return (
    <div style={styles.container} role="main" aria-label="Atlas welcome screen">
      <div style={styles.iconWrap}>
        <Logo size={96} alt="Atlas logo" />
      </div>
      <h1 style={styles.title}>Atlas</h1>
      <p style={styles.description}>
        {error
          ? error
          : noFolder
            ? 'Open a folder to begin'
            : 'Ready to analyze your architecture'}
      </p>
      {!noFolder && !error && (
        <button
          style={styles.scanBtn}
          onClick={onScan}
          aria-label="Scan workspace to analyze architecture"
        >
          Scan Workspace
        </button>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
    padding: '24px',
    textAlign: 'center',
    gap: '10px',
  },
  iconWrap: {
    color: 'var(--vscode-descriptionForeground)',
    marginBottom: '4px',
  },
  title: {
    fontSize: '15px',
    fontWeight: 700,
    color: 'var(--vscode-foreground)',
    letterSpacing: '0.3px',
    margin: 0,
  },
  description: {
    fontSize: '11px',
    color: 'var(--vscode-descriptionForeground)',
    lineHeight: 1.5,
    maxWidth: '200px',
    margin: 0,
  },
  scanBtn: {
    marginTop: '6px',
    background: 'var(--vscode-button-background)',
    color: 'var(--vscode-button-foreground)',
    border: 'none',
    borderRadius: '4px',
    padding: '7px 16px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 500,
  },
};
