import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';

type Mode = 'light' | 'dark';

const ThemeContext = createContext<{ mode: Mode; toggle: (origin?: DOMRect) => void }>({
  mode: 'light',
  toggle: () => undefined,
});

const STORAGE_KEY = 'hospital-console-theme';
const supportsViewTransitions = () =>
  typeof document !== 'undefined' && 'startViewTransition' in document;

function apply(mode: Mode) {
  document.documentElement.classList.toggle('dark', mode === 'dark');
  localStorage.setItem(STORAGE_KEY, mode);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<Mode>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    apply(mode);
  }, [mode]);

  const toggle = useCallback(
    (origin?: DOMRect) => {
      const next: Mode = mode === 'dark' ? 'light' : 'dark';
      if (origin) {
        const root = document.documentElement;
        root.style.setProperty('--theme-x', `${origin.left + origin.width / 2}px`);
        root.style.setProperty('--theme-y', `${origin.top + origin.height / 2}px`);
      }
      if (!supportsViewTransitions()) {
        setMode(next);
        return;
      }
      document.startViewTransition(() => setMode(next));
    },
    [mode],
  );

  return <ThemeContext.Provider value={{ mode, toggle }}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
