const { pool } = require('../config/db');

/**
 * Aggregate invoice counts and exact DECIMAL totals for a single user.
 */
async function getInvoiceSummaryByUser(userId) {
  const [rows] = await pool.execute(
    `SELECT
       COUNT(*) AS total_invoices,
       SUM(CASE WHEN status = 'Draft' THEN 1 ELSE 0 END) AS draft_count,
       SUM(CASE WHEN status = 'Sent' THEN 1 ELSE 0 END) AS sent_count,
       SUM(CASE WHEN status = 'Partially Paid' THEN 1 ELSE 0 END) AS partially_paid_count,
       SUM(CASE WHEN status = 'Paid' THEN 1 ELSE 0 END) AS paid_count,
       SUM(CASE WHEN status = 'Overdue' THEN 1 ELSE 0 END) AS overdue_count,
       SUM(CASE WHEN status = 'Cancelled' THEN 1 ELSE 0 END) AS cancelled_count,
       COALESCE(SUM(CASE WHEN status <> 'Cancelled' THEN grand_total ELSE 0 END), 0.00) AS total_billed,
       COALESCE(SUM(CASE WHEN status <> 'Cancelled' THEN amount_paid ELSE 0 END), 0.00) AS total_collected,
       COALESCE(SUM(CASE WHEN status IN ('Sent', 'Partially Paid', 'Overdue') THEN remaining_balance ELSE 0 END), 0.00) AS total_outstanding,
       COALESCE(SUM(CASE WHEN status = 'Overdue' THEN remaining_balance ELSE 0 END), 0.00) AS overdue_balance
     FROM invoices
     WHERE user_id = ?`,
    [userId]
  );

  const row = rows[0] || {};
  return {
    totalInvoices: Number(row.total_invoices || 0),
    draftCount: Number(row.draft_count || 0),
    sentCount: Number(row.sent_count || 0),
    partiallyPaidCount: Number(row.partially_paid_count || 0),
    paidCount: Number(row.paid_count || 0),
    overdueCount: Number(row.overdue_count || 0),
    cancelledCount: Number(row.cancelled_count || 0),
    totalBilled: String(row.total_billed ?? '0.00'),
    totalCollected: String(row.total_collected ?? '0.00'),
    totalOutstanding: String(row.total_outstanding ?? '0.00'),
    overdueBalance: String(row.overdue_balance ?? '0.00'),
  };
}

/**
 * Count customers owned by the user.
 */
async function getCustomerCountByUser(userId) {
  const [rows] = await pool.execute(
    'SELECT COUNT(*) AS total_customers FROM customers WHERE user_id = ?',
    [userId]
  );
  return Number(rows[0]?.total_customers || 0);
}

/**
 * Aggregate payment count, total, and breakdown by payment_method.
 */
async function getPaymentSummaryByUser(userId) {
  const [summaryRows] = await pool.execute(
    `SELECT
       COUNT(*) AS total_payments,
       COALESCE(SUM(amount), 0.00) AS total_received
     FROM payments
     WHERE user_id = ?`,
    [userId]
  );

  const [methodRows] = await pool.execute(
    `SELECT
       payment_method,
       COUNT(*) AS payment_count,
       COALESCE(SUM(amount), 0.00) AS total_amount
     FROM payments
     WHERE user_id = ?
     GROUP BY payment_method
     ORDER BY total_amount DESC`,
    [userId]
  );

  const summary = summaryRows[0] || {};
  return {
    totalPayments: Number(summary.total_payments || 0),
    totalReceived: String(summary.total_received ?? '0.00'),
    byMethod: methodRows.map((r) => ({
      method: r.payment_method,
      count: Number(r.payment_count || 0),
      totalAmount: String(r.total_amount ?? '0.00'),
    })),
  };
}

/**
 * Fetch monthly invoiced (by issue_date) and collected (by payment_date)
 * starting from startDateStr ('YYYY-MM-DD').
 */
