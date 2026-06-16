import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('yami_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res.data,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('yami_token');
      window.location.href = '/login';
    }
    return Promise.reject(err.response?.data || err);
  }
);

export const authApi = {
  login: (data) => api.post('/auth/login', data),
  register: (data) => api.post('/auth/register', data),
  me: () => api.get('/auth/me'),
  updateProfile: (data) => api.put('/auth/me', data),
  acceptInvite: (token, data) => api.post(`/auth/accept-invite/${token}`, data),
};

export const courseApi = {
  list: (params) => api.get('/courses', { params }),
  get: (id) => api.get(`/courses/${id}`),
  create: (data) => api.post('/courses', data),
  update: (id, data) => api.put(`/courses/${id}`, data),
  enroll: (id) => api.post(`/courses/${id}/enroll`),
  addModule: (courseId, data) => api.post(`/courses/${courseId}/modules`, data),
  recordWatch: (courseId, moduleId, data) => api.post(`/courses/${courseId}/modules/${moduleId}/watch`, data),
  getNextQuiz: (courseId) => api.get(`/courses/${courseId}/next-quiz`).then(r => r.data),
};

export const quizApi = {
  list: (params) => api.get('/quizzes', { params }),
  get: (id) => api.get(`/quizzes/${id}`),
  attempt: (id, data) => api.post(`/quizzes/${id}/attempt`, data),
  attempts: (id) => api.get(`/quizzes/${id}/attempts`),
};

export const aiApi = {
  generateQuiz: (data) => api.post('/ai/generate-quiz', data),
  generateSummary: (data) => api.post('/ai/generate-summary', data),
  generateFlashcards: (data) => api.post('/ai/generate-flashcards', data),
  copilotQuery: (data) => api.post('/ai/copilot/query', data),
  riskAnalysis: (userId) => api.get(`/ai/risk-analysis/${userId}`),
  retention: (userId) => api.get(`/ai/retention/${userId}`),
  recommendations: (userId) => api.get(`/ai/recommendations/${userId}`),
  flashcards: (moduleId) => api.get(`/ai/flashcards/${moduleId}`),
  ask: (data) => api.post('/ai/ask', data).then(r => r.data),
  aiRecommendations: (userId) => api.get(`/ai/ai-recommendations/${userId}`).then(r => r.data),
};

export const managerApi = {
  team: () => api.get('/manager/team'),
  summary: () => api.get('/manager/team/summary'),
  audit: (userId) => api.get(`/manager/team/${userId}/audit`),
  skillHeatmap: () => api.get('/manager/skill-heatmap'),
  certificationReadiness: () => api.get('/manager/certification-readiness'),
};

export const learnerApi = {
  dashboard: () => api.get('/learner/dashboard'),
  learningPath: () => api.get('/learner/learning-path'),
  history: (params) => api.get('/learner/history', { params }),
  roleplays: () => api.get('/learner/roleplays'),
  aiRecommendations: (userId) => api.get(`/ai/ai-recommendations/${userId}`).then(r => r.data),
  certifications: () => api.get('/learner/certifications'),
  getCertificate: (certId) => api.get(`/learner/certifications/${certId}/certificate`),
};

export const gamificationApi = {
  leaderboard: (params) => api.get('/gamification/leaderboard', { params }),
  badges: () => api.get('/gamification/badges'),
  myStats: () => api.get('/gamification/my-stats'),
};

export const analyticsApi = {
  adminOverview: () => api.get('/analytics/admin/overview'),
  learningTrends: (params) => api.get('/analytics/learning-trends', { params }),
};

export const adminApi = {
  users: (params) => api.get('/admin/users', { params }),
  updateUser: (id, data) => api.put(`/admin/users/${id}`, data),
  invite: (data) => api.post('/admin/invite', data),
  invites: () => api.get('/admin/invites'),
  syncDocmost: () => api.post('/admin/sync-docmost'),
  docmostStatus: () => api.get('/admin/docmost/status'),
  listDocuments: (params) => api.get('/admin/docmost/documents', { params }).then(r => r.data),
  getDocument: (docmostId) => api.get(`/admin/docmost/documents/${docmostId}`).then(r => r.data),
  createDocument: (data) => api.post('/admin/docmost/documents', data).then(r => r.data),
  updateDocument: (docmostId, data) => api.put(`/admin/docmost/documents/${docmostId}`, data).then(r => r.data),
  deleteDocument: (docmostId) => api.delete(`/admin/docmost/documents/${docmostId}`).then(r => r.data),
  // Certifications
  certifications: () => api.get('/admin/certifications'),
  createCertification: (data) => api.post('/admin/certifications', data),
  updateCertification: (id, data) => api.put(`/admin/certifications/${id}`, data),
  deleteCertification: (id) => api.delete(`/admin/certifications/${id}`),
};

export const i18nApi = {
  setLanguage: (language) => api.put('/auth/me/language', { language }),
};

export default api;
