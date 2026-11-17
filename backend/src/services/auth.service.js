const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const userModel = require('../models/user.model');
const AppError = require('../utils/appError');

const SALT_ROUNDS = 10;

function signAuthToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
    },
    env.jwt.secret,
    {
      expiresIn: env.jwt.expiresIn,
    }
  );
}

function formatProfileResponse(row) {
  return {
    user: {
      id: row.id,
      fullName: row.full_name,
      email: row.email,
      createdAt: row.created_at,
    },
    businessProfile: {
      id: row.business_profile_id,
      businessName: row.business_name,
      businessEmail: row.business_email || '',
      phone: row.phone || '',
      address: row.address || '',
      taxLabel: row.tax_label,
      defaultTaxRate: Number(row.default_tax_rate),
      currencySymbol: row.currency_symbol,
      invoicePrefix: row.invoice_prefix,
      nextInvoiceNumber: row.next_invoice_number,
      paymentInstructions: row.payment_instructions || '',
      logoUrl: row.logo_url || '',
    },
  };
}

async function register({ fullName, email, password, businessName }) {
  const normalizedEmail = email.trim().toLowerCase();
  const existingUser = await userModel.findByEmail(normalizedEmail);
  if (existingUser) {
    throw new AppError('An account with this email already exists.', 409);
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const created = await userModel.createAccountWithProfile({
    fullName: fullName.trim(),
    email: normalizedEmail,
    passwordHash,
    businessName: businessName.trim(),
  });

  const formatted = formatProfileResponse(created);
  const token = signAuthToken(formatted.user);

  return { token, ...formatted };
}

async function login({ email, password }) {
  const normalizedEmail = email.trim().toLowerCase();
  const userRecord = await userModel.findByEmail(normalizedEmail);

  // Use a generic message so attackers cannot enumerate registered emails
  if (!userRecord) {
    throw new AppError('Invalid email or password.', 401);
  }

  const passwordMatches = await bcrypt.compare(password, userRecord.password_hash);
  if (!passwordMatches) {
    throw new AppError('Invalid email or password.', 401);
  }

  const profileRow = await userModel.findProfileById(userRecord.id);
  const formatted = formatProfileResponse(profileRow);
  const token = signAuthToken(formatted.user);

  return { token, ...formatted };
}

async function getProfile(userId) {
  const profileRow = await userModel.findProfileById(userId);
  if (!profileRow) {
    throw new AppError('User account not found.', 404);
  }
  return formatProfileResponse(profileRow);
}

async function updateProfile(userId, payload) {
  const existing = await userModel.findProfileById(userId);
  if (!existing) {
    throw new AppError('User account not found.', 404);
  }

  const updated = await userModel.updateAccountAndProfile(userId, {
    fullName: payload.fullName.trim(),
    businessName: payload.businessName.trim(),
    businessEmail: (payload.businessEmail || '').trim() || null,
    phone: (payload.phone || '').trim() || null,
    address: (payload.address || '').trim() || null,
    taxLabel: (payload.taxLabel || 'Tax').trim(),
    defaultTaxRate: Number(payload.defaultTaxRate ?? 0),
    currencySymbol: (payload.currencySymbol || 'Rs.').trim(),
    invoicePrefix: (payload.invoicePrefix || 'INV-').trim(),
    paymentInstructions: (payload.paymentInstructions || '').trim() || null,
  });

  return formatProfileResponse(updated);
}

async function updateLogo(userId, logoUrl) {
  const updated = await userModel.updateLogoUrl(userId, logoUrl);
  if (!updated) {
    throw new AppError('User account not found.', 404);
  }
  return formatProfileResponse(updated);
}

module.exports = {
  register,
  login,
  getProfile,
  updateProfile,
  updateLogo,
};

