import React, { createContext, useState, useEffect } from 'react';

export const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
    const [theme, setTheme] = useState(localStorage.getItem('theme') || 'system');

    useEffect(() => {
        const root = window.document.documentElement;
        
        const applyTheme = (selectedTheme) => {
            const isDark = selectedTheme === 'dark' || 
                (selectedTheme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

            if (isDark) {
                root.classList.add('dark');
            } else {
                root.classList.remove('dark');
            }
        };

        applyTheme(theme);
        localStorage.setItem('theme', theme);

    }, [theme]);

    return (
        <ThemeContext.Provider value={{ theme, setTheme }}>
            {children}
        </ThemeContext.Provider>
    );
};
