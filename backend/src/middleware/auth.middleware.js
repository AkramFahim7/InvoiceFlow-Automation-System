const jwt = require('jsonwebtoken');
const env = require('../config/env');
const userModel = require('../models/user.model');
const AppError = require('../utils/appError');

/**
 * Protects private routes by verifying the Bearer JWT and attaching req.user.
 */
async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization || '';
    if (!authHeader.startsWith('Bearer ')) {
      throw new AppError('Authentication required. Provide a Bearer token.', 401);
    }

    const token = authHeader.slice(7).trim();
    if (!token) {
      throw new AppError('Authentication token is missing.', 401);
    }

    let decoded;
    try {
      decoded = jwt.verify(token, env.jwt.secret);
    } catch (err) {
      const msg =
        err.name === 'TokenExpiredError'
          ? 'Your session has expired. Please log in again.'
          : 'Invalid authentication token.';
      throw new AppError(msg, 401);
    }

    const profile = await userModel.findProfileById(decoded.sub);
    if (!profile) {
      throw new AppError('Account associated with this token no longer exists.', 401);
    }

    req.user = {
      id: profile.id,
      email: profile.email,
      fullName: profile.full_name,
    };

    next();
  } catch (error) {
    next(error);
  }
}

module.exports = {
  requireAuth,
};

