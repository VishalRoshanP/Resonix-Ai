const authService = require('../services/authService');
const ApiResponse = require('../utils/apiResponse');

/**
 * @route   POST /api/auth/register
 * @desc    Request Command Center Access (Registration with PENDING_APPROVAL status)
 * @access  Public
 */
const register = async (req, res, next) => {
  try {
    const result = await authService.registerUser(req.body);
    return ApiResponse.success(res, 201, result.message || 'Access request submitted successfully. Approval pending by Administrator.', result);
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/auth/login
 * @desc    Authenticate user via Official Email OR Badge ID + Password
 * @access  Public
 */
const login = async (req, res, next) => {
  try {
    const { email, badgeId, password, selectedRole } = req.body || {};
    const identifier = email || badgeId || req.body.username;
    
    const result = await authService.loginUser(identifier, password, selectedRole);

    // Set JWT cookie
    res.cookie('jwt', result.token, {
      expires: new Date(Date.now() + (parseInt(process.env.JWT_COOKIE_EXPIRES_IN, 10) || 7) * 24 * 60 * 60 * 1000),
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
    });

    return ApiResponse.success(res, 200, 'Authentication successful. Command Center access granted.', result);
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user & clear session
 * @access  Public / Private
 */
const logout = async (req, res, next) => {
  try {
    res.cookie('jwt', 'loggedout', {
      expires: new Date(Date.now() + 10 * 1000),
      httpOnly: true,
    });
    return ApiResponse.success(res, 200, 'Logout successful. Session invalidated.');
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/auth/forgot-password
 * @desc    Generate password recovery OTP
 * @access  Public
 */
const forgotPassword = async (req, res, next) => {
  try {
    const { email, badgeId, identifier } = req.body || {};
    const idStr = identifier || email || badgeId;
    const result = await authService.requestPasswordResetOtp(idStr);
    return ApiResponse.success(res, 200, result.message, result);
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/auth/reset-password
 * @desc    Verify OTP and reset password
 * @access  Public
 */
const resetPassword = async (req, res, next) => {
  try {
    const { identifier, email, badgeId, otp, otpCode, newPassword } = req.body || {};
    const idStr = identifier || email || badgeId;
    const code = otp || otpCode;
    const result = await authService.resetPasswordWithOtp(idStr, code, newPassword);
    return ApiResponse.success(res, 200, result.message, result);
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/auth/me
 * @desc    Get authenticated user profile
 * @access  Private
 */
const getMe = async (req, res, next) => {
  try {
    return ApiResponse.success(res, 200, 'Authenticated user profile', { user: req.user });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/auth/users
 * @desc    Get all personnel accounts for Admin management
 * @access  Private / Admin
 */
const getAllUsers = async (req, res, next) => {
  try {
    const users = await authService.getAllUsers();
    return ApiResponse.success(res, 200, 'Personnel accounts retrieved', { users });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   PUT /api/auth/users/:id/approve
 * @desc    Admin Approve Account Status
 * @access  Private / Admin
 */
const approveUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updated = await authService.updateUserApproval(id, 'APPROVED');
    return ApiResponse.success(res, 200, `User account ${id} approved successfully`, { user: updated });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   PUT /api/auth/users/:id/reject
 * @desc    Admin Reject Account Access
 * @access  Private / Admin
 */
const rejectUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updated = await authService.updateUserApproval(id, 'REJECTED');
    return ApiResponse.success(res, 200, `User account ${id} rejected`, { user: updated });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   PUT /api/auth/users/:id/toggle-active
 * @desc    Admin Activate / Deactivate Account
 * @access  Private / Admin
 */
const toggleUserActive = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;
    const updated = await authService.toggleUserActive(id, Boolean(isActive));
    return ApiResponse.success(res, 200, `User account status updated`, { user: updated });
  } catch (error) {
    next(error);
  }
};

/**
 * Structure prepared for future Google OAuth integration
 */
const googleAuth = async (req, res, next) => {
  try {
    return ApiResponse.error(res, 501, 'Google Authentication structure prepared.');
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  login,
  logout,
  getMe,
  forgotPassword,
  resetPassword,
  getAllUsers,
  approveUser,
  rejectUser,
  toggleUserActive,
  googleAuth,
};
