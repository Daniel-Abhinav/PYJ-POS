import { useState, useEffect, useCallback } from 'react';

type Theme = 'light' | 'dark';

const useTheme = () => {
  // 1. Initialize state. Read from localStorage, fallback to system preference, then default to 'light'.
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      const stored = localStorage.getItem('pyj-pos-theme');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed === 'light' || parsed === 'dark') {
          return parsed;
        }
      }
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  });

  // 2. Effect to update localStorage and the <html> class whenever the theme state changes.
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    try {
      // Persist the new theme value to localStorage
      localStorage.setItem('pyj-pos-theme', JSON.stringify(theme));
    } catch (e) {
      console.error('Failed to save theme to localStorage', e);
    }
  }, [theme]);

  // 3. Memoized toggle function to switch between themes.
  const toggleTheme = useCallback(() => {
    setTheme(prev => (prev === 'light' ? 'dark' : 'light'));
  }, []);

  return { theme, toggleTheme };
};

export default useTheme;
