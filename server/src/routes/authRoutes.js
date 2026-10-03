const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/auth');
const { authRateLimiter, registerRateLimiter } = require('../middleware/rateLimiter');

router.post('/register', registerRateLimiter, authController.register);
router.post('/login', authRateLimiter, authController.login);
router.get('/me', authMiddleware, authController.getMe);

module.exports = router;
