const express = require('express');
const router = express.Router();
const noteController = require('../controllers/noteController');
const authMiddleware = require('../middleware/auth');
const upload = require('../middleware/upload');
const validateObjectId = require('../middleware/validateObjectId');
const { aiRateLimiter } = require('../middleware/rateLimiter');

// All note routes require authentication
router.use(authMiddleware);

router.post('/upload', aiRateLimiter, upload.single('file'), noteController.uploadNotes);
router.post('/paste', aiRateLimiter, noteController.pasteNotes);
router.post('/from-topic', aiRateLimiter, noteController.createFromTopic);
router.post('/analyze-topic-direct', aiRateLimiter, noteController.analyzeTopicDirect);
router.get('/', noteController.getNotes);
router.get('/:id', validateObjectId, noteController.getNoteById);
router.post('/:id/summarize', validateObjectId, aiRateLimiter, noteController.regenerateSummary);
router.post('/:id/analyze-topics', validateObjectId, aiRateLimiter, noteController.analyzeNoteTopics);
router.delete('/:id', validateObjectId, noteController.deleteNote);

module.exports = router;
