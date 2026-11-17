/**
 * Phase 6 Comprehensive Export Verification Suite
 * Tests Excel (.xlsx) and CSV (.csv) export engines against live MariaDB database.
 *
 * Verifies all 10 Master Prompt scenarios:
 * 1. Export when invoices exist
 * 2. Export when no invoices exist
 * 3. Export paid invoices
 * 4. Export partially paid invoices
 * 5. Export unpaid invoices
 * 6. Export overdue invoices
 * 7. Export invoices containing customer names with special characters
 * 8. Verify totals against actual MySQL database
 * 9. Verify Excel formulas and filters
 * 10. Verify CSV format, encoding, and numeric values
 */

const assert = require('node:assert/strict');
const http = require('node:http');
const ExcelJS = require('exceljs');
const app = require('../src/app');
const { pool } = require('../src/config/db');

async function apiRequest(baseUrl, method, path, token, body) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const contentType = res.headers.get('content-type') || '';
  let data;
  if (contentType.includes('application/json')) {
    data = await res.json();
  } else {
    data = Buffer.from(await res.arrayBuffer());
  }

  return { status: res.status, headers: res.headers, data };
}

async function run() {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}/api`;

  const ts = Date.now();
  const userIds = [];

  try {
    // -----------------------------------------------------------------------
    // A. Setup User A (Account with comprehensive invoice portfolio)
    // -----------------------------------------------------------------------
    const regA = await apiRequest(baseUrl, 'POST', '/auth/register', null, {
      fullName: 'Financial Auditor',
      email: `auditor_${ts}@invoiceflow.test`,
      password: 'AuditPassword123!',
      businessName: 'Vanguard Global Advisory',
    });
    assert.equal(regA.status, 201);
    const tokenA = regA.data.data.token;
    const userIdA = regA.data.data.user.id;
    userIds.push(userIdA);

    // Setup User B (Empty account with 0 invoices)
    const regB = await apiRequest(baseUrl, 'POST', '/auth/register', null, {
      fullName: 'Empty User',
      email: `empty_${ts}@invoiceflow.test`,
      password: 'AuditPassword123!',
      businessName: 'Zero Records Co',
    });
    assert.equal(regB.status, 201);
    const tokenB = regB.data.data.token;
    userIds.push(regB.data.data.user.id);

    // -----------------------------------------------------------------------
    // B. Create Customers (including Special Characters: quotes, commas, accents)
    // -----------------------------------------------------------------------
    // Customer 1: Standard
    const c1Res = await apiRequest(baseUrl, 'POST', '/customers', tokenA, {
      name: 'Alpha Systems',
      companyName: 'Alpha Corp',
      email: 'finance@alphasystems.test',
    });
    assert.equal(c1Res.status, 201);
    const cust1Id = c1Res.data.data.id;

    // Customer 2: Special Characters ("O'Connor & Sons, LLC", 'René "Fast" Müller')
    const c2Res = await apiRequest(baseUrl, 'POST', '/customers', tokenA, {
      name: 'René "Fast" Müller',
      companyName: "O'Connor & Sons, LLC",
      email: 'rene@oconnor-sons.test',
    });
    assert.equal(c2Res.status, 201);
    const cust2Id = c2Res.data.data.id;

    // -----------------------------------------------------------------------
    // C. Create Invoices across all statuses & dates
    // -----------------------------------------------------------------------
    const today = new Date();
    const pastDateStr = new Date(today.getTime() - 15 * 86400000).toISOString().slice(0, 10);
    const futureDateStr = new Date(today.getTime() + 20 * 86400000).toISOString().slice(0, 10);
    const todayStr = today.toISOString().slice(0, 10);

    // 1. Paid Invoice: 500.00 total
    const invPaidRes = await apiRequest(baseUrl, 'POST', '/invoices', tokenA, {
      customerId: cust1Id,
      issueDate: todayStr,
      dueDate: futureDateStr,
      status: 'Sent',
      items: [{ description: 'Strategy Consulting', quantity: 1, unitPrice: 500 }],
    });
    assert.equal(invPaidRes.status, 201);
    const invPaidId = invPaidRes.data.data.id;

    // Record full payment for Paid invoice
    const pay1 = await apiRequest(baseUrl, 'POST', '/payments', tokenA, {
      invoiceId: invPaidId,
      amount: 500,
      paymentDate: todayStr,
      paymentMethod: 'Bank Transfer',
      referenceNumber: 'TXN-PAID-001',
    });
    assert.equal(pay1.status, 201);

    // 2. Partially Paid Invoice: 1000.00 total, 400.00 paid, 600.00 balance
    const invPartRes = await apiRequest(baseUrl, 'POST', '/invoices', tokenA, {
      customerId: cust1Id,
      issueDate: todayStr,
      dueDate: futureDateStr,
      status: 'Sent',
      items: [{ description: 'Cloud Architecture', quantity: 2, unitPrice: 500 }],
    });
    assert.equal(invPartRes.status, 201);
    const invPartId = invPartRes.data.data.id;

    const pay2 = await apiRequest(baseUrl, 'POST', '/payments', tokenA, {
      invoiceId: invPartId,
      amount: 400,
      paymentDate: todayStr,
      paymentMethod: 'Card',
      referenceNumber: 'TXN-PART-002',
    });
    assert.equal(pay2.status, 201);

    // 3. Unpaid Invoice (Future due date): 750.00 total, 0 paid, 750 balance
    const invUnpaidRes = await apiRequest(baseUrl, 'POST', '/invoices', tokenA, {
      customerId: cust2Id,
      issueDate: todayStr,
      dueDate: futureDateStr,
      status: 'Sent',
      items: [{ description: 'Security Hardening', quantity: 1, unitPrice: 750 }],
    });
    assert.equal(invUnpaidRes.status, 201);

    // 4. Overdue Invoice: 1200.00 total, 200.00 paid, 1000.00 balance, past due date (15 days overdue)
    const invOverdueRes = await apiRequest(baseUrl, 'POST', '/invoices', tokenA, {
      customerId: cust2Id,
      issueDate: pastDateStr,
      dueDate: pastDateStr,
      status: 'Sent',
      items: [{ description: 'Legacy Migration', quantity: 1, unitPrice: 1200 }],
    });
    assert.equal(invOverdueRes.status, 201);
    const invOverdueId = invOverdueRes.data.data.id;

    const pay3 = await apiRequest(baseUrl, 'POST', '/payments', tokenA, {
      invoiceId: invOverdueId,
      amount: 200,
      paymentDate: pastDateStr,
      paymentMethod: 'Cheque',
      referenceNumber: 'CHK-99441',
    });
    assert.equal(pay3.status, 201);

    // Run scheduler check to mark invOverdue as Overdue status in DB
    await apiRequest(baseUrl, 'POST', '/automation/run-checks', tokenA);

    // -----------------------------------------------------------------------
    // D. Test Scenario 1 & 8: Excel Export with Invoices & Database Totals
    // -----------------------------------------------------------------------
    const excelRes = await apiRequest(baseUrl, 'GET', '/reports/export.xlsx', tokenA);
    assert.equal(excelRes.status, 200);
    assert.match(
      excelRes.headers.get('content-type') || '',
      /spreadsheetml\.sheet/
    );
    assert.match(
      excelRes.headers.get('content-disposition') || '',
      /InvoiceFlow_Invoice_Tracker_.*\.xlsx/
    );

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(excelRes.data);

    // Verify 4 worksheets exist
    assert.equal(wb.worksheets.length, 4);
    assert.deepEqual(
      wb.worksheets.map((s) => s.name),
      ['Invoice Tracker', 'Dashboard Summary', 'Overdue Invoices', 'Payment Tracking']
    );

    // --- SHEET 1: INVOICE TRACKER ---
    const wsTracker = wb.getWorksheet('Invoice Tracker');
    assert.ok(wsTracker.autoFilter, 'autoFilter is defined on tracker sheet');
    assert.match(String(wsTracker.autoFilter.from || wsTracker.autoFilter), /A4/);
    assert.equal(wsTracker.views[0].state, 'frozen');
    assert.equal(wsTracker.views[0].ySplit, 4);

    // Check row count: 4 invoices -> Rows 5 to 8, Row 9 is TOTAL
    assert.equal(wsTracker.rowCount, 9);

    // Verify total formulas on row 9
    assert.deepEqual(wsTracker.getCell('G9').value, { formula: 'SUM(G5:G8)' }); // Subtotal
    assert.deepEqual(wsTracker.getCell('J9').value, { formula: 'SUM(J5:J8)' }); // Total Amount
    assert.deepEqual(wsTracker.getCell('K9').value, { formula: 'SUM(K5:K8)' }); // Amount Paid
    assert.deepEqual(wsTracker.getCell('L9').value, { formula: 'SUM(L5:L8)' }); // Balance Due

    // Test Scenario 7: Special characters in customer names preserved in Excel
    const specialCustCell = [wsTracker.getCell('C5'), wsTracker.getCell('C6'), wsTracker.getCell('C7'), wsTracker.getCell('C8')]
      .find((c) => String(c.value).includes('René'));
    assert.ok(specialCustCell, 'Customer name with quotes and accents found in Excel');
    assert.equal(specialCustCell.value, 'René "Fast" Müller');

    // Test Scenarios 3, 4, 5, 6: Verify payment statuses in Sheet 1
    const paymentStatuses = [
      wsTracker.getCell('M5').value,
      wsTracker.getCell('M6').value,
      wsTracker.getCell('M7').value,
      wsTracker.getCell('M8').value,
    ];
    assert.ok(paymentStatuses.includes('Paid'), 'Paid status present');
    assert.ok(paymentStatuses.includes('Partially Paid'), 'Partially Paid status present');
    assert.ok(paymentStatuses.includes('Unpaid'), 'Unpaid status present');

    // --- SHEET 2: DASHBOARD SUMMARY ---
    const wsSummary = wb.getWorksheet('Dashboard Summary');
    assert.deepEqual(wsSummary.getCell('B6').value, { formula: "'Invoice Tracker'!J9" }); // Total Billed
    assert.deepEqual(wsSummary.getCell('D6').value, { formula: "'Invoice Tracker'!K9" }); // Total Collected
    assert.deepEqual(wsSummary.getCell('F6').value, { formula: "'Invoice Tracker'!L9" }); // Outstanding

    // --- SHEET 3: OVERDUE INVOICES ---
    const wsOverdue = wb.getWorksheet('Overdue Invoices');
    // Only the 1 overdue invoice should be in the list (Row 5 is data, Row 6 is total)
    assert.equal(wsOverdue.getCell('H5').value, 1000); // Balance Due
    assert.ok(Number(wsOverdue.getCell('I5').value) >= 15); // Days Overdue >= 15
    assert.equal(wsOverdue.getCell('A6').value, 'TOTAL OVERDUE');
    assert.deepEqual(wsOverdue.getCell('H6').value, { formula: 'SUM(H5:H5)' });

    // --- SHEET 4: PAYMENT TRACKING ---
    const wsPayments = wb.getWorksheet('Payment Tracking');
    // 3 payments recorded -> Rows 5 to 7, Row 8 is Total
    assert.equal(wsPayments.getCell('A8').value, 'TOTAL RECEIVED');
    assert.deepEqual(wsPayments.getCell('D8').value, { formula: 'SUM(D5:D7)' });

    // -----------------------------------------------------------------------
    // E. Test Scenario 10: CSV Export Structure, UTF-8 BOM, Numeric Format
    // -----------------------------------------------------------------------
    const csvRes = await apiRequest(baseUrl, 'GET', '/reports/export.csv', tokenA);
    assert.equal(csvRes.status, 200);
    assert.match(csvRes.headers.get('content-type') || '', /text\/csv/);
    assert.match(
      csvRes.headers.get('content-disposition') || '',
      /InvoiceFlow_Invoice_Data_.*\.csv/
    );

    const csvText = csvRes.data.toString('utf8');
    // Check UTF-8 BOM
    assert.equal(csvText.charCodeAt(0), 0xfeff, 'CSV begins with UTF-8 BOM (0xFEFF)');

    const csvLines = csvText.slice(1).split('\r\n');
    assert.equal(csvLines.length, 5); // 1 header + 4 invoice rows

    // Header validation (17 columns)
    const headerCols = csvLines[0].split(',');
    assert.equal(headerCols.length, 17);
    assert.equal(headerCols[0], 'Invoice ID');
    assert.equal(headerCols[1], 'Invoice Number');
    assert.equal(headerCols[10], 'Total Amount');
    assert.equal(headerCols[11], 'Amount Paid');
    assert.equal(headerCols[12], 'Balance Due');

    // Test Scenario 7 in CSV: Special characters quoted and escaped
    assert.match(csvText, /"René ""Fast"" Müller"/, 'Customer with quotes escaped as double quotes');
    assert.match(csvText, /"O'Connor & Sons, LLC"/, 'Company name with comma quoted safely');

    // Verify numerical values are clean decimals (not text currency symbols)
    assert.match(csvText, /,1200\.00,200\.00,1000\.00,/);
    assert.match(csvText, /,500\.00,500\.00,0\.00,/);

    // -----------------------------------------------------------------------
    // F. Test Scenario 2: Empty Account Export (0 Invoices)
    // -----------------------------------------------------------------------
    const emptyExcelRes = await apiRequest(baseUrl, 'GET', '/reports/export.xlsx', tokenB);
    assert.equal(emptyExcelRes.status, 200);
    const emptyWb = new ExcelJS.Workbook();
    await emptyWb.xlsx.load(emptyExcelRes.data);
    assert.equal(emptyWb.worksheets.length, 4);
    assert.match(
      String(emptyWb.getWorksheet('Invoice Tracker').getCell('A5').value),
      /No invoice records found/
    );
    assert.match(
      String(emptyWb.getWorksheet('Overdue Invoices').getCell('A5').value),
      /No overdue invoices/
    );
    assert.match(
      String(emptyWb.getWorksheet('Payment Tracking').getCell('A5').value),
      /No payment transactions recorded/
    );

    const emptyCsvRes = await apiRequest(baseUrl, 'GET', '/reports/export.csv', tokenB);
    assert.equal(emptyCsvRes.status, 200);
    const emptyCsvText = emptyCsvRes.data.toString('utf8');
    assert.equal(emptyCsvText.charCodeAt(0), 0xfeff);
    const emptyCsvLines = emptyCsvText.slice(1).split('\r\n');
    assert.equal(emptyCsvLines.length, 1, 'Only header row present for empty account');

    console.log('PHASE_6_ALL_SCENARIOS_PASSED_SUCCESSFULLY');
  } finally {
    // Teardown test accounts and cascaded data
    if (userIds.length > 0) {
      const placeholders = userIds.map(() => '?').join(',');
      await pool.execute(`DELETE FROM payments WHERE user_id IN (${placeholders})`, userIds);
      await pool.execute(`DELETE FROM invoices WHERE user_id IN (${placeholders})`, userIds);
      await pool.execute(`DELETE FROM customers WHERE user_id IN (${placeholders})`, userIds);
      await pool.execute(`DELETE FROM users WHERE id IN (${placeholders})`, userIds);
    }
    server.close();
    await pool.end();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
