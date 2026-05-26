/**
 * Per-language colour dots. Mirrors GitHub's language colours where possible.
 */
import type { Language } from '../../types';

export const LANG_COLORS: Record<Language, string> = {
  typescript: '#3178c6',
  javascript: '#f7df1e',
  python: '#3572a5',
  go: '#00add8',
  rust: '#dea584',
  java: '#b07219',
  csharp: '#178600',
  unknown: '#64748b',
};

export const LANG_LABELS: Record<Language, string> = {
  typescript: 'TS',
  javascript: 'JS',
  python: 'PY',
  go: 'GO',
  rust: 'RS',
  java: 'JV',
  csharp: 'C#',
  unknown: '?',
};
