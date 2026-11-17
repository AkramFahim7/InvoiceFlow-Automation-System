import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute, PublicOnlyRoute } from './components/ProtectedRoute';
import DashboardLayout from './layouts/DashboardLayout';

const LoginPage = lazy(() => import('./pages/LoginPage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const CustomersPage = lazy(() => import('./pages/CustomersPage'));
const CustomerDetailsPage = lazy(() => import('./pages/CustomerDetailsPage'));
const InvoicesPage = lazy(() => import('./pages/InvoicesPage'));
const InvoiceFormPage = lazy(() => import('./pages/InvoiceFormPage'));
const InvoiceDetailsPage = lazy(() => import('./pages/InvoiceDetailsPage'));
const PaymentsPage = lazy(() => import('./pages/PaymentsPage'));
const AutomationCenterPage = lazy(() => import('./pages/AutomationCenterPage'));
const AutomationHistoryPage = lazy(() => import('./pages/AutomationHistoryPage'));
const ReportsPage = lazy(() => import('./pages/ReportsPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const SystemCheckPage = lazy(() => import('./pages/SystemCheckPage'));

function PageFallback() {
  return (
    <div className="min-h-[50vh] flex items-center justify-center p-8">
      <div className="flex flex-col items-center gap-3 text-slate-500 text-sm">
        <div className="w-6 h-6 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
        <span>Loading workspace...</span>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Suspense fallback={<PageFallback />}>
          <Routes>
            {/* Public-only authentication routes */}
            <Route element={<PublicOnlyRoute />}>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
            </Route>

            {/* Protected SaaS workspace routes */}
            <Route element={<ProtectedRoute />}>
              <Route element={<DashboardLayout />}>
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/system-check" element={<SystemCheckPage />} />
                <Route path="/customers" element={<CustomersPage />} />
                <Route path="/customers/:id" element={<CustomerDetailsPage />} />
                <Route path="/invoices" element={<InvoicesPage />} />
                <Route path="/invoices/new" element={<InvoiceFormPage />} />
                <Route path="/invoices/:id" element={<InvoiceDetailsPage />} />
                <Route path="/invoices/:id/edit" element={<InvoiceFormPage />} />
                <Route path="/payments" element={<PaymentsPage />} />
                <Route path="/automation" element={<AutomationCenterPage />} />
                <Route
                  path="/automation/history"
                  element={<AutomationHistoryPage />}
                />
                <Route path="/reports" element={<ReportsPage />} />
              </Route>
            </Route>

            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  );
}
