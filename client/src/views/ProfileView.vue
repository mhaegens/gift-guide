<template>
  <AppLayout>
    <div class="px-4 pt-6 pb-4 space-y-5">
      <!-- Avatar + name -->
      <div class="flex items-center gap-3 mb-2">
        <div class="avatar text-xl" style="width:3.5rem;height:3.5rem;" :style="{ background: avatarColor(currentUser?.id ?? 1) }">
          {{ currentUser?.display_name?.[0]?.toUpperCase() }}
        </div>
        <div>
          <h2 class="font-bold text-lg text-stone-800">{{ currentUser?.display_name }}</h2>
          <p class="text-sm text-stone-500">@{{ currentUser?.username }}</p>
        </div>
      </div>

      <!-- Change display name -->
      <div class="bg-white rounded-xl p-4 shadow-sm space-y-3">
        <h3 class="font-semibold text-stone-700">Display name</h3>
        <div>
          <label class="form-label">Name shown to family</label>
          <input v-model="displayName" type="text" class="form-input" />
        </div>
        <p v-if="nameError" class="text-sm text-red-600">{{ nameError }}</p>
        <button class="btn btn-amber w-full" :disabled="savingName" @click="saveName">
          {{ savingName ? 'Saving…' : 'Save name' }}
        </button>
      </div>

      <!-- Change password -->
      <div class="bg-white rounded-xl p-4 shadow-sm space-y-3">
        <h3 class="font-semibold text-stone-700">Change password</h3>
        <div>
          <label class="form-label">Current password</label>
          <input v-model="currentPw" type="password" class="form-input" placeholder="••••••••" autocomplete="current-password" />
        </div>
        <div>
          <label class="form-label">New password</label>
          <input v-model="newPw" type="password" class="form-input" placeholder="••••••••" autocomplete="new-password" />
        </div>
        <div>
          <label class="form-label">Confirm new password</label>
          <input v-model="confirmPw" type="password" class="form-input" placeholder="••••••••" autocomplete="new-password" />
        </div>
        <p v-if="pwError" class="text-sm text-red-600">{{ pwError }}</p>
        <button class="btn btn-amber w-full" :disabled="savingPw" @click="savePassword">
          {{ savingPw ? 'Saving…' : 'Change password' }}
        </button>
      </div>

      <!-- Admin panel button -->
      <div v-if="currentUser?.is_admin" class="bg-amber-50 border border-amber-200 rounded-xl p-4">
        <div class="flex items-center gap-2 mb-2">
          <span class="text-lg">🔧</span>
          <h3 class="font-semibold text-amber-800">Admin</h3>
          <span class="badge badge-amber">Admin</span>
        </div>
        <p class="text-sm text-amber-700 mb-3">View gift counts, manage family accounts, reset passwords, and assign admin roles.</p>
        <button class="btn btn-amber w-full" @click="showAdmin = true">Open admin panel →</button>
      </div>

      <!-- Logout -->
      <button class="btn btn-danger w-full" @click="doLogout">Log out</button>
    </div>

    <!-- Admin panel overlay -->
    <AdminPanel :show="showAdmin" @close="showAdmin = false" />
  </AppLayout>
</template>

<script setup>
import { ref, onMounted, inject } from 'vue'
import { useRouter } from 'vue-router'
import AppLayout from '@/components/AppLayout.vue'
import AdminPanel from '@/components/AdminPanel.vue'
import { currentUser, logout } from '@/stores/auth.js'
import { api } from '@/api/index.js'
import { avatarColor } from '@/utils.js'

const router = useRouter()
const showToast = inject('showToast')

const displayName = ref('')
const savingName = ref(false)
const nameError = ref('')
const currentPw = ref('')
const newPw = ref('')
const confirmPw = ref('')
const savingPw = ref(false)
const pwError = ref('')
const showAdmin = ref(false)

onMounted(() => {
  displayName.value = currentUser.value?.display_name ?? ''
})

async function saveName() {
  if (!displayName.value.trim()) return
  savingName.value = true
  nameError.value = ''
  try {
    const updated = await api.users.update(currentUser.value.id, { display_name: displayName.value.trim() })
    if (currentUser.value) currentUser.value.display_name = updated.display_name
    showToast?.('Name updated')
  } catch (err) {
    nameError.value = err.message || 'Failed to update name'
  } finally {
    savingName.value = false
  }
}

async function savePassword() {
  pwError.value = ''
  if (!currentPw.value || !newPw.value || !confirmPw.value) {
    pwError.value = 'All fields are required'
    return
  }
  if (newPw.value !== confirmPw.value) {
    pwError.value = 'Passwords do not match'
    return
  }
  savingPw.value = true
  try {
    await api.auth.changePassword(currentPw.value, newPw.value)
    currentPw.value = ''
    newPw.value = ''
    confirmPw.value = ''
    showToast?.('Password changed')
  } catch (err) {
    pwError.value = err.message || 'Failed to change password'
  } finally {
    savingPw.value = false
  }
}

async function doLogout() {
  await logout()
  router.push('/login')
}
</script>
