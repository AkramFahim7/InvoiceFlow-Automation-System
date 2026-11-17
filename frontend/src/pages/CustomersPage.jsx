import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  createCustomer,
  deleteCustomer,
  getCustomers,
  updateCustomer,
} from '../api/customerApi';
import CustomerFormModal from '../components/CustomerFormModal';
import { useAuth } from '../context/AuthContext';

export default function CustomersPage() {
  const { businessProfile } = useAuth();
  const currency = businessProfile?.currencySymbol || 'Rs.';

  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const [feedback, setFeedback] = useState({ type: '', message: '' });

  const loadCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const list = await getCustomers({ search, filter });
      setCustomers(list);
    } catch (err) {
      setFeedback({
        type: 'error',
        message:
          err.response?.data?.message || 'Failed to load customers from server.',
      });
    } finally {
      setLoading(false);
    }
  }, [search, filter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadCustomers();
    }, 200);
    return () => clearTimeout(timer);
  }, [loadCustomers]);

  const handleOpenCreate = () => {
    setEditingCustomer(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (customer) => {
    setEditingCustomer(customer);
    setModalOpen(true);
  };

  const handleSaveCustomer = async (formData) => {
    if (editingCustomer) {
      await updateCustomer(editingCustomer.id, formData);
      setFeedback({ type: 'success', message: 'Customer updated successfully.' });
    } else {
      await createCustomer(formData);
      setFeedback({ type: 'success', message: 'Customer added successfully.' });
    }
    await loadCustomers();
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteCustomer(deleteTarget.id);
      setFeedback({
        type: 'success',
        message: `Deleted customer "${deleteTarget.name}".`,
      });
      setDeleteTarget(null);
      await loadCustomers();
    } catch (err) {
      setFeedback({
        type: 'error',
        message:
          err.response?.data?.message || 'Failed to delete customer.',
      });
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="max-w-6xl space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Customers</h1>
          <p className="text-sm text-slate-600 mt-1">
            Manage client contact details, billing addresses, and invoice history.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenCreate}
          className="px-4 py-2.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-sm font-semibold transition-colors cursor-pointer self-start sm:self-auto"
        >
          + Add Customer
        </button>
      </div>

      {/* Feedback Banner */}
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

      {/* Search & Filter Controls */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, company, email, or phone..."
          className="flex-1 rounded-lg border border-slate-300 px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
        />

        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="rounded-lg border border-slate-300 px-3.5 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
        >
          <option value="all">All Customers</option>
          <option value="with_email">Has Email (Automation Ready)</option>
          <option value="missing_email">Missing Email</option>
          <option value="has_invoices">With Invoices</option>
        </select>
      </div>

      {/* Customer Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">
            Loading customers...
          </div>
        ) : customers.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <p className="text-base font-semibold text-slate-800">
              {search || filter !== 'all'
                ? 'No customers match your search or filter.'
                : 'No customers added yet.'}
            </p>
            <p className="text-sm text-slate-500">
              {search || filter !== 'all'
                ? 'Try clearing your filters or searching with another term.'
                : 'Add your first customer to start preparing invoices.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <th className="px-5 py-3.5">Customer</th>
                  <th className="px-5 py-3.5">Email</th>
                  <th className="px-5 py-3.5">Phone</th>
                  <th className="px-5 py-3.5">Invoices</th>
                  <th className="px-5 py-3.5">Outstanding</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {customers.map((customer) => (
                  <tr key={customer.id} className="hover:bg-slate-50/70">
                    <td className="px-5 py-3.5">
                      <Link
                        to={`/customers/${customer.id}`}
                        className="font-semibold text-slate-900 hover:text-teal-600"
                      >
                        {customer.name}
                      </Link>
                      {customer.companyName && (
                        <p className="text-xs text-slate-500">
                          {customer.companyName}
                        </p>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      {customer.email ? (
                        <span className="text-slate-700">{customer.email}</span>
                      ) : (
                        <span className="inline-block text-xs font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                          No email
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-slate-600">
                      {customer.phone || '—'}
                    </td>
                    <td className="px-5 py-3.5 text-slate-700">
                      {customer.invoiceCount}
                    </td>
                    <td className="px-5 py-3.5 font-medium text-slate-800">
                      {currency} {customer.outstandingBalance.toFixed(2)}
                    </td>
                    <td className="px-5 py-3.5 text-right space-x-3 whitespace-nowrap">
                      <Link
                        to={`/customers/${customer.id}`}
                        className="text-teal-600 font-medium hover:underline"
                      >
                        View
                      </Link>
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(customer)}
                        className="text-slate-700 font-medium hover:underline cursor-pointer"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(customer)}
                        className="text-red-600 font-medium hover:underline cursor-pointer"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      <CustomerFormModal
        isOpen={modalOpen}
        initialCustomer={editingCustomer}
        onClose={() => setModalOpen(false)}
        onSave={handleSaveCustomer}
      />

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 p-6 space-y-4">
            <h2 className="text-lg font-bold text-slate-900">
              Delete Customer?
            </h2>
            <p className="text-sm text-slate-600">
              Are you sure you want to delete{' '}
              <span className="font-semibold text-slate-800">
                {deleteTarget.name}
              </span>
              ? Customers with existing invoices cannot be deleted.
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
                {deleting ? 'Deleting...' : 'Delete Customer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

