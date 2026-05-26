import React from 'react';

interface Props {
  value: number | string;
  label: string;
  warn?: boolean;
}

const styles: Record<string, React.CSSProperties> = {
  stat: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '0 8px',
    minWidth: '36px',
  },
  value: {
    fontSize: '16px',
    fontWeight: 700,
    color: 'var(--vscode-foreground)',
    lineHeight: 1,
  },
  valueWarn: { color: '#f59e0b' },
  label: {
    fontSize: '9px',
    color: 'var(--vscode-descriptionForeground)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.4px',
    marginTop: '1px',
  },
  divider: { width: '1px', height: '20px', background: 'var(--vscode-widget-border)' },
};

export function StatChip({ value, label, warn }: Props): React.ReactElement {
  return (
    <div style={styles.stat} aria-label={`${value} ${label}`}>
      <span style={{ ...styles.value, ...(warn ? styles.valueWarn : {}) }}>{value}</span>
      <span style={styles.label}>{label}</span>
    </div>
  );
}

export function StatDivider(): React.ReactElement {
  return <div style={styles.divider} aria-hidden="true" />;
}
