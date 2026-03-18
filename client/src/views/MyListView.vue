<template>
  <AppLayout>
    <div class="bg-white shadow-sm px-4 pt-5 pb-3 sticky top-0 z-30">
      <div class="flex items-center justify-between mb-3">
        <div>
          <h2 class="font-bold text-lg text-stone-800">My Wishlist</h2>
          <p class="text-xs text-stone-500">{{ totalCount }} item{{ totalCount !== 1 ? 's' : '' }}</p>
        </div>
      </div>
      <PriceFilter v-model="priceFilter" />
    </div>

    <WishlistHealthPanel
      v-if="!loading && items.length > 0"
      :items="items"
      @add-item="openAdd"
    />

    <div class="px-4 pt-3 space-y-3 pb-4">
      <div v-if="loading" class="text-center py-8 text-stone-400">
        <p>Loading…</p>
      </div>
      <div v-else-if="items.length === 0" class="text-center py-12 text-stone-400">
        <div class="text-4xl mb-2">🎁</div>
        <p class="font-medium">Your wishlist is empty</p>
        <p class="text-sm mt-1">Tap + to add your first gift idea</p>
      </div>
      <div v-else-if="filteredItems.length === 0" class="text-center py-12 text-stone-400">
        <div class="text-4xl mb-2">🎁</div>
        <p class="font-medium">No items in this price range</p>
      </div>
      <ItemCard
        v-for="item in filteredItems"
        :key="item.id"
        :item="item"
        :is-own-list="true"
        @edit="openEdit"
        @delete="openDelete"
      />
    </div>

    <!-- FAB -->
    <button
      class="fab-add fixed bottom-20 right-4 w-14 h-14 bg-amber-500 rounded-full shadow-lg flex items-center justify-center text-white text-3xl z-30 hover:bg-amber-600 transition-colors"
      aria-label="Add gift"
      @click="openAdd"
    >+</button>

    <!-- Add/Edit modal -->
    <ItemModal
      :show="showModal"
      :item="editingItem"
      @close="showModal = false"
      @save="onSaved"
    />

    <!-- Delete confirm modal -->
    <transition name="modal">
      <div v-if="deletingItem" class="modal-overlay" @click.self="deletingItem = null">
        <div class="modal-sheet" @click.stop>
          <div class="text-center py-2">
            <div class="text-4xl mb-3">🗑️</div>
            <h3 class="font-bold text-lg text-stone-800 mb-1">Remove item?</h3>
            <p class="text-stone-500 text-sm mb-5">{{ deletingItem.title }}</p>
            <div class="flex gap-3">
              <button class="btn btn-outline flex-1" @click="deletingItem = null">Keep it</button>
              <button class="btn btn-danger flex-1" :disabled="deleting" @click="confirmDelete">
                {{ deleting ? 'Removing…' : 'Remove' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </transition>
  </AppLayout>
</template>

<script setup>
import { ref, computed, onMounted, inject } from 'vue'
import AppLayout from '@/components/AppLayout.vue'
import PriceFilter from '@/components/PriceFilter.vue'
import ItemCard from '@/components/ItemCard.vue'
import ItemModal from '@/components/ItemModal.vue'
import WishlistHealthPanel from '@/components/WishlistHealthPanel.vue'
import { api } from '@/api/index.js'
import { currentUser } from '@/stores/auth.js'

const showToast = inject('showToast')

const items = ref([])
const loading = ref(true)
const priceFilter = ref('all')
const showModal = ref(false)
const editingItem = ref(null)
const deletingItem = ref(null)
const deleting = ref(false)

const totalCount = computed(() => items.value.length)
const filteredItems = computed(() => {
  if (priceFilter.value === 'all') return items.value
  return items.value.filter(i => i.price_category === priceFilter.value)
})

onMounted(async () => {
  try {
    items.value = await api.items.list(currentUser.value.id)
  } catch {
    showToast?.('Failed to load your list')
  } finally {
    loading.value = false
  }
})

function openAdd() {
  editingItem.value = null
  showModal.value = true
}

function openEdit(item) {
  editingItem.value = item
  showModal.value = true
}

function openDelete(item) {
  deletingItem.value = item
}

function onSaved(savedItem) {
  if (editingItem.value) {
    const idx = items.value.findIndex(i => i.id === savedItem.id)
    if (idx !== -1) items.value[idx] = savedItem
  } else {
    items.value.unshift(savedItem)
  }
}

async function confirmDelete() {
  deleting.value = true
  try {
    await api.items.remove(deletingItem.value.id)
    items.value = items.value.filter(i => i.id !== deletingItem.value.id)
    deletingItem.value = null
    showToast?.('Item removed')
  } catch (err) {
    showToast?.(err.message || 'Could not delete item')
  } finally {
    deleting.value = false
  }
}
</script>
