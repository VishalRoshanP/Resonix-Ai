/**
 * Application Navigator for RESONIX AI Citizen Mobile (React Native)
 * 
 * 100% Parity with Citizen Web CitizenLayout.jsx
 * 
 * Navigation Architecture:
 * - Top Citizen Emergency Header Bar with Brand Logo and Sign In / User status pill
 * - 4 Bottom Navigation Tabs:
 *   1. Home (Hero SOS trigger & Live Dispatch Telemetry)
 *   2. Status (Incident Telemetry & History)
 *   3. Profile (Personal, Emergency Contacts, Medical)
 *   4. Settings (Theme, Sounds, Diagnostics, Guides)
 * - Emergency SOS Modal (EmergencyReportModal equivalent)
 * - AuthScreen accessible via header pill or profile (Guests never blocked from SOS)
 */

const React = require('react');
const { useState, useContext, useEffect } = React;
const {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
} = require('react-native');

const { AuthContext } = require('../context/AuthContext');
const { useTheme } = require('../context/ThemeContext');
const HomeScreen = require('../screens/HomeScreen');
const SOSScreen = require('../screens/SOSScreen');
const IncidentsScreen = require('../screens/IncidentsScreen');
const ProfileScreen = require('../screens/ProfileScreen');
const SettingsScreen = require('../screens/SettingsScreen');
const AuthScreen = require('../screens/AuthScreen');
const storage = require('../utils/storage');
const ENV = require('../config/env');
const nativeNotificationService = require('../services/nativeNotificationService');
const incidentLifecycleService = require('../services/incidentLifecycleService');

