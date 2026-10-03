const express = require('express');
const router = express.Router();
const flashcardController = require('../controllers/flashcardController');
const authMiddleware = require('../middleware/auth');
const validateObjectId = require('../middleware/validateObjectId');
const { aiRateLimiter } = require('../middleware/rateLimiter');

router.use(authMiddleware);

router.post('/generate', aiRateLimiter, flashcardController.generateFlashcards);
router.get('/note/:noteId', validateObjectId, flashcardController.getDeckByNoteId);

module.exports = router;
