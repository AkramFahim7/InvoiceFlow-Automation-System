const invoiceService = require('../services/invoice.service');
const pdfService = require('../services/pdf.service');
const AppError = require('../utils/appError');

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const ALLOWED_STATUSES = new Set([
  'all',
  'Draft',
  'Sent',
  'Partially Paid',
  'Paid',
  'Overdue',
  'Cancelled',
]);

function parsePositiveId(rawId, label = 'invoice ID') {
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) {
    throw new AppError(`Invalid ${label}.`, 400);
  }
  return id;
}

function validateInvoiceBody(body) {
  const { customerId, issueDate, dueDate, items } = body;

  parsePositiveId(customerId, 'customer ID');

  if (!issueDate || !DATE_REGEX.test(issueDate)) {
    throw new AppError('Valid issue date (YYYY-MM-DD) is required.', 400);
  }
  if (!dueDate || !DATE_REGEX.test(dueDate)) {
    throw new AppError('Valid due date (YYYY-MM-DD) is required.', 400);
  }
  if (!Array.isArray(items) || items.length === 0) {
    throw new AppError('At least one line item is required.', 400);
  }

  for (let i = 0; i < items.length; i += 1) {
    const item = items[i];
    if (!item || !item.description || !item.description.trim()) {
      throw new AppError(`Item #${i + 1}: description is required.`, 400);
    }
    const qty = Number(item.quantity);
    if (Number.isNaN(qty) || qty <= 0) {
      throw new AppError(`Item #${i + 1}: quantity must be greater than 0.`, 400);
    }
    const price = Number(item.unitPrice);
    if (Number.isNaN(price) || price < 0) {
      throw new AppError(
        `Item #${i + 1}: unit price must be 0 or greater.`,
        400
      );
    }
  }
}

async function list(req, res, next) {
  try {
    const search = typeof req.query.search === 'string' ? req.query.search : '';
    const status = ALLOWED_STATUSES.has(req.query.status)
      ? req.query.status
      : 'all';
    const customerId = req.query.customerId
      ? parsePositiveId(req.query.customerId, 'customer ID')
      : null;

    const invoices = await invoiceService.listInvoices(req.user.id, {
      search,
      status,
      customerId,
    });

    res.status(200).json({
      status: 'ok',
      data: invoices,
    });
  } catch (error) {
    next(error);
  }
}

async function getOne(req, res, next) {
  try {
    const invoiceId = parsePositiveId(req.params.id);
    const invoice = await invoiceService.getInvoiceDetails(req.user.id, invoiceId);
    res.status(200).json({
      status: 'ok',
      data: invoice,
    });
  } catch (error) {
    next(error);
  }
}

async function create(req, res, next) {
  try {
    validateInvoiceBody(req.body);
    const invoice = await invoiceService.createInvoice(req.user.id, {
      ...req.body,
      customerId: Number(req.body.customerId),
    });

    res.status(201).json({
      status: 'ok',
      message: 'Invoice created successfully.',
      data: invoice,
    });
  } catch (error) {
    next(error);
  }
}

async function update(req, res, next) {
  try {
    const invoiceId = parsePositiveId(req.params.id);
    validateInvoiceBody(req.body);
    const invoice = await invoiceService.updateInvoice(req.user.id, invoiceId, {
      ...req.body,
      customerId: Number(req.body.customerId),
    });

    res.status(200).json({
      status: 'ok',
      message: 'Invoice updated successfully.',
      data: invoice,
    });
  } catch (error) {
    next(error);
  }
}

async function updateStatus(req, res, next) {
  try {
    const invoiceId = parsePositiveId(req.params.id);
    const { status } = req.body;
    if (!status) {
      throw new AppError('Target status is required.', 400);
    }

    const invoice = await invoiceService.transitionInvoiceStatus(
      req.user.id,
      invoiceId,
      status
    );

    res.status(200).json({
      status: 'ok',
      message: `Invoice marked as ${invoice.status}.`,
      data: invoice,
    });
  } catch (error) {
    next(error);
  }
}

async function remove(req, res, next) {
  try {
    const invoiceId = parsePositiveId(req.params.id);
    await invoiceService.deleteDraftInvoice(req.user.id, invoiceId);

    res.status(200).json({
      status: 'ok',
      message: 'Draft invoice deleted successfully.',
    });
  } catch (error) {
    next(error);
  }
}

async function downloadPdf(req, res, next) {
  try {
    const invoiceId = parsePositiveId(req.params.id);
    const invoice = await invoiceService.getInvoiceDetails(req.user.id, invoiceId);
    const pdfBuffer = await pdfService.generateInvoicePdfBuffer(invoice);

    const disposition = req.query.mode === 'inline' ? 'inline' : 'attachment';
    const safeFileName = `${invoice.invoiceNumber.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `${disposition}; filename="${safeFileName}"`
    );
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  list,
  getOne,
  create,
  update,
  updateStatus,
  remove,
  downloadPdf,
};

