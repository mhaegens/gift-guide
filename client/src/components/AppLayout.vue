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
  padding-bottom: 72px;
}
.bottom-nav {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 40;
}
</style>
