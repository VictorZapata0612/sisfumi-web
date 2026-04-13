<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { useToast } from '@/composables/useToast'
import FaqItem from '@/components/FaqItem.vue'
import AnimatedCounter from '@/components/AnimatedCounter.vue'

const testimonials = [
  {
    text: 'El servicio fue impecable. Resolvieron mi problema de hormigas en tiempo récord y con mucha profesionalidad. ¡Totalmente recomendados!',
    author: 'Ana María G.',
    role: 'Residente, Cali',
  },
  {
    text: 'Como gerente de un restaurante, la higiene es primordial. Control Total nos ha dado la tranquilidad de tener un ambiente libre de plagas.',
    author: 'Carlos R.',
    role: 'Gerente de Restaurante',
  },
  {
    text: 'Contratamos sus servicios para nuestra planta industrial y los resultados han sido excelentes. Su enfoque integral y su tecnología son de primer nivel.',
    author: 'Javier M.',
    role: 'Jefe de Operaciones, Sector Industrial',
  },
]

const plagues = [
  {
    name: 'Rastreros',
    icon: 'fa-bug',
    description: 'Control de cucarachas, hormigas, arañas y más.',
    link: '/servicios/manejo-integral-de-plagas',
  },
  {
    name: 'Roedores',
    icon: 'fa-paw',
    description: 'Soluciones efectivas contra ratas y ratones.',
    link: '/servicios/desratizacion',
  },
  {
    name: 'Voladores',
    icon: 'fa-fly',
    description: 'Manejo de moscas, mosquitos y otros insectos aéreos.',
    link: '/servicios/desinfeccion',
  },
  {
    name: 'Termitas',
    icon: 'fa-house-damage',
    description: 'Protección estructural contra xilófagos.',
    link: '/servicios/manejo-integral-de-plagas',
  },
  {
    name: 'Aves',
    icon: 'fa-crow',
    description: 'Manejo y control de palomas y otras aves.',
    link: '/servicios',
  },
]

const faqs = [
  {
    question: '¿Los productos que utilizan son seguros para niños y mascotas?',
    answer:
      'Absolutamente. Priorizamos la seguridad de tu familia. Utilizamos productos de última generación, de baja toxicidad y amigables con el medio ambiente, aplicados de forma estratégica para minimizar cualquier riesgo para niños y mascotas.',
  },
  {
    question: '¿Cuánto tiempo debo esperar para reingresar al área tratada?',
    answer:
      'El tiempo de reingreso varía según el tratamiento, pero generalmente es de 2 a 4 horas después de la aplicación. Nuestro técnico te dará instrucciones precisas y claras el día del servicio para garantizar la máxima seguridad.',
  },
  {
    question: '¿Ofrecen garantía por sus servicios?',
    answer:
      'El manejo de plagas es un tema de continuidad y seguimiento. No garantizamos que las plagas evacuen al instante con una sola aplicación, sino que trabajamos mediante un proceso constante para lograr el control efectivo.',
  },
  {
    question: '¿Qué diferencia hay entre fumigación y manejo integral de plagas (MIP)?',
    answer:
      'La fumigación tradicional es una aplicación reactiva de químicos. El Manejo Integral de Plagas (MIP) es una filosofía proactiva que combina inspección, prevención, control físico y uso racional de productos para lograr una solución sostenible a largo plazo, no solo un remedio temporal.',
  },
]

const caseStudies = [
  {
    problemTitle: 'Infestación en Restaurante',
    icon: 'fa-utensils',
    problem:
      'Un restaurante de alta cocina enfrentaba una recurrente plaga de roedores que ponía en riesgo su reputación y cumplimiento sanitario.',
    solution:
      'Se implementó un plan de desratización con estaciones de cebo seguras, sellado de puntos de ingreso y capacitación al personal en buenas prácticas.',
    result:
      'Erradicación completa en 72 horas y cero avistamientos en los 6 meses posteriores, asegurando la certificación sanitaria.',
  },
  {
    problemTitle: 'Plaga en Bodega Industrial',
    icon: 'fa-industry',
    problem:
      'Una bodega de almacenamiento de alimentos sufría pérdidas por contaminación de productos debido a una infestación de gorgojos.',
    solution:
      'Se realizó una fumigación controlada del silo y se estableció un programa de monitoreo con feromonas y control de temperatura.',
    result:
      'Reducción del 99% de la plaga en el primer mes y protección total del inventario, evitando pérdidas económicas significativas.',
  },
]

const leadEmail = ref('')
const { showToast } = useToast()

