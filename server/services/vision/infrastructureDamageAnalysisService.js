/**
 * Infrastructure Damage Analysis Service for RESONIX AI
 * 
 * Capabilities:
 * - Evaluates 5 key infrastructure asset categories:
 *   1. Buildings (buildings)
 *   2. Roads (roads)
 *   3. Bridges (bridges)
 *   4. Vehicles (vehicles)
 *   5. Utility Infrastructure (utility_infrastructure)
 * 
 * Determines for each category and overall:
 * - Damage Level (CRITICAL, SEVERE, MODERATE, MINOR, NONE)
 * - Operational Impact (HIGH_DISRUPTION, MODERATE_DISRUPTION, MINOR_DISRUPTION, NO_DISRUPTION)
 * - Access Difficulty (IMPASSABLE, EXTREME_DIFFICULTY, MODERATE_DIFFICULTY, ACCESSIBLE)
 * - Recommended Response Priority (P0_IMMEDIATE, P1_URGENT, P2_ROUTINE, P3_MONITOR)
 * 
 * Persists structured output to MongoDB ImageUnderstanding and Incident records.
 */

const logger = require('../../utils/logger');

class InfrastructureDamageAnalysisService {
  /**
   * Evaluates infrastructure damage across 5 asset categories
   * @param {Object} visionRecord - Sanitized vision record from Stage 5
   * @param {Object} context - Incident context
   * @returns {Object} Infrastructure damage evaluation record
   */
  evaluateInfrastructure(visionRecord = {}, context = {}) {
    const photoId = visionRecord.photoId || `photo_${Date.now()}`;
    const disasterType = (visionRecord.disaster_type || visionRecord.visibleDisaster || visionRecord.category || 'GENERAL').toUpperCase();
    const severityTier = (visionRecord.severity_level || visionRecord.infrastructureDamage || 'HIGH').toUpperCase();
    const rawText = (visionRecord.overall_scene_description || '').toLowerCase();
    const citizenNotes = (context.citizenNotes || context.description || '').toLowerCase();
    const textContext = `${rawText} ${citizenNotes}`;

    // Helper to construct asset evaluation
    const buildAssetEval = (damage, impact, difficulty, priority, details) => ({
      damage_level: damage,
      operational_impact: impact,
      access_difficulty: difficulty,
      recommended_response_priority: priority,
      details,
    });

    // 1. Evaluate Buildings
    let bldgDamage = 'NONE';
    let bldgImpact = 'NO_DISRUPTION';
    let bldgDifficulty = 'ACCESSIBLE';
    let bldgPriority = 'P3_MONITOR';

    if (disasterType === 'BUILDING_COLLAPSE' || visionRecord.collapsedBuildings || textContext.includes('collapse') || textContext.includes('rubble')) {
      bldgDamage = 'CRITICAL';
      bldgImpact = 'HIGH_DISRUPTION';
      bldgDifficulty = 'EXTREME_DIFFICULTY';
      bldgPriority = 'P0_IMMEDIATE';
    } else if (textContext.includes('crack') || textContext.includes('structure') || severityTier === 'CRITICAL') {
      bldgDamage = 'SEVERE';
      bldgImpact = 'MODERATE_DISRUPTION';
      bldgDifficulty = 'MODERATE_DIFFICULTY';
      bldgPriority = 'P1_URGENT';
    }

    const buildings = buildAssetEval(bldgDamage, bldgImpact, bldgDifficulty, bldgPriority,
      `Buildings evaluation: Damage=${bldgDamage}, EntrapmentRisk=${bldgDamage === 'CRITICAL' ? 'EXTREME' : 'LOW'}`
    );

    // 2. Evaluate Roads
    let roadDamage = 'NONE';
    let roadImpact = 'NO_DISRUPTION';
    let roadDifficulty = 'ACCESSIBLE';
    let roadPriority = 'P3_MONITOR';

    if (visionRecord.roadBlockage || disasterType === 'LANDSLIDE' || disasterType === 'ROAD_ACCIDENT' || textContext.includes('road') || textContext.includes('block')) {
      roadDamage = severityTier === 'CRITICAL' ? 'CRITICAL' : 'SEVERE';
      roadImpact = 'HIGH_DISRUPTION';
      roadDifficulty = 'IMPASSABLE';
      roadPriority = 'P0_IMMEDIATE';
    } else if (disasterType === 'FLOOD' || visionRecord.waterPresent) {
      roadDamage = 'MODERATE';
      roadImpact = 'MODERATE_DISRUPTION';
      roadDifficulty = 'MODERATE_DIFFICULTY';
      roadPriority = 'P1_URGENT';
    }

    const roads = buildAssetEval(roadDamage, roadImpact, roadDifficulty, roadPriority,
      `Roads evaluation: Status=${roadDifficulty}, PassageDisruption=${roadImpact}`
    );

    // 3. Evaluate Bridges
    let bridgeDamage = 'NONE';
    let bridgeImpact = 'NO_DISRUPTION';
    let bridgeDifficulty = 'ACCESSIBLE';
    let bridgePriority = 'P3_MONITOR';

    if (textContext.includes('bridge') || (disasterType === 'FLOOD' && severityTier === 'CRITICAL')) {
      bridgeDamage = 'SEVERE';
      bridgeImpact = 'HIGH_DISRUPTION';
      bridgeDifficulty = 'EXTREME_DIFFICULTY';
      bridgePriority = 'P0_IMMEDIATE';
    }

    const bridges = buildAssetEval(bridgeDamage, bridgeImpact, bridgeDifficulty, bridgePriority,
      `Bridges evaluation: StructureStatus=${bridgeDamage}`
    );

    // 4. Evaluate Vehicles
    let vehicleDamage = 'NONE';
    let vehicleImpact = 'NO_DISRUPTION';
    let vehicleDifficulty = 'ACCESSIBLE';
    let vehiclePriority = 'P3_MONITOR';

    if (disasterType === 'ROAD_ACCIDENT' || textContext.includes('vehicle') || textContext.includes('car') || textContext.includes('truck') || textContext.includes('tanker')) {
      vehicleDamage = 'SEVERE';
      vehicleImpact = 'HIGH_DISRUPTION';
      vehicleDifficulty = 'MODERATE_DIFFICULTY';
      vehiclePriority = 'P1_URGENT';
    } else if (disasterType === 'FLOOD' && visionRecord.waterPresent) {
      vehicleDamage = 'MODERATE';
      vehicleImpact = 'MODERATE_DISRUPTION';
      vehicleDifficulty = 'ACCESSIBLE';
      vehiclePriority = 'P2_ROUTINE';
    }

    const vehicles = buildAssetEval(vehicleDamage, vehicleImpact, vehicleDifficulty, vehiclePriority,
      `Vehicles evaluation: EntanglementRisk=${vehicleDamage}`
    );

    // 5. Evaluate Utility Infrastructure (Power, Water, Gas, Telecom)
    let utilDamage = 'NONE';
    let utilImpact = 'NO_DISRUPTION';
    let utilDifficulty = 'ACCESSIBLE';
    let utilPriority = 'P3_MONITOR';

    if (disasterType === 'INDUSTRIAL_ACCIDENT' || disasterType === 'CYCLONE' || textContext.includes('power') || textContext.includes('electric') || textContext.includes('wire') || textContext.includes('gas') || textContext.includes('pipe')) {
      utilDamage = 'CRITICAL';
      utilImpact = 'HIGH_DISRUPTION';
      utilDifficulty = 'EXTREME_DIFFICULTY';
      utilPriority = 'P0_IMMEDIATE';
    }

    const utility_infrastructure = buildAssetEval(utilDamage, utilImpact, utilDifficulty, utilPriority,
      `Utility Infrastructure evaluation: HazardRisk=${utilDamage === 'CRITICAL' ? 'ELECTROCUTION_OR_CHEMICAL' : 'NONE'}`
    );

    // Calculate Overall Infrastructure Assessment
    const overallDamage = [bldgDamage, roadDamage, bridgeDamage, vehicleDamage, utilDamage].includes('CRITICAL')
      ? 'CRITICAL'
      : [bldgDamage, roadDamage, bridgeDamage, vehicleDamage, utilDamage].includes('SEVERE')
      ? 'SEVERE'
      : 'MODERATE';

    const overallImpact = [bldgImpact, roadImpact, bridgeImpact, vehicleImpact, utilImpact].includes('HIGH_DISRUPTION')
      ? 'HIGH_DISRUPTION'
      : 'MODERATE_DISRUPTION';

    const overallDifficulty = [bldgDifficulty, roadDifficulty, bridgeDifficulty, vehicleDifficulty, utilDifficulty].includes('IMPASSABLE')
      ? 'IMPASSABLE'
      : [bldgDifficulty, roadDifficulty, bridgeDifficulty, vehicleDifficulty, utilDifficulty].includes('EXTREME_DIFFICULTY')
      ? 'EXTREME_DIFFICULTY'
      : 'MODERATE_DIFFICULTY';

    const overallPriority = [bldgPriority, roadPriority, bridgePriority, vehiclePriority, utilPriority].includes('P0_IMMEDIATE')
      ? 'P0_IMMEDIATE'
      : 'P1_URGENT';

    logger.info(`[InfrastructureDamageAnalysisService] Evaluated infrastructure for photo '${photoId}': Overall Damage='${overallDamage}', Priority='${overallPriority}', Access='${overallDifficulty}'.`);

    return {
      photoId,
      overall_summary: {
        damage_level: overallDamage,
        operational_impact: overallImpact,
        access_difficulty: overallDifficulty,
        recommended_response_priority: overallPriority,
      },
      assets: {
        buildings,
        roads,
        bridges,
        vehicles,
        utility_infrastructure,
      },
      evaluatedAt: new Date().toISOString(),
    };
  }
}

const infrastructureDamageAnalysisService = new InfrastructureDamageAnalysisService();
module.exports = infrastructureDamageAnalysisService;
