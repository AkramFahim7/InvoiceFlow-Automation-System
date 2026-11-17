const express = require('express');
const automationController = require('../controllers/automation.controller');
const { requireAuth } = require('../middleware/auth.middleware');

const router = express.Router();

router.use(requireAuth);

router.get('/overview', automationController.getOverview);
router.get('/workflows', automationController.listWorkflows);
router.patch('/workflows/:id', automationController.updateWorkflow);
router.get('/executions', automationController.listExecutions);
router.post('/executions/:id/retry', automationController.retryExecution);
router.post('/run-checks', automationController.runChecks);

module.exports = router;
