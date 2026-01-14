
import React, { useContext } from 'react';
import { ThemeContext } from '../context/theme.context';

const ThemeToggle = () => {
    const { theme, setTheme } = useContext(ThemeContext);

    const toggleTheme = () => {
        setTheme(theme === 'dark' ? 'light' : 'dark');
    };

    return (
        <button 
            onClick={toggleTheme} 
            className="p-2 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-white transition-all hover:bg-slate-300 dark:hover:bg-slate-600 focus:outline-none"
            aria-label="Toggle Theme"
        >
            {theme === 'dark' ? (
                <i className="ri-sun-line text-lg"></i>
            ) : (
                <i className="ri-moon-line text-lg"></i>
            )}
        </button>
    );
};

export default ThemeToggle;
