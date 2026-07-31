import { createContext, useContext, useState, useCallback } from 'react';
import { generateId } from '../utils/helpers';

const AlertContext = createContext(null);

export function AlertProvider({ children }) {
  const [alerts, setAlerts] = useState([]);

  const addAlert = useCallback((alert) => {
    const newAlert = {
      id: generateId(),
      timestamp: new Date(),
      ...alert,
    };
    setAlerts((prev) => [newAlert, ...prev]);
    return newAlert.id;
  }, []);

  const removeAlert = useCallback((id) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const clearAlerts = useCallback(() => setAlerts([]), []);

  return (
    <AlertContext.Provider value={{ alerts, addAlert, removeAlert, clearAlerts }}>
      {children}
    </AlertContext.Provider>
  );
}

export function useAlerts() {
  const context = useContext(AlertContext);
  if (!context) throw new Error('useAlerts must be used within AlertProvider');
  return context;
}
