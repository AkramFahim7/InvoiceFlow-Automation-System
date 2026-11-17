const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

function formatMoney(currency, value) {
  return `${currency} ${Number(value || 0).toFixed(2)}`;
}

function getInitials(name) {
  const words = String(name || 'IF')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return 'IF';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

function resolveSafeLogoPath(logoUrl) {
  if (!logoUrl || typeof logoUrl !== 'string') return null;
  if (!logoUrl.startsWith('/uploads/logos/')) return null;

  const fileName = path.basename(logoUrl);
  const logosDir = path.resolve(__dirname, '../../uploads/logos');
  const fullPath = path.join(logosDir, fileName);
  if (fs.existsSync(fullPath)) {
    return fullPath;
  }
  return null;
}

/**
 * Render an invoice object (loaded from MySQL) into a professional PDF Buffer.
 * Reused both by GET /api/invoices/:id/pdf and automated email attachments.
 * @param {object} invoice
 * @returns {Promise<Buffer>}
 */
function generateInvoicePdfBuffer(invoice) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 48 });
    const chunks = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const currency = invoice.business?.currencySymbol || 'Rs.';
    const taxLabel = invoice.business?.taxLabel || 'Tax';
    const pageWidth = doc.page.width - 96; // 595.28 - 96 = 499.28

    // --- Top Navy Accent Bar ---
    doc.rect(0, 0, doc.page.width, 10).fill('#0F172A');

    // --- Header: Business Logo + Info (Left) & Invoice Meta (Right) ---
    let headerY = 44;
    const logoPath = resolveSafeLogoPath(invoice.business?.logoUrl);
    let logoRendered = false;

    if (logoPath) {
      try {
        doc.image(logoPath, 48, headerY, { fit: [52, 52] });
        logoRendered = true;
      } catch {
        logoRendered = false;
      }
    }

    if (!logoRendered) {
      doc.roundedRect(48, headerY, 44, 44, 8).fill('#0F172A');
      doc
        .fillColor('#14B8A6')
        .font('Helvetica-Bold')
        .fontSize(16)
        .text(getInitials(invoice.business?.businessName), 48, headerY + 14, {
          width: 44,
          align: 'center',
        });
    }

    const bizX = 108;
    doc
      .fillColor('#0F172A')
      .font('Helvetica-Bold')
      .fontSize(16)
      .text(invoice.business?.businessName || 'Business', bizX, headerY, {
        width: 240,
      });

    let bizCursorY = doc.y + 2;
    doc.font('Helvetica').fontSize(9.5).fillColor('#475569');
    if (invoice.business?.address) {
      doc.text(invoice.business.address, bizX, bizCursorY, { width: 240 });
      bizCursorY = doc.y + 1;
    }
    if (invoice.business?.businessEmail) {
      doc.text(invoice.business.businessEmail, bizX, bizCursorY, { width: 240 });
      bizCursorY = doc.y + 1;
    }
    if (invoice.business?.phone) {
      doc.text(invoice.business.phone, bizX, bizCursorY, { width: 240 });
      bizCursorY = doc.y + 1;
    }

    // Right side: INVOICE title & metadata
    doc
      .fillColor('#0F172A')
      .font('Helvetica-Bold')
      .fontSize(22)
      .text('INVOICE', 360, headerY, { width: 187, align: 'right' });

    doc
      .font('Helvetica-Bold')
      .fontSize(11)
      .fillColor('#0D9488')
      .text(invoice.invoiceNumber, 360, headerY + 26, {
        width: 187,
        align: 'right',
      });

    doc
      .font('Helvetica')
      .fontSize(9.5)
      .fillColor('#475569')
      .text(`Status: ${invoice.status}`, 360, headerY + 44, {
        width: 187,
        align: 'right',
      })
      .text(`Issue Date: ${invoice.issueDate}`, 360, headerY + 58, {
        width: 187,
        align: 'right',
      })
      .text(`Due Date: ${invoice.dueDate}`, 360, headerY + 72, {
        width: 187,
        align: 'right',
      });

    // Divider line below header
    let cursorY = Math.max(bizCursorY, headerY + 94) + 14;
    doc
      .moveTo(48, cursorY)
      .lineTo(48 + pageWidth, cursorY)
      .strokeColor('#E2E8F0')
      .lineWidth(1)
      .stroke();

    // --- Bill To Block ---
    cursorY += 16;
    doc
      .font('Helvetica-Bold')
      .fontSize(8.5)
      .fillColor('#64748B')
      .text('BILL TO', 48, cursorY);

    cursorY += 14;
    doc
      .font('Helvetica-Bold')
      .fontSize(11)
      .fillColor('#0F172A')
      .text(invoice.customer?.name || 'Customer', 48, cursorY);

    cursorY = doc.y + 2;
    doc.font('Helvetica').fontSize(9.5).fillColor('#475569');
    if (invoice.customer?.companyName) {
      doc.text(invoice.customer.companyName, 48, cursorY);
      cursorY = doc.y + 1;
    }
    if (invoice.customer?.email) {
      doc.text(invoice.customer.email, 48, cursorY);
      cursorY = doc.y + 1;
    }
    if (invoice.customer?.phone) {
      doc.text(invoice.customer.phone, 48, cursorY);
      cursorY = doc.y + 1;
    }
    if (invoice.customer?.billingAddress) {
      doc.text(invoice.customer.billingAddress, 48, cursorY, { width: 260 });
      cursorY = doc.y + 1;
    }

    // --- Line Items Table ---
    cursorY += 18;
    const drawTableHeader = (y) => {
      doc.rect(48, y, pageWidth, 24).fill('#0F172A');
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#FFFFFF');
      doc.text('DESCRIPTION', 58, y + 7, { width: 245 });
      doc.text('QTY', 308, y + 7, { width: 55, align: 'right' });
      doc.text('UNIT PRICE', 368, y + 7, { width: 85, align: 'right' });
      doc.text('TOTAL', 458, y + 7, { width: 80, align: 'right' });
      return y + 24;
    };

    cursorY = drawTableHeader(cursorY);

    invoice.items.forEach((item, idx) => {
      const descHeight = doc.heightOfString(item.description, { width: 245 });
      const rowHeight = Math.max(24, descHeight + 12);

      // Page break guard
      if (cursorY + rowHeight > doc.page.height - 170) {
        doc.addPage();
        cursorY = drawTableHeader(48);
      }

      if (idx % 2 === 1) {
        doc.rect(48, cursorY, pageWidth, rowHeight).fill('#F8FAFC');
      }

      doc.font('Helvetica').fontSize(9.5).fillColor('#1E293B');
      doc.text(item.description, 58, cursorY + 7, { width: 245 });
      doc.text(String(item.quantity), 308, cursorY + 7, {
        width: 55,
        align: 'right',
      });
      doc.text(formatMoney(currency, item.unitPrice), 368, cursorY + 7, {
        width: 85,
        align: 'right',
      });
      doc
        .font('Helvetica-Bold')
        .text(formatMoney(currency, item.lineTotal), 458, cursorY + 7, {
          width: 80,
          align: 'right',
        });

      cursorY += rowHeight;
      doc
        .moveTo(48, cursorY)
        .lineTo(48 + pageWidth, cursorY)
        .strokeColor('#E2E8F0')
        .lineWidth(0.5)
        .stroke();
    });

    // --- Totals Block ---
    if (cursorY > doc.page.height - 190) {
      doc.addPage();
      cursorY = 48;
    }

    cursorY += 18;
    const summaryLabelX = 330;
    const summaryValX = 435;
    const summaryValWidth = 103;

    const drawSummaryLine = (label, value, { bold = false, color = '#334155' } = {}) => {
      doc
        .font(bold ? 'Helvetica-Bold' : 'Helvetica')
        .fontSize(bold ? 10.5 : 9.5)
        .fillColor(color);
      doc.text(label, summaryLabelX, cursorY, { width: 100 });
      doc.text(value, summaryValX, cursorY, {
        width: summaryValWidth,
        align: 'right',
      });
      cursorY += bold ? 18 : 15;
    };

    drawSummaryLine('Subtotal', formatMoney(currency, invoice.subtotal));
    drawSummaryLine(
      'Discount',
      `- ${formatMoney(currency, invoice.discountAmount)}`
    );
    drawSummaryLine(
      `${taxLabel} (${invoice.taxRate}%)`,
      formatMoney(currency, invoice.taxAmount)
    );

    doc
      .moveTo(summaryLabelX, cursorY)
      .lineTo(48 + pageWidth, cursorY)
      .strokeColor('#CBD5E1')
      .lineWidth(1)
      .stroke();
    cursorY += 7;

    drawSummaryLine(
      'Grand Total',
      formatMoney(currency, invoice.grandTotal),
      { bold: true, color: '#0F172A' }
    );
    drawSummaryLine('Amount Paid', formatMoney(currency, invoice.amountPaid));
    drawSummaryLine(
      'Balance Due',
      formatMoney(currency, invoice.remainingBalance),
      { bold: true, color: '#0D9488' }
    );

    // --- Payment Instructions & Notes ---
    if (invoice.paymentInstructions || invoice.notes) {
      cursorY += 16;
      if (cursorY > doc.page.height - 110) {
        doc.addPage();
        cursorY = 48;
      }

      if (invoice.paymentInstructions) {
        doc
          .font('Helvetica-Bold')
          .fontSize(9)
          .fillColor('#0F172A')
          .text('Payment Instructions', 48, cursorY);
        cursorY = doc.y + 3;
        doc
          .font('Helvetica')
          .fontSize(9)
          .fillColor('#475569')
          .text(invoice.paymentInstructions, 48, cursorY, { width: pageWidth });
        cursorY = doc.y + 10;
      }

      if (invoice.notes) {
        doc
          .font('Helvetica-Bold')
          .fontSize(9)
          .fillColor('#0F172A')
          .text('Notes', 48, cursorY);
        cursorY = doc.y + 3;
        doc
          .font('Helvetica')
          .fontSize(9)
          .fillColor('#475569')
          .text(invoice.notes, 48, cursorY, { width: pageWidth });
      }
    }

    doc.end();
  });
}

module.exports = {
  generateInvoicePdfBuffer,
};

