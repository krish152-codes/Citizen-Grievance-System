import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const isAuthPage = window.location.pathname.includes('/login');
      if (!isAuthPage) {
        localStorage.removeItem('token');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export const authAPI = {
  login:      (data)        => api.post('/auth/login', data),
  register:   (data)        => api.post('/auth/register', data),
  sendOTP:    (email)       => api.post('/auth/otp/send', { email }),
  verifyOTP:  (email, otp)  => api.post('/auth/otp/verify', { email, otp }),
  getMe:      ()            => api.get('/auth/me'),
  guestLogin: ()            => api.post('/auth/guest'),
};

export const issuesAPI = {
  report:       (formData)     => api.post('/issues/report', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  getAll:       (params)       => api.get('/issues', { params }),
  getById:      (id)           => api.get(`/issues/${id}`),
  track:        (ticketId)     => api.get(`/issues/track/${ticketId}`),
  updateStatus: (id, data)     => api.patch(`/issues/${id}/status`, data),
  reassign:     (id, data)     => api.patch(`/issues/${id}/reassign`, data),
  delete:       (id)           => api.delete(`/issues/${id}`),
};

export const aiAPI = {
  classify:        (text)    => api.post('/ai/classify',         { text }),
  previewClassify: (text)    => api.post('/ai/preview-classify', { text }),
  sentiment:       (text)    => api.post('/ai/sentiment',        { text }),
  generateLetter:  (issueId) => api.post('/ai/generate-letter',  { issueId }),
};

export const analyticsAPI = {
  getSummary: () => api.get('/analytics/summary'),
  getZones:   () => api.get('/analytics/zones'),
};

export const usersAPI = {
  getAll:  (params)    => api.get('/users', { params }),
  invite:  (data)      => api.post('/users/invite', data),
  update:  (id, data)  => api.patch(`/users/${id}`, data),
};

export default api;