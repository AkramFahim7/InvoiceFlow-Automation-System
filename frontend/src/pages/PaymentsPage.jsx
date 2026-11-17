import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getInvoices } from '../api/invoiceApi';
import { getPayments } from '../api/paymentApi';
import { sendPaymentConfirmationEmail } from '../api/emailApi';
import InvoiceStatusBadge from '../components/InvoiceStatusBadge';
import RecordPaymentModal from '../components/RecordPaymentModal';
import { useAuth } from '../context/AuthContext';

const METHODS = [
  'all',
  'Bank Transfer',
  'Cash',
  'Card',
  'Cheque',
  'Online',
  'Other',
];

export default function PaymentsPage() {
  const { businessProfile } = useAuth();
  const currency = businessProfile?.currencySymbol || 'Rs.';

  const [payments, setPayments] = useState([]);
  const [payableInvoices, setPayableInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [methodFilter, setMethodFilter] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [sendingReceiptId, setSendingReceiptId] = useState(null);
  const [feedback, setFeedback] = useState({ type: '', message: '' });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [paymentList, allInvoices] = await Promise.all([
        getPayments({ search, method: methodFilter }),
        getInvoices(),
      ]);
      setPayments(paymentList);
      setPayableInvoices(
        allInvoices.filter((inv) =>
          ['Sent', 'Partially Paid', 'Overdue'].includes(inv.status)
        )
      );
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err.response?.data?.message || 'Failed to load payment records.',
      });
    } finally {
      setLoading(false);
    }
  }, [search, methodFilter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadData();
    }, 200);
    return () => clearTimeout(timer);
  }, [loadData]);

  const totalCollected = payments.reduce((sum, p) => sum + p.amount, 0);

  const handlePaymentRecorded = async (res) => {
    setFeedback({
      type: 'success',
      message: res.message || 'Payment recorded successfully.',
    });
    await loadData();
  };

  const handleSendReceipt = async (paymentId) => {
    setSendingReceiptId(paymentId);
    try {
      const res = await sendPaymentConfirmationEmail(paymentId);
      setFeedback({ type: 'success', message: res.message });
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err.response?.data?.message || 'Failed to send receipt email.',
      });
    } finally {
      setSendingReceiptId(null);
    }
  };

  return (
    <div className="max-w-6xl space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Payments</h1>
          <p className="text-sm text-slate-600 mt-1">
            Record full or partial payments and monitor invoice balances.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="px-4 py-2.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-sm font-semibold transition-colors cursor-pointer self-start sm:self-auto"
        >
          + Record Payment
        </button>
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

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Payments Shown
          </p>
          <p className="text-2xl font-bold text-slate-900 mt-1">
            {payments.length}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Total Collected
          </p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">
            {currency} {totalCollected.toFixed(2)}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Awaiting Payment
          </p>
          <p className="text-2xl font-bold text-amber-600 mt-1">
            {payableInvoices.length} invoices
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by invoice #, customer, or reference #..."
          className="flex-1 rounded-lg border border-slate-300 px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
        />

        <select
          value={methodFilter}
          onChange={(e) => setMethodFilter(e.target.value)}
          className="rounded-lg border border-slate-300 px-3.5 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
        >
          {METHODS.map((m) => (
            <option key={m} value={m}>
              {m === 'all' ? 'All Methods' : m}
            </option>
          ))}
        </select>
      </div>

      {/* Payment Ledger Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">
            Loading payments...
          </div>
        ) : payments.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <p className="text-base font-semibold text-slate-800">
              No payments recorded yet.
            </p>
            <p className="text-sm text-slate-500">
              Mark an invoice as Sent and record a full or partial payment to see it here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <th className="px-5 py-3.5">Date</th>
                  <th className="px-5 py-3.5">Invoice #</th>
                  <th className="px-5 py-3.5">Customer</th>
                  <th className="px-5 py-3.5">Method</th>
                  <th className="px-5 py-3.5">Reference</th>
                  <th className="px-5 py-3.5 text-right">Amount Paid</th>
                  <th className="px-5 py-3.5">Invoice Status</th>
                  <th className="px-5 py-3.5 text-right">Remaining</th>
                  <th className="px-5 py-3.5 text-right">Receipt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {payments.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/70">
                    <td className="px-5 py-3.5 text-slate-600">
                      {p.paymentDate}
                    </td>
                    <td className="px-5 py-3.5 font-semibold">
                      <Link
                        to={`/invoices/${p.invoiceId}`}
                        className="text-teal-600 hover:underline"
                      >
                        {p.invoiceNumber}
                      </Link>
                    </td>
                    <td className="px-5 py-3.5">
                      <Link
                        to={`/customers/${p.customerId}`}
                        className="text-slate-800 hover:text-teal-600 font-medium"
                      >
                        {p.customerName}
                      </Link>
                    </td>
                    <td className="px-5 py-3.5 text-slate-700">
                      {p.paymentMethod}
                    </td>
                    <td className="px-5 py-3.5 text-slate-500">
                      {p.referenceNumber || '—'}
                    </td>
                    <td className="px-5 py-3.5 text-right font-semibold text-emerald-700">
                      {currency} {p.amount.toFixed(2)}
                    </td>
                    <td className="px-5 py-3.5">
                      <InvoiceStatusBadge status={p.invoiceStatus} />
                    </td>
                    <td className="px-5 py-3.5 text-right font-medium text-slate-700">
                      {currency} {p.invoiceRemainingBalance.toFixed(2)}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <button
                        type="button"
                        disabled={sendingReceiptId === p.id}
                        onClick={() => handleSendReceipt(p.id)}
                        className="text-xs font-semibold text-teal-600 hover:underline disabled:opacity-50 cursor-pointer"
                      >
                        {sendingReceiptId === p.id ? 'Sending...' : 'Send Receipt'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <RecordPaymentModal
        isOpen={modalOpen}
        payableInvoices={payableInvoices}
        onClose={() => setModalOpen(false)}
        onSuccess={handlePaymentRecorded}
      />
    </div>
  );
}

