const express = require('express');
const { testDatabaseConnection } = require('../config/db');

const router = express.Router();

/**
 * GET /api/health
 * Confirms the Express API is running and reports live MySQL connectivity.
 */
router.get('/', async (req, res) => {
  try {
    const dbStatus = await testDatabaseConnection();
    res.status(200).json({
      status: 'ok',
      service: 'InvoiceFlow Backend API',
      timestamp: new Date().toISOString(),
      database: dbStatus,
    });
  } catch (error) {
    res.status(503).json({
      status: 'error',
      service: 'InvoiceFlow Backend API',
      timestamp: new Date().toISOString(),
      database: {
        connected: false,
        code: error.code || 'DB_CONNECTION_ERROR',
        message: error.message,
      },
    });
  }
});

module.exports = router;

