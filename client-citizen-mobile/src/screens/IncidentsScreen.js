/**
 * Incidents & Live Emergency Status Screen for RESONIX AI Citizen Mobile
 * 
 * 100% Feature Parity with Citizen Web CitizenStatusPage.jsx
 * 
 * Features:
 * - Active Emergency Live Telemetry & Tracking Banner
 * - Responder Acknowledgement Status (WAITING / ACKNOWLEDGED)
 * - Offline Queued Packets Status & Manual Sync
 * - Complete Incident History with Real Timestamps, Categories, and Status Badges
 * - Strict Zero Mock Data Policy: Shows Clean Empty State if 0 records
 * - Pull-to-Refresh Support
 * - Light Mode & Dark Mode Support
 */

const React = require('react');
const { useState, useEffect, useCallback, useContext } = React;
const {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert,
} = require('react-native');

const apiService = require('../services/apiService');
const offlineQueueService = require('../services/offlineQueueService');
const { useTheme } = require('../context/ThemeContext');
const { AuthContext } = require('../context/AuthContext');

function IncidentsScreen({ activeIncident, onNavigateToSOS }) {
  const { colors, isDark } = useTheme();
  const { user } = useContext(AuthContext);

  const [incidents, setIncidents] = useState([]);
  const [offlinePackets, setOfflinePackets] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [liveAckStatus, setLiveAckStatus] = useState(null);

  const fetchStatusAndHistory = useCallback(async () => {
    setErrorMsg(null);
    try {
      // 1. Fetch active incident live status if one exists
      if (activeIncident?.incident_id || activeIncident?.packetId) {
        const id = activeIncident.incident_id || activeIncident.packetId;
        try {
          const statusRes = await apiService.getEmergencyStatus(id);
          const data = statusRes?.data?.packet || statusRes?.data?.incident || statusRes?.packet || statusRes?.incident || (statusRes?.data?.status ? statusRes.data : null);
          if (data?.acknowledgement) {
            setLiveAckStatus(data.acknowledgement);
          }
        } catch (_) {}
      }

      // 2. Fetch offline queue items
      const queue = await offlineQueueService.getQueue();
      const pendingItems = queue.filter(
        (q) => q.syncStatus === 'PENDING' || q.syncStatus === 'FAILED_RETRYABLE'
      );
      setOfflinePackets(pendingItems);

      // 3. Fetch remote incident history from Express backend
      let remoteList = [];
      try {
        const res = await apiService.getEmergencies();
        if (Array.isArray(res)) remoteList = res;
        else if (res && Array.isArray(res.emergencies)) remoteList = res.emergencies;
        else if (res && Array.isArray(res.incidents)) remoteList = res.incidents;
        else if (res && Array.isArray(res.data)) remoteList = res.data;
      } catch (err) {
        console.warn('[IncidentsScreen] Remote history note:', err.message);
      }

      // 4. Fetch local cached incident history
      const localHistory = await offlineQueueService.getLocalIncidentHistory();

      // 5. Deduplicate and merge by packetId / incident_id
      const map = new Map();

      // Add queued items first
      pendingItems.forEach((item) => {
        map.set(item.packetId, {
          ...item.payload,
          incident_id: item.packetId,
          packetId: item.packetId,
          status: 'QUEUED_OFFLINE',
          syncStatus: 'FAILED_RETRYABLE',
          priority: 'HIGH',
          timestamp: item.createdAt,
        });
      });

      // Add local history
      localHistory.forEach((item) => {
        const id = item.incident_id || item.packetId || item._id;
        if (id && !map.has(id)) map.set(id, item);
      });

      // Add remote items (overrides local state with server state)
      remoteList.forEach((item) => {
        const id = item.incident_id || item.packetId || item._id;
        if (id) map.set(id, item);
      });

      setIncidents(Array.from(map.values()));
    } catch (err) {
      setErrorMsg(err.message || 'Unable to load incident history.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [activeIncident]);

  useEffect(() => {
    fetchStatusAndHistory();
  }, [fetchStatusAndHistory]);

  const onRefresh = () => {
    setIsRefreshing(true);
    fetchStatusAndHistory();
  };

  const handleSyncOffline = async () => {
    setIsRefreshing(true);
    const res = await offlineQueueService.syncQueue();
    if (res.isOffline) {
      Alert.alert('Offline', 'Server is currently unreachable. Packets remain queued safely.');
    } else {
      Alert.alert('Sync Complete', `Synchronized ${res.syncedCount} packet(s).`);
    }
    fetchStatusAndHistory();
  };

  const formatDateTime = (raw) => {
    if (!raw) return 'Recent';
    try {
      const d = new Date(raw);
      if (isNaN(d.getTime())) return 'Recent';
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ', ' + d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } catch (_) {
      return 'Recent';
    }
  };

  const renderHeader = () => {
    return (
      <View>
        {/* Offline Packets Notice */}
        {offlinePackets.length > 0 && (
          <View style={[styles.offlineNoticeCard, { backgroundColor: colors.secondaryLight, borderColor: colors.secondary }]}>
            <View style={styles.offlineNoticeHeader}>
              <Text style={styles.offlineNoticeIcon}>⚡</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.offlineNoticeTitle, { color: colors.secondary }]}>
                  {offlinePackets.length} Emergency Saved Offline
                </Text>
                <Text style={[styles.offlineNoticeSubtext, { color: colors.onSurfaceVariant }]}>
                  Stored on device and will synchronize when connection is restored.
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.syncButton, { backgroundColor: colors.secondary }]}
                onPress={handleSyncOffline}
              >
                <Text style={styles.syncButtonText}>Sync</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Live Active Incident Card (if active and not cancelled/resolved) */}
        {activeIncident && activeIncident.status !== 'CANCELLED' && activeIncident.status !== 'RESOLVED' && activeIncident.status !== 'COMPLETED' && (
          <View style={[styles.activeIncidentCard, { backgroundColor: colors.surface, borderColor: colors.error }]}>
            <View style={styles.activeIncidentTop}>
              <View style={[styles.liveDot, { backgroundColor: colors.error }]} />
              <Text style={[styles.activeIncidentHeading, { color: colors.error }]}>
                🚨 ACTIVE EMERGENCY IN PROGRESS
              </Text>
              <View style={[styles.activeStatusPill, { backgroundColor: colors.errorContainer }]}>
                <Text style={[styles.activeStatusPillText, { color: colors.error }]}>LIVE</Text>
              </View>
            </View>

            <Text style={[styles.activeCategory, { color: colors.primary }]}>
              {activeIncident.category || 'EMERGENCY ALERT'}
            </Text>

            <View style={[styles.ackStatusBox, { backgroundColor: colors.surfaceContainer, borderColor: colors.outlineVariant }]}>
              <Text style={[styles.ackLabel, { color: colors.subtleText }]}>RESPONDER ACKNOWLEDGEMENT</Text>
              <Text
                style={[
                  styles.ackValue,
                  { color: liveAckStatus?.status === 'ACKNOWLEDGED' ? colors.success : colors.secondary },
                ]}
              >
                {liveAckStatus?.status === 'ACKNOWLEDGED'
                  ? '✓ Response Team Has Seen Your Alert'
                  : 'Waiting for responder acknowledgement'}
              </Text>
              {liveAckStatus?.acknowledgedBy && (
                <Text style={[styles.ackResponder, { color: colors.subtleText }]}>
                  Acknowledged by: {liveAckStatus.acknowledgedBy}
                </Text>
              )}
            </View>
          </View>
        )}

        {/* Cancelled Incident Card */}
        {activeIncident && activeIncident.status === 'CANCELLED' && (
          <View style={[styles.activeIncidentCard, { backgroundColor: colors.surface, borderColor: colors.outlineVariant }]}>
            <View style={styles.activeIncidentTop}>
              <Text style={{ fontSize: 16 }}>✕</Text>
              <Text style={[styles.activeIncidentHeading, { color: colors.subtleText }]}>
                EMERGENCY REQUEST CANCELLED
              </Text>
              <View style={[styles.activeStatusPill, { backgroundColor: colors.surfaceContainerHigh }]}>
                <Text style={[styles.activeStatusPillText, { color: colors.subtleText }]}>CANCELLED</Text>
              </View>
            </View>

            <Text style={[styles.activeCategory, { color: colors.primary }]}>
              {activeIncident.category || 'EMERGENCY ALERT'}
            </Text>

            <View style={[styles.ackStatusBox, { backgroundColor: colors.surfaceContainer, borderColor: colors.outlineVariant }]}>
              <Text style={[styles.ackValue, { color: colors.subtleText }]}>
                This emergency alert was cancelled. You can return to Home to submit a new emergency if needed.
              </Text>
            </View>
          </View>
        )}

        <Text style={[styles.historyHeaderTitle, { color: colors.primary }]}>
          Incident Telemetry History
        </Text>
      </View>
    );
  };

  const renderEmptyComponent = () => {
    if (isLoading) return null;

    return (
      <View style={[styles.emptyContainer, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
        <Text style={styles.emptyIcon}>📋</Text>
        <Text style={[styles.emptyTitle, { color: colors.primary }]}>No Emergency Reports</Text>
        <Text style={[styles.emptySubtitle, { color: colors.subtleText }]}>
          When you submit an emergency SOS, incident status and live response updates will appear here.
        </Text>
        <TouchableOpacity
          style={[styles.emptySosButton, { backgroundColor: colors.error }]}
          onPress={() => onNavigateToSOS && onNavigateToSOS()}
        >
          <Text style={styles.emptySosButtonText}>🚨 Report SOS</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderItem = ({ item }) => {
    const category = item.category || item.disaster_type || item.selectedCategory || 'EMERGENCY';
    const status = item.status || (item.syncStatus === 'FAILED_RETRYABLE' ? 'QUEUED_OFFLINE' : 'REPORTED');
    const isAck = item.acknowledgement?.status === 'ACKNOWLEDGED' || status === 'ACKNOWLEDGED';
    const isQueued = status === 'QUEUED_OFFLINE';

    return (
      <View style={[styles.incidentCard, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
        <View style={styles.cardHeader}>
          <View style={styles.categoryBadgeRow}>
            <View style={[styles.categoryBadge, { backgroundColor: colors.surfaceContainer }]}>
              <Text style={[styles.categoryBadgeText, { color: colors.primary }]}>{category}</Text>
            </View>
            {isQueued && (
              <View style={[styles.queuedBadge, { backgroundColor: colors.secondaryLight }]}>
                <Text style={[styles.queuedBadgeText, { color: colors.secondary }]}>⚡ OFFLINE QUEUED</Text>
              </View>
            )}
          </View>

          <View
            style={[
              styles.statusPill,
              {
                backgroundColor: isAck ? colors.successContainer : isQueued ? colors.secondaryLight : colors.surfaceContainerHigh,
              },
            ]}
          >
            <Text
              style={[
                styles.statusPillText,
                { color: isAck ? colors.success : isQueued ? colors.secondary : colors.primary },
              ]}
            >
              {isAck ? 'ACKNOWLEDGED' : status}
            </Text>
          </View>
        </View>

        <Text style={[styles.incidentDesc, { color: colors.primary }]} numberOfLines={2}>
          {item.description || item.transcript || `${category} emergency reported.`}
        </Text>

        {item.gpsCoordinates?.sector ? (
          <Text style={[styles.locationSector, { color: colors.subtleText }]} numberOfLines={1}>
            📍 {item.gpsCoordinates.sector}
          </Text>
        ) : null}

        <View style={[styles.cardFooter, { borderTopColor: colors.outlineVariant }]}>
          <Text style={[styles.incidentIdText, { color: colors.subtleText }]}>
            ID: {(item.packetId || item.incident_id || '').slice(0, 16)}
          </Text>
          <Text style={[styles.incidentTimeText, { color: colors.subtleText }]}>
            {formatDateTime(item.timestamp || item.createdAt)}
          </Text>
        </View>
      </View>
    );
  };

  if (isLoading && !isRefreshing) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.secondary} />
        <Text style={[styles.loadingText, { color: colors.subtleText }]}>Loading emergency telemetry...</Text>
      </View>
    );
  }

  return (
    <FlatList
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.contentContainer}
      data={incidents}
      keyExtractor={(item, index) => item.packetId || item.incident_id || String(index)}
      renderItem={renderItem}
      ListHeaderComponent={renderHeader}
      ListEmptyComponent={renderEmptyComponent}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={onRefresh}
          colors={[colors.secondary]}
          tintColor={colors.secondary}
        />
      }
    />
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 12,
  },
  offlineNoticeCard: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 14,
  },
  offlineNoticeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  offlineNoticeIcon: {
    fontSize: 20,
  },
  offlineNoticeTitle: {
    fontSize: 12.5,
    fontWeight: '800',
  },
  offlineNoticeSubtext: {
    fontSize: 10.5,
    marginTop: 2,
  },
  syncButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  syncButtonText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  activeIncidentCard: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 2,
    marginBottom: 16,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  activeIncidentTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  activeIncidentHeading: {
    fontSize: 11,
    fontWeight: '900',
    flex: 1,
    letterSpacing: 0.5,
  },
  activeStatusPill: {
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  activeStatusPillText: {
    fontSize: 9,
    fontWeight: '900',
  },
  activeCategory: {
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 10,
  },
  ackStatusBox: {
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  ackLabel: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  ackValue: {
    fontSize: 12,
    fontWeight: '800',
  },
  ackResponder: {
    fontSize: 10,
    marginTop: 4,
  },
  historyHeaderTitle: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 10,
    marginTop: 4,
  },
  incidentCard: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  categoryBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  categoryBadge: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  categoryBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  queuedBadge: {
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  queuedBadgeText: {
    fontSize: 9,
    fontWeight: '800',
  },
  statusPill: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '800',
  },
  incidentDesc: {
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 6,
  },
  locationSector: {
    fontSize: 10.5,
    fontFamily: 'monospace',
    marginBottom: 8,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    paddingTop: 8,
    marginTop: 2,
  },
  incidentIdText: {
    fontSize: 10,
    fontFamily: 'monospace',
  },
  incidentTimeText: {
    fontSize: 10,
  },
  emptyContainer: {
    padding: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    marginTop: 24,
  },
  emptyIcon: {
    fontSize: 36,
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  emptySubtitle: {
    fontSize: 11.5,
    textAlign: 'center',
    marginTop: 6,
    maxWidth: 260,
    lineHeight: 18,
  },
  emptySosButton: {
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  emptySosButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
});

module.exports = IncidentsScreen;