async function getMonthlySeriesRawByUser(userId, startDateStr) {
  const [invoicedRows] = await pool.execute(
    `SELECT
       DATE_FORMAT(issue_date, '%Y-%m') AS month_key,
       COALESCE(SUM(grand_total), 0.00) AS total_amount,
       COUNT(*) AS invoice_count
     FROM invoices
     WHERE user_id = ?
       AND status <> 'Cancelled'
       AND issue_date >= ?
     GROUP BY DATE_FORMAT(issue_date, '%Y-%m')
     ORDER BY month_key ASC`,
    [userId, startDateStr]
  );

  const [collectedRows] = await pool.execute(
    `SELECT
       DATE_FORMAT(payment_date, '%Y-%m') AS month_key,
       COALESCE(SUM(amount), 0.00) AS total_amount,
       COUNT(*) AS payment_count
     FROM payments
     WHERE user_id = ?
       AND payment_date >= ?
     GROUP BY DATE_FORMAT(payment_date, '%Y-%m')
     ORDER BY month_key ASC`,
    [userId, startDateStr]
  );

  return { invoicedRows, collectedRows };
}

/**
 * Top customers ranked by total billed amount (excluding Cancelled invoices).
 */
async function getTopCustomersByUser(userId, limit = 5) {
  const safeLimit = Math.min(Math.max(Number(limit) || 5, 1), 25);
  const [rows] = await pool.execute(
    `SELECT
       c.id,
       c.name,
       c.company_name,
       c.email,
       COUNT(CASE WHEN i.status <> 'Cancelled' THEN i.id END) AS invoice_count,
       COALESCE(SUM(CASE WHEN i.status <> 'Cancelled' THEN i.grand_total ELSE 0 END), 0.00) AS total_billed,
       COALESCE(SUM(CASE WHEN i.status <> 'Cancelled' THEN i.amount_paid ELSE 0 END), 0.00) AS total_collected,
       COALESCE(SUM(CASE WHEN i.status IN ('Sent', 'Partially Paid', 'Overdue') THEN i.remaining_balance ELSE 0 END), 0.00) AS outstanding_balance
     FROM customers c
     LEFT JOIN invoices i ON i.customer_id = c.id AND i.user_id = c.user_id
     WHERE c.user_id = ?
     GROUP BY c.id, c.name, c.company_name, c.email
     HAVING invoice_count > 0
     ORDER BY total_billed DESC, total_collected DESC
     LIMIT ${safeLimit}`,
    [userId]
  );

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    companyName: r.company_name || '',
    email: r.email || '',
    invoiceCount: Number(r.invoice_count || 0),
    totalBilled: String(r.total_billed ?? '0.00'),
    totalCollected: String(r.total_collected ?? '0.00'),
    outstandingBalance: String(r.outstanding_balance ?? '0.00'),
  }));
}

/**
 * Overdue invoices with days overdue computed against CURDATE().
 */
async function getOverdueInvoicesByUser(userId, limit = 10) {
  const safeLimit = Math.min(Math.max(Number(limit) || 10, 1), 50);
  const [rows] = await pool.execute(
    `SELECT
       i.id,
       i.invoice_number,
       i.due_date,
       i.grand_total,
       i.remaining_balance,
       DATEDIFF(CURDATE(), i.due_date) AS days_overdue,
       c.id AS customer_id,
       c.name AS customer_name,
       c.company_name AS customer_company
     FROM invoices i
     INNER JOIN customers c ON c.id = i.customer_id
     WHERE i.user_id = ?
       AND i.status = 'Overdue'
     ORDER BY i.due_date ASC, i.remaining_balance DESC
     LIMIT ${safeLimit}`,
    [userId]
  );

  return rows.map((r) => ({
    id: r.id,
    invoiceNumber: r.invoice_number,
    dueDate: r.due_date,
    grandTotal: String(r.grand_total ?? '0.00'),
    remainingBalance: String(r.remaining_balance ?? '0.00'),
    daysOverdue: Math.max(Number(r.days_overdue || 0), 0),
    customerId: r.customer_id,
    customerName: r.customer_name,
    customerCompany: r.customer_company || '',
  }));
}

