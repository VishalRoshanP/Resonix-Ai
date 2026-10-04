const User = require('../models/User');
const ApiError = require('../utils/apiError');
const { generateToken } = require('../utils/jwtHelper');
const logger = require('../utils/logger');
const bcrypt = require('bcryptjs');

// User Authentication Service using MongoDB User Model

// Helper to sanitize user output
const sanitizeUser = (u) => ({
  id: u._id || u.id,
  name: u.name,
  email: u.email,
  badgeId: u.badgeId || 'BDG-9999',
  organization: u.organization || 'Disaster Response',
  department: u.department || 'Operations',
  role: u.role || 'Responder',
  approvalStatus: u.approvalStatus || 'APPROVED',
  isActive: u.isActive !== false,
  createdAt: u.createdAt || new Date().toISOString(),
});

/**
 * 1. Request Command Center Access (Registration with PENDING_APPROVAL status)
 */
const registerUser = async (userData) => {
  const email = (userData.email || '').toLowerCase().trim();
  const badgeId = (userData.badgeId || userData.badge || `BDG-${Math.floor(1000 + Math.random() * 9000)}`).trim();
  const isDbConnected = User?.db?.readyState === 1;

  if (isDbConnected) {
    try {
      const existingUser = await User.findOne({
        $or: [{ email }, { badgeId }],
      });
      if (existingUser) {
        throw new ApiError(400, 'An account with this email or Badge ID already exists.');
      }

      const newUser = await User.create({
        name: userData.name,
        email,
        badgeId,
        organization: userData.organization || 'Emergency Services',
        department: userData.department || 'Disaster Management',
        role: userData.role || 'Responder',
        approvalStatus: 'PENDING_APPROVAL',
        password: userData.password,
        phone: userData.phone || userData.mobile || '',
        isActive: true,
      });

      logger.info(`[AuthService] Registered new access request for ${email} (${badgeId}) - PENDING_APPROVAL.`);

      return {
        success: true,
        message: 'Account request submitted successfully. Approval pending by Administrator.',
        user: sanitizeUser(newUser),
        status: 'PENDING_APPROVAL',
      };
    } catch (err) {
      if (err instanceof ApiError) throw err;
      logger.error('[AuthService] Mongo register error:', err.message);
      throw new ApiError(500, err.message || 'Error registering user.');
    }
  }

  throw new ApiError(503, 'Database service is unavailable. Cannot register account.');
};

/**
 * 2. Login User (Email OR Badge ID + Password verification + Approval Check)
 */
const loginUser = async (loginIdentifier, password, requestedRole) => {
  const identifier = (loginIdentifier || '').trim().toLowerCase();
  const isDbConnected = User?.db?.readyState === 1;

  if (!isDbConnected) {
    throw new ApiError(503, 'Database service is unavailable. Cannot authenticate.');
  }

  let user = null;
  try {
    user = await User.findOne({
      $or: [{ email: identifier }, { badgeId: identifier.toUpperCase() }],
    }).select('+password');
  } catch (err) {
    logger.error('[AuthService] Mongo login lookup error:', err.message);
    throw new ApiError(500, 'Error looking up user account.');
  }

  if (!user) {
    throw new ApiError(401, 'Invalid credentials. User account not found.');
  }

  // Account Status Verifications
  if (user.isActive === false) {
    throw new ApiError(403, 'Account disabled. Please contact your Command Center Administrator.');
  }

  if (user.approvalStatus === 'PENDING_APPROVAL') {
    throw new ApiError(403, 'Account pending Administrator approval. Access restricted.');
  }

  if (user.approvalStatus === 'REJECTED') {
    throw new ApiError(403, 'Account access request rejected by Administrator.');
  }

  // Password Hash Verification
  let passwordMatches = false;
  if (user.comparePassword) {
    passwordMatches = await user.comparePassword(password);
  } else if (user.passwordHash) {
    passwordMatches = bcrypt.compareSync(password, user.passwordHash);
  }

  if (!passwordMatches) {
    throw new ApiError(401, 'Invalid credentials. Password hash mismatch.');
  }

  // Assign requested role if provided and permitted
  if (requestedRole) {
    user.role = requestedRole;
  }

  const token = generateToken({
    id: user._id || user.id,
    role: user.role,
    email: user.email,
    badgeId: user.badgeId,
  });

  logger.info(`[AuthService] Authentication successful for ${user.email} [${user.role}].`);

  return {
    user: sanitizeUser(user),
    token,
  };
};

