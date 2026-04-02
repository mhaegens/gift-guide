<template>
  <div class="min-h-screen flex items-center justify-center p-6" style="background:#fffbeb;">
    <div class="w-full max-w-sm">
      <div class="text-center mb-8">
        <div class="text-4xl mb-3">🔑</div>
        <h1 class="text-xl font-bold text-stone-800">Set your password</h1>
        <p class="text-stone-500 text-sm mt-1">You've been given a temporary password. Please set a new one.</p>
      </div>
      <div class="bg-white rounded-2xl shadow-md ring-1 ring-amber-100 p-6 space-y-4">
        <div>
          <label class="form-label">Current (temporary) password</label>
          <input v-model="currentPw" type="password" class="form-input" placeholder="••••••••" autocomplete="current-password" />
        </div>
        <div>
          <label class="form-label">New password</label>
          <input v-model="newPw" type="password" class="form-input" placeholder="••••••••" autocomplete="new-password" />
        </div>
        <div>
          <label class="form-label">Confirm new password</label>
          <input v-model="confirmPw" type="password" class="form-input" placeholder="••••••••" autocomplete="new-password" @keydown.enter="save" />
        </div>
        <p v-if="error" class="text-sm text-red-600">{{ error }}</p>
        <button class="btn btn-amber w-full" :disabled="loading" @click="save">
          {{ loading ? 'Saving…' : 'Set password' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '@/api/index.js'
import { currentUser, logout } from '@/stores/auth.js'

const router = useRouter()
const currentPw = ref('')
const newPw = ref('')
const confirmPw = ref('')
const error = ref('')
const loading = ref(false)

async function save() {
  if (!currentPw.value || !newPw.value || !confirmPw.value) {
    error.value = 'All fields are required'
    return
  }
  if (newPw.value !== confirmPw.value) {
    error.value = 'Passwords do not match'
    return
  }
  loading.value = true
  error.value = ''
  try {
    await api.auth.changePassword(currentPw.value, newPw.value, currentUser.value?.username)
    await logout()
    router.push('/login')
  } catch (err) {
    error.value = err.message || 'Failed to change password'
  } finally {
    loading.value = false
  }
}
</script>
