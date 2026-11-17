import axiosClient from './axiosClient';

export async function getEmailLogs(invoiceId = null) {
  const params = invoiceId ? { invoiceId } : {};
  const res = await axiosClient.get('/emails/logs', { params });
  return res.data.data;
}

export async function sendInvoiceEmail(invoiceId) {
  const res = await axiosClient.post(`/emails/invoices/${invoiceId}/send`);
  return res.data;
}

export async function sendPaymentConfirmationEmail(paymentId) {
  const res = await axiosClient.post(`/emails/payments/${paymentId}/confirmation`);
  return res.data;
}

