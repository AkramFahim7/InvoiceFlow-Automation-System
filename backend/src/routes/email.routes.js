const express = require('express');
const emailController = require('../controllers/email.controller');
const { requireAuth } = require('../middleware/auth.middleware');

const router = express.Router();

router.use(requireAuth);

router.get('/logs', emailController.listLogs);
router.post('/invoices/:invoiceId/send', emailController.sendInvoice);
router.post('/payments/:paymentId/confirmation', emailController.sendPaymentConfirmation);

module.exports = router;