function AppNavigator() {
  const { user, isCitizenGuest, isAuthenticated, isLoading } = useContext(AuthContext);
  const { colors, isDark } = useTheme();

  const [activeTab, setActiveTab] = useState('HOME'); // 'HOME' | 'STATUS' | 'PROFILE' | 'SETTINGS'
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showSosModal, setShowSosModal] = useState(false);
  const [activeIncident, setActiveIncident] = useState(null);

  // Restore active incident on app mount & setup notification tap handling
  useEffect(() => {
    // 1. Check if app was launched via a notification tap
    const initialNotif = nativeNotificationService.getInitialNotification();
    if (initialNotif && (initialNotif.screen === 'STATUS' || initialNotif.incidentId)) {
      setActiveTab('STATUS');
    }

    // 2. Listen for notification tap events while app is running/backgrounded
    const unsubscribeTap = nativeNotificationService.onNotificationTapped((data) => {
      console.log('[AppNavigator] 📲 Notification tap routed to STATUS tab:', data);
      setActiveTab('STATUS');
    });

    // 3. Restore active incident
    storage.getItem(ENV.STORAGE_KEYS.ACTIVE_INCIDENT).then(async (saved) => {
      if (saved) {
        const s = String(saved.status || '').toUpperCase();
        if (s === 'RESOLVED' || s === 'COMPLETED' || s === 'CLOSED' || s === 'CANCELLED') {
          storage.removeItem(ENV.STORAGE_KEYS.ACTIVE_INCIDENT).catch(() => {});
          return;
        }
        setActiveIncident(saved);
        incidentLifecycleService.trackIncident(saved);
        return;
      }

      // Check offline queue for unsent emergency packet (matches Web getStoredActiveIncident)
      try {
        const offlineQueueService = require('../services/offlineQueueService');
        const queue = await offlineQueueService.getQueue();
        const pending = (queue || []).find((q) => q.syncStatus === 'PENDING' || q.syncStatus === 'FAILED_RETRYABLE');
        if (pending && pending.payload) {
          const itemPayload = {
            ...pending.payload,
            packetId: pending.packetId,
            incident_id: pending.packetId,
            status: 'QUEUED_OFFLINE',
            timestamp: pending.createdAt,
          };
          setActiveIncident(itemPayload);
          incidentLifecycleService.trackIncident(itemPayload);
        }
      } catch (_) {}
    }).catch(() => {});

    // 4. Subscribe to incident status changes from lifecycle service
    const unsubscribeLifecycle = incidentLifecycleService.subscribe((event) => {
      if (event.type === 'INCIDENT_STATUS_CHANGED') {
        const nextStatus = event.status;
        setActiveIncident((prev) => {
          if (!prev) return prev;
          const updated = { ...prev, status: nextStatus };
          if (nextStatus === 'COMPLETED' || nextStatus === 'CANCELLED') {
            storage.removeItem(ENV.STORAGE_KEYS.ACTIVE_INCIDENT).catch(() => {});
            return null;
          }
          storage.setItem(ENV.STORAGE_KEYS.ACTIVE_INCIDENT, updated).catch(() => {});
          return updated;
        });
      }
    });

    return () => {
      unsubscribeTap();
      unsubscribeLifecycle();
    };
  }, []);

  const handleSosSubmitted = async (incidentPayload) => {
    setActiveIncident(incidentPayload);
    await storage.setItem(ENV.STORAGE_KEYS.ACTIVE_INCIDENT, incidentPayload).catch(() => {});
    setShowSosModal(false);

    // Trigger SOS confirmed notification lifecycle
    if (incidentPayload?.isOnlineSuccess) {
      incidentLifecycleService.onSosConfirmed(incidentPayload).catch(() => {});
    }
  };

  const handleCancelIncident = async (payload) => {
    const cancelTarget = payload || activeIncident;
    incidentLifecycleService.onIncidentCancelled(cancelTarget).catch(() => {});
    setActiveIncident(null);
    await storage.removeItem(ENV.STORAGE_KEYS.ACTIVE_INCIDENT).catch(() => {});
  };

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.secondary} />
        <Text style={[styles.loadingText, { color: colors.subtleText }]}>
          Initializing RESONIX AI Emergency Network...
        </Text>
      </View>
    );
  }

  // If user explicitly opened Auth view
  if (showAuthModal) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.surface} />
        <View style={[styles.authHeaderBar, { backgroundColor: colors.surface, borderBottomColor: colors.outlineVariant }]}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => setShowAuthModal(false)}
          >
            <Text style={[styles.backButtonText, { color: colors.secondary }]}>← Back to Emergency Home</Text>
          </TouchableOpacity>
        </View>
        <AuthScreen
          onContinueAsGuest={() => setShowAuthModal(false)}
          onAuthSuccess={() => setShowAuthModal(false)}
        />
      </SafeAreaView>
    );
  }

  const renderActiveScreen = () => {
    switch (activeTab) {
      case 'HOME':
        return (
          <HomeScreen
            onOpenSOSModal={() => setShowSosModal(true)}
            activeIncident={activeIncident}
            onCancelIncident={handleCancelIncident}
          />
        );
      case 'STATUS':
        return (
          <IncidentsScreen
            activeIncident={activeIncident}
            onNavigateToSOS={() => setShowSosModal(true)}
          />
        );
      case 'PROFILE':
        return (
          <ProfileScreen
            onNavigateToAuth={() => setShowAuthModal(true)}
          />
        );
      case 'SETTINGS':
        return (
          <SettingsScreen
            onNavigateToAuth={() => setShowAuthModal(true)}
          />
        );
      default:
        return (
          <HomeScreen
            onOpenSOSModal={() => setShowSosModal(true)}
            activeIncident={activeIncident}
            onCancelIncident={handleCancelIncident}
          />
        );
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.surface} />

      {/* Top Header Bar (100% parity with Citizen Web CitizenLayout.jsx) */}
      <View style={[styles.topHeader, { backgroundColor: colors.surface, borderBottomColor: colors.outlineVariant }]}>
        <TouchableOpacity
          style={styles.brandingRow}
          onPress={() => setActiveTab('HOME')}
          activeOpacity={0.8}
        >
          <View style={[styles.logoIconBox, { backgroundColor: colors.secondaryLight, borderColor: colors.secondary }]}>
            <Text style={styles.logoIcon}>🛡️</Text>
          </View>
          <View>
            <Text style={[styles.brandTitle, { color: colors.primary }]}>RESONIX AI</Text>
            <Text style={[styles.brandSubtitle, { color: colors.secondary }]}>Citizen Emergency</Text>
          </View>
        </TouchableOpacity>

        {/* Auth / Guest Status Pill */}
        <View style={styles.headerRightBox}>
          {isCitizenGuest || !isAuthenticated ? (
            <TouchableOpacity
              style={[styles.signInPill, { backgroundColor: colors.surfaceContainer, borderColor: colors.outlineVariant }]}
              onPress={() => setShowAuthModal(true)}
              activeOpacity={0.8}
            >
              <Text style={[styles.signInPillText, { color: colors.primary }]}>Sign In</Text>
            </TouchableOpacity>
          ) : (
            <View style={[styles.userStatusPill, { backgroundColor: colors.successContainer, borderColor: colors.success }]}>
              <View style={[styles.userPulseDot, { backgroundColor: colors.success }]} />
              <Text style={[styles.userStatusText, { color: colors.success }]} numberOfLines={1}>
                {user?.name || 'Citizen'}
              </Text>
            </View>
          )}

          {/* Quick Home Icon */}
          <TouchableOpacity
            style={[styles.homeIconButton, { backgroundColor: colors.surfaceContainer }]}
            onPress={() => setActiveTab('HOME')}
            title="Return to Home"
          >
            <Text style={styles.homeIcon}>🏠</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Viewport Body */}
      <View style={styles.mainContent}>
        {renderActiveScreen()}
      </View>

      {/* Emergency SOS Modal (Full reporting flow) */}
      <SOSScreen
        visible={showSosModal}
        onClose={() => setShowSosModal(false)}
        onSubmitted={handleSosSubmitted}
      />

      {/* Bottom Navigation Bar (4 tabs matching Web layout) */}
      <View style={[styles.bottomTabBar, { backgroundColor: colors.surface, borderTopColor: colors.outlineVariant }]}>
        <TouchableOpacity
          style={[
            styles.tabItem,
            activeTab === 'HOME' && { backgroundColor: colors.secondary },
          ]}
          onPress={() => setActiveTab('HOME')}
          activeOpacity={0.8}
        >
          <Text style={styles.tabIcon}>🏠</Text>
          <Text style={[styles.tabLabel, { color: activeTab === 'HOME' ? '#FFFFFF' : colors.subtleText }]}>
            Home
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tabItem,
            activeTab === 'SOS' && { backgroundColor: colors.error || '#DC2626' },
          ]}
          onPress={() => {
            setActiveTab('SOS');
            setShowSosModal(true);
          }}
          activeOpacity={0.8}
        >
          <Text style={styles.tabIcon}>🆘</Text>
          <Text style={[styles.tabLabel, { color: activeTab === 'SOS' ? '#FFFFFF' : (colors.error || '#DC2626') }]}>
            SOS
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tabItem,
            activeTab === 'STATUS' && { backgroundColor: colors.secondary },
          ]}
          onPress={() => setActiveTab('STATUS')}
          activeOpacity={0.8}
        >
          <Text style={styles.tabIcon}>📋</Text>
          <Text style={[styles.tabLabel, { color: activeTab === 'STATUS' ? '#FFFFFF' : colors.subtleText }]}>
            Status
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tabItem,
            activeTab === 'PROFILE' && { backgroundColor: colors.secondary },
          ]}
          onPress={() => setActiveTab('PROFILE')}
          activeOpacity={0.8}
        >
          <Text style={styles.tabIcon}>👤</Text>
          <Text style={[styles.tabLabel, { color: activeTab === 'PROFILE' ? '#FFFFFF' : colors.subtleText }]}>
            Profile
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tabItem,
            activeTab === 'SETTINGS' && { backgroundColor: colors.secondary },
          ]}
          onPress={() => setActiveTab('SETTINGS')}
          activeOpacity={0.8}
        >
          <Text style={styles.tabIcon}>⚙️</Text>
          <Text style={[styles.tabLabel, { color: activeTab === 'SETTINGS' ? '#FFFFFF' : colors.subtleText }]}>
            Settings
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 12,
    fontWeight: '600',
  },
  authHeaderBar: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    paddingVertical: 4,
  },
  backButtonText: {
    fontSize: 13,
    fontWeight: '800',
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  brandingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoIcon: {
    fontSize: 16,
  },
  brandTitle: {
    fontSize: 13.5,
    fontWeight: '900',
    letterSpacing: -0.2,
    lineHeight: 16,
  },
  brandSubtitle: {
    fontSize: 9.5,
    fontWeight: '700',
    lineHeight: 12,
  },
  headerRightBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  signInPill: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 14,
    borderWidth: 1,
  },
  signInPillText: {
    fontSize: 11,
    fontWeight: '800',
  },
  userStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 14,
    borderWidth: 1,
    maxWidth: 110,
  },
  userPulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  userStatusText: {
    fontSize: 10.5,
    fontWeight: '800',
  },
  homeIconButton: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  homeIcon: {
    fontSize: 14,
  },
  mainContent: {
    flex: 1,
  },
  bottomTabBar: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderTopWidth: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    marginHorizontal: 3,
    borderRadius: 10,
    minHeight: 44,
  },
  tabIcon: {
    fontSize: 15,
  },
  tabLabel: {
    fontSize: 11.5,
    fontWeight: '800',
  },
});

module.exports = AppNavigator;
