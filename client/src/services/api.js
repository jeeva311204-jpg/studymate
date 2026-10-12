import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env?.VITE_API_URL || '/api',
});

/**
 * Validates request URL and throws if it contains "/api/api" or if combined with baseURL it results in "/api/api".
 * @param {string} url - Request path or URL
 * @param {string} [baseURL] - Base URL (e.g. VITE_API_URL or '/api')
 * @returns {string} The validated URL
 * @throws {Error} If URL contains "/api/api"
 */
export const validateApiUrl = (url, baseURL = '') => {
  if (!url || typeof url !== 'string') return url;

  if (url.includes('/api/api')) {
    throw new Error(`[API Error] Request URL "${url}" contains duplicate "/api/api". Use base-relative paths without "/api" prefix.`);
  }

  // Also check if combining baseURL + url yields /api/api
  const cleanBase = (baseURL || '').replace(/\/+$/, '');
  const cleanPath = url.startsWith('/') ? url : `/${url}`;
  const combined = `${cleanBase}${cleanPath}`;

  if (combined.includes('/api/api')) {
    throw new Error(`[API Error] Request URL "${url}" combined with baseURL "${baseURL}" results in duplicate "/api/api" (${combined}).`);
  }

  return url;
};

// Attach JWT token to every request if present
api.interceptors.request.use(
  (config) => {
    validateApiUrl(config.url, config.baseURL);

    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('studymate_token') : null;
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
