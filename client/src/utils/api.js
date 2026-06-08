import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 60000, // 60s for AI endpoints which can be slow
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 — only redirect to login if it is a real auth failure
// (not a rate limit, not a missing API key error from the AI service)
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err.response?.status;
    const message = err.response?.data?.error || '';

    // Only force-logout when the server explicitly says the token is bad
    const isAuthError =
      status === 401 &&
      (message.toLowerCase().includes('token') ||
        message.toLowerCase().includes('authorized') ||
        message.toLowerCase().includes('log in'));

    if (isAuthError) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }

    return Promise.reject(err);
  }
);

export default api;