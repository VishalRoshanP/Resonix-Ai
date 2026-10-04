/**
 * Multi-Citizen Cluster Priority Scoring Service for RESONIX AI
 * 
 * Purpose:
 * Calculates an aggregated situational priority score (0-100) and priority tier
 * ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW') for a cluster/group of related citizen reports.
 * 
 * Safety & Architectural Principles:
 * - Does NOT overwrite or mutate individual incident severities or priorities.
 * - Does NOT alter MongoDB records.
 * - Generates clear, intuitive, user-friendly reasons for responders.
 * - Zero hallucination / zero invention of victims, casualties, or damage.
 * - Strictly JavaScript (Node.js) — Zero TypeScript / Zero Python.
 */

const incidentFusionDecisionEngine = require('./incidentFusionDecisionEngine');
const logger = require('../utils/logger');

// Regex patterns for life safety and immediate danger indicators
const TRAPPED_KEYWORDS_REGEX = /\b(trapped|stranded|stuck|blocked|buried|pinned|surrounded|cannot get out|unable to leave|escape blocked)\b/i;
const IMMEDIATE_DANGER_REGEX = /\b(immediate danger|life threatening|rapidly rising|spreading fast|fire spreading|flames spreading|building collapse|gas leak|explosion|breached|roof stranded|drowning)\b/i;

class ClusterPriorityService {
  constructor() {
    this.decisionEngine = incidentFusionDecisionEngine;
  }

  /**
   * Evaluates life safety keywords across text and transcripts
   * @param {Object} report
   * @returns {{mentionsTrapped: boolean, mentionsImmediateDanger: boolean}}
   */
  extractSafetySignals(report) {
    const textPieces = [
      report.description,
      report.voiceTranscript,
      report.originalVoiceTranscript,
      report.citizenInput?.description,
      report.citizenInput?.voiceTranscript,
      report.aiAssessment?.reason,
      report.aiAssessment?.summary,
      report.englishTranslation,
    ].filter(Boolean).map(String);

    const combinedText = textPieces.join(' ');

    const mentionsTrapped = TRAPPED_KEYWORDS_REGEX.test(combinedText);
    const mentionsImmediateDanger = IMMEDIATE_DANGER_REGEX.test(combinedText);

    return { mentionsTrapped, mentionsImmediateDanger };
  }

