<script setup lang="ts">
import { useToast } from '@/composables/useToast'

const { toasts, removeToast } = useToast()

const getIcon = (type: string | undefined = 'info') => {
  switch (type) {
    case 'success': return 'fa-check-circle'
    case 'error': return 'fa-times-circle'
    case 'warning': return 'fa-exclamation-triangle'
    default: return 'fa-info-circle'
  }
}

const getTypeStyles = (type: string | undefined = 'info') => {
  switch (type) {
    case 'success':
      return 'border-l-4 border-emerald-500 text-emerald-400'
    case 'error':
      return 'border-l-4 border-red-500 text-red-400'
    case 'warning':
      return 'border-l-4 border-yellow-500 text-yellow-400'
    default:
      return 'border-l-4 border-blue-500 text-blue-400'
  }
}
</script>

<template>
  <div class="fixed top-4 right-4 z-[9999] flex flex-col gap-3 w-full max-w-sm pointer-events-none">
    <transition-group name="toast">
      <div v-for="toast in toasts" :key="toast.id"
        class="pointer-events-auto bg-[#151515] border border-white/10 shadow-2xl rounded-r-lg rounded-l-none p-4 flex items-start gap-3 transform transition-all duration-300 backdrop-blur-md"
        :class="getTypeStyles(toast.type)">
        <div class="shrink-0 mt-0.5" :class="{ 'cursor-pointer': toast.action }" @click="toast.action?.onClick">
          <i class="fas text-lg" :class="getIcon(toast.type)"></i>
        </div>
        <div class="flex-grow min-w-0">
          <h4 v-if="toast.title" class="font-bold text-sm mb-0.5 text-white">{{ toast.title }}</h4>
          <p class="text-sm text-gray-300 leading-snug break-words">{{ toast.message }}</p>
        </div>
        <button v-if="toast.action" @click="toast.action.onClick"
          class="shrink-0 text-xs font-bold uppercase tracking-wider border border-current px-2 py-1 rounded hover:bg-white/10 transition-colors ml-2">
          {{ toast.action.label }}
        </button>
        <button @click="removeToast(toast.id)"
          class="shrink-0 text-gray-500 hover:text-white transition-colors p-1 -mt-1 -mr-1">
          <i class="fas fa-times"></i>
        </button>
      </div>
    </transition-group>
  </div>
</template>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateX(100%);
}

.toast-move {
  transition: transform 0.3s ease;
}
</style>
