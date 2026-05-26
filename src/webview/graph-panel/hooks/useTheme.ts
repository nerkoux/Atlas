/**
 * Reads VS Code theme colours and re-reads them whenever the user switches
 * theme. The MutationObserver watches for the class changes VS Code applies
 * to `<body>` when the active theme kind toggles between light, dark, or
 * high-contrast.
 */
import { useEffect, useRef, useState } from 'react';
import { readThemeColors, ThemeColors } from '../../theme/colors';

interface UseThemeResult {
  theme: ThemeColors;
  /** Stable, mutable reference for callers that need the latest theme inside long-lived closures. */
  themeRef: React.MutableRefObject<ThemeColors>;
}

export function useTheme(): UseThemeResult {
  const themeRef = useRef<ThemeColors>(readThemeColors());
  const [theme, setTheme] = useState<ThemeColors>(themeRef.current);

  useEffect(() => {
    const observer = new MutationObserver(() => {
      const next = readThemeColors();
      themeRef.current = next;
      setTheme(next);
    });
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  return { theme, themeRef };
}
