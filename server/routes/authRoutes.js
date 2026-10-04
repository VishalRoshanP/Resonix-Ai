const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticateUser, authorizeRole } = require('../middlewares/authMiddleware');
const { authLimiter } = require('../middlewares/rateLimitMiddleware');
const validate = require('../middlewares/validationMiddleware');
const {
  validateRegister,
  validateLogin,
  validateForgotPassword,
  validateResetPassword,
} = require('../validations/authValidation');

// Public Authentication Routes with Input Validation & Rate Limiting
router.post('/register', authLimiter, validate(validateRegister), authController.register);
router.post('/login', authLimiter, validate(validateLogin), authController.login);
router.post('/logout', authController.logout);
router.post('/forgot-password', authLimiter, validate(validateForgotPassword), authController.forgotPassword);
router.post('/reset-password', authLimiter, validate(validateResetPassword), authController.resetPassword);

// Prepared Structure for Future Google Authentication
router.post('/google', authLimiter, authController.googleAuth);

// Protected Authentication Routes
router.get('/me', authenticateUser, authController.getMe);

// Authorized Administrator & Commander Account Management Routes
router.get('/users', authenticateUser, authorizeRole('admin', 'commander'), authController.getAllUsers);
router.put('/users/:id/approve', authenticateUser, authorizeRole('admin', 'commander'), authController.approveUser);
router.put('/users/:id/reject', authenticateUser, authorizeRole('admin', 'commander'), authController.rejectUser);
router.put('/users/:id/toggle-active', authenticateUser, authorizeRole('admin', 'commander'), authController.toggleUserActive);

module.exports = router;

