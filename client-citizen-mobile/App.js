/**
 * RESONIX AI — Citizen Mobile Application Root Component (React Native)
 * 
 * JavaScript ONLY. No TypeScript.
 * Communicates directly with Node.js Express backend.
 * Provides ThemeProvider, AuthProvider, auto-sync for offline queue, and AppNavigator.
 */

const React = require('react');
const { useEffect } = React;
const { ThemeProvider } = require('./src/context/ThemeContext');
const { AuthProvider } = require('./src/context/AuthContext');
const AppNavigator = require('./src/navigation/AppNavigator');
const offlineQueueService = require('./src/services/offlineQueueService');

function App() {
  useEffect(() => {
    // Auto-sync any unsent offline emergency reports when app launches
    offlineQueueService.syncQueue().catch((err) => {
      console.warn('[App] Background offline sync failed on launch:', err.message);
    });

    // Initialize Real Emergency Incident Lifecycle & Notification Engine
    try {
      const incidentLifecycleService = require('./src/services/incidentLifecycleService');
      incidentLifecycleService.init().catch((err) => {
        console.warn('[App] Incident lifecycle service init notice:', err.message);
      });
    } catch (_) {}

    // Start background native BLE mesh radio transport (Android foreground service)
    try {
      const nativeBleMesh = require('./src/services/nativeBleMeshService');
      const meshService = nativeBleMesh.default || nativeBleMesh;
      if (meshService && meshService.isSupported && typeof meshService.startMesh === 'function') {
        meshService.startMesh().catch((err) => {
          console.log('[App] Background BLE mesh initialization notice:', err.message);
        });
      }
    } catch (_) {}
  }, []);

  return (
    <ThemeProvider>
      <AuthProvider>
        <AppNavigator />
      </AuthProvider>
    </ThemeProvider>
  );
}

module.exports = App;
