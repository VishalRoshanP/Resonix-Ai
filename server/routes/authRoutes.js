const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticateUser } = require('../middlewares/authMiddleware');

// Public Authentication Routes
router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/logout', authController.logout);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);

// Prepared Structure for Future Google Authentication
router.post('/google', authController.googleAuth);

// Protected Authentication Routes
router.get('/me', authenticateUser, authController.getMe);
router.get('/users', authenticateUser, authController.getAllUsers);
router.put('/users/:id/approve', authenticateUser, authController.approveUser);
router.put('/users/:id/reject', authenticateUser, authController.rejectUser);
router.put('/users/:id/toggle-active', authenticateUser, authController.toggleUserActive);

module.exports = router;
