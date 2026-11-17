import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function SettingsPage() {
  const { user, businessProfile, updateProfile, uploadLogo } = useAuth();
  const apiOrigin = (
    import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api'
  ).replace(/\/api\/?$/, '');

  const [form, setForm] = useState({
    fullName: '',
    businessName: '',
    businessEmail: '',
    phone: '',
    address: '',
    taxLabel: 'Tax',
    defaultTaxRate: 0,
    currencySymbol: 'Rs.',
    invoicePrefix: 'INV-',
    paymentInstructions: '',
  });
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (user && businessProfile) {
      setForm({
        fullName: user.fullName || '',
        businessName: businessProfile.businessName || '',
        businessEmail: businessProfile.businessEmail || '',
        phone: businessProfile.phone || '',
        address: businessProfile.address || '',
        taxLabel: businessProfile.taxLabel || 'Tax',
        defaultTaxRate: businessProfile.defaultTaxRate ?? 0,
        currencySymbol: businessProfile.currencySymbol || 'Rs.',
        invoicePrefix: businessProfile.invoicePrefix || 'INV-',
        paymentInstructions: businessProfile.paymentInstructions || '',
      });
    }
  }, [user, businessProfile]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMessage('');
    setErrorMessage('');

    try {
      await updateProfile(form);
      setSuccessMessage('Business profile and invoicing defaults saved.');
    } catch (err) {
      setErrorMessage(
        err.response?.data?.message || 'Failed to update profile.'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleLogoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSuccessMessage('');
    setErrorMessage('');

    if (!['image/png', 'image/jpeg'].includes(file.type)) {
      setErrorMessage('Please select a PNG or JPEG image file.');
      return;
    }
    if (file.size > 1024 * 1024) {
      setErrorMessage('Logo image must be 1 MB or smaller.');
      return;
    }

    setUploadingLogo(true);
    try {
      await uploadLogo(file);
      setSuccessMessage('Business logo uploaded and ready for PDF invoices.');
    } catch (err) {
      setErrorMessage(
        err.response?.data?.message || 'Failed to upload business logo.'
      );
    } finally {
      setUploadingLogo(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Business Settings</h1>
        <p className="text-sm text-slate-600 mt-1">
          Manage your account profile, branding logo, tax defaults, and invoice formatting.
        </p>
      </div>

      {/* Business Logo Upload Card */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          {businessProfile?.logoUrl ? (
            <img
              src={`${apiOrigin}${businessProfile.logoUrl}?t=${Date.now()}`}
              alt="Business logo"
              className="w-14 h-14 rounded-xl object-contain border border-slate-200 bg-slate-50 p-1"
            />
          ) : (
            <div className="w-14 h-14 rounded-xl bg-[#0F172A] text-teal-400 font-bold flex items-center justify-center text-lg">
              {(businessProfile?.businessName || 'IF').slice(0, 2).toUpperCase()}
            </div>
          )}
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Business Logo (PDF Header)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              PNG or JPEG, max 1 MB. Shown on invoice previews and generated PDFs.
            </p>
          </div>
        </div>

        <label className="px-4 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-sm font-medium text-slate-700 cursor-pointer">
          {uploadingLogo ? 'Uploading...' : 'Upload Logo'}
          <input
            type="file"
            accept="image/png,image/jpeg"
            onChange={handleLogoChange}
            disabled={uploadingLogo}
            className="hidden"
          />
        </label>
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-xl border border-slate-200 p-6 space-y-5"
      >
        {successMessage && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {successMessage}
          </div>
        )}
        {errorMessage && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMessage}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <InputField
            label="Your Full Name"
            required
            value={form.fullName}
            onChange={(val) => setForm({ ...form, fullName: val })}
          />
          <InputField
            label="Business Name"
            required
            value={form.businessName}
            onChange={(val) => setForm({ ...form, businessName: val })}
          />
          <InputField
            label="Business Email"
            type="email"
            value={form.businessEmail}
            onChange={(val) => setForm({ ...form, businessEmail: val })}
          />
          <InputField
            label="Phone Number"
            value={form.phone}
            onChange={(val) => setForm({ ...form, phone: val })}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Business Address
          </label>
          <textarea
            rows={2}
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <InputField
            label="Tax Label"
            value={form.taxLabel}
            onChange={(val) => setForm({ ...form, taxLabel: val })}
          />
          <InputField
            label="Default Tax (%)"
            type="number"
            min="0"
            max="100"
            step="0.01"
            value={form.defaultTaxRate}
            onChange={(val) => setForm({ ...form, defaultTaxRate: val })}
          />
          <InputField
            label="Currency Symbol"
            value={form.currencySymbol}
            onChange={(val) => setForm({ ...form, currencySymbol: val })}
          />
          <InputField
            label="Invoice Prefix"
            value={form.invoicePrefix}
            onChange={(val) => setForm({ ...form, invoicePrefix: val })}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Default Payment Instructions
          </label>
          <textarea
            rows={3}
            value={form.paymentInstructions}
            onChange={(e) =>
              setForm({ ...form, paymentInstructions: e.target.value })
            }
            placeholder="Bank name, account number, or payment terms..."
            className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>

        <div className="pt-2 flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2.5 rounded-lg bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white text-sm font-semibold transition-colors cursor-pointer"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </form>
    </div>
  );
}

function InputField({ label, value, onChange, type = 'text', ...rest }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
        {...rest}
      />
    </div>
  );
}

