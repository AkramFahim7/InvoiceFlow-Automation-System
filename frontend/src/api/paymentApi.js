import axiosClient from './axiosClient';

export async function getPayments({ search = '', method = 'all' } = {}) {
  const res = await axiosClient.get('/payments', {
    params: { search, method },
  });
  return res.data.data;
}

export async function recordPayment(payload) {
  const res = await axiosClient.post('/payments', payload);
  return res.data;
}

