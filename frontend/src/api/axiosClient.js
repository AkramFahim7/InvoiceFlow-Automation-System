import axios from 'axios';

export const TOKEN_STORAGE_KEY = 'invoiceflow_token';

/**
 * Shared Axios client for all InvoiceFlow API requests.
 * Automatically attaches the JWT Bearer token when available.
 */
const axiosClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

axiosClient.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_STORAGE_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default axiosClient;
