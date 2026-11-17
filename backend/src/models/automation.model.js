const { pool } = require('../config/db');

async function findWorkflowsByUser(userId) {
  const [rows] = await pool.query(
    `SELECT
       w.*,
       COUNT(e.id) AS total_executions,
       SUM(CASE WHEN e.status = 'SUCCESS' THEN 1 ELSE 0 END) AS success_count,
       SUM(CASE WHEN e.status = 'FAILED' THEN 1 ELSE 0 END) AS failed_count
     FROM automation_workflows w
     LEFT JOIN automation_executions e ON e.workflow_id = w.id
     WHERE w.user_id = ?
     GROUP BY w.id
     ORDER BY w.id ASC`,
    [userId]
  );
  return rows;
}

async function findWorkflowByIdAndUser(workflowId, userId) {
  const [rows] = await pool.query(
    `SELECT *
     FROM automation_workflows
     WHERE id = ? AND user_id = ?
     LIMIT 1`,
    [workflowId, userId]
  );
  return rows[0] || null;
}

async function updateWorkflowByIdAndUser(
  workflowId,
  userId,
  { isEnabled, daysBeforeDue }
) {
  await pool.query(
    `UPDATE automation_workflows
     SET is_enabled = ?, days_before_due = ?
     WHERE id = ? AND user_id = ?`,
    [isEnabled ? 1 : 0, daysBeforeDue, workflowId, userId]
  );
  return await findWorkflowByIdAndUser(workflowId, userId);
}

async function findWorkflowByKey(userId, workflowKey) {
  const [rows] = await pool.query(
    `SELECT *
     FROM automation_workflows
     WHERE user_id = ? AND workflow_key = ?
     LIMIT 1`,
    [userId, workflowKey]
  );
  return rows[0] || null;
}

async function hasReminderRecord(invoiceId, workflowKey, reminderStage) {
  const [rows] = await pool.query(
    `SELECT id
     FROM reminder_records
     WHERE invoice_id = ? AND workflow_key = ? AND reminder_stage = ?
     LIMIT 1`,
    [invoiceId, workflowKey, reminderStage]
  );
  return rows.length > 0;
}

/**
 * Insert an idempotency record into reminder_records.
 * Returns false if a concurrent worker already inserted the same unique tuple.
 */
async function insertReminderRecord({
  userId,
  invoiceId,
  workflowKey,
  reminderStage,
}) {
  try {
    await pool.query(
      `INSERT INTO reminder_records
         (user_id, invoice_id, workflow_key, reminder_stage)
       VALUES (?, ?, ?, ?)`,
      [userId, invoiceId, workflowKey, reminderStage]
    );
    return true;
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return false;
    }
    throw err;
  }
}

async function createExecutionLog({
  userId,
  workflowId,
  invoiceId = null,
  paymentId = null,
  triggerEvent,
  status,
  message = null,
  errorMessage = null,
}) {
  const [result] = await pool.query(
    `INSERT INTO automation_executions
       (user_id, workflow_id, invoice_id, payment_id, trigger_event, status, message, error_message)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      userId,
      workflowId,
      invoiceId,
      paymentId,
      triggerEvent,
      status,
      message,
      errorMessage,
    ]
  );
  const [rows] = await pool.query(
    `SELECT * FROM automation_executions WHERE id = ? LIMIT 1`,
    [result.insertId]
  );
  return rows[0];
}

async function findExecutionsByUser(
  userId,
  { status = 'all', workflowId = null, limit = 50 } = {}
) {
  const conditions = ['e.user_id = ?'];
  const params = [userId];

  if (status && status !== 'all') {
    conditions.push('e.status = ?');
    params.push(status);
  }

  if (workflowId) {
    conditions.push('e.workflow_id = ?');
    params.push(workflowId);
  }

  params.push(Number(limit) || 50);

  const [rows] = await pool.query(
    `SELECT
       e.id,
       e.workflow_id,
       e.invoice_id,
       e.payment_id,
       e.trigger_event,
       e.status,
       e.message,
       e.error_message,
       e.executed_at,
       w.workflow_key,
       w.name AS workflow_name,
       i.invoice_number,
       c.name AS customer_name
     FROM automation_executions e
     INNER JOIN automation_workflows w ON w.id = e.workflow_id
     LEFT JOIN invoices i ON i.id = e.invoice_id
     LEFT JOIN customers c ON c.id = i.customer_id
     WHERE ${conditions.join(' AND ')}
     ORDER BY e.executed_at DESC, e.id DESC
     LIMIT ?`,
    params
  );

  return rows;
}

async function findExecutionByIdAndUser(executionId, userId) {
  const [rows] = await pool.query(
    `SELECT
       e.*,
       w.workflow_key,
       w.name AS workflow_name,
       w.is_enabled AS workflow_enabled,
       w.days_before_due
     FROM automation_executions e
     INNER JOIN automation_workflows w ON w.id = e.workflow_id
     WHERE e.id = ? AND e.user_id = ?
     LIMIT 1`,
    [executionId, userId]
  );
  return rows[0] || null;
}

async function markExecutionResolved(executionId, userId, resolvedNote) {
  await pool.query(
    `UPDATE automation_executions
     SET message = ?
     WHERE id = ? AND user_id = ?`,
    [resolvedNote, executionId, userId]
  );
}

async function getAutomationStatsByUser(userId) {
  const [wfRows] = await pool.query(
    `SELECT
       COUNT(*) AS total_workflows,
       COALESCE(SUM(CASE WHEN is_enabled = 1 THEN 1 ELSE 0 END), 0) AS active_workflows,
       COALESCE(SUM(CASE WHEN is_enabled = 0 THEN 1 ELSE 0 END), 0) AS disabled_workflows
     FROM automation_workflows
     WHERE user_id = ?`,
    [userId]
  );

  const [execRows] = await pool.query(
    `SELECT
       COALESCE(SUM(CASE WHEN status = 'SUCCESS' THEN 1 ELSE 0 END), 0) AS successful_executions,
       COALESCE(SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END), 0) AS failed_executions,
       COALESCE(SUM(CASE WHEN status = 'SKIPPED' THEN 1 ELSE 0 END), 0) AS skipped_executions
     FROM automation_executions
     WHERE user_id = ?`,
    [userId]
  );

  return {
    totalWorkflows: Number(wfRows[0].total_workflows),
    activeWorkflows: Number(wfRows[0].active_workflows),
    disabledWorkflows: Number(wfRows[0].disabled_workflows),
    successfulExecutions: Number(execRows[0].successful_executions),
    failedExecutions: Number(execRows[0].failed_executions),
    skippedExecutions: Number(execRows[0].skipped_executions),
  };
}

module.exports = {
  findWorkflowsByUser,
  findWorkflowByIdAndUser,
  updateWorkflowByIdAndUser,
  findWorkflowByKey,
  hasReminderRecord,
  insertReminderRecord,
  createExecutionLog,
  findExecutionsByUser,
  findExecutionByIdAndUser,
  markExecutionResolved,
  getAutomationStatsByUser,
};

