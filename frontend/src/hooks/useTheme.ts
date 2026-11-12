import { useEffect, useState } from 'react';
import { ThemeMode } from '../types/journal';

const STORAGE_KEY = 'journal_theme_mode';

export function useTheme() {
  const [theme, setTheme] = useState<ThemeMode>(() => {
    if (typeof window === 'undefined') return 'light';
    const stored = localStorage.getItem(STORAGE_KEY) as ThemeMode | null;
    if (stored && ['light', 'dark', 'sepia'].includes(stored)) {
      return stored;
    }
    // Check system preference
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  });

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('dark', 'sepia');

    if (theme === 'dark') {
      root.classList.add('dark');
      root.style.backgroundColor = '#18181b';
      root.style.color = '#e4e4e7';
    } else if (theme === 'sepia') {
      root.classList.add('sepia');
      root.style.backgroundColor = '#f7f4eb';
      root.style.color = '#2d2b28';
    } else {
      root.style.backgroundColor = '#ffffff';
      root.style.color = '#18181b';
    }

    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => {
      if (prev === 'light') return 'dark';
      if (prev === 'dark') return 'sepia';
      return 'light';
    });
  };

  return {
    theme,
    setTheme,
    toggleTheme,
  };
}
