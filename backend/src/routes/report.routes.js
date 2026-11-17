const express = require('express');
const reportController = require('../controllers/report.controller');
const { requireAuth } = require('../middleware/auth.middleware');

const router = express.Router();

router.use(requireAuth);

router.get('/dashboard', reportController.getDashboard);
router.get('/overview', reportController.getOverview);
router.get('/export.csv', reportController.exportCsv);
router.get('/export.xlsx', reportController.exportExcel);

module.exports = router;

