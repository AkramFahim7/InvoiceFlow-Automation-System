import { useEffect, useState } from 'react';

const EMPTY_FORM = {
  name: '',
  companyName: '',
  email: '',
  phone: '',
  billingAddress: '',
  notes: '',
};

export default function CustomerFormModal({
  isOpen,
  initialCustomer,
  onClose,
  onSave,
}) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const isEditMode = Boolean(initialCustomer);

  useEffect(() => {
    if (isOpen) {
      setError('');
      setForm(
        initialCustomer
          ? {
              name: initialCustomer.name || '',
              companyName: initialCustomer.companyName || '',
              email: initialCustomer.email || '',
              phone: initialCustomer.phone || '',
              billingAddress: initialCustomer.billingAddress || '',
              notes: initialCustomer.notes || '',
            }
          : EMPTY_FORM
      );
    }
  }, [isOpen, initialCustomer]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!form.name.trim()) {
      setError('Customer name is required.');
      return;
    }

    setSubmitting(true);
    try {
      await onSave(form);
      onClose();
    } catch (err) {
      setError(
        err.response?.data?.message || 'Unable to save customer details.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
        <div className="bg-[#0F172A] text-white px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            {isEditMode ? 'Edit Customer' : 'Add New Customer'}
          </h2>
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Customer Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Nimali Fernando"
                className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Company Name (optional)
              </label>
              <input
                type="text"
                value={form.companyName}
                onChange={(e) =>
                  setForm({ ...form, companyName: e.target.value })
                }
                placeholder="Lanka Craft Co."
                className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Email Address
              </label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="billing@company.com"
                className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Phone Number
              </label>
              <input
                type="text"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+94 77 123 4567"
                className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Billing Address
            </label>
            <textarea
              rows={2}
              value={form.billingAddress}
              onChange={(e) =>
                setForm({ ...form, billingAddress: e.target.value })
              }
              placeholder="42 Galle Road, Colombo 03"
              className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Additional Notes
            </label>
            <textarea
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Preferred billing contact, payment terms..."
              className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white text-sm font-semibold transition-colors cursor-pointer"
            >
              {submitting
                ? 'Saving...'
                : isEditMode
                ? 'Update Customer'
                : 'Add Customer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

