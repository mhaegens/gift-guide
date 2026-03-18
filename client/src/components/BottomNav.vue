<template>
  <nav class="bg-white/95 backdrop-blur-sm border-t border-stone-100">
    <div class="flex">
      <button class="nav-btn" :class="{ active: isActive('/') }" @click="router.push('/')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M3 12l9-9 9 9"/>
          <path d="M5 10v9a1 1 0 001 1h4v-5h4v5h4a1 1 0 001-1v-9"/>
        </svg>
        Home
      </button>
      <button class="nav-btn" :class="{ active: isActive('/my-list') }" @click="router.push('/my-list')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="5" y="3" width="14" height="18" rx="2"/>
          <path d="M9 7h6M9 11h6M9 15h4"/>
        </svg>
        My List
      </button>
      <button class="nav-btn" :class="{ active: isActive('/my-purchases') }" @click="router.push('/my-purchases')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/>
          <path d="M3 6h18"/>
          <path d="M16 10a4 4 0 01-8 0"/>
        </svg>
        My Purchases
      </button>
      <button class="nav-btn" :class="{ active: isActive('/profile') }" @click="router.push('/profile')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="8" r="4"/>
          <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
        </svg>
        Profile
      </button>
    </div>
  </nav>
</template>

<script setup>
import { useRouter, useRoute } from 'vue-router'

const router = useRouter()
const route = useRoute()

function isActive(path) {
  if (path === '/') return route.path === '/' || route.path.startsWith('/list/')
  return route.path === path
}
</script>
