const customerService = require('../services/customer.service');
const AppError = require('../utils/appError');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ALLOWED_FILTERS = new Set(['all', 'with_email', 'missing_email', 'has_invoices']);

function parseCustomerId(rawId) {
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) {
    throw new AppError('Invalid customer ID.', 400);
  }
  return id;
}

function validateCustomerBody(body) {
  const { name, email, phone, companyName } = body;

  if (!name || !name.trim()) {
    throw new AppError('Customer name is required.', 400);
  }
  if (name.trim().length > 140) {
    throw new AppError('Customer name must be 140 characters or fewer.', 400);
  }
  if (companyName && companyName.trim().length > 160) {
    throw new AppError('Company name must be 160 characters or fewer.', 400);
  }
  if (email && email.trim() && !EMAIL_REGEX.test(email.trim())) {
    throw new AppError('Please provide a valid email address.', 400);
  }
  if (phone && phone.trim().length > 40) {
    throw new AppError('Phone number must be 40 characters or fewer.', 400);
  }
}

async function list(req, res, next) {
  try {
    const search = typeof req.query.search === 'string' ? req.query.search : '';
    const filter = ALLOWED_FILTERS.has(req.query.filter)
      ? req.query.filter
      : 'all';

    const customers = await customerService.listCustomers(req.user.id, {
      search,
      filter,
    });

    res.status(200).json({
      status: 'ok',
      data: customers,
    });
  } catch (error) {
    next(error);
  }
}

async function getOne(req, res, next) {
  try {
    const customerId = parseCustomerId(req.params.id);
    const result = await customerService.getCustomerDetails(
      req.user.id,
      customerId
    );

    res.status(200).json({
      status: 'ok',
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

async function create(req, res, next) {
  try {
    validateCustomerBody(req.body);
    const customer = await customerService.createCustomer(req.user.id, req.body);

    res.status(201).json({
      status: 'ok',
      message: 'Customer created successfully.',
      data: customer,
    });
  } catch (error) {
    next(error);
  }
}

async function update(req, res, next) {
  try {
    const customerId = parseCustomerId(req.params.id);
    validateCustomerBody(req.body);
    const customer = await customerService.updateCustomer(
      req.user.id,
      customerId,
      req.body
    );

    res.status(200).json({
      status: 'ok',
      message: 'Customer updated successfully.',
      data: customer,
    });
  } catch (error) {
    next(error);
  }
}

async function remove(req, res, next) {
  try {
    const customerId = parseCustomerId(req.params.id);
    await customerService.deleteCustomer(req.user.id, customerId);

    res.status(200).json({
      status: 'ok',
      message: 'Customer deleted successfully.',
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  list,
  getOne,
  create,
  update,
  remove,
};

