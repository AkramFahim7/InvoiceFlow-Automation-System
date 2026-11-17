/**
 * End-to-End API + Database Verification Suite for InvoiceFlow (Phases 1-12).
 * Requires reachable MySQL/MariaDB configured via backend/.env.
 */
const assert = require('node:assert/strict');
const http = require('node:http');
const app = require('../src/app');
const { pool } = require('../src/config/db');

async function reqJson(baseUrl, method, path, token, body) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const contentType = res.headers.get('content-type') || '';
  const data = contentType.includes('application/json')
    ? await res.json()
    : await res.arrayBuffer();

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
    // Phase 1: Health & security headers
    const health = await reqJson(baseUrl, 'GET', '/health');
    assert.equal(health.status, 200);
    assert.equal(health.data.database.connected, true);
    assert.equal(health.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(health.headers.get('x-frame-options'), 'DENY');
    assert.equal(health.headers.get('x-powered-by'), null);

    // Phase 2: Auth & multi-tenant setup
    const unauth = await reqJson(baseUrl, 'GET', '/customers');
    assert.equal(unauth.status, 401);

    const regA = await reqJson(baseUrl, 'POST', '/auth/register', null, {
      fullName: 'E2E Owner',
      email: `e2e_a_${ts}@example.com`,
      password: 'Password123!',
      businessName: 'E2E Solutions',
    });
    assert.equal(regA.status, 201);
    const tokenA = regA.data.data.token;
    userIds.push(regA.data.data.user.id);

    const dupReg = await reqJson(baseUrl, 'POST', '/auth/register', null, {
      fullName: 'Duplicate',
      email: `e2e_a_${ts}@example.com`,
      password: 'Password123!',
      businessName: 'Dup',
    });
    assert.equal(dupReg.status, 409);

    const badLogin = await reqJson(baseUrl, 'POST', '/auth/login', null, {
      email: `e2e_a_${ts}@example.com`,
      password: 'WrongPassword!',
    });
    assert.equal(badLogin.status, 401);

    const regB = await reqJson(baseUrl, 'POST', '/auth/register', null, {
      fullName: 'E2E Peer',
      email: `e2e_b_${ts}@example.com`,
      password: 'Password123!',
      businessName: 'Peer Co',
    });
    assert.equal(regB.status, 201);
    const tokenB = regB.data.data.token;
    userIds.push(regB.data.data.user.id);

    // Phase 3: Customers & isolation
    const custA = await reqJson(baseUrl, 'POST', '/customers', tokenA, {
      name: 'Horizon Labs',
      companyName: 'Horizon Pvt Ltd',
      email: '',
    });
    assert.equal(custA.status, 201);
    const customerId = custA.data.data.id;

    const crossCust = await reqJson(baseUrl, 'GET', `/customers/${customerId}`, tokenB);
    assert.equal(crossCust.status, 404);

    // Phase 4 & 5: Invoice math + PDF binary
    const today = new Date();
    const pastDate = new Date(today.getTime() - 5 * 86400000).toISOString().slice(0, 10);
    const futureDate = new Date(today.getTime() + 10 * 86400000).toISOString().slice(0, 10);
    const todayStr = today.toISOString().slice(0, 10);

    // Creating a Sent invoice for customer without email triggers a FAILED automation log
    const inv1 = await reqJson(baseUrl, 'POST', '/invoices', tokenA, {
      customerId,
      issueDate: pastDate,
      dueDate: pastDate,
      status: 'Sent',
      items: [{ description: 'Advisory Retainer', quantity: 2, unitPrice: 500 }],
    });
    assert.equal(inv1.status, 201);
    assert.equal(Number(inv1.data.data.grandTotal), 1000);
    assert.equal(inv1.data.data.invoiceNumber, 'INV-0001');
    const inv1Id = inv1.data.data.id;

    const crossInv = await reqJson(baseUrl, 'GET', `/invoices/${inv1Id}`, tokenB);
    assert.equal(crossInv.status, 404);

    const pdfRes = await reqJson(baseUrl, 'GET', `/invoices/${inv1Id}/pdf`, tokenA);
    assert.equal(pdfRes.status, 200);
    const pdfPrefix = Buffer.from(pdfRes.data).subarray(0, 5).toString('utf8');
    assert.equal(pdfPrefix, '%PDF-');

    // Phase 6: Partial payment, overpayment block, final payment
    const partialPay = await reqJson(baseUrl, 'POST', '/payments', tokenA, {
      invoiceId: inv1Id,
      amount: 400,
      paymentDate: todayStr,
      paymentMethod: 'Bank Transfer',
    });
    assert.equal(partialPay.status, 201);
    assert.equal(partialPay.data.data.invoice.status, 'Partially Paid');
    assert.equal(Number(partialPay.data.data.invoice.remainingBalance), 600);

    const overPay = await reqJson(baseUrl, 'POST', '/payments', tokenA, {
      invoiceId: inv1Id,
      amount: 700,
      paymentDate: todayStr,
      paymentMethod: 'Cash',
    });
    assert.equal(overPay.status, 400);

    // Phase 8, 9, 10: Automation failures, safe retry, and scheduled checks
    const execsBefore = await reqJson(
      baseUrl,
      'GET',
      '/automation/executions?status=FAILED',
      tokenA
    );
    assert.equal(execsBefore.status, 200);
    assert.ok(execsBefore.data.data.length >= 1);
    const failedExecId = execsBefore.data.data[0].id;

    // Fix customer email, retry FAILED execution, then verify duplicate retry is rejected
    const fixCust = await reqJson(baseUrl, 'PUT', `/customers/${customerId}`, tokenA, {
      name: 'Horizon Labs',
      companyName: 'Horizon Pvt Ltd',
      email: 'finance@horizonlabs.test',
    });
    assert.equal(fixCust.status, 200);

    const retryOk = await reqJson(
      baseUrl,
      'POST',
      `/automation/executions/${failedExecId}/retry`,
      tokenA
    );
    assert.equal(retryOk.status, 200);

    const retryDup = await reqJson(
      baseUrl,
      'POST',
      `/automation/executions/${failedExecId}/retry`,
      tokenA
    );
    assert.equal(retryDup.status, 409);

    // Create a second due-soon invoice and trigger scheduler manually
    const inv2 = await reqJson(baseUrl, 'POST', '/invoices', tokenA, {
      customerId,
      issueDate: todayStr,
      dueDate: futureDate,
      status: 'Sent',
      items: [{ description: 'Architecture Review', quantity: 1, unitPrice: 500 }],
    });
    assert.equal(inv2.status, 201);
    assert.equal(inv2.data.data.invoiceNumber, 'INV-0002');

    const checks = await reqJson(baseUrl, 'POST', '/automation/run-checks', tokenA);
    assert.equal(checks.status, 200);

    // Complete payment on inv1
    const finalPay = await reqJson(baseUrl, 'POST', '/payments', tokenA, {
      invoiceId: inv1Id,
      amount: 600,
      paymentDate: todayStr,
      paymentMethod: 'Card',
    });
    assert.equal(finalPay.status, 201);
    assert.equal(finalPay.data.data.invoice.status, 'Paid');

    // Phase 7: Email activity log check
    const emailLogs = await reqJson(baseUrl, 'GET', '/emails/logs', tokenA);
    assert.equal(emailLogs.status, 200);
    assert.ok(emailLogs.data.data.logs.length >= 1);

    // Phase 11: Reports & CSV check
    const dash = await reqJson(baseUrl, 'GET', '/reports/dashboard', tokenA);
    assert.equal(dash.status, 200);
    assert.equal(dash.data.data.kpis.totalBilled, '1500.00');
    assert.equal(dash.data.data.kpis.totalCollected, '1000.00');

    const csvRes = await reqJson(baseUrl, 'GET', '/reports/export.csv?months=6', tokenA);
    assert.equal(csvRes.status, 200);
    const csvText = Buffer.from(csvRes.data).toString('utf8');
    assert.match(csvText, /Invoice Number/);
    assert.match(csvText, /INV-0001/);
    assert.match(csvText, /1000\.00/);

    console.log('ALL_12_PHASES_E2E_PASSED');
  } finally {
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
