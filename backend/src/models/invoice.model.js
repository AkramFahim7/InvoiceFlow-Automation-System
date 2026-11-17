const { pool } = require('../config/db');

async function findAllByUser(userId, { search = '', status = 'all', customerId = null } = {}) {
  const conditions = ['i.user_id = ?'];
  const params = [userId];

  const trimmedSearch = search.trim();
  if (trimmedSearch) {
    const likePattern = `%${trimmedSearch}%`;
    conditions.push(
      '(i.invoice_number LIKE ? OR c.name LIKE ? OR c.company_name LIKE ?)'
    );
    params.push(likePattern, likePattern, likePattern);
  }

  if (status && status !== 'all') {
    conditions.push('i.status = ?');
    params.push(status);
  }

  if (customerId) {
    conditions.push('i.customer_id = ?');
    params.push(customerId);
  }

  const [rows] = await pool.query(
    `SELECT
       i.id,
       i.user_id,
       i.customer_id,
       i.invoice_number,
       i.issue_date,
       i.due_date,
       i.status,
       i.subtotal,
       i.discount_amount,
       i.tax_rate,
       i.tax_amount,
       i.grand_total,
       i.amount_paid,
       i.remaining_balance,
       i.sent_at,
       i.created_at,
       i.updated_at,
       c.name AS customer_name,
       c.company_name AS customer_company,
       c.email AS customer_email
     FROM invoices i
     INNER JOIN customers c ON c.id = i.customer_id
     WHERE ${conditions.join(' AND ')}
     ORDER BY i.created_at DESC, i.id DESC`,
    params
  );

  return rows;
}

async function findByIdAndUser(invoiceId, userId) {
  const [invoiceRows] = await pool.query(
    `SELECT
       i.*,
       c.name AS customer_name,
       c.company_name AS customer_company,
       c.email AS customer_email,
       c.phone AS customer_phone,
       c.billing_address AS customer_address,
       bp.business_name,
       bp.business_email,
       bp.phone AS business_phone,
       bp.address AS business_address,
       bp.tax_label,
       bp.currency_symbol,
       bp.logo_url
     FROM invoices i
     INNER JOIN customers c ON c.id = i.customer_id
     INNER JOIN business_profiles bp ON bp.user_id = i.user_id
     WHERE i.id = ? AND i.user_id = ?
     LIMIT 1`,
    [invoiceId, userId]
  );

  const invoice = invoiceRows[0];
  if (!invoice) return null;

  const [itemRows] = await pool.query(
    `SELECT id, description, quantity, unit_price, line_total, sort_order
     FROM invoice_items
     WHERE invoice_id = ?
     ORDER BY sort_order ASC, id ASC`,
    [invoiceId]
  );

  const [paymentRows] = await pool.query(
    `SELECT id, amount, payment_date, payment_method, reference_number, notes, created_at
     FROM payments
     WHERE invoice_id = ? AND user_id = ?
     ORDER BY payment_date DESC, id DESC`,
    [invoiceId, userId]
  );

  return {
    ...invoice,
    items: itemRows,
    payments: paymentRows,
  };
}

/**
 * Atomically generate the next invoice number, create the invoice header,
 * and insert all line items inside a single SQL transaction.
 */
async function createWithItems(userId, invoiceData, items) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Lock the business profile row so concurrent requests cannot claim the same invoice number
    const [profileRows] = await connection.query(
      `SELECT invoice_prefix, next_invoice_number
       FROM business_profiles
       WHERE user_id = ?
       FOR UPDATE`,
      [userId]
    );

    const profile = profileRows[0];
    const prefix = profile?.invoice_prefix || 'INV-';
    const nextNum = Number(profile?.next_invoice_number || 1);
    const invoiceNumber = `${prefix}${String(nextNum).padStart(4, '0')}`;

    await connection.query(
      `UPDATE business_profiles
       SET next_invoice_number = next_invoice_number + 1
       WHERE user_id = ?`,
      [userId]
    );

    const [insertResult] = await connection.query(
      `INSERT INTO invoices (
         user_id, customer_id, invoice_number, issue_date, due_date, status,
         subtotal, discount_amount, tax_rate, tax_amount, grand_total,
         amount_paid, remaining_balance, payment_instructions, notes, sent_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        invoiceData.customerId,
        invoiceNumber,
        invoiceData.issueDate,
        invoiceData.dueDate,
        invoiceData.status,
        invoiceData.subtotal,
        invoiceData.discountAmount,
        invoiceData.taxRate,
        invoiceData.taxAmount,
        invoiceData.grandTotal,
        '0.00',
        invoiceData.grandTotal,
        invoiceData.paymentInstructions,
        invoiceData.notes,
        invoiceData.sentAt,
      ]
    );

    const invoiceId = insertResult.insertId;

    for (const item of items) {
      await connection.query(
        `INSERT INTO invoice_items
           (invoice_id, description, quantity, unit_price, line_total, sort_order)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          invoiceId,
          item.description,
          item.quantity,
          item.unitPrice,
          item.lineTotal,
          item.sortOrder,
        ]
      );
    }

    await connection.commit();
    return await findByIdAndUser(invoiceId, userId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function updateWithItems(invoiceId, userId, invoiceData, items) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    await connection.query(
      `UPDATE invoices
       SET
         customer_id = ?,
         issue_date = ?,
         due_date = ?,
         subtotal = ?,
         discount_amount = ?,
         tax_rate = ?,
         tax_amount = ?,
         grand_total = ?,
         remaining_balance = ?,
         payment_instructions = ?,
         notes = ?
       WHERE id = ? AND user_id = ?`,
      [
        invoiceData.customerId,
        invoiceData.issueDate,
        invoiceData.dueDate,
        invoiceData.subtotal,
        invoiceData.discountAmount,
        invoiceData.taxRate,
        invoiceData.taxAmount,
        invoiceData.grandTotal,
        invoiceData.grandTotal,
        invoiceData.paymentInstructions,
        invoiceData.notes,
        invoiceId,
        userId,
      ]
    );

    await connection.query(`DELETE FROM invoice_items WHERE invoice_id = ?`, [
      invoiceId,
    ]);

    for (const item of items) {
      await connection.query(
        `INSERT INTO invoice_items
           (invoice_id, description, quantity, unit_price, line_total, sort_order)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          invoiceId,
          item.description,
          item.quantity,
          item.unitPrice,
          item.lineTotal,
          item.sortOrder,
        ]
      );
    }

    await connection.commit();
    return await findByIdAndUser(invoiceId, userId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function updateStatusByIdAndUser(invoiceId, userId, status, sentAt = null) {
  await pool.query(
    `UPDATE invoices
     SET status = ?, sent_at = COALESCE(sent_at, ?)
     WHERE id = ? AND user_id = ?`,
    [status, sentAt, invoiceId, userId]
  );
  return await findByIdAndUser(invoiceId, userId);
}

async function deleteDraftByIdAndUser(invoiceId, userId) {
  const [result] = await pool.query(
    `DELETE FROM invoices
     WHERE id = ? AND user_id = ? AND status = 'Draft'`,
    [invoiceId, userId]
  );
  return result.affectedRows > 0;
}

module.exports = {
  findAllByUser,
  findByIdAndUser,
  createWithItems,
  updateWithItems,
  updateStatusByIdAndUser,
  deleteDraftByIdAndUser,
};

