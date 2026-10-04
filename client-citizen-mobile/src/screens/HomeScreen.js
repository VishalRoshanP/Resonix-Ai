/**
 * Citizen Home Screen for RESONIX AI Citizen Mobile (React Native)
 * 
 * 100% Parity with Citizen Web CitizenHomePage.jsx
 * 
 * Features:
 * - Top Telemetry Bar: Compact Location Detector & Network Status Widgets
 * - Live Rescue Dispatch Status Banner & Response Status (WAITING / ACKNOWLEDGED)
 * - Prominent Hero Circular SOS Button with Breathing Glow
 * - 1-Tap Quick Dial Emergency Helplines (112, 108, 101, 100)
 * - Cancel Emergency Request action (within 5 minutes of dispatch)
 * - Light Mode & Dark Mode support via Stitch Theme Tokens
 * - ZERO Mock Data Policy
 */

const React = require('react');
const { useState, useEffect, useRef, useContext } = React;
const {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Linking,
  Alert,
  Animated,
} = require('react-native');

const { AuthContext } = require('../context/AuthContext');
const { useTheme } = require('../context/ThemeContext');
const locationService = require('../services/locationService');
const networkUtil = require('../utils/network');
const apiService = require('../services/apiService');
const offlineQueueService = require('../services/offlineQueueService');
const storage = require('../utils/storage');
const ENV = require('../config/env');

