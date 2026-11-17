const invoiceModel = require('../models/invoice.model');
const customerModel = require('../models/customer.model');
const AppError = require('../utils/appError');
const { calculateInvoiceTotals, toCents } = require('../utils/money');
const { TRIGGERS } = require('../automation/constants');

function getAutomationEngine() {
  return require('../automation/engine');
}

const ALLOWED_MANUAL_TRANSITIONS = {
  Draft: ['Sent', 'Cancelled'],
  Sent: ['Cancelled'],
  'Partially Paid': ['Cancelled'],
  Overdue: ['Cancelled'],
  Paid: [],
  Cancelled: [],
};

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

function formatInvoiceSummary(row) {
  return {
    id: row.id,
    customerId: row.customer_id,
    customerName: row.customer_name,
    customerCompany: row.customer_company || '',
    customerEmail: row.customer_email || '',
    invoiceNumber: row.invoice_number,
    issueDate: formatDateOnly(row.issue_date),
    dueDate: formatDateOnly(row.due_date),
    status: row.status,
    subtotal: Number(row.subtotal),
    discountAmount: Number(row.discount_amount),
    taxRate: Number(row.tax_rate),
    taxAmount: Number(row.tax_amount),
    grandTotal: Number(row.grand_total),
    amountPaid: Number(row.amount_paid),
    remainingBalance: Number(row.remaining_balance),
    sentAt: row.sent_at,
    createdAt: row.created_at,
  };
}

function formatInvoiceDetail(row) {
  return {
    ...formatInvoiceSummary(row),
    paymentInstructions: row.payment_instructions || '',
    notes: row.notes || '',
    customer: {
      id: row.customer_id,
      name: row.customer_name,
      companyName: row.customer_company || '',
      email: row.customer_email || '',
      phone: row.customer_phone || '',
      billingAddress: row.customer_address || '',
    },
    business: {
      businessName: row.business_name,
      businessEmail: row.business_email || '',
      phone: row.business_phone || '',
      address: row.business_address || '',
      taxLabel: row.tax_label || 'Tax',
      currencySymbol: row.currency_symbol || 'Rs.',
      logoUrl: row.logo_url || '',
    },
    items: (row.items || []).map((item) => ({
      id: item.id,
      description: item.description,
      quantity: Number(item.quantity),
      unitPrice: Number(item.unit_price),
      lineTotal: Number(item.line_total),
      sortOrder: item.sort_order,
    })),
    payments: (row.payments || []).map((p) => ({
      id: p.id,
      amount: Number(p.amount),
      paymentDate: formatDateOnly(p.payment_date),
      paymentMethod: p.payment_method,
      referenceNumber: p.reference_number || '',
      notes: p.notes || '',
      createdAt: p.created_at,
    })),
  };
}

async function listInvoices(userId, query) {
  const rows = await invoiceModel.findAllByUser(userId, query);
  return rows.map(formatInvoiceSummary);
}

async function getInvoiceDetails(userId, invoiceId) {
  const row = await invoiceModel.findByIdAndUser(invoiceId, userId);
  if (!row) {
    throw new AppError('Invoice not found.', 404);
  }
  return formatInvoiceDetail(row);
}

function computeAuthoritativeTotals(payload) {
  try {
    return calculateInvoiceTotals({
      items: payload.items,
      discountAmount: payload.discountAmount ?? 0,
      taxRate: payload.taxRate ?? 0,
    });
  } catch (err) {
    throw new AppError(err.message, 400);
  }
}

