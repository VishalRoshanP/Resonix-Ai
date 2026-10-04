/**
 * One-Time Backend Administrator Bootstrap Script for RESONIX AI
 * 
 * Safely creates or approves the initial Administrator account in MongoDB Atlas
 * using existing Mongoose User schema & bcryptjs password hashing.
 * 
 * Usage:
 *   node server/scripts/bootstrapAdmin.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const mongoose = require('mongoose');
const User = require('../models/User');

async function bootstrapAdmin() {
  console.log('====================================================================');
  console.log('🛡️ RESONIX AI — INITIAL ADMINISTRATOR BOOTSTRAP');
  console.log('====================================================================');

  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('❌ MONGODB_URI missing in environment configuration!');
    process.exit(1);
  }

  console.log('[Step 1] Connecting to MongoDB Atlas...');
  await mongoose.connect(mongoUri);
  console.log('✅ Connected to MongoDB Atlas.');

  try {
    const adminEmail = (process.env.ADMIN_EMAIL || 'admin@resonix.gov').toLowerCase().trim();
    const adminPassword = process.env.ADMIN_PASSWORD;
    const adminBadgeId = (process.env.ADMIN_BADGE_ID || 'RESONIX-ADM-303').trim();

    if (!adminPassword) {
      console.error('❌ ADMIN_PASSWORD missing in environment configuration! Refusing to bootstrap with hardcoded credentials.');
      console.error('Please configure ADMIN_PASSWORD in your environment (.env) before running this script.');
      process.exit(1);
    }

    console.log(`\n[Step 2] Checking for configured Administrator account (${adminEmail})...`);
    let targetAdmin = await User.findOne({ email: adminEmail }).select('+password');

    if (targetAdmin) {
      console.log(`ℹ️ Configured Administrator (${adminEmail}) found in MongoDB Atlas.`);
      if (targetAdmin.approvalStatus !== 'APPROVED' || targetAdmin.isActive === false) {
        targetAdmin.approvalStatus = 'APPROVED';
        targetAdmin.isActive = true;
        targetAdmin.role = 'Administrator';
        await targetAdmin.save();
        console.log(`✅ Updated ${adminEmail} status to APPROVED and active.`);
      } else {
        console.log(`✅ ${adminEmail} is already APPROVED and active.`);
      }
    } else {
      console.log(`\n[Step 3] Creating new initial Administrator account (${adminEmail})...`);
      targetAdmin = await User.create({
        name: 'Command Center Administrator',
        email: adminEmail,
        badgeId: adminBadgeId,
        password: adminPassword,
        role: 'Administrator',
        approvalStatus: 'APPROVED',
        isActive: true,
        organization: 'RESONIX AI Command Center',
        department: 'Operations Command',
      });
      console.log(`✅ Initial Administrator account created successfully.`);
    }

    // Also approve any pending Admin accounts if present
    const pendingAdmins = await User.find({
      role: { $in: ['Administrator', 'admin'] },
      approvalStatus: 'PENDING_APPROVAL',
    });
    for (const pa of pendingAdmins) {
      pa.approvalStatus = 'APPROVED';
      pa.isActive = true;
      await pa.save();
      console.log(`✅ Approved pending Admin account: ${pa.email}`);
    }

    console.log('\n====================================================================');
    console.log('🎉 INITIAL ADMINISTRATOR BOOTSTRAP COMPLETE');
    console.log('====================================================================');
    console.log(`   • ID:             ${targetAdmin._id}`);
    console.log(`   • Email:          ${targetAdmin.email}`);
    console.log(`   • Badge ID:       ${targetAdmin.badgeId}`);
    console.log(`   • Role:           ${targetAdmin.role}`);
    console.log(`   • ApprovalStatus: ${targetAdmin.approvalStatus}`);
    console.log(`   • IsActive:       ${targetAdmin.isActive}`);
    console.log('\nPassword safely hashed with bcryptjs (cost factor 12). Plaintext password not printed.');

  } catch (err) {
    console.error('❌ Administrator bootstrap failed:', err.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

bootstrapAdmin();
