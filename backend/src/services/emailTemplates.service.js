/**
 * HTML-escape user-supplied strings before embedding in HTML emails.
 */
function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatMoney(invoice, value) {
  const currency = invoice.business?.currencySymbol || 'Rs.';
  return `${currency} ${Number(value || 0).toFixed(2)}`;
}

function wrapEmailLayout({ accentColor, badgeText, title, bodyHtml, invoice }) {
  const businessName = escapeHtml(invoice.business?.businessName || 'InvoiceFlow');
  const instructions = invoice.paymentInstructions
    ? `<div style="margin-top:16px;padding:12px 14px;background:#F8FAFC;border:1px solid #E2E8F0;border-radius:8px;">
         <p style="margin:0 0 4px;font-size:12px;font-weight:700;color:#475569;text-transform:uppercase;">Payment Instructions</p>
         <p style="margin:0;font-size:13px;color:#334155;white-space:pre-line;">${escapeHtml(invoice.paymentInstructions)}</p>
       </div>`
    : '';

  return `
    <div style="font-family:Arial,Helvetica,sans-serif;background:#F1F5F9;padding:24px;">
      <div style="max-width:600px;margin:0 auto;background:#FFFFFF;border:1px solid #E2E8F0;border-radius:12px;overflow:hidden;">
        <div style="background:#0F172A;padding:20px 24px;color:#FFFFFF;">
          <span style="display:inline-block;padding:3px 10px;border-radius:999px;font-size:11px;font-weight:700;background:${accentColor};color:#FFFFFF;">${escapeHtml(badgeText)}</span>
          <h1 style="margin:10px 0 0;font-size:20px;">${escapeHtml(title)}</h1>
          <p style="margin:4px 0 0;font-size:13px;color:#CBD5E1;">From ${businessName}</p>
        </div>
        <div style="padding:24px;color:#1E293B;font-size:14px;line-height:1.6;">
          ${bodyHtml}
          <table style="width:100%;border-collapse:collapse;margin-top:16px;font-size:13px;">
            <tr>
              <td style="padding:8px 0;border-bottom:1px solid #E2E8F0;color:#64748B;">Invoice Number</td>
              <td style="padding:8px 0;border-bottom:1px solid #E2E8F0;text-align:right;font-weight:700;">${escapeHtml(invoice.invoiceNumber)}</td>
            </tr>
            <tr>
              <td style="padding:8px 0;border-bottom:1px solid #E2E8F0;color:#64748B;">Due Date</td>
              <td style="padding:8px 0;border-bottom:1px solid #E2E8F0;text-align:right;font-weight:600;">${escapeHtml(invoice.dueDate)}</td>
            </tr>
            <tr>
              <td style="padding:8px 0;border-bottom:1px solid #E2E8F0;color:#64748B;">Invoice Total</td>
              <td style="padding:8px 0;border-bottom:1px solid #E2E8F0;text-align:right;">${escapeHtml(formatMoney(invoice, invoice.grandTotal))}</td>
            </tr>
            <tr>
              <td style="padding:8px 0;color:#0F172A;font-weight:700;">Outstanding Balance</td>
              <td style="padding:8px 0;text-align:right;color:#0D9488;font-weight:700;">${escapeHtml(formatMoney(invoice, invoice.remainingBalance))}</td>
            </tr>
          </table>
          ${instructions}
        </div>
      </div>
    </div>
  `;
}

function buildNewInvoiceEmail(invoice) {
  const customerName = invoice.customer?.name || 'Customer';
  const businessName = invoice.business?.businessName || 'InvoiceFlow';
  const outstanding = formatMoney(invoice, invoice.remainingBalance);

  const subject = `Invoice ${invoice.invoiceNumber} from ${businessName}`;
  const text = [
    `Hello ${customerName},`,
    '',
    `Please find attached invoice ${invoice.invoiceNumber} from ${businessName}.`,
    `Outstanding Amount: ${outstanding}`,
    `Due Date: ${invoice.dueDate}`,
    invoice.paymentInstructions ? `Payment Instructions: ${invoice.paymentInstructions}` : '',
    '',
    'Thank you for your business.',
  ]
    .filter(Boolean)
    .join('\n');

  const html = wrapEmailLayout({
    accentColor: '#0D9488',
    badgeText: 'New Invoice',
    title: `Invoice ${invoice.invoiceNumber}`,
    invoice,
    bodyHtml: `
      <p style="margin:0 0 12px;">Hello <strong>${escapeHtml(customerName)}</strong>,</p>
      <p style="margin:0;">Please find your invoice <strong>${escapeHtml(invoice.invoiceNumber)}</strong> attached as a PDF document. Kindly arrange payment on or before <strong>${escapeHtml(invoice.dueDate)}</strong>.</p>
    `,
  });

  return { templateName: 'NEW_INVOICE', subject, text, html };
}

