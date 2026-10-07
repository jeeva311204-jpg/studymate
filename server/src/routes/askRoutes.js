const express = require('express');
const router = express.Router();
const askController = require('../controllers/askController');
const authMiddleware = require('../middleware/auth');
const validateObjectId = require('../middleware/validateObjectId');
const { askRateLimiter } = require('../middleware/rateLimiter');
const askImageUpload = require('../middleware/askUpload');

// All ask routes require authentication
router.use(authMiddleware);

// POST /api/ask (auth required, askRateLimiter applied, multipart image upload + JSON)
router.post('/', askRateLimiter, askImageUpload, askController.askQuestion);

// GET /api/ask/capabilities (auth required, returns { imageGeneration: boolean })
router.get('/capabilities', askController.getCapabilities);

// Conversation management routes
router.get('/conversations', askController.getConversations);
router.get('/conversations/:id', validateObjectId, askController.getConversationById);
router.patch('/conversations/:id', validateObjectId, askController.renameConversation);
router.delete('/conversations/:id', validateObjectId, askController.deleteConversation);

module.exports = router;
