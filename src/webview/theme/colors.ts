/**
 * Theme bridging utilities.
 *
 * Cytoscape renders to a Canvas — it cannot read CSS variables. This module
 * resolves VS Code's CSS theme variables into concrete colour strings that
 * can be passed into the graph engine, and exposes a small helper to detect
 * dark vs light themes for contrast-sensitive decisions.
 */

export interface ThemeColors {
  isDark: boolean;
  background: string;
  foreground: string;
  border: string;
  mutedForeground: string;
  focusBorder: string;
}

export function readThemeColors(): ThemeColors {
  const root = document.documentElement;
  const cs = getComputedStyle(root);
  const get = (name: string, fallback: string): string => {
    const v = cs.getPropertyValue(name).trim();
    return v || fallback;
  };

  const bg = get('--vscode-editor-background', '#1e1e1e');
  const isDark = isColorDark(bg);

  return {
    isDark,
    background: bg,
    foreground: get('--vscode-foreground', isDark ? '#cccccc' : '#3b3b3b'),
    border: get('--vscode-editorGroup-border', isDark ? '#2b2b2b' : '#e5e5e5'),
    mutedForeground: get('--vscode-descriptionForeground', isDark ? '#9d9d9d' : '#717171'),
    focusBorder: get('--vscode-focusBorder', '#007fd4'),
  };
}

export function isColorDark(color: string): boolean {
  let hex = color.replace('#', '').trim();
  if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('');
  if (hex.length === 6) {
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return r * 0.299 + g * 0.587 + b * 0.114 < 128;
  }
  const m = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (m) {
    const [r, g, b] = [+m[1], +m[2], +m[3]];
    return r * 0.299 + g * 0.587 + b * 0.114 < 128;
  }
  return true;
}

export function withAlpha(color: string, alpha: number): string {
  let hex = color.replace('#', '').trim();
  if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('');
  if (hex.length === 6) {
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }
  const m = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (m) return `rgba(${m[1]},${m[2]},${m[3]},${alpha})`;
  return color;
}
