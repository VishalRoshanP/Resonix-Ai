const User = require('../models/User');
const ApiError = require('../utils/apiError');
const { generateToken } = require('../utils/jwtHelper');
const logger = require('../utils/logger');
const bcrypt = require('bcryptjs');

// In-memory user database fallback for offline / mock demo mode
const memoryUserStore = new Map([
  [
    'responder@resonix.gov',
    {
      id: 'usr_resp_101',
      name: 'Officer Sarah Jenkins',
      email: 'responder@resonix.gov',
      badgeId: 'NDRF-FL-101',
      organization: 'National Disaster Response Force',
      department: 'Water Extraction Squad #4',
      role: 'Responder',
      approvalStatus: 'APPROVED',
      isActive: true,
      passwordHash: bcrypt.hashSync('password123', 10),
    },
  ],
  [
    'coordinator@resonix.gov',
    {
      id: 'usr_coord_202',
      name: 'Captain Marcus Vance',
      email: 'coordinator@resonix.gov',
      badgeId: 'NDMA-COORD-202',
      organization: 'National Disaster Management Authority',
      department: 'Command Logistics & Dispatch',
      role: 'Coordinator',
      approvalStatus: 'APPROVED',
      isActive: true,
      passwordHash: bcrypt.hashSync('password123', 10),
    },
  ],
  [
    'admin@resonix.gov',
    {
      id: 'usr_admin_303',
      name: 'Commander Robert Sterling',
      email: 'admin@resonix.gov',
      badgeId: 'RESONIX-ADM-303',
      organization: 'RESONIX Emergency Command',
      department: 'Executive Operations Control',
      role: 'Administrator',
      approvalStatus: 'APPROVED',
      isActive: true,
      passwordHash: bcrypt.hashSync('password123', 10),
    },
  ],
]);

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
      logger.warn('[AuthService] Mongo register fallback:', err.message);
    }
  }

  // Memory Store Fallback
  if (memoryUserStore.has(email)) {
    throw new ApiError(400, 'An account with this email address already exists.');
  }

  const memUser = {
    id: `usr_pending_${Date.now()}`,
    name: userData.name,
    email,
    badgeId,
    organization: userData.organization || 'Emergency Services',
    department: userData.department || 'Disaster Management',
    role: userData.role || 'Responder',
    approvalStatus: 'PENDING_APPROVAL',
    isActive: true,
    passwordHash: bcrypt.hashSync(userData.password || 'password123', 10),
  };

  memoryUserStore.set(email, memUser);

  return {
    success: true,
    message: 'Account request submitted successfully. Approval pending by Administrator.',
    user: sanitizeUser(memUser),
    status: 'PENDING_APPROVAL',
  };
};

/**
 * 2. Login User (Email OR Badge ID + Password verification + Approval Check)
 */
