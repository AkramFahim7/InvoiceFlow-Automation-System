const path = require('path');
const dotenv = require('dotenv');

// Load environment variables from backend/.env into process.env
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const smtpHost = (process.env.SMTP_HOST || '').trim();
const smtpUser = (process.env.SMTP_USER || '').trim();
const smtpPass = (process.env.SMTP_PASS || '').trim();

const env = {
  port: Number(process.env.PORT) || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  db: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    name: process.env.DB_NAME || 'invoiceflow_db',
  },
  jwt: {
    secret: process.env.JWT_SECRET || '',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
  smtp: {
    host: smtpHost,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    user: smtpUser,
    pass: smtpPass,
    from: (process.env.SMTP_FROM || 'InvoiceFlow <no-reply@invoiceflow.local>').trim(),
    isConfigured: Boolean(smtpHost && smtpUser && smtpPass),
  },
  cron: {
    enabled: process.env.ENABLE_SCHEDULER !== 'false',
    schedule: (process.env.CRON_SCHEDULE || '*/5 * * * *').trim(),
  },
};

if (!env.jwt.secret) {
  throw new Error('Missing required environment variable: JWT_SECRET');
}

module.exports = env;