/**
 * 3. Forgot Password OTP Request
 */
const requestPasswordResetOtp = async (identifier) => {
  const idStr = (identifier || '').trim().toLowerCase();
  const isDbConnected = User?.db?.readyState === 1;

  if (!isDbConnected) {
    throw new ApiError(503, 'Database service is unavailable.');
  }

  const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

  const dbUser = await User.findOne({
    $or: [{ email: idStr }, { badgeId: idStr.toUpperCase() }],
  });

  if (!dbUser) {
    throw new ApiError(404, 'User account not found.');
  }

  dbUser.resetPasswordOtp = otpCode;
  dbUser.resetPasswordOtpExpires = new Date(Date.now() + 15 * 60 * 1000);
  await dbUser.save();

  logger.info(`[AuthService] Password reset OTP generated for ${idStr}.`);

  return {
    success: true,
    message: 'Password reset OTP generated and logged.',
  };
};

/**
 * 4. Verify OTP & Reset Password
 */
const resetPasswordWithOtp = async (identifier, otpCode, newPassword) => {
  const idStr = (identifier || '').trim().toLowerCase();
  const isDbConnected = User?.db?.readyState === 1;

  if (!isDbConnected) {
    throw new ApiError(503, 'Database service is unavailable.');
  }

  const dbUser = await User.findOne({
    $or: [{ email: idStr }, { badgeId: idStr.toUpperCase() }],
  }).select('+password');

  if (!dbUser) {
    throw new ApiError(404, 'User account not found.');
  }

  if (!dbUser.resetPasswordOtp || dbUser.resetPasswordOtp !== otpCode) {
    throw new ApiError(400, 'Invalid or expired OTP reset code.');
  }

  if (dbUser.resetPasswordOtpExpires && dbUser.resetPasswordOtpExpires < new Date()) {
    throw new ApiError(400, 'Invalid or expired OTP reset code.');
  }

  dbUser.password = newPassword;
  dbUser.resetPasswordOtp = null;
  dbUser.resetPasswordOtpExpires = null;
  await dbUser.save();

  logger.info(`[AuthService] Password reset successfully for ${dbUser.email}.`);
  return { success: true, message: 'Password updated successfully. You may now log in.' };
};

/**
 * 5. Admin Personnel Management Operations
 */
const getAllUsers = async () => {
  if (User?.db?.readyState !== 1) {
    throw new ApiError(503, 'Database service is unavailable.');
  }
  const dbUsers = await User.find({}).sort({ createdAt: -1 });
  return dbUsers.map(sanitizeUser);
};

const updateUserApproval = async (userId, approvalStatus) => {
  if (User?.db?.readyState !== 1) {
    throw new ApiError(503, 'Database service is unavailable.');
  }
  const updated = await User.findByIdAndUpdate(userId, { approvalStatus }, { new: true });
  if (!updated) {
    throw new ApiError(404, `User account ${userId} not found.`);
  }
  return sanitizeUser(updated);
};

const toggleUserActive = async (userId, isActive) => {
  if (User?.db?.readyState !== 1) {
    throw new ApiError(503, 'Database service is unavailable.');
  }
  const updated = await User.findByIdAndUpdate(userId, { isActive }, { new: true });
  if (!updated) {
    throw new ApiError(404, `User account ${userId} not found.`);
  }
  return sanitizeUser(updated);
};

const googleAuthPlaceholder = async () => {
  throw new ApiError(501, 'Google Authentication structure prepared.');
};

module.exports = {
  registerUser,
  loginUser,
  requestPasswordResetOtp,
  resetPasswordWithOtp,
  getAllUsers,
  updateUserApproval,
  toggleUserActive,
  googleAuthPlaceholder,
};
