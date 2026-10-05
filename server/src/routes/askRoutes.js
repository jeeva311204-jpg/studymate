const express = require('express');
const router = express.Router();
const askController = require('../controllers/askController');
const authMiddleware = require('../middleware/auth');
const { askRateLimiter } = require('../middleware/rateLimiter');

// POST /api/ask (auth required, askRateLimiter applied)
router.post('/', authMiddleware, askRateLimiter, askController.askQuestion);

module.exports = router;
