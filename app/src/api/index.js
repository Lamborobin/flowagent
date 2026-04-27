import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

// Always send as human from the UI
api.defaults.headers.common['X-Agent-Id'] = 'human';

export const tasksApi = {
  list: (params) => api.get('/tasks', { params }).then(r => r.data),
  get: (id) => api.get(`/tasks/${id}`).then(r => r.data),
  create: (data) => api.post('/tasks', data).then(r => r.data),
  update: (id, data) => api.patch(`/tasks/${id}`, data).then(r => r.data),
  move: (id, column_id, message) => api.post(`/tasks/${id}/move`, { column_id, message }).then(r => r.data),
  log: (id, action, message) => api.post(`/tasks/${id}/log`, { action, message }).then(r => r.data),
  delete: (id) => api.delete(`/tasks/${id}`).then(r => r.data),
  requestPmReview: (id) => api.post(`/tasks/${id}/request_pm_review`).then(r => r.data),
  pmReview: (id, data) => api.post(`/tasks/${id}/pm_review`, data).then(r => r.data),
  pmQuestion: (id, data) => api.post(`/tasks/${id}/pm_question`, data).then(r => r.data),
  answer: (id, data) => api.post(`/tasks/${id}/answer`, data).then(r => r.data),
  approve: (id, data) => api.post(`/tasks/${id}/approve`, data).then(r => r.data),
  reject: (id, data) => api.post(`/tasks/${id}/reject`, data).then(r => r.data),
  archive: (id) => api.post(`/tasks/${id}/archive`).then(r => r.data),
  bypassPm: (id) => api.post(`/tasks/${id}/bypass_pm`).then(r => r.data),
};

export const columnsApi = {
  list: () => api.get('/columns').then(r => r.data),
  create: (data) => api.post('/columns', data).then(r => r.data),
  update: (id, data) => api.patch(`/columns/${id}`, data).then(r => r.data),
  delete: (id) => api.delete(`/columns/${id}`).then(r => r.data),
};

export const agentsApi = {
  list: () => api.get('/agents').then(r => r.data),
  get: (id) => api.get(`/agents/${id}`).then(r => r.data),
  create: (data) => api.post('/agents', data).then(r => r.data),
  update: (id, data) => api.patch(`/agents/${id}`, data).then(r => r.data),
  delete: (id) => api.delete(`/agents/${id}`).then(r => r.data),
};

export const secretsApi = {
  list: () => api.get('/secrets').then(r => r.data),
  request: (data) => api.post('/secrets', data).then(r => r.data),
  resolve: (id, status) => api.patch(`/secrets/${id}/resolve`, { status }).then(r => r.data),
};

export const instructionsApi = {
  list: () => api.get('/instructions').then(r => r.data),
  create: (data) => api.post('/instructions', data).then(r => r.data),
};

export const agentTemplatesApi = {
  list: (includeArchived = false) =>
    api.get('/agent-templates', { params: { include_archived: includeArchived } }).then(r => r.data),
  create: (data) => api.post('/agent-templates', data).then(r => r.data),
  update: (id, data) => api.patch(`/agent-templates/${id}`, data).then(r => r.data),
  archive: (id) => api.post(`/agent-templates/${id}/archive`).then(r => r.data),
  unarchive: (id) => api.post(`/agent-templates/${id}/unarchive`).then(r => r.data),
  saveAgentAs: (agentId, data) => api.post(`/agents/${agentId}/save-as-template`, data).then(r => r.data),
};

export default api;
