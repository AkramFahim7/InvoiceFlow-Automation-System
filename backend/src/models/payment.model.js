const { pool } = require('../config/db');
const AppError = require('../utils/appError');
const { calculatePaymentUpdate } = require('../utils/money');

const PAYABLE_STATUSES = new Set(['Sent', 'Partially Paid', 'Overdue']);

async function findAllByUser(userId, { search = '', method = 'all' } = {}) {
  const conditions = ['p.user_id = ?'];
  const params = [userId];

  const trimmed = search.trim();
  if (trimmed) {
    const like = `%${trimmed}%`;
    conditions.push(
      '(i.invoice_number LIKE ? OR c.name LIKE ? OR c.company_name LIKE ? OR p.reference_number LIKE ?)'
    );
    params.push(like, like, like, like);
  }

  if (method && method !== 'all') {
    conditions.push('p.payment_method = ?');
    params.push(method);
  }

  const [rows] = await pool.query(
    `SELECT
       p.id,
       p.invoice_id,
       p.amount,
       p.payment_date,
       p.payment_method,
       p.reference_number,
       p.notes,
       p.created_at,
       i.invoice_number,
       i.status AS invoice_status,
       i.grand_total AS invoice_grand_total,
       i.remaining_balance AS invoice_remaining_balance,
       c.id AS customer_id,
       c.name AS customer_name,
       c.company_name AS customer_company
     FROM payments p
     INNER JOIN invoices i ON i.id = p.invoice_id
     INNER JOIN customers c ON c.id = i.customer_id
     WHERE ${conditions.join(' AND ')}
     ORDER BY p.payment_date DESC, p.id DESC`,
    params
  );

  return rows;
}

async function findByIdAndUser(paymentId, userId) {
  const [rows] = await pool.query(
    `SELECT id, invoice_id, amount, payment_date, payment_method, reference_number, notes, created_at
     FROM payments
     WHERE id = ? AND user_id = ?
     LIMIT 1`,
    [paymentId, userId]
  );
  return rows[0] || null;
}

/**
 * Atomically lock the target invoice, validate payable status and remaining balance,
 * insert the payment record, and update invoice paid/balance/status fields.
 */
async function recordPaymentTransaction(userId, payload) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [invoiceRows] = await connection.query(
      `SELECT id, user_id, invoice_number, status, grand_total, amount_paid, remaining_balance
       FROM invoices
       WHERE id = ? AND user_id = ?
       FOR UPDATE`,
      [payload.invoiceId, userId]
    );

    const invoice = invoiceRows[0];
    if (!invoice) {
      throw new AppError('Invoice not found.', 404);
    }

    if (!PAYABLE_STATUSES.has(invoice.status)) {
      throw new AppError(
        `Cannot record a payment for an invoice with status "${invoice.status}".`,
        409
      );
    }

    let mathResult;
    try {
      mathResult = calculatePaymentUpdate({
        grandTotal: invoice.grand_total,
        currentAmountPaid: invoice.amount_paid,
        paymentAmount: payload.amount,
      });
    } catch (err) {
      throw new AppError(err.message, 400);
    }

    const [insertRes] = await connection.query(
      `INSERT INTO payments
         (user_id, invoice_id, amount, payment_date, payment_method, reference_number, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        invoice.id,
        mathResult.paymentAmount,
        payload.paymentDate,
        payload.paymentMethod,
        payload.referenceNumber,
        payload.notes,
      ]
    );

    await connection.query(
      `UPDATE invoices
       SET
         amount_paid = ?,
         remaining_balance = ?,
         status = ?
       WHERE id = ? AND user_id = ?`,
      [
        mathResult.newAmountPaid,
        mathResult.newRemainingBalance,
        mathResult.newStatus,
        invoice.id,
        userId,
      ]
    );

    await connection.commit();

    return {
      paymentId: insertRes.insertId,
      invoiceId: invoice.id,
      newStatus: mathResult.newStatus,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = {
  findAllByUser,
  findByIdAndUser,
  recordPaymentTransaction,
};

