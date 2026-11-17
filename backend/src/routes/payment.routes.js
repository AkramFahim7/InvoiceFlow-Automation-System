const express = require('express');
const paymentController = require('../controllers/payment.controller');
const { requireAuth } = require('../middleware/auth.middleware');

const router = express.Router();

// All payment routes require a valid JWT and enforce user_id isolation
router.use(requireAuth);

router.get('/', paymentController.list);
router.post('/', paymentController.create);

module.exports = router;

