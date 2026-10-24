<template>
  <div class="item-card">
    <!-- OG Image or placeholder -->
    <template v-if="item.og_image_url">
      <img
        :src="item.og_image_url"
        :alt="item.title"
        class="og-img"
        @error="imgError = true"
        v-if="!imgError"
      />
      <div class="og-placeholder" v-else>🎁</div>
    </template>
    <div v-else class="og-placeholder">🎁</div>

    <!-- Card body -->
    <div class="p-3 cursor-pointer" @click="expanded = !expanded">
      <div class="flex items-start justify-between gap-2">
        <div class="flex-1 min-w-0">
          <p class="font-semibold text-stone-800 text-sm leading-snug truncate">{{ item.title }}</p>
          <div class="flex items-center gap-2 mt-1 flex-wrap">
            <span class="badge text-xs" :class="priceBadgeClass(item.price_category)">
              {{ priceLabel(item.price_category) }}
            </span>
            <span class="badge text-xs" :class="item.priority > 0 ? 'badge-rose' : 'badge-stone'">
              {{ item.priority === 2 ? '★ ' : '' }}{{ priorityLabel(item.priority) }}
            </span>
            <span v-if="!isOwnList && item.is_claimed" class="badge badge-emerald text-xs">
              Claimed ✓
            </span>
          </div>
          <p v-if="item.buyer_notes && !expanded" class="text-xs text-stone-400 mt-1 truncate">
            {{ item.buyer_notes }}
          </p>
        </div>
        <!-- Own list actions -->
        <div v-if="isOwnList" class="flex gap-1 flex-shrink-0">
          <button
            class="btn btn-ghost p-1.5"
            style="min-height:unset;"
            @click.stop="$emit('edit', item)"
            title="Edit"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-4 h-4">
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
          <button
            class="btn btn-ghost p-1.5 text-red-400"
            style="min-height:unset;"
            @click.stop="$emit('delete', item)"
            title="Delete"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-4 h-4">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
              <path d="M10 11v6M14 11v6"/>
              <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
            </svg>
          </button>
        </div>
        <!-- Expand indicator -->
        <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-4 h-4 text-stone-400 flex-shrink-0 mt-0.5 transition-transform" :class="{ 'rotate-180': expanded }">
          <path d="M6 9l6 6 6-6"/>
        </svg>
      </div>
    </div>

    <SplitsiesPanel v-if="!isOwnList" :item="item" :expanded="expanded" @updated="$emit('updated', $event)" />

    <!-- Expanded detail -->
    <div v-if="expanded" class="border-t border-stone-100 px-3 pb-3 pt-2.5 bg-stone-50/70">
      <p v-if="item.description" class="text-sm text-stone-600 mb-2 whitespace-pre-line">{{ item.description }}</p>
      <a
        v-if="item.url"
        :href="item.url"
        target="_blank"
        rel="noopener noreferrer"
        class="inline-flex items-center gap-1.5 text-sm font-medium text-amber-700 hover:underline mb-2"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-4 h-4">
          <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>
          <polyline points="15 3 21 3 21 9"/>
          <line x1="10" y1="14" x2="21" y2="3"/>
        </svg>
        Open link
      </a>
      <div v-if="item.buyer_notes" class="bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mt-1">
        <p class="text-xs font-semibold text-amber-800 mb-0.5">Notes for buyer</p>
        <p class="text-sm text-amber-900 whitespace-pre-line">{{ item.buyer_notes }}</p>
      </div>

      <!-- Claim actions (other people's lists only) -->
      <template v-if="!isOwnList">
        <div class="mt-3">
          <!-- Unclaimed -->
          <button
            v-if="!item.is_claimed && !item.splitsies"
            class="btn btn-amber w-full"
            :disabled="claiming"
            @click="$emit('claim', item)"
          >
            {{ claiming ? 'Claiming…' : 'Buy this' }}
          </button>
          <!-- Claimed by me -->
          <div v-else-if="item.claimed_by_me" class="flex items-center justify-between gap-3">
            <span class="text-sm font-semibold text-emerald-700 flex items-center gap-1.5">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="w-4 h-4">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              You're buying this
            </span>
            <button class="btn btn-outline text-xs px-3" style="min-height:36px;" :disabled="unclaiming" @click="$emit('unclaim', item)">
              {{ unclaiming ? 'Removing…' : 'Unclaim' }}
            </button>
          </div>
          <!-- Claimed by someone else -->
          <div v-else-if="item.is_claimed" class="text-sm text-stone-400 font-medium flex items-center gap-1.5">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-4 h-4">
              <circle cx="12" cy="12" r="10"/>
              <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
            </svg>
            Already claimed
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { priceLabel, priceBadgeClass, priorityLabel } from '@/utils.js'
import SplitsiesPanel from './SplitsiesPanel.vue'

defineProps({
  item: { type: Object, required: true },
  isOwnList: { type: Boolean, default: false },
  claiming: { type: Boolean, default: false },
  unclaiming: { type: Boolean, default: false },
})
defineEmits(['claim', 'unclaim', 'edit', 'delete', 'updated'])

const expanded = ref(false)
const imgError = ref(false)
</script>
