const fs = require('fs');
const path = require('path');
const authService = require('../services/auth.service');
const AppError = require('../utils/appError');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function register(req, res, next) {
  try {
    const { fullName, email, password, businessName } = req.body;

    if (!fullName || !fullName.trim()) {
      throw new AppError('Full name is required.', 400);
    }
    if (!email || !EMAIL_REGEX.test(email.trim())) {
      throw new AppError('A valid email address is required.', 400);
    }
    if (!password || password.length < 8) {
      throw new AppError('Password must be at least 8 characters long.', 400);
    }
    if (!businessName || !businessName.trim()) {
      throw new AppError('Business name is required.', 400);
    }

    const result = await authService.register({
      fullName,
      email,
      password,
      businessName,
    });

    res.status(201).json({
      status: 'ok',
      message: 'Account registered successfully.',
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    if (!email || !EMAIL_REGEX.test(email.trim())) {
      throw new AppError('A valid email address is required.', 400);
    }
    if (!password) {
      throw new AppError('Password is required.', 400);
    }

    const result = await authService.login({ email, password });

    res.status(200).json({
      status: 'ok',
      message: 'Logged in successfully.',
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

async function getMe(req, res, next) {
  try {
    const profile = await authService.getProfile(req.user.id);
    res.status(200).json({
      status: 'ok',
      data: profile,
    });
  } catch (error) {
    next(error);
  }
}

async function updateProfile(req, res, next) {
  try {
    const {
      fullName,
      businessName,
      businessEmail,
      defaultTaxRate,
      currencySymbol,
      invoicePrefix,
    } = req.body;

    if (!fullName || !fullName.trim()) {
      throw new AppError('Full name is required.', 400);
    }
    if (!businessName || !businessName.trim()) {
      throw new AppError('Business name is required.', 400);
    }
    if (businessEmail && !EMAIL_REGEX.test(businessEmail.trim())) {
      throw new AppError('Business email must be a valid email address.', 400);
    }

    const parsedTax = Number(defaultTaxRate ?? 0);
    if (Number.isNaN(parsedTax) || parsedTax < 0 || parsedTax > 100) {
      throw new AppError('Default tax rate must be between 0 and 100.', 400);
    }
    if (currencySymbol && currencySymbol.trim().length > 10) {
      throw new AppError('Currency symbol must be 10 characters or fewer.', 400);
    }
    if (invoicePrefix && invoicePrefix.trim().length > 20) {
      throw new AppError('Invoice prefix must be 20 characters or fewer.', 400);
    }

    const updated = await authService.updateProfile(req.user.id, req.body);
    res.status(200).json({
      status: 'ok',
      message: 'Profile updated successfully.',
      data: updated,
    });
  } catch (error) {
    next(error);
  }
}

async function uploadLogo(req, res, next) {
  try {
    const buffer = req.body;
    if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
      throw new AppError('Please upload a PNG or JPEG logo image (max 1 MB).', 400);
    }

    const isPng =
      buffer.length >= 4 &&
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47;
    const isJpeg =
      buffer.length >= 3 &&
      buffer[0] === 0xff &&
      buffer[1] === 0xd8 &&
      buffer[2] === 0xff;

    if (!isPng && !isJpeg) {
      throw new AppError('Only valid PNG or JPEG images are supported.', 400);
    }

    const ext = isPng ? 'png' : 'jpg';
    const logosDir = path.resolve(__dirname, '../../uploads/logos');
    fs.mkdirSync(logosDir, { recursive: true });

    // Remove older logo extensions for this user before saving
    for (const oldExt of ['png', 'jpg']) {
      const oldPath = path.join(logosDir, `business-${req.user.id}.${oldExt}`);
      if (fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath);
      }
    }

    const fileName = `business-${req.user.id}.${ext}`;
    fs.writeFileSync(path.join(logosDir, fileName), buffer);

    const logoUrl = `/uploads/logos/${fileName}`;
    const updated = await authService.updateLogo(req.user.id, logoUrl);

    res.status(200).json({
      status: 'ok',
      message: 'Business logo uploaded successfully.',
      data: updated,
    });
  } catch (error) {
    next(error);
  }
}

async function logout(req, res) {
  // JWTs are stateless; the client discards the stored token.
  res.status(200).json({
    status: 'ok',
    message: 'Logged out successfully.',
  });
}

module.exports = {
  register,
  login,
  getMe,
  updateProfile,
  uploadLogo,
  logout,
};

