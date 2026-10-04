import { createContext, useContext } from 'react';
import { useSettings } from './SettingsContext';

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  return children;
}

export function useTheme() {
  const settingsContext = useSettings();
  if (!settingsContext) {
    return {
      theme: 'dark',
      toggleTheme: () => {},
    };
  }
  return {
    theme: settingsContext.settings.theme,
    toggleTheme: () => {
      const next = settingsContext.settings.theme === 'dark' ? 'light' : 'dark';
      settingsContext.saveSettings({ theme: next });
    },
  };
}

export default ThemeContext;
