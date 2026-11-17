const emailService = require('../services/email.service');
const AppError = require('../utils/appError');

function parsePositiveId(rawId, label) {
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) {
    throw new AppError(`Invalid ${label}.`, 400);
  }
  return id;
}

async function listLogs(req, res, next) {
  try {
    const invoiceId = req.query.invoiceId
      ? parsePositiveId(req.query.invoiceId, 'invoice ID')
      : null;

    const result = await emailService.listEmailLogs(req.user.id, { invoiceId });
    res.status(200).json({
      status: 'ok',
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

async function sendInvoice(req, res, next) {
  try {
    const invoiceId = parsePositiveId(req.params.invoiceId, 'invoice ID');
    const result = await emailService.sendInvoiceEmail(req.user.id, invoiceId);

    if (!result.ok) {
      throw new AppError(result.errorMessage || 'Failed to send invoice email.', 400);
    }

    const message = result.simulated
      ? `Simulated invoice email logged for ${result.log.recipient_email} (SMTP not configured).`
      : `Invoice email sent to ${result.log.recipient_email}.`;

    res.status(200).json({
      status: 'ok',
      message,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

async function sendPaymentConfirmation(req, res, next) {
  try {
    const paymentId = parsePositiveId(req.params.paymentId, 'payment ID');
    const result = await emailService.sendPaymentConfirmationEmail(
      req.user.id,
      paymentId
    );

    if (!result.ok) {
      throw new AppError(
        result.errorMessage || 'Failed to send payment confirmation email.',
        400
      );
    }

    const message = result.simulated
      ? `Simulated payment receipt logged for ${result.log.recipient_email} (SMTP not configured).`
      : `Payment receipt sent to ${result.log.recipient_email}.`;

    res.status(200).json({
      status: 'ok',
      message,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listLogs,
  sendInvoice,
  sendPaymentConfirmation,
};

