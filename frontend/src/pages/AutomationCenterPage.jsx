import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  getAutomationOverview,
  retryExecution,
  runScheduledChecks,
  updateWorkflow,
} from '../api/automationApi';

export default function AutomationCenterPage() {
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [daysDrafts, setDaysDrafts] = useState({});
  const [busyId, setBusyId] = useState(null);
  const [runningChecks, setRunningChecks] = useState(false);
  const [retryingId, setRetryingId] = useState(null);
  const [feedback, setFeedback] = useState({ type: '', message: '' });

  const loadOverview = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAutomationOverview();
      setOverview(data);
      const timingMap = {};
      for (const wf of data.workflows) {
        timingMap[wf.id] = String(wf.daysBeforeDue);
      }
      setDaysDrafts(timingMap);
    } catch (err) {
      setFeedback({
        type: 'error',
        message:
          err.response?.data?.message || 'Failed to load Automation Center.',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  const handleToggleWorkflow = async (wf) => {
    setBusyId(wf.id);
    setFeedback({ type: '', message: '' });
    try {
      const res = await updateWorkflow(wf.id, { isEnabled: !wf.isEnabled });
      setFeedback({ type: 'success', message: res.message });
      await loadOverview();
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err.response?.data?.message || 'Unable to update workflow.',
      });
    } finally {
      setBusyId(null);
    }
  };

  const handleSaveTiming = async (wf) => {
    setBusyId(wf.id);
    setFeedback({ type: '', message: '' });
    try {
      await updateWorkflow(wf.id, {
        daysBeforeDue: Number(daysDrafts[wf.id]),
      });
      setFeedback({
        type: 'success',
        message: `Reminder timing updated to ${daysDrafts[wf.id]} day(s) before due date.`,
      });
      await loadOverview();
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err.response?.data?.message || 'Unable to update timing.',
      });
    } finally {
      setBusyId(null);
    }
  };

  const handleRunChecks = async () => {
    setRunningChecks(true);
    setFeedback({ type: '', message: '' });
    try {
      const res = await runScheduledChecks();
      setFeedback({ type: 'success', message: res.message });
      await loadOverview();
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err.response?.data?.message || 'Scheduler run failed.',
      });
    } finally {
      setRunningChecks(false);
    }
  };

  const handleRetry = async (executionId) => {
    setRetryingId(executionId);
    setFeedback({ type: '', message: '' });
    try {
      const res = await retryExecution(executionId);
      setFeedback({ type: 'success', message: res.message });
      await loadOverview();
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err.response?.data?.message || 'Retry failed.',
      });
      await loadOverview();
    } finally {
      setRetryingId(null);
    }
  };

  if (loading && !overview) {
    return <div className="text-sm text-slate-500">Loading Automation Center...</div>;
  }

  const stats = overview?.stats || {};
  const workflows = overview?.workflows || [];
  const recent = overview?.recentExecutions || [];

  return (
    <div className="max-w-6xl space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Automation Center</h1>
          <p className="text-sm text-slate-600 mt-1">
            Configure workflows, reminder timing, and monitor background job runs.
            {overview?.scheduler?.enabled && (
              <span className="ml-2 inline-block text-xs font-medium px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200">
                Cron: {overview.scheduler.cronSchedule}
              </span>
            )}
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            to="/automation/history"
            className="px-4 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-sm font-medium text-slate-700"
          >
            Execution History
          </Link>
          <button
            type="button"
            disabled={runningChecks}
            onClick={handleRunChecks}
            className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white text-sm font-semibold cursor-pointer"
          >
            {runningChecks ? 'Running Checks...' : 'Run Scheduled Checks Now'}
          </button>
        </div>
      </div>

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

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <StatCard label="Total Workflows" value={stats.totalWorkflows ?? 0} />
        <StatCard
          label="Active Workflows"
          value={stats.activeWorkflows ?? 0}
          valueColor="text-teal-600"
        />
        <StatCard
          label="Disabled Workflows"
          value={stats.disabledWorkflows ?? 0}
          valueColor="text-slate-500"
        />
        <StatCard
          label="Successful Runs"
          value={stats.successfulExecutions ?? 0}
          valueColor="text-emerald-600"
        />
        <StatCard
          label="Failed Runs"
          value={stats.failedExecutions ?? 0}
          valueColor="text-red-600"
        />
      </div>

      {/* Workflow Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {workflows.map((wf) => (
          <div
            key={wf.id}
            className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col justify-between space-y-4"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="inline-block text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                  Trigger: {wf.triggerEvent}
                </span>
                <h2 className="text-base font-bold text-slate-900 mt-2">
                  {wf.name}
                </h2>
                <p className="text-sm text-slate-600 mt-1">{wf.description}</p>
              </div>

              <button
                type="button"
                disabled={busyId === wf.id}
                onClick={() => handleToggleWorkflow(wf)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors cursor-pointer shrink-0 ${
                  wf.isEnabled
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                    : 'bg-slate-100 text-slate-600 border-slate-300 hover:bg-slate-200'
                }`}
              >
                {wf.isEnabled ? 'Enabled' : 'Disabled'}
              </button>
            </div>

            {wf.workflowKey === 'PAYMENT_REMINDER' && (
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg p-3">
                <label className="text-xs font-medium text-slate-700">
                  Send reminder
                </label>
                <input
                  type="number"
                  min="0"
                  max="60"
                  value={daysDrafts[wf.id] ?? '3'}
                  onChange={(e) =>
                    setDaysDrafts({ ...daysDrafts, [wf.id]: e.target.value })
                  }
                  className="w-16 rounded border border-slate-300 px-2 py-1 text-xs bg-white"
                />
                <span className="text-xs text-slate-600">
                  day(s) before due date
                </span>
                <button
                  type="button"
                  disabled={busyId === wf.id}
                  onClick={() => handleSaveTiming(wf)}
                  className="ml-auto px-3 py-1 rounded bg-[#0F172A] text-white text-xs font-semibold hover:bg-slate-800 cursor-pointer"
                >
                  Save
                </button>
              </div>
            )}

            <div className="flex items-center justify-between text-xs text-slate-500 border-t border-slate-100 pt-3">
              <span>Success: {wf.successCount}</span>
              <span>Failed: {wf.failedCount}</span>
              <span>Total Runs: {wf.totalExecutions}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Recent Executions */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">
            Recent Automation Activities
          </h2>
          <Link
            to="/automation/history"
            className="text-xs font-semibold text-teal-600 hover:underline"
          >
            View All History →
          </Link>
        </div>

        {recent.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            No automation executions recorded yet. Mark an invoice as Sent or click &ldquo;Run Scheduled Checks Now&rdquo;.
          </div>
        ) : (
          <div className="divide-y divide-slate-200 text-sm">
            {recent.map((exec) => (
              <div
                key={exec.id}
                className="px-6 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-900">
                      {exec.workflowName}
                    </span>
                    {exec.invoiceNumber && (
                      <Link
                        to={`/invoices/${exec.invoiceId}`}
                        className="text-xs font-semibold text-teal-600 hover:underline"
                      >
                        {exec.invoiceNumber}
                      </Link>
                    )}
                  </div>
                  <p className="text-xs text-slate-600">{exec.message}</p>
                  {exec.errorMessage && (
                    <p className="text-xs text-red-600">
                      Error: {exec.errorMessage}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <ExecutionStatusPill status={exec.status} />
                  {exec.canRetry && (
                    <button
                      type="button"
                      disabled={retryingId === exec.id}
                      onClick={() => handleRetry(exec.id)}
                      className="px-2.5 py-1 rounded bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-xs font-semibold cursor-pointer"
                    >
                      {retryingId === exec.id ? 'Retrying...' : 'Retry'}
                    </button>
                  )}
                  <span className="text-xs text-slate-400">
                    {new Date(exec.executedAt).toLocaleString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, valueColor = 'text-slate-900' }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
        {label}
      </p>
      <p className={`text-2xl font-bold mt-1 ${valueColor}`}>{value}</p>
    </div>
  );
}

export function ExecutionStatusPill({ status }) {
  const styles =
    status === 'SUCCESS'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
      : status === 'FAILED'
      ? 'bg-red-50 text-red-700 border-red-200'
      : 'bg-slate-100 text-slate-600 border-slate-200';
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold border ${styles}`}
    >
      {status}
    </span>
  );
}

