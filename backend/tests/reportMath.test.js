const test = require('node:test');
const assert = require('node:assert/strict');
const {
  buildContinuousMonthSeries,
  computeCollectionMetrics,
  escapeCsvCell,
  parseMonthWindow,
  exportReportsCsv,
} = require('../src/services/report.service');
const reportModel = require('../src/models/report.model');

test('buildContinuousMonthSeries fills missing calendar months with zeroed decimals', () => {
  const refDate = new Date(2026, 10, 12); // Nov 2026
  const series = buildContinuousMonthSeries(
    3,
    [{ month_key: '2026-11', total_amount: '1500.50', invoice_count: 2 }],
    [{ month_key: '2026-09', total_amount: '400.00', payment_count: 1 }],
    refDate
  );

  assert.equal(series.length, 3);
  assert.deepEqual(
    series.map((s) => s.monthKey),
    ['2026-09', '2026-10', '2026-11']
  );
  assert.equal(series[0].collectedAmount, '400.00');
  assert.equal(series[0].invoicedAmount, '0.00');
  assert.equal(series[1].invoicedAmount, '0.00');
  assert.equal(series[1].collectedAmount, '0.00');
  assert.equal(series[2].invoicedAmount, '1500.50');
  assert.equal(series[2].invoiceCount, 2);
});

test('computeCollectionMetrics computes exact collection rate and handles zero billed', () => {
  const metrics = computeCollectionMetrics({
    totalInvoices: 5,
    cancelledCount: 1,
    totalBilled: '1000.00',
    totalCollected: '750.00',
  });
  assert.equal(metrics.activeInvoiceCount, 4);
  assert.equal(metrics.collectionRatePercent, 75);
  assert.equal(metrics.averageInvoiceValue, '250.00');

  const emptyMetrics = computeCollectionMetrics({
    totalInvoices: 0,
    cancelledCount: 0,
    totalBilled: '0.00',
    totalCollected: '0.00',
  });
  assert.equal(emptyMetrics.collectionRatePercent, 0);
  assert.equal(emptyMetrics.averageInvoiceValue, '0.00');
});

test('escapeCsvCell neutralizes spreadsheet formula injection and quotes commas', () => {
  assert.equal(escapeCsvCell('=SUM(A1:A2)'), "'=SUM(A1:A2)");
  assert.equal(escapeCsvCell('+123'), "'+123");
  assert.equal(escapeCsvCell('Acme, Inc.'), '"Acme, Inc."');
  assert.equal(escapeCsvCell('He said "Hi"'), '"He said ""Hi"""');
});

test('parseMonthWindow rejects unsupported month counts', () => {
  assert.equal(parseMonthWindow(undefined), 6);
  assert.equal(parseMonthWindow('12'), 12);
  assert.throws(() => parseMonthWindow('9'), /months must be one of 3, 6, or 12/);
});

test('exportReportsCsv formats clean rectangular CSV with UTF-8 BOM', async () => {
  const orig = reportModel.getInvoiceTrackerRowsByUser;
  reportModel.getInvoiceTrackerRowsByUser = async () => [
    {
      id: 1,
      invoiceNumber: 'INV-0001',
      customerName: 'Acme, Corp.',
      customerEmail: 'billing@acme.com',
      customerCompany: 'Acme Global',
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
      notes: 'Standard Net-15 Retainer',
    },
  ];

  try {
    const csv = await exportReportsCsv(999);
    assert.ok(csv.startsWith('\uFEFF'));
    const rows = csv.slice(1).split('\r\n');
    assert.equal(rows.length, 2);
    assert.equal(
      rows[0],
      'Invoice ID,Invoice Number,Customer Name,Customer Email,Customer Company,Invoice Date,Due Date,Subtotal,Tax,Discount,Total Amount,Amount Paid,Balance Due,Payment Status,Invoice Status,Days Overdue,Notes'
    );
    assert.equal(
      rows[1],
      '1,INV-0001,"Acme, Corp.",billing@acme.com,Acme Global,2026-10-01,2026-10-15,1000.00,100.00,50.00,1050.00,450.00,600.00,Partially Paid,Overdue,29,Standard Net-15 Retainer'
    );
  } finally {
    reportModel.getInvoiceTrackerRowsByUser = orig;
  }
});

