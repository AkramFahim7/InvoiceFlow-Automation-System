const paymentService = require('../services/payment.service');
const AppError = require('../utils/appError');

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const ALLOWED_METHODS = new Set([
  'Bank Transfer',
  'Cash',
  'Card',
  'Cheque',
  'Online',
  'Other',
]);

async function list(req, res, next) {
  try {
    const search = typeof req.query.search === 'string' ? req.query.search : '';
    const method = ALLOWED_METHODS.has(req.query.method)
      ? req.query.method
      : 'all';

    const payments = await paymentService.listPayments(req.user.id, {
      search,
      method,
    });

    res.status(200).json({
      status: 'ok',
      data: payments,
    });
  } catch (error) {
    next(error);
  }
}

async function create(req, res, next) {
  try {
    const { invoiceId, amount, paymentDate, paymentMethod, referenceNumber } =
      req.body;

    const parsedInvoiceId = Number(invoiceId);
    if (!Number.isInteger(parsedInvoiceId) || parsedInvoiceId <= 0) {
      throw new AppError('Valid invoice ID is required.', 400);
    }

    const parsedAmount = Number(amount);
    if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      throw new AppError('Payment amount must be greater than 0.', 400);
    }

    if (!paymentDate || !DATE_REGEX.test(paymentDate)) {
      throw new AppError('Valid payment date (YYYY-MM-DD) is required.', 400);
    }

    if (paymentMethod && !ALLOWED_METHODS.has(paymentMethod)) {
      throw new AppError('Unsupported payment method selected.', 400);
    }

    if (referenceNumber && referenceNumber.trim().length > 100) {
      throw new AppError('Reference number must be 100 characters or fewer.', 400);
    }

    const result = await paymentService.recordPayment(req.user.id, {
      ...req.body,
      invoiceId: parsedInvoiceId,
    });

    res.status(201).json({
      status: 'ok',
      message: `Payment recorded. Invoice status is now ${result.invoice.status}.`,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  list,
  create,
};

