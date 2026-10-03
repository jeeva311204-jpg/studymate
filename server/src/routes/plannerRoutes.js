const express = require('express');
const router = express.Router();
const plannerController = require('../controllers/plannerController');
const authMiddleware = require('../middleware/auth');
const validateObjectId = require('../middleware/validateObjectId');
const { aiRateLimiter } = require('../middleware/rateLimiter');

router.use(authMiddleware);

router.post('/generate', aiRateLimiter, plannerController.generatePlan);
router.get('/', plannerController.getPlans);
router.get('/:id', validateObjectId, plannerController.getPlanById);
router.patch('/:id/toggle-task', validateObjectId, plannerController.toggleTask);
router.delete('/:id', validateObjectId, plannerController.deletePlan);

module.exports = router;
