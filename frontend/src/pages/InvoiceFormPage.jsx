import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { getCustomers } from '../api/customerApi';
import {
  createInvoice,
  getInvoiceById,
  updateInvoice,
} from '../api/invoiceApi';
import { useAuth } from '../context/AuthContext';

function formatTodayOffset(days = 0) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function InvoiceFormPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { businessProfile } = useAuth();
  const isEditMode = Boolean(id);

  const currency = businessProfile?.currencySymbol || 'Rs.';
  const taxLabel = businessProfile?.taxLabel || 'Tax';

  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    customerId: searchParams.get('customerId') || '',
    issueDate: formatTodayOffset(0),
    dueDate: formatTodayOffset(14),
    discountAmount: '0',
    taxRate: String(businessProfile?.defaultTaxRate ?? 0),
    paymentInstructions: businessProfile?.paymentInstructions || '',
    notes: '',
    items: [{ description: '', quantity: '1', unitPrice: '0' }],
  });

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      setError('');
      try {
        const customerList = await getCustomers();
        setCustomers(customerList);

        if (isEditMode) {
          const inv = await getInvoiceById(id);
          setForm({
            customerId: String(inv.customerId),
            issueDate: inv.issueDate,
            dueDate: inv.dueDate,
            discountAmount: String(inv.discountAmount),
            taxRate: String(inv.taxRate),
            paymentInstructions: inv.paymentInstructions || '',
            notes: inv.notes || '',
            items: inv.items.map((item) => ({
              description: item.description,
              quantity: String(item.quantity),
              unitPrice: String(item.unitPrice),
            })),
          });
        }
      } catch (err) {
        setError(
          err.response?.data?.message || 'Unable to load invoice form data.'
        );
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [id, isEditMode]);

  // Client-side preview calculation (backend recalculates authoritatively)
  const previewSubtotal = form.items.reduce((sum, item) => {
    const qty = Number(item.quantity) || 0;
    const price = Number(item.unitPrice) || 0;
    return sum + qty * price;
  }, 0);
  const previewDiscount = Number(form.discountAmount) || 0;
  const previewTaxable = Math.max(0, previewSubtotal - previewDiscount);
  const previewTaxRate = Number(form.taxRate) || 0;
  const previewTax = (previewTaxable * previewTaxRate) / 100;
  const previewGrandTotal = previewTaxable + previewTax;

  const updateItem = (index, field, value) => {
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((item, idx) =>
        idx === index ? { ...item, [field]: value } : item
      ),
    }));
  };

  const addItemRow = () => {
    setForm((prev) => ({
      ...prev,
      items: [...prev.items, { description: '', quantity: '1', unitPrice: '0' }],
    }));
  };

  const removeItemRow = (index) => {
    if (form.items.length <= 1) return;
    setForm((prev) => ({
      ...prev,
      items: prev.items.filter((_, idx) => idx !== index),
    }));
  };

  const submitInvoice = async (targetStatus) => {
    setError('');

    if (!form.customerId) {
      setError('Please select a customer.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        customerId: Number(form.customerId),
        issueDate: form.issueDate,
        dueDate: form.dueDate,
        discountAmount: Number(form.discountAmount || 0),
        taxRate: Number(form.taxRate || 0),
        paymentInstructions: form.paymentInstructions,
        notes: form.notes,
        items: form.items.map((item) => ({
          description: item.description,
          quantity: Number(item.quantity),
          unitPrice: Number(item.unitPrice),
        })),
        ...(isEditMode ? {} : { status: targetStatus }),
      };

      const saved = isEditMode
        ? await updateInvoice(id, payload)
        : await createInvoice(payload);

      navigate(`/invoices/${saved.id}`);
    } catch (err) {
      setError(
        err.response?.data?.message || 'Failed to save invoice. Check your inputs.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="text-sm text-slate-500">Loading invoice editor...</div>;
  }

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link
            to="/invoices"
            className="text-xs font-semibold text-teal-600 hover:underline"
          >
            ← Back to Invoices
          </Link>
          <h1 className="text-2xl font-bold text-slate-900 mt-1">
            {isEditMode ? 'Edit Invoice' : 'Create New Invoice'}
          </h1>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {customers.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center space-y-3">
          <p className="text-base font-semibold text-slate-800">
            You need at least one customer before creating an invoice.
          </p>
          <Link
            to="/customers"
            className="inline-block px-4 py-2 rounded-lg bg-teal-600 text-white text-sm font-semibold hover:bg-teal-500"
          >
            Go to Customers
          </Link>
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submitInvoice('Draft');
          }}
          className="space-y-6"
        >
          {/* Header Fields */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-1">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Customer <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={form.customerId}
                onChange={(e) =>
                  setForm({ ...form, customerId: e.target.value })
                }
                className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="">Select a customer...</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.companyName ? ` (${c.companyName})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Issue Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                value={form.issueDate}
                onChange={(e) =>
                  setForm({ ...form, issueDate: e.target.value })
                }
                className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Due Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                value={form.dueDate}
                onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          {/* Line Items */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">
                Products &amp; Services
              </h2>
              <button
                type="button"
                onClick={addItemRow}
                className="px-3 py-1.5 rounded-lg border border-teal-600 text-teal-700 text-xs font-semibold hover:bg-teal-50 cursor-pointer"
              >
                + Add Line Item
              </button>
            </div>

            <div className="space-y-3">
              {form.items.map((item, index) => {
                const lineTotal =
                  (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);
                return (
                  <div
                    key={index}
                    className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end border-b border-slate-100 pb-3"
                  >
                    <div className="sm:col-span-5">
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        Description
                      </label>
                      <input
                        type="text"
                        required
                        value={item.description}
                        onChange={(e) =>
                          updateItem(index, 'description', e.target.value)
                        }
                        placeholder="Website design & development"
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        Qty
                      </label>
                      <input
                        type="number"
                        required
                        min="0.01"
                        step="0.01"
                        value={item.quantity}
                        onChange={(e) =>
                          updateItem(index, 'quantity', e.target.value)
                        }
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        Unit Price
                      </label>
                      <input
                        type="number"
                        required
                        min="0"
                        step="0.01"
                        value={item.unitPrice}
                        onChange={(e) =>
                          updateItem(index, 'unitPrice', e.target.value)
                        }
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                      />
                    </div>

                    <div className="sm:col-span-2 text-right">
                      <p className="text-xs text-slate-500 mb-1">Line Total</p>
                      <p className="text-sm font-semibold text-slate-900 py-2">
                        {currency} {lineTotal.toFixed(2)}
                      </p>
                    </div>

                    <div className="sm:col-span-1 text-right">
                      <button
                        type="button"
                        disabled={form.items.length <= 1}
                        onClick={() => removeItemRow(index)}
                        className="text-xs font-medium text-red-600 hover:underline disabled:opacity-30 py-2 cursor-pointer"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Totals, Discounts, Taxes & Notes */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Payment Instructions
                </label>
                <textarea
                  rows={3}
                  value={form.paymentInstructions}
                  onChange={(e) =>
                    setForm({ ...form, paymentInstructions: e.target.value })
                  }
                  placeholder="Bank transfer details, reference instructions..."
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Customer Notes
                </label>
                <textarea
                  rows={2}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Thank you for your business!"
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Discount Amount ({currency})
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.discountAmount}
                    onChange={(e) =>
                      setForm({ ...form, discountAmount: e.target.value })
                    }
                    className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    {taxLabel} Rate (%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={form.taxRate}
                    onChange={(e) =>
                      setForm({ ...form, taxRate: e.target.value })
                    }
                    className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>

              <div className="border-t border-slate-200 pt-4 space-y-2 text-sm">
                <SummaryRow label="Subtotal" value={`${currency} ${previewSubtotal.toFixed(2)}`} />
                <SummaryRow label="Discount" value={`- ${currency} ${previewDiscount.toFixed(2)}`} />
                <SummaryRow label="Taxable Amount" value={`${currency} ${previewTaxable.toFixed(2)}`} />
                <SummaryRow
                  label={`${taxLabel} (${previewTaxRate}%)`}
                  value={`${currency} ${previewTax.toFixed(2)}`}
                />
                <div className="flex justify-between items-center pt-2 border-t border-slate-200 text-base font-bold text-slate-900">
                  <span>Grand Total</span>
                  <span>
                    {currency} {previewGrandTotal.toFixed(2)}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 pt-1">
                  Final totals are authoritatively computed on the server using exact decimal arithmetic.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap justify-end gap-3">
            <Link
              to="/invoices"
              className="px-4 py-2.5 rounded-lg border border-slate-300 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </Link>
            {isEditMode ? (
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2.5 rounded-lg bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white text-sm font-semibold cursor-pointer"
              >
                {submitting ? 'Saving...' : 'Save Changes'}
              </button>
            ) : (
              <>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-50 text-slate-800 text-sm font-semibold cursor-pointer"
                >
                  {submitting ? 'Saving...' : 'Save as Draft'}
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => submitInvoice('Sent')}
                  className="px-5 py-2.5 rounded-lg bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white text-sm font-semibold cursor-pointer"
                >
                  {submitting ? 'Saving...' : 'Save & Mark as Sent'}
                </button>
              </>
            )}
          </div>
        </form>
      )}
    </div>
  );
}

function SummaryRow({ label, value }) {
  return (
    <div className="flex justify-between text-slate-600">
      <span>{label}</span>
      <span className="font-medium text-slate-800">{value}</span>
    </div>
  );
}

