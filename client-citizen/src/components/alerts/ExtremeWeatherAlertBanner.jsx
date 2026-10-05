import React, { useState, useEffect, useCallback, useRef } from 'react';
import { weatherAlertApi } from '../../services/api';
import { citizenSocketClient } from '../../services/socketClient';

/**
 * Extreme Weather Alert Banner (SIH26068)
 * 
 * Displays verified, official extreme meteorological hazard alerts.
 * Features:
 * - Real-time Socket.IO ingestion & deduplication
 * - Web Notification API push alerts
 * - Countdown timer to alert expiry
 * - Cached latest warning recovery on mount/offline
 * - Offline badge indicator
 * - Alert history panel
 * - Gemini plain-language explanation drawer (retrieved alerts only)
 */
export default function ExtremeWeatherAlertBanner({ userCoordinates = null, className = '' }) {
  const [activeAlerts, setActiveAlerts] = useState([]);
  const [acknowledgedAlertIds, setAcknowledgedAlertIds] = useState(() => {
    try {
      const stored = localStorage.getItem('resonix_acknowledged_alerts');
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch (_) {
      return new Set();
    }
  });
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyList, setHistoryList] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [explainingAlert, setExplainingAlert] = useState(null);
  const [explanationData, setExplanationData] = useState(null);
  const [isExplaining, setIsExplaining] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState(
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'denied'
  );

  const seenFingerprintsRef = useRef(new Set());

  // 1. Web Notification Trigger
  const triggerPushNotification = useCallback((alert) => {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        const title = `🚨 [${alert.severity?.toUpperCase() || 'WARNING'}] ${alert.alertType || 'Extreme Weather'}`;
        const options = {
          body: `${alert.headline || alert.recommendedAction || 'Extreme weather warning in effect.'} (Area: ${alert.affectedArea?.name || 'Local Zone'})`,
          icon: '/favicon.ico',
          tag: alert.fingerprint || alert._id || 'resonix-weather-alert',
          renotify: true,
        };
        new Notification(title, options);
      } catch (err) {
        console.warn('[ExtremeWeatherAlertBanner] Web notification error:', err.message);
      }
    }
  }, []);

  // Request Push Permission
  const requestNotificationPermission = async () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      try {
        const perm = await Notification.requestPermission();
        setNotificationPermission(perm);
      } catch (err) {
        console.warn('[ExtremeWeatherAlertBanner] Permission request error:', err.message);
      }
    }
  };

  // 2. Fetch Active and Latest Cached Warnings
  const fetchActiveAlerts = useCallback(async () => {
    try {
      const lat = userCoordinates?.latitude;
      const lon = userCoordinates?.longitude;
      const res = await weatherAlertApi.getActiveAlerts(lat, lon);
      
      if (res?.data?.alerts) {
        const unexpired = res.data.alerts.filter((a) => {
          if (!a.expiryTime) return true;
          return new Date(a.expiryTime).getTime() > Date.now();
        });

        setActiveAlerts(unexpired);
        
        // Cache latest in localStorage for instant offline access
        if (unexpired.length > 0) {
          try {
            localStorage.setItem('resonix_cached_weather_alert', JSON.stringify(unexpired[0]));
          } catch (_) {}
        }
      }
    } catch (err) {
      console.warn('[ExtremeWeatherAlertBanner] Active alerts fetch note:', err.message);
      // If network fails (offline), load from local cache
      try {
        const cached = localStorage.getItem('resonix_cached_weather_alert');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed && (!parsed.expiryTime || new Date(parsed.expiryTime).getTime() > Date.now())) {
            parsed._isOfflineCached = true;
            setActiveAlerts([parsed]);
          }
        }
      } catch (_) {}
    }
  }, [userCoordinates]);

  // Network offline/online listeners
  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      fetchActiveAlerts();
    };
    const handleOffline = () => {
      setIsOffline(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [fetchActiveAlerts]);

  // Initial fetch on mount or coordinate change
  useEffect(() => {
    fetchActiveAlerts();
  }, [fetchActiveAlerts]);

  // 3. Socket.IO Real-Time Listener
  useEffect(() => {
    const unsubscribe = citizenSocketClient.subscribe((event) => {
      if (event.type === 'WEATHER_ALERT' && event.alert) {
        const newAlert = event.alert;
        const fp = newAlert.fingerprint || newAlert._id || `${newAlert.alertType}_${newAlert.startTime}`;

        if (seenFingerprintsRef.current.has(fp)) {
          return; // Prevent duplicate alert handling
        }
        seenFingerprintsRef.current.add(fp);

        // Check if expired
        if (newAlert.expiryTime && new Date(newAlert.expiryTime).getTime() <= Date.now()) {
          return;
        }

        // Add or update active alert
        setActiveAlerts((prev) => {
          const filtered = prev.filter((a) => a.fingerprint !== fp && a._id !== newAlert._id);
          return [newAlert, ...filtered];
        });

        // Trigger push notification
        triggerPushNotification(newAlert);
      } else if (event.type === 'WEATHER_WARNING' && event.warning) {
        // Handle individual warning broadcasts from weather ingestion worker
        const warning = event.warning;
        const warnId = warning.id || warning.fingerprint || `${warning.event}_${warning.startTime || Date.now()}`;

        if (seenFingerprintsRef.current.has(warnId)) return;
        seenFingerprintsRef.current.add(warnId);

        if (warning.severity === 'EXTREME' || warning.severity === 'SEVERE') {
          triggerPushNotification({
            alertType: warning.event || 'Weather Warning',
            headline: warning.headline || warning.event,
            severity: warning.severity,
            recommendedAction: warning.safetyRecommendation || warning.description,
            fingerprint: warnId,
          });
        }
      } else if (event.type === 'SOCKET_RECONNECTED') {
        // After socket reconnection, fetch latest active alerts from backend
        console.log('[ExtremeWeatherAlertBanner] 🔄 Socket reconnected. Fetching latest alerts...');
        fetchActiveAlerts();
      }
    });

    return () => {
      unsubscribe();
    };
  }, [triggerPushNotification, fetchActiveAlerts]);


  // 4. Periodic Expiry Sweeper (Checks every 15s)
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setActiveAlerts((prev) => {
        const valid = prev.filter((a) => {
          if (!a.expiryTime) return true;
          return new Date(a.expiryTime).getTime() > now;
        });
        if (valid.length !== prev.length) {
          return valid;
        }
        return prev;
      });
    }, 15000);

    return () => clearInterval(interval);
  }, []);

  // Acknowledge Alert Handler
  const handleAcknowledge = (alertId) => {
    setAcknowledgedAlertIds((prev) => {
      const next = new Set(prev);
      next.add(alertId);
      try {
        localStorage.setItem('resonix_acknowledged_alerts', JSON.stringify(Array.from(next)));
      } catch (_) {}
      return next;
    });
  };

  // Open Alert History
  const handleOpenHistory = async () => {
    setHistoryOpen(true);
    setHistoryLoading(true);
    try {
      const res = await weatherAlertApi.getAlertHistory({ limit: 20 });
      if (res?.data?.history) {
        setHistoryList(res.data.history);
      }
    } catch (err) {
      console.warn('[ExtremeWeatherAlertBanner] History load note:', err.message);
    } finally {
      setHistoryLoading(false);
    }
  };

  // Explain Alert with AI Handler (STRICT: Grounded explanations only)
  const handleExplain = async (alert) => {
    setExplainingAlert(alert);
    setExplanationData(null);
    setIsExplaining(true);
    try {
      const res = await weatherAlertApi.explainAlert(alert, alert._id || alert.id, 'en');
      if (res?.data) {
        setExplanationData(res.data);
      }
    } catch (err) {
      setExplanationData({
        explanation: 'Could not generate AI explanation. Please adhere strictly to official instructions: ' + (alert.recommendedAction || 'Stay indoors.'),
        actionChecklist: ['Monitor official broadcasts', 'Secure outdoor items', 'Stay in a sturdy shelter'],
      });
    } finally {
      setIsExplaining(false);
    }
  };

  // Filter unacknowledged alerts for the main banner
  const visibleAlerts = activeAlerts.filter((a) => !acknowledgedAlertIds.has(a._id || a.id || a.fingerprint));

  if (visibleAlerts.length === 0 && !historyOpen) {
    return null; // Silent when no active alerts
  }

  // Top alert to display prominently
  const topAlert = visibleAlerts[0];

  const getSeverityStyle = (severity) => {
    const s = String(severity || '').toUpperCase();
    if (s === 'EXTREME' || s === 'CRITICAL') {
      return {
        banner: 'bg-red-950/90 border-red-600 text-red-100 shadow-xl shadow-red-950/40 animate-pulse-slow',
        badge: 'bg-red-600 text-white font-black tracking-wider',
        btn: 'bg-red-600 hover:bg-red-500 text-white font-bold',
        icon: 'warning',
        label: '🔴 SEVERE WARNING',
      };
    }
    if (s === 'SEVERE' || s === 'HIGH') {
      return {
        banner: 'bg-amber-950/90 border-amber-500 text-amber-100 shadow-lg shadow-amber-950/30',
        badge: 'bg-amber-500 text-slate-950 font-black tracking-wider',
        btn: 'bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold',
        icon: 'report_problem',
        label: '🔴 SEVERE WARNING',
      };
    }
    return {
      banner: 'bg-blue-950/80 border-cyan-500 text-cyan-100',
      badge: 'bg-cyan-500 text-slate-950 font-bold',
      btn: 'bg-cyan-600 hover:bg-cyan-500 text-white font-bold',
      icon: 'info',
      label: '🟠 WEATHER ADVISORY',
    };
  };

  const style = topAlert ? getSeverityStyle(topAlert.severity) : {};

  // Formatter for countdown
  const getRemainingTimeText = (expiryTime) => {
    if (!expiryTime) return 'Until further notice';
    const diff = new Date(expiryTime).getTime() - Date.now();
    if (diff <= 0) return 'Expired';
    const mins = Math.floor(diff / (60 * 1000));
    const hours = Math.floor(mins / 60);
    if (hours > 0) {
      return `Expires in ${hours}h ${mins % 60}m`;
    }
    return `Expires in ${mins}m`;
  };

  return (
    <>
      {topAlert && (
        <div
          id="resonix-extreme-weather-alert-banner"
          role="alert"
          aria-live="assertive"
          aria-atomic="true"
          className={`relative rounded-2xl border-2 p-4 sm:p-5 mb-4 backdrop-blur-md transition-all duration-300 ${style.banner} ${className}`}
        >
          {/* Header Row */}
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`material-symbols-outlined text-2xl ${topAlert.severity === 'EXTREME' ? 'animate-bounce' : ''}`} aria-hidden="true">
                {style.icon}
              </span>
              <span className={`px-2.5 py-1 rounded-full text-xs uppercase tracking-widest font-black flex items-center gap-1 ${style.badge}`}>
                <span>{style.label || '🔴 SEVERE WARNING'}</span>
              </span>
              <span className="text-xs font-mono font-semibold opacity-90">
                {topAlert.alertType || 'Severe Weather'}
              </span>
              {topAlert._isOfflineCached && (
                <span className="px-2 py-0.5 rounded bg-yellow-500/20 text-yellow-300 border border-yellow-500/40 text-[10px] font-mono">
                  OFFLINE CACHE
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 text-xs font-mono opacity-80">
              <span className="material-symbols-outlined text-sm" aria-hidden="true">schedule</span>
              <span>{getRemainingTimeText(topAlert.expiryTime)}</span>
            </div>
          </div>

          {/* Headline and Advisory */}
          <div className="mb-3">
            <h3 className="text-base sm:text-lg font-extrabold tracking-tight leading-snug mb-1">
              {topAlert.headline || `${topAlert.alertType} Warning`}
            </h3>
            {topAlert.affectedArea?.name && (
              <p className="text-xs font-mono opacity-85 mb-2 flex items-center gap-1">
                <span className="material-symbols-outlined text-sm" aria-hidden="true">location_on</span>
                Affected Area: <span className="font-bold">{topAlert.affectedArea.name}</span>
                {topAlert.affectedArea?.radiusKm ? ` (${topAlert.affectedArea.radiusKm} km radius)` : ''}
              </p>
            )}
            <div className="bg-black/30 rounded-xl p-3 border border-white/10 text-xs sm:text-sm font-medium leading-relaxed">
              <span className="font-bold underline mr-1">Recommended Action:</span>
              {topAlert.recommendedAction || 'Seek sturdy shelter immediately and follow civil defense directives.'}
            </div>
          </div>

          {/* Metadata Row & Action Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-white/10 text-xs">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 opacity-75 font-mono text-[11px]">
              {topAlert.source && <span>Source: {topAlert.source}</span>}
              {topAlert.startTime && (
                <span>From: {new Date(topAlert.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              )}
              {topAlert.expiryTime && (
                <span>Until: {new Date(topAlert.expiryTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              )}
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap">
              {notificationPermission === 'default' && (
                <button
                  type="button"
                  onClick={requestNotificationPermission}
                  className="min-h-[44px] px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer"
                  title="Enable browser notifications"
                  aria-label="Enable browser push notifications"
                >
                  <span className="material-symbols-outlined text-sm" aria-hidden="true">notifications_active</span>
                  <span>Push Alerts</span>
                </button>
              )}

              <button
                id="btn-explain-alert-ai"
                type="button"
                onClick={() => handleExplain(topAlert)}
                className="min-h-[44px] px-3.5 py-2 rounded-xl bg-indigo-600/80 hover:bg-indigo-600 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                aria-label="Explain warning with WeatherGPT AI"
              >
                <span className="material-symbols-outlined text-sm" aria-hidden="true">psychology</span>
                <span>Explain with AI</span>
              </button>

              <button
                type="button"
                onClick={handleOpenHistory}
                className="min-h-[44px] px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                aria-label="View alert audit history"
              >
                <span className="material-symbols-outlined text-sm" aria-hidden="true">history</span>
                <span>History</span>
              </button>

              <button
                id="btn-ack-weather-alert"
                type="button"
                onClick={() => handleAcknowledge(topAlert._id || topAlert.id || topAlert.fingerprint)}
                className={`min-h-[44px] px-4 py-2 rounded-xl text-xs cursor-pointer transition-colors ${style.btn}`}
                aria-label="Acknowledge severe weather warning"
              >
                Acknowledge
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Explanation Modal / Drawer */}
      {explainingAlert && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg p-6 text-slate-100 shadow-2xl relative max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-indigo-400">psychology</span>
                <h4 className="font-bold text-base text-white">WeatherGPT Advisory Explanation</h4>
              </div>
              <button
                onClick={() => {
                  setExplainingAlert(null);
                  setExplanationData(null);
                }}
                className="text-slate-400 hover:text-white p-1"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="overflow-y-auto flex-1 py-4 space-y-4">
              <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700 text-xs">
                <p className="font-bold text-white mb-1">Official Warning Reference:</p>
                <p className="text-slate-300">{explainingAlert.headline || explainingAlert.alertType}</p>
                <p className="text-slate-400 mt-1">
                  Severity: <span className="font-bold text-amber-400">{explainingAlert.severity}</span> • Area: {explainingAlert.affectedArea?.name}
                </p>
              </div>

              {isExplaining ? (
                <div className="py-8 flex flex-col items-center justify-center gap-3">
                  <div className="w-8 h-8 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-xs text-slate-400 font-mono">Analyzing meteorological hazard & formulating advisory...</p>
                </div>
              ) : explanationData ? (
                <div className="space-y-4">
                  <div className="bg-indigo-950/40 border border-indigo-500/30 rounded-xl p-4 text-xs sm:text-sm leading-relaxed text-indigo-200">
                    <p className="font-bold text-indigo-100 mb-1 flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-sm">lightbulb</span>
                      Plain Language Summary:
                    </p>
                    {explanationData.explanation}
                  </div>

                  {Array.isArray(explanationData.actionChecklist) && explanationData.actionChecklist.length > 0 && (
                    <div>
                      <h5 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                        Immediate Citizen Action Checklist:
                      </h5>
                      <div className="space-y-2">
                        {explanationData.actionChecklist.map((action, idx) => (
                          <div key={idx} className="flex items-start gap-2 bg-slate-800/60 p-2.5 rounded-lg border border-slate-700/50 text-xs">
                            <span className="material-symbols-outlined text-emerald-400 text-sm mt-0.5">check_circle</span>
                            <span>{action}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {explanationData.source && (
                    <p className="text-[11px] font-mono text-slate-400">
                      Attribution: {explanationData.source} (Official Authority)
                    </p>
                  )}
                </div>
              ) : null}
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setExplainingAlert(null);
                  setExplanationData(null);
                }}
                className="min-h-[44px] px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold cursor-pointer"
                aria-label="Close AI explanation modal"
              >
                Close Explanation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Alert History Drawer / Modal */}
      {historyOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-xl p-6 text-slate-100 shadow-2xl relative max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-400">history</span>
                <h4 className="font-bold text-base text-white">Meteorological Alert History</h4>
              </div>
              <button onClick={() => setHistoryOpen(false)} className="text-slate-400 hover:text-white p-1">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="overflow-y-auto flex-1 py-4 space-y-3">
              {historyLoading ? (
                <div className="py-8 flex flex-col items-center justify-center gap-3">
                  <div className="w-8 h-8 border-3 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-xs text-slate-400">Loading alert audit history...</p>
                </div>
              ) : historyList.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-400">
                  No historical alerts recorded for this area.
                </div>
              ) : (
                historyList.map((item, idx) => (
                  <div
                    key={item._id || item.id || idx}
                    className="p-3 bg-slate-800/70 border border-slate-700 rounded-xl space-y-1 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white">{item.alertType}</span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] uppercase font-bold bg-slate-700 text-amber-300">
                          {item.severity}
                        </span>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                        item.status === 'ACTIVE' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' :
                        item.status === 'EXPIRED' ? 'bg-slate-700 text-slate-400' :
                        'bg-red-500/20 text-red-400'
                      }`}>
                        {item.status}
                      </span>
                    </div>
                    <p className="text-slate-300 text-xs">{item.headline || item.recommendedAction}</p>
                    <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 pt-1">
                      <span>Area: {item.affectedArea?.name || 'Local'}</span>
                      <span>Issued: {item.issueTime ? new Date(item.issueTime).toLocaleDateString() : 'N/A'}</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setHistoryOpen(false)}
                className="min-h-[44px] px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold cursor-pointer"
                aria-label="Close history modal"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
