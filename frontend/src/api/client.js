import axios from 'axios';

// In development: VITE_API_URL is unset, so we use '/api' which Vite proxies to the backend.
// In production: VITE_API_URL is set to the deployed backend, e.g. https://smart-prescription-api.onrender.com/api
const API_BASE = import.meta.env.VITE_API_URL || '/api';

// PDFs are served from the backend at /pdfs/... — derive the base from the API URL
// by stripping the trailing /api so we hit the same host.
export const PDF_BASE = API_BASE.replace(/\/api\/?$/, '');

export function pdfUrl(path) {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  return PDF_BASE + path;
}

const api = axios.create({
  baseURL: API_BASE,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

export default api;
