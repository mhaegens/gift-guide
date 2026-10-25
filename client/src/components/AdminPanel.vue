<template>
  <div v-if="show" class="admin-backdrop" @click="$emit('close')">
    <div
      class="screen-card-push"
      :class="animClass"
      @click.stop
      @animationend="onAnimEnd"
    >
      <!-- Sticky header -->
      <div class="bg-white px-4 pt-5 pb-3 sticky top-0 z-10" style="border-radius: 2rem 2rem 0 0;">
        <div class="flex items-center gap-3">
          <button class="btn btn-ghost p-2 -ml-2" @click="startClose">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="w-5 h-5">
              <path d="M15 19l-7-7 7-7"/>
            </svg>
          </button>
          <h2 class="font-bold text-lg text-stone-800">Admin Panel</h2>
        </div>
      </div>

      <div class="px-4 pt-4 pb-6">
        <section aria-label="Gift overview" class="mb-6">
          <div class="flex items-center justify-between gap-3 mb-3">
            <h3 class="font-semibold text-stone-800">Gift overview</h3>
            <button class="btn btn-ghost text-xs px-3" :disabled="statsLoading" @click="loadStats">{{ statsLoading ? 'Refreshing…' : 'Refresh counts' }}</button>
          </div>
          <p v-if="statsError" role="alert" class="text-sm text-red-600 mb-3">{{ statsError }}</p>
          <div v-if="stats" class="grid grid-cols-2 gap-3" aria-live="polite" :aria-busy="statsLoading">
            <div v-for="card in statCards" :key="card.key" class="bg-white rounded-xl p-4 shadow-sm">
              <p class="text-xs text-stone-500">{{ card.label }}</p>
              <p class="text-2xl font-bold text-stone-800 mt-1">{{ stats[card.key] }}</p>
            </div>
          </div>
          <p v-else-if="statsLoading" class="text-sm text-stone-500">Loading gift counts…</p>
          <p class="text-xs text-stone-500 mt-3">Claimed gifts and active splitsies groups are counted separately. Available gifts have neither. Totals keep individual surprises hidden.</p>
        </section>

        <div class="flex justify-between items-center mb-4">
          <p class="text-sm text-stone-500">Manage family accounts</p>
          <button class="btn btn-amber px-4" @click="showAddUser = true">+ Add user</button>
        </div>

        <p v-if="loadError" class="text-sm text-red-600 mb-4">{{ loadError }}</p>

        <div class="space-y-3">
          <div
            v-for="u in users"
            :key="u.id"
            class="bg-white rounded-xl p-4 shadow-sm"
          >
            <div class="flex items-center justify-between gap-3">
              <div class="flex items-center gap-3 min-w-0">
                <div class="avatar text-sm flex-shrink-0" style="width:2rem;height:2rem;" :style="{ background: avatarColor(u.id) }">
                  {{ avatarInitial(u.display_name) }}
                </div>
                <div class="min-w-0">
                  <p class="font-semibold text-stone-800 text-sm truncate">{{ u.display_name }}</p>
                  <p class="text-xs text-stone-400">@{{ u.username }}</p>
                </div>
              </div>
              <div class="flex gap-2 flex-shrink-0">
                <button class="btn btn-outline text-xs px-2" style="min-height:32px;" @click="openResetPw(u)">Reset pw</button>
              </div>
            </div>
            <div class="flex items-center gap-4 mt-3 pt-3 border-t border-stone-100">
              <label class="flex items-center gap-2 text-xs text-stone-600 cursor-pointer">
                <span class="toggle-switch">
                  <input type="checkbox" :checked="u.is_admin" @change="toggleAdmin(u)" />
                  <span class="toggle-slider"></span>
                </span>
                Admin
              </label>
              <label class="flex items-center gap-2 text-xs text-stone-600 cursor-pointer">
                <span class="toggle-switch">
                  <input type="checkbox" :checked="u.is_active" @change="toggleActive(u)" />
                  <span class="toggle-slider"></span>
                </span>
                Active
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Add User modal -->
    <Teleport to="body">
      <transition name="modal">
        <div v-if="showAddUser" class="modal-overlay" @click.self="showAddUser = false">
          <div class="modal-sheet" @click.stop>
            <div class="flex items-center justify-between mb-4">
              <h3 class="font-bold text-lg text-stone-800">Add user</h3>
              <button class="btn btn-ghost p-1" @click="showAddUser = false">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="w-5 h-5">
                  <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
              </button>
            </div>
            <div class="space-y-4">
              <div><label class="form-label">Display name</label><input v-model="newUser.display_name" type="text" class="form-input" placeholder="e.g. Grandma Elsa" /></div>
              <div><label class="form-label">Username</label><input v-model="newUser.username" type="text" class="form-input" placeholder="e.g. grandma_elsa" /></div>
              <div><label class="form-label">Temporary password</label><input v-model="newUser.password" type="text" class="form-input" placeholder="Share via WhatsApp" /></div>
              <p v-if="addUserError" class="text-sm text-red-600">{{ addUserError }}</p>
              <div class="flex gap-3 pt-2">
                <button class="btn btn-outline flex-1" @click="showAddUser = false">Cancel</button>
                <button class="btn btn-amber flex-1" :disabled="addingUser" @click="createUser">{{ addingUser ? 'Creating…' : 'Create account' }}</button>
              </div>
            </div>
          </div>
        </div>
      </transition>
    </Teleport>

    <!-- Reset password modal -->
    <Teleport to="body">
      <transition name="modal">
        <div v-if="resetPwUser" class="modal-overlay" @click.self="resetPwUser = null">
          <div class="modal-sheet" @click.stop>
            <div class="flex items-center justify-between mb-2">
              <h3 class="font-bold text-lg text-stone-800">Reset password</h3>
              <button class="btn btn-ghost p-1" @click="resetPwUser = null">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="w-5 h-5">
                  <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
              </button>
            </div>
            <p class="text-sm text-stone-500 mb-4">Resetting password for {{ resetPwUser?.display_name }}</p>
            <div class="space-y-4">
              <div><label class="form-label">New temporary password</label><input v-model="newPw" type="text" class="form-input" placeholder="Share via WhatsApp" /></div>
              <p v-if="resetPwError" class="text-sm text-red-600">{{ resetPwError }}</p>
              <div class="flex gap-3 pt-2">
                <button class="btn btn-outline flex-1" @click="resetPwUser = null">Cancel</button>
                <button class="btn btn-amber flex-1" :disabled="resettingPw" @click="doResetPw">{{ resettingPw ? 'Saving…' : 'Reset password' }}</button>
              </div>
            </div>
          </div>
        </div>
      </transition>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import { api } from '@/api/index.js'
