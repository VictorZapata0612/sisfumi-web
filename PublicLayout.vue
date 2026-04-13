<script setup lang="ts">
import { ref } from 'vue'
import { RouterView, RouterLink, useRoute } from 'vue-router'

const route = useRoute()

const isMobileMenuOpen = ref(false)

function closeMenu() {
  isMobileMenuOpen.value = false
}
</script>

<template>
  <div class="min-h-screen flex flex-col bg-gray-900 text-white font-sans selection:bg-brand-red selection:text-white">
    <!-- NAVBAR FLOTANTE -->
    <nav class="fixed w-full z-50 border-b border-white/5 bg-gray-900/80 backdrop-blur-xl">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between items-center h-20">
          <!-- LOGO -->
          <RouterLink to="/" class="flex-shrink-0 flex items-center gap-3 group">
            <img class="h-10 w-auto md:h-12 transition-transform duration-300 group-hover:scale-105" src="/logo.png"
              alt="Control Total Logo" />
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
              :class="route.path === '/' ? 'text-white' : 'text-gray-300 hover:text-white'">
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
              <RouterLink to="/login"
                class="btn btn-secondary !px-5 !py-2 !text-xs !uppercase !tracking-wider hover:!bg-white/10">
                Zona Admin
              </RouterLink>
            </div>
          </div>

          <!-- BOTÓN MENÚ MÓVIL -->
          <div class="md:hidden">
            <button @click="isMobileMenuOpen = !isMobileMenuOpen"
              class="text-white p-2 rounded-lg hover:bg-white/10 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-red/50"
              aria-label="Abrir menú">
              <i class="fas fa-bars text-xl"></i>
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
            <i class="fas fa-times text-2xl"></i>
          </button>
        </div>
        <div class="flex flex-col gap-4 text-xl font-medium">
          <RouterLink to="/" @click="closeMenu"
            class="hover:text-brand-red hover:pl-2 transition-all duration-300 border-b border-white/5 pb-4"
            :class="route.path === '/' ? 'text-white' : 'text-gray-400'">INICIO</RouterLink>
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
    <main class="flex-grow pt-20">
      <RouterView />
    </main>

    <!-- FOOTER -->
    <footer class="border-t border-white/10 bg-[#0a0a0a] pt-16 pb-8 mt-auto">
      <div class="max-w-7xl mx-auto px-4 text-center text-gray-500 text-xs">
        <p>&copy; {{ new Date().getFullYear() }} CONTROL TOTAL & P.H. - TODOS LOS DERECHOS RESERVADOS.</p>
      </div>
    </footer>
  </div>
</template>