const handleGuideSignup = (event: Event) => {
  event.preventDefault()
  if (leadEmail.value && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(leadEmail.value)) {
    // Aquí normalmente llamarías a una Cloud Function para guardar el correo.
    // Por ahora, solo mostramos una notificación de éxito.
    showToast({
      title: '¡Gracias por tu interés!',
      message: 'Tu guía de prevención está en camino a tu correo.',
      type: 'success',
    })
    leadEmail.value = ''
  } else {
    showToast({
      title: 'Correo Inválido',
      message: 'Por favor, ingresa una dirección de correo electrónico válida.',
      type: 'warning',
    })
  }
}

const activeTestimonial = ref(0)
const direction = ref('right') // 'left' o 'right'

// Observamos cambios en el testimonio activo para determinar la dirección de la animación
watch(activeTestimonial, (newVal, oldVal) => {
  // Manejo especial para el carrusel cíclico (cuando pasa del último al primero y viceversa)
  if (oldVal === testimonials.length - 1 && newVal === 0) {
    direction.value = 'right'
  } else if (oldVal === 0 && newVal === testimonials.length - 1) {
    direction.value = 'left'
  } else {
    direction.value = newVal > oldVal ? 'right' : 'left'
  }
})

const showBackToTop = ref(false)
const parallaxEl1 = ref<HTMLElement | null>(null)
const parallaxEl2 = ref<HTMLElement | null>(null)

const handleScroll = () => {
  const scrollY = window.scrollY
  // Lógica del Parallax
  if (parallaxEl1.value) {
    parallaxEl1.value.style.transform = `translateY(${scrollY * 0.1}px)`
  }
  if (parallaxEl2.value) {
    parallaxEl2.value.style.transform = `translateY(${scrollY * 0.05}px)`
  }

  // Lógica del botón "Volver Arriba"
  showBackToTop.value = scrollY > 400
}

const scrollToTop = () => {
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

onMounted(() => {
  document.title = 'Control Total & P. H. | Expertos en Protección'
  const interval = setInterval(() => {
    activeTestimonial.value = (activeTestimonial.value + 1) % testimonials.length
  }, 7000)

  window.addEventListener('scroll', handleScroll)

  // --- Schema Markup Injection ---
  const schemaMarkup = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'PestControl',
        '@id': 'https://controltotalyph.com/#organization',
        name: 'Control Total & P. H.',
        url: 'https://controltotalyph.com',
        logo: 'https://controltotalyph.com/logo.png',
        image: 'https://controltotalyph.com/images/hero-poster.webp',
        telephone: '+57-320-872-2195',
        email: 'gerencia@gerenciatotal.co',
        address: {
          '@type': 'PostalAddress',
          streetAddress: 'Cra. 80 #11 A-51, Local P-329',
          addressLocality: 'Cali',
          addressRegion: 'Valle del Cauca',
          postalCode: '760033',
          addressCountry: 'CO',
        },
        openingHoursSpecification: [
          {
            '@type': 'OpeningHoursSpecification',
            dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
            opens: '07:00',
            closes: '19:00',
          },
        ],
        areaServed: {
          '@type': 'AdministrativeArea',
          name: 'Valle del Cauca',
        },
        sameAs: [
          'https://www.facebook.com/controltotalph/',
          'https://www.instagram.com/controltotalph',
        ],
      },
    ],
  }

  const scriptTag = document.createElement('script')
  scriptTag.type = 'application/ld+json'
  scriptTag.id = 'schema-markup' // ID para fácil remoción
  scriptTag.textContent = JSON.stringify(schemaMarkup)
  document.head.appendChild(scriptTag)

  return () => {
    clearInterval(interval)
    window.removeEventListener('scroll', handleScroll)
    const existingScript = document.getElementById('schema-markup')
    if (existingScript) {
      document.head.removeChild(existingScript)
    }
  }
})
</script>

