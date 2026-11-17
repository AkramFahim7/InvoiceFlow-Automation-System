/**
 * Pure, composable condition evaluators for the InvoiceFlow Automation Engine.
 * Each evaluator returns { passed: boolean, reason: string | null, outcome?: 'SKIPPED' | 'FAILED' }.
 */

function checkWorkflowEnabled(workflow) {
  if (!workflow || !workflow.is_enabled) {
    return {
      passed: false,
      outcome: 'SKIPPED',
      reason: 'Workflow is disabled by business settings.',
    };
  }
  return { passed: true, reason: null };
}

function checkInvoiceUnpaid(invoice) {
  if (!invoice) {
    return { passed: false, outcome: 'FAILED', reason: 'Invoice not found.' };
  }
  if (['Paid', 'Cancelled', 'Draft'].includes(invoice.status)) {
    return {
      passed: false,
      outcome: 'SKIPPED',
      reason: `Invoice status "${invoice.status}" is excluded from reminders.`,
    };
  }
  if (Number(invoice.remainingBalance) <= 0) {
    return {
      passed: false,
      outcome: 'SKIPPED',
      reason: 'Invoice has no remaining balance.',
    };
  }
  return { passed: true, reason: null };
}

function checkInvoiceIsOverdueStatus(invoice) {
  if (!invoice || invoice.status !== 'Overdue') {
    return {
      passed: false,
      outcome: 'SKIPPED',
      reason: `Invoice status is "${invoice?.status || 'unknown'}", not Overdue.`,
    };
  }
  return { passed: true, reason: null };
}

function checkDueDateWithinDays(invoice, daysBeforeDue, todayDateStr) {
  const unpaidCheck = checkInvoiceUnpaid(invoice);
  if (!unpaidCheck.passed) return unpaidCheck;

  const due = new Date(`${invoice.dueDate}T00:00:00Z`);
  const today = new Date(`${todayDateStr}T00:00:00Z`);
  const diffDays = Math.round((due - today) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return {
      passed: false,
      outcome: 'SKIPPED',
      reason: 'Invoice due date has already passed.',
    };
  }
  if (diffDays > Number(daysBeforeDue)) {
    return {
      passed: false,
      outcome: 'SKIPPED',
      reason: `Due date is ${diffDays} days away (threshold: ${daysBeforeDue} days).`,
    };
  }
  return { passed: true, reason: null };
}

function checkDueDatePassed(invoice, todayDateStr) {
  const unpaidCheck = checkInvoiceUnpaid(invoice);
  if (!unpaidCheck.passed) return unpaidCheck;

  if (invoice.dueDate >= todayDateStr) {
    return {
      passed: false,
      outcome: 'SKIPPED',
      reason: 'Invoice due date has not passed yet.',
    };
  }
  return { passed: true, reason: null };
}

function checkCustomerEmailExists(invoice) {
  const email = invoice?.customer?.email || invoice?.customerEmail || '';
  if (!email.trim()) {
    return {
      passed: false,
      outcome: 'FAILED',
      reason: 'Customer does not have an email address.',
    };
  }
  return { passed: true, reason: null };
}

function checkNotAlreadyExecuted(alreadyRecorded) {
  if (alreadyRecorded) {
    return {
      passed: false,
      outcome: 'SKIPPED',
      silent: true,
      reason: 'Reminder already recorded for this invoice stage.',
    };
  }
  return { passed: true, reason: null };
}

function evaluateConditionPipeline(checks) {
  for (const check of checks) {
    if (!check.passed) {
      return {
        eligible: false,
        outcome: check.outcome || 'SKIPPED',
        silent: Boolean(check.silent),
        failedReason: check.reason,
      };
    }
  }
  return { eligible: true, outcome: null, silent: false, failedReason: null };
}

module.exports = {
  checkWorkflowEnabled,
  checkInvoiceUnpaid,
  checkInvoiceIsOverdueStatus,
  checkDueDateWithinDays,
  checkDueDatePassed,
  checkCustomerEmailExists,
  checkNotAlreadyExecuted,
  evaluateConditionPipeline,
};

