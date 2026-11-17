const test = require('node:test');
const assert = require('node:assert/strict');
const {
  checkWorkflowEnabled,
  checkInvoiceUnpaid,
  checkDueDateWithinDays,
  checkDueDatePassed,
  checkCustomerEmailExists,
  checkNotAlreadyExecuted,
  evaluateConditionPipeline,
} = require('../src/automation/conditions');

test('disabled workflow returns SKIPPED outcome', () => {
  const res = evaluateConditionPipeline([
    checkWorkflowEnabled({ is_enabled: 0 }),
  ]);
  assert.equal(res.eligible, false);
  assert.equal(res.outcome, 'SKIPPED');
});

test('paid or cancelled invoices are excluded from reminders', () => {
  assert.equal(
    checkInvoiceUnpaid({ status: 'Paid', remainingBalance: 0 }).passed,
    false
  );
  assert.equal(
    checkInvoiceUnpaid({ status: 'Cancelled', remainingBalance: 500 }).passed,
    false
  );
  assert.equal(
    checkInvoiceUnpaid({ status: 'Sent', remainingBalance: 500 }).passed,
    true
  );
});

test('due date approaching condition passes only within configured day window', () => {
  const invoice = {
    status: 'Sent',
    remainingBalance: 2500,
    dueDate: '2026-11-15',
  };

  assert.equal(checkDueDateWithinDays(invoice, 3, '2026-11-12').passed, true);
  assert.equal(checkDueDateWithinDays(invoice, 2, '2026-11-12').passed, false);
  assert.equal(checkDueDateWithinDays(invoice, 3, '2026-11-16').passed, false);
});

test('overdue condition passes only after due date for unpaid invoice', () => {
  const unpaid = {
    status: 'Sent',
    remainingBalance: 1000,
    dueDate: '2026-11-10',
  };
  assert.equal(checkDueDatePassed(unpaid, '2026-11-12').passed, true);
  assert.equal(checkDueDatePassed(unpaid, '2026-11-10').passed, false);
});

test('missing customer email fails pipeline with FAILED outcome', () => {
  const res = evaluateConditionPipeline([
    checkCustomerEmailExists({ customer: { email: '' } }),
  ]);
  assert.equal(res.eligible, false);
  assert.equal(res.outcome, 'FAILED');
});

test('duplicate reminder check returns silent SKIPPED', () => {
  const res = evaluateConditionPipeline([checkNotAlreadyExecuted(true)]);
  assert.equal(res.eligible, false);
  assert.equal(res.outcome, 'SKIPPED');
  assert.equal(res.silent, true);
});

