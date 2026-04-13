import type { Directive } from 'vue'

/**
 * Opciones para el IntersectionObserver.
 * threshold: 0.15 significa que la animación se disparará cuando el 15% del elemento sea visible.
 */
const observerOptions: IntersectionObserverInit = {
  threshold: 0.15,
}

const animatedScrollObserver = new IntersectionObserver((entries, observer) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add('in-view')
      observer.unobserve(entry.target) // Dejamos de observar el elemento una vez animado
    }
  })
}, observerOptions)

export const vScrollAnimation: Directive = {
  mounted(el) {
    el.classList.add('animate-on-scroll') // Clase base para el estado inicial (oculto)
    animatedScrollObserver.observe(el)
  },
}
