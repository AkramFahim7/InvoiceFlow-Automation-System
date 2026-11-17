const mysql = require('mysql2/promise');
const env = require('./env');

/**
 * Create a reusable MySQL connection pool.
 * Pooling avoids opening and closing a new TCP/MySQL connection on every request.
 */
const pool = mysql.createPool({
  host: env.db.host,
  port: env.db.port,
  user: env.db.user,
  password: env.db.password,
  database: env.db.name,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

/**
 * Verify that the MySQL server and configured database are reachable.
 * @returns {Promise<{ connected: boolean, version: string, database: string }>}
 */
async function testDatabaseConnection() {
  const connection = await pool.getConnection();
  try {
    const [rows] = await connection.query(
      'SELECT VERSION() AS version, DATABASE() AS currentDatabase'
    );
    return {
      connected: true,
      version: rows[0].version,
      database: rows[0].currentDatabase,
    };
  } finally {
    // Always release the connection back to the pool, even if a query fails
    connection.release();
  }
}

module.exports = {
  pool,
  testDatabaseConnection,
};

