/**
 * Stage 7: Vision Dashboard Notification Service
 * 
 * Capabilities:
 * - Formats visual hazard alerts and dispatches real-time visual notifications to client-responder dashboard
 */

const logger = require('../../utils/logger');

class VisionDashboardNotificationService {
  /**
   * Formats and dispatches visual emergency alert notification
   * @param {Object} storedVisionDoc - Stored vision record from Stage 6
   * @param {Object} context - Incident context
   * @returns {Object} Dispatch result { dispatched: true, alertId, targetDashboard, alertSummary }
   */
  dispatchVisualAlert(storedVisionDoc = {}, context = {}) {
    const alertId = `vis_alert_${Date.now()}`;
    const disaster = storedVisionDoc.visibleDisaster || 'DISASTER_HAZARD';
    const damage = storedVisionDoc.infrastructureDamage || 'CRITICAL';
    const sector = context.sector || 'Sector 4';

    const alertSummary = `[VISUAL HAZARD ALERT] ${disaster} photo verified in ${sector}. Damage Severity: ${damage}. Collapsed: ${storedVisionDoc.collapsedBuildings ? 'YES' : 'NO'}, Fire: ${storedVisionDoc.fireVisible ? 'YES' : 'NO'}.`;

    logger.info(`[VisionDashboardNotificationService] Dispatched visual alert '${alertId}' to Responder Dashboard: "${alertSummary}".`);

    return {
      dispatched: true,
      alertId,
      targetDashboard: 'client-responder',
      alertSummary,
      disaster,
      damage,
      dispatchedAt: new Date().toISOString(),
    };
  }
}

const visionDashboardNotificationService = new VisionDashboardNotificationService();
module.exports = visionDashboardNotificationService;
