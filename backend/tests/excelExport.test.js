const test = require('node:test');
const assert = require('node:assert/strict');
const ExcelJS = require('exceljs');
const { generateInvoiceTrackerWorkbook } = require('../src/services/excelExport.service');

test('generateInvoiceTrackerWorkbook creates a valid 4-sheet XLSX workbook buffer', async () => {
  const sampleInvoices = [
    {
      id: 1,
      invoiceNumber: 'INV-0001',
      customerName: 'Acme Corp',
      customerEmail: 'billing@acme.com',
      issueDate: '2026-10-01',
      dueDate: '2026-10-15',
      subtotal: 1000,
      tax: 100,
      discount: 50,
      totalAmount: 1050,
      amountPaid: 450,
      balanceDue: 600,
      paymentStatus: 'Partially Paid',
      invoiceStatus: 'Overdue',
      daysOverdue: 29,
      notes: 'Monthly maintenance retainer',
    },
    {
      id: 2,
      invoiceNumber: 'INV-0002',
      customerName: 'Beta LLC',
      customerEmail: 'contact@beta.com',
      issueDate: '2026-11-01',
      dueDate: '2026-11-20',
      subtotal: 500,
      tax: 50,
      discount: 0,
      totalAmount: 550,
      amountPaid: 550,
      balanceDue: 0,
      paymentStatus: 'Paid',
      invoiceStatus: 'Paid',
      daysOverdue: 0,
      notes: '',
    },
  ];

  const samplePayments = [
    {
      id: 10,
      invoiceId: 1,
      invoiceNumber: 'INV-0001',
      customerName: 'Acme Corp',
      paymentDate: '2026-10-10',
      paymentAmount: 450,
      paymentMethod: 'Bank Transfer',
      referenceNumber: 'WIRE-99881',
      remainingBalance: 600,
      notes: 'Deposit received',
    },
  ];

  const buffer = await generateInvoiceTrackerWorkbook({
    businessProfile: {
      business_name: 'Apex Studio',
      currency_symbol: 'Rs.',
    },
    invoices: sampleInvoices,
    payments: samplePayments,
  });

  assert.ok(Buffer.isBuffer(buffer) || buffer instanceof Uint8Array);
  // Standard ZIP / XLSX PK magic bytes: 0x50, 0x4B
  assert.equal(buffer[0], 0x50);
  assert.equal(buffer[1], 0x4B);

  // Read back the workbook to inspect sheets and cell contents
  const reader = new ExcelJS.Workbook();
  await reader.xlsx.load(buffer);

  assert.equal(reader.worksheets.length, 4);

  const sheetNames = reader.worksheets.map((ws) => ws.name);
  assert.deepEqual(sheetNames, [
    'Invoice Tracker',
    'Dashboard Summary',
    'Overdue Invoices',
    'Payment Tracking',
  ]);

  // Inspect Sheet 1: Invoice Tracker
  const wsTracker = reader.getWorksheet('Invoice Tracker');
  assert.equal(wsTracker.getCell('A4').value, 'Invoice ID');
  assert.equal(wsTracker.getCell('B4').value, 'Invoice Number');
  assert.equal(wsTracker.getCell('B5').value, 'INV-0001');
  assert.equal(wsTracker.getCell('M5').value, 'Partially Paid');
  assert.equal(wsTracker.getCell('B6').value, 'INV-0002');
  assert.equal(wsTracker.getCell('M6').value, 'Paid');

  // Verify total formula exists on total row (row 7)
  assert.deepEqual(wsTracker.getCell('G7').value, { formula: 'SUM(G5:G6)' });
  assert.deepEqual(wsTracker.getCell('J7').value, { formula: 'SUM(J5:J6)' });

  // Inspect Sheet 3: Overdue Invoices
  const wsOverdue = reader.getWorksheet('Overdue Invoices');
  // Only INV-0001 is overdue with balance > 0
  assert.equal(wsOverdue.getCell('A5').value, 'INV-0001');
  assert.equal(wsOverdue.getCell('H5').value, 600); // Balance Due
  assert.equal(wsOverdue.getCell('I5').value, 29); // Days Overdue
  assert.equal(wsOverdue.getCell('A6').value, 'TOTAL OVERDUE');

  // Inspect Sheet 4: Payment Tracking
  const wsPayments = reader.getWorksheet('Payment Tracking');
  assert.equal(wsPayments.getCell('B5').value, 'INV-0001');
  assert.equal(wsPayments.getCell('D5').value, 450); // Payment Amount
  assert.equal(wsPayments.getCell('E5').value, 'Bank Transfer');
  assert.equal(wsPayments.getCell('A6').value, 'TOTAL RECEIVED');
});

test('generateInvoiceTrackerWorkbook handles empty dataset without throwing', async () => {
  const buffer = await generateInvoiceTrackerWorkbook({
    businessProfile: {
      business_name: 'Empty Co',
      currency_symbol: '$',
    },
    invoices: [],
    payments: [],
  });

  assert.ok(buffer && buffer.length > 0);

  const reader = new ExcelJS.Workbook();
  await reader.xlsx.load(buffer);
  assert.equal(reader.worksheets.length, 4);

  const wsTracker = reader.getWorksheet('Invoice Tracker');
  assert.match(
    String(wsTracker.getCell('A5').value),
    /No invoice records found/
  );

  const wsOverdue = reader.getWorksheet('Overdue Invoices');
  assert.match(
    String(wsOverdue.getCell('A5').value),
    /No overdue invoices/
  );

  const wsPayments = reader.getWorksheet('Payment Tracking');
  assert.match(
    String(wsPayments.getCell('A5').value),
    /No payment transactions recorded/
  );
});

