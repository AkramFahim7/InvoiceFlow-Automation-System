const test = require('node:test');
const assert = require('node:assert/strict');
const {
  toCents,
  centsToDecimal,
  calculateInvoiceTotals,
} = require('../src/utils/money');

test('toCents avoids classic IEEE-754 rounding errors like 1.005', () => {
  assert.equal(toCents('1.005'), 101);
  assert.equal(toCents(19.99), 1999);
  assert.equal(centsToDecimal(toCents('0.1') + toCents('0.2')), '0.30');
});

test('calculateInvoiceTotals computes subtotal, discount, tax, and grand total accurately', () => {
  const result = calculateInvoiceTotals({
    items: [
      { description: 'Web Design', quantity: 2, unitPrice: 15000 },
      { description: 'Consulting', quantity: 1.5, unitPrice: 4000 },
    ],
    discountAmount: 1000,
    taxRate: 15,
  });

  // 2 * 15000 + 1.5 * 4000 = 30000 + 6000 = 36000
  // Taxable = 36000 - 1000 = 35000
  // Tax = 35000 * 15% = 5250
  // Grand Total = 35000 + 5250 = 40250
  assert.equal(result.subtotal, '36000.00');
  assert.equal(result.discountAmount, '1000.00');
  assert.equal(result.taxAmount, '5250.00');
  assert.equal(result.grandTotal, '40250.00');
});

test('calculateInvoiceTotals rejects discount larger than subtotal', () => {
  assert.throws(() => {
    calculateInvoiceTotals({
      items: [{ description: 'Item', quantity: 1, unitPrice: 100 }],
      discountAmount: 150,
      taxRate: 0,
    });
  }, /exceed invoice subtotal/);
});

