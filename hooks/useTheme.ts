import { useState, useEffect, useCallback } from 'react';
import useLocalStorage from './useLocalStorage';

type Theme = 'light' | 'dark';

const useTheme = () => {
    const [storedTheme, setStoredTheme] = useLocalStorage<Theme>('pyj-pos-theme', 'light');
    const [theme, setTheme] = useState<Theme>(storedTheme);

    useEffect(() => {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');
        // Set initial theme based on localStorage or system preference
        const initialTheme = localStorage.getItem('pyj-pos-theme') as Theme || (prefersDark.matches ? 'dark' : 'light');
        setTheme(initialTheme);
    }, []);

    useEffect(() => {
        if (theme === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
        setStoredTheme(theme);
    }, [theme, setStoredTheme]);

    const toggleTheme = useCallback(() => {
        setTheme(prevTheme => prevTheme === 'light' ? 'dark' : 'light');
    }, []);

    return { theme, toggleTheme };
};

export default useTheme;