function buildPaymentReminderEmail(invoice) {
  const customerName = invoice.customer?.name || 'Customer';
  const businessName = invoice.business?.businessName || 'InvoiceFlow';
  const outstanding = formatMoney(invoice, invoice.remainingBalance);

  const subject = `Payment Reminder: Invoice ${invoice.invoiceNumber} due on ${invoice.dueDate}`;
  const text = [
    `Hello ${customerName},`,
    '',
    `This is a friendly reminder from ${businessName} that invoice ${invoice.invoiceNumber} is due on ${invoice.dueDate}.`,
    `Outstanding Amount: ${outstanding}`,
    invoice.paymentInstructions ? `Payment Instructions: ${invoice.paymentInstructions}` : '',
    '',
    'Please disregard this message if you have already completed payment.',
  ]
    .filter(Boolean)
    .join('\n');

  const html = wrapEmailLayout({
    accentColor: '#D97706',
    badgeText: 'Payment Reminder',
    title: `Upcoming Due Date: ${invoice.invoiceNumber}`,
    invoice,
    bodyHtml: `
      <p style="margin:0 0 12px;">Hello <strong>${escapeHtml(customerName)}</strong>,</p>
      <p style="margin:0;">This is a friendly reminder that invoice <strong>${escapeHtml(invoice.invoiceNumber)}</strong> has an upcoming payment deadline on <strong>${escapeHtml(invoice.dueDate)}</strong>.</p>
    `,
  });

  return { templateName: 'PAYMENT_REMINDER', subject, text, html };
}

function buildOverdueNoticeEmail(invoice) {
  const customerName = invoice.customer?.name || 'Customer';
  const businessName = invoice.business?.businessName || 'InvoiceFlow';
  const outstanding = formatMoney(invoice, invoice.remainingBalance);

  const subject = `Overdue Notice: Invoice ${invoice.invoiceNumber} (${outstanding} due)`;
  const text = [
    `Hello ${customerName},`,
    '',
    `Invoice ${invoice.invoiceNumber} from ${businessName} was due on ${invoice.dueDate} and is now overdue.`,
    `Outstanding Amount: ${outstanding}`,
    invoice.paymentInstructions ? `Payment Instructions: ${invoice.paymentInstructions}` : '',
    '',
    'Please settle the remaining balance at your earliest convenience.',
  ]
    .filter(Boolean)
    .join('\n');

  const html = wrapEmailLayout({
    accentColor: '#DC2626',
    badgeText: 'Overdue Notice',
    title: `Invoice ${invoice.invoiceNumber} is Overdue`,
    invoice,
    bodyHtml: `
      <p style="margin:0 0 12px;">Hello <strong>${escapeHtml(customerName)}</strong>,</p>
      <p style="margin:0;">Our records indicate that invoice <strong>${escapeHtml(invoice.invoiceNumber)}</strong> passed its due date (<strong>${escapeHtml(invoice.dueDate)}</strong>) and still carries an unpaid balance.</p>
    `,
  });

  return { templateName: 'OVERDUE_NOTICE', subject, text, html };
}

function buildPaymentConfirmationEmail(invoice, payment) {
  const customerName = invoice.customer?.name || 'Customer';
  const businessName = invoice.business?.businessName || 'InvoiceFlow';
  const paidAmt = formatMoney(invoice, payment.amount);
  const outstanding = formatMoney(invoice, invoice.remainingBalance);

  const subject = `Payment Received for Invoice ${invoice.invoiceNumber}`;
  const text = [
    `Hello ${customerName},`,
    '',
    `Thank you! ${businessName} has received your payment of ${paidAmt} on ${payment.paymentDate} (${payment.paymentMethod}).`,
    `Invoice Number: ${invoice.invoiceNumber}`,
    `Remaining Balance: ${outstanding}`,
    `Invoice Status: ${invoice.status}`,
    invoice.paymentInstructions && invoice.remainingBalance > 0
      ? `Payment Instructions: ${invoice.paymentInstructions}`
      : '',
  ]
    .filter(Boolean)
    .join('\n');

  const html = wrapEmailLayout({
    accentColor: '#059669',
    badgeText: 'Payment Confirmation',
    title: `Payment Received (${paidAmt})`,
    invoice,
    bodyHtml: `
      <p style="margin:0 0 12px;">Hello <strong>${escapeHtml(customerName)}</strong>,</p>
      <p style="margin:0;">Thank you! We have recorded your payment of <strong>${escapeHtml(paidAmt)}</strong> via <strong>${escapeHtml(payment.paymentMethod)}</strong> on <strong>${escapeHtml(payment.paymentDate)}</strong>. Current invoice status: <strong>${escapeHtml(invoice.status)}</strong>.</p>
    `,
  });

  return { templateName: 'PAYMENT_CONFIRMATION', subject, text, html };
}

module.exports = {
  escapeHtml,
  buildNewInvoiceEmail,
  buildPaymentReminderEmail,
  buildOverdueNoticeEmail,
  buildPaymentConfirmationEmail,
};

