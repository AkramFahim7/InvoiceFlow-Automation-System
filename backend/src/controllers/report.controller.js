const reportService = require('../services/report.service');

async function getDashboard(req, res, next) {
  try {
    const data = await reportService.getDashboardAnalytics(req.user.id);
    res.status(200).json({
      status: 'ok',
      data,
    });
  } catch (error) {
    next(error);
  }
}

async function getOverview(req, res, next) {
  try {
    const data = await reportService.getFullReports(req.user.id, {
      months: req.query.months,
    });
    res.status(200).json({
      status: 'ok',
      data,
    });
  } catch (error) {
    next(error);
  }
}

async function exportCsv(req, res, next) {
  try {
    const csv = await reportService.exportReportsCsv(req.user.id);
    const dateStamp = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="InvoiceFlow_Invoice_Data_${dateStamp}.csv"`
    );
    res.status(200).send(csv);
  } catch (error) {
    next(error);
  }
}

async function exportExcel(req, res, next) {
  try {
    const buffer = await reportService.exportReportsExcel(req.user.id);
    const dateStamp = new Date().toISOString().slice(0, 10);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="InvoiceFlow_Invoice_Tracker_${dateStamp}.xlsx"`
    );
    res.status(200).send(Buffer.from(buffer));
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getDashboard,
  getOverview,
  exportCsv,
  exportExcel,
};

