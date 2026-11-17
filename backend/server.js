const app = require('./src/app');
const env = require('./src/config/env');
const { testDatabaseConnection } = require('./src/config/db');
const { startScheduler } = require('./src/automation/scheduler');

async function startServer() {
  try {
    const dbStatus = await testDatabaseConnection();
    console.log(
      `[DB] Connected to MySQL (${dbStatus.version}) - database: ${dbStatus.database}`
    );
  } catch (error) {
    console.warn(
      `[DB] Warning: Could not connect to MySQL on startup (${error.code || error.message}).`
    );
    console.warn(
      '[DB] Make sure XAMPP MySQL is running and the database exists, then check GET /api/health.'
    );
  }

  app.listen(env.port, () => {
    console.log(`[Server] InvoiceFlow API running at http://localhost:${env.port}`);
    startScheduler();
  });
}

startServer();

