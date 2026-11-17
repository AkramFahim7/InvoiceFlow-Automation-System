const ExcelJS = require('exceljs');

/**
 * Palette & Typography Tokens (Modern Clean Business Theme)
 */
const THEME = {
  fontName: 'Segoe UI',
  colors: {
    primaryNavy: '0F172A',
    secondarySlate: '334155',
    headerText: 'FFFFFF',
    borderLight: 'E2E8F0',
    zebraBg: 'F8FAFC',
    cardBg: 'F1F5F9',
    accentTeal: '0D9488',
    paidFill: 'D1FAE5',
    paidText: '065F46',
    partialFill: 'FEF3C7',
    partialText: '92400E',
    unpaidFill: 'FFE4E6',
    unpaidText: '9F1239',
    overdueFill: 'FEE2E2',
    overdueText: 'B91C1C',
  },
};

/**
 * Apply thin light border around a cell
 */
function applyCellBorder(cell, { top = 'thin', bottom = 'thin', left = 'thin', right = 'thin' } = {}) {
  cell.border = {
    top: top ? { style: top, color: { argb: THEME.colors.borderLight } } : undefined,
    bottom: bottom ? { style: bottom, color: { argb: THEME.colors.borderLight } } : undefined,
    left: left ? { style: left, color: { argb: THEME.colors.borderLight } } : undefined,
    right: right ? { style: right, color: { argb: THEME.colors.borderLight } } : undefined,
  };
}

/**
 * Format a Date or date string to YYYY-MM-DD
 */
function formatDate(val) {
  if (!val) return '';
  if (val instanceof Date) {
    return val.toISOString().slice(0, 10);
  }
  return String(val).slice(0, 10);
}

/**
 * Dynamically adjust column widths based on maximum content length + padding
 */
function autoFitColumns(worksheet, minWidth = 12) {
  worksheet.columns.forEach((col) => {
    let maxLen = minWidth;
    col.eachCell({ includeEmpty: false }, (cell) => {
      // Don't size based on merged header row 1 & 2
      if (cell.row <= 2) return;
      const text = cell.value ? String(cell.text || cell.value) : '';
      if (text.length > maxLen) {
        maxLen = text.length;
      }
    });
    col.width = Math.min(Math.max(maxLen + 3, minWidth), 45);
  });
}

/**
 * Generate a complete, professional Excel workbook with 4 worksheets:
 * 1. Invoice Tracker
 * 2. Dashboard Summary
 * 3. Overdue Invoices
 * 4. Payment Tracking
 */