async function createInvoice(userId, payload) {
  // Verify the selected customer belongs to this business account
  const customer = await customerModel.findByIdAndUser(payload.customerId, userId);
  if (!customer) {
    throw new AppError('Selected customer was not found in your account.', 404);
  }

  if (payload.dueDate < payload.issueDate) {
    throw new AppError('Due date cannot be earlier than the issue date.', 400);
  }

  const initialStatus = payload.status === 'Sent' ? 'Sent' : 'Draft';
  const sentAt = initialStatus === 'Sent' ? new Date() : null;
  const totals = computeAuthoritativeTotals(payload);

  const created = await invoiceModel.createWithItems(
    userId,
    {
      customerId: payload.customerId,
      issueDate: payload.issueDate,
      dueDate: payload.dueDate,
      status: initialStatus,
      subtotal: totals.subtotal,
      discountAmount: totals.discountAmount,
      taxRate: totals.taxRate,
      taxAmount: totals.taxAmount,
      grandTotal: totals.grandTotal,
      paymentInstructions: (payload.paymentInstructions || '').trim() || null,
      notes: (payload.notes || '').trim() || null,
      sentAt,
    },
    totals.items
  );

  const formatted = formatInvoiceDetail(created);

  await getAutomationEngine().emitTrigger(TRIGGERS.INVOICE_CREATED, {
    userId,
    invoiceId: formatted.id,
    invoice: formatted,
  });

  if (initialStatus === 'Sent') {
    await getAutomationEngine().emitTrigger(TRIGGERS.INVOICE_SENT, {
      userId,
      invoiceId: formatted.id,
      invoice: formatted,
    });
  }

  return formatted;
}

async function updateInvoice(userId, invoiceId, payload) {
  const existing = await invoiceModel.findByIdAndUser(invoiceId, userId);
  if (!existing) {
    throw new AppError('Invoice not found.', 404);
  }

  const amountPaidCents = toCents(existing.amount_paid);
  const canEdit =
    existing.status === 'Draft' ||
    (existing.status === 'Sent' && amountPaidCents === 0);

  if (!canEdit) {
    throw new AppError(
      `Cannot edit an invoice with status "${existing.status}" or recorded payments.`,
      409
    );
  }

  const customer = await customerModel.findByIdAndUser(payload.customerId, userId);
  if (!customer) {
    throw new AppError('Selected customer was not found in your account.', 404);
  }

  if (payload.dueDate < payload.issueDate) {
    throw new AppError('Due date cannot be earlier than the issue date.', 400);
  }

  const totals = computeAuthoritativeTotals(payload);

  const updated = await invoiceModel.updateWithItems(
    invoiceId,
    userId,
    {
      customerId: payload.customerId,
      issueDate: payload.issueDate,
      dueDate: payload.dueDate,
      subtotal: totals.subtotal,
      discountAmount: totals.discountAmount,
      taxRate: totals.taxRate,
      taxAmount: totals.taxAmount,
      grandTotal: totals.grandTotal,
      paymentInstructions: (payload.paymentInstructions || '').trim() || null,
      notes: (payload.notes || '').trim() || null,
    },
    totals.items
  );

  return formatInvoiceDetail(updated);
}

async function transitionInvoiceStatus(userId, invoiceId, targetStatus) {
  const existing = await invoiceModel.findByIdAndUser(invoiceId, userId);
  if (!existing) {
    throw new AppError('Invoice not found.', 404);
  }

  const allowed = ALLOWED_MANUAL_TRANSITIONS[existing.status] || [];
  if (!allowed.includes(targetStatus)) {
    throw new AppError(
      `Invalid status transition from "${existing.status}" to "${targetStatus}".`,
      409
    );
  }

  const sentAt = targetStatus === 'Sent' ? new Date() : null;
  const updated = await invoiceModel.updateStatusByIdAndUser(
    invoiceId,
    userId,
    targetStatus,
    sentAt
  );

  const formatted = formatInvoiceDetail(updated);

  if (targetStatus === 'Sent') {
    await getAutomationEngine().emitTrigger(TRIGGERS.INVOICE_SENT, {
      userId,
      invoiceId: formatted.id,
      invoice: formatted,
    });
  }

  return formatted;
}

async function deleteDraftInvoice(userId, invoiceId) {
  const existing = await invoiceModel.findByIdAndUser(invoiceId, userId);
  if (!existing) {
    throw new AppError('Invoice not found.', 404);
  }

  if (existing.status !== 'Draft') {
    throw new AppError(
      'Only Draft invoices can be deleted. Cancel issued invoices instead.',
      409
    );
  }

  await invoiceModel.deleteDraftByIdAndUser(invoiceId, userId);
}

module.exports = {
  listInvoices,
  getInvoiceDetails,
  createInvoice,
  updateInvoice,
  transitionInvoiceStatus,
  deleteDraftInvoice,
};

