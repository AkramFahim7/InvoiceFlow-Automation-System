import axiosClient from './axiosClient';

export async function getDashboardAnalytics() {
  const res = await axiosClient.get('/reports/dashboard');
  return res.data.data;
}

export async function getReportsOverview(months = 6) {
  const res = await axiosClient.get('/reports/overview', {
    params: { months },
  });
  return res.data.data;
}

export async function downloadReportsCsv() {
  const res = await axiosClient.get('/reports/export.csv', {
    responseType: 'blob',
  });

  const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  const dateStamp = new Date().toISOString().slice(0, 10);
  link.href = url;
  link.setAttribute('download', `InvoiceFlow_Invoice_Data_${dateStamp}.csv`);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

export async function downloadReportsExcel() {
  const res = await axiosClient.get('/reports/export.xlsx', {
    responseType: 'blob',
  });

  const blob = new Blob([res.data], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  const dateStamp = new Date().toISOString().slice(0, 10);
  link.href = url;
  link.setAttribute('download', `InvoiceFlow_Invoice_Tracker_${dateStamp}.xlsx`);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}
