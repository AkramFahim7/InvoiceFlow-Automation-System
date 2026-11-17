import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getDashboardAnalytics } from '../api/reportApi';
import {
  formatMoney,
  formatShortDate,
  MonthlyRevenueChart,
  StatusDonutChart,
} from '../components/AnalyticsCharts';
import InvoiceStatusBadge from '../components/InvoiceStatusBadge';
import { useAuth } from '../context/AuthContext';

export default function DashboardPage() {
  const { user, businessProfile } = useAuth();
  const currency = businessProfile?.currencySymbol || 'Rs.';

  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const data = await getDashboardAnalytics();
        if (active) setAnalytics(data);
      } catch (err) {
        if (active) {
          setError(
            err.response?.data?.message || 'Failed to load dashboard metrics.'
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="max-w-6xl py-16 text-center text-sm text-slate-500">
        Loading workspace analytics...
      </div>
    );
  }

  if (error || !analytics) {
    return (
      <div className="max-w-6xl rounded-xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700">
        {error || 'Dashboard analytics unavailable.'}
      </div>
    );
  }

  const { kpis, statusBreakdown, monthlySeries, overdueInvoices, automationHealth, recentInvoices, recentPayments } =
    analytics;

  return (
    <div className="max-w-6xl space-y-6">
      {/* Header + Quick Actions */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Welcome back, {user?.fullName}
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Live financial and automation overview for{' '}
            <span className="font-semibold text-slate-800">
              {businessProfile?.businessName}
            </span>
            .
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            to="/invoices/new"
            className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold transition-colors"
          >
            + New Invoice
          </Link>
          <Link
            to="/payments"
            className="px-4 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-sm font-medium transition-colors"
          >
            Record Payment
          </Link>
          <Link
            to="/reports"
            className="px-4 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-sm font-medium transition-colors"
          >
            Full Reports →
          </Link>
        </div>
      </div>

      {/* Primary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Total Billed
          </p>
          <p className="text-2xl font-bold text-slate-900 mt-2 tabular-nums">
            {formatMoney(currency, kpis.totalBilled)}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Across {kpis.totalInvoices} invoice(s) · {kpis.activeCustomers} customer(s)
          </p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Total Collected
          </p>
          <p className="text-2xl font-bold text-emerald-600 mt-2 tabular-nums">
            {formatMoney(currency, kpis.totalCollected)}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Collection rate:{' '}
            <span className="font-semibold text-slate-700">
              {kpis.collectionRatePercent}%
            </span>
          </p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Outstanding Receivables
          </p>
          <p className="text-2xl font-bold text-slate-900 mt-2 tabular-nums">
            {formatMoney(currency, kpis.totalOutstanding)}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Avg invoice: {formatMoney(currency, kpis.averageInvoiceValue)}
          </p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Overdue Balance
          </p>
          <p
            className={`text-2xl font-bold mt-2 tabular-nums ${
              kpis.overdueCount > 0 ? 'text-rose-600' : 'text-slate-900'
            }`}
          >
            {formatMoney(currency, kpis.overdueBalance)}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {kpis.overdueCount} overdue invoice(s)
          </p>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                6-Month Billing vs. Collections
              </h2>
              <p className="text-xs text-slate-500">
                Monthly non-cancelled invoices compared with recorded payments
              </p>
            </div>
            <Link
              to="/reports"
              className="text-xs font-semibold text-teal-600 hover:underline"
            >
              Explore 12M →
            </Link>
          </div>
          <MonthlyRevenueChart data={monthlySeries} currency={currency} />
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900 mb-1">
              Invoice Status Mix
            </h2>
            <p className="text-xs text-slate-500 mb-5">
              Distribution across all billing stages
            </p>
            <StatusDonutChart breakdown={statusBreakdown} />
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500">
              Automation: {automationHealth.workflows.enabled}/
              {automationHealth.workflows.total} rules active
            </span>
            <Link
              to="/automation"
              className="font-semibold text-teal-600 hover:underline"
            >
              Manage →
            </Link>
          </div>
        </div>
      </div>

      {/* Overdue + Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Overdue Watchlist */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-slate-900">
              Overdue Watchlist
            </h2>
            <Link
              to="/invoices"
              className="text-xs font-semibold text-teal-600 hover:underline"
            >
              All Invoices →
            </Link>
          </div>

          {overdueInvoices.length === 0 ? (
            <div className="py-8 text-center text-sm text-emerald-700 bg-emerald-50/60 rounded-lg border border-emerald-100">
              No overdue invoices right now. Collections are up to date!
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {overdueInvoices.map((inv) => (
                <div
                  key={inv.id}
                  className="py-3 flex items-center justify-between gap-3 text-sm"
                >
                  <div>
                    <Link
                      to={`/invoices/${inv.id}`}
                      className="font-semibold text-slate-900 hover:text-teal-600"
                    >
                      {inv.invoiceNumber}
                    </Link>
                    <p className="text-xs text-slate-500">
                      {inv.customerName} · Due {formatShortDate(inv.dueDate)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-rose-600 tabular-nums">
                      {formatMoney(currency, inv.remainingBalance)}
                    </p>
                    <p className="text-[11px] text-rose-500">
                      {inv.daysOverdue} day(s) overdue
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Activity (Invoices & Payments) */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-5">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold text-slate-900">
                Recent Invoices
              </h2>
              <Link
                to="/invoices"
                className="text-xs font-semibold text-teal-600 hover:underline"
              >
                View All →
              </Link>
            </div>
            {recentInvoices.length === 0 ? (
              <p className="text-sm text-slate-400">No invoices created yet.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {recentInvoices.map((inv) => (
                  <div
                    key={inv.id}
                    className="py-2.5 flex items-center justify-between gap-3 text-sm"
                  >
                    <div className="min-w-0">
                      <Link
                        to={`/invoices/${inv.id}`}
                        className="font-medium text-slate-900 hover:text-teal-600"
                      >
                        {inv.invoiceNumber}
                      </Link>
                      <span className="text-xs text-slate-500 ml-2">
                        {inv.customerName}
                      </span>
                    </div>
                    <div className="flex items-center gap-2.5 shrink-0">
                      <InvoiceStatusBadge status={inv.status} />
                      <span className="font-semibold text-slate-800 tabular-nums text-xs">
                        {formatMoney(currency, inv.grandTotal)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-slate-100">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold text-slate-900">
                Recent Payments
              </h2>
              <Link
                to="/payments"
                className="text-xs font-semibold text-teal-600 hover:underline"
              >
                Ledger →
              </Link>
            </div>
            {recentPayments.length === 0 ? (
              <p className="text-sm text-slate-400">No payments recorded yet.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {recentPayments.map((pay) => (
                  <div
                    key={pay.id}
                    className="py-2 flex items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <Link
                        to={`/invoices/${pay.invoiceId}`}
                        className="font-semibold text-slate-800 hover:text-teal-600"
                      >
                        {pay.invoiceNumber}
                      </Link>
                      <span className="text-slate-500 ml-2">
                        {pay.customerName} · {pay.paymentMethod}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="font-semibold text-emerald-600 tabular-nums">
                        +{formatMoney(currency, pay.amount)}
                      </span>
                      <span className="text-slate-400 ml-2">
                        {formatShortDate(pay.paymentDate)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
