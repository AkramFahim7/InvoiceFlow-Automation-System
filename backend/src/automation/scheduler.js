const cron = require('node-cron');
const env = require('../config/env');
const { pool } = require('../config/db');
const engine = require('./engine');
const { TRIGGERS, WORKFLOW_KEYS } = require('./constants');

let scheduledTask = null;
let isTickRunning = false;

/**
 * Find unpaid invoices whose due date falls within each business's configured
 * days_before_due window and that have not yet received that reminder stage.
 */
async function findApproachingDueCandidates({ userId = null, todayDate }) {
  const params = [WORKFLOW_KEYS.PAYMENT_REMINDER, WORKFLOW_KEYS.PAYMENT_REMINDER, todayDate, todayDate];
  let userFilter = '';

  if (userId) {
    userFilter = 'AND i.user_id = ?';
    params.push(userId);
  }

  const [rows] = await pool.query(
    `SELECT
       i.id AS invoice_id,
       i.user_id
     FROM invoices i
     INNER JOIN automation_workflows w
       ON w.user_id = i.user_id AND w.workflow_key = ?
     WHERE w.is_enabled = 1
       AND i.status IN ('Sent', 'Partially Paid')
       AND i.remaining_balance > 0
       AND NOT EXISTS (
         SELECT 1
         FROM reminder_records rr
         WHERE rr.invoice_id = i.id
           AND rr.workflow_key = ?
           AND rr.reminder_stage = CONCAT('BEFORE_DUE_', w.days_before_due, '_DAYS')
       )
       AND i.due_date >= ?
       AND DATEDIFF(i.due_date, ?) <= w.days_before_due
       ${userFilter}`,
    params
  );

  return rows;
}

/**
 * Find unpaid invoices whose due date has passed and have not yet received
 * the initial overdue notification.
 */
async function findOverdueCandidates({ userId = null, todayDate }) {
  const params = [WORKFLOW_KEYS.OVERDUE_NOTIFICATION, WORKFLOW_KEYS.OVERDUE_NOTIFICATION, todayDate];
  let userFilter = '';

  if (userId) {
    userFilter = 'AND i.user_id = ?';
    params.push(userId);
  }

  const [rows] = await pool.query(
    `SELECT
       i.id AS invoice_id,
       i.user_id
     FROM invoices i
     INNER JOIN automation_workflows w
       ON w.user_id = i.user_id AND w.workflow_key = ?
     WHERE w.is_enabled = 1
       AND i.status IN ('Sent', 'Partially Paid', 'Overdue')
       AND i.remaining_balance > 0
       AND NOT EXISTS (
         SELECT 1
         FROM reminder_records rr
         WHERE rr.invoice_id = i.id
           AND rr.workflow_key = ?
           AND rr.reminder_stage = 'OVERDUE_INITIAL'
       )
       AND i.due_date < ?
       ${userFilter}`,
    params
  );

  return rows;
}

/**
 * Execute one scheduled scan across approaching-due and overdue invoices.
 * Safe to invoke periodically via node-cron or manually for a single user.
 */
async function runScheduledInvoiceChecks({
  userId = null,
  todayDate = engine.getTodayDateString(),
} = {}) {
  if (isTickRunning) {
    return {
      skippedOverlap: true,
      remindersProcessed: 0,
      overdueProcessed: 0,
      executions: [],
    };
  }

  isTickRunning = true;
  const executions = [];

  try {
    const reminderCandidates = await findApproachingDueCandidates({
      userId,
      todayDate,
    });

    for (const candidate of reminderCandidates) {
      const logs = await engine.emitTrigger(TRIGGERS.DUE_DATE_APPROACHING, {
        userId: candidate.user_id,
        invoiceId: candidate.invoice_id,
        todayDate,
      });
      executions.push(...logs);
    }

    const overdueCandidates = await findOverdueCandidates({
      userId,
      todayDate,
    });

    for (const candidate of overdueCandidates) {
      const logs = await engine.emitTrigger(TRIGGERS.INVOICE_OVERDUE, {
        userId: candidate.user_id,
        invoiceId: candidate.invoice_id,
        todayDate,
      });
      executions.push(...logs);
    }

    return {
      skippedOverlap: false,
      checkedAt: new Date().toISOString(),
      remindersProcessed: reminderCandidates.length,
      overdueProcessed: overdueCandidates.length,
      executions,
    };
  } finally {
    isTickRunning = false;
  }
}

function startScheduler() {
  if (!env.cron.enabled) {
    console.log('[Scheduler] Disabled via ENABLE_SCHEDULER=false.');
    return null;
  }

  if (!cron.validate(env.cron.schedule)) {
    console.error(
      `[Scheduler] Invalid CRON_SCHEDULE "${env.cron.schedule}". Scheduler not started.`
    );
    return null;
  }

  scheduledTask = cron.schedule(env.cron.schedule, async () => {
    try {
      const summary = await runScheduledInvoiceChecks();
      if (
        !summary.skippedOverlap &&
        (summary.remindersProcessed > 0 || summary.overdueProcessed > 0)
      ) {
        console.log(
          `[Scheduler] Checked at ${summary.checkedAt}: ${summary.remindersProcessed} reminder(s), ${summary.overdueProcessed} overdue invoice(s).`
        );
      }
    } catch (error) {
      console.error('[Scheduler] Scheduled job error:', error.message);
    }
  });

  console.log(
    `[Scheduler] Background job active (cron: "${env.cron.schedule}").`
  );
  return scheduledTask;
}

function stopScheduler() {
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
  }
}

module.exports = {
  runScheduledInvoiceChecks,
  startScheduler,
  stopScheduler,
};

