import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || '/api'

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

// Auth
export const auth = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  me: () => api.get('/auth/me'),
}

// Locations
export const locations = {
  getAll: () => api.get('/locations'),
  getOne: (id) => api.get(`/locations/${id}`),
  create: (data) => api.post('/locations', data),
  update: (id, data) => api.put(`/locations/${id}`, data),
  delete: (id) => api.delete(`/locations/${id}`),
}

// Setups
export const setups = {
  getAll: (locationId = null) =>
    api.get('/setups', { params: locationId ? { location_id: locationId } : {} }),
  getOne: (id) => api.get(`/setups/${id}`),
  generate: (data) => api.post('/setups/generate', data),
  update: (id, data) => api.put(`/setups/${id}`, data),
  delete: (id) => api.delete(`/setups/${id}`),
  // Smart setup reuse
  checkMatch: (data) => api.post('/setups/check-match', data),
  reuse: (setupId, data) => api.post(`/setups/reuse/${setupId}`, data),
  // Refresh setup with Claude (regenerate with latest knowledge)
  refresh: (id) => api.post(`/setups/${id}/refresh`),
  // Shared setups
  getShared: () => api.get('/setups/shared/all'),
  // Admin: get all setups from all users
  getAllAdmin: () => api.get('/setups/admin/all'),
}

// Gear
export const gear = {
  getAll: () => api.get('/gear'),
  getOne: (id) => api.get(`/gear/${id}`),
  create: (data) => api.post('/gear', data),
  update: (id, data) => api.put(`/gear/${id}`, data),
  delete: (id) => api.delete(`/gear/${id}`),
  // Loans
  getLoans: (gearId, includeReturned = false) =>
    api.get(`/gear/${gearId}/loans`, { params: { include_returned: includeReturned } }),
  createLoan: (gearId, data) => api.post(`/gear/${gearId}/loans`, data),
  returnLoan: (gearId, loanId, data = {}) =>
    api.post(`/gear/${gearId}/loans/${loanId}/return`, data),
  getOutstandingLoans: () => api.get('/gear/loans/outstanding'),
  // Hardware learning - generates settings for new gear using Claude
  learn: (data) => api.post('/gear/learn', data),
  learnFromExisting: (gearId, userNotes = null) =>
    api.post(`/gear/${gearId}/learn`, null, { params: userNotes ? { user_notes: userNotes } : {} }),
}

// Admin
export const admin = {
  dbStatus: () => api.get('/admin/db-status'),
  initDb: () => api.post('/admin/init-db'),
  migrate: () => api.post('/admin/migrate'),
  health: () => api.get('/health'),
  // User management
  getUsers: () => api.get('/auth/admin/users'),
  getPendingUsers: () => api.get('/auth/admin/users/pending'),
  approveUser: (userId) => api.put(`/auth/admin/users/${userId}/approve`),
  rejectUser: (userId) => api.put(`/auth/admin/users/${userId}/reject`),
  revokeUser: (userId) => api.put(`/auth/admin/users/${userId}/revoke`),
  toggleAdmin: (userId) => api.put(`/auth/admin/users/${userId}/toggle-admin`),
}

export default api
