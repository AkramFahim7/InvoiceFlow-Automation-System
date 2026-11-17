const { pool } = require('../config/db');
const emailService = require('../services/email.service');
const automationModel = require('../models/automation.model');
const { WORKFLOW_KEYS } = require('./constants');

async function executeSendInvoiceEmail({ userId, invoice }) {
  const emailRes = await emailService.sendInvoiceEmail(userId, invoice.id);
  if (!emailRes.ok) {
    throw new Error(emailRes.errorMessage || 'Failed to send invoice email.');
  }

  const modeLabel = emailRes.simulated ? 'Simulated' : 'SMTP';
  return `${modeLabel} invoice email with PDF dispatched to ${emailRes.log.recipient_email}.`;
}

async function executePaymentReminder({ userId, invoice, reminderStage }) {
  const acquired = await automationModel.insertReminderRecord({
    userId,
    invoiceId: invoice.id,
    workflowKey: WORKFLOW_KEYS.PAYMENT_REMINDER,
    reminderStage,
  });

  if (!acquired) {
    return null;
  }

  const emailRes = await emailService.sendPaymentReminderEmail(
    userId,
    invoice.id
  );
  if (!emailRes.ok) {
    // Allow retry if delivery failed before sending
    await pool.query(
      `DELETE FROM reminder_records
       WHERE invoice_id = ? AND workflow_key = ? AND reminder_stage = ?`,
      [invoice.id, WORKFLOW_KEYS.PAYMENT_REMINDER, reminderStage]
    );
    throw new Error(emailRes.errorMessage || 'Failed to send payment reminder.');
  }

  const modeLabel = emailRes.simulated ? 'Simulated' : 'SMTP';
  return `${modeLabel} payment reminder sent to ${emailRes.log.recipient_email} (stage: ${reminderStage}).`;
}

async function executeOverdueNotification({ userId, invoice, reminderStage }) {
  // Always mark unpaid past-due invoices as Overdue
  if (invoice.status !== 'Overdue') {
    await pool.query(
      `UPDATE invoices
       SET status = 'Overdue'
       WHERE id = ? AND user_id = ? AND status IN ('Sent', 'Partially Paid')`,
      [invoice.id, userId]
    );
  }

  const acquired = await automationModel.insertReminderRecord({
    userId,
    invoiceId: invoice.id,
    workflowKey: WORKFLOW_KEYS.OVERDUE_NOTIFICATION,
    reminderStage,
  });

  if (!acquired) {
    return null;
  }

  const emailRes = await emailService.sendOverdueNoticeEmail(userId, invoice.id);
  if (!emailRes.ok) {
    await pool.query(
      `DELETE FROM reminder_records
       WHERE invoice_id = ? AND workflow_key = ? AND reminder_stage = ?`,
      [invoice.id, WORKFLOW_KEYS.OVERDUE_NOTIFICATION, reminderStage]
    );
    throw new Error(
      `Invoice marked Overdue, but email failed: ${emailRes.errorMessage}`
    );
  }

  const modeLabel = emailRes.simulated ? 'Simulated' : 'SMTP';
  return `Invoice marked Overdue and ${modeLabel.toLowerCase()} overdue notice sent to ${emailRes.log.recipient_email}.`;
}

async function executePaymentConfirmation({ userId, paymentId }) {
  const emailRes = await emailService.sendPaymentConfirmationEmail(
    userId,
    paymentId
  );
  if (!emailRes.ok) {
    throw new Error(
      emailRes.errorMessage || 'Failed to send payment confirmation email.'
    );
  }

  const modeLabel = emailRes.simulated ? 'Simulated' : 'SMTP';
  return `${modeLabel} payment confirmation sent to ${emailRes.log.recipient_email}.`;
}

module.exports = {
  executeSendInvoiceEmail,
  executePaymentReminder,
  executeOverdueNotification,
  executePaymentConfirmation,
};

