const { pool } = require('../config/db');

async function createLog({
  userId,
  invoiceId = null,
  recipientEmail,
  subject,
  templateName,
  deliveryMode,
  status,
  errorMessage = null,
}) {
  const [result] = await pool.query(
    `INSERT INTO email_logs
       (user_id, invoice_id, recipient_email, subject, template_name, delivery_mode, status, error_message)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      userId,
      invoiceId,
      recipientEmail,
      subject,
      templateName,
      deliveryMode,
      status,
      errorMessage,
    ]
  );

  const [rows] = await pool.query(
    `SELECT * FROM email_logs WHERE id = ? LIMIT 1`,
    [result.insertId]
  );
  return rows[0];
}

async function findAllByUser(userId, { invoiceId = null, limit = 50 } = {}) {
  const conditions = ['el.user_id = ?'];
  const params = [userId];

  if (invoiceId) {
    conditions.push('el.invoice_id = ?');
    params.push(invoiceId);
  }

  params.push(Number(limit) || 50);

  const [rows] = await pool.query(
    `SELECT
       el.id,
       el.invoice_id,
       el.recipient_email,
       el.subject,
       el.template_name,
       el.delivery_mode,
       el.status,
       el.error_message,
       el.sent_at,
       i.invoice_number
     FROM email_logs el
     LEFT JOIN invoices i ON i.id = el.invoice_id
     WHERE ${conditions.join(' AND ')}
     ORDER BY el.sent_at DESC, el.id DESC
     LIMIT ?`,
    params
  );

  return rows;
}

module.exports = {
  createLog,
  findAllByUser,
};

