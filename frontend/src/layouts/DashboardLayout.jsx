import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const NAV_ITEMS = [
  { label: 'Dashboard', to: '/dashboard', badge: 'Active' },
  { label: 'Customers', to: '/customers', badge: 'Active' },
  { label: 'Invoices', to: '/invoices', badge: 'Active' },
  { label: 'Payments', to: '/payments', badge: 'Active' },
  { label: 'Automation Center', to: '/automation', badge: 'Active' },
  { label: 'Reports', to: '/reports', badge: 'Active' },
  { label: 'Settings', to: '/settings', badge: 'Active' },
  { label: 'System Check', to: '/system-check', badge: 'Active' },
];

export default function DashboardLayout() {
  const { user, businessProfile, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-slate-100 flex print:bg-white">
      {/* Sidebar */}
      <aside aria-label="Sidebar Navigation" className="w-64 bg-[#0F172A] text-slate-200 flex flex-col shrink-0 print:hidden">
        <div className="px-6 py-5 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-600 flex items-center justify-center font-bold text-white text-sm">
              IF
            </div>
            <div>
              <span className="font-bold text-white tracking-tight block leading-none">
                InvoiceFlow
              </span>
              <span className="text-[11px] text-slate-300">
                Automation Platform
              </span>
            </div>
          </div>
        </div>

        <nav aria-label="Main Navigation" className="flex-1 px-3 py-4 space-y-1">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-teal-600 text-white'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`
              }
            >
              <span>{item.label}</span>
              <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-800/80 text-slate-300">
                {item.badge}
              </span>
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-800 text-xs text-slate-300">
          <p className="font-medium text-slate-200 truncate">
            {businessProfile?.businessName}
          </p>
          <p className="truncate mt-0.5 text-slate-300">{user?.email}</p>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between print:hidden">
          <div>
            <p className="text-xs text-slate-500">Workspace</p>
            <p className="text-sm font-semibold text-slate-800">
              {businessProfile?.businessName || 'My Business'}
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium text-slate-800">{user?.fullName}</p>
              <p className="text-xs text-slate-500">Account ID #{user?.id}</p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              aria-label="Log out of InvoiceFlow"
              className="px-3.5 py-1.5 text-sm font-medium rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Logout
            </button>
          </div>
        </header>

        <main className="flex-1 p-6 print:p-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

