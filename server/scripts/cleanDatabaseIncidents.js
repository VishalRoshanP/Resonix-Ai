/**
 * RESONIX AI — Database Cleanup Script
 * 
 * Objectives:
 * 1. Retain ONLY 14 carefully selected representative incident records covering all emergency types:
 *    - Flood (Active & Resolved)
 *    - Fire (Active & Resolved)
 *    - Earthquake (Active)
 *    - Medical (Active)
 *    - Building Collapse (Active)
 *    - Storm (Active)
 * 2. Purge 303 excess test/stress-test incident documents.
 * 3. Sanitize retained records: Strip bloated base64 audio and photo data URLs from
 *    `aiAnalysis.citizenData.audioReference` and `photoReference`, reducing document size from ~100KB-2.7MB down to <2KB.
 * 4. Clean corresponding orphaned records in `emergencypackets`.
 * 5. PRESERVE users (7), resources (37), and all other collections 100% untouched.
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const RETAINED_INCIDENT_IDS = [
  '6a9a4c268a42414dbff4a1b7', // FLOOD active
  '6a9a4487e03089b8dc06c47f', // FLOOD active
  '6a9a64cb8a42414dbff4acc0', // FIRE active
  '6a9a4c308a42414dbff4a1cb', // FIRE active
  '6a9a4c278a42414dbff4a1c0', // EARTHQUAKE active
  '6a9a46d73016723d615fca9b', // EARTHQUAKE active
  '6a99124e52e0646a0bb01f25', // MEDICAL active
  '6a9644477c168a7bad3aadc7', // MEDICAL active
  '6a9910f5b9ff58a71ee3b9aa', // BUILDING_COLLAPSE active
  '6a9644787c168a7bad3aae5d', // BUILDING_COLLAPSE active
  '6a946ac79b6e7401477d7e0c', // STORM active
  '6a946844c5ef09b639615076', // STORM active
  '6a963018f135ffe50e41d1b0', // FLOOD resolved
  '6a9447d639b0acdcefb66a08', // FIRE resolved
];

async function runCleanup() {
  console.log('==================================================');
  console.log('RESONIX AI — DATABASE CLEANUP & METADATA SANITIZATION');
  console.log('==================================================');
  
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI missing from environment');
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB Atlas:', mongoose.connection.name);

  const db = mongoose.connection.db;
  const incidentCol = db.collection('incidents');
  const packetCol = db.collection('emergencypackets');

  // Step 1: Audit initial state
  const initialIncidentCount = await incidentCol.countDocuments();
  const initialPacketCount = await packetCol.countDocuments();
  console.log(`\n• Initial incidents count:        ${initialIncidentCount}`);
  console.log(`• Initial emergency packets count: ${initialPacketCount}`);

  // Convert IDs to ObjectIds
  const retainedObjectIds = RETAINED_INCIDENT_IDS.map(id => new mongoose.Types.ObjectId(id));

  // Verify all 14 exist
  const existingRetained = await incidentCol.find({ _id: { $in: retainedObjectIds } }).toArray();
  console.log(`• Retained incidents verified:     ${existingRetained.length} / ${RETAINED_INCIDENT_IDS.length}`);

  if (existingRetained.length !== RETAINED_INCIDENT_IDS.length) {
    console.warn('⚠️ Warning: Not all 14 specified IDs found in DB!');
  }

  // Step 2: Sanitize retained records (strip oversized base64 data)
  console.log('\n--- SANITIZING RETAINED RECORDS METADATA ---');
  let sanitizedCount = 0;
  const retainedPacketIds = new Set();
  const retainedClientRequestIds = new Set();

  for (const doc of existingRetained) {
    if (doc.packetId) retainedPacketIds.add(doc.packetId);
    if (doc.clientRequestId) retainedClientRequestIds.add(doc.clientRequestId);

    const beforeSize = JSON.stringify(doc).length;
    let modified = false;
    const updates = {};

    // Sanitize aiAnalysis.citizenData.audioReference
    if (doc.aiAnalysis && doc.aiAnalysis.citizenData && doc.aiAnalysis.citizenData.audioReference) {
      const audioRef = doc.aiAnalysis.citizenData.audioReference;
      if (typeof audioRef === 'string' && audioRef.length > 200) {
        updates['aiAnalysis.citizenData.audioReference'] = {
          hasAudio: true,
          mimeType: 'audio/webm',
          durationSeconds: doc.recordingDuration || 3,
        };
        modified = true;
      } else if (typeof audioRef === 'object' && audioRef.dataUrl && audioRef.dataUrl.length > 200) {
        updates['aiAnalysis.citizenData.audioReference'] = {
          hasAudio: true,
          mimeType: audioRef.mimeType || 'audio/webm',
          durationSeconds: audioRef.durationSeconds || doc.recordingDuration || 3,
        };
        modified = true;
      }
    }

    // Sanitize direct photoReference if containing raw base64 dataUrl
    if (doc.photoReference && typeof doc.photoReference === 'object') {
      if (doc.photoReference.dataUrl && doc.photoReference.dataUrl.length > 200) {
        updates['photoReference'] = {
          hasPhoto: true,
          url: doc.photoReference.url || '/uploads/incident_evidence.jpg',
          mimeType: doc.photoReference.mimeType || 'image/jpeg',
        };
        modified = true;
      }
    }

    // Sanitize citizenInput.photoReference
    if (doc.citizenInput && doc.citizenInput.photoReference && typeof doc.citizenInput.photoReference === 'object') {
      if (doc.citizenInput.photoReference.dataUrl && doc.citizenInput.photoReference.dataUrl.length > 200) {
        updates['citizenInput.photoReference'] = {
          hasPhoto: true,
          mimeType: 'image/jpeg',
        };
        modified = true;
      }
    }

    // Ensure status fields are valid
    if (!doc.status) {
      updates['status'] = 'active';
      modified = true;
    }

    if (modified) {
      await incidentCol.updateOne({ _id: doc._id }, { $set: updates });
      sanitizedCount++;
      const updatedDoc = await incidentCol.findOne({ _id: doc._id });
      const afterSize = JSON.stringify(updatedDoc).length;
      console.log(`  Sanitized ${doc._id} (${doc.category}): ${beforeSize} bytes -> ${afterSize} bytes`);
    } else {
      console.log(`  Verified ${doc._id} (${doc.category}): already clean (${beforeSize} bytes)`);
    }
  }

  // Step 3: Delete excess incidents (all except the 14 retained)
  console.log('\n--- PURGING EXCESS TEST INCIDENTS ---');
  const deleteResult = await incidentCol.deleteMany({
    _id: { $nin: retainedObjectIds },
  });
  console.log(`• Deleted excess incidents:        ${deleteResult.deletedCount}`);

  // Step 4: Clean emergency packets (keep matching retained packets)
  console.log('\n--- CLEANING EMERGENCY PACKETS ---');
  const matchingPacketsFilter = {
    $or: [
      { packetId: { $in: Array.from(retainedPacketIds) } },
      { clientRequestId: { $in: Array.from(retainedClientRequestIds) } },
    ],
  };
  const matchingPackets = await packetCol.find(matchingPacketsFilter).toArray();
  const matchingPacketIds = matchingPackets.map(p => p._id);

  // Sanitize retained packets if they contain huge dataUrl
  for (const p of matchingPackets) {
    if (p.audioReference && p.audioReference.dataUrl && p.audioReference.dataUrl.length > 200) {
      await packetCol.updateOne(
        { _id: p._id },
        {
          $set: {
            'audioReference.dataUrl': null,
            'audioReference.hasAudio': true,
          },
        }
      );
    }
  }

  const deletePacketsResult = await packetCol.deleteMany({
    _id: { $nin: matchingPacketIds },
  });
  console.log(`• Retained matching emergency packets: ${matchingPackets.length}`);
  console.log(`• Deleted excess emergency packets:    ${deletePacketsResult.deletedCount}`);

  // Step 5: Final count verification
  const finalIncidentCount = await incidentCol.countDocuments();
  const finalPacketCount = await packetCol.countDocuments();
  const userCount = await db.collection('users').countDocuments();
  const resourceCount = await db.collection('resources').countDocuments();

  console.log('\n==================================================');
  console.log('FINAL DATABASE VERIFICATION');
  console.log('==================================================');
  console.log(`• Final Incident count:            ${finalIncidentCount} (Target: 14)`);
  console.log(`• Final EmergencyPacket count:     ${finalPacketCount}`);
  console.log(`• User records preserved:          ${userCount} (Untouched)`);
  console.log(`• Resource records preserved:      ${resourceCount} (Untouched)`);
  console.log('==================================================\n');

  await mongoose.disconnect();
}

runCleanup().catch(err => {
  console.error('Cleanup failed:', err);
  process.exit(1);
});