import { avatarColor, avatarInitial } from '@/utils.js'

const props = defineProps({ show: Boolean })
const emit = defineEmits(['close'])

const users = ref([])
const showAddUser = ref(false)
const addUserError = ref('')
const addingUser = ref(false)
const newUser = ref({ display_name: '', username: '', password: '' })
const resetPwUser = ref(null)
const newPw = ref('')
const resetPwError = ref('')
const resettingPw = ref(false)
const animClass = ref('entering')
const closing = ref(false)
const loadError = ref('')
const stats = ref(null)
const statsLoading = ref(false)
const statsError = ref('')
const statCards = [
  { key: 'gifts', label: 'Gifts' },
  { key: 'claims', label: 'Claimed gifts' },
  { key: 'splitsies', label: 'Splitsies groups' },
  { key: 'available', label: 'Available gifts' },
]

watch(() => props.show, async (val) => {
  if (val) {
    animClass.value = 'entering'
    closing.value = false
    await Promise.all([loadUsers(), loadStats()])
  }
}, { immediate: true })

async function loadStats() {
  statsLoading.value = true
  statsError.value = ''
  try {
    stats.value = await api.admin.stats()
  } catch (err) {
    stats.value = null
    statsError.value = err.message || 'Failed to load gift counts'
  } finally {
    statsLoading.value = false
  }
}

async function loadUsers() {
  loadError.value = ''
  try {
    users.value = await api.users.listAll()
  } catch (err) {
    loadError.value = err.message || 'Failed to load users'
    users.value = []
  }
}

function startClose() {
  animClass.value = 'exit-stack'
  closing.value = true
}

function onAnimEnd() {
  if (closing.value) emit('close')
}

function openResetPw(u) {
  resetPwUser.value = u
  newPw.value = ''
  resetPwError.value = ''
}

async function toggleAdmin(u) {
  try {
    await api.users.update(u.id, { is_admin: !u.is_admin })
    u.is_admin = !u.is_admin
  } catch (err) {
    loadError.value = err.message || 'Failed to update admin status'
  }
}

async function toggleActive(u) {
  try {
    await api.users.update(u.id, { is_active: !u.is_active })
    u.is_active = !u.is_active
  } catch (err) {
    loadError.value = err.message || 'Failed to update active status'
  }
}

async function createUser() {
  addUserError.value = ''
  if (!newUser.value.display_name || !newUser.value.username || !newUser.value.password) {
    addUserError.value = 'All fields are required'
    return
  }
  addingUser.value = true
  try {
    const created = await api.users.create(
      newUser.value.display_name,
      newUser.value.username,
      newUser.value.password
    )
    users.value.push({ ...created, is_admin: false, is_active: true })
    newUser.value = { display_name: '', username: '', password: '' }
    showAddUser.value = false
  } catch (err) {
    addUserError.value = err.message || 'Failed to create user'
  } finally {
    addingUser.value = false
  }
}

async function doResetPw() {
  if (!newPw.value) return
  resettingPw.value = true
  resetPwError.value = ''
  try {
    await api.users.resetPassword(resetPwUser.value.id, newPw.value)
    resetPwUser.value = null
  } catch (err) {
    resetPwError.value = err.message
  } finally {
    resettingPw.value = false
  }
}
</script>

<style scoped>
.admin-backdrop {
  position: absolute;
  inset: 0;
  z-index: 54;
  background: rgba(0,0,0,0);
  animation: backdropFadeIn 420ms ease forwards;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
}
@keyframes backdropFadeIn { to { background: rgba(0,0,0,0.45); } }
</style>
