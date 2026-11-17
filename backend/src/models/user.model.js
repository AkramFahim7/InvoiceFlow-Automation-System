const { pool } = require('../config/db');

const DEFAULT_WORKFLOWS = [
  {
    key: 'INVOICE_SENT_EMAIL',
    name: 'Send Invoice Email',
    description: 'Automatically email the invoice PDF when an invoice is marked as Sent.',
    triggerEvent: 'INVOICE_SENT',
    daysBeforeDue: 0,
  },
  {
    key: 'PAYMENT_REMINDER',
    name: 'Upcoming Payment Reminder',
    description: 'Send a payment reminder before an unpaid invoice reaches its due date.',
    triggerEvent: 'DUE_DATE_APPROACHING',
    daysBeforeDue: 3,
  },
  {
    key: 'OVERDUE_NOTIFICATION',
    name: 'Overdue Invoice Notification',
    description: 'Mark unpaid past-due invoices as Overdue and notify the customer.',
    triggerEvent: 'INVOICE_OVERDUE',
    daysBeforeDue: 0,
  },
  {
    key: 'PAYMENT_CONFIRMATION',
    name: 'Payment Confirmation Receipt',
    description: 'Send a confirmation email whenever a payment is recorded.',
    triggerEvent: 'PAYMENT_RECEIVED',
    daysBeforeDue: 0,
  },
];

async function findByEmail(email) {
  const [rows] = await pool.query(
    `SELECT id, full_name, email, password_hash, created_at
     FROM users
     WHERE email = ?
     LIMIT 1`,
    [email]
  );
  return rows[0] || null;
}

async function findProfileById(userId) {
  const [rows] = await pool.query(
    `SELECT
       u.id,
       u.full_name,
       u.email,
       u.created_at,
       bp.id AS business_profile_id,
       bp.business_name,
       bp.business_email,
       bp.phone,
       bp.address,
       bp.tax_label,
       bp.default_tax_rate,
       bp.currency_symbol,
       bp.invoice_prefix,
       bp.next_invoice_number,
       bp.payment_instructions,
       bp.logo_url
     FROM users u
     INNER JOIN business_profiles bp ON bp.user_id = u.id
     WHERE u.id = ?
     LIMIT 1`,
    [userId]
  );
  return rows[0] || null;
}

/**
 * Atomically create a user, their 1-to-1 business profile, and default automation workflows.
 */
async function createAccountWithProfile({ fullName, email, passwordHash, businessName }) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [userResult] = await connection.query(
      `INSERT INTO users (full_name, email, password_hash)
       VALUES (?, ?, ?)`,
      [fullName, email, passwordHash]
    );
    const userId = userResult.insertId;

    await connection.query(
      `INSERT INTO business_profiles (user_id, business_name, business_email)
       VALUES (?, ?, ?)`,
      [userId, businessName, email]
    );

    for (const wf of DEFAULT_WORKFLOWS) {
      await connection.query(
        `INSERT INTO automation_workflows
           (user_id, workflow_key, name, description, trigger_event, is_enabled, days_before_due)
         VALUES (?, ?, ?, ?, ?, 1, ?)`,
        [userId, wf.key, wf.name, wf.description, wf.triggerEvent, wf.daysBeforeDue]
      );
    }

    await connection.commit();
    return await findProfileById(userId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function updateAccountAndProfile(userId, data) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    await connection.query(
      `UPDATE users
       SET full_name = ?
       WHERE id = ?`,
      [data.fullName, userId]
    );

    await connection.query(
      `UPDATE business_profiles
       SET
         business_name = ?,
         business_email = ?,
         phone = ?,
         address = ?,
         tax_label = ?,
         default_tax_rate = ?,
         currency_symbol = ?,
         invoice_prefix = ?,
         payment_instructions = ?
       WHERE user_id = ?`,
      [
        data.businessName,
        data.businessEmail,
        data.phone,
        data.address,
        data.taxLabel,
        data.defaultTaxRate,
        data.currencySymbol,
        data.invoicePrefix,
        data.paymentInstructions,
        userId,
      ]
    );

    await connection.commit();
    return await findProfileById(userId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function updateLogoUrl(userId, logoUrl) {
  await pool.query(
    `UPDATE business_profiles
     SET logo_url = ?
     WHERE user_id = ?`,
    [logoUrl, userId]
  );
  return await findProfileById(userId);
}

module.exports = {
  findByEmail,
  findProfileById,
  createAccountWithProfile,
  updateAccountAndProfile,
  updateLogoUrl,
};

