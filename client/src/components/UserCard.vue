<template>
  <div
    class="bg-white rounded-2xl border border-stone-100 p-5 flex flex-col items-center gap-2 cursor-pointer transition-all duration-200 hover:-translate-y-0.5"
    style="box-shadow: 0 1px 4px rgba(0,0,0,0.07), 0 4px 16px rgba(0,0,0,0.05);"
    @click="$emit('click')"
  >
    <div
      class="avatar text-xl mb-1"
      style="width:3.5rem;height:3.5rem;"
      :style="{ background: avatarColor(user.id) }"
    >
      {{ avatarInitial(user.display_name) }}
    </div>
    <div class="text-center">
      <p class="font-semibold text-stone-800 text-sm leading-tight">
        {{ user.display_name }}<span v-if="isSelf" class="text-amber-600"> (you)</span>
      </p>
      <div class="flex justify-center gap-1 mt-0.5 flex-wrap">
        <span v-if="user.is_admin" class="badge badge-amber text-xs">Admin</span>
        <span v-if="!user.is_active" class="badge badge-stone text-xs">Inactive</span>
      </div>
      <p class="text-xs text-stone-400 mt-1">{{ user.item_count ?? 0 }} item{{ (user.item_count ?? 0) !== 1 ? 's' : '' }}</p>
    </div>
  </div>
</template>

<script setup>
import { avatarColor, avatarInitial } from '@/utils.js'

defineProps({
  user: { type: Object, required: true },
  isSelf: { type: Boolean, default: false },
})
defineEmits(['click'])
</script>
