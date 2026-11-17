const paymentModel = require('../models/payment.model');
const invoiceService = require('../services/invoice.service');
const automationEngine = require('../automation/engine');
const { TRIGGERS } = require('../automation/constants');

function formatDateOnly(value) {
  if (!value) return null;
  if (value instanceof Date) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  return String(value).slice(0, 10);
}

function formatPaymentRow(row) {
  return {
    id: row.id,
    invoiceId: row.invoice_id,
    invoiceNumber: row.invoice_number,
    invoiceStatus: row.invoice_status,
    invoiceGrandTotal: Number(row.invoice_grand_total),
    invoiceRemainingBalance: Number(row.invoice_remaining_balance),
    customerId: row.customer_id,
    customerName: row.customer_name,
    customerCompany: row.customer_company || '',
    amount: Number(row.amount),
    paymentDate: formatDateOnly(row.payment_date),
    paymentMethod: row.payment_method,
    referenceNumber: row.reference_number || '',
    notes: row.notes || '',
    createdAt: row.created_at,
  };
}

async function listPayments(userId, query) {
  const rows = await paymentModel.findAllByUser(userId, query);
  return rows.map(formatPaymentRow);
}

async function recordPayment(userId, payload) {
  const result = await paymentModel.recordPaymentTransaction(userId, {
    invoiceId: Number(payload.invoiceId),
    amount: payload.amount,
    paymentDate: payload.paymentDate,
    paymentMethod: payload.paymentMethod || 'Bank Transfer',
    referenceNumber: (payload.referenceNumber || '').trim() || null,
    notes: (payload.notes || '').trim() || null,
  });

  const updatedInvoice = await invoiceService.getInvoiceDetails(
    userId,
    result.invoiceId
  );

  const createdPayment =
    updatedInvoice.payments.find((p) => p.id === result.paymentId) || null;

  await automationEngine.emitTrigger(TRIGGERS.PAYMENT_RECEIVED, {
    userId,
    invoiceId: updatedInvoice.id,
    paymentId: result.paymentId,
    invoice: updatedInvoice,
  });

  if (updatedInvoice.status === 'Paid') {
    await automationEngine.emitTrigger(TRIGGERS.INVOICE_FULLY_PAID, {
      userId,
      invoiceId: updatedInvoice.id,
      paymentId: result.paymentId,
      invoice: updatedInvoice,
    });
  }

  return {
    payment: createdPayment,
    invoice: updatedInvoice,
  };
}

module.exports = {
  listPayments,
  recordPayment,
};

