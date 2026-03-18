<template>
  <div class="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
    <button
      v-for="chip in PRICE_CHIPS"
      :key="chip.value"
      class="price-chip"
      :class="{ active: modelValue === chip.value }"
      @click="$emit('update:modelValue', chip.value)"
    >
      {{ chip.label }}
    </button>
  </div>
</template>

<script setup>
import { PRICE_CHIPS } from '@/utils.js'

defineProps({ modelValue: { type: String, default: 'all' } })
defineEmits(['update:modelValue'])
</script>
