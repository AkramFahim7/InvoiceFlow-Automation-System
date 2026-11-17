const automationModel = require('../models/automation.model');
const invoiceService = require('../services/invoice.service');
const conditions = require('./conditions');
const actions = require('./actions');
const { TRIGGERS, WORKFLOW_KEYS, EXECUTION_STATUS } = require('./constants');

function getTodayDateString() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Declarative workflow definitions connecting:
 *   TRIGGER -> CONDITION PIPELINE -> ACTION -> EXECUTION LOG
 */
const WORKFLOW_REGISTRY = {
  [WORKFLOW_KEYS.INVOICE_SENT_EMAIL]: {
    trigger: TRIGGERS.INVOICE_SENT,
    evaluate: async ({ workflow, invoice }) =>
      conditions.evaluateConditionPipeline([
        conditions.checkWorkflowEnabled(workflow),
        conditions.checkInvoiceUnpaid(invoice),
        conditions.checkCustomerEmailExists(invoice),
      ]),
    execute: async ({ userId, invoice }) =>
      actions.executeSendInvoiceEmail({ userId, invoice }),
  },

  [WORKFLOW_KEYS.PAYMENT_REMINDER]: {
    trigger: TRIGGERS.DUE_DATE_APPROACHING,
    evaluate: async ({ workflow, invoice, todayDate }) => {
      const stage = `BEFORE_DUE_${workflow?.days_before_due ?? 3}_DAYS`;
      const alreadyRecorded = await automationModel.hasReminderRecord(
        invoice.id,
        WORKFLOW_KEYS.PAYMENT_REMINDER,
        stage
      );

      return conditions.evaluateConditionPipeline([
        conditions.checkWorkflowEnabled(workflow),
        conditions.checkNotAlreadyExecuted(alreadyRecorded),
        conditions.checkDueDateWithinDays(
          invoice,
          workflow?.days_before_due ?? 3,
          todayDate
        ),
        conditions.checkCustomerEmailExists(invoice),
      ]);
    },
    execute: async ({ userId, workflow, invoice }) => {
      const stage = `BEFORE_DUE_${workflow?.days_before_due ?? 3}_DAYS`;
      return actions.executePaymentReminder({
        userId,
        invoice,
        reminderStage: stage,
      });
    },
  },

  [WORKFLOW_KEYS.OVERDUE_NOTIFICATION]: {
    trigger: TRIGGERS.INVOICE_OVERDUE,
    evaluate: async ({ workflow, invoice, todayDate }) => {
      const stage = 'OVERDUE_INITIAL';
      const alreadyRecorded = await automationModel.hasReminderRecord(
        invoice.id,
        WORKFLOW_KEYS.OVERDUE_NOTIFICATION,
        stage
      );

      return conditions.evaluateConditionPipeline([
        conditions.checkWorkflowEnabled(workflow),
        conditions.checkNotAlreadyExecuted(alreadyRecorded),
        conditions.checkDueDatePassed(invoice, todayDate),
      ]);
    },
    execute: async ({ userId, invoice }) =>
      actions.executeOverdueNotification({
        userId,
        invoice,
        reminderStage: 'OVERDUE_INITIAL',
      }),
  },

  [WORKFLOW_KEYS.PAYMENT_CONFIRMATION]: {
    trigger: TRIGGERS.PAYMENT_RECEIVED,
    evaluate: async ({ workflow, invoice }) =>
      conditions.evaluateConditionPipeline([
        conditions.checkWorkflowEnabled(workflow),
        conditions.checkCustomerEmailExists(invoice),
      ]),
    execute: async ({ userId, paymentId }) =>
      actions.executePaymentConfirmation({ userId, paymentId }),
  },
};

/**
 * Evaluate and execute all workflows bound to a trigger event.
 * Never throws to callers so failed emails cannot corrupt core transactions.
 */
