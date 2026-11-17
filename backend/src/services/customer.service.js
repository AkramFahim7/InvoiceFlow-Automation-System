const customerModel = require('../models/customer.model');
const AppError = require('../utils/appError');

function formatCustomer(row) {
  return {
    id: row.id,
    name: row.name,
    companyName: row.company_name || '',
    email: row.email || '',
    phone: row.phone || '',
    billingAddress: row.billing_address || '',
    notes: row.notes || '',
    invoiceCount: Number(row.invoice_count ?? 0),
    totalBilled: Number(row.total_billed ?? 0),
    outstandingBalance: Number(row.outstanding_balance ?? 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeCustomerPayload(payload) {
  return {
    name: payload.name.trim(),
    companyName: (payload.companyName || '').trim() || null,
    email: (payload.email || '').trim().toLowerCase() || null,
    phone: (payload.phone || '').trim() || null,
    billingAddress: (payload.billingAddress || '').trim() || null,
    notes: (payload.notes || '').trim() || null,
  };
}

async function listCustomers(userId, query) {
  const rows = await customerModel.findAllByUser(userId, query);
  return rows.map(formatCustomer);
}

async function getCustomerDetails(userId, customerId) {
  const customerRow = await customerModel.findByIdAndUser(customerId, userId);
  if (!customerRow) {
    throw new AppError('Customer not found.', 404);
  }

  const invoices = await customerModel.findInvoicesByCustomerAndUser(
    customerId,
    userId
  );

  return {
    customer: formatCustomer(customerRow),
    invoices: invoices.map((inv) => ({
      id: inv.id,
      invoiceNumber: inv.invoice_number,
      issueDate: inv.issue_date,
      dueDate: inv.due_date,
      status: inv.status,
      grandTotal: Number(inv.grand_total),
      amountPaid: Number(inv.amount_paid),
      remainingBalance: Number(inv.remaining_balance),
    })),
  };
}

async function createCustomer(userId, payload) {
  const data = normalizeCustomerPayload(payload);
  const created = await customerModel.create(userId, data);
  return formatCustomer(created);
}

async function updateCustomer(userId, customerId, payload) {
  const existing = await customerModel.findByIdAndUser(customerId, userId);
  if (!existing) {
    throw new AppError('Customer not found.', 404);
  }

  const data = normalizeCustomerPayload(payload);
  const updated = await customerModel.updateByIdAndUser(customerId, userId, data);
  return formatCustomer(updated);
}

async function deleteCustomer(userId, customerId) {
  const existing = await customerModel.findByIdAndUser(customerId, userId);
  if (!existing) {
    throw new AppError('Customer not found.', 404);
  }

  const invoiceCount = await customerModel.countInvoicesByCustomerAndUser(
    customerId,
    userId
  );
  if (invoiceCount > 0) {
    throw new AppError(
      'Cannot delete this customer because they have existing invoices.',
      409
    );
  }

  await customerModel.deleteByIdAndUser(customerId, userId);
}

module.exports = {
  listCustomers,
  getCustomerDetails,
  createCustomer,
  updateCustomer,
  deleteCustomer,
};

