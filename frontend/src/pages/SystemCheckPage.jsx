import { useEffect, useState } from 'react';
import axiosClient from '../api/axiosClient';

export default function SystemCheckPage() {
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const checkSystemHealth = async () => {
    setLoading(true);
    setErrorMessage('');
    try {
      const response = await axiosClient.get('/health');
      setHealth(response.data);
    } catch (err) {
      // Backend may still return JSON (503) when MySQL is down
      if (err.response?.data) {
        setHealth(err.response.data);
      } else {
        setHealth(null);
        setErrorMessage(
          err.message || 'Unable to reach the InvoiceFlow backend server.'
        );
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkSystemHealth();
  }, []);

  const isBackendUp = Boolean(health);
  const isDatabaseUp = Boolean(health?.database?.connected);

  return (
    <div className="max-w-3xl">
      <div className="w-full bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Top Header */}
        <div className="bg-[#0F172A] text-white px-6 py-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-teal-400">
              Phase 1 — Project Foundation
            </p>
            <h1 className="text-xl font-bold mt-1">InvoiceFlow System Check</h1>
          </div>
          <button
            type="button"
            onClick={checkSystemHealth}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-teal-600 hover:bg-teal-500 disabled:opacity-50 transition-colors cursor-pointer"
          >
            {loading ? 'Checking...' : 'Re-test Connection'}
          </button>
        </div>

        {/* Status Cards */}
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatusCard
              title="React Frontend"
              status="Connected"
              detail="Vite + React Router + Axios"
              ok={true}
            />
            <StatusCard
              title="Express Backend"
              status={loading ? 'Checking...' : isBackendUp ? 'Connected' : 'Unreachable'}
              detail={isBackendUp ? 'http://localhost:5000' : 'Start backend server'}
              ok={isBackendUp}
              loading={loading}
            />
            <StatusCard
              title="MySQL Database"
              status={loading ? 'Checking...' : isDatabaseUp ? 'Connected' : 'Disconnected'}
              detail={
                isDatabaseUp
                  ? `${health.database.database} (v${health.database.version})`
                  : health?.database?.code || 'Check XAMPP MySQL'
              }
              ok={isDatabaseUp}
              loading={loading}
            />
          </div>

          {errorMessage && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              <strong className="font-semibold">Backend Error:</strong> {errorMessage}
            </div>
          )}

          {!loading && health && !isDatabaseUp && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              <strong className="font-semibold">Database Not Connected:</strong>{' '}
              {health.database?.message || 'Ensure MySQL is running and invoiceflow_db exists.'}
            </div>
          )}

          {health && (
            <div className="rounded-lg bg-slate-900 text-slate-100 p-4 text-xs font-mono overflow-x-auto">
              <p className="text-slate-400 mb-2">GET /api/health response:</p>
              <pre>{JSON.stringify(health, null, 2)}</pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusCard({ title, status, detail, ok, loading }) {
  const badgeStyle = loading
    ? 'bg-slate-100 text-slate-600'
    : ok
    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
    : 'bg-red-50 text-red-700 border border-red-200';

  return (
    <div className="rounded-xl border border-slate-200 p-4 bg-slate-50/50">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${badgeStyle}`}>
          {status}
        </span>
      </div>
      <p className="text-xs text-slate-500 mt-2 truncate" title={detail}>
        {detail}
      </p>
    </div>
  );
}