async function emitTrigger(triggerEvent, context) {
  const { userId, invoiceId, paymentId = null, todayDate = getTodayDateString() } =
    context;
  const results = [];

  const matchingEntries = Object.entries(WORKFLOW_REGISTRY).filter(
    ([, def]) => def.trigger === triggerEvent
  );

  // Lifecycle triggers without bound email workflows (e.g. INVOICE_CREATED, INVOICE_FULLY_PAID)
  // return cleanly while keeping the trigger taxonomy complete and extensible.
  if (matchingEntries.length === 0) {
    return results;
  }

  let invoice = context.invoice || null;
  if (!invoice && invoiceId) {
    invoice = await invoiceService
      .getInvoiceDetails(userId, invoiceId)
      .catch(() => null);
  }

  for (const [workflowKey, definition] of matchingEntries) {
    let workflow = null;
    try {
      workflow = await automationModel.findWorkflowByKey(userId, workflowKey);
      if (!workflow) continue;

      const evalResult = await definition.evaluate({
        workflow,
        invoice,
        paymentId,
        todayDate,
      });

      if (!evalResult.eligible) {
        if (!evalResult.silent) {
          const log = await automationModel.createExecutionLog({
            userId,
            workflowId: workflow.id,
            invoiceId: invoice?.id || invoiceId || null,
            paymentId,
            triggerEvent,
            status: evalResult.outcome || EXECUTION_STATUS.SKIPPED,
            message: evalResult.failedReason,
            errorMessage:
              evalResult.outcome === EXECUTION_STATUS.FAILED
                ? evalResult.failedReason
                : null,
          });
          results.push(log);
        }
        continue;
      }

      const actionMessage = await definition.execute({
        userId,
        workflow,
        invoice,
        paymentId,
      });

      if (actionMessage) {
        const log = await automationModel.createExecutionLog({
          userId,
          workflowId: workflow.id,
          invoiceId: invoice?.id || invoiceId || null,
          paymentId,
          triggerEvent,
          status: EXECUTION_STATUS.SUCCESS,
          message: actionMessage,
        });
        results.push(log);
      }
    } catch (error) {
      if (workflow) {
        const log = await automationModel.createExecutionLog({
          userId,
          workflowId: workflow.id,
          invoiceId: invoice?.id || invoiceId || null,
          paymentId,
          triggerEvent,
          status: EXECUTION_STATUS.FAILED,
          message: 'Workflow action execution failed.',
          errorMessage: error.message,
        });
        results.push(log);
      }
      console.error(`[Automation Engine] ${workflowKey} error:`, error.message);
    }
  }

  return results;
}

/**
 * Safely retry a single FAILED automation execution after validating workflow
 * state, invoice eligibility, and idempotency guards.
 */
async function retryFailedExecution(userId, executionId) {
  const AppError = require('../utils/appError');
  const execution = await automationModel.findExecutionByIdAndUser(
    executionId,
    userId
  );

  if (!execution) {
    throw new AppError('Automation execution record not found.', 404);
  }
  if (execution.status !== EXECUTION_STATUS.FAILED) {
    throw new AppError(
      `Only FAILED executions can be retried (current status: ${execution.status}).`,
      409
    );
  }
  if (
    execution.message &&
    execution.message.startsWith('[Resolved by Retry')
  ) {
    throw new AppError('This failed execution has already been resolved by a retry.', 409);
  }
  if (!execution.workflow_enabled) {
    throw new AppError(
      `Workflow "${execution.workflow_name}" is currently disabled. Enable it before retrying.`,
      409
    );
  }

  const workflow = await automationModel.findWorkflowByKey(
    userId,
    execution.workflow_key
  );
  const definition = WORKFLOW_REGISTRY[execution.workflow_key];
  if (!workflow || !definition) {
    throw new AppError('Unsupported workflow definition for retry.', 400);
  }

  let invoice = null;
  if (execution.invoice_id) {
    invoice = await invoiceService
      .getInvoiceDetails(userId, execution.invoice_id)
      .catch(() => null);
    if (!invoice) {
      throw new AppError('Associated invoice no longer exists.', 404);
    }
  }

  const evalResult = await definition.evaluate({
    workflow,
    invoice,
    paymentId: execution.payment_id,
    todayDate: getTodayDateString(),
  });

  if (!evalResult.eligible) {
    const newLog = await automationModel.createExecutionLog({
      userId,
      workflowId: workflow.id,
      invoiceId: execution.invoice_id,
      paymentId: execution.payment_id,
      triggerEvent: execution.trigger_event,
      status: evalResult.outcome || EXECUTION_STATUS.FAILED,
      message: `Retry blocked: ${evalResult.failedReason}`,
      errorMessage:
        evalResult.outcome === EXECUTION_STATUS.FAILED
          ? evalResult.failedReason
          : null,
    });
    return {
      retriedOk: false,
      reason: evalResult.failedReason,
      execution: newLog,
    };
  }

  try {
    const actionMessage = await definition.execute({
      userId,
      workflow,
      invoice,
      paymentId: execution.payment_id,
    });

    const newLog = await automationModel.createExecutionLog({
      userId,
      workflowId: workflow.id,
      invoiceId: execution.invoice_id,
      paymentId: execution.payment_id,
      triggerEvent: execution.trigger_event,
      status: EXECUTION_STATUS.SUCCESS,
      message: `[Retry of #${execution.id}] ${actionMessage || 'Completed.'}`,
    });

    await automationModel.markExecutionResolved(
      execution.id,
      userId,
      `[Resolved by Retry #${newLog.id}] ${execution.message || ''}`.trim()
    );

    return {
      retriedOk: true,
      execution: newLog,
    };
  } catch (error) {
    const newLog = await automationModel.createExecutionLog({
      userId,
      workflowId: workflow.id,
      invoiceId: execution.invoice_id,
      paymentId: execution.payment_id,
      triggerEvent: execution.trigger_event,
      status: EXECUTION_STATUS.FAILED,
      message: `Retry of #${execution.id} failed.`,
      errorMessage: error.message,
    });
    return {
      retriedOk: false,
      reason: error.message,
      execution: newLog,
    };
  }
}

module.exports = {
  emitTrigger,
  retryFailedExecution,
  WORKFLOW_REGISTRY,
  getTodayDateString,
};
