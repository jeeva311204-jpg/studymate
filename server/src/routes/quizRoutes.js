const express = require('express');
const router = express.Router();
const quizController = require('../controllers/quizController');
const authMiddleware = require('../middleware/auth');
const validateObjectId = require('../middleware/validateObjectId');
const { aiRateLimiter } = require('../middleware/rateLimiter');

router.use(authMiddleware);

router.post('/generate', aiRateLimiter, quizController.generateQuiz);
router.post('/save-result', quizController.saveQuizResult);
router.get('/history', quizController.getQuizHistory);
router.get('/result/:id', validateObjectId, quizController.getQuizResultById);

module.exports = router;
