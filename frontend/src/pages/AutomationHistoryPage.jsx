import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  getAutomationExecutions,
  getAutomationOverview,
  retryExecution,
} from '../api/automationApi';
import { ExecutionStatusPill } from './AutomationCenterPage';

export default function AutomationHistoryPage() {
  const [executions, setExecutions] = useState([]);
  const [workflows, setWorkflows] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [workflowFilter, setWorkflowFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [retryingId, setRetryingId] = useState(null);
  const [feedback, setFeedback] = useState({ type: '', message: '' });

  const loadHistory = useCallback(async () => {
    setLoading(true);
    try {
      const [execList, overview] = await Promise.all([
        getAutomationExecutions({
          status: statusFilter,
          workflowId: workflowFilter,
          limit: 100,
        }),
        getAutomationOverview(),
      ]);
      setExecutions(execList);
      setWorkflows(overview.workflows || []);
    } catch (err) {
      setFeedback({
        type: 'error',
        message:
          err.response?.data?.message || 'Unable to load execution history.',
      });
    } finally {
      setLoading(false);
    }
  }, [statusFilter, workflowFilter]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const handleRetry = async (executionId) => {
    setRetryingId(executionId);
    setFeedback({ type: '', message: '' });
    try {
      const res = await retryExecution(executionId);
      setFeedback({ type: 'success', message: res.message });
      await loadHistory();
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err.response?.data?.message || 'Retry failed.',
      });
      await loadHistory();
    } finally {
      setRetryingId(null);
    }
  };

  return (
    <div className="max-w-6xl space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <Link
            to="/automation"
            className="text-xs font-semibold text-teal-600 hover:underline"
          >
            ← Back to Automation Center
          </Link>
          <h1 className="text-2xl font-bold text-slate-900 mt-1">
            Automation Execution History
          </h1>
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

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col sm:flex-row gap-3">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-slate-300 px-3.5 py-2 text-sm bg-white"
        >
          <option value="all">All Statuses</option>
          <option value="SUCCESS">SUCCESS</option>
          <option value="FAILED">FAILED</option>
          <option value="SKIPPED">SKIPPED</option>
        </select>

        <select
          value={workflowFilter}
          onChange={(e) => setWorkflowFilter(e.target.value)}
          className="rounded-lg border border-slate-300 px-3.5 py-2 text-sm bg-white"
        >
          <option value="">All Workflows</option>
          {workflows.map((wf) => (
            <option key={wf.id} value={wf.id}>
              {wf.name}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">
            Loading execution logs...
          </div>
        ) : executions.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">
            No automation executions match your selected filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <th className="px-5 py-3.5">Executed At</th>
                  <th className="px-5 py-3.5">Workflow</th>
                  <th className="px-5 py-3.5">Invoice</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5">Details / Error</th>
                  <th className="px-5 py-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {executions.map((exec) => (
                  <tr key={exec.id} className="hover:bg-slate-50/70">
                    <td className="px-5 py-3.5 text-xs text-slate-500 whitespace-nowrap">
                      {new Date(exec.executedAt).toLocaleString()}
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="font-semibold text-slate-900">
                        {exec.workflowName}
                      </p>
                      <p className="text-xs text-slate-500">
                        {exec.triggerEvent}
                      </p>
                    </td>
                    <td className="px-5 py-3.5">
                      {exec.invoiceNumber ? (
                        <Link
                          to={`/invoices/${exec.invoiceId}`}
                          className="font-semibold text-teal-600 hover:underline"
                        >
                          {exec.invoiceNumber}
                        </Link>
                      ) : (
                        '—'
                      )}
                      {exec.customerName && (
                        <p className="text-xs text-slate-500">
                          {exec.customerName}
                        </p>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <ExecutionStatusPill status={exec.status} />
                    </td>
                    <td className="px-5 py-3.5 max-w-md">
                      <p className="text-slate-700 text-xs">{exec.message}</p>
                      {exec.errorMessage && (
                        <p className="text-red-600 text-xs mt-0.5">
                          {exec.errorMessage}
                        </p>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-right whitespace-nowrap">
                      {exec.canRetry ? (
                        <button
                          type="button"
                          disabled={retryingId === exec.id}
                          onClick={() => handleRetry(exec.id)}
                          className="px-3 py-1 rounded bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-xs font-semibold cursor-pointer"
                        >
                          {retryingId === exec.id ? 'Retrying...' : 'Retry'}
                        </button>
                      ) : exec.isResolved ? (
                        <span className="text-xs text-emerald-600 font-medium">
                          Resolved
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

