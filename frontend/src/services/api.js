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
};

export const courseApi = {
  list: (params) => api.get('/courses', { params }),
  get: (id) => api.get(`/courses/${id}`),
  create: (data) => api.post('/courses', data),
  update: (id, data) => api.put(`/courses/${id}`, data),
  enroll: (id) => api.post(`/courses/${id}/enroll`),
  addModule: (courseId, data) => api.post(`/courses/${courseId}/modules`, data),
  recordWatch: (courseId, moduleId, data) => api.post(`/courses/${courseId}/modules/${moduleId}/watch`, data),
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

export default api;