async function generateInvoiceTrackerWorkbook({
  businessProfile,
  invoices = [],
  payments = [],
}) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'InvoiceFlow Automation System';
  workbook.lastModifiedBy = 'InvoiceFlow';
  workbook.created = new Date();
  workbook.modified = new Date();

  const businessName = businessProfile?.business_name || 'InvoiceFlow Business';
  const currencySymbol = businessProfile?.currency_symbol || 'Rs.';
  const currencyNumFmt = `"${currencySymbol} "#,##0.00;("${currencySymbol} "#,##0.00);"-"`;
  const exportDateStr = new Date().toISOString().slice(0, 10);

  // =========================================================================
  // SHEET 1: INVOICE TRACKER
  // =========================================================================
  const wsTracker = workbook.addWorksheet('Invoice Tracker', {
    views: [{ state: 'frozen', ySplit: 4, showGridLines: true }],
  });

  // Title section (Row 1-2)
  wsTracker.mergeCells('A1:P1');
  const titleCell = wsTracker.getCell('A1');
  titleCell.value = `${businessName.toUpperCase()} — INVOICE TRACKER`;
  titleCell.font = { name: THEME.fontName, size: 14, bold: true, color: { argb: THEME.colors.primaryNavy } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'left' };
  wsTracker.getRow(1).height = 26;

  wsTracker.mergeCells('A2:P2');
  const subtitleCell = wsTracker.getCell('A2');
  subtitleCell.value = `Export Date: ${exportDateStr} | Currency: ${currencySymbol} | Total Invoices: ${invoices.length}`;
  subtitleCell.font = { name: THEME.fontName, size: 9.5, italic: true, color: { argb: THEME.colors.secondarySlate } };
  subtitleCell.alignment = { vertical: 'middle', horizontal: 'left' };
  wsTracker.getRow(2).height = 18;

  // Empty separator row (Row 3)
  wsTracker.getRow(3).height = 8;

  // Table Headers (Row 4)
  const trackerColumns = [
    { header: 'Invoice ID', key: 'id', align: 'center' },
    { header: 'Invoice Number', key: 'invoiceNumber', align: 'left' },
    { header: 'Customer Name', key: 'customerName', align: 'left' },
    { header: 'Customer Email', key: 'customerEmail', align: 'left' },
    { header: 'Invoice Date', key: 'issueDate', align: 'center' },
    { header: 'Due Date', key: 'dueDate', align: 'center' },
    { header: 'Subtotal', key: 'subtotal', align: 'right', isCurrency: true },
    { header: 'Tax', key: 'tax', align: 'right', isCurrency: true },
    { header: 'Discount', key: 'discount', align: 'right', isCurrency: true },
    { header: 'Total Amount', key: 'totalAmount', align: 'right', isCurrency: true },
    { header: 'Amount Paid', key: 'amountPaid', align: 'right', isCurrency: true },
    { header: 'Balance Due', key: 'balanceDue', align: 'right', isCurrency: true },
    { header: 'Payment Status', key: 'paymentStatus', align: 'center' },
    { header: 'Invoice Status', key: 'invoiceStatus', align: 'center' },
    { header: 'Days Overdue', key: 'daysOverdue', align: 'right' },
    { header: 'Notes', key: 'notes', align: 'left' },
  ];

  const headerRow = wsTracker.getRow(4);
  headerRow.height = 26;
  trackerColumns.forEach((col, idx) => {
    const cell = headerRow.getCell(idx + 1);
    cell.value = col.header;
    cell.font = { name: THEME.fontName, size: 10, bold: true, color: { argb: THEME.colors.headerText } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: THEME.colors.primaryNavy } };
    cell.alignment = { vertical: 'middle', horizontal: col.align };
    applyCellBorder(cell);
  });

  // Enable AutoFilter on header row
  wsTracker.autoFilter = { from: 'A4', to: 'P4' };

  // Data Rows (Row 5 to N)
  let trackerDataStartRow = 5;
  let trackerDataEndRow = 4;

  if (invoices.length === 0) {
    const emptyRow = wsTracker.getRow(5);
    emptyRow.getCell(1).value = 'No invoice records found in this account.';
    emptyRow.getCell(1).font = { name: THEME.fontName, italic: true, color: { argb: '64748B' } };
    wsTracker.mergeCells('A5:P5');
    emptyRow.height = 22;
    trackerDataEndRow = 5;
  } else {
    invoices.forEach((inv, i) => {
      const rowIndex = trackerDataStartRow + i;
      const row = wsTracker.getRow(rowIndex);
      row.height = 20;
      const isZebra = i % 2 === 1;

      const values = [
        inv.id,
        inv.invoiceNumber,
        inv.customerName,
        inv.customerEmail,
        formatDate(inv.issueDate),
        formatDate(inv.dueDate),
        Number(inv.subtotal || 0),
        Number(inv.tax || 0),
        Number(inv.discount || 0),
        Number(inv.totalAmount || 0),
        Number(inv.amountPaid || 0),
        Number(inv.balanceDue || 0),
        inv.paymentStatus,
        inv.invoiceStatus,
        Number(inv.daysOverdue || 0),
        inv.notes,
      ];

      values.forEach((val, colIdx) => {
        const cell = row.getCell(colIdx + 1);
        cell.value = val;
        cell.font = { name: THEME.fontName, size: 10 };
        cell.alignment = { vertical: 'middle', horizontal: trackerColumns[colIdx].align };

        if (isZebra) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: THEME.colors.zebraBg } };
        }

        if (trackerColumns[colIdx].isCurrency) {
          cell.numFmt = currencyNumFmt;
        }

        // Highlight Days Overdue if > 0
        if (trackerColumns[colIdx].key === 'daysOverdue' && Number(val) > 0) {
          cell.font = { name: THEME.fontName, size: 10, bold: true, color: { argb: THEME.colors.overdueText } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: THEME.colors.overdueFill } };
        }

        // Color badge for Payment Status
        if (trackerColumns[colIdx].key === 'paymentStatus') {
          cell.font = { name: THEME.fontName, size: 9.5, bold: true };
          if (val === 'Paid') {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: THEME.colors.paidFill } };
            cell.font.color = { argb: THEME.colors.paidText };
          } else if (val === 'Partially Paid') {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: THEME.colors.partialFill } };
            cell.font.color = { argb: THEME.colors.partialText };
          } else {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: THEME.colors.unpaidFill } };
            cell.font.color = { argb: THEME.colors.unpaidText };
          }
        }

        applyCellBorder(cell);
      });
    });

    trackerDataEndRow = trackerDataStartRow + invoices.length - 1;

    // Totals / Accounting Summary Row
    const totalRowIndex = trackerDataEndRow + 1;
    const totalRow = wsTracker.getRow(totalRowIndex);
    totalRow.height = 24;

    totalRow.getCell(1).value = 'TOTAL';
    totalRow.getCell(1).font = { name: THEME.fontName, size: 10, bold: true, color: { argb: THEME.colors.primaryNavy } };
    totalRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
    wsTracker.mergeCells(`A${totalRowIndex}:F${totalRowIndex}`);

    // Formulas for monetary columns: G=Subtotal, H=Tax, I=Discount, J=Total, K=Paid, L=Balance
    const formulaCols = [
      { col: 7, letter: 'G' },
      { col: 8, letter: 'H' },
      { col: 9, letter: 'I' },
      { col: 10, letter: 'J' },
      { col: 11, letter: 'K' },
      { col: 12, letter: 'L' },
    ];

    formulaCols.forEach(({ col, letter }) => {
      const cell = totalRow.getCell(col);
      cell.value = { formula: `SUM(${letter}${trackerDataStartRow}:${letter}${trackerDataEndRow})` };
      cell.numFmt = currencyNumFmt;
      cell.font = { name: THEME.fontName, size: 10, bold: true, color: { argb: THEME.colors.primaryNavy } };
      cell.alignment = { vertical: 'middle', horizontal: 'right' };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E2E8F0' } };
      cell.border = {
        top: { style: 'thin', color: { argb: THEME.colors.primaryNavy } },
        bottom: { style: 'double', color: { argb: THEME.colors.primaryNavy } },
        left: { style: 'thin', color: { argb: THEME.colors.borderLight } },
        right: { style: 'thin', color: { argb: THEME.colors.borderLight } },
      };
    });

    // Borders for remaining empty summary cells
    for (let c = 13; c <= 16; c += 1) {
      const cell = totalRow.getCell(c);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E2E8F0' } };
      cell.border = {
        top: { style: 'thin', color: { argb: THEME.colors.primaryNavy } },
        bottom: { style: 'double', color: { argb: THEME.colors.primaryNavy } },
        left: { style: 'thin', color: { argb: THEME.colors.borderLight } },
        right: { style: 'thin', color: { argb: THEME.colors.borderLight } },
      };
    }
  }

  autoFitColumns(wsTracker, 12);

  // =========================================================================
  // SHEET 2: DASHBOARD SUMMARY
  // =========================================================================
  const wsSummary = workbook.addWorksheet('Dashboard Summary', {
    views: [{ showGridLines: true }],
  });

  // Title
  wsSummary.mergeCells('B2:G2');
  const sumTitle = wsSummary.getCell('B2');
  sumTitle.value = `${businessName.toUpperCase()} — FINANCIAL EXECUTIVE SUMMARY`;
  sumTitle.font = { name: THEME.fontName, size: 14, bold: true, color: { argb: THEME.colors.primaryNavy } };
  sumTitle.alignment = { vertical: 'middle', horizontal: 'left' };
  wsSummary.getRow(2).height = 28;

  wsSummary.mergeCells('B3:G3');
  const sumSub = wsSummary.getCell('B3');
  sumSub.value = `Live summary generated on ${exportDateStr} | Linked directly to Invoice Tracker formulas`;
  sumSub.font = { name: THEME.fontName, size: 9.5, italic: true, color: { argb: THEME.colors.secondarySlate } };
  wsSummary.getRow(3).height = 18;

  // KPI Callout Cards (Row 5 - Row 7)
  const kpiCards = [
    {
      colStart: 'B',
      colEnd: 'C',
      label: 'TOTAL BILLED',
      formula: invoices.length > 0 ? `'Invoice Tracker'!J${trackerDataEndRow + 1}` : 0,
      isCurrency: true,
      accent: THEME.colors.primaryNavy,
    },
    {
      colStart: 'D',
      colEnd: 'E',
      label: 'TOTAL COLLECTED',
      formula: invoices.length > 0 ? `'Invoice Tracker'!K${trackerDataEndRow + 1}` : 0,
      isCurrency: true,
      accent: '059669', // Emerald
    },
    {
      colStart: 'F',
      colEnd: 'G',
      label: 'OUTSTANDING BALANCE',
      formula: invoices.length > 0 ? `'Invoice Tracker'!L${trackerDataEndRow + 1}` : 0,
      isCurrency: true,
      accent: 'D97706', // Amber
    },
  ];

  kpiCards.forEach((card) => {
    // Label Row 5
    wsSummary.mergeCells(`${card.colStart}5:${card.colEnd}5`);
    const lblCell = wsSummary.getCell(`${card.colStart}5`);
    lblCell.value = card.label;
    lblCell.font = { name: THEME.fontName, size: 9, bold: true, color: { argb: '64748B' } };
    lblCell.alignment = { horizontal: 'center', vertical: 'middle' };
    lblCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: THEME.colors.cardBg } };

    // Value Row 6
    wsSummary.mergeCells(`${card.colStart}6:${card.colEnd}6`);
    const valCell = wsSummary.getCell(`${card.colStart}6`);
    if (typeof card.formula === 'number') {
      valCell.value = card.formula;
    } else {
      valCell.value = { formula: card.formula };
    }
    valCell.font = { name: THEME.fontName, size: 16, bold: true, color: { argb: card.accent } };
    valCell.alignment = { horizontal: 'center', vertical: 'middle' };
    valCell.numFmt = currencyNumFmt;
    valCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: THEME.colors.cardBg } };

    // Border box
    [`${card.colStart}5`, `${card.colEnd}5`, `${card.colStart}6`, `${card.colEnd}6`].forEach((ref) => {
      applyCellBorder(wsSummary.getCell(ref));
    });
  });
  wsSummary.getRow(5).height = 18;
  wsSummary.getRow(6).height = 32;

  // Breakdown Section Header (Row 9)
  wsSummary.mergeCells('B9:D9');
  const tblHdr = wsSummary.getCell('B9');
  tblHdr.value = 'Invoice Portfolio Metrics';
  tblHdr.font = { name: THEME.fontName, size: 11, bold: true, color: { argb: THEME.colors.primaryNavy } };

  wsSummary.getRow(10).height = 24;
  wsSummary.getCell('B10').value = 'Metric Description';
  wsSummary.getCell('C10').value = 'Formula / Source';
  wsSummary.getCell('D10').value = 'Value';

  ['B10', 'C10', 'D10'].forEach((ref) => {
    const c = wsSummary.getCell(ref);
    c.font = { name: THEME.fontName, size: 10, bold: true, color: { argb: THEME.colors.headerText } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: THEME.colors.primaryNavy } };
    c.alignment = { vertical: 'middle', horizontal: ref === 'D10' ? 'right' : 'left' };
    applyCellBorder(c);
  });

  const summaryMetrics = [
    {
      desc: 'Total Invoice Count',
      src: "COUNTA('Invoice Tracker'!B5:B...)",
      formula: invoices.length > 0 ? `COUNTA('Invoice Tracker'!B${trackerDataStartRow}:B${trackerDataEndRow})` : 0,
      isNum: true,
    },
    {
      desc: 'Paid Invoices',
      src: "COUNTIF('Invoice Tracker'!M5:M..., \"Paid\")",
      formula: invoices.length > 0 ? `COUNTIF('Invoice Tracker'!M${trackerDataStartRow}:M${trackerDataEndRow}, "Paid")` : 0,
      isNum: true,
      color: THEME.colors.paidText,
    },
    {
      desc: 'Partially Paid Invoices',
      src: "COUNTIF('Invoice Tracker'!M5:M..., \"Partially Paid\")",
      formula: invoices.length > 0 ? `COUNTIF('Invoice Tracker'!M${trackerDataStartRow}:M${trackerDataEndRow}, "Partially Paid")` : 0,
      isNum: true,
      color: THEME.colors.partialText,
    },
    {
      desc: 'Unpaid Invoices',
      src: "COUNTIF('Invoice Tracker'!M5:M..., \"Unpaid\")",
      formula: invoices.length > 0 ? `COUNTIF('Invoice Tracker'!M${trackerDataStartRow}:M${trackerDataEndRow}, "Unpaid")` : 0,
      isNum: true,
      color: THEME.colors.unpaidText,
    },
    {
      desc: 'Overdue Invoices (Outstanding & Past Due)',
      src: "COUNTIF('Invoice Tracker'!O5:O..., \">0\")",
      formula: invoices.length > 0 ? `COUNTIF('Invoice Tracker'!O${trackerDataStartRow}:O${trackerDataEndRow}, ">0")` : 0,
      isNum: true,
      color: THEME.colors.overdueText,
    },
    {
      desc: 'Collection Rate (%)',
      src: 'Total Collected / Total Billed',
      formula: invoices.length > 0 ? `IF(D6>0, (E6/D6), 0)` : 0,
      isPercent: true,
    },
  ];

  summaryMetrics.forEach((m, idx) => {
    const rIdx = 11 + idx;
    const row = wsSummary.getRow(rIdx);
    row.height = 20;

    const cDesc = row.getCell(2);
    cDesc.value = m.desc;
    cDesc.font = { name: THEME.fontName, size: 10, bold: idx === 5 };
    applyCellBorder(cDesc);

    const cSrc = row.getCell(3);
    cSrc.value = m.src;
    cSrc.font = { name: 'Consolas', size: 9, color: { argb: '64748B' } };
    applyCellBorder(cSrc);

    const cVal = row.getCell(4);
    if (typeof m.formula === 'number') {
      cVal.value = m.formula;
    } else {
      cVal.value = { formula: m.formula };
    }
    cVal.font = { name: THEME.fontName, size: 10, bold: true, color: m.color ? { argb: m.color } : undefined };
    cVal.alignment = { horizontal: 'right', vertical: 'middle' };

    if (m.isPercent) {
      cVal.numFmt = '0.0%';
    } else if (m.isNum) {
      cVal.numFmt = '#,##0';
    }
    applyCellBorder(cVal);
  });

  wsSummary.getColumn(1).width = 4;
  wsSummary.getColumn(2).width = 34;
  wsSummary.getColumn(3).width = 38;
  wsSummary.getColumn(4).width = 16;
  wsSummary.getColumn(5).width = 16;
  wsSummary.getColumn(6).width = 16;
  wsSummary.getColumn(7).width = 16;

  // =========================================================================
  // SHEET 3: OVERDUE INVOICES
  // =========================================================================
  const wsOverdue = workbook.addWorksheet('Overdue Invoices', {
    views: [{ state: 'frozen', ySplit: 4, showGridLines: true }],
  });

  const overdueInvoices = invoices.filter(
    (inv) => Number(inv.daysOverdue) > 0 && Number(inv.balanceDue) > 0
  );

  // Title
  wsOverdue.mergeCells('A1:I1');
  const odTitle = wsOverdue.getCell('A1');
  odTitle.value = `${businessName.toUpperCase()} — OVERDUE RECEIVABLES WATCHLIST`;
  odTitle.font = { name: THEME.fontName, size: 13, bold: true, color: { argb: '991B1B' } };
  odTitle.alignment = { vertical: 'middle', horizontal: 'left' };
  wsOverdue.getRow(1).height = 26;

  wsOverdue.mergeCells('A2:I2');
  const odSub = wsOverdue.getCell('A2');
  odSub.value = `Overdue Count: ${overdueInvoices.length} invoices requiring urgent collection`;
  odSub.font = { name: THEME.fontName, size: 9.5, italic: true, color: { argb: THEME.colors.secondarySlate } };
  wsOverdue.getRow(2).height = 18;

  wsOverdue.getRow(3).height = 8;

  const overdueHeaders = [
    { header: 'Invoice Number', align: 'left' },
    { header: 'Customer Name', align: 'left' },
    { header: 'Customer Email', align: 'left' },
    { header: 'Invoice Date', align: 'center' },
    { header: 'Due Date', align: 'center' },
    { header: 'Total Amount', align: 'right', isCurrency: true },
    { header: 'Amount Paid', align: 'right', isCurrency: true },
    { header: 'Balance Due', align: 'right', isCurrency: true },
    { header: 'Days Overdue', align: 'right' },
  ];

  const odHdrRow = wsOverdue.getRow(4);
  odHdrRow.height = 24;
  overdueHeaders.forEach((col, idx) => {
    const c = odHdrRow.getCell(idx + 1);
    c.value = col.header;
    c.font = { name: THEME.fontName, size: 10, bold: true, color: { argb: 'FFFFFF' } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '7F1D1D' } }; // Dark red
    c.alignment = { vertical: 'middle', horizontal: col.align };
    applyCellBorder(c);
  });
  wsOverdue.autoFilter = { from: 'A4', to: 'I4' };

  if (overdueInvoices.length === 0) {
    const emptyRow = wsOverdue.getRow(5);
    emptyRow.getCell(1).value = 'No overdue invoices. All accounts are up to date!';
    emptyRow.getCell(1).font = { name: THEME.fontName, italic: true, color: { argb: '047857' } };
    wsOverdue.mergeCells('A5:I5');
    emptyRow.height = 22;
  } else {
    overdueInvoices.forEach((inv, i) => {
      const row = wsOverdue.getRow(5 + i);
      row.height = 20;
      const isZebra = i % 2 === 1;

      const vals = [
        inv.invoiceNumber,
        inv.customerName,
        inv.customerEmail,
        formatDate(inv.issueDate),
        formatDate(inv.dueDate),
        Number(inv.totalAmount || 0),
        Number(inv.amountPaid || 0),
        Number(inv.balanceDue || 0),
        Number(inv.daysOverdue || 0),
      ];

      vals.forEach((v, cIdx) => {
        const cell = row.getCell(cIdx + 1);
        cell.value = v;
        cell.font = { name: THEME.fontName, size: 10 };
        cell.alignment = { vertical: 'middle', horizontal: overdueHeaders[cIdx].align };

        if (isZebra) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: THEME.colors.zebraBg } };
        }

        if (overdueHeaders[cIdx].isCurrency) {
          cell.numFmt = currencyNumFmt;
        }

        if (cIdx === 7) {
          // Highlight Balance Due in bold red
          cell.font = { name: THEME.fontName, size: 10, bold: true, color: { argb: 'B91C1C' } };
        }
        if (cIdx === 8) {
          // Highlight Days Overdue badge
          cell.font = { name: THEME.fontName, size: 10, bold: true, color: { argb: '7F1D1D' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FEE2E2' } };
        }

        applyCellBorder(cell);
      });
    });

    // Overdue Totals Row
    const odEndRow = 4 + overdueInvoices.length;
    const odTotalRow = wsOverdue.getRow(odEndRow + 1);
    odTotalRow.height = 24;

    odTotalRow.getCell(1).value = 'TOTAL OVERDUE';
    odTotalRow.getCell(1).font = { name: THEME.fontName, size: 10, bold: true, color: { argb: '7F1D1D' } };
    wsOverdue.mergeCells(`A${odEndRow + 1}:E${odEndRow + 1}`);

    // F=Total, G=Paid, H=Balance Due
    ['F', 'G', 'H'].forEach((letter, idx) => {
      const colNum = 6 + idx;
      const cell = odTotalRow.getCell(colNum);
      cell.value = { formula: `SUM(${letter}5:${letter}${odEndRow})` };
      cell.numFmt = currencyNumFmt;
      cell.font = { name: THEME.fontName, size: 10, bold: true, color: { argb: '7F1D1D' } };
      cell.alignment = { vertical: 'middle', horizontal: 'right' };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FEE2E2' } };
      cell.border = {
        top: { style: 'thin', color: { argb: '7F1D1D' } },
        bottom: { style: 'double', color: { argb: '7F1D1D' } },
        left: { style: 'thin', color: { argb: THEME.colors.borderLight } },
        right: { style: 'thin', color: { argb: THEME.colors.borderLight } },
      };
    });

    const lastCell = odTotalRow.getCell(9);
    lastCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FEE2E2' } };
    lastCell.border = {
      top: { style: 'thin', color: { argb: '7F1D1D' } },
      bottom: { style: 'double', color: { argb: '7F1D1D' } },
    };
  }

  autoFitColumns(wsOverdue, 12);

  // =========================================================================
  // SHEET 4: PAYMENT TRACKING
  // =========================================================================
  const wsPayments = workbook.addWorksheet('Payment Tracking', {
    views: [{ state: 'frozen', ySplit: 4, showGridLines: true }],
  });

  // Title
  wsPayments.mergeCells('A1:H1');
  const payTitle = wsPayments.getCell('A1');
  payTitle.value = `${businessName.toUpperCase()} — PAYMENT TRANSACTION LEDGER`;
  payTitle.font = { name: THEME.fontName, size: 13, bold: true, color: { argb: '065F46' } };
  payTitle.alignment = { vertical: 'middle', horizontal: 'left' };
  wsPayments.getRow(1).height = 26;

  wsPayments.mergeCells('A2:H2');
  const paySub = wsPayments.getCell('A2');
  paySub.value = `Verified payment history: ${payments.length} transaction(s) recorded in database`;
  paySub.font = { name: THEME.fontName, size: 9.5, italic: true, color: { argb: THEME.colors.secondarySlate } };
  wsPayments.getRow(2).height = 18;

  wsPayments.getRow(3).height = 8;

  const paymentHeaders = [
    { header: 'Payment Date', align: 'center' },
    { header: 'Invoice Number', align: 'left' },
    { header: 'Customer Name', align: 'left' },
    { header: 'Payment Amount', align: 'right', isCurrency: true },
    { header: 'Payment Method', align: 'center' },
    { header: 'Transaction Reference', align: 'left' },
    { header: 'Remaining Balance', align: 'right', isCurrency: true },
    { header: 'Notes', align: 'left' },
  ];

  const payHdrRow = wsPayments.getRow(4);
  payHdrRow.height = 24;
  paymentHeaders.forEach((col, idx) => {
    const c = payHdrRow.getCell(idx + 1);
    c.value = col.header;
    c.font = { name: THEME.fontName, size: 10, bold: true, color: { argb: 'FFFFFF' } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '065F46' } }; // Dark emerald
    c.alignment = { vertical: 'middle', horizontal: col.align };
    applyCellBorder(c);
  });
  wsPayments.autoFilter = { from: 'A4', to: 'H4' };

  if (payments.length === 0) {
    const emptyRow = wsPayments.getRow(5);
    emptyRow.getCell(1).value = 'No payment transactions recorded yet.';
    emptyRow.getCell(1).font = { name: THEME.fontName, italic: true, color: { argb: '64748B' } };
    wsPayments.mergeCells('A5:H5');
    emptyRow.height = 22;
  } else {
    payments.forEach((p, i) => {
      const row = wsPayments.getRow(5 + i);
      row.height = 20;
      const isZebra = i % 2 === 1;

      const vals = [
        formatDate(p.paymentDate),
        p.invoiceNumber,
        p.customerName,
        Number(p.paymentAmount || 0),
        p.paymentMethod,
        p.referenceNumber || '',
        Number(p.remainingBalance || 0),
        p.notes || '',
      ];

      vals.forEach((v, cIdx) => {
        const cell = row.getCell(cIdx + 1);
        cell.value = v;
        cell.font = { name: THEME.fontName, size: 10 };
        cell.alignment = { vertical: 'middle', horizontal: paymentHeaders[cIdx].align };

        if (isZebra) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: THEME.colors.zebraBg } };
        }

        if (paymentHeaders[cIdx].isCurrency) {
          cell.numFmt = currencyNumFmt;
        }

        if (cIdx === 3) {
          cell.font = { name: THEME.fontName, size: 10, bold: true, color: { argb: '047857' } };
        }

        applyCellBorder(cell);
      });
    });

    const payEndRow = 4 + payments.length;
    const payTotalRow = wsPayments.getRow(payEndRow + 1);
    payTotalRow.height = 24;

    payTotalRow.getCell(1).value = 'TOTAL RECEIVED';
    payTotalRow.getCell(1).font = { name: THEME.fontName, size: 10, bold: true, color: { argb: '065F46' } };
    wsPayments.mergeCells(`A${payEndRow + 1}:C${payEndRow + 1}`);

    const totalAmtCell = payTotalRow.getCell(4);
    totalAmtCell.value = { formula: `SUM(D5:D${payEndRow})` };
    totalAmtCell.numFmt = currencyNumFmt;
    totalAmtCell.font = { name: THEME.fontName, size: 10, bold: true, color: { argb: '065F46' } };
    totalAmtCell.alignment = { vertical: 'middle', horizontal: 'right' };
    totalAmtCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: THEME.colors.paidFill } };
    totalAmtCell.border = {
      top: { style: 'thin', color: { argb: '065F46' } },
      bottom: { style: 'double', color: { argb: '065F46' } },
      left: { style: 'thin', color: { argb: THEME.colors.borderLight } },
      right: { style: 'thin', color: { argb: THEME.colors.borderLight } },
    };

    for (let c = 5; c <= 8; c += 1) {
      const cell = payTotalRow.getCell(c);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: THEME.colors.paidFill } };
      cell.border = {
        top: { style: 'thin', color: { argb: '065F46' } },
        bottom: { style: 'double', color: { argb: '065F46' } },
      };
    }
  }

  autoFitColumns(wsPayments, 12);

  return workbook.xlsx.writeBuffer();
}

module.exports = {
  generateInvoiceTrackerWorkbook,
};

