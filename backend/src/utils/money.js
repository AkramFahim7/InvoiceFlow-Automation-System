/**
 * Exact integer minor-unit (cents/paisa) financial arithmetic utilities.
 * Avoids IEEE-754 binary floating-point drift in monetary calculations.
 */

/**
 * Parse a decimal number or numeric string into integer cents (1/100th of unit),
 * rounding half-up at the 3rd decimal place.
 * @param {number|string} value
 * @returns {number} Integer cents
 */
function toCents(value) {
  if (value === null || value === undefined || value === '') {
    return 0;
  }

  const str = String(value).trim();
  if (!/^-?\d+(\.\d+)?$/.test(str)) {
    throw new Error(`Invalid monetary value: "${value}"`);
  }

  const isNegative = str.startsWith('-');
  const unsigned = isNegative ? str.slice(1) : str;
  const [wholePart, fracPart = ''] = unsigned.split('.');

  const padded = (fracPart + '000').slice(0, 3);
  let cents = Number(wholePart) * 100 + Number(padded.slice(0, 2));
  if (Number(padded[2]) >= 5) {
    cents += 1;
  }

  return isNegative ? -cents : cents;
}

/**
 * Multiply two scaled integers and divide by a positive integer divisor,
 * rounding half-up without floating-point inaccuracy.
 * Uses BigInt to prevent overflow on large invoice amounts.
 */
function multiplyAndDivideRoundHalfUp(a, b, divisor) {
  const bigA = BigInt(a);
  const bigB = BigInt(b);
  const bigDiv = BigInt(divisor);
  const product = bigA * bigB;
  const sign = product < 0n ? -1n : 1n;
  const absProduct = product < 0n ? -product : product;
  const quotient = (absProduct + bigDiv / 2n) / bigDiv;
  return Number(sign * quotient);
}

/**
 * Format integer cents as an exact 2-decimal string suitable for MySQL DECIMAL(12,2).
 * @param {number} cents
 * @returns {string}
 */
function centsToDecimal(cents) {
  const safe = Math.trunc(cents);
  const sign = safe < 0 ? '-' : '';
  const abs = Math.abs(safe);
  const whole = Math.floor(abs / 100);
  const frac = String(abs % 100).padStart(2, '0');
  return `${sign}${whole}.${frac}`;
}

/**
 * Compute exact line item total in cents: quantity * unitPrice.
 * Quantity supports up to 2 decimal places (e.g. 1.50 hours).
 */
function calculateLineItemCents(quantity, unitPrice) {
  const qtyHundredths = toCents(quantity);
  const unitPriceCents = toCents(unitPrice);
  const lineTotalCents = multiplyAndDivideRoundHalfUp(
    qtyHundredths,
    unitPriceCents,
    100
  );

  return {
    quantityDecimal: centsToDecimal(qtyHundredths),
    unitPriceDecimal: centsToDecimal(unitPriceCents),
    lineTotalCents,
    lineTotalDecimal: centsToDecimal(lineTotalCents),
  };
}

/**
 * Compute all authoritative invoice totals from line items, discount, and tax rate.
 * Formula:
 *   Subtotal = Sum(Quantity * Unit Price)
 *   Taxable Amount = Subtotal - Discount
 *   Tax = Taxable Amount * (Tax Rate / 100)
 *   Grand Total = Taxable Amount + Tax
 */
function calculateInvoiceTotals({ items, discountAmount = 0, taxRate = 0 }) {
  let subtotalCents = 0;

  const computedItems = items.map((item, index) => {
    const line = calculateLineItemCents(item.quantity, item.unitPrice);
    subtotalCents += line.lineTotalCents;
    return {
      description: item.description.trim(),
      quantity: line.quantityDecimal,
      unitPrice: line.unitPriceDecimal,
      lineTotal: line.lineTotalDecimal,
      sortOrder: index,
    };
  });

  const discountCents = toCents(discountAmount);
  if (discountCents < 0) {
    throw new Error('Discount amount cannot be negative.');
  }
  if (discountCents > subtotalCents) {
    throw new Error('Discount amount cannot exceed invoice subtotal.');
  }

  const taxableCents = subtotalCents - discountCents;
  const taxRateBasisPoints = toCents(taxRate); // 15.50% -> 1550
  if (taxRateBasisPoints < 0 || taxRateBasisPoints > 10000) {
    throw new Error('Tax rate must be between 0% and 100%.');
  }

  const taxCents = multiplyAndDivideRoundHalfUp(
    taxableCents,
    taxRateBasisPoints,
    10000
  );
  const grandTotalCents = taxableCents + taxCents;

  return {
    items: computedItems,
    subtotalCents,
    discountCents,
    taxableCents,
    taxCents,
    grandTotalCents,
    subtotal: centsToDecimal(subtotalCents),
    discountAmount: centsToDecimal(discountCents),
    taxRate: centsToDecimal(taxRateBasisPoints),
    taxAmount: centsToDecimal(taxCents),
    grandTotal: centsToDecimal(grandTotalCents),
  };
}

/**
 * Compute updated invoice balances and status after applying a payment in integer cents.
 */
function calculatePaymentUpdate({ grandTotal, currentAmountPaid, paymentAmount }) {
  const grandTotalCents = toCents(grandTotal);
  const currentPaidCents = toCents(currentAmountPaid);
  const paymentCents = toCents(paymentAmount);

  if (paymentCents <= 0) {
    throw new Error('Payment amount must be greater than zero.');
  }

  const currentRemainingCents = grandTotalCents - currentPaidCents;
  if (paymentCents > currentRemainingCents) {
    throw new Error(
      `Payment amount exceeds remaining balance (${centsToDecimal(currentRemainingCents)}).`
    );
  }

  const newAmountPaidCents = currentPaidCents + paymentCents;
  const newRemainingCents = grandTotalCents - newAmountPaidCents;
  const newStatus = newRemainingCents === 0 ? 'Paid' : 'Partially Paid';

  return {
    paymentAmount: centsToDecimal(paymentCents),
    newAmountPaid: centsToDecimal(newAmountPaidCents),
    newRemainingBalance: centsToDecimal(newRemainingCents),
    newStatus,
  };
}

module.exports = {
  toCents,
  centsToDecimal,
  calculateLineItemCents,
  calculateInvoiceTotals,
  calculatePaymentUpdate,
};