function HomeScreen({ onOpenSOSModal, activeIncident, onCancelIncident }) {
  const { user, isCitizenGuest, guestId } = useContext(AuthContext);
  const { colors, isDark } = useTheme();

  // Network & GPS Telemetry State
  const [networkStatus, setNetworkStatus] = useState({ isOnline: true, checking: true, connectionType: 'DIRECT SERVER' });
  const [queuedCount, setQueuedCount] = useState(0);
  const [localHydratedIncident, setLocalHydratedIncident] = useState(null);

  // Restore active incident if prop was null (matches Web getStoredActiveIncident)
  useEffect(() => {
    if (!activeIncident) {
      storage.getItem(ENV.STORAGE_KEYS.ACTIVE_INCIDENT).then(async (saved) => {
        if (saved) {
          const s = String(saved.status || '').toUpperCase();
          if (s !== 'RESOLVED' && s !== 'COMPLETED' && s !== 'CLOSED' && s !== 'CANCELLED') {
            setLocalHydratedIncident(saved);
            return;
          }
        }
        try {
          const queue = await offlineQueueService.getQueue();
          const pending = (queue || []).find((q) => q.syncStatus === 'PENDING' || q.syncStatus === 'FAILED_RETRYABLE');
          if (pending && pending.payload) {
            setLocalHydratedIncident({
              ...pending.payload,
              packetId: pending.packetId,
              incident_id: pending.packetId,
              status: 'QUEUED_OFFLINE',
              timestamp: pending.createdAt,
            });
          }
        } catch (_) {}
      }).catch(() => {});
    }
  }, [activeIncident]);

  const currentIncident = activeIncident || localHydratedIncident;

  const [locationState, setLocationState] = useState({
    hasGps: false,
    latitude: null,
    longitude: null,
    accuracy: null,
    status: 'ACQUIRING_GPS',
  });
  const [isRefreshingGps, setIsRefreshingGps] = useState(false);

  // Dispatch Timer State
  const initialTimer = currentIncident?.timestamp
    ? Math.max(0, Math.floor((Date.now() - new Date(currentIncident.timestamp).getTime()) / 1000))
    : 0;
  const [sosTimer, setSosTimer] = useState(initialTimer);
  const initialAck = currentIncident?.acknowledgement || (currentIncident?.status === 'ACKNOWLEDGED' ? { status: 'ACKNOWLEDGED' } : { status: 'UNACKNOWLEDGED' });
  const [acknowledgementState, setAcknowledgementState] = useState(initialAck);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Sync acknowledgement state when incident updates
  useEffect(() => {
    if (currentIncident?.acknowledgement) {
      setAcknowledgementState(currentIncident.acknowledgement);
    } else if (currentIncident?.status === 'ACKNOWLEDGED') {
      setAcknowledgementState({ status: 'ACKNOWLEDGED' });
    }
  }, [currentIncident?.acknowledgement, currentIncident?.status]);

  // Subscribe to real-time incident lifecycle events
  useEffect(() => {
    try {
      const incidentLifecycleService = require('../services/incidentLifecycleService');
      const unsubscribe = incidentLifecycleService.subscribe((event) => {
        if (
          event.type === 'INCIDENT_ACKNOWLEDGED' ||
          (event.type === 'INCIDENT_STATUS_CHANGED' && event.status === 'ACKNOWLEDGED')
        ) {
          setAcknowledgementState({ status: 'ACKNOWLEDGED' });
        }
      });
      return unsubscribe;
    } catch (_) {}
  }, []);

  // Breathing animation for SOS button
  useEffect(() => {
    const breathing = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.06,
          duration: 1600,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1600,
          useNativeDriver: true,
        }),
      ])
    );
    breathing.start();
    return () => breathing.stop();
  }, [pulseAnim]);

  // Network check loop
  useEffect(() => {
    let isMounted = true;
    const checkNet = async () => {
      const res = await networkUtil.checkServerHealth();
      if (isMounted) {
        setNetworkStatus({
          isOnline: res.isOnline,
          checking: false,
          connectionType: res.connectionType || (res.isOnline ? 'DIRECT SERVER' : 'OFFLINE QUEUE'),
        });
      }
      try {
        const q = await offlineQueueService.getQueue();
        const pending = (q || []).filter((item) => item.syncStatus === 'PENDING' || item.syncStatus === 'FAILED_RETRYABLE');
        if (isMounted) setQueuedCount(pending.length);
      } catch (_) {}
    };
    checkNet();
    const interval = setInterval(checkNet, 10000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // GPS Acquisition
  const refreshLocation = async () => {
    setIsRefreshingGps(true);
    try {
      const loc = await locationService.getCurrentLocation();
      setLocationState(loc);
    } catch (err) {
      console.warn('[HomeScreen] Location error:', err.message);
    } finally {
      setIsRefreshingGps(false);
    }
  };

  useEffect(() => {
    refreshLocation();
  }, []);

  // Dispatched SOS Timer
  const isDispatched = Boolean(
    currentIncident &&
    currentIncident.status !== 'CANCELLED' &&
    currentIncident.status !== 'RESOLVED' &&
    currentIncident.status !== 'COMPLETED' &&
    currentIncident.status !== 'CLOSED'
  );

  useEffect(() => {
    if (currentIncident?.timestamp) {
      const elapsed = Math.max(0, Math.floor((Date.now() - new Date(currentIncident.timestamp).getTime()) / 1000));
      setSosTimer(elapsed);
    }
  }, [currentIncident?.timestamp]);

  useEffect(() => {
    let interval = null;
    if (isDispatched) {
      interval = setInterval(() => {
        setSosTimer((prev) => prev + 1);
      }, 1000);
    } else {
      setSosTimer(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isDispatched]);

  // Check acknowledgement and lifecycle status from server with periodic polling while dispatched
  useEffect(() => {
    let isMounted = true;
    if (currentIncident?.packetId || currentIncident?.incident_id) {
      const id = currentIncident.incident_id || currentIncident.packetId;
      const pollStatus = () => {
        apiService.getEmergencyStatus(id).then((res) => {
          if (!isMounted) return;
          const pkt = res?.data?.packet || res?.data?.incident || res?.packet || res?.incident || (res?.data?.status ? res.data : null);
          if (pkt) {
            const srvStatus = String(pkt.status || '').toUpperCase();
            if (srvStatus === 'RESOLVED' || srvStatus === 'COMPLETED' || srvStatus === 'CLOSED' || srvStatus === 'CANCELLED') {
              setLocalHydratedIncident(null);
              onCancelIncident && onCancelIncident(null);
              setSosTimer(0);
              Alert.alert('Emergency Alert Complete', `Your emergency request was ${srvStatus.toLowerCase()}. Home is ready for a new report.`);
              return;
            }
            if (pkt.acknowledgement) {
              setAcknowledgementState(pkt.acknowledgement);
            }
          }
        }).catch(() => {});
      };

      pollStatus();
      const interval = setInterval(pollStatus, 8000);
      return () => {
        isMounted = false;
        clearInterval(interval);
      };
    }
    return () => { isMounted = false; };
  }, [currentIncident]);

  const formatSec = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleDial = (tel) => {
    Linking.openURL(`tel:${tel}`).catch(() => {
      Alert.alert('Helpline Call', `Please dial ${tel} directly on your phone dialer.`);
    });
  };

  const isCancelled = String(currentIncident?.status || '').toUpperCase() === 'CANCELLED';

  // Field unit dispatch check (responder squad has been assigned or en route)
  const isFieldUnitDispatched = Boolean(
    currentIncident?.assignedUnit ||
    (Array.isArray(currentIncident?.assignedResponders) && currentIncident.assignedResponders.length > 0) ||
    currentIncident?.responseLifecycle?.dispatchTime ||
    ['EN_ROUTE', 'ON_SCENE', 'IN_PROGRESS'].includes(String(currentIncident?.status || '').toUpperCase())
  );

  // Determine if cancellation is allowed
  // Citizens can always cancel an active emergency alert; if units are already dispatched,
  // the confirmation dialog warns them that responding units will be stood down.
  const isCancellable = isDispatched;

  const [isCancelling, setIsCancelling] = useState(false);

  const handleCancelPress = () => {
    if (isCancelling) return;
    Alert.alert(
      'Cancel Emergency Alert?',
      isFieldUnitDispatched
        ? 'Emergency response teams have been notified or dispatched. Cancelling will notify responders to stand down. Are you sure you want to cancel?'
        : 'Are you sure you want to cancel this emergency alert? If emergency teams have not arrived, your alert will be removed from dispatch.',
      [
        { text: 'Keep Active', style: 'cancel' },
        {
          text: 'Cancel SOS',
          style: 'destructive',
          onPress: async () => {
            setIsCancelling(true);
            const targetId = currentIncident?.incident_id || currentIncident?.packetId || currentIncident?.id || currentIncident?._id;
            try {
              if (targetId) {
                await apiService.cancelSOS(targetId).catch((err) => {
                  console.warn('[HomeScreen] Mobile cancel API notice:', err.message);
                });
                await offlineQueueService.removeFromQueue(targetId).catch(() => {});
              }
            } finally {
              setIsCancelling(false);
            }
            // Clear active incident pointer so Home returns to READY and user can submit a new SOS
            setLocalHydratedIncident(null);
            onCancelIncident && onCancelIncident(currentIncident);
            setSosTimer(0);
            Alert.alert('Emergency Alert Cancelled', 'Your emergency request was cancelled. You can submit a new SOS if needed.');
          },
        },
      ]
    );
  };

  const isGpsReady = locationState.hasGps && locationState.latitude != null;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.contentContainer}
    >
      {/* 1. Top Telemetry Header Bar */}
      <View style={styles.telemetryRow}>
        {/* Location Status Widget */}
        <TouchableOpacity
          style={[styles.telemetryCard, { backgroundColor: colors.surfaceContainer, borderColor: colors.outlineVariant }]}
          onPress={refreshLocation}
          activeOpacity={0.7}
        >
          <View style={styles.telemetryHeader}>
            <Text
              style={[
                styles.statusDot,
                {
                  color: isGpsReady
                    ? colors.success
                    : locationState.status === 'PERMISSION_DENIED'
                    ? colors.error
                    : '#F59E0B',
                },
              ]}
            >
              {isGpsReady ? '✓' : isRefreshingGps ? '↻' : '●'}
            </Text>
            <Text style={[styles.telemetryTitle, { color: colors.primary }]}>
              {isGpsReady
                ? 'Location Ready'
                : isRefreshingGps
                ? 'Acquiring GPS...'
                : locationState.status === 'PERMISSION_DENIED'
                ? 'Permission Required'
                : locationState.status === 'GPS_UNAVAILABLE'
                ? 'Location Unavailable'
                : 'Acquiring GPS...'}
            </Text>
            <Text style={[styles.refreshIcon, { color: colors.secondary }]}>↻</Text>
          </View>
          <Text style={[styles.telemetrySubtext, { color: colors.subtleText }]} numberOfLines={1}>
            {isGpsReady
              ? `${locationState.latitude.toFixed(4)}°, ${locationState.longitude.toFixed(4)}°${locationState.accuracy ? ` • ±${locationState.accuracy}m` : ''}${locationState.isCached ? ' (Last known)' : ''}`
              : isRefreshingGps
              ? 'Connecting to device GPS...'
              : locationState.status === 'PERMISSION_DENIED'
              ? 'Tap to allow location access'
              : 'Tap to acquire GPS coordinates'}
          </Text>
        </TouchableOpacity>

        {/* Network Status Widget (Parity with Citizen Web NetworkStatusWidget) */}
        <View style={[styles.telemetryCard, { backgroundColor: colors.surfaceContainer, borderColor: colors.outlineVariant }]}>
          <View style={styles.telemetryHeader}>
            <Text style={[styles.statusDot, { color: networkStatus.isOnline ? colors.success : colors.error }]}>●</Text>
            <Text style={[styles.telemetryTitle, { color: networkStatus.isOnline ? colors.success : colors.primary }]}>
              {networkStatus.isOnline ? 'Network Connected' : 'Offline Mode'}
            </Text>
            <View
              style={[
                styles.telemetryBadge,
                {
                  backgroundColor: networkStatus.isOnline ? `${colors.success}20` : `${colors.error}20`,
                  borderColor: networkStatus.isOnline ? `${colors.success}50` : `${colors.error}50`,
                },
              ]}
            >
              <Text
                style={[
                  styles.telemetryBadgeText,
                  { color: networkStatus.isOnline ? colors.success : colors.error },
                ]}
              >
                {networkStatus.connectionType || (networkStatus.isOnline ? 'DIRECT SERVER' : 'OFFLINE QUEUE')}
              </Text>
            </View>
          </View>
          <Text style={[styles.telemetrySubtext, { color: colors.subtleText }]} numberOfLines={1}>
            {networkStatus.isOnline
              ? 'Emergency packets send instantly to backend'
              : (queuedCount > 0 ? `${queuedCount} packet(s) stored locally • Retrying...` : 'Offline Auto-Queue Ready')}
          </Text>
        </View>
      </View>

      {/* 2. Live Rescue Dispatch Status Banner */}
      <View
        style={[
          styles.dispatchBanner,
          {
            backgroundColor: isDispatched ? colors.errorContainer : colors.surfaceContainer,
            borderColor: isDispatched ? colors.error : colors.outlineVariant,
          },
        ]}
      >
        <View style={styles.dispatchHeader}>
          <View style={[styles.indicatorCircle, { backgroundColor: isDispatched ? colors.error : isCancelled ? colors.subtleText : colors.success }]} />
          <View style={styles.dispatchInfo}>
            <Text
              style={[
                styles.dispatchTitle,
                { color: isDispatched ? colors.error : isCancelled ? colors.subtleText : colors.primary },
              ]}
            >
              {isDispatched ? '🚨 RESCUE EN ROUTE' : isCancelled ? 'Emergency request cancelled' : 'READY FOR EMERGENCY REPORT'}
            </Text>
            <Text style={[styles.dispatchSubtitle, { color: colors.subtleText }]}>
              {isDispatched
                ? `Category: ${currentIncident?.category || 'CRITICAL'} • Timer: ${formatSec(sosTimer)}`
                : isCancelled
                ? 'You can submit a new request if you still need help.'
                : isCitizenGuest
                ? `Guest Session: ${guestId?.slice(0, 16) || 'Guest'}`
                : `Citizen: ${user?.name || 'Authorized'}`}
            </Text>
          </View>
        </View>

        {isDispatched && (
          <View style={[styles.activeBadge, { backgroundColor: colors.error }]}>
            <Text style={styles.activeBadgeText}>ACTIVE</Text>
          </View>
        )}
      </View>

      {/* 3. Response Status Section (Shown when dispatched) */}
      {isDispatched && (
        <View
          style={[
            styles.responseCard,
            {
              backgroundColor:
                acknowledgementState?.status === 'ACKNOWLEDGED'
                  ? colors.successContainer
                  : colors.surfaceContainer,
              borderColor:
                acknowledgementState?.status === 'ACKNOWLEDGED'
                  ? colors.success
                  : colors.outlineVariant,
            },
          ]}
        >
          <View style={styles.responseHeader}>
            <Text style={[styles.responseLabel, { color: colors.subtleText }]}>RESPONSE STATUS</Text>
            <View
              style={[
                styles.responseBadge,
                {
                  backgroundColor:
                    acknowledgementState?.status === 'ACKNOWLEDGED'
                      ? colors.success
                      : colors.surfaceContainerHigh,
                },
              ]}
            >
              <Text
                style={[
                  styles.responseBadgeText,
                  {
                    color:
                      acknowledgementState?.status === 'ACKNOWLEDGED'
                        ? '#FFFFFF'
                        : colors.primary,
                  },
                ]}
              >
                {acknowledgementState?.status === 'ACKNOWLEDGED' ? 'ACKNOWLEDGED' : 'WAITING'}
              </Text>
            </View>
          </View>

          <Text
            style={[
              styles.responseStatusText,
              {
                color:
                  acknowledgementState?.status === 'ACKNOWLEDGED'
                    ? colors.success
                    : colors.primary,
              },
            ]}
          >
            {acknowledgementState?.status === 'ACKNOWLEDGED'
              ? '✓ Response Team Has Seen Your Alert'
              : 'Waiting for responder acknowledgement'}
          </Text>
          <Text style={[styles.responseSubtext, { color: colors.subtleText }]}>
            {acknowledgementState?.status === 'ACKNOWLEDGED'
              ? 'Your emergency alert has been acknowledged. Help is being coordinated.'
              : 'First responders have been notified of your emergency.'}
          </Text>
        </View>
      )}

      {/* Field unit dispatch info notice on mobile (informational, does not block cancellation) */}
      {isDispatched && isFieldUnitDispatched && (
        <View style={[styles.cancelButton, { backgroundColor: colors.surfaceContainer, borderColor: colors.outlineVariant, flexDirection: 'row', gap: 6, alignItems: 'center' }]}>
          <Text style={{ fontSize: 14 }}>🛡️</Text>
          <Text style={[styles.responseSubtext, { color: colors.subtleText, flex: 1 }]}>
            Emergency services have been dispatched and are responding.
          </Text>
        </View>
      )}

      {/* Cancel Emergency Request Button — Always available while active */}
      {isCancellable && (
        <TouchableOpacity
          style={[styles.cancelButton, { backgroundColor: colors.surfaceContainer, borderColor: colors.outlineVariant }]}
          onPress={handleCancelPress}
          activeOpacity={0.8}
        >
          <Text style={[styles.cancelButtonText, { color: colors.error }]}>✕ Cancel emergency request</Text>
        </TouchableOpacity>
      )}

      {/* Cancelled — Success Message */}
      {isCancelled && (
        <View style={[styles.responseCard, { backgroundColor: colors.surfaceContainer, borderColor: colors.outlineVariant }]}>
          <Text style={[styles.responseStatusText, { color: colors.success }]}>
            ✓ Emergency request cancelled successfully
          </Text>
          <Text style={[styles.responseSubtext, { color: colors.subtleText }]}>
            If you cancelled by mistake, tap the SOS button below to submit a new emergency report.
          </Text>
        </View>
      )}

      {/* 4. Hero SOS Section */}
      <View
        style={[
          styles.heroCard,
          {
            backgroundColor: colors.surface,
            borderColor: colors.cardBorder,
          },
        ]}
      >
        <Text style={[styles.heroHeading, { color: colors.primary }]}>
          {isDispatched ? '🚨 Alert Active — First Responders Notified' : 'TAP SOS TO REPORT AN EMERGENCY'}
        </Text>
        <Text style={[styles.heroDescription, { color: colors.subtleText }]}>
          {isDispatched
            ? `Category: ${currentIncident?.category || 'CRITICAL'} • Response time: ${formatSec(sosTimer)}`
            : 'Immediate dispatch with automatic GPS location. Voice, photo & details are optional.'}
        </Text>

        {/* Circular Hero SOS Button with breathing scale animation */}
        <View style={styles.sosButtonOuterWrapper}>
          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <TouchableOpacity
              style={[
                styles.sosButton,
                {
                  backgroundColor: colors.error,
                  shadowColor: colors.error,
                },
              ]}
              onPress={isDispatched ? null : onOpenSOSModal}
              activeOpacity={isDispatched ? 1 : 0.9}
            >
              <Text style={styles.sosButtonIcon}>{isDispatched ? '🛡️' : '🚨'}</Text>
              <Text style={styles.sosButtonText}>{isDispatched ? 'ACTIVE' : 'SOS'}</Text>
              <Text style={styles.sosButtonSubtext}>{isDispatched ? 'DISPATCHED' : 'Emergency Alert'}</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </View>

      {/* 5. Quick Emergency Helpline Contacts Bar (112, 108, 101, 100) */}
      <View style={styles.helplineSection}>
        <Text style={[styles.sectionTitle, { color: colors.subtleText }]}>
          1-TAP QUICK DIAL HELPLINES
        </Text>
        <View style={styles.helplineGrid}>
          <TouchableOpacity
            style={[styles.helplineCard, { backgroundColor: '#FEE2E2', borderColor: '#FCA5A5' }]}
            onPress={() => handleDial('112')}
            activeOpacity={0.8}
          >
            <Text style={styles.helplineIcon}>📞</Text>
            <Text style={[styles.helplineNumber, { color: '#B91C1C' }]}>112</Text>
            <Text style={[styles.helplineLabel, { color: '#991B1B' }]}>National</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.helplineCard, { backgroundColor: colors.surfaceContainer, borderColor: colors.outlineVariant }]}
            onPress={() => handleDial('108')}
            activeOpacity={0.8}
          >
            <Text style={styles.helplineIcon}>🚑</Text>
            <Text style={[styles.helplineNumber, { color: colors.primary }]}>108</Text>
            <Text style={[styles.helplineLabel, { color: colors.subtleText }]}>Ambulance</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.helplineCard, { backgroundColor: colors.surfaceContainer, borderColor: colors.outlineVariant }]}
            onPress={() => handleDial('101')}
            activeOpacity={0.8}
          >
            <Text style={styles.helplineIcon}>🔥</Text>
            <Text style={[styles.helplineNumber, { color: colors.primary }]}>101</Text>
            <Text style={[styles.helplineLabel, { color: colors.subtleText }]}>Fire</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.helplineCard, { backgroundColor: colors.surfaceContainer, borderColor: colors.outlineVariant }]}
            onPress={() => handleDial('100')}
            activeOpacity={0.8}
          >
            <Text style={styles.helplineIcon}>👮</Text>
            <Text style={[styles.helplineNumber, { color: colors.primary }]}>100</Text>
            <Text style={[styles.helplineLabel, { color: colors.subtleText }]}>Police</Text>
          </TouchableOpacity>
        </View>
      </View>
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
  telemetryRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  telemetryCard: {
    flex: 1,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  telemetryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statusDot: {
    fontSize: 12,
  },
  telemetryTitle: {
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
  },
  telemetryBadge: {
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 1,
  },
  telemetryBadgeText: {
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  refreshIcon: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  telemetrySubtext: {
    fontSize: 10,
    marginTop: 2,
    fontFamily: 'monospace',
  },
  dispatchBanner: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dispatchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  indicatorCircle: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  dispatchInfo: {
    flex: 1,
  },
  dispatchTitle: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  dispatchSubtitle: {
    fontSize: 11,
    marginTop: 2,
  },
  activeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  activeBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    fontFamily: 'monospace',
  },
  responseCard: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  responseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  responseLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  responseBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  responseBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  responseStatusText: {
    fontSize: 12,
    fontWeight: '800',
    marginTop: 2,
  },
  responseSubtext: {
    fontSize: 11,
    marginTop: 2,
  },
  cancelButton: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    marginBottom: 12,
    minHeight: 46,
    justifyContent: 'center',
  },
  cancelButtonText: {
    fontSize: 12,
    fontWeight: '700',
  },
  heroCard: {
    padding: 24,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    marginBottom: 16,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  heroHeading: {
    fontSize: 15,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  heroDescription: {
    fontSize: 11.5,
    textAlign: 'center',
    marginTop: 4,
    maxWidth: 280,
    lineHeight: 16,
  },
  sosButtonOuterWrapper: {
    marginTop: 24,
    marginBottom: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sosButton: {
    width: 148,
    height: 148,
    borderRadius: 74,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 8,
  },
  sosButtonIcon: {
    fontSize: 32,
    marginBottom: 2,
  },
  sosButtonText: {
    fontSize: 30,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  sosButtonSubtext: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: 2,
  },
  helplineSection: {
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 8,
    paddingLeft: 2,
  },
  helplineGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  helplineCard: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    minHeight: 64,
    justifyContent: 'center',
  },
  helplineIcon: {
    fontSize: 18,
    marginBottom: 2,
  },
  helplineNumber: {
    fontSize: 14,
    fontWeight: '900',
  },
  helplineLabel: {
    fontSize: 9,
    fontWeight: '600',
    marginTop: 1,
  },
});

module.exports = HomeScreen;
