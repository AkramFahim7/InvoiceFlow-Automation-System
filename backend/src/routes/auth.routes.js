const express = require('express');
const authController = require('../controllers/auth.controller');
const { requireAuth } = require('../middleware/auth.middleware');
const { createRateLimiter } = require('../middleware/security.middleware');

const router = express.Router();

const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 40,
  keyPrefix: 'auth',
  message: 'Too many authentication attempts. Please wait before trying again.',
});

// Public authentication endpoints (rate-limited)
router.post('/register', authRateLimiter, authController.register);
router.post('/login', authRateLimiter, authController.login);

// Protected user & business profile endpoints
router.get('/me', requireAuth, authController.getMe);
router.put('/profile', requireAuth, authController.updateProfile);
router.post(
  '/logo',
  requireAuth,
  express.raw({ type: ['image/png', 'image/jpeg'], limit: '1mb' }),
  authController.uploadLogo
);
router.post('/logout', requireAuth, authController.logout);

module.exports = router;

