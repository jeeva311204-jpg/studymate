const express = require('express');
const router = express.Router();
const questionController = require('../controllers/questionController');
const authMiddleware = require('../middleware/auth');
const validateObjectId = require('../middleware/validateObjectId');
const { aiRateLimiter } = require('../middleware/rateLimiter');

// All question routes require authentication
router.use(authMiddleware);

// Generate AI-predicted likely exam questions (2, 8, 16 marks)
router.post('/generate', aiRateLimiter, questionController.generateExamQuestions);

// Fetch saved questions for a note
router.get('/note/:noteId', validateObjectId, questionController.getQuestionsByNoteId);

module.exports = router;
