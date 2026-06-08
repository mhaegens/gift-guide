<template>
  <AppLayout>
    <div class="px-4 pt-6 pb-2">
      <div class="flex items-center justify-between mb-1">
        <div>
          <h1 class="text-xl font-bold text-stone-800">The Great Gift Guide</h1>
          <p class="text-sm text-stone-500">Hello, {{ currentUser?.display_name }}! 👋</p>
        </div>
        <div class="text-3xl">🎁</div>
      </div>
    </div>

    <div v-if="loading" class="px-4 py-8 text-center text-stone-400">
      <div class="text-3xl mb-2">🎁</div>
      <p>Loading…</p>
    </div>

    <div
      v-else
      ref="gridEl"
      class="px-4 pb-4 user-grid-container lg:grid lg:grid-cols-2 lg:gap-4"
    >
      <UserCard
        v-for="(u, index) in usersWithCounts"
        :key="u.id"
        :user="u"
        :isSelf="u.id === currentUser?.id"
        class="user-card"
        @click="openWishlist(u)"
      />
    </div>

    <!-- Card overlay for wishlist -->
    <WishlistOverlay
      v-if="overlayUserId"
      :userId="overlayUserId"
      :gridEl="gridEl"
      @close="closeOverlay"
    />
  </AppLayout>
</template>

<script setup>
import { ref, onMounted, inject } from 'vue'
import { useRouter } from 'vue-router'
import AppLayout from '@/components/AppLayout.vue'
import UserCard from '@/components/UserCard.vue'
import WishlistOverlay from '@/components/WishlistOverlay.vue'
import { currentUser } from '@/stores/auth.js'
import { api } from '@/api/index.js'

const router = useRouter()
const showToast = inject('showToast')

const loading = ref(true)
const usersWithCounts = ref([])
const overlayUserId = ref(null)
const gridEl = ref(null)

onMounted(async () => {
  try {
    const users = await api.users.list()
    // Fetch item counts for each user
    const withCounts = await Promise.all(
      users.map(async (u) => {
        try {
          const items = await api.items.list(u.id)
          return { ...u, item_count: items.length }
        } catch {
          return { ...u, item_count: 0 }
        }
      })
    )
    usersWithCounts.value = withCounts
  } catch (err) {
    showToast?.('Failed to load family members')
  } finally {
    loading.value = false
  }
})

function openWishlist(u) {
  if (u.id === currentUser.value?.id) {
    router.push('/my-list')
    return
  }
  overlayUserId.value = u.id
}

function closeOverlay() {
  overlayUserId.value = null
  // Re-enable scroll on grid
  if (gridEl.value) gridEl.value.classList.remove('deck-receded')
}
</script>
