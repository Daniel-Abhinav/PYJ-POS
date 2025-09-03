import { useEffect, useCallback } from 'react';
import useLocalStorage from './useLocalStorage';

type Theme = 'light' | 'dark';

// Helper to get initial theme on first load
const getInitialTheme = (): Theme => {
    if (typeof window !== 'undefined') {
        try {
            // Check for a theme saved in localStorage
            const storedItem = window.localStorage.getItem('pyj-pos-theme');
            if (storedItem) {
                const storedTheme = JSON.parse(storedItem);
                if (storedTheme === 'light' || storedTheme === 'dark') {
                    return storedTheme;
                }
            }
        } catch (e) {
            // If parsing fails, proceed to the next check
            console.error("Failed to parse theme from localStorage", e);
        }

        // If no theme in localStorage, check the user's OS preference
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            return 'dark';
        }
    }
    
    // Default to light theme
    return 'light';
};

const useTheme = () => {
    // Initialize our state from localStorage or system preference
    const [theme, setTheme] = useLocalStorage<Theme>('pyj-pos-theme', getInitialTheme());

    // Effect to apply the theme class to the <html> element
    useEffect(() => {
        const root = window.document.documentElement;
        // Remove the opposite theme class and add the current one
        root.classList.remove(theme === 'dark' ? 'light' : 'dark');
        root.classList.add(theme);
    }, [theme]);

    const toggleTheme = useCallback(() => {
        setTheme(prevTheme => (prevTheme === 'light' ? 'dark' : 'light'));
    }, [setTheme]);

    return { theme, toggleTheme };
};

export default useTheme;
