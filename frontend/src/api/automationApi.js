import axiosClient from './axiosClient';

export async function getAutomationOverview() {
  const res = await axiosClient.get('/automation/overview');
  return res.data.data;
}

export async function updateWorkflow(id, payload) {
  const res = await axiosClient.patch(`/automation/workflows/${id}`, payload);
  return res.data;
}

export async function getAutomationExecutions({
  status = 'all',
  workflowId = '',
  limit = 100,
} = {}) {
  const params = { status, limit };
  if (workflowId) params.workflowId = workflowId;
  const res = await axiosClient.get('/automation/executions', { params });
  return res.data.data;
}

export async function retryExecution(executionId) {
  const res = await axiosClient.post(`/automation/executions/${executionId}/retry`);
  return res.data;
}

export async function runScheduledChecks() {
  const res = await axiosClient.post('/automation/run-checks');
  return res.data;
}

