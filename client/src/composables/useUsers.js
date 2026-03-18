import { ref } from 'vue'
import { api } from '@/api/index.js'

export function useUsers() {
  const users = ref([])
  const loading = ref(false)

  async function fetchUsers() {
    loading.value = true
    try {
      users.value = await api.users.list()
    } finally {
      loading.value = false
    }
  }

  return { users, loading, fetchUsers }
}
