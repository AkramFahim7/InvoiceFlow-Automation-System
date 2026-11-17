const test = require('node:test');
const assert = require('node:assert/strict');
const { calculatePaymentUpdate } = require('../src/utils/money');

test('partial payment reduces balance and sets status to Partially Paid', () => {
  const res = calculatePaymentUpdate({
    grandTotal: '50000.00',
    currentAmountPaid: '0.00',
    paymentAmount: '20000.00',
  });

  assert.equal(res.paymentAmount, '20000.00');
  assert.equal(res.newAmountPaid, '20000.00');
  assert.equal(res.newRemainingBalance, '30000.00');
  assert.equal(res.newStatus, 'Partially Paid');
});

test('final payment sets remaining balance to 0.00 and status to Paid', () => {
  const res = calculatePaymentUpdate({
    grandTotal: '50000.00',
    currentAmountPaid: '20000.00',
    paymentAmount: '30000.00',
  });

  assert.equal(res.newAmountPaid, '50000.00');
  assert.equal(res.newRemainingBalance, '0.00');
  assert.equal(res.newStatus, 'Paid');
});

test('overpayment exceeding remaining balance is rejected', () => {
  assert.throws(() => {
    calculatePaymentUpdate({
      grandTotal: '50000.00',
      currentAmountPaid: '20000.00',
      paymentAmount: '30000.01',
    });
  }, /exceeds remaining balance/);
});

