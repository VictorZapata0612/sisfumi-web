-<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useAnimatedCounter } from '@/composables/useAnimatedCounter'

const props = withDefaults(
  defineProps<{
    target: number
    duration?: number
    prefix?: string
    suffix?: string
  }>(),
  {
    duration: 2000,
    prefix: '',
    suffix: '',
  },
)

const element = ref<HTMLElement | null>(null)
const hasAnimated = ref(false)

const { animatedValue, startAnimation } = useAnimatedCounter(props.target, props.duration)

let observer: IntersectionObserver

onMounted(() => {
  observer = new IntersectionObserver(
    (entries) => {
      if (entries[0]?.isIntersecting && !hasAnimated.value) {
        startAnimation()
        hasAnimated.value = true
        if (element.value) {
          observer.unobserve(element.value)
        }
      }
    },
    { threshold: 0.2 }, // Lower threshold to trigger animation sooner
  )

  if (element.value) observer.observe(element.value)
})

onUnmounted(() => observer?.disconnect())
</script>

<template>
  <span ref="element" class="relative">
    <!-- The animated value, shown only when animation starts -->
    <span v-if="hasAnimated">{{ prefix }}{{ animatedValue ?? 0 }}{{ suffix }}</span>
    <!--
      A hidden placeholder with the final value.
      This gives the container the correct width/height from the start,
      ensuring the IntersectionObserver can see it.
    -->
    <span v-else class="opacity-0">{{ prefix }}{{ target }}{{ suffix }}</span>
  </span>
</template>
