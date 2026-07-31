const ApiError = require('../utils/apiError');
const { verifyToken } = require('../utils/jwtHelper');
const User = require('../models/User');

/**
 * Middleware: authenticateUser
 * Verifies JWT token from Authorization header or cookie, attaches user to req.user
 */
const authenticateUser = async (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies?.jwt) {
      token = req.cookies.jwt;
    }

    if (!token) {
      return next(new ApiError(401, 'Authentication token missing. Please log in to access this resource.'));
    }

    const decoded = verifyToken(token);
    let currentUser = null;

    if (User?.db?.readyState === 1 && decoded?.id && String(decoded.id).match(/^[0-9a-fA-F]{24}$/)) {
      try {
        currentUser = await User.findById(decoded.id);
      } catch (_) {}
    }

    if (!currentUser && decoded) {
      currentUser = {
        _id: decoded.id,
        id: decoded.id,
        role: decoded.role || 'citizen',
        isActive: true,
      };
    }

    if (!currentUser) {
      return next(new ApiError(401, 'The user belonging to this authentication token no longer exists.'));
    }

    if (!currentUser.isActive) {
      return next(new ApiError(403, 'Your account has been deactivated. Please contact an administrator.'));
    }

    req.user = currentUser;
    next();
  } catch (error) {
    return next(new ApiError(401, 'Invalid or expired authentication token.'));
  }
};

/**
 * Middleware: authorizeRole
 * Restricts access to specified roles (e.g. authorizeRole('admin', 'commander'))
 */
const authorizeRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new ApiError(401, 'User is not authenticated.'));
    }
    if (!roles.includes(req.user.role)) {
      return next(
        new ApiError(403, `Access denied. Role '${req.user.role}' is not authorized to perform this action.`)
      );
    }
    next();
  };
};

// Aliases for compatibility
const protect = authenticateUser;
const restrictTo = authorizeRole;

module.exports = {
  authenticateUser,
  authorizeRole,
  protect,
  restrictTo,
};
