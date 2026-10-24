/**
 * API client — all requests use credentials:'include' for session cookies.
 * Throws an Error with the server's error message on non-2xx responses.
 */

async function request(method, path, body) {
  const opts = {
    method,
    credentials: 'include',
    headers: {},
  }
  if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json'
    opts.body = JSON.stringify(body)
  }
  const res = await fetch(path, opts)
  if (!res.ok) {
    let message = `HTTP ${res.status}`
    try {
      const data = await res.json()
      message = data.error || data.message || message
    } catch {}
    const err = new Error(message)
    err.status = res.status
    throw err
  }
  if (res.status === 204) return null
  return res.json()
}

const get = (path) => request('GET', path)
const post = (path, body) => request('POST', path, body)
const patch = (path, body) => request('PATCH', path, body)
const del = (path) => request('DELETE', path)

export const api = {
  auth: {
    login: (username, password) => post('/api/auth/login', { username, password }),
    logout: () => post('/api/auth/logout'),
    me: () => get('/api/auth/me'),
    changePassword: (current_password, new_password, username) =>
      post('/api/auth/change-password', { current_password, new_password, ...(username ? { username } : {}) }),
  },
  users: {
    list: () => get('/api/users'),
    listAll: () => get('/api/users?all=1'),
    create: (display_name, username, password) =>
      post('/api/users', { display_name, username, password }),
    update: (id, data) => patch(`/api/users/${id}`, data),
    resetPassword: (id, new_password) =>
      post(`/api/users/${id}/reset-password`, { password: new_password }),
  },
  items: {
    list: (userId) => get(`/api/users/${userId}/items`),
    create: (data) => post('/api/users/me/items', data),
    update: (itemId, data) => patch(`/api/users/me/items/${itemId}`, data),
    remove: (itemId) => del(`/api/users/me/items/${itemId}`),
    enrich: (url) => post('/api/items/enrich', { url }),
  },
  claims: {
    claim: (itemId) => post(`/api/items/${itemId}/claim`),
    unclaim: (itemId) => del(`/api/items/${itemId}/claim`),
    mine: () => get('/api/claims/mine'),
  },
  splitsies: {
    get: (itemId) => get(`/api/items/${itemId}/splitsies`),
    start: (itemId, data) => post(`/api/items/${itemId}/splitsies`, data),
    join: (itemId, data) => request('PUT', `/api/items/${itemId}/splitsies`, data),
    leave: (itemId) => del(`/api/items/${itemId}/splitsies`),
  },
}
