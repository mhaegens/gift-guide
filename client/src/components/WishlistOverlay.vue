<template>
  <div class="card-overlay open">
    <div
      class="card-overlay-backdrop"
      :class="backdropClass"
      @click="close('slide')"
    />
    <div
      class="card-overlay-card"
      :class="cardClass"
      @animationend="onCardAnimEnd"
    >
      <!-- Sticky header -->
      <div class="bg-white px-4 pt-5 pb-3 flex-shrink-0" style="border-radius: 2rem 2rem 0 0; position: sticky; top: 0; z-index: 10;">
        <div class="flex items-center gap-3 mb-3">
          <button class="btn btn-ghost p-2 -ml-2" aria-label="Close" @click="close('slide')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="w-5 h-5">
              <path d="M19 12H5M12 5l-7 7 7 7"/>
            </svg>
          </button>
          <div class="flex items-center gap-2 flex-1">
            <div class="avatar" style="width:2.25rem;height:2.25rem;font-size:1rem;" :style="{ background: avatarColor(userId) }">
              {{ ownerName ? ownerName[0].toUpperCase() : '?' }}
            </div>
            <div>
              <h2 class="font-bold text-stone-800 leading-tight text-sm">{{ ownerName ? ownerName + '\u2019s Wishlist' : '' }}</h2>
              <p class="text-xs text-stone-500">{{ totalCount }} item{{ totalCount !== 1 ? 's' : '' }}</p>
            </div>
          </div>
          <button class="btn btn-ghost p-2 text-stone-400" aria-label="Shuffle back" @click="close('stack')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-5 h-5">
              <rect x="2" y="7" width="20" height="14" rx="2"/>
              <path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/>
            </svg>
          </button>
        </div>
        <PriceFilter v-model="priceFilter" />
      </div>

      <!-- Scrollable items -->
      <div class="px-4 pt-3 space-y-3 pb-6 overflow-y-auto flex-1">
        <div v-if="loadingItems" class="text-center py-8 text-stone-400">
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
          :is-own-list="userId === currentUser?.id"
          :claiming="claimingId === item.id"
          :unclaiming="unclaimingId === item.id"
          @claim="claimItem"
          @unclaim="unclaimItem"
          @updated="Object.assign(item, $event)"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, inject, watch } from 'vue'
import PriceFilter from './PriceFilter.vue'
import ItemCard from './ItemCard.vue'
import { currentUser } from '@/stores/auth.js'
import { api } from '@/api/index.js'
import { avatarColor } from '@/utils.js'

const props = defineProps({
  userId: { type: Number, required: true },
  gridEl: { type: Object, default: null },
})
const emit = defineEmits(['close'])
const showToast = inject('showToast')

const items = ref([])
const ownerName = ref('')
const loadingItems = ref(true)
const priceFilter = ref('all')
const claimingId = ref(null)
const unclaimingId = ref(null)
const cardClass = ref('entering')
const backdropClass = ref('visible')
const closing = ref(false)
const closeMode = ref('slide')

const totalCount = computed(() => items.value.length)
const filteredItems = computed(() => {
  if (priceFilter.value === 'all') return items.value
  return items.value.filter(i => i.price_category === priceFilter.value)
})

onMounted(async () => {
  // Recede the grid
  if (props.gridEl) props.gridEl.classList.add('deck-receded')

  try {
    const [itemList, users] = await Promise.all([
      api.items.list(props.userId),
      api.users.list(),
    ])
    items.value = itemList
    const owner = users.find(u => u.id === props.userId)
    ownerName.value = owner?.display_name || ''
  } catch {
    showToast?.('Failed to load wishlist')
  } finally {
    loadingItems.value = false
  }
})

function close(mode) {
  closeMode.value = mode
  backdropClass.value = 'hiding'
  cardClass.value = mode === 'stack' ? 'exit-stack' : 'exit-slide'
  closing.value = true
}

function onCardAnimEnd() {
  if (closing.value) {
    if (props.gridEl) props.gridEl.classList.remove('deck-receded')
    emit('close')
  }
}

async function claimItem(item) {
  claimingId.value = item.id
  try {
    await api.claims.claim(item.id)
    item.is_claimed = true
    item.claimed_by_me = true
    showToast?.('Added to your purchases!')
  } catch (err) {
    if (err.status === 409) {
      try { Object.assign(item, await api.splitsies.get(item.id)) } catch {}
      showToast?.(err.message)
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
