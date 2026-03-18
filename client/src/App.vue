<template>
  <div id="desktop-stage">
    <div class="stage-card stage-back-2"></div>
    <div class="stage-card stage-back-1"></div>
    <div id="app-card">
      <!-- Toast -->
      <div class="toast" :class="{ show: toast.visible }" ref="toastEl">{{ toast.message }}</div>
      <!-- Router view -->
      <router-view v-slot="{ Component, route }">
        <transition :name="route.meta.transition || 'route'" mode="out-in">
          <component :is="Component" :key="route.path" />
        </transition>
      </router-view>
    </div>
  </div>
</template>

<script setup>
import { reactive, ref, provide } from 'vue'

const toast = reactive({ visible: false, message: '' })
let toastTimer = null

function showToast(msg, duration = 2500) {
  toast.message = msg
  toast.visible = true
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toast.visible = false }, duration)
}

provide('showToast', showToast)
</script>
