const env = require('../config/env');
const automationModel = require('../models/automation.model');
const engine = require('../automation/engine');
const { runScheduledInvoiceChecks } = require('../automation/scheduler');
const AppError = require('../utils/appError');

function formatWorkflow(w) {
  return {
    id: w.id,
    workflowKey: w.workflow_key,
    name: w.name,
    description: w.description || '',
    triggerEvent: w.trigger_event,
    isEnabled: Boolean(w.is_enabled),
    daysBeforeDue: Number(w.days_before_due),
    totalExecutions: Number(w.total_executions || 0),
    successCount: Number(w.success_count || 0),
    failedCount: Number(w.failed_count || 0),
  };
}

function formatExecution(r) {
  const message = r.message || '';
  const isResolved = message.startsWith('[Resolved by Retry');
  return {
    id: r.id,
    workflowId: r.workflow_id,
    workflowKey: r.workflow_key,
    workflowName: r.workflow_name,
    invoiceId: r.invoice_id,
    invoiceNumber: r.invoice_number || '',
    customerName: r.customer_name || '',
    paymentId: r.payment_id,
    triggerEvent: r.trigger_event,
    status: r.status,
    message,
    errorMessage: r.error_message || '',
    executedAt: r.executed_at,
    canRetry: r.status === 'FAILED' && !isResolved,
    isResolved,
  };
}

async function getOverview(req, res, next) {
  try {
    const [stats, workflows, recentExecutions] = await Promise.all([
      automationModel.getAutomationStatsByUser(req.user.id),
      automationModel.findWorkflowsByUser(req.user.id),
      automationModel.findExecutionsByUser(req.user.id, { limit: 8 }),
    ]);

    res.status(200).json({
      status: 'ok',
      data: {
        stats,
        scheduler: {
          enabled: env.cron.enabled,
          cronSchedule: env.cron.schedule,
        },
        workflows: workflows.map(formatWorkflow),
        recentExecutions: recentExecutions.map(formatExecution),
      },
    });
  } catch (error) {
    next(error);
  }
}

async function listWorkflows(req, res, next) {
  try {
    const workflows = await automationModel.findWorkflowsByUser(req.user.id);
    res.status(200).json({
      status: 'ok',
      data: workflows.map(formatWorkflow),
    });
  } catch (error) {
    next(error);
  }
}

async function updateWorkflow(req, res, next) {
  try {
    const workflowId = Number(req.params.id);
    if (!Number.isInteger(workflowId) || workflowId <= 0) {
      throw new AppError('Invalid workflow ID.', 400);
    }

    const existing = await automationModel.findWorkflowByIdAndUser(
      workflowId,
      req.user.id
    );
    if (!existing) {
      throw new AppError('Automation workflow not found.', 404);
    }

    const nextEnabled =
      typeof req.body.isEnabled === 'boolean'
        ? req.body.isEnabled
        : Boolean(existing.is_enabled);

    let nextDays = Number(existing.days_before_due);
    if (req.body.daysBeforeDue !== undefined) {
      const parsedDays = Number(req.body.daysBeforeDue);
      if (!Number.isInteger(parsedDays) || parsedDays < 0 || parsedDays > 60) {
        throw new AppError(
          'Reminder timing (days before due) must be an integer between 0 and 60.',
          400
        );
      }
      nextDays = parsedDays;
    }

    const updated = await automationModel.updateWorkflowByIdAndUser(
      workflowId,
      req.user.id,
      { isEnabled: nextEnabled, daysBeforeDue: nextDays }
    );

    res.status(200).json({
      status: 'ok',
      message: `${updated.name} ${updated.is_enabled ? 'enabled' : 'disabled'}.`,
      data: formatWorkflow(updated),
    });
  } catch (error) {
    next(error);
  }
}

async function listExecutions(req, res, next) {
  try {
    const status = ['SUCCESS', 'FAILED', 'SKIPPED'].includes(req.query.status)
      ? req.query.status
      : 'all';
    const workflowId = req.query.workflowId ? Number(req.query.workflowId) : null;

    const rows = await automationModel.findExecutionsByUser(req.user.id, {
      status,
      workflowId,
      limit: req.query.limit || 100,
    });

    res.status(200).json({
      status: 'ok',
      data: rows.map(formatExecution),
    });
  } catch (error) {
    next(error);
  }
}

async function retryExecution(req, res, next) {
  try {
    const executionId = Number(req.params.id);
    if (!Number.isInteger(executionId) || executionId <= 0) {
      throw new AppError('Invalid execution ID.', 400);
    }

    const result = await engine.retryFailedExecution(req.user.id, executionId);
    if (!result.retriedOk) {
      return res.status(400).json({
        status: 'error',
        message: result.reason || 'Retry failed.',
        data: result,
      });
    }

    res.status(200).json({
      status: 'ok',
      message: 'Failed execution retried successfully.',
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

async function runChecks(req, res, next) {
  try {
    const summary = await runScheduledInvoiceChecks({ userId: req.user.id });
    res.status(200).json({
      status: 'ok',
      message: `Checked ${summary.remindersProcessed} reminder candidate(s) and ${summary.overdueProcessed} overdue candidate(s).`,
      data: summary,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getOverview,
  listWorkflows,
  updateWorkflow,
  listExecutions,
  retryExecution,
  runChecks,
};