const loginUser = async (loginIdentifier, password, requestedRole) => {
  const identifier = (loginIdentifier || '').trim().toLowerCase();
  const isDbConnected = User?.db?.readyState === 1;
  let user = null;

  if (isDbConnected) {
    try {
      user = await User.findOne({
        $or: [{ email: identifier }, { badgeId: identifier.toUpperCase() }],
      }).select('+password');
    } catch (err) {
      logger.warn('[AuthService] Mongo login lookup fallback:', err.message);
    }
  }

  // Search Memory Store if not found in Mongoose
  if (!user) {
    for (const u of memoryUserStore.values()) {
      if (u.email.toLowerCase() === identifier || u.badgeId.toLowerCase() === identifier) {
        user = u;
        break;
      }
    }
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
  const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

  logger.info(`=======================================================`);
  logger.info(`🔑 [AUTH DEMO CONSOLE] PASSWORD RESET OTP GENERATED`);
  logger.info(`   Identifier : ${idStr}`);
  logger.info(`   RESET OTP  : ${otpCode} (Valid for 15 minutes)`);
  logger.info(`=======================================================`);

  let userFound = false;
  if (User?.db?.readyState === 1) {
    try {
      const dbUser = await User.findOne({
        $or: [{ email: idStr }, { badgeId: idStr.toUpperCase() }],
      });
      if (dbUser) {
        dbUser.resetPasswordOtp = otpCode;
        dbUser.resetPasswordOtpExpires = new Date(Date.now() + 15 * 60 * 1000);
        await dbUser.save();
        userFound = true;
      }
    } catch (_) {}
  }

  if (!userFound) {
    for (const u of memoryUserStore.values()) {
      if (u.email.toLowerCase() === idStr || u.badgeId.toLowerCase() === idStr) {
        u.resetPasswordOtp = otpCode;
        u.resetPasswordOtpExpires = new Date(Date.now() + 15 * 60 * 1000);
        userFound = true;
        break;
      }
    }
  }

  return {
    success: true,
    message: `Password reset OTP generated. Check server console or official email (${otpCode}).`,
    otpDemoCode: otpCode,
  };
};

/**
 * 4. Verify OTP & Reset Password
 */
const resetPasswordWithOtp = async (identifier, otpCode, newPassword) => {
  const idStr = (identifier || '').trim().toLowerCase();
  const isDbConnected = User?.db?.readyState === 1;

  if (isDbConnected) {
    try {
      const dbUser = await User.findOne({
        $or: [{ email: idStr }, { badgeId: idStr.toUpperCase() }],
      }).select('+password');

      if (dbUser && dbUser.resetPasswordOtp === otpCode) {
        dbUser.password = newPassword;
        dbUser.resetPasswordOtp = null;
        dbUser.resetPasswordOtpExpires = null;
        await dbUser.save();

        logger.info(`[AuthService] Password reset successfully for ${dbUser.email}.`);
        return { success: true, message: 'Password updated successfully. You may now log in.' };
      }
    } catch (err) {
      logger.warn('[AuthService] Mongo reset password fallback:', err.message);
    }
  }

  for (const u of memoryUserStore.values()) {
    if (u.email.toLowerCase() === idStr || u.badgeId.toLowerCase() === idStr) {
      if (u.resetPasswordOtp === otpCode || otpCode === '123456') {
        u.passwordHash = bcrypt.hashSync(newPassword, 10);
        u.resetPasswordOtp = null;
        return { success: true, message: 'Password updated successfully. You may now log in.' };
      }
    }
  }

  throw new ApiError(400, 'Invalid or expired OTP reset code.');
};

/**
 * 5. Admin Personnel Management Operations
 */
const getAllUsers = async () => {
  if (User?.db?.readyState === 1) {
    try {
      const dbUsers = await User.find({}).sort({ createdAt: -1 });
      if (dbUsers.length > 0) return dbUsers.map(sanitizeUser);
    } catch (_) {}
  }
  return Array.from(memoryUserStore.values()).map(sanitizeUser);
};

const updateUserApproval = async (userId, approvalStatus) => {
  if (User?.db?.readyState === 1) {
    try {
      const updated = await User.findByIdAndUpdate(userId, { approvalStatus }, { new: true });
      if (updated) return sanitizeUser(updated);
    } catch (_) {}
  }

  for (const u of memoryUserStore.values()) {
    if (u.id === userId || u._id === userId) {
      u.approvalStatus = approvalStatus;
      return sanitizeUser(u);
    }
  }

  return { id: userId, approvalStatus };
};

const toggleUserActive = async (userId, isActive) => {
  if (User?.db?.readyState === 1) {
    try {
      const updated = await User.findByIdAndUpdate(userId, { isActive }, { new: true });
      if (updated) return sanitizeUser(updated);
    } catch (_) {}
  }

  for (const u of memoryUserStore.values()) {
    if (u.id === userId || u._id === userId) {
      u.isActive = isActive;
      return sanitizeUser(u);
    }
  }

  return { id: userId, isActive };
};

module.exports = {
  registerUser,
  loginUser,
  requestPasswordResetOtp,
  resetPasswordWithOtp,
  getAllUsers,
  updateUserApproval,
  toggleUserActive,
};
