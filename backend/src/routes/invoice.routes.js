const express = require('express');
const invoiceController = require('../controllers/invoice.controller');
const { requireAuth } = require('../middleware/auth.middleware');

const router = express.Router();

// All invoice endpoints require a valid JWT and enforce user_id isolation
router.use(requireAuth);

router.get('/', invoiceController.list);
router.get('/:id', invoiceController.getOne);
router.get('/:id/pdf', invoiceController.downloadPdf);
router.post('/', invoiceController.create);
router.put('/:id', invoiceController.update);
router.patch('/:id/status', invoiceController.updateStatus);
router.delete('/:id', invoiceController.remove);

module.exports = router;

