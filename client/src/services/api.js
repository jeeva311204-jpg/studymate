import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
});

// Attach JWT token to every request if present
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('studymate_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // When sending FormData, delete Content-Type so browser sets multipart boundary automatically
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type'];
    } else if (!config.headers['Content-Type']) {
      config.headers['Content-Type'] = 'application/json';
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Intercept 401s to handle token expiration
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response && error.response.status === 401) {
      const url = error.config?.url || '';
      if (!url.includes('/auth/login') && !url.includes('/auth/register')) {
        // Clear invalid token & session data
        localStorage.removeItem('studymate_token');
        localStorage.removeItem('studymate_user');

        // Redirect to /login with session expired message
        if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
          sessionStorage.setItem('studymate_session_expired', 'Your session has expired. Please sign in again.');
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

export default api;