<template>
  <div class="bg-brand-black text-white overflow-hidden font-sans relative selection:bg-brand-red selection:text-white">
    <!-- BOTÓN VOLVER ARRIBA -->
    <transition name="fade">
      <button v-if="showBackToTop" @click="scrollToTop"
        class="fixed bottom-24 right-6 z-50 w-12 h-12 rounded-full bg-brand-red/80 backdrop-blur-sm text-white flex items-center justify-center shadow-lg hover:bg-brand-red transition-all transform hover:-translate-y-1"
        aria-label="Volver arriba">
        <i class="fas fa-arrow-up"></i>
      </button>
    </transition>

    <!-- FONDO DECORATIVO GLOBAL (Sutil) -->
    <div class="absolute inset-0 pointer-events-none z-0 overflow-hidden">
      <div ref="parallaxEl1"
        class="absolute top-[-10%] left-[20%] w-[500px] h-[500px] bg-brand-red/5 rounded-full blur-[120px]"></div>
      <div ref="parallaxEl2"
        class="absolute bottom-[-10%] right-[10%] w-[400px] h-[400px] bg-blue-900/5 rounded-full blur-[100px]"></div>
    </div>

    <!-- HERO SECTION -->
    <section class="relative z-10 min-h-[90vh] flex items-center justify-center text-center px-4 py-20 overflow-hidden">
      <!-- Video de Fondo -->
      <div class="absolute inset-0 z-[-2]">
        <!--
              NOTA: Debes conseguir un video y colocarlo en la carpeta `public/videos`.
              También es recomendable tener una imagen 'poster' para que se muestre mientras carga el video.
            -->
        <video autoplay loop muted playsinline class="w-full h-full object-cover" poster="/images/hero-poster.webp">
          <source src="/videos/hero-background.mp4" type="video/mp4" />
          Tu navegador no soporta el tag de video.
        </video>
      </div>
      <div class="absolute inset-0 bg-black/60 z-[-1]"></div>

      <div class="relative max-w-5xl mx-auto">
        <!-- Etiqueta superior -->
        <span
          class="inline-block py-1 px-4 mb-6 rounded-full bg-white/5 border border-white/10 text-brand-red text-sm font-bold tracking-[0.2em] backdrop-blur-md">
          VALLE DEL CAUCA
        </span>

        <span
          class="inline-block py-1 px-4 mb-6 rounded-full bg-white/5 border border-white/10 text-brand-red text-sm font-bold tracking-[0.2em] backdrop-blur-md">
          NORTE DE SANTANDER
        </span>

        <span
          class="inline-block py-1 px-4 mb-6 rounded-full bg-white/5 border border-white/10 text-brand-red text-sm font-bold tracking-[0.2em] backdrop-blur-md">
          OTRAS REGIONES DEL PAIS
        </span>

        <h1 class="text-5xl md:text-7xl lg:text-8xl font-extrabold !leading-[1.1] tracking-tight mb-8">
          EXPERTOS EN <br class="hidden md:block" />
          <span class="text-transparent bg-clip-text bg-gradient-to-br from-white via-gray-200 to-gray-500">
            PROTECCIÓN
          </span>
          <span
            class="text-transparent bg-clip-text bg-gradient-to-r from-[#d60000] to-[#ef4444] relative inline-block">
            CERTIFICADA
            <svg class="absolute w-full h-3 -bottom-2 left-0 text-[#d60000]/40" viewBox="0 0 100 10"
              preserveAspectRatio="none">
              <path d="M0 5 Q 50 10 100 5" stroke="currentColor" stroke-width="2" fill="none" />
            </svg>
          </span>
        </h1>

        <p class="mt-8 text-lg md:text-2xl text-gray-400 max-w-2xl mx-auto font-light leading-relaxed">
          Tecnología avanzada para hogares y empresas. <br class="hidden sm:block" />
          <span class="text-white font-medium">Tu tranquilidad es nuestra prioridad.</span>
        </p>

        <div class="mt-12 flex flex-col sm:flex-row items-center justify-center gap-5">
          <a href="https://wa.me/573208722195?text=Hola,%20quisiera%20solicitar%20una%20inspecci%C3%B3n."
            target="_blank"
            class="btn bg-brand-red hover:bg-brand-red-dark text-white shadow-[0_0_30px_rgba(214,0,0,0.3)] hover:shadow-[0_0_40px_rgba(214,0,0,0.5)] transition-shadow duration-300 !py-4 !px-8 !text-lg">
            Solicitar Inspección Gratis
          </a>
          <RouterLink to="/servicios" class="btn-public-secondary !py-4 !px-8 !text-lg">
            Ver Servicios
          </RouterLink>
        </div>

        <p class="mt-8 text-sm text-gray-500 flex items-center justify-center gap-2">
          <span class="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
          Inspección y Diagnóstico Sin Costo
        </p>
      </div>
    </section>

    <!-- SECCIÓN DE SEGMENTOS -->
    <section class="py-24 relative z-10">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8" v-scroll-animation.up>
        <div class="text-center mb-20">
          <h2 class="text-3xl md:text-5xl font-bold mb-4">Soluciones Especializadas</h2>
          <div
            class="h-1 w-24 bg-gradient-to-r from-transparent via-brand-red to-transparent mx-auto rounded-full opacity-50">
          </div>
          <p class="text-lg text-gray-400 mt-6 max-w-2xl mx-auto">
            Protección a la medida diseñada específicamente para las exigencias de tu sector.
          </p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
          <div
            class="group relative bg-[#151515] border border-white/5 rounded-2xl p-8 transition-all duration-300 hover:-translate-y-2">
            <div
              class="absolute -inset-px bg-gradient-to-r from-[#d60000] to-blue-500 rounded-2xl blur-lg opacity-0 group-hover:opacity-50 transition-opacity duration-500 -z-10">
            </div>
            <div class="relative">
              <div
                class="w-14 h-14 mb-6 rounded-xl bg-white/5 flex items-center justify-center text-gray-400 group-hover:text-brand-red group-hover:scale-110 group-hover:rotate-12 transition-all duration-300">
                <svg class="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"
                  stroke-linecap="round" stroke-linejoin="round">
                  <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                  <polyline points="9 22 9 12 15 12 15 22" />
                </svg>
              </div>
              <h3 class="font-bold text-xl mb-3 text-white group-hover:text-brand-red transition-colors">Residencial
              </h3>
              <p class="text-gray-400 text-sm leading-relaxed border-t border-white/5 pt-4 group-hover:border-white/10">
                Protección segura para casas y apartamentos.</p>
            </div>
          </div>
          <div
            class="group relative bg-[#151515] border border-white/5 rounded-2xl p-8 transition-all duration-300 hover:-translate-y-2">
            <div
              class="absolute -inset-px bg-gradient-to-r from-[#d60000] to-purple-500 rounded-2xl blur-lg opacity-0 group-hover:opacity-50 transition-opacity duration-500 -z-10">
            </div>
            <div class="relative">
              <div
                class="w-14 h-14 mb-6 rounded-xl bg-white/5 flex items-center justify-center text-gray-400 group-hover:text-brand-red group-hover:scale-110 group-hover:rotate-12 transition-all duration-300">
                <svg class="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"
                  stroke-linecap="round" stroke-linejoin="round">
                  <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
                  <line x1="4" x2="4" y1="22" y2="15" />
                </svg>
              </div>
              <h3 class="font-bold text-xl mb-3 text-white group-hover:text-brand-red transition-colors">Industria de
                Alimentos</h3>
              <p class="text-gray-400 text-sm leading-relaxed border-t border-white/5 pt-4 group-hover:border-white/10">
                Cumplimiento de normativas y seguridad alimentaria.</p>
            </div>
          </div>
          <div
            class="group relative bg-[#151515] border border-white/5 rounded-2xl p-8 transition-all duration-300 hover:-translate-y-2">
            <div
              class="absolute -inset-px bg-gradient-to-r from-cyan-500 to-blue-500 rounded-2xl blur-lg opacity-0 group-hover:opacity-50 transition-opacity duration-500 -z-10">
            </div>
            <div class="relative">
              <div
                class="w-14 h-14 mb-6 rounded-xl bg-white/5 flex items-center justify-center text-gray-400 group-hover:text-brand-red group-hover:scale-110 group-hover:rotate-12 transition-all duration-300">
                <svg class="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"
                  stroke-linecap="round" stroke-linejoin="round">
                  <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                </svg>
              </div>
              <h3 class="font-bold text-xl mb-3 text-white group-hover:text-brand-red transition-colors">Sector Salud
              </h3>
              <p class="text-gray-400 text-sm leading-relaxed border-t border-white/5 pt-4 group-hover:border-white/10">
                Protocolos estériles para hospitales y clínicas.</p>
            </div>
          </div>
          <div
            class="group relative bg-[#151515] border border-white/5 rounded-2xl p-8 transition-all duration-300 hover:-translate-y-2">
            <div
              class="absolute -inset-px bg-gradient-to-r from-yellow-500 to-orange-500 rounded-2xl blur-lg opacity-0 group-hover:opacity-50 transition-opacity duration-500 -z-10">
            </div>
            <div class="relative">
              <div
                class="w-14 h-14 mb-6 rounded-xl bg-white/5 flex items-center justify-center text-gray-400 group-hover:text-brand-red group-hover:scale-110 group-hover:rotate-12 transition-all duration-300">
                <svg class="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"
                  stroke-linecap="round" stroke-linejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
                </svg>
              </div>
              <h3 class="font-bold text-xl mb-3 text-white group-hover:text-brand-red transition-colors">Hotelería y
                Turismo</h3>
              <p class="text-gray-400 text-sm leading-relaxed border-t border-white/5 pt-4 group-hover:border-white/10">
                Experiencias impecables para tus huéspedes.</p>
            </div>
          </div>
          <div
            class="group relative bg-[#151515] border border-white/5 rounded-2xl p-8 transition-all duration-300 hover:-translate-y-2">
            <div
              class="absolute -inset-px bg-gradient-to-r from-green-500 to-cyan-500 rounded-2xl blur-lg opacity-0 group-hover:opacity-50 transition-opacity duration-500 -z-10">
            </div>
            <div class="relative">
              <div
                class="w-14 h-14 mb-6 rounded-xl bg-white/5 flex items-center justify-center text-gray-400 group-hover:text-brand-red group-hover:scale-110 group-hover:rotate-12 transition-all duration-300">
                <svg class="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"
                  stroke-linecap="round" stroke-linejoin="round">
                  <path d="M14 22v-4a2 2 0 1 0-4 0v4" />
                  <path d="m18 10 4 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-8l4-2" />
                  <path d="M18 5v17" />
                  <path d="m6 5 8 8" />
                  <path d="m6 13 8-8" />
                </svg>
              </div>
              <h3 class="font-bold text-xl mb-3 text-white group-hover:text-brand-red transition-colors">Educación</h3>
              <p class="text-gray-400 text-sm leading-relaxed border-t border-white/5 pt-4 group-hover:border-white/10">
                Entornos de aprendizaje seguros y saludables.</p>
            </div>
          </div>
          <div
            class="group relative bg-[#151515] border border-white/5 rounded-2xl p-8 transition-all duration-300 hover:-translate-y-2">
            <div
              class="absolute -inset-px bg-gradient-to-r from-gray-500 to-gray-400 rounded-2xl blur-lg opacity-0 group-hover:opacity-50 transition-opacity duration-500 -z-10">
            </div>
            <div class="relative">
              <div
                class="w-14 h-14 mb-6 rounded-xl bg-white/5 flex items-center justify-center text-gray-400 group-hover:text-brand-red group-hover:scale-110 group-hover:rotate-12 transition-all duration-300">
                <svg class="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"
                  stroke-linecap="round" stroke-linejoin="round">
                  <path d="M12 12h.01" />
                  <path d="M16 6V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
                  <path d="M16 6h-1" />
                  <path d="M8 6H7" />
                  <path d="M12 12h.01" />
                  <path d="M12 18h.01" />
                  <path d="M7 12h.01" />
                  <path d="M17 12h.01" />
                  <path d="M7 18h.01" />
                  <path d="M17 18h.01" />
                  <rect width="20" height="14" x="2" y="8" rx="2" />
                </svg>
              </div>
              <h3 class="font-bold text-xl mb-3 text-white group-hover:text-brand-red transition-colors">Comercio</h3>
              <p class="text-gray-400 text-sm leading-relaxed border-t border-white/5 pt-4 group-hover:border-white/10">
                Protección de activos y continuidad operativa.</p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- SECCIÓN TIPOS DE PLAGAS -->
    <section class="py-20 bg-white/[0.02] relative z-10">
      <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8" v-scroll-animation.up>
        <div class="text-center mb-12">
          <h2 class="text-3xl font-bold text-white">Control Total</h2>
          <p class="text-gray-400 mt-2">Soluciones integrales para cada amenaza.</p>
        </div>
        <div class="grid grid-cols-2 md:grid-cols-5 gap-4">
          <RouterLink v-for="plaga in plagues" :key="plaga.name" :to="plaga.link"
            class="bg-brand-black border border-white/10 rounded-xl p-4 text-center hover:border-brand-red/50 hover:bg-white/5 transition-all duration-300 group block hover:-translate-y-1 flex flex-col">
            <div class="flex-grow flex flex-col items-center justify-center">
              <div
                class="mb-3 text-brand-red opacity-50 group-hover:opacity-100 transition-opacity transform group-hover:scale-110 duration-300">
                <i class="fas text-3xl" :class="plaga.icon" aria-hidden="true"></i>
              </div>
              <h3 class="font-semibold text-gray-200 group-hover:text-white transition-colors">
                {{ plaga.name }}
              </h3>
            </div>
            <p class="text-xs text-gray-500 mt-3 h-10">{{ plaga.description }}</p>
          </RouterLink>
        </div>
      </div>
    </section>

    <!-- SECCIÓN POR QUÉ ELEGIRNOS -->
    <section class="py-24 relative overflow-hidden z-10">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="grid md:grid-cols-2 gap-16 items-center">
          <div class="text-left" v-scroll-animation.left>
            <h2 class="text-4xl md:text-5xl font-bold mb-6">
              ¿Por Qué <br /><span class="text-brand-red">Elegirnos?</span>
            </h2>
            <p class="text-lg text-gray-400 mb-8 leading-relaxed">
              Controlamos plagas hasta umbrales mínimos y creamos entornos seguros. Nuestro compromiso con la
              excelencia y la seguridad es innegociable.
            </p>
            <div class="space-y-6">
              <div class="flex gap-4 p-4 rounded-xl hover:bg-white/5 transition-colors">
                <div
                  class="w-12 h-12 rounded-full bg-brand-red/10 flex items-center justify-center text-brand-red shrink-0 border border-brand-red/20">
                  <span class="font-bold text-lg">01</span>
                </div>
                <div>
                  <h3 class="font-bold text-xl text-white mb-1">Profesionales Certificados</h3>
                  <p class="text-gray-400 text-sm">
                    Equipo licenciado y en constante capacitación.
                  </p>
                </div>
              </div>
              <div class="flex gap-4 p-4 rounded-xl hover:bg-white/5 transition-colors">
                <div
                  class="w-12 h-12 rounded-full bg-brand-red/10 flex items-center justify-center text-brand-red shrink-0 border border-brand-red/20">
                  <span class="font-bold text-lg">02</span>
                </div>
                <div>
                  <h3 class="font-bold text-xl text-white mb-1">Tecnología Segura</h3>
                  <p class="text-gray-400 text-sm">
                    Productos eco-amigables y maquinaria de vanguardia.
                  </p>
                </div>
              </div>
              <div class="flex gap-4 p-4 rounded-xl hover:bg-white/5 transition-colors">
                <div
                  class="w-12 h-12 rounded-full bg-brand-red/10 flex items-center justify-center text-brand-red shrink-0 border border-brand-red/20">
                  <span class="font-bold text-lg">03</span>
                </div>
                <div>
                  <h3 class="font-bold text-xl text-white mb-1">Atención 24/7</h3>
                  <p class="text-gray-400 text-sm">Respuesta rápida ante emergencias sanitarias.</p>
                </div>
              </div>
            </div>
          </div>
          <div v-scroll-animation.right
            class="relative bg-[#151515] border border-white/5 rounded-3xl p-8 md:p-12 aspect-square flex items-center justify-center shadow-2xl">
            <div class="absolute inset-0 bg-gradient-to-tr from-brand-red/10 to-transparent rounded-3xl opacity-30">
            </div>
            <div class="text-center space-y-2 relative z-10">
              <div class="text-6xl md:text-8xl font-black text-white">
                <AnimatedCounter :target="10" prefix="+" />
              </div>
              <div class="text-xl text-gray-400 uppercase tracking-widest font-light">
                Años de experiencia
              </div>
              <div class="w-20 h-1 bg-brand-red mx-auto my-6 rounded-full"></div>
              <div class="text-sm text-gray-300">Garantía de Satisfacción</div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- SECCIÓN NUESTRO PROCESO -->
    <section class="py-24 bg-brand-black relative z-10">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8" v-scroll-animation.up>
        <div class="text-center mb-20">
          <h2 class="text-3xl md:text-5xl font-bold mb-4">
            Un Proceso <span class="text-brand-red">Claro y Efectivo</span>
          </h2>
          <div
            class="h-1 w-24 bg-gradient-to-r from-transparent via-brand-red to-transparent mx-auto rounded-full opacity-50">
          </div>
          <p class="text-lg text-gray-400 mt-6 max-w-2xl mx-auto">
            Nuestra metodología de 4 pasos garantiza un servicio transparente, seguro y con
            resultados garantizados.
          </p>
        </div>

        <div class="relative">
          <!-- Línea de conexión (solo en desktop) -->
          <div class="absolute top-8 left-0 w-full h-0.5 bg-gray-800 hidden md:block" aria-hidden="true"></div>

          <div class="grid md:grid-cols-4 gap-8 relative">
            <!-- Paso 1 -->
            <div class="text-center p-6">
              <div
                class="relative inline-block mb-6 w-16 h-16 rounded-full bg-gray-800 border-2 border-gray-700 flex items-center justify-center text-2xl font-bold text-brand-red shadow-lg">
                1
              </div>
              <h3 class="font-bold text-xl text-white mb-2">Inspección y Diagnóstico</h3>
              <p class="text-sm text-gray-400">
                Evaluamos a fondo la situación para identificar la plaga, su origen y la magnitud
                del problema.
              </p>
            </div>

            <!-- Paso 2 -->
            <div class="text-center p-6">
              <div
                class="relative inline-block mb-6 w-16 h-16 rounded-full bg-gray-800 border-2 border-gray-700 flex items-center justify-center text-2xl font-bold text-brand-red shadow-lg">
                2
              </div>
              <h3 class="font-bold text-xl text-white mb-2">Plan de Acción</h3>
              <p class="text-sm text-gray-400">
                Diseñamos una estrategia a medida, seleccionando los métodos más seguros y efectivos
                para tu caso específico.
              </p>
            </div>

            <!-- Paso 3 -->
            <div class="text-center p-6">
              <div
                class="relative inline-block mb-6 w-16 h-16 rounded-full bg-gray-800 border-2 border-gray-700 flex items-center justify-center text-2xl font-bold text-brand-red shadow-lg">
                3
              </div>
              <h3 class="font-bold text-xl text-white mb-2">Implementación Segura</h3>
              <p class="text-sm text-gray-400">
                Aplicamos los tratamientos con precisión, priorizando la seguridad de las personas,
                mascotas y el medio ambiente.
              </p>
            </div>

            <!-- Paso 4 -->
            <div class="text-center p-6">
              <div
                class="relative inline-block mb-6 w-16 h-16 rounded-full bg-gray-800 border-2 border-gray-700 flex items-center justify-center text-2xl font-bold text-brand-red shadow-lg">
                4
              </div>
              <h3 class="font-bold text-xl text-white mb-2">Seguimiento y Garantía</h3>
              <p class="text-sm text-gray-400">
                Monitoreamos los resultados y ofrecemos garantía sobre nuestro trabajo para tu total
                tranquilidad.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- SECCIÓN CASOS DE ÉXITO -->
    <section class="py-24 bg-gray-900/50 relative z-10">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="text-center mb-20" v-scroll-animation.up>
          <h2 class="text-3xl md:text-5xl font-bold mb-4">
            Resultados <span class="text-brand-red">Reales</span>
          </h2>
          <p class="text-lg text-gray-400 mt-6 max-w-2xl mx-auto">
            Transformamos problemas complejos en soluciones efectivas. Conoce cómo hemos ayudado a
            otros clientes.
          </p>
        </div>

        <div class="grid md:grid-cols-2 gap-8">
          <div v-for="(study, index) in caseStudies" :key="study.problemTitle"
            v-scroll-animation="index === 0 ? 'left' : 'right'"
            class="bg-gray-800/50 border border-gray-700 rounded-2xl p-8 shadow-lg flex flex-col gap-6">
            <div class="flex items-center gap-4">
              <div class="w-12 h-12 bg-brand-red/10 rounded-lg flex items-center justify-center text-brand-red text-2xl"
                v-if="caseStudies[0]">
                <i class="fas" :class="study.icon" aria-hidden="true"></i>
              </div>
              <h3 class="font-bold text-xl text-white">{{ study.problemTitle }}</h3>
            </div>
            <div class="space-y-4">
              <div>
                <h4 class="font-bold text-sm uppercase tracking-wider text-gray-400 mb-1">Problema</h4>
                <p class="text-gray-300 text-sm">{{ study.problem }}</p>
              </div>
              <div>
                <h4 class="font-bold text-sm uppercase tracking-wider text-gray-400 mb-1">Solución</h4>
                <p class="text-gray-300 text-sm">{{ study.solution }}</p>
              </div>
              <div class="bg-green-900/20 border border-green-500/20 p-3 rounded-lg">
                <h4 class="font-bold text-sm uppercase tracking-wider text-green-400 mb-1">Resultado</h4>
                <p class="text-white text-sm font-medium">{{ study.result }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- SECCIÓN CTA SECUNDARIO (Lead Magnet) -->
    <section class="py-24 bg-gray-900/50 relative z-10">
      <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center" v-scroll-animation.up>
        <div class="bg-gray-800/50 border border-gray-700 rounded-2xl p-8 md:p-12 shadow-2xl relative overflow-hidden">
          <div class="absolute -top-16 -left-16 w-48 h-48 bg-brand-red/10 rounded-full blur-3xl"></div>
          <div class="absolute -bottom-16 -right-16 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl"></div>

          <div class="relative z-10">
            <div
              class="w-16 h-16 mx-auto bg-brand-red/10 rounded-full flex items-center justify-center text-brand-red mb-6 border border-brand-red/20">
              <i class="fas fa-download text-2xl" aria-hidden="true"></i>
            </div>
            <h2 class="text-3xl md:text-4xl font-bold text-white mb-4">
              Descarga Nuestra Guía Gratuita
            </h2>
            <p class="text-gray-400 max-w-xl mx-auto mb-8">
              Aprende a proteger tu hogar con nuestra guía de prevención de plagas. Ingresa tu
              correo y recíbela al instante.
            </p>
            <form @submit="handleGuideSignup" class="max-w-lg mx-auto flex flex-col sm:flex-row gap-3">
              <input v-model="leadEmail" type="email" placeholder="Tu correo electrónico"
                class="input-public flex-grow !py-3" required />
              <button type="submit" class="btn btn-primary !py-3 !px-6 shadow-lg">
                ¡La Quiero!
              </button>
            </form>
          </div>
        </div>
      </div>
    </section>

    <!-- SECCIÓN PREGUNTAS FRECUENTES (FAQ) -->
    <section class="py-24 bg-white/[0.01] relative z-10">
      <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8" v-scroll-animation.up>
        <div class="text-center mb-16">
          <h2 class="text-3xl md:text-5xl font-bold mb-4">
            Preguntas <span class="text-brand-red">Frecuentes</span>
          </h2>
          <p class="text-lg text-gray-400 mt-6 max-w-2xl mx-auto">
            Resolvemos tus dudas más comunes para que tomes la mejor decisión con total confianza.
          </p>
        </div>

        <div class="space-y-2">
          <FaqItem v-for="(faq, index) in faqs" :key="index" :question="faq.question">
            <p>{{ faq.answer }}</p>
          </FaqItem>
        </div>

        <div class="text-center mt-12">
          <p class="text-gray-400">¿Tienes otra pregunta?</p>
          <RouterLink to="/contacto"
            class="font-bold text-brand-red hover:text-brand-red-dark transition-colors text-lg">
            Contáctanos directamente
          </RouterLink>
        </div>
      </div>
    </section>

    <!-- SECCIÓN TESTIMONIOS -->
    <section class="py-24 bg-white/[0.02] relative z-10">
      <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center" v-scroll-animation.up>
        <h2 class="text-2xl text-brand-red font-bold uppercase tracking-widest mb-12">
          Lo que dicen nuestros clientes
        </h2>
        <div class="relative h-[320px] sm:h-[280px] flex items-center justify-center">
          <transition :name="direction === 'right' ? 'slide-right' : 'slide-left'" mode="out-in">
            <div :key="activeTestimonial" class="absolute inset-0 flex flex-col items-center justify-center">
              <i class="fas fa-quote-left text-white/10 text-5xl mb-6" aria-hidden="true"></i>
              <p class="text-xl md:text-3xl text-gray-200 font-light italic leading-normal mb-8 max-w-2xl">
                "{{ testimonials[activeTestimonial]?.text }}"
              </p>
              <div class="border-t border-white/10 pt-6 w-full max-w-xs mx-auto">
                <h4 class="text-white font-bold text-lg">
                  {{ testimonials[activeTestimonial]?.author }}
                </h4>
                <span class="text-sm text-brand-red tracking-wide">{{
                  testimonials[activeTestimonial]?.role
                  }}</span>
              </div>
            </div>
          </transition>
        </div>
        <div class="flex justify-center gap-3 mt-8">
          <button v-for="(_, i) in testimonials" :key="i" @click="activeTestimonial = i"
            class="h-2 rounded-full transition-all duration-300" :class="activeTestimonial === i ? 'bg-brand-red w-8' : 'bg-white/20 w-2 hover:bg-white/40'
              " :aria-label="`Ir al testimonio ${i + 1}`"></button>
        </div>
        <!-- Barra de Progreso -->
        <div class="max-w-xs mx-auto mt-6">
          <div class="w-full bg-white/10 rounded-full h-0.5 overflow-hidden">
            <div :key="activeTestimonial" class="bg-[#d60000] h-0.5 rounded-full animate-progress-bar"></div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.bg-brand-black {
  background-color: #0a0a0a;
}

/* Estilos para la animación de deslizamiento */
.slide-right-enter-active,
.slide-right-leave-active,
.slide-left-enter-active,
.slide-left-leave-active {
  transition: all 0.4s cubic-bezier(0.55, 0.085, 0.68, 0.53);
  /* Ease-in-quad para un inicio suave */
}

/* Animación para deslizar hacia la DERECHA (siguiente testimonio) */
.slide-right-enter-from {
  opacity: 0;
  transform: translateX(40px);
}

.slide-right-leave-to {
  opacity: 0;
  transform: translateX(-40px);
}

/* Animación para deslizar hacia la IZQUIERDA (testimonio anterior) */
.slide-left-enter-from {
  opacity: 0;
  transform: translateX(-40px);
}

.slide-left-leave-to {
  opacity: 0;
  transform: translateX(40px);
}

/* Transición para el botón de volver arriba */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(20px);
}
</style>
