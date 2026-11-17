const { pool } = require('../config/db');

async function findAllByUser(userId, { search = '', filter = 'all' } = {}) {
  const conditions = ['c.user_id = ?'];
  const params = [userId];

  const trimmedSearch = search.trim();
  if (trimmedSearch) {
    const likePattern = `%${trimmedSearch}%`;
    conditions.push(
      '(c.name LIKE ? OR c.company_name LIKE ? OR c.email LIKE ? OR c.phone LIKE ?)'
    );
    params.push(likePattern, likePattern, likePattern, likePattern);
  }

  if (filter === 'with_email') {
    conditions.push("c.email IS NOT NULL AND c.email <> ''");
  } else if (filter === 'missing_email') {
    conditions.push("(c.email IS NULL OR c.email = '')");
  }

  const havingClause = filter === 'has_invoices' ? 'HAVING invoice_count > 0' : '';

  const [rows] = await pool.query(
    `SELECT
       c.id,
       c.user_id,
       c.name,
       c.company_name,
       c.email,
       c.phone,
       c.billing_address,
       c.notes,
       c.created_at,
       c.updated_at,
       COUNT(i.id) AS invoice_count,
       COALESCE(SUM(CASE WHEN i.status <> 'Cancelled' THEN i.grand_total ELSE 0 END), 0.00) AS total_billed,
       COALESCE(SUM(CASE WHEN i.status NOT IN ('Paid', 'Cancelled', 'Draft') THEN i.remaining_balance ELSE 0 END), 0.00) AS outstanding_balance
     FROM customers c
     LEFT JOIN invoices i ON i.customer_id = c.id AND i.user_id = c.user_id
     WHERE ${conditions.join(' AND ')}
     GROUP BY c.id
     ${havingClause}
     ORDER BY c.created_at DESC, c.id DESC`,
    params
  );

  return rows;
}

async function findByIdAndUser(customerId, userId) {
  const [rows] = await pool.query(
    `SELECT
       id,
       user_id,
       name,
       company_name,
       email,
       phone,
       billing_address,
       notes,
       created_at,
       updated_at
     FROM customers
     WHERE id = ? AND user_id = ?
     LIMIT 1`,
    [customerId, userId]
  );
  return rows[0] || null;
}

async function findInvoicesByCustomerAndUser(customerId, userId) {
  const [rows] = await pool.query(
    `SELECT
       id,
       invoice_number,
       issue_date,
       due_date,
       status,
       grand_total,
       amount_paid,
       remaining_balance,
       created_at
     FROM invoices
     WHERE customer_id = ? AND user_id = ?
     ORDER BY issue_date DESC, id DESC`,
    [customerId, userId]
  );
  return rows;
}

async function create(userId, data) {
  const [result] = await pool.query(
    `INSERT INTO customers
       (user_id, name, company_name, email, phone, billing_address, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      userId,
      data.name,
      data.companyName,
      data.email,
      data.phone,
      data.billingAddress,
      data.notes,
    ]
  );
  return await findByIdAndUser(result.insertId, userId);
}

async function updateByIdAndUser(customerId, userId, data) {
  await pool.query(
    `UPDATE customers
     SET
       name = ?,
       company_name = ?,
       email = ?,
       phone = ?,
       billing_address = ?,
       notes = ?
     WHERE id = ? AND user_id = ?`,
    [
      data.name,
      data.companyName,
      data.email,
      data.phone,
      data.billingAddress,
      data.notes,
      customerId,
      userId,
    ]
  );
  return await findByIdAndUser(customerId, userId);
}

async function countInvoicesByCustomerAndUser(customerId, userId) {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS total
     FROM invoices
     WHERE customer_id = ? AND user_id = ?`,
    [customerId, userId]
  );
  return Number(rows[0].total);
}

async function deleteByIdAndUser(customerId, userId) {
  const [result] = await pool.query(
    `DELETE FROM customers
     WHERE id = ? AND user_id = ?`,
    [customerId, userId]
  );
  return result.affectedRows > 0;
}

module.exports = {
  findAllByUser,
  findByIdAndUser,
  findInvoicesByCustomerAndUser,
  create,
  updateByIdAndUser,
  countInvoicesByCustomerAndUser,
  deleteByIdAndUser,
};

