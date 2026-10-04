/**
 * Theme Context for RESONIX AI Citizen Mobile (React Native)
 * Provides theme mode ('light' | 'dark') and color tokens matching Web.
 */

const React = require('react');
const { createContext, useState, useContext, useEffect } = React;
const { lightTheme, darkTheme } = require('../theme/colors');
const storage = require('../utils/storage');

const THEME_STORAGE_KEY = '@resonix_theme_mode';

const ThemeContext = createContext({
  mode: 'light',
  isDark: false,
  colors: lightTheme,
  toggleTheme: () => {},
  setMode: () => {},
});

function ThemeProvider({ children }) {
  const [mode, setModeState] = useState('light');

  useEffect(() => {
    storage.getItem(THEME_STORAGE_KEY).then((saved) => {
      if (saved === 'dark' || saved === 'light') {
        setModeState(saved);
      }
    }).catch(() => {});
  }, []);

  const toggleTheme = () => {
    const nextMode = mode === 'light' ? 'dark' : 'light';
    setModeState(nextMode);
    storage.setItem(THEME_STORAGE_KEY, nextMode).catch(() => {});
  };

  const setMode = (newMode) => {
    if (newMode === 'light' || newMode === 'dark') {
      setModeState(newMode);
      storage.setItem(THEME_STORAGE_KEY, newMode).catch(() => {});
    }
  };

  const isDark = mode === 'dark';
  const colors = isDark ? darkTheme : lightTheme;

  return (
    <ThemeContext.Provider value={{ mode, isDark, colors, toggleTheme, setMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

function useTheme() {
  return useContext(ThemeContext);
}

module.exports = {
  ThemeContext,
  ThemeProvider,
  useTheme,
};