/**
 * Aggregate automation execution outcomes and email delivery outcomes.
 */
async function getAutomationAndEmailMetricsByUser(userId) {
  const [execRows] = await pool.execute(
    `SELECT
       COUNT(*) AS total_executions,
       SUM(CASE WHEN status = 'SUCCESS' THEN 1 ELSE 0 END) AS success_count,
       SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) AS failed_count,
       SUM(CASE WHEN status = 'SKIPPED' THEN 1 ELSE 0 END) AS skipped_count
     FROM automation_executions
     WHERE user_id = ?`,
    [userId]
  );

  const [emailRows] = await pool.execute(
    `SELECT
       COUNT(*) AS total_emails,
       SUM(CASE WHEN status = 'SENT' THEN 1 ELSE 0 END) AS sent_count,
       SUM(CASE WHEN status = 'SIMULATED' THEN 1 ELSE 0 END) AS simulated_count,
       SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) AS failed_count
     FROM email_logs
     WHERE user_id = ?`,
    [userId]
  );

  const [workflowRows] = await pool.execute(
    `SELECT
       COUNT(*) AS total_workflows,
       SUM(CASE WHEN is_enabled = 1 THEN 1 ELSE 0 END) AS enabled_workflows
     FROM automation_workflows
     WHERE user_id = ?`,
    [userId]
  );

  const ex = execRows[0] || {};
  const em = emailRows[0] || {};
  const wf = workflowRows[0] || {};

  return {
    workflows: {
      total: Number(wf.total_workflows || 0),
      enabled: Number(wf.enabled_workflows || 0),
    },
    executions: {
      total: Number(ex.total_executions || 0),
      success: Number(ex.success_count || 0),
      failed: Number(ex.failed_count || 0),
      skipped: Number(ex.skipped_count || 0),
    },
    emails: {
      total: Number(em.total_emails || 0),
      sent: Number(em.sent_count || 0),
      simulated: Number(em.simulated_count || 0),
      failed: Number(em.failed_count || 0),
    },
  };
}

/**
 * Fetch recent invoices and recent payments for Dashboard activity cards.
 */
async function getRecentActivityByUser(userId, limit = 5) {
  const safeLimit = Math.min(Math.max(Number(limit) || 5, 1), 20);

  const [recentInvoices] = await pool.execute(
    `SELECT
       i.id,
       i.invoice_number,
       i.issue_date,
       i.due_date,
       i.status,
       i.grand_total,
       i.remaining_balance,
       c.name AS customer_name
     FROM invoices i
     INNER JOIN customers c ON c.id = i.customer_id
     WHERE i.user_id = ?
     ORDER BY i.created_at DESC, i.id DESC
     LIMIT ${safeLimit}`,
    [userId]
  );

  const [recentPayments] = await pool.execute(
    `SELECT
       p.id,
       p.invoice_id,
       p.amount,
       p.payment_date,
       p.payment_method,
       i.invoice_number,
       c.name AS customer_name
     FROM payments p
     INNER JOIN invoices i ON i.id = p.invoice_id
     INNER JOIN customers c ON c.id = i.customer_id
     WHERE p.user_id = ?
     ORDER BY p.payment_date DESC, p.id DESC
     LIMIT ${safeLimit}`,
    [userId]
  );

  return {
    recentInvoices: recentInvoices.map((r) => ({
      id: r.id,
      invoiceNumber: r.invoice_number,
      issueDate: r.issue_date,
      dueDate: r.due_date,
      status: r.status,
      grandTotal: String(r.grand_total ?? '0.00'),
      remainingBalance: String(r.remaining_balance ?? '0.00'),
      customerName: r.customer_name,
    })),
    recentPayments: recentPayments.map((r) => ({
      id: r.id,
      invoiceId: r.invoice_id,
      amount: String(r.amount ?? '0.00'),
      paymentDate: r.payment_date,
      paymentMethod: r.payment_method,
      invoiceNumber: r.invoice_number,
      customerName: r.customer_name,
    })),
  };
}

