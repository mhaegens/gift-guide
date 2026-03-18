import { ref } from 'vue'
import { api } from '@/api/index.js'

export const currentUser = ref(null)
export const authLoading = ref(true)

export async function loadUser() {
  authLoading.value = true
  try {
    currentUser.value = await api.auth.me()
  } catch {
    currentUser.value = null
  } finally {
    authLoading.value = false
  }
}

export async function login(username, password) {
  const user = await api.auth.login(username, password)
  currentUser.value = user
  return user
}

export async function logout() {
  try { await api.auth.logout() } catch {}
  currentUser.value = null
}
