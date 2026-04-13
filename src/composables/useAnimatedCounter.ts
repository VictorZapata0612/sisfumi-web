import { ref, onUnmounted } from 'vue'

/**
 * Un "composable" de Vue para animar un número de 0 a un valor objetivo.
 * @param targetValue El número final al que se animará.
 * @param duration La duración de la animación en milisegundos.
 */
export function useAnimatedCounter(targetValue: number, duration = 2000) {
  const animatedValue = ref(0)
  let frameId: number | null = null

  const animate = (startTime: number) => {
    const currentTime = performance.now()
    const elapsedTime = currentTime - startTime
    const progress = Math.min(elapsedTime / duration, 1)
    const easedProgress = 1 - Math.pow(1 - progress, 3) // Efecto "ease-out"

    animatedValue.value = Math.floor(easedProgress * targetValue)

    if (progress < 1) {
      frameId = requestAnimationFrame(() => animate(startTime))
    }
  }

  const startAnimation = () => {
    const startTime = performance.now()
    animate(startTime)
  }

  onUnmounted(() => {
    if (frameId) cancelAnimationFrame(frameId)
  })

  return { animatedValue, startAnimation }
}
