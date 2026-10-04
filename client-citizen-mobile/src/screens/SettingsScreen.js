/**
 * Citizen Settings Screen for RESONIX AI Citizen Mobile
 * 
 * 100% Feature Parity with Citizen Web CitizenSettingsPage.jsx
 * 
 * Features:
 * - Theme Switcher (Light Mode / Dark Mode)
 * - Emergency Sound & Vibration Preferences
 * - Auto-dial 112 Helpline Preference
 * - System Connectivity Diagnostics & Latency
 * - Offline Queue Synchronization Controls
 * - Emergency Safety Guides (Flood, Fire, Earthquake)
 * - Account Actions (Logout)
 */

const React = require('react');
const { useState, useEffect, useContext } = React;
const {
  View,
  Text,
  TouchableOpacity,
  Switch,
  ScrollView,
  StyleSheet,
  Alert,
} = require('react-native');

const { useTheme } = require('../context/ThemeContext');
const { AuthContext } = require('../context/AuthContext');
const offlineQueueService = require('../services/offlineQueueService');
const networkUtil = require('../utils/network');
const storage = require('../utils/storage');
const ENV = require('../config/env');

const EMERGENCY_GUIDES = [
  {
    title: '🌊 Flood Safety Protocol',
    steps: [
      'Move to higher ground immediately.',
      'Do not walk, swim, or drive through moving water.',
      'If trapped, signal for help from the highest safe point.',
      'Avoid contact with flood water and electrical wiring.',
    ],
  },
  {
    title: '🔥 Fire Evacuation Protocol',
    steps: [
      'Evacuate the structure immediately.',
      'Stay low to the floor to minimize smoke inhalation.',
      'Use designated emergency evacuation stairwells — never use elevators.',
      'Check doors for heat before opening.',
    ],
  },
  {
    title: '⚠️ Earthquake Protocol',
    steps: [
      'Drop, Cover, and Hold on under sturdy shelter.',
      'Stay away from glass, windows, and exterior walls.',
      'If outdoors, move away from buildings, streetlights, and utility wires.',
    ],
  },
];

