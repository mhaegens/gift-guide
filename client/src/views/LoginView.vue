<template>
  <div class="min-h-screen flex items-center justify-center p-6" style="background:#fffbeb;">
    <div class="w-full max-w-sm">
      <div class="text-center mb-8">
        <div class="text-5xl mb-3">🎁</div>
        <h1 class="text-2xl font-bold text-stone-800">The Great Gift Guide</h1>
        <p class="text-stone-500 text-sm mt-1">Private family wishlists</p>
      </div>
      <div class="bg-white rounded-2xl shadow-md ring-1 ring-amber-100 p-6 space-y-4">
        <div>
          <label class="form-label">Username</label>
          <input
            v-model="username"
            type="text"
            class="form-input"
            placeholder="your username"
            autocomplete="username"
            @keydown.enter="doLogin"
          />
        </div>
        <div>
          <label class="form-label">Password</label>
          <input
            v-model="password"
            type="password"
            class="form-input"
            placeholder="••••••••"
            autocomplete="current-password"
            @keydown.enter="doLogin"
          />
        </div>
        <p v-if="error" class="text-sm text-red-600">{{ error }}</p>
        <button class="btn btn-amber w-full mt-2" :disabled="loading" @click="doLogin">
          {{ loading ? 'Logging in…' : 'Log in' }}
        </button>
        <p class="text-center text-xs text-stone-400 mt-2">Forgot your password? Ask the admin.</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { login } from '@/stores/auth.js'

const router = useRouter()
const username = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)

async function doLogin() {
  if (!username.value || !password.value) return
  loading.value = true
  error.value = ''
  try {
    const user = await login(username.value, password.value)
    if (user.force_password_change) {
      router.push('/change-password')
    } else {
      router.push('/')
    }
  } catch (err) {
    error.value = err.message || 'Login failed'
  } finally {
    loading.value = false
  }
}
</script>
