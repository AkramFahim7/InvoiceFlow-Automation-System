import { useEffect, useState } from 'react';
import { recordPayment } from '../api/paymentApi';
import { useAuth } from '../context/AuthContext';

const PAYMENT_METHODS = [
  'Bank Transfer',
  'Cash',
  'Card',
  'Cheque',
  'Online',
  'Other',
];

function getTodayDateString() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function RecordPaymentModal({
  isOpen,
  fixedInvoice = null,
  payableInvoices = [],
  onClose,
  onSuccess,
}) {
  const { businessProfile } = useAuth();
  const currency = businessProfile?.currencySymbol || 'Rs.';

  const [selectedInvoiceId, setSelectedInvoiceId] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(getTodayDateString());
  const [paymentMethod, setPaymentMethod] = useState('Bank Transfer');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const activeInvoice =
    fixedInvoice ||
    payableInvoices.find((inv) => String(inv.id) === String(selectedInvoiceId)) ||
    null;

  useEffect(() => {
    if (!isOpen) return;
    setError('');
    setPaymentDate(getTodayDateString());
    setPaymentMethod('Bank Transfer');
    setReferenceNumber('');
    setNotes('');

    if (fixedInvoice) {
      setSelectedInvoiceId(String(fixedInvoice.id));
      setAmount(String(fixedInvoice.remainingBalance));
    } else if (payableInvoices.length > 0) {
      setSelectedInvoiceId(String(payableInvoices[0].id));
      setAmount(String(payableInvoices[0].remainingBalance));
    } else {
      setSelectedInvoiceId('');
      setAmount('');
    }
  }, [isOpen, fixedInvoice, payableInvoices]);

  if (!isOpen) return null;

  const handleInvoiceSelect = (invId) => {
    setSelectedInvoiceId(invId);
    const found = payableInvoices.find((inv) => String(inv.id) === String(invId));
    if (found) {
      setAmount(String(found.remainingBalance));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!activeInvoice) {
      setError('Please select an invoice.');
      return;
    }

    const numericAmount = Number(amount);
    if (Number.isNaN(numericAmount) || numericAmount <= 0) {
      setError('Payment amount must be greater than zero.');
      return;
    }

    setSubmitting(true);
    try {
      const response = await recordPayment({
        invoiceId: activeInvoice.id,
        amount: numericAmount,
        paymentDate,
        paymentMethod,
        referenceNumber,
        notes,
      });
      await onSuccess(response);
      onClose();
    } catch (err) {
      setError(
        err.response?.data?.message || 'Unable to record payment.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
        <div className="bg-[#0F172A] text-white px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Record Payment</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-300 hover:text-white text-sm font-medium cursor-pointer"
          >
            Close
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {!fixedInvoice && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Select Invoice <span className="text-red-500">*</span>
              </label>
              {payableInvoices.length === 0 ? (
                <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
                  No unpaid invoices (Sent, Partially Paid, or Overdue) available.
                </p>
              ) : (
                <select
                  required
                  value={selectedInvoiceId}
                  onChange={(e) => handleInvoiceSelect(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  {payableInvoices.map((inv) => (
                    <option key={inv.id} value={inv.id}>
                      {inv.invoiceNumber} — {inv.customerName} (Balance: {currency}{' '}
                      {inv.remainingBalance.toFixed(2)})
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {activeInvoice && (
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-3.5 flex justify-between items-center text-sm">
              <div>
                <p className="font-semibold text-slate-900">
                  {activeInvoice.invoiceNumber}
                </p>
                <p className="text-xs text-slate-500">
                  Total: {currency} {activeInvoice.grandTotal.toFixed(2)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-500">Remaining Balance</p>
                <p className="font-bold text-teal-700">
                  {currency} {activeInvoice.remainingBalance.toFixed(2)}
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Amount ({currency}) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                required
                min="0.01"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Payment Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Payment Method
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Reference # (optional)
              </label>
              <input
                type="text"
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                placeholder="TXN-88412"
                className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Notes (optional)
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="First installment, bank slip verified..."
              className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <div className="pt-2 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !activeInvoice}
              className="px-5 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white text-sm font-semibold cursor-pointer"
            >
              {submitting ? 'Recording...' : 'Save Payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

