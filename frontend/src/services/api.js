import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';
// Server origin (without /api) — used for uploaded files and health checks
export const SERVER_URL = BASE_URL.replace(/\/api\/?$/, '');

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
  login:     (data)       => api.post('/auth/login', data),
  register:  (data)       => api.post('/auth/register', data),
  sendOTP:   (email)      => api.post('/auth/otp/send', { email }),
  verifyOTP: (email, otp) => api.post('/auth/otp/verify', { email, otp }),
  getMe:     ()           => api.get('/auth/me'),
};

export const issuesAPI = {
  report:       (formData)  => api.post('/issues/report', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  getAll:       (params)    => api.get('/issues', { params }),
  getById:      (id)        => api.get(`/issues/${id}`),
  track:        (ticketId)  => api.get(`/issues/track/${ticketId}`),
  updateStatus: (id, data)  => api.patch(`/issues/${id}/status`, data),
  resolveWithProof: (id, formData) => api.post(`/issues/${id}/resolve`, formData, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 60000 }),
  reassign:     (id, data)  => api.patch(`/issues/${id}/reassign`, data),
  delete:       (id)        => api.delete(`/issues/${id}`),
};

export const aiAPI = {
  classify:        (text)    => api.post('/ai/classify',         { text }),
  previewClassify: (text)    => api.post('/ai/preview-classify', { text }),
  sentiment:       (text)    => api.post('/ai/sentiment',        { text }),
  // Server-side speech-to-text fallback (Whisper). lang = ISO-639-1 hint or ''.
  transcribe:      (blob, lang = '') => {
    const fd = new FormData();
    const ext = blob.type?.includes('mp4') ? 'm4a' : blob.type?.includes('ogg') ? 'ogg' : blob.type?.includes('wav') ? 'wav' : blob.type?.includes('mpeg') ? 'mp3' : 'webm';
    fd.append('voice', blob instanceof File ? blob : new File([blob], `voice.${ext}`, { type: blob.type || 'audio/webm' }));
    fd.append('lang', lang);
    return api.post('/ai/transcribe', fd, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 60000 });
  },
  generateLetter:  (issueId) => api.post('/ai/generate-letter',  { issueId }),
};

// ── NEW: Community "I fixed this" showcase ───────────────
export const communityAPI = {
  getPosts:     (params)   => api.get('/community', { params }),
  create:       (formData) => api.post('/community', formData, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 60000 }),
  appreciate:   (id)       => api.post(`/community/${id}/appreciate`),
  delete:       (id)       => api.delete(`/community/${id}`),
};

export const analyticsAPI = {
  getSummary:        () => api.get('/analytics/summary'),
  getCitizenSummary: () => api.get('/analytics/citizen-summary'),
  getZones:          () => api.get('/analytics/zones'),
};

export const usersAPI = {
  getAll:  (params)   => api.get('/users', { params }),
  invite:  (data)     => api.post('/users/invite', data),
  update:  (id, data) => api.patch(`/users/${id}`, data),
};

// ── NEW: Department registry API ─────────────────────────
export const departmentsAPI = {
  getAll:          (params)   => api.get('/departments', { params }),
  create:          (data)     => api.post('/departments', data),
  update:          (id, data) => api.patch(`/departments/${id}`, data),
  delete:          (id)       => api.delete(`/departments/${id}`),
  sendComplaint:   (issueId, data) => api.post(`/departments/send-complaint/${issueId}`, data),
};

// ── Smart Drain Monitoring + Drain Echo ──────────────────
export const drainsAPI = {
  getAll:            (params)   => api.get('/drains', { params }),
  getById:           (id)       => api.get(`/drains/${id}`),
  getReadings:       (id, params) => api.get(`/drains/${id}/readings`, { params }),
  getTrends:         (id, range)  => api.get(`/drains/${id}/trends`, { params: { range } }),
  create:            (data)     => api.post('/drains', data),
  updateThresholds:  (id, data) => api.patch(`/drains/${id}/thresholds`, data),
  updateCalibration: (id, data) => api.patch(`/drains/${id}/calibration`, data),
  ingestReading:     (id, data) => api.post(`/drains/${id}/readings`, data),
};

export const alertsAPI = {
  getAll:       (params)   => api.get('/alerts', { params }),
  getById:      (id)       => api.get(`/alerts/${id}`),
  acknowledge:  (id)       => api.post(`/alerts/${id}/acknowledge`),
  assign:       (id, data) => api.patch(`/alerts/${id}/assign`, data),
  resolve:      (id, data) => api.patch(`/alerts/${id}/resolve`, data),
};

export const drainIncidentsAPI = {
  getAll:  (params)   => api.get('/incidents', { params }),
  getById: (id)       => api.get(`/incidents/${id}`),
  create:  (data)     => api.post('/incidents', data),
  update:  (id, data) => api.patch(`/incidents/${id}`, data),
};

export const drainEchoAPI = {
  analyze:     (formData) => api.post('/drain-echo/analyze', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  getHistory:  (params)   => api.get('/drain-echo/history', { params }),
  getById:     (id)       => api.get(`/drain-echo/${id}`),
};

export default api;
