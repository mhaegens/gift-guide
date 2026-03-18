<template>
  <AppLayout>
    <div class="bg-white shadow-sm px-4 pt-5 pb-3 sticky top-0 z-30">
      <div class="flex items-center gap-3 mb-3">
        <button class="btn btn-ghost p-2 -ml-2" @click="router.back()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="w-5 h-5">
            <path d="M15 19l-7-7 7-7"/>
          </svg>
        </button>
        <div class="flex items-center gap-2 flex-1">
          <div class="avatar" style="width:2.25rem;height:2.25rem;font-size:1rem;" :style="{ background: avatarColor(userId) }">
            {{ owner?.display_name?.[0]?.toUpperCase() ?? '?' }}
          </div>
          <div>
            <h2 class="font-bold text-stone-800 leading-tight">{{ owner?.display_name ? owner.display_name + '\u2019s Wishlist' : 'Wishlist' }}</h2>
            <p class="text-xs text-stone-500">{{ totalCount }} item{{ totalCount !== 1 ? 's' : '' }}</p>
          </div>
        </div>
      </div>
      <PriceFilter v-model="priceFilter" />
    </div>

    <div class="px-4 pt-3 space-y-3 pb-4">
      <div v-if="loading" class="text-center py-8 text-stone-400">
        <p>Loading…</p>
      </div>
      <div v-else-if="filteredItems.length === 0" class="text-center py-12 text-stone-400">
        <div class="text-4xl mb-2">🎁</div>
        <p class="font-medium">No items in this price range</p>
      </div>
      <ItemCard
        v-for="item in filteredItems"
        :key="item.id"
        :item="item"
        :is-own-list="false"
        :claiming="claimingId === item.id"
        :unclaiming="unclaimingId === item.id"
        @claim="claimItem"
        @unclaim="unclaimItem"
      />
    </div>
  </AppLayout>
</template>

<script setup>
import { ref, computed, onMounted, inject } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppLayout from '@/components/AppLayout.vue'
import PriceFilter from '@/components/PriceFilter.vue'
import ItemCard from '@/components/ItemCard.vue'
import { api } from '@/api/index.js'
import { avatarColor } from '@/utils.js'

const route = useRoute()
const router = useRouter()
const showToast = inject('showToast')

const userId = parseInt(route.params.userId, 10)
const items = ref([])
const owner = ref(null)
const loading = ref(true)
const priceFilter = ref('all')
const claimingId = ref(null)
const unclaimingId = ref(null)

const totalCount = computed(() => items.value.length)
const filteredItems = computed(() => {
  if (priceFilter.value === 'all') return items.value
  return items.value.filter(i => i.price_category === priceFilter.value)
})

onMounted(async () => {
  try {
    const [itemList, users] = await Promise.all([
      api.items.list(userId),
      api.users.list(),
    ])
    items.value = itemList
    owner.value = users.find(u => u.id === userId) || null
  } catch {
    showToast?.('Failed to load wishlist')
  } finally {
    loading.value = false
  }
})

async function claimItem(item) {
  claimingId.value = item.id
  try {
    await api.claims.claim(item.id)
    item.is_claimed = true
    item.claimed_by_me = true
    showToast?.('Added to your purchases!')
  } catch (err) {
    if (err.status === 409) {
      item.is_claimed = true
      item.claimed_by_me = false
      showToast?.('Someone just claimed this!')
    } else {
      showToast?.(err.message || 'Could not claim item')
    }
  } finally {
    claimingId.value = null
  }
}

async function unclaimItem(item) {
  unclaimingId.value = item.id
  try {
    await api.claims.unclaim(item.id)
    item.is_claimed = false
    item.claimed_by_me = false
    showToast?.('Unclaimed')
  } catch (err) {
    showToast?.(err.message || 'Could not unclaim')
  } finally {
    unclaimingId.value = null
  }
}
</script>