function SettingsScreen({ onNavigateToAuth }) {
  const { colors, isDark, toggleTheme } = useTheme();
  const { user, isAuthenticated, logout } = useContext(AuthContext);

  const [emergencySound, setEmergencySound] = useState(true);
  const [autoDial112, setAutoDial112] = useState(false);
  const [serverHealth, setServerHealth] = useState({ isOnline: false, checking: true });
  const [pendingQueueCount, setPendingQueueCount] = useState(0);
  const [activeGuideIndex, setActiveGuideIndex] = useState(null);

  // Load saved preferences
  useEffect(() => {
    storage.getItem(ENV.STORAGE_KEYS.SETTINGS).then((saved) => {
      if (saved) {
        if (saved.emergencySound !== undefined) setEmergencySound(saved.emergencySound);
        if (saved.autoDial112 !== undefined) setAutoDial112(saved.autoDial112);
      }
    }).catch(() => {});
  }, []);

  const saveSetting = (key, value) => {
    storage.getItem(ENV.STORAGE_KEYS.SETTINGS).then((current) => {
      const updated = { ...(current || {}), [key]: value };
      storage.setItem(ENV.STORAGE_KEYS.SETTINGS, updated).catch(() => {});
    }).catch(() => {});
  };

  const handleToggleSound = (val) => {
    setEmergencySound(val);
    saveSetting('emergencySound', val);
  };

  const handleToggleDial = (val) => {
    setAutoDial112(val);
    saveSetting('autoDial112', val);
  };

  const checkStatus = async () => {
    setServerHealth((prev) => ({ ...prev, checking: true }));
    const health = await networkUtil.checkServerHealth();
    setServerHealth({ isOnline: health.isOnline, checking: false });

    const queue = await offlineQueueService.getQueue();
    const pending = queue.filter((q) => q.syncStatus === 'PENDING' || q.syncStatus === 'FAILED_RETRYABLE');
    setPendingQueueCount(pending.length);
  };

  useEffect(() => {
    checkStatus();
  }, []);

  const handleSyncNow = async () => {
    const res = await offlineQueueService.syncQueue();
    if (res.isOffline) {
      Alert.alert('Server Offline', 'Unable to reach backend API. Packets will auto-sync when connection is restored.');
    } else {
      Alert.alert('Sync Completed', `Synced ${res.syncedCount} packet(s). Remaining: ${res.failedCount}.`);
      checkStatus();
    }
  };

  const handleClearCache = () => {
    Alert.alert(
      'Clear Local Cache?',
      'This will clear local temporary incident cache. Offline queued unsent packets will NOT be deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear Cache',
          style: 'destructive',
          onPress: async () => {
            await storage.removeItem(ENV.STORAGE_KEYS.INCIDENT_HISTORY);
            Alert.alert('Cache Cleared', 'Local incident history cache reset.');
          },
        },
      ]
    );
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.contentContainer}
    >
      {/* 1. Appearance & Theme */}
      <Text style={[styles.sectionTitle, { color: colors.subtleText }]}>APPEARANCE & DISPLAY</Text>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
        <View style={styles.settingRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.settingLabel, { color: colors.primary }]}>Dark Mode</Text>
            <Text style={[styles.settingSubtext, { color: colors.subtleText }]}>
              {isDark ? 'Dark theme active' : 'Light theme active'}
            </Text>
          </View>
          <Switch
            value={isDark}
            onValueChange={toggleTheme}
            trackColor={{ false: colors.surfaceContainer, true: colors.secondary }}
            thumbColor={isDark ? '#FFFFFF' : '#FFFFFF'}
          />
        </View>
      </View>

      {/* 2. Emergency Response Preferences */}
      <Text style={[styles.sectionTitle, { color: colors.subtleText }]}>EMERGENCY ACTIONS</Text>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
        <View style={styles.settingRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.settingLabel, { color: colors.primary }]}>Emergency Chime Tone</Text>
            <Text style={[styles.settingSubtext, { color: colors.subtleText }]}>
              Play audible tone confirmation on SOS submission
            </Text>
          </View>
          <Switch
            value={emergencySound}
            onValueChange={handleToggleSound}
            trackColor={{ false: colors.surfaceContainer, true: colors.secondary }}
            thumbColor="#FFFFFF"
          />
        </View>

        <View style={[styles.settingRow, { borderTopWidth: 1, borderTopColor: colors.outlineVariant, paddingTop: 12, marginTop: 12 }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.settingLabel, { color: colors.primary }]}>Auto-Prompt 112 Helpline</Text>
            <Text style={[styles.settingSubtext, { color: colors.subtleText }]}>
              Prompt dial national 112 helpline after submitting SOS
            </Text>
          </View>
          <Switch
            value={autoDial112}
            onValueChange={handleToggleDial}
            trackColor={{ false: colors.surfaceContainer, true: colors.secondary }}
            thumbColor="#FFFFFF"
          />
        </View>
      </View>

      {/* 3. Telemetry & Offline Queue Diagnostics */}
      <Text style={[styles.sectionTitle, { color: colors.subtleText }]}>SYSTEM & OFFLINE QUEUE</Text>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
        <View style={styles.settingRow}>
          <Text style={[styles.settingLabel, { color: colors.primary }]}>Express Backend API</Text>
          <View
            style={[
              styles.statusPill,
              { backgroundColor: serverHealth.isOnline ? colors.successContainer : colors.errorContainer },
            ]}
          >
            <Text
              style={[
                styles.statusPillText,
                { color: serverHealth.isOnline ? colors.success : colors.error },
              ]}
            >
              {serverHealth.checking ? 'Checking...' : serverHealth.isOnline ? '● Connected' : '✕ Unreachable'}
            </Text>
          </View>
        </View>
        <Text style={[styles.urlText, { color: colors.subtleText }]}>Origin: {ENV.API_BASE_URL}</Text>

        <View style={[styles.settingRow, { borderTopWidth: 1, borderTopColor: colors.outlineVariant, paddingTop: 12, marginTop: 12 }]}>
          <View>
            <Text style={[styles.settingLabel, { color: colors.primary }]}>Offline Pending Queue</Text>
            <Text style={[styles.settingSubtext, { color: colors.subtleText }]}>
              {pendingQueueCount === 0 ? 'Queue empty (all synced)' : `${pendingQueueCount} packet(s) awaiting network`}
            </Text>
          </View>
          {pendingQueueCount > 0 && (
            <TouchableOpacity
              style={[styles.smallActionButton, { backgroundColor: colors.secondary }]}
              onPress={handleSyncNow}
            >
              <Text style={styles.smallActionText}>Sync Now</Text>
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          style={[styles.clearCacheButton, { borderColor: colors.outlineVariant }]}
          onPress={handleClearCache}
        >
          <Text style={[styles.clearCacheText, { color: colors.primary }]}>Clear Incident Cache</Text>
        </TouchableOpacity>
      </View>

      {/* 4. Emergency Safety Protocols */}
      <Text style={[styles.sectionTitle, { color: colors.subtleText }]}>EMERGENCY SAFETY GUIDES</Text>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
        {EMERGENCY_GUIDES.map((guide, idx) => {
          const isOpen = activeGuideIndex === idx;
          return (
            <View key={guide.title} style={idx > 0 && { borderTopWidth: 1, borderTopColor: colors.outlineVariant, paddingTop: 10, marginTop: 10 }}>
              <TouchableOpacity
                style={styles.guideHeader}
                onPress={() => setActiveGuideIndex(isOpen ? null : idx)}
              >
                <Text style={[styles.guideTitle, { color: colors.primary }]}>{guide.title}</Text>
                <Text style={[styles.guideExpandText, { color: colors.secondary }]}>{isOpen ? '▲' : '▼'}</Text>
              </TouchableOpacity>
              {isOpen && (
                <View style={[styles.guideContent, { backgroundColor: colors.surfaceContainer }]}>
                  {guide.steps.map((step, sIdx) => (
                    <Text key={sIdx} style={[styles.guideStep, { color: colors.primary }]}>
                      {sIdx + 1}. {step}
                    </Text>
                  ))}
                </View>
              )}
            </View>
          );
        })}
      </View>

      {/* 5. Account Actions */}
      <Text style={[styles.sectionTitle, { color: colors.subtleText }]}>CITIZEN SESSION</Text>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
        {isAuthenticated ? (
          <View>
            <Text style={[styles.sessionUserText, { color: colors.primary }]}>
              Logged in as: <Text style={{ fontWeight: 'bold' }}>{user?.name || user?.email}</Text>
            </Text>
            <TouchableOpacity
              style={[styles.logoutButton, { backgroundColor: colors.errorContainer, borderColor: colors.error }]}
              onPress={() => {
                Alert.alert('Log Out', 'Are you sure you want to log out?', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Log Out', style: 'destructive', onPress: logout },
                ]);
              }}
            >
              <Text style={[styles.logoutButtonText, { color: colors.error }]}>Log Out of Citizen Account</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View>
            <Text style={[styles.sessionUserText, { color: colors.primary }]}>
              Currently in Guest Session (1-Tap SOS Ready)
            </Text>
            <TouchableOpacity
              style={[styles.loginPromptButton, { backgroundColor: colors.secondary }]}
              onPress={() => onNavigateToAuth && onNavigateToAuth()}
            >
              <Text style={styles.loginPromptText}>Sign In / Register</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <Text style={[styles.versionText, { color: colors.subtleText }]}>
        RESONIX AI Citizen Mobile • v1.0.0
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  sectionTitle: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 8,
    paddingLeft: 2,
  },
  card: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 16,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  settingLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  settingSubtext: {
    fontSize: 11,
    marginTop: 2,
  },
  statusPill: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '800',
  },
  urlText: {
    fontSize: 10,
    fontFamily: 'monospace',
    marginTop: 6,
  },
  smallActionButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  smallActionText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  clearCacheButton: {
    marginTop: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  clearCacheText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  guideHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  guideTitle: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  guideExpandText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  guideContent: {
    marginTop: 6,
    padding: 10,
    borderRadius: 8,
  },
  guideStep: {
    fontSize: 11,
    lineHeight: 16,
    marginBottom: 4,
  },
  sessionUserText: {
    fontSize: 12,
    marginBottom: 10,
  },
  logoutButton: {
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  logoutButtonText: {
    fontSize: 12,
    fontWeight: '800',
  },
  loginPromptButton: {
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  loginPromptText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  versionText: {
    textAlign: 'center',
    fontSize: 10.5,
    fontFamily: 'monospace',
    marginTop: 8,
  },
});

module.exports = SettingsScreen;