/**
 * Fetch detailed row-level invoice tracker data for Excel and CSV exports.
 */
async function getInvoiceTrackerRowsByUser(userId) {
  const [rows] = await pool.execute(
    `SELECT
       i.id,
       i.invoice_number,
       i.issue_date,
       i.due_date,
       i.status AS invoice_status,
       i.subtotal,
       i.tax_amount,
       i.discount_amount,
       i.grand_total,
       i.amount_paid,
       i.remaining_balance,
       i.notes,
       DATEDIFF(CURDATE(), i.due_date) AS raw_days_overdue,
       c.name AS customer_name,
       c.email AS customer_email,
       c.company_name AS customer_company
     FROM invoices i
     INNER JOIN customers c ON c.id = i.customer_id
     WHERE i.user_id = ?
     ORDER BY i.issue_date DESC, i.id DESC`,
    [userId]
  );

  return rows.map((r) => {
    const totalAmount = Number(r.grand_total || 0);
    const amountPaid = Number(r.amount_paid || 0);
    const balanceDue = Number(r.remaining_balance || 0);
    const rawDays = Number(r.raw_days_overdue || 0);
    const isOverdue =
      rawDays > 0 && balanceDue > 0 && r.invoice_status !== 'Cancelled';
    const daysOverdue = isOverdue ? rawDays : 0;

    let paymentStatus = 'Unpaid';
    if (balanceDue <= 0 && totalAmount >= 0) {
      paymentStatus = 'Paid';
    } else if (amountPaid > 0 && balanceDue > 0) {
      paymentStatus = 'Partially Paid';
    }

    return {
      id: r.id,
      invoiceNumber: r.invoice_number,
      customerName: r.customer_name,
      customerEmail: r.customer_email || '',
      customerCompany: r.customer_company || '',
      issueDate: r.issue_date,
      dueDate: r.due_date,
      subtotal: Number(r.subtotal || 0),
      tax: Number(r.tax_amount || 0),
      discount: Number(r.discount_amount || 0),
      totalAmount,
      amountPaid,
      balanceDue,
      paymentStatus,
      invoiceStatus: r.invoice_status,
      daysOverdue,
      notes: r.notes || '',
    };
  });
}

/**
 * Fetch detailed row-level payment ledger transactions for Excel export.
 */
async function getPaymentLedgerRowsByUser(userId) {
  const [rows] = await pool.execute(
    `SELECT
       p.id,
       p.invoice_id,
       p.amount,
       p.payment_date,
       p.payment_method,
       p.reference_number,
       p.notes,
       i.invoice_number,
       i.remaining_balance AS current_remaining_balance,
       c.name AS customer_name
     FROM payments p
     INNER JOIN invoices i ON i.id = p.invoice_id
     INNER JOIN customers c ON c.id = i.customer_id
     WHERE p.user_id = ?
     ORDER BY p.payment_date DESC, p.id DESC`,
    [userId]
  );

  return rows.map((r) => ({
    id: r.id,
    invoiceId: r.invoice_id,
    invoiceNumber: r.invoice_number,
    customerName: r.customer_name,
    paymentDate: r.payment_date,
    paymentAmount: Number(r.amount || 0),
    paymentMethod: r.payment_method,
    referenceNumber: r.reference_number || '',
    remainingBalance: Number(r.current_remaining_balance || 0),
    notes: r.notes || '',
  }));
}

module.exports = {
  getInvoiceSummaryByUser,
  getCustomerCountByUser,
  getPaymentSummaryByUser,
  getMonthlySeriesRawByUser,
  getTopCustomersByUser,
  getOverdueInvoicesByUser,
  getAutomationAndEmailMetricsByUser,
  getRecentActivityByUser,
  getInvoiceTrackerRowsByUser,
  getPaymentLedgerRowsByUser,
};

