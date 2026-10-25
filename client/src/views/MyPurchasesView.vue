<template>
  <AppLayout>
    <div class="px-4 pt-6 pb-2">
      <h2 class="font-bold text-xl text-stone-800">My Purchases</h2>
      <p class="text-sm text-stone-500">Gifts you're buying or sponsoring together</p>
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
          <ItemCard
            v-for="item in group.items"
            :key="item.id"
            :item="item"
            :unclaiming="unclaimingId === item.id"
            @unclaim="unclaim(item, group)"
            @updated="onUpdated($event, group)"
          />
        </div>
      </div>
    </div>
  </AppLayout>
</template>

<script setup>
import { ref, onMounted, inject } from 'vue'
import AppLayout from '@/components/AppLayout.vue'
import ItemCard from '@/components/ItemCard.vue'
import { api } from '@/api/index.js'
import { avatarColor } from '@/utils.js'

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

function onUpdated(updated, group) {
  if (!updated.claimed_by_me && !updated.splitsies?.participants.some(p => p.is_me)) {
    group.items = group.items.filter(i => i.id !== updated.id)
    if (group.items.length === 0) groups.value = groups.value.filter(g => g.owner.id !== group.owner.id)
  } else {
    const index = group.items.findIndex(i => i.id === updated.id)
    if (index !== -1) group.items[index] = updated
  }
}
</script>
