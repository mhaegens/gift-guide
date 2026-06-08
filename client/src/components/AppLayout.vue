<template>
  <div class="flex flex-col" style="height: 100%; overflow: hidden; position: relative;">
    <div class="flex-1 overflow-y-auto has-bottom-nav">
      <slot />
    </div>
    <BottomNav class="bottom-nav" />
  </div>
</template>

<script setup>
import BottomNav from './BottomNav.vue'
</script>

<style scoped>
.has-bottom-nav {
  padding-bottom: 0;
}
.bottom-nav {
  flex-shrink: 0;
  position: sticky;
  bottom: 0;
  z-index: 40;
}
</style>
