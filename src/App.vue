<script setup lang="ts">
import { RouterView } from 'vue-router'
import { useAuthStore } from './stores/auth'

const authStore = useAuthStore()
</script>

<template>
  <div
    v-if="authStore.loading"
    class="flex items-center justify-center h-screen bg-gray-900 text-white"
  >
    <div class="text-center">
      <i class="fas fa-spinner fa-spin text-4xl text-cyan-400"></i>
      <p class="mt-4">Cargando sesión...</p>
    </div>
  </div>
  <main v-else>
    <RouterView />
  </main>
</template>

<style scoped></style>
