import axiosClient from './axiosClient';

export async function getCustomers({ search = '', filter = 'all' } = {}) {
  const res = await axiosClient.get('/customers', {
    params: { search, filter },
  });
  return res.data.data;
}

export async function getCustomerById(id) {
  const res = await axiosClient.get(`/customers/${id}`);
  return res.data.data;
}

export async function createCustomer(payload) {
  const res = await axiosClient.post('/customers', payload);
  return res.data.data;
}

export async function updateCustomer(id, payload) {
  const res = await axiosClient.put(`/customers/${id}`, payload);
  return res.data.data;
}

export async function deleteCustomer(id) {
  const res = await axiosClient.delete(`/customers/${id}`);
  return res.data;
}

