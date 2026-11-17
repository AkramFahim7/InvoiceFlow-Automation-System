import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { deleteDraftInvoice, getInvoices } from '../api/invoiceApi';
import { downloadReportsCsv, downloadReportsExcel } from '../api/reportApi';
import InvoiceStatusBadge from '../components/InvoiceStatusBadge';
import { useAuth } from '../context/AuthContext';

const STATUS_FILTERS = [
  'all',
  'Draft',
  'Sent',
  'Partially Paid',
  'Paid',
  'Overdue',
  'Cancelled',
];

export default function InvoicesPage() {
  const { businessProfile } = useAuth();
  const currency = businessProfile?.currencySymbol || 'Rs.';

  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [exportingType, setExportingType] = useState(null);
  const [feedback, setFeedback] = useState({ type: '', message: '' });

  const handleExportExcel = async () => {
    setExportingType('excel');
    setFeedback({ type: '', message: '' });
    try {
      await downloadReportsExcel();
      setFeedback({
        type: 'success',
        message: 'Professional Excel invoice tracker (.xlsx) downloaded successfully.',
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err.response?.data?.message || 'Failed to export Excel tracker.',
      });
    } finally {
      setExportingType(null);
    }
  };

  const handleExportCsv = async () => {
    setExportingType('csv');
    setFeedback({ type: '', message: '' });
    try {
      await downloadReportsCsv();
      setFeedback({
        type: 'success',
        message: 'Clean CSV invoice data (.csv) downloaded successfully.',
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err.response?.data?.message || 'Failed to export CSV report.',
      });
    } finally {
      setExportingType(null);
    }
  };

  const loadInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const list = await getInvoices({ search, status: statusFilter });
      setInvoices(list);
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err.response?.data?.message || 'Failed to load invoices.',
      });
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadInvoices();
    }, 200);
    return () => clearTimeout(timer);
  }, [loadInvoices]);

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteDraftInvoice(deleteTarget.id);
      setFeedback({
        type: 'success',
        message: `Draft invoice ${deleteTarget.invoiceNumber} deleted.`,
      });
      setDeleteTarget(null);
      await loadInvoices();
    } catch (err) {
      setFeedback({
        type: 'error',
        message:
          err.response?.data?.message || 'Unable to delete draft invoice.',
      });
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="max-w-6xl space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Invoices</h1>
          <p className="text-sm text-slate-600 mt-1">
            Create, edit, issue, and track customer invoices.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleExportExcel}
            disabled={Boolean(exportingType)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white text-xs font-semibold transition-colors shadow-sm cursor-pointer"
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
                <span>Export Excel</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleExportCsv}
            disabled={Boolean(exportingType)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white text-xs font-semibold transition-colors shadow-sm cursor-pointer"
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
                <span>Export CSV</span>
              </>
            )}
          </button>

          <Link
            to="/invoices/new"
            className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold transition-colors self-start sm:self-auto"
          >
            + Create Invoice
          </Link>
        </div>
      </div>

      {feedback.message && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm flex items-center justify-between ${
            feedback.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-red-200 bg-red-50 text-red-700'
          }`}
        >
          <span>{feedback.message}</span>
          <button
            type="button"
            onClick={() => setFeedback({ type: '', message: '' })}
            className="text-xs font-semibold underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Search & Status Filter */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by invoice number or customer name..."
          className="flex-1 rounded-lg border border-slate-300 px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
        />

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-slate-300 px-3.5 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
        >
          {STATUS_FILTERS.map((st) => (
            <option key={st} value={st}>
              {st === 'all' ? 'All Statuses' : st}
            </option>
          ))}
        </select>
      </div>

      {/* Invoices Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">
            Loading invoices...
          </div>
        ) : invoices.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <p className="text-base font-semibold text-slate-800">
              {search || statusFilter !== 'all'
                ? 'No invoices match your search or filter.'
                : 'No invoices created yet.'}
            </p>
            <p className="text-sm text-slate-500">
              {search || statusFilter !== 'all'
                ? 'Try clearing your filters or searching another invoice.'
                : 'Create your first invoice to generate an automatic invoice number.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <th className="px-5 py-3.5">Invoice #</th>
                  <th className="px-5 py-3.5">Customer</th>
                  <th className="px-5 py-3.5">Issue Date</th>
                  <th className="px-5 py-3.5">Due Date</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Grand Total</th>
                  <th className="px-5 py-3.5 text-right">Balance</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {invoices.map((inv) => {
                  const canEdit =
                    inv.status === 'Draft' ||
                    (inv.status === 'Sent' && inv.amountPaid === 0);
                  return (
                    <tr key={inv.id} className="hover:bg-slate-50/70">
                      <td className="px-5 py-3.5 font-semibold text-slate-900">
                        <Link
                          to={`/invoices/${inv.id}`}
                          className="hover:text-teal-600"
                        >
                          {inv.invoiceNumber}
                        </Link>
                      </td>
                      <td className="px-5 py-3.5">
                        <p className="font-medium text-slate-800">
                          {inv.customerName}
                        </p>
                        {inv.customerCompany && (
                          <p className="text-xs text-slate-500">
                            {inv.customerCompany}
                          </p>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-slate-600">
                        {inv.issueDate}
                      </td>
                      <td className="px-5 py-3.5 text-slate-600">
                        {inv.dueDate}
                      </td>
                      <td className="px-5 py-3.5">
                        <InvoiceStatusBadge status={inv.status} />
                      </td>
                      <td className="px-5 py-3.5 text-right font-medium text-slate-900">
                        {currency} {inv.grandTotal.toFixed(2)}
                      </td>
                      <td className="px-5 py-3.5 text-right font-medium text-slate-700">
                        {currency} {inv.remainingBalance.toFixed(2)}
                      </td>
                      <td className="px-5 py-3.5 text-right space-x-3 whitespace-nowrap">
                        <Link
                          to={`/invoices/${inv.id}`}
                          className="text-teal-600 font-medium hover:underline"
                        >
                          View
                        </Link>
                        {canEdit && (
                          <Link
                            to={`/invoices/${inv.id}/edit`}
                            className="text-slate-700 font-medium hover:underline"
                          >
                            Edit
                          </Link>
                        )}
                        {inv.status === 'Draft' && (
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(inv)}
                            className="text-red-600 font-medium hover:underline cursor-pointer"
                          >
                            Delete
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 p-6 space-y-4">
            <h2 className="text-lg font-bold text-slate-900">
              Delete Draft Invoice?
            </h2>
            <p className="text-sm text-slate-600">
              Are you sure you want to permanently delete draft{' '}
              <span className="font-semibold text-slate-800">
                {deleteTarget.invoiceNumber}
              </span>
              ?
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 rounded-lg border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-sm font-semibold cursor-pointer"
              >
                {deleting ? 'Deleting...' : 'Delete Draft'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

