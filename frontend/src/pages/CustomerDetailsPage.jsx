import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  deleteCustomer,
  getCustomerById,
  updateCustomer,
} from '../api/customerApi';
import CustomerFormModal from '../components/CustomerFormModal';
import { useAuth } from '../context/AuthContext';

export default function CustomerDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { businessProfile } = useAuth();
  const currency = businessProfile?.currencySymbol || 'Rs.';

  const [customer, setCustomer] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editOpen, setEditOpen] = useState(false);

  const loadDetails = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getCustomerById(id);
      setCustomer(data.customer);
      setInvoices(data.invoices);
    } catch (err) {
      setError(
        err.response?.data?.message || 'Unable to load customer profile.'
      );
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadDetails();
  }, [loadDetails]);

  const handleSaveEdit = async (formData) => {
    await updateCustomer(customer.id, formData);
    await loadDetails();
  };

  const handleDelete = async () => {
    try {
      await deleteCustomer(customer.id);
      navigate('/customers');
    } catch (err) {
      setError(err.response?.data?.message || 'Cannot delete customer.');
    }
  };

  if (loading) {
    return <div className="text-sm text-slate-500">Loading customer profile...</div>;
  }

  if (error && !customer) {
    return (
      <div className="max-w-3xl space-y-4">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
        <Link
          to="/customers"
          className="inline-block text-sm font-semibold text-teal-600 hover:underline"
        >
          ← Back to Customers
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <Link
            to="/customers"
            className="text-xs font-semibold text-teal-600 hover:underline"
          >
            ← Back to Customers
          </Link>
          <h1 className="text-2xl font-bold text-slate-900 mt-1">
            {customer.name}
          </h1>
          {customer.companyName && (
            <p className="text-sm text-slate-600">{customer.companyName}</p>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setEditOpen(true)}
            className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
          >
            Edit Customer
          </button>
          <button
            type="button"
            onClick={handleDelete}
            className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-semibold cursor-pointer"
          >
            Delete
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Profile Details */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
        <DetailItem label="Email Address" value={customer.email || 'Not provided (automated emails disabled)'} />
        <DetailItem label="Phone Number" value={customer.phone || 'Not provided'} />
        <DetailItem label="Billing Address" value={customer.billingAddress || 'Not provided'} />
        <DetailItem label="Additional Notes" value={customer.notes || 'None'} />
      </div>

      {/* Associated Invoices */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">
            Associated Invoices ({invoices.length})
          </h2>
        </div>

        {invoices.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            No invoices found for this customer yet. Invoices created in Phase 4 will appear here.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <th className="px-5 py-3">Invoice #</th>
                  <th className="px-5 py-3">Issue Date</th>
                  <th className="px-5 py-3">Due Date</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Total</th>
                  <th className="px-5 py-3 text-right">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3 font-semibold text-slate-900">
                      <Link
                        to={`/invoices/${inv.id}`}
                        className="text-teal-600 hover:underline"
                      >
                        {inv.invoiceNumber}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-slate-600">
                      {String(inv.issueDate).slice(0, 10)}
                    </td>
                    <td className="px-5 py-3 text-slate-600">
                      {String(inv.dueDate).slice(0, 10)}
                    </td>
                    <td className="px-5 py-3">{inv.status}</td>
                    <td className="px-5 py-3 text-right font-medium">
                      {currency} {inv.grandTotal.toFixed(2)}
                    </td>
                    <td className="px-5 py-3 text-right font-medium">
                      {currency} {inv.remainingBalance.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <CustomerFormModal
        isOpen={editOpen}
        initialCustomer={customer}
        onClose={() => setEditOpen(false)}
        onSave={handleSaveEdit}
      />
    </div>
  );
}

function DetailItem({ label, value }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
        {label}
      </p>
      <p className="text-sm text-slate-800 mt-1 whitespace-pre-line">{value}</p>
    </div>
  );
}

