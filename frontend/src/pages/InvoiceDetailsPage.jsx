import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  deleteDraftInvoice,
  downloadInvoicePdf,
  getInvoiceById,
  updateInvoiceStatus,
} from '../api/invoiceApi';
import {
  getEmailLogs,
  sendInvoiceEmail,
  sendPaymentConfirmationEmail,
} from '../api/emailApi';
import InvoiceStatusBadge from '../components/InvoiceStatusBadge';
import RecordPaymentModal from '../components/RecordPaymentModal';

export default function InvoiceDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const apiOrigin = (
    import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api'
  ).replace(/\/api\/?$/, '');

  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [sendingReceiptId, setSendingReceiptId] = useState(null);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [emailLogs, setEmailLogs] = useState([]);
  const [smtpConfigured, setSmtpConfigured] = useState(false);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');

  const loadInvoice = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [data, emailLogData] = await Promise.all([
        getInvoiceById(id),
        getEmailLogs(id),
      ]);
      setInvoice(data);
      setEmailLogs(emailLogData.logs || []);
      setSmtpConfigured(Boolean(emailLogData.smtpConfigured));
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load invoice.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadInvoice();
  }, [loadInvoice]);

  const handleStatusChange = async (targetStatus) => {
    setBusy(true);
    setError('');
    setFeedback('');
    try {
      const updated = await updateInvoiceStatus(invoice.id, targetStatus);
      setInvoice(updated);
      setFeedback(`Invoice status updated to ${updated.status}.`);
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to update status.');
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteDraft = async () => {
    setBusy(true);
    setError('');
    try {
      await deleteDraftInvoice(invoice.id);
      navigate('/invoices');
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to delete draft.');
      setBusy(false);
    }
  };

  const handleDownloadPdf = async () => {
    setDownloadingPdf(true);
    setError('');
    try {
      await downloadInvoicePdf(invoice.id, invoice.invoiceNumber);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to download PDF.');
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleSendInvoiceEmail = async () => {
    setSendingEmail(true);
    setError('');
    setFeedback('');
    try {
      const res = await sendInvoiceEmail(invoice.id);
      setFeedback(res.message);
      const emailLogData = await getEmailLogs(invoice.id);
      setEmailLogs(emailLogData.logs || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send invoice email.');
      const emailLogData = await getEmailLogs(invoice.id).catch(() => null);
      if (emailLogData) setEmailLogs(emailLogData.logs || []);
    } finally {
      setSendingEmail(false);
    }
  };

  const handleSendReceipt = async (paymentId) => {
    setSendingReceiptId(paymentId);
    setError('');
    setFeedback('');
    try {
      const res = await sendPaymentConfirmationEmail(paymentId);
      setFeedback(res.message);
      const emailLogData = await getEmailLogs(invoice.id);
      setEmailLogs(emailLogData.logs || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send receipt.');
      const emailLogData = await getEmailLogs(invoice.id).catch(() => null);
      if (emailLogData) setEmailLogs(emailLogData.logs || []);
    } finally {
      setSendingReceiptId(null);
    }
  };

  if (loading) {
    return <div className="text-sm text-slate-500">Loading invoice...</div>;
  }

  if (error && !invoice) {
    return (
      <div className="max-w-3xl space-y-4">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
        <Link
          to="/invoices"
          className="inline-block text-sm font-semibold text-teal-600 hover:underline"
        >
          ← Back to Invoices
        </Link>
      </div>
    );
  }

  const currency = invoice.business?.currencySymbol || 'Rs.';
  const taxLabel = invoice.business?.taxLabel || 'Tax';
  const canEdit =
    invoice.status === 'Draft' ||
    (invoice.status === 'Sent' && invoice.amountPaid === 0);
  const canRecordPayment =
    ['Sent', 'Partially Paid', 'Overdue'].includes(invoice.status) &&
    invoice.remainingBalance > 0;
  const canCancel = ['Draft', 'Sent', 'Partially Paid', 'Overdue'].includes(
    invoice.status
  );

  return (
    <div className="max-w-4xl space-y-6">
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 print:hidden">
        <div>
          <Link
            to="/invoices"
            className="text-xs font-semibold text-teal-600 hover:underline"
          >
            ← Back to Invoices
          </Link>
          <div className="flex items-center gap-3 mt-1">
            <h1 className="text-2xl font-bold text-slate-900">
              {invoice.invoiceNumber}
            </h1>
            <InvoiceStatusBadge status={invoice.status} />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            disabled={downloadingPdf}
            onClick={handleDownloadPdf}
            className="px-4 py-2 rounded-lg bg-[#0F172A] hover:bg-slate-800 disabled:opacity-50 text-white text-sm font-semibold cursor-pointer"
          >
            {downloadingPdf ? 'Generating PDF...' : 'Download PDF'}
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="px-4 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-sm font-medium text-slate-700 cursor-pointer"
          >
            Print
          </button>
          {invoice.status !== 'Cancelled' && (
            <button
              type="button"
              disabled={sendingEmail}
              onClick={handleSendInvoiceEmail}
              className="px-4 py-2 rounded-lg border border-teal-600 text-teal-700 bg-white hover:bg-teal-50 disabled:opacity-50 text-sm font-semibold cursor-pointer"
            >
              {sendingEmail ? 'Sending...' : 'Send Email'}
            </button>
          )}
          {invoice.status === 'Draft' && (
            <button
              type="button"
              disabled={busy}
              onClick={() => handleStatusChange('Sent')}
              className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white text-sm font-semibold cursor-pointer"
            >
              Mark as Sent
            </button>
          )}
          {canRecordPayment && (
            <button
              type="button"
              onClick={() => setPaymentModalOpen(true)}
              className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-sm font-semibold cursor-pointer"
            >
              Record Payment
            </button>
          )}
          {canEdit && (
            <Link
              to={`/invoices/${invoice.id}/edit`}
              className="px-4 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-sm font-medium text-slate-700"
            >
              Edit
            </Link>
          )}
          {canCancel && (
            <button
              type="button"
              disabled={busy}
              onClick={() => handleStatusChange('Cancelled')}
              className="px-4 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-50 text-sm font-medium text-slate-700 cursor-pointer"
            >
              Cancel Invoice
            </button>
          )}
          {invoice.status === 'Draft' && (
            <button
              type="button"
              disabled={busy}
              onClick={handleDeleteDraft}
              className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-sm font-semibold cursor-pointer"
            >
              Delete Draft
            </button>
          )}
        </div>
      </div>

      {feedback && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 print:hidden">
          {feedback}
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 print:hidden">
          {error}
        </div>
      )}

      {/* Invoice Document Preview */}
      <div className="bg-white rounded-2xl border border-slate-200 p-8 space-y-8 shadow-xs print:border-0 print:shadow-none print:p-0">
        <div className="flex flex-col sm:flex-row justify-between gap-6 border-b border-slate-200 pb-6">
          <div className="flex items-start gap-4">
            {invoice.business.logoUrl ? (
              <img
                src={`${apiOrigin}${invoice.business.logoUrl}`}
                alt={invoice.business.businessName}
                className="w-14 h-14 rounded-xl object-contain border border-slate-200 bg-slate-50 p-1"
              />
            ) : (
              <div className="w-12 h-12 rounded-xl bg-[#0F172A] text-teal-400 font-bold flex items-center justify-center text-base shrink-0">
                {invoice.business.businessName.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                {invoice.business.businessName}
              </h2>
              {invoice.business.address && (
                <p className="text-sm text-slate-600 whitespace-pre-line mt-1">
                  {invoice.business.address}
                </p>
              )}
              {invoice.business.businessEmail && (
                <p className="text-sm text-slate-600 mt-1">
                  {invoice.business.businessEmail}
                </p>
              )}
              {invoice.business.phone && (
                <p className="text-sm text-slate-600">{invoice.business.phone}</p>
              )}
            </div>
          </div>

          <div className="sm:text-right space-y-1 text-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Invoice Details
            </p>
            <p className="font-bold text-slate-900">{invoice.invoiceNumber}</p>
            <p className="text-slate-600">Status: {invoice.status}</p>
            <p className="text-slate-600">Issue Date: {invoice.issueDate}</p>
            <p className="text-slate-600">Due Date: {invoice.dueDate}</p>
          </div>
        </div>

        {/* Bill To */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Bill To
          </p>
          <p className="font-semibold text-slate-900 mt-1">
            <Link
              to={`/customers/${invoice.customer.id}`}
              className="hover:text-teal-600"
            >
              {invoice.customer.name}
            </Link>
          </p>
          {invoice.customer.companyName && (
            <p className="text-sm text-slate-600">{invoice.customer.companyName}</p>
          )}
          {invoice.customer.email && (
            <p className="text-sm text-slate-600">{invoice.customer.email}</p>
          )}
          {invoice.customer.billingAddress && (
            <p className="text-sm text-slate-600 whitespace-pre-line mt-1">
              {invoice.customer.billingAddress}
            </p>
          )}
        </div>

        {/* Line Items Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <th className="py-3">Description</th>
                <th className="py-3 text-right">Qty</th>
                <th className="py-3 text-right">Unit Price</th>
                <th className="py-3 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {invoice.items.map((item) => (
                <tr key={item.id}>
                  <td className="py-3 text-slate-800">{item.description}</td>
                  <td className="py-3 text-right text-slate-600">
                    {item.quantity}
                  </td>
                  <td className="py-3 text-right text-slate-600">
                    {currency} {item.unitPrice.toFixed(2)}
                  </td>
                  <td className="py-3 text-right font-medium text-slate-900">
                    {currency} {item.lineTotal.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="flex justify-end">
          <div className="w-full max-w-xs space-y-2 text-sm border-t border-slate-200 pt-4">
            <TotalLine label="Subtotal" value={`${currency} ${invoice.subtotal.toFixed(2)}`} />
            <TotalLine label="Discount" value={`- ${currency} ${invoice.discountAmount.toFixed(2)}`} />
            <TotalLine
              label={`${taxLabel} (${invoice.taxRate}%)`}
              value={`${currency} ${invoice.taxAmount.toFixed(2)}`}
            />
            <div className="flex justify-between font-bold text-base text-slate-900 border-t border-slate-200 pt-2">
              <span>Grand Total</span>
              <span>
                {currency} {invoice.grandTotal.toFixed(2)}
              </span>
            </div>
            <TotalLine
              label="Amount Paid"
              value={`${currency} ${invoice.amountPaid.toFixed(2)}`}
            />
            <div className="flex justify-between font-semibold text-teal-700">
              <span>Remaining Balance</span>
              <span>
                {currency} {invoice.remainingBalance.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* Instructions & Notes */}
        {(invoice.paymentInstructions || invoice.notes) && (
          <div className="border-t border-slate-200 pt-6 grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm">
            {invoice.paymentInstructions && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Payment Instructions
                </p>
                <p className="text-slate-700 whitespace-pre-line mt-1">
                  {invoice.paymentInstructions}
                </p>
              </div>
            )}
            {invoice.notes && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Notes
                </p>
                <p className="text-slate-700 whitespace-pre-line mt-1">
                  {invoice.notes}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Payment History Section */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden print:hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">
            Payment History ({invoice.payments?.length || 0})
          </h2>
          {canRecordPayment && (
            <button
              type="button"
              onClick={() => setPaymentModalOpen(true)}
              className="text-sm font-semibold text-teal-600 hover:underline cursor-pointer"
            >
              + Add Payment
            </button>
          )}
        </div>

        {!invoice.payments || invoice.payments.length === 0 ? (
          <div className="p-6 text-sm text-slate-500">
            No payments recorded for this invoice yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <th className="px-5 py-3">Date</th>
                  <th className="px-5 py-3">Method</th>
                  <th className="px-5 py-3">Reference</th>
                  <th className="px-5 py-3">Notes</th>
                  <th className="px-5 py-3 text-right">Amount</th>
                  <th className="px-5 py-3 text-right">Receipt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {invoice.payments.map((p) => (
                  <tr key={p.id}>
                    <td className="px-5 py-3 text-slate-700">{p.paymentDate}</td>
                    <td className="px-5 py-3 text-slate-700">{p.paymentMethod}</td>
                    <td className="px-5 py-3 text-slate-500">
                      {p.referenceNumber || '—'}
                    </td>
                    <td className="px-5 py-3 text-slate-500">{p.notes || '—'}</td>
                    <td className="px-5 py-3 text-right font-semibold text-emerald-700">
                      {currency} {p.amount.toFixed(2)}
                    </td>
                    <td className="px-5 py-3 text-right">
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

      {/* Email Activity Log */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden print:hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
          <h2 className="text-base font-semibold text-slate-900">
            Email Activity ({emailLogs.length})
          </h2>
          <span
            className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${
              smtpConfigured
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-amber-50 text-amber-700 border-amber-200'
            }`}
          >
            {smtpConfigured ? 'SMTP Live' : 'Dev Simulation Mode'}
          </span>
        </div>

        {emailLogs.length === 0 ? (
          <div className="p-6 text-sm text-slate-500">
            No emails logged for this invoice yet.
          </div>
        ) : (
          <div className="divide-y divide-slate-200 text-sm">
            {emailLogs.map((log) => (
              <div
                key={log.id}
                className="px-6 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
              >
                <div>
                  <p className="font-medium text-slate-900">{log.subject}</p>
                  <p className="text-xs text-slate-500">
                    To: {log.recipientEmail} · Template: {log.templateName}
                  </p>
                  {log.errorMessage && (
                    <p className="text-xs text-red-600 mt-0.5">{log.errorMessage}</p>
                  )}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span
                    className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${
                      log.status === 'SENT'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : log.status === 'SIMULATED'
                        ? 'bg-sky-50 text-sky-700 border-sky-200'
                        : 'bg-red-50 text-red-700 border-red-200'
                    }`}
                  >
                    {log.status}
                  </span>
                  <span className="text-xs text-slate-400">
                    {new Date(log.sentAt).toLocaleString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <RecordPaymentModal
        isOpen={paymentModalOpen}
        fixedInvoice={invoice}
        onClose={() => setPaymentModalOpen(false)}
        onSuccess={async (res) => {
          setInvoice(res.data.invoice);
          setFeedback(res.message || 'Payment recorded.');
        }}
      />
    </div>
  );
}

function TotalLine({ label, value }) {
  return (
    <div className="flex justify-between text-slate-600">
      <span>{label}</span>
      <span className="font-medium text-slate-800">{value}</span>
    </div>
  );
}
