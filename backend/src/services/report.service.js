const reportModel = require('../models/report.model');
const userModel = require('../models/user.model');
const excelExportService = require('./excelExport.service');
const AppError = require('../utils/appError');
const { toCents, centsToDecimal } = require('../utils/money');

const VALID_MONTH_WINDOWS = [3, 6, 12];
const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

function parseMonthWindow(rawMonths) {
  if (rawMonths === undefined || rawMonths === null || rawMonths === '') {
    return 6;
  }
  const parsed = Number(rawMonths);
  if (!VALID_MONTH_WINDOWS.includes(parsed)) {
    throw new AppError('months must be one of 3, 6, or 12.', 400);
  }
  return parsed;
}

/**
 * Format 'YYYY-MM' into human label like 'Nov 2026'.
 */
function formatMonthLabel(monthKey) {
  const [yearStr, monthStr] = monthKey.split('-');
  const monthIdx = Number(monthStr) - 1;
  const shortName = MONTH_NAMES[monthIdx] || monthStr;
  return `${shortName} ${yearStr}`;
}

/**
 * Compute start date ('YYYY-MM-01') for a trailing N-month window ending in refDate's month.
 */
function getWindowStartDate(months, refDate = new Date()) {
  const year = refDate.getFullYear();
  const monthIndex = refDate.getMonth(); // 0..11
  const start = new Date(year, monthIndex - (months - 1), 1);
  const y = start.getFullYear();
  const m = String(start.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}-01`;
}

/**
 * Merge sparse SQL month rows into a continuous array of N calendar months.
 */
function buildContinuousMonthSeries(
  months,
  invoicedRows,
  collectedRows,
  refDate = new Date()
) {
  const invoicedMap = new Map();
  for (const row of invoicedRows) {
    invoicedMap.set(row.month_key, {
      amountCents: toCents(row.total_amount),
      count: Number(row.invoice_count || 0),
    });
  }

  const collectedMap = new Map();
  for (const row of collectedRows) {
    collectedMap.set(row.month_key, {
      amountCents: toCents(row.total_amount),
      count: Number(row.payment_count || 0),
    });
  }

  const series = [];
  const baseYear = refDate.getFullYear();
  const baseMonth = refDate.getMonth();

  for (let offset = months - 1; offset >= 0; offset -= 1) {
    const d = new Date(baseYear, baseMonth - offset, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const inv = invoicedMap.get(key) || { amountCents: 0, count: 0 };
    const col = collectedMap.get(key) || { amountCents: 0, count: 0 };

    series.push({
      monthKey: key,
      label: formatMonthLabel(key),
      invoicedAmount: centsToDecimal(inv.amountCents),
      collectedAmount: centsToDecimal(col.amountCents),
      invoicedCents: inv.amountCents,
      collectedCents: col.amountCents,
      invoiceCount: inv.count,
      paymentCount: col.count,
    });
  }

  return series;
}

/**
 * Compute exact collection rate (%) and average non-cancelled invoice value.
 */
function computeCollectionMetrics(invoiceSummary) {
  const billedCents = toCents(invoiceSummary.totalBilled);
  const collectedCents = toCents(invoiceSummary.totalCollected);
  const activeInvoiceCount =
    invoiceSummary.totalInvoices - invoiceSummary.cancelledCount;

  const collectionRatePercent =
    billedCents > 0
      ? Number(((collectedCents * 100) / billedCents).toFixed(1))
      : 0;

  const avgInvoiceCents =
    activeInvoiceCount > 0
      ? Math.round(billedCents / activeInvoiceCount)
      : 0;

  return {
    collectionRatePercent,
    averageInvoiceValue: centsToDecimal(avgInvoiceCents),
    activeInvoiceCount,
  };
}

/**
 * Build status breakdown items for charts.
 */
function buildStatusBreakdown(invoiceSummary) {
  return [
    { status: 'Paid', count: invoiceSummary.paidCount },
    { status: 'Partially Paid', count: invoiceSummary.partiallyPaidCount },
    { status: 'Sent', count: invoiceSummary.sentCount },
    { status: 'Overdue', count: invoiceSummary.overdueCount },
    { status: 'Draft', count: invoiceSummary.draftCount },
    { status: 'Cancelled', count: invoiceSummary.cancelledCount },
  ];
}

/**
 * Escape CSV cell and neutralize leading formula characters (=, +, -, @, tab, CR).
 */
function escapeCsvCell(value) {
  let str = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

async function getDashboardAnalytics(userId) {
  const startDateStr = getWindowStartDate(6);

  const [
    invoiceSummary,
    customerCount,
    paymentSummary,
    monthlyRaw,
    overdueInvoices,
    automationHealth,
    recentActivity,
  ] = await Promise.all([
    reportModel.getInvoiceSummaryByUser(userId),
    reportModel.getCustomerCountByUser(userId),
    reportModel.getPaymentSummaryByUser(userId),
    reportModel.getMonthlySeriesRawByUser(userId, startDateStr),
    reportModel.getOverdueInvoicesByUser(userId, 5),
    reportModel.getAutomationAndEmailMetricsByUser(userId),
    reportModel.getRecentActivityByUser(userId, 5),
  ]);

  const metrics = computeCollectionMetrics(invoiceSummary);
  const monthlySeries = buildContinuousMonthSeries(
    6,
    monthlyRaw.invoicedRows,
    monthlyRaw.collectedRows
  );

  return {
    kpis: {
      totalBilled: invoiceSummary.totalBilled,
      totalCollected: invoiceSummary.totalCollected,
      totalOutstanding: invoiceSummary.totalOutstanding,
      overdueBalance: invoiceSummary.overdueBalance,
      overdueCount: invoiceSummary.overdueCount,
      totalInvoices: invoiceSummary.totalInvoices,
      activeCustomers: customerCount,
      totalPayments: paymentSummary.totalPayments,
      collectionRatePercent: metrics.collectionRatePercent,
      averageInvoiceValue: metrics.averageInvoiceValue,
    },
    statusBreakdown: buildStatusBreakdown(invoiceSummary),
    monthlySeries,
    overdueInvoices,
    automationHealth,
    recentInvoices: recentActivity.recentInvoices,
    recentPayments: recentActivity.recentPayments,
  };
}

async function getFullReports(userId, { months } = {}) {
  const windowMonths = parseMonthWindow(months);
  const startDateStr = getWindowStartDate(windowMonths);

  const [
    invoiceSummary,
    customerCount,
    paymentSummary,
    monthlyRaw,
    topCustomers,
    overdueInvoices,
    automationHealth,
  ] = await Promise.all([
    reportModel.getInvoiceSummaryByUser(userId),
    reportModel.getCustomerCountByUser(userId),
    reportModel.getPaymentSummaryByUser(userId),
    reportModel.getMonthlySeriesRawByUser(userId, startDateStr),
    reportModel.getTopCustomersByUser(userId, 8),
    reportModel.getOverdueInvoicesByUser(userId, 20),
    reportModel.getAutomationAndEmailMetricsByUser(userId),
  ]);

  const metrics = computeCollectionMetrics(invoiceSummary);
  const monthlySeries = buildContinuousMonthSeries(
    windowMonths,
    monthlyRaw.invoicedRows,
    monthlyRaw.collectedRows
  );

  return {
    windowMonths,
    kpis: {
      totalBilled: invoiceSummary.totalBilled,
      totalCollected: invoiceSummary.totalCollected,
      totalOutstanding: invoiceSummary.totalOutstanding,
      overdueBalance: invoiceSummary.overdueBalance,
      overdueCount: invoiceSummary.overdueCount,
      totalInvoices: invoiceSummary.totalInvoices,
      activeInvoiceCount: metrics.activeInvoiceCount,
      activeCustomers: customerCount,
      totalPayments: paymentSummary.totalPayments,
      collectionRatePercent: metrics.collectionRatePercent,
      averageInvoiceValue: metrics.averageInvoiceValue,
    },
    statusBreakdown: buildStatusBreakdown(invoiceSummary),
    monthlySeries,
    paymentMethods: paymentSummary.byMethod,
    topCustomers,
    overdueInvoices,
    automationHealth,
  };
}

/**
 * Export clean, structured tabular invoice tracker dataset in CSV format.
 * Prepends UTF-8 BOM (\uFEFF) for native compatibility with Microsoft Excel.
 */
async function exportReportsCsv(userId) {
  const invoices = await reportModel.getInvoiceTrackerRowsByUser(userId);

  const headers = [
    'Invoice ID',
    'Invoice Number',
    'Customer Name',
    'Customer Email',
    'Customer Company',
    'Invoice Date',
    'Due Date',
    'Subtotal',
    'Tax',
    'Discount',
    'Total Amount',
    'Amount Paid',
    'Balance Due',
    'Payment Status',
    'Invoice Status',
    'Days Overdue',
    'Notes',
  ];

  const lines = [headers.map(escapeCsvCell).join(',')];

  for (const inv of invoices) {
    const issueDateStr =
      inv.issueDate instanceof Date
        ? inv.issueDate.toISOString().slice(0, 10)
        : String(inv.issueDate || '').slice(0, 10);

    const dueDateStr =
      inv.dueDate instanceof Date
        ? inv.dueDate.toISOString().slice(0, 10)
        : String(inv.dueDate || '').slice(0, 10);

    const row = [
      inv.id,
      inv.invoiceNumber,
      inv.customerName,
      inv.customerEmail,
      inv.customerCompany,
      issueDateStr,
      dueDateStr,
      Number(inv.subtotal || 0).toFixed(2),
      Number(inv.tax || 0).toFixed(2),
      Number(inv.discount || 0).toFixed(2),
      Number(inv.totalAmount || 0).toFixed(2),
      Number(inv.amountPaid || 0).toFixed(2),
      Number(inv.balanceDue || 0).toFixed(2),
      inv.paymentStatus,
      inv.invoiceStatus,
      inv.daysOverdue,
      inv.notes,
    ];

    lines.push(row.map(escapeCsvCell).join(','));
  }

  // Prepend UTF-8 BOM for Microsoft Excel on Windows
  return '\uFEFF' + lines.join('\r\n');
}

/**
 * Generate a multi-sheet professional Excel invoice tracker workbook.
 */
async function exportReportsExcel(userId) {
  const [profile, invoices, payments] = await Promise.all([
    userModel.findProfileById(userId),
    reportModel.getInvoiceTrackerRowsByUser(userId),
    reportModel.getPaymentLedgerRowsByUser(userId),
  ]);

  return excelExportService.generateInvoiceTrackerWorkbook({
    businessProfile: profile,
    invoices,
    payments,
  });
}

module.exports = {
  parseMonthWindow,
  buildContinuousMonthSeries,
  computeCollectionMetrics,
  escapeCsvCell,
  getDashboardAnalytics,
  getFullReports,
  exportReportsCsv,
  exportReportsExcel,
};

