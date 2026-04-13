<script setup lang="ts">
import { ref } from 'vue'

defineProps<{
  question: string
}>()

const isOpen = ref(false)

const onBeforeLeave = (el: Element) => {
  ; (el as HTMLElement).style.height = `${el.scrollHeight}px`
}
const onLeave = (el: Element) => {
  ; (el as HTMLElement).style.height = '0'
}
const onEnter = (el: Element) => {
  ; (el as HTMLElement).style.height = `${el.scrollHeight}px`
}
const onAfterEnter = (el: Element) => {
  ; (el as HTMLElement).style.height = 'auto'
}
</script>

<template>
  <div class="border-b border-white/10 py-6">
    <button @click="isOpen = !isOpen"
      class="w-full flex justify-between items-center text-left text-lg font-semibold text-white hover:text-brand-red transition-colors">
      <span>{{ question }}</span>
      <span class="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 shrink-0">
        <i class="fas fa-chevron-down text-xs transition-transform duration-300" :class="{ 'rotate-180': isOpen }"
          aria-hidden="true"></i>
      </span>
    </button>
    <transition name="expand" @before-leave="onBeforeLeave" @leave="onLeave" @enter="onEnter"
      @after-enter="onAfterEnter">
      <div v-if="isOpen" class="overflow-hidden">
        <div class="pt-4 text-gray-400 leading-relaxed">
          <slot />
        </div>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.expand-enter-active,
.expand-leave-active {
  transition: height 0.3s ease-in-out;
}
</style>
