const path = require('path');
const express = require('express');
const cors = require('cors');
const env = require('./config/env');
const healthRoutes = require('./routes/health.routes');
const authRoutes = require('./routes/auth.routes');
const customerRoutes = require('./routes/customer.routes');
const invoiceRoutes = require('./routes/invoice.routes');
const paymentRoutes = require('./routes/payment.routes');
const emailRoutes = require('./routes/email.routes');
const automationRoutes = require('./routes/automation.routes');
const reportRoutes = require('./routes/report.routes');
const { securityHeaders } = require('./middleware/security.middleware');
const errorHandler = require('./middleware/error.middleware');

const app = express();
app.disable('x-powered-by');
app.use(securityHeaders);

// Allow requests from the React frontend origin
app.use(
  cors({
    origin: env.frontendUrl,
    credentials: true,
  })
);

// Parse incoming JSON request bodies with bounded payload size
app.use(express.json({ limit: '1mb' }));

// Serve uploaded business logos statically
app.use('/uploads', express.static(path.resolve(__dirname, '../uploads')));

// Base welcome endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'InvoiceFlow API',
    phase: 12,
    message: 'Backend server is running.',
  });
});

// Public & protected routes
app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/emails', emailRoutes);
app.use('/api/automation', automationRoutes);
app.use('/api/reports', reportRoutes);

// Fallback for unknown routes
app.use((req, res) => {
  res.status(404).json({
    status: 'error',
    message: `Route ${req.method} ${req.originalUrl} not found`,
  });
});

// Centralized error handler (must be registered last)
app.use(errorHandler);

module.exports = app;
