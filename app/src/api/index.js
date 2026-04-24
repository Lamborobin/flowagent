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

export default api;
