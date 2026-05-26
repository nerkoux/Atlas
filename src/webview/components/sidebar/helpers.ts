/**
 * Pure helpers shared across sidebar components.
 */

export function severityColor(severity: string): string {
  if (severity === 'high') return '#ef4444';
  if (severity === 'medium') return '#f59e0b';
  return '#94a3b8';
}

export function shortenPath(p: string): string {
  const parts = p.split('/');
  return parts[parts.length - 1] ?? p;
}
