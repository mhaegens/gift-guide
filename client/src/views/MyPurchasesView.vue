<template>
  <AppLayout>
    <div class="px-4 pt-6 pb-2">
      <h2 class="font-bold text-xl text-stone-800">My Purchases</h2>
      <p class="text-sm text-stone-500">Items you've committed to buying</p>
    </div>

    <div class="px-4 space-y-4 pb-4">
      <div v-if="loading" class="text-center py-8 text-stone-400">
        <p>Loading…</p>
      </div>
      <div v-else-if="groups.length === 0" class="text-center py-12 text-stone-400">
        <div class="text-4xl mb-2">🛍️</div>
        <p class="font-medium">Nothing claimed yet</p>
        <p class="text-sm mt-1">Browse family wishlists to find something to buy</p>
      </div>

      <div v-for="group in groups" :key="group.owner.id">
        <div class="section-header">
          <div class="avatar text-sm" style="width:1.75rem;height:1.75rem;" :style="{ background: avatarColor(group.owner.id) }">
            {{ group.owner.display_name?.[0]?.toUpperCase() }}
          </div>
          {{ group.owner.display_name }}'s list
        </div>
        <div class="space-y-2">
          <div
            v-for="item in group.items"
            :key="item.id"
            class="bg-white rounded-xl p-4 shadow-sm flex items-center gap-3"
          >
            <div class="flex-1 min-w-0">
              <p class="font-semibold text-stone-800 text-sm truncate">{{ item.title }}</p>
              <div class="flex items-center gap-2 mt-1 flex-wrap">
                <span class="badge text-xs" :class="priceBadgeClass(item.price_category)">
                  {{ priceLabel(item.price_category) }}
                </span>
              </div>
            </div>
            <button
              class="btn btn-outline text-xs px-3 flex-shrink-0"
              style="min-height:36px;"
              :disabled="unclaimingId === item.id"
              @click="unclaim(item, group)"
            >
              {{ unclaimingId === item.id ? '…' : 'Unclaim' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </AppLayout>
</template>

<script setup>
import { ref, onMounted, inject } from 'vue'
import AppLayout from '@/components/AppLayout.vue'
import { api } from '@/api/index.js'
import { avatarColor, priceLabel, priceBadgeClass } from '@/utils.js'

const showToast = inject('showToast')

const groups = ref([])
const loading = ref(true)
const unclaimingId = ref(null)

onMounted(async () => {
  await loadPurchases()
})

async function loadPurchases() {
  loading.value = true
  try {
    const data = await api.claims.mine()
    groups.value = data
  } catch {
    showToast?.('Failed to load purchases')
  } finally {
    loading.value = false
  }
}

async function unclaim(item, group) {
  unclaimingId.value = item.id
  try {
    await api.claims.unclaim(item.id)
    group.items = group.items.filter(i => i.id !== item.id)
    if (group.items.length === 0) {
      groups.value = groups.value.filter(g => g.owner.id !== group.owner.id)
    }
    showToast?.('Unclaimed')
  } catch (err) {
    showToast?.(err.message || 'Could not unclaim')
  } finally {
    unclaimingId.value = null
  }
}
</script>
