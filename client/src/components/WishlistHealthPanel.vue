<template>
  <div class="mx-4 mt-3 bg-white shadow-sm rounded-xl overflow-hidden">
    <!-- Header row (always visible, toggles expand) -->
    <button
      class="w-full flex items-center justify-between px-4 py-3 text-left"
      @click="expanded = !expanded"
      :aria-expanded="expanded"
    >
      <div class="flex items-center gap-2">
        <span class="text-sm font-semibold text-stone-700">Wishlist health</span>
        <span
          class="text-xs font-semibold px-2 py-0.5 rounded-full"
          :class="scoreLabelClass"
        >{{ scoreLabel }}</span>
      </div>
      <svg
        class="w-4 h-4 text-stone-400 transition-transform duration-200"
        :class="{ 'rotate-180': expanded }"
        fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"
      >
        <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
      </svg>
    </button>

    <!-- Expandable body -->
    <div v-if="expanded" class="px-4 pb-4 border-t border-stone-100">
      <!-- Score bar -->
      <div class="mt-3 mb-4">
        <div class="flex justify-between items-center mb-1">
          <span class="text-xs text-stone-500">Score</span>
          <span class="text-xs font-bold text-stone-700">{{ healthScore }}/100</span>
        </div>
        <div class="h-2 bg-stone-100 rounded-full overflow-hidden">
          <div
            class="h-full rounded-full transition-all duration-500"
            :class="scoreBarClass"
            :style="{ width: healthScore + '%' }"
          />
        </div>
      </div>

      <!-- Budget spread pills -->
      <div class="mb-4">
        <p class="text-xs text-stone-500 mb-2">Budget spread</p>
        <div class="flex gap-1.5 flex-wrap">
          <div
            v-for="cat in CATEGORIES"
            :key="cat.value"
            class="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full transition-opacity"
            :class="countByCategory[cat.value] > 0 ? cat.activeClass : 'bg-stone-100 text-stone-400'"
          >
            <span>{{ cat.label }}</span>
            <span
              class="inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold"
              :class="countByCategory[cat.value] > 0 ? cat.badgeClass : 'bg-stone-200 text-stone-400'"
            >{{ countByCategory[cat.value] }}</span>
          </div>
        </div>
      </div>

      <!-- Suggestions -->
      <div class="space-y-2">
        <div
          v-for="(tip, i) in visibleSuggestions"
          :key="i"
          class="flex items-center justify-between gap-2 bg-stone-50 rounded-lg px-3 py-2"
        >
          <span class="text-xs text-stone-600 leading-snug">{{ tip.text }}</span>
          <button
            v-if="tip.cta"
            class="shrink-0 text-xs font-semibold text-amber-600 hover:text-amber-700 whitespace-nowrap"
            @click="$emit('add-item')"
          >+ Add item</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { PRICE_LABELS } from '@/utils.js'

const props = defineProps({
  items: { type: Array, required: true },
})

defineEmits(['add-item'])

const expanded = ref(false)

const CATEGORIES = [
  { value: 'free',      label: 'Free',    activeClass: 'bg-emerald-100 text-emerald-700', badgeClass: 'bg-emerald-200 text-emerald-700' },
  { value: '0_20',      label: '€0–20',   activeClass: 'bg-amber-100 text-amber-700',   badgeClass: 'bg-amber-200 text-amber-700' },
  { value: '20_50',     label: '€20–50',  activeClass: 'bg-amber-100 text-amber-700',   badgeClass: 'bg-amber-200 text-amber-700' },
  { value: '50_100',    label: '€50–100', activeClass: 'bg-rose-100 text-rose-700',     badgeClass: 'bg-rose-200 text-rose-700' },
  { value: '100_plus',  label: '€100+',   activeClass: 'bg-rose-100 text-rose-700',     badgeClass: 'bg-rose-200 text-rose-700' },
]

const countByCategory = computed(() => {
  const counts = {}
  for (const cat of CATEGORIES) counts[cat.value] = 0
  for (const item of props.items) {
    if (item.price_category in counts) counts[item.price_category]++
  }
  return counts
})

const coveredCount = computed(() =>
  CATEGORIES.filter(c => countByCategory.value[c.value] > 0).length
)

const healthScore = computed(() => {
  const total = props.items.length
  if (total === 0) return 0

  // Coverage: 8 pts per category with ≥1 item
  const coverageScore = coveredCount.value * 8

  // Volume: 0/10/20/30 pts
  const volumeScore = total >= 10 ? 30 : total >= 6 ? 20 : total >= 3 ? 10 : 0

  // Quality: fraction of items with a URL
  const withUrl = props.items.filter(i => i.url && i.url.trim()).length
  const qualityScore = Math.round((withUrl / total) * 30)

  return Math.min(100, coverageScore + volumeScore + qualityScore)
})

const scoreLabel = computed(() => {
  const s = healthScore.value
  if (s >= 85) return 'Great list!'
  if (s >= 65) return 'Looking good'
  if (s >= 40) return 'Getting there'
  return 'Just starting'
})

const scoreLabelClass = computed(() => {
  const s = healthScore.value
  if (s >= 85) return 'bg-emerald-100 text-emerald-700'
  if (s >= 65) return 'bg-blue-100 text-blue-700'
  if (s >= 40) return 'bg-amber-100 text-amber-700'
  return 'bg-stone-100 text-stone-500'
})

const scoreBarClass = computed(() => {
  const s = healthScore.value
  if (s >= 85) return 'bg-emerald-400'
  if (s >= 65) return 'bg-blue-400'
  if (s >= 40) return 'bg-amber-400'
  return 'bg-stone-400'
})

const suggestions = computed(() => {
  const tips = []
  const total = props.items.length
  const counts = countByCategory.value
  const withUrl = props.items.filter(i => i.url && i.url.trim()).length

  if (total < 5) {
    tips.push({ text: 'Add more items — aim for at least 5', cta: true })
  }
  if (!counts['100_plus']) {
    tips.push({ text: 'Add a €100+ item so people can go in together', cta: true })
  }
  if (!counts['50_100']) {
    tips.push({ text: 'Add a €50–100 item for bigger gifts', cta: true })
  }
  if (!counts['0_20']) {
    tips.push({ text: 'Add something under €20 for an easy win', cta: true })
  }
  if (!counts['free']) {
    tips.push({ text: 'Add a free item (experience, homemade…)', cta: true })
  }
  if (total > 0 && withUrl / total < 0.6) {
    tips.push({ text: 'Add links to items to make shopping easier', cta: false })
  }
  if (tips.length === 0) {
    tips.push({ text: 'Your list is looking great! Keep it up 🎉', cta: false })
  }
  return tips
})

const visibleSuggestions = computed(() => suggestions.value.slice(0, 2))
</script>
