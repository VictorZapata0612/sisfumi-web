<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { RouterView, RouterLink, useRoute } from 'vue-router'

const route = useRoute()

const isMobileMenuOpen = ref(false)
const lastScrollY = ref(0)
const isHeaderVisible = ref(true)

function closeMenu() {
  isMobileMenuOpen.value = false
}

/**
 * Maneja la visibilidad del header al hacer scroll.
 * Se oculta al bajar más de 100px y reaparece al subir.
 */
function handleScroll() {
  const currentScrollY = window.scrollY
  if (currentScrollY > lastScrollY.value && currentScrollY > 100) {
    isHeaderVisible.value = false
  } else {
    isHeaderVisible.value = true
  }
  lastScrollY.value = currentScrollY
}

onMounted(() => {
  window.addEventListener('scroll', handleScroll)
})

onUnmounted(() => {
  window.removeEventListener('scroll', handleScroll)
})
</script>

<template>
  <div class="min-h-screen flex flex-col bg-[#0a0a0a] text-white font-sans selection:bg-brand-red selection:text-white">
    <!-- NAVBAR FLOTANTE -->
    <nav
      class="fixed w-full z-50 border-b border-white/5 bg-[#0a0a0a]/80 backdrop-blur-xl transition-transform duration-300 ease-in-out"
      :class="{ '-translate-y-full': !isHeaderVisible }">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between items-center h-24">
          <!-- LOGO -->
          <RouterLink to="/" class="flex-shrink-0 flex items-center gap-3 group">
            <img class="h-16 w-auto md:h-20 transition-transform duration-300 group-hover:scale-105" src="/logo.png"
              alt="Control Total & P.H. - Expertos en Control de Plagas" />
            <div class="flex flex-col leading-none">
              <span
                class="font-bold text-lg md:text-xl tracking-wider text-white group-hover:text-gray-200 transition-colors">CONTROL
                TOTAL</span>
              <span class="text-[0.6rem] text-gray-400 tracking-[0.2em] group-hover:text-brand-red transition-colors">&
                P.H.</span>
            </div>
          </RouterLink>

          <!-- MENÚ ESCRITORIO -->
          <div class="hidden md:flex gap-8 text-sm font-semibold items-center tracking-wide">
            <RouterLink to="/" class="relative transition-colors duration-300 group py-2"
              :class="route.path === '/' ? 'text-white' : 'text-gray-400'">
              INICIO
              <span class="absolute bottom-0 left-0 h-0.5 bg-brand-red transition-all duration-300"
                :class="route.path === '/' ? 'w-full' : 'w-0 group-hover:w-full'"></span>
            </RouterLink>
            <RouterLink to="/servicios"
              class="relative text-gray-300 hover:text-white transition-colors duration-300 group py-2">
              SERVICIOS
              <span
                class="absolute bottom-0 left-0 w-0 h-0.5 bg-brand-red transition-all duration-300 group-hover:w-full"></span>
            </RouterLink>
            <RouterLink to="/sobre-nosotros"
              class="relative text-gray-300 hover:text-white transition-colors duration-300 group py-2">
              SOBRE NOSOTROS
              <span
                class="absolute bottom-0 left-0 w-0 h-0.5 bg-brand-red transition-all duration-300 group-hover:w-full"></span>
            </RouterLink>
            <RouterLink to="/contacto"
              class="relative text-gray-300 hover:text-white transition-colors duration-300 group py-2">
              CONTACTO
              <span
                class="absolute bottom-0 left-0 w-0 h-0.5 bg-brand-red transition-all duration-300 group-hover:w-full"></span>
            </RouterLink>
            <div class="pl-6 border-l border-white/10">
              <RouterLink to="/login" target="_blank" rel="noopener noreferrer"
                class="btn-public-secondary !px-5 !py-2 !text-xs !uppercase !tracking-wider">
                Zona Admin
              </RouterLink>
            </div>
          </div>

          <!-- BOTÓN MENÚ MÓVIL -->
          <div class="md:hidden">
            <button @click="isMobileMenuOpen = !isMobileMenuOpen"
              class="text-white p-2 rounded-lg hover:bg-white/10 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-red/50"
              aria-label="Abrir menú">
              <svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16m-7 6h7" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </nav>

    <!-- MENÚ MÓVIL (Overlay) -->
    <div v-if="isMobileMenuOpen" class="fixed inset-0 z-[99]" @click="closeMenu">
      <div class="absolute inset-0 bg-black/90 backdrop-blur-sm"></div>
      <div
        class="absolute top-0 right-0 h-full w-[85%] max-w-sm bg-[#151515] shadow-2xl border-l border-white/10 p-8 flex flex-col"
        @click.stop>
        <div class="flex justify-between items-center mb-12 border-b border-white/5 pb-6">
          <span class="font-bold text-xl text-white tracking-wide">MENÚ</span>
          <button @click="closeMenu" class="p-2 -mr-2 text-gray-400 hover:text-brand-red transition-colors">
            <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div class="flex flex-col gap-4 text-xl font-medium">
          <RouterLink to="/" @click="closeMenu"
            class="hover:text-brand-red hover:pl-2 transition-all duration-300 border-b border-white/5 pb-4"
            :class="route.path === '/' ? 'text-white' : 'text-gray-400'" active-class="ignore-active"
            exact-active-class="ignore-active">
            INICIO</RouterLink>
          <RouterLink to="/servicios" @click="closeMenu"
            class="text-gray-400 hover:text-brand-red hover:pl-2 transition-all duration-300 border-b border-white/5 pb-4">
            SERVICIOS</RouterLink>
          <RouterLink to="/sobre-nosotros" @click="closeMenu"
            class="text-gray-400 hover:text-brand-red hover:pl-2 transition-all duration-300 border-b border-white/5 pb-4">
            SOBRE NOSOTROS</RouterLink>
          <RouterLink to="/contacto" @click="closeMenu"
            class="text-gray-400 hover:text-brand-red hover:pl-2 transition-all duration-300 border-b border-white/5 pb-4">
            CONTACTO</RouterLink>
          <div class="mt-8">
            <RouterLink to="/login" @click="closeMenu" class="btn btn-primary w-full justify-center">Zona Administrativa
            </RouterLink>
          </div>
        </div>
      </div>
    </div>

    <!-- Contenido de la página -->
    <main class="flex-grow pt-24">
      <RouterView />
    </main>

    <!-- FOOTER -->
    <footer class="border-t border-white/10 bg-[#0a0a0a] pt-16 pb-8 mt-auto">
      <div class="max-w-7xl mx-auto px-4 text-center">
        <div class="flex flex-col items-center justify-center mb-10 group">
          <div class="p-4 rounded-full bg-white/5 mb-4 group-hover:bg-brand-red/10 transition-colors duration-500">
            <img src="/logo.png" alt="Control Total & P.H."
              class="h-12 opacity-70 grayscale group-hover:grayscale-0 transition-all duration-500" />
          </div>
          <p class="text-white font-bold text-xl tracking-widest">
            CONTROL TOTAL <span class="text-brand-red">&</span> P.H.
          </p>
        </div>

        <div class="space-y-4 mb-12 text-gray-400 font-light text-sm md:text-base">
          <p class="hover:text-white transition-colors cursor-default">
            Cra. 80 #11 A-51, Cali, Valle del Cauca - Local P-329
          </p>
          <div class="flex items-center justify-center gap-4 flex-wrap">
            <span class="text-brand-red font-medium">Llámanos:</span>
            <a href="tel:+573208722195"
              class="hover:text-white transition-colors border-b border-transparent hover:border-white">320 872 2195</a>
            <span class="text-gray-700">|</span>
            <a href="tel:+573205624177"
              class="hover:text-white transition-colors border-b border-transparent hover:border-white">320 562 4177</a>
          </div>
          <p class="text-gray-500">Horario: Lunes a Sábados de 7:00am a 7:00pm</p>
        </div>

        <div class="flex justify-center gap-8 mb-12">
          <a href="https://wa.me/573208722195" target="_blank"
            class="text-gray-500 hover:text-[#25D366] transition-all transform hover:scale-110 hover:-translate-y-1"
            aria-label="WhatsApp">
            <i class="fab fa-whatsapp text-2xl"></i>
          </a>
          <a href="https://www.instagram.com/controltotalph" target="_blank"
            class="text-gray-500 hover:text-[#E1306C] transition-all transform hover:scale-110 hover:-translate-y-1"
            aria-label="Instagram">
            <i class="fab fa-instagram text-2xl"></i>
          </a>
          <a href="https://www.facebook.com/controltotalph/" target="_blank"
            class="text-gray-500 hover:text-[#1877F2] transition-all transform hover:scale-110 hover:-translate-y-1"
            aria-label="Facebook">
            <i class="fab fa-facebook text-2xl"></i>
          </a>
        </div>

        <div class="pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-4">
          <p class="text-gray-600 text-xs tracking-wider">
            © {{ new Date().getFullYear() }} CONTROL TOTAL & P.H. - TODOS LOS DERECHOS RESERVADOS.
          </p>
          <RouterLink to="/login" target="_blank" rel="noopener noreferrer"
            class="text-gray-700 hover:text-brand-red text-xs font-bold uppercase tracking-wider transition-colors">
            Zona Admin
          </RouterLink>
        </div>
      </div>
    </footer>

    <!-- Botón flotante de WhatsApp -->
    <div class="fixed bottom-6 right-6 z-[60] animate-bounce hover:animate-none">
      <a href="https://wa.me/573208722195?text=Hola,%20quisiera%20informaci%C3%B3n%20sobre%20sus%20servicios."
        target="_blank" aria-label="Chatear por WhatsApp"
        class="btn btn-whatsapp !py-3 !px-5 !text-base !shadow-[0_0_20px_rgba(37,211,102,0.3)] hover:!shadow-[0_0_30px_rgba(37,211,102,0.5)] transition-shadow duration-300">
        <i class="fab fa-whatsapp text-2xl mr-2"></i>
        <span class="hidden sm:inline">WhatsApp</span>
      </a>
    </div>
  </div>
</template>
