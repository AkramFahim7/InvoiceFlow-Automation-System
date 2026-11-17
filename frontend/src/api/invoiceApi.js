import axiosClient from './axiosClient';

export async function getInvoices({ search = '', status = 'all', customerId } = {}) {
  const params = { search, status };
  if (customerId) params.customerId = customerId;
  const res = await axiosClient.get('/invoices', { params });
  return res.data.data;
}

export async function getInvoiceById(id) {
  const res = await axiosClient.get(`/invoices/${id}`);
  return res.data.data;
}

export async function createInvoice(payload) {
  const res = await axiosClient.post('/invoices', payload);
  return res.data.data;
}

export async function updateInvoice(id, payload) {
  const res = await axiosClient.put(`/invoices/${id}`, payload);
  return res.data.data;
}

export async function updateInvoiceStatus(id, status) {
  const res = await axiosClient.patch(`/invoices/${id}/status`, { status });
  return res.data.data;
}

export async function deleteDraftInvoice(id) {
  const res = await axiosClient.delete(`/invoices/${id}`);
  return res.data;
}

export async function downloadInvoicePdf(id, invoiceNumber) {
  const res = await axiosClient.get(`/invoices/${id}/pdf`, {
    responseType: 'blob',
  });
  const blobUrl = URL.createObjectURL(
    new Blob([res.data], { type: 'application/pdf' })
  );
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = `${invoiceNumber || `invoice-${id}`}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(blobUrl);
}

