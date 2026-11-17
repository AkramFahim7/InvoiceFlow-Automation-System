const nodemailer = require('nodemailer');
const env = require('../config/env');
const emailLogModel = require('../models/emailLog.model');
const invoiceService = require('./invoice.service');
const paymentModel = require('../models/payment.model');
const pdfService = require('./pdf.service');
const templates = require('./emailTemplates.service');
const AppError = require('../utils/appError');

function createSmtpTransporter() {
  return nodemailer.createTransport({
    host: env.smtp.host,
    port: env.smtp.port,
    secure: env.smtp.secure,
    auth: {
      user: env.smtp.user,
      pass: env.smtp.pass,
    },
  });
}

/**
 * Core email dispatcher with automatic Simulation Mode fallback and DB logging.
 * Never pretends simulated emails were delivered via SMTP.
 */
async function dispatchEmail({
  userId,
  invoiceId = null,
  to,
  subject,
  text,
  html,
  templateName,
  attachments = [],
}) {
  const recipient = (to || '').trim();

  if (!recipient) {
    const errMsg = 'Customer does not have an email address.';
    const log = await emailLogModel.createLog({
      userId,
      invoiceId,
      recipientEmail: '(missing)',
      subject,
      templateName,
      deliveryMode: env.smtp.isConfigured ? 'SMTP' : 'SIMULATED',
      status: 'FAILED',
      errorMessage: errMsg,
    });
    return {
      ok: false,
      simulated: !env.smtp.isConfigured,
      status: 'FAILED',
      errorMessage: errMsg,
      log,
    };
  }

  // Safe development mode when SMTP credentials are not configured
  if (!env.smtp.isConfigured) {
    console.log(
      `[Email SIMULATED] To: ${recipient} | Template: ${templateName} | Subject: "${subject}" | Attachments: ${attachments.length}`
    );
    const log = await emailLogModel.createLog({
      userId,
      invoiceId,
      recipientEmail: recipient,
      subject,
      templateName,
      deliveryMode: 'SIMULATED',
      status: 'SIMULATED',
    });
    return {
      ok: true,
      simulated: true,
      status: 'SIMULATED',
      log,
    };
  }

  // Real SMTP delivery via Nodemailer
  try {
    const transporter = createSmtpTransporter();
    await transporter.sendMail({
      from: env.smtp.from,
      to: recipient,
      subject,
      text,
      html,
      attachments,
    });

    const log = await emailLogModel.createLog({
      userId,
      invoiceId,
      recipientEmail: recipient,
      subject,
      templateName,
      deliveryMode: 'SMTP',
      status: 'SENT',
    });

    return {
      ok: true,
      simulated: false,
      status: 'SENT',
      log,
    };
  } catch (error) {
    const log = await emailLogModel.createLog({
      userId,
      invoiceId,
      recipientEmail: recipient,
      subject,
      templateName,
      deliveryMode: 'SMTP',
      status: 'FAILED',
      errorMessage: error.message,
    });
    return {
      ok: false,
      simulated: false,
      status: 'FAILED',
      errorMessage: error.message,
      log,
    };
  }
}

async function sendInvoiceEmail(userId, invoiceId) {
  const invoice = await invoiceService.getInvoiceDetails(userId, invoiceId);
  const emailContent = templates.buildNewInvoiceEmail(invoice);
  const pdfBuffer = await pdfService.generateInvoicePdfBuffer(invoice);

  return await dispatchEmail({
    userId,
    invoiceId: invoice.id,
    to: invoice.customer?.email,
    subject: emailContent.subject,
    text: emailContent.text,
    html: emailContent.html,
    templateName: emailContent.templateName,
    attachments: [
      {
        filename: `${invoice.invoiceNumber}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf',
      },
    ],
  });
}

async function sendPaymentReminderEmail(userId, invoiceId) {
  const invoice = await invoiceService.getInvoiceDetails(userId, invoiceId);
  const emailContent = templates.buildPaymentReminderEmail(invoice);

  return await dispatchEmail({
    userId,
    invoiceId: invoice.id,
    to: invoice.customer?.email,
    subject: emailContent.subject,
    text: emailContent.text,
    html: emailContent.html,
    templateName: emailContent.templateName,
  });
}

async function sendOverdueNoticeEmail(userId, invoiceId) {
  const invoice = await invoiceService.getInvoiceDetails(userId, invoiceId);
  const emailContent = templates.buildOverdueNoticeEmail(invoice);

  return await dispatchEmail({
    userId,
    invoiceId: invoice.id,
    to: invoice.customer?.email,
    subject: emailContent.subject,
    text: emailContent.text,
    html: emailContent.html,
    templateName: emailContent.templateName,
  });
}

async function sendPaymentConfirmationEmail(userId, paymentId) {
  const paymentRow = await paymentModel.findByIdAndUser(paymentId, userId);
  if (!paymentRow) {
    throw new AppError('Payment record not found.', 404);
  }

  const invoice = await invoiceService.getInvoiceDetails(
    userId,
    paymentRow.invoice_id
  );
  const formattedPayment = {
    id: paymentRow.id,
    amount: Number(paymentRow.amount),
    paymentDate: String(paymentRow.payment_date).slice(0, 10),
    paymentMethod: paymentRow.payment_method,
  };

  const emailContent = templates.buildPaymentConfirmationEmail(
    invoice,
    formattedPayment
  );

  return await dispatchEmail({
    userId,
    invoiceId: invoice.id,
    to: invoice.customer?.email,
    subject: emailContent.subject,
    text: emailContent.text,
    html: emailContent.html,
    templateName: emailContent.templateName,
  });
}

async function listEmailLogs(userId, query = {}) {
  const rows = await emailLogModel.findAllByUser(userId, query);
  return {
    smtpConfigured: env.smtp.isConfigured,
    logs: rows.map((row) => ({
      id: row.id,
      invoiceId: row.invoice_id,
      invoiceNumber: row.invoice_number || '',
      recipientEmail: row.recipient_email,
      subject: row.subject,
      templateName: row.template_name,
      deliveryMode: row.delivery_mode,
      status: row.status,
      errorMessage: row.error_message || '',
      sentAt: row.sent_at,
    })),
  };
}

module.exports = {
  dispatchEmail,
  sendInvoiceEmail,
  sendPaymentReminderEmail,
  sendOverdueNoticeEmail,
  sendPaymentConfirmationEmail,
  listEmailLogs,
};

