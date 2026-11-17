import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  downloadReportsCsv,
  downloadReportsExcel,
  getReportsOverview,
} from '../api/reportApi';
import {
  formatMoney,
  formatShortDate,
  MonthlyRevenueChart,
  StatusDonutChart,
} from '../components/AnalyticsCharts';
import { useAuth } from '../context/AuthContext';

export default function ReportsPage() {
  const { businessProfile } = useAuth();
  const currency = businessProfile?.currencySymbol || 'Rs.';

  const [months, setMonths] = useState(6);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exportingType, setExportingType] = useState(null); // 'excel' | 'csv' | null
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState({ type: '', message: '' });

  const loadReports = useCallback(async (selectedMonths) => {
    setLoading(true);
    setError('');
    try {
      const data = await getReportsOverview(selectedMonths);
      setReport(data);
    } catch (err) {
      setError(
        err.response?.data?.message || 'Failed to load financial reports.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReports(months);
  }, [months, loadReports]);

  const handleExportExcel = async () => {
    setExportingType('excel');
    setError('');
    setFeedback({ type: '', message: '' });
    try {
      await downloadReportsExcel();
      setFeedback({
        type: 'success',
        message: 'Professional Excel invoice tracker (.xlsx) downloaded successfully.',
      });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to export Excel tracker.');
    } finally {
      setExportingType(null);
    }
  };

  const handleExportCsv = async () => {
    setExportingType('csv');
    setError('');
    setFeedback({ type: '', message: '' });
    try {
      await downloadReportsCsv();
      setFeedback({
        type: 'success',
        message: 'Clean tabular CSV invoice dataset downloaded successfully.',
      });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to export CSV report.');
    } finally {
      setExportingType(null);
    }
  };

  const maxMethodTotal =
    report?.paymentMethods?.length > 0
      ? Math.max(...report.paymentMethods.map((m) => Number(m.totalAmount || 0)), 1)
      : 1;

  return (
    <div className="max-w-6xl space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Reports &amp; Analytics
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Revenue trends, receivable aging, payment methods, and automation performance.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Timeline Switcher */}
          <div className="inline-flex rounded-lg border border-slate-300 bg-white p-0.5 mr-1">
            {[3, 6, 12].map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setMonths(option)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                  months === option
                    ? 'bg-teal-600 text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {option}M
              </button>
            ))}
          </div>

          {/* Export Excel (.xlsx) */}
          <button
            type="button"
            onClick={handleExportExcel}
            disabled={Boolean(exportingType)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white text-xs font-semibold transition-colors shadow-sm cursor-pointer"
            title="Download multi-sheet Excel invoice tracker with dashboard formulas and conditional formatting"
          >
            {exportingType === 'excel' ? (
              <>
                <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                <span>Generating XLSX...</span>
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z" />
                </svg>
                <span>Export Excel (.xlsx)</span>
              </>
            )}
          </button>

          {/* Export CSV (.csv) */}
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={Boolean(exportingType)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white text-xs font-semibold transition-colors shadow-sm cursor-pointer"
            title="Download clean, structured tabular CSV dataset"
          >
            {exportingType === 'csv' ? (
              <>
                <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                <span>Exporting CSV...</span>
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z" />
                </svg>
                <span>Export CSV (.csv)</span>
              </>
            )}
          </button>
        </div>
      </div>

      {feedback.message && (
        <div
          className={`rounded-lg border px-4 py-3 text-xs flex items-center justify-between ${
            feedback.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-rose-200 bg-rose-50 text-rose-700'
          }`}
        >
          <span>{feedback.message}</span>
          <button
            type="button"
            onClick={() => setFeedback({ type: '', message: '' })}
            className="text-xs font-bold hover:underline ml-2"
          >
            Dismiss
          </button>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      {loading || !report ? (
        <div className="bg-white rounded-xl border border-slate-200 py-16 text-center text-sm text-slate-500">
          Generating reports...
        </div>
      ) : (
        <>
          {/* KPI Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Total Billed
              </p>
              <p className="text-lg font-bold text-slate-900 mt-1.5 tabular-nums">
                {formatMoney(currency, report.kpis.totalBilled)}
              </p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Collected
              </p>
              <p className="text-lg font-bold text-emerald-600 mt-1.5 tabular-nums">
                {formatMoney(currency, report.kpis.totalCollected)}
              </p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Outstanding
              </p>
              <p className="text-lg font-bold text-amber-600 mt-1.5 tabular-nums">
                {formatMoney(currency, report.kpis.totalOutstanding)}
              </p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Collection Rate
              </p>
              <p className="text-lg font-bold text-teal-700 mt-1.5 tabular-nums">
                {report.kpis.collectionRatePercent}%
              </p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Avg Invoice Value
              </p>
              <p className="text-lg font-bold text-slate-900 mt-1.5 tabular-nums">
                {formatMoney(currency, report.kpis.averageInvoiceValue)}
              </p>
            </div>
          </div>

          {/* Monthly Trend + Status Donut */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-5">
              <h2 className="text-base font-semibold text-slate-900">
                Monthly Cashflow Trend ({report.windowMonths} Months)
              </h2>
              <p className="text-xs text-slate-500 mb-4">
                Comparison of monthly billed invoice totals and collected payments
              </p>
              <MonthlyRevenueChart
                data={report.monthlySeries}
                currency={currency}
              />
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h2 className="text-base font-semibold text-slate-900 mb-1">
                Status Breakdown
              </h2>
              <p className="text-xs text-slate-500 mb-5">
                All {report.kpis.totalInvoices} invoice(s) by current status
              </p>
              <StatusDonutChart breakdown={report.statusBreakdown} />
            </div>
          </div>

          {/* Payment Methods + Automation & Email Health */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h2 className="text-base font-semibold text-slate-900 mb-1">
                Collections by Payment Method
              </h2>
              <p className="text-xs text-slate-500 mb-4">
                {report.kpis.totalPayments} recorded payment transaction(s)
              </p>

              {report.paymentMethods.length === 0 ? (
                <p className="text-sm text-slate-400 py-6 text-center">
                  No payments recorded yet.
                </p>
              ) : (
                <div className="space-y-3">
                  {report.paymentMethods.map((m) => {
                    const widthPct = Math.round(
                      (Number(m.totalAmount) / maxMethodTotal) * 100
                    );
                    return (
                      <div key={m.method} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium text-slate-700">
                            {m.method}{' '}
                            <span className="text-slate-400">({m.count})</span>
                          </span>
                          <span className="font-semibold text-slate-900 tabular-nums">
                            {formatMoney(currency, m.totalAmount)}
                          </span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-teal-600"
                            style={{ width: `${Math.max(widthPct, 4)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-base font-semibold text-slate-900">
                      Automation &amp; Email Reliability
                    </h2>
                    <p className="text-xs text-slate-500">
                      Workflow executions and notification delivery stats
                    </p>
                  </div>
                  <Link
                    to="/automation/history"
                    className="text-xs font-semibold text-teal-600 hover:underline"
                  >
                    Audit Log →
                  </Link>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="rounded-lg bg-slate-50 border border-slate-200 p-3.5">
                    <p className="text-xs font-semibold text-slate-500 uppercase">
                      Workflow Runs
                    </p>
                    <p className="text-xl font-bold text-slate-900 mt-1">
                      {report.automationHealth.executions.total}
                    </p>
                    <p className="text-xs text-slate-600 mt-1">
                      <span className="text-emerald-600 font-medium">
                        {report.automationHealth.executions.success} OK
                      </span>{' '}
                      ·{' '}
                      <span className="text-slate-500">
                        {report.automationHealth.executions.skipped} Skipped
                      </span>{' '}
                      ·{' '}
                      <span className="text-rose-600 font-medium">
                        {report.automationHealth.executions.failed} Failed
                      </span>
                    </p>
                  </div>

                  <div className="rounded-lg bg-slate-50 border border-slate-200 p-3.5">
                    <p className="text-xs font-semibold text-slate-500 uppercase">
                      Email Logs
                    </p>
                    <p className="text-xl font-bold text-slate-900 mt-1">
                      {report.automationHealth.emails.total}
                    </p>
                    <p className="text-xs text-slate-600 mt-1">
                      <span className="text-emerald-600 font-medium">
                        {report.automationHealth.emails.sent} Sent
                      </span>{' '}
                      ·{' '}
                      <span className="text-teal-600 font-medium">
                        {report.automationHealth.emails.simulated} Sim
                      </span>{' '}
                      ·{' '}
                      <span className="text-rose-600 font-medium">
                        {report.automationHealth.emails.failed} Fail
                      </span>
                    </p>
                  </div>
                </div>
              </div>

              <p className="text-xs text-slate-500 mt-4 pt-3 border-t border-slate-100">
                Active automation workflows:{' '}
                <strong className="text-slate-800">
                  {report.automationHealth.workflows.enabled} /{' '}
                  {report.automationHealth.workflows.total}
                </strong>
              </p>
            </div>
          </div>

          {/* Top Customers + Overdue Receivables Aging */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
                <h2 className="text-base font-semibold text-slate-900">
                  Top Customers by Billed Revenue
                </h2>
                <Link
                  to="/customers"
                  className="text-xs font-semibold text-teal-600 hover:underline"
                >
                  Customers →
                </Link>
              </div>
              {report.topCustomers.length === 0 ? (
                <p className="p-6 text-sm text-slate-400 text-center">
                  No billed customers yet.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 text-xs uppercase text-slate-500 border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-2.5">Customer</th>
                        <th className="px-4 py-2.5 text-right">Inv</th>
                        <th className="px-4 py-2.5 text-right">Billed</th>
                        <th className="px-4 py-2.5 text-right">Collected</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {report.topCustomers.map((c) => (
                        <tr key={c.id} className="hover:bg-slate-50/70">
                          <td className="px-4 py-2.5">
                            <Link
                              to={`/customers/${c.id}`}
                              className="font-medium text-slate-900 hover:text-teal-600"
                            >
                              {c.name}
                            </Link>
                            {c.companyName && (
                              <p className="text-xs text-slate-400">
                                {c.companyName}
                              </p>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-right text-slate-600">
                            {c.invoiceCount}
                          </td>
                          <td className="px-4 py-2.5 text-right font-semibold text-slate-900 tabular-nums">
                            {formatMoney(currency, c.totalBilled)}
                          </td>
                          <td className="px-4 py-2.5 text-right text-emerald-600 tabular-nums">
                            {formatMoney(currency, c.totalCollected)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
                <h2 className="text-base font-semibold text-slate-900">
                  Overdue Receivables Aging
                </h2>
                <span className="text-xs font-semibold text-rose-600">
                  {report.overdueInvoices.length} Overdue
                </span>
              </div>
              {report.overdueInvoices.length === 0 ? (
                <p className="p-6 text-sm text-emerald-700 text-center">
                  No overdue receivables in this account.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 text-xs uppercase text-slate-500 border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-2.5">Invoice</th>
                        <th className="px-4 py-2.5">Due Date</th>
                        <th className="px-4 py-2.5 text-right">Age</th>
                        <th className="px-4 py-2.5 text-right">Balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {report.overdueInvoices.map((inv) => (
                        <tr key={inv.id} className="hover:bg-slate-50/70">
                          <td className="px-4 py-2.5">
                            <Link
                              to={`/invoices/${inv.id}`}
                              className="font-medium text-slate-900 hover:text-teal-600"
                            >
                              {inv.invoiceNumber}
                            </Link>
                            <p className="text-xs text-slate-400">
                              {inv.customerName}
                            </p>
                          </td>
                          <td className="px-4 py-2.5 text-xs text-slate-600">
                            {formatShortDate(inv.dueDate)}
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-100 text-rose-700">
                              {inv.daysOverdue}d
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-right font-semibold text-rose-600 tabular-nums">
                            {formatMoney(currency, inv.remainingBalance)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Monthly Breakdown Table */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200">
              <h2 className="text-base font-semibold text-slate-900">
                Monthly Ledger Summary ({report.windowMonths} Months)
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="px-5 py-2.5">Month</th>
                    <th className="px-5 py-2.5 text-right">Invoices</th>
                    <th className="px-5 py-2.5 text-right">Invoiced</th>
                    <th className="px-5 py-2.5 text-right">Payments</th>
                    <th className="px-5 py-2.5 text-right">Collected</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {report.monthlySeries.map((row) => (
                    <tr key={row.monthKey} className="hover:bg-slate-50/70">
                      <td className="px-5 py-2.5 font-medium text-slate-800">
                        {row.label}
                      </td>
                      <td className="px-5 py-2.5 text-right text-slate-600">
                        {row.invoiceCount}
                      </td>
                      <td className="px-5 py-2.5 text-right font-medium text-slate-900 tabular-nums">
                        {formatMoney(currency, row.invoicedAmount)}
                      </td>
                      <td className="px-5 py-2.5 text-right text-slate-600">
                        {row.paymentCount}
                      </td>
                      <td className="px-5 py-2.5 text-right font-semibold text-emerald-600 tabular-nums">
                        {formatMoney(currency, row.collectedAmount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