  /**
   * Calculates Multi-Citizen Cluster Priority Score (0-100) and user-friendly reasons
   * 
   * @param {Array<Object>|Object} input - Array of incident reports or cluster view object
   * @param {Object} [options] - Additional evaluation parameters { semanticSimilarity, geographicDistanceMeters }
   * @returns {{clusterPriority: string, score: number, reasons: Array<string>}}
   */
  calculateClusterPriority(input, options = {}) {
    const reports = Array.isArray(input)
      ? input
      : (Array.isArray(input?.incidents) ? input.incidents : (input ? [input] : []));

    const reportCount = reports.length;
    if (reportCount === 0) {
      return {
        clusterPriority: 'LOW',
        score: 0,
        reasons: ['No reports available in cluster.'],
      };
    }

    let score = 0;
    const reasons = [];

    // -------------------------------------------------------------------------
    // 1. Existing Incident Severities & Priorities Component (0 - 30 pts)
    // -------------------------------------------------------------------------
    const severities = reports.map((r) => String(r.severity || r.aiAssessment?.severity || 'MEDIUM').toUpperCase());
    const priorities = reports.map((r) => String(r.priority || r.aiAssessment?.priority || 'MEDIUM').toUpperCase());

    const criticalCount = reports.filter((r) => {
      const s = String(r.severity || r.aiAssessment?.severity || '').toUpperCase();
      const p = String(r.priority || r.aiAssessment?.priority || '').toUpperCase();
      return s === 'CRITICAL' || p === 'CRITICAL';
    }).length;

    const highPriorityCount = reports.filter((r) => {
      const s = String(r.severity || r.aiAssessment?.severity || '').toUpperCase();
      const p = String(r.priority || r.aiAssessment?.priority || '').toUpperCase();
      return (s === 'HIGH' || s === 'WARNING' || p === 'HIGH') && s !== 'CRITICAL' && p !== 'CRITICAL';
    }).length;

    const completedCount = reports.filter((r) => {
      const st = String(r.status || r.packetStatus || '').toUpperCase();
      return ['RESOLVED', 'CLOSED', 'COMPLETED'].includes(st);
    }).length;
    const activeCount = reportCount - completedCount;

    const hasCritical = criticalCount > 0;
    const hasHigh = highPriorityCount > 0;
    const hasMedium = severities.includes('MEDIUM') || severities.includes('MODERATE') || priorities.includes('MEDIUM');

    if (hasCritical) {
      score += 30;
      reasons.push(`${criticalCount} report(s) rated as CRITICAL severity.`);
    } else if (hasHigh) {
      score += 20;
      reasons.push(`${highPriorityCount} report(s) rated as HIGH priority.`);
    } else if (hasMedium) {
      score += 12;
    } else {
      score += 5;
    }

    // -------------------------------------------------------------------------
    // 2. Report Volume & Surge Concentration Component (0 - 25 pts)
    // -------------------------------------------------------------------------
    if (reportCount >= 8) {
      score += 25;
      reasons.push(`${reportCount} emergency reports received in this cluster.`);
    } else if (reportCount >= 5) {
      score += 20;
      reasons.push(`${reportCount} emergency reports received in this cluster.`);
    } else if (reportCount >= 3) {
      score += 14;
      reasons.push(`${reportCount} emergency reports received.`);
    } else if (reportCount === 2) {
      score += 8;
      reasons.push('2 corroborating emergency reports received.');
    } else {
      score += 3;
    }

    // Temporal Surge Analysis (reports submitted in quick succession)
    const timestamps = reports
      .map((r) => {
        const raw = r.createdAt || r.timestamp || r.receivedAt || r.time;
        const d = new Date(raw);
        return isNaN(d.getTime()) ? null : d.getTime();
      })
      .filter((t) => t != null)
      .sort((a, b) => a - b);

    const firstReportTime = timestamps.length > 0 ? new Date(timestamps[0]).toISOString() : new Date().toISOString();
    const latestReportTime = timestamps.length > 0 ? new Date(timestamps[timestamps.length - 1]).toISOString() : firstReportTime;
    const spanMinutes = timestamps.length >= 2
      ? Math.max(1, Math.round((timestamps[timestamps.length - 1] - timestamps[0]) / (60 * 1000)))
      : 1;

    if (timestamps.length >= 2) {
      if (reportCount >= 2 && spanMinutes <= 5) {
        score += 5;
        reasons.push(`Reports increased rapidly in the last ${spanMinutes} minute(s).`);
      } else if (reportCount >= 3 && spanMinutes <= 15) {
        score += 3;
        reasons.push(`Multiple reports received within ${spanMinutes} minutes.`);
      }
    }

    // -------------------------------------------------------------------------
    // 3. Life Safety & Immediate Danger Signal Component (0 - 25 pts)
    // Factual evidence-based parsing (never infers victims without text evidence)
    // -------------------------------------------------------------------------
    let trappedReportCount = 0;
    let dangerReportCount = 0;

    reports.forEach((r) => {
      const { mentionsTrapped, mentionsImmediateDanger } = this.extractSafetySignals(r);
      if (mentionsTrapped) trappedReportCount++;
      if (mentionsImmediateDanger) dangerReportCount++;
    });

    if (trappedReportCount >= 3) {
      score += 20;
      reasons.push(`${trappedReportCount} reports mention people trapped or stranded.`);
    } else if (trappedReportCount === 2) {
      score += 15;
      reasons.push('2 reports mention people trapped.');
    } else if (trappedReportCount === 1) {
      score += 8;
      reasons.push('1 report mentions people trapped or unable to evacuate.');
    }

    if (dangerReportCount >= 2) {
      score += 5;
      reasons.push(`${dangerReportCount} reports indicate escalating immediate danger.`);
    } else if (dangerReportCount === 1 && trappedReportCount === 0) {
      score += 3;
      reasons.push('Report indicates active escalating hazard.');
    }

    // -------------------------------------------------------------------------
    // 4. Geographic Concentration & Report Density Component (0 - 15 pts)
    // -------------------------------------------------------------------------
    let maxDistanceMeters = options.geographicDistanceMeters ?? null;
    const estimatedAreaKm2 = options.estimatedReportingAreaKm2 ?? null;

    if (maxDistanceMeters == null && reports.length >= 2) {
      let maxDist = 0;
      let validCount = 0;
      for (let i = 0; i < reports.length; i++) {
        const c1 = this.decisionEngine.extractCoordinates(reports[i]);
        if (c1.lat != null && c1.lng != null) {
          for (let j = i + 1; j < reports.length; j++) {
            const c2 = this.decisionEngine.extractCoordinates(reports[j]);
            if (c2.lat != null && c2.lng != null) {
              const d = this.decisionEngine.calculateDistanceMeters(c1.lat, c1.lng, c2.lat, c2.lng);
              if (d != null) {
                validCount++;
                if (d > maxDist) maxDist = d;
              }
            }
          }
        }
      }
      if (validCount > 0) {
        maxDistanceMeters = maxDist;
      }
    }

    // Numerical density (reports per km²)
    let reportsPerKm2 = null;
    if (estimatedAreaKm2 != null && estimatedAreaKm2 > 0) {
      reportsPerKm2 = Number((reportCount / estimatedAreaKm2).toFixed(1));
    }

    // High Density Determination
    // Example: 12 reports within a small area within a short time window → HIGH DENSITY
    const isHighDensity = (
      (reportCount >= 6 && (maxDistanceMeters == null || maxDistanceMeters <= 300) && spanMinutes <= 60) ||
      (reportCount >= 10 && (maxDistanceMeters == null || maxDistanceMeters <= 500)) ||
      (reportsPerKm2 != null && reportsPerKm2 >= 50 && reportCount >= 4)
    );

    const isMediumDensity = !isHighDensity && (
      (reportCount >= 3 && (maxDistanceMeters == null || maxDistanceMeters <= 400)) ||
      (reportsPerKm2 != null && reportsPerKm2 >= 20 && reportCount >= 3)
    );

    const densityLevel = isHighDensity ? 'HIGH' : (isMediumDensity ? 'MEDIUM' : 'STANDARD');
    const densityLabel = isHighDensity ? 'HIGH DENSITY' : (isMediumDensity ? 'MEDIUM DENSITY' : 'STANDARD DENSITY');

    if (isHighDensity) {
      score += 10;
      reasons.push(`High density reporting concentration: ${reportCount} reports situated within a tight operational radius.`);
    } else if (maxDistanceMeters != null) {
      if (maxDistanceMeters <= 100) {
        score += 8;
        reasons.push(`All reports concentrated within ${maxDistanceMeters} m.`);
      } else if (maxDistanceMeters <= 250) {
        score += 5;
        reasons.push(`All reports located within ${maxDistanceMeters} m.`);
      } else if (maxDistanceMeters <= 500) {
        score += 3;
        reasons.push(`Reports located within ${maxDistanceMeters} m.`);
      }
    }

    // -------------------------------------------------------------------------
    // 5. Semantic Agreement & Visual Evidence Component (0 - 10 pts)
    // -------------------------------------------------------------------------
    const semanticSimilarity = typeof options.semanticSimilarity === 'number'
      ? options.semanticSimilarity
      : (reports.length >= 2 ? (this.decisionEngine.similarityService.calculateSimilarity(reports[0], reports[1])?.similarityScore || 0) : null);

    if (semanticSimilarity != null && semanticSimilarity >= 0.80) {
      score += 6;
      reasons.push('High consistency across independent citizen descriptions.');
    }

    // Image Evidence
    const hasImageEvidence = reports.some((r) => r.imageAnalysis || r.evidence?.photoUrl || r.photoUrl || (r.media && r.media.length > 0));
    if (hasImageEvidence) {
      score += 4;
      reasons.push('Corroborated by uploaded visual evidence.');
    }

    // -------------------------------------------------------------------------
    // 6. Score Normalization & Priority Tier Classification
    // -------------------------------------------------------------------------
    // Score clamped strictly to [0, 100]
    const finalScore = Math.min(100, Math.max(0, Math.round(score)));

    const isAllLow = severities.every((s) => s === 'LOW' || !s) && priorities.every((p) => p === 'LOW' || !p);

    let clusterPriority = 'LOW';
    if (activeCount === 0 && completedCount > 0) {
      clusterPriority = 'RESOLVED';
      reasons.push('All reports in this cluster have been successfully resolved.');
    } else if (
      finalScore >= 70 ||
      (hasCritical && activeCount > 0) ||
      (isHighDensity && hasHigh && activeCount > 0) ||
      (reportCount >= 5 && trappedReportCount >= 1)
    ) {
      clusterPriority = 'CRITICAL';
    } else if ((finalScore >= 45 && !isAllLow) || (hasHigh && activeCount > 0) || trappedReportCount >= 1) {
      clusterPriority = 'HIGH';
    } else if (finalScore >= 30 && !isAllLow) {
      clusterPriority = 'MEDIUM';
    } else {
      clusterPriority = 'LOW';
    }

    // Ensure reasons is unique and non-empty
    const uniqueReasons = Array.from(new Set(reasons));
    if (uniqueReasons.length === 0) {
      uniqueReasons.push(`Cluster contains ${reportCount} report(s) evaluated under standard protocols.`);
    }

    logger.info(`[ClusterPriorityService] Evaluated cluster priority: ${clusterPriority} (Score: ${finalScore}, Reports: ${reportCount}, Density: ${densityLevel})`);

    return {
      clusterPriority,
      score: finalScore,
      reportCount,
      reasons: uniqueReasons,
      criticalCount,
      highPriorityCount,
      activeCount,
      completedCount,
      firstReportTime,
      latestReportTime,
      spanMinutes,
      densityInfo: {
        densityLevel,
        isHighDensity,
        densityLabel,
        reportsPerKm2,
        spreadMeters: maxDistanceMeters,
        spanMinutes,
        reportCount,
      },
    };
  }
}

const clusterPriorityService = new ClusterPriorityService();

module.exports = clusterPriorityService;
module.exports.ClusterPriorityService = ClusterPriorityService;
