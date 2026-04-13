<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, defineAsyncComponent } from 'vue'
import { RouterView, RouterLink, useRoute } from 'vue-router'

import AppHeader from '@/components/Header.vue'
import { useAuthStore } from '@/stores/auth'
import { useNotificationStore } from '@/stores/notifications'

const UserProfileModal = defineAsyncComponent(() => import('@/components/UserProfileModal.vue'))
const ToastContainer = defineAsyncComponent(() => import('@/components/ToastContainer.vue'))
const ConfirmDialog = defineAsyncComponent(() => import('@/components/ConfirmDialog.vue'))

const authStore = useAuthStore()
const notificationStore = useNotificationStore()
const route = useRoute()

// Estado para la visibilidad en modo móvil
const sidebarOpen = ref(true)
// Nuevo estado para el colapso parcial (solo iconos) en desktop
const isCollapsed = ref(false)
const openDropdown = ref<string | null>(null)
const showProfileModal = ref(false)
const isOnline = ref(navigator.onLine)

const updateOnlineStatus = () => {
  isOnline.value = navigator.onLine
}

const handleKeydown = (e: KeyboardEvent) => {
  // Ctrl+K para buscar (foco en el input del header si existiera acceso directo, o abrir un modal de búsqueda)
  if (e.ctrlKey && e.key === 'k') {
    e.preventDefault()
    // Aquí podrías emitir un evento o usar un store para abrir la búsqueda global
    const searchInput = document.querySelector('input[type="search"]') as HTMLInputElement
    if (searchInput) searchInput.focus()
  }
  // Esc para cerrar sidebar móvil o modales
  if (e.key === 'Escape') {
    if (sidebarOpen.value) sidebarOpen.value = false
    if (showProfileModal.value) showProfileModal.value = false
  }
}

onMounted(() => {
  notificationStore.listenForPriceRequests()
  notificationStore.listenForGeneralNotifications()
  window.addEventListener('online', updateOnlineStatus)
  window.addEventListener('offline', updateOnlineStatus)
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener('online', updateOnlineStatus)
  window.removeEventListener('offline', updateOnlineStatus)
  window.removeEventListener('keydown', handleKeydown)
})

// Estructura de navegación ajustada para coincidir con la imagen
const navLinks = [
  // Ítems de nivel superior
  // Nota: La ruta de inicio es '/dashboard' para coincidir con el router y el menú
  { name: 'Inicio', to: '/dashboard', icon: 'fa-clock' }, // Ya es correcto
  { name: 'Clientes', to: '/dashboard/clientes', icon: 'fa-users' },
  { name: 'Servicios', to: '/dashboard/servicios', icon: 'fa-concierge-bell' },
  { name: 'Planeación', to: '/dashboard/planeacion', icon: 'fa-calendar-alt' },
  { name: 'Técnicos', to: '/dashboard/fumigadores', icon: 'fa-user-shield' },

  // Dropdown Finanzas (Nuevo grupo)
  {
    name: 'Finanzas',
    icon: 'fa-dollar-sign',
    // Roles de ejemplo, ajusta según sea necesario
    roles: ['Administrador', 'Jefe'],
    children: [
      { name: 'Facturación', to: '/dashboard/facturacion', icon: 'fa-file-invoice-dollar' },
      { name: 'Pagos', to: '/dashboard/pagos', icon: 'fa-hand-holding-usd' },
    ],
  },
  // Dropdown Administración (Renombrado y reorganizado)
  {
    name: 'Administración',
    icon: 'fa-screwdriver-wrench',
    // Roles de ejemplo, ajusta según sea necesario
    roles: ['Administrador', 'Jefe', 'Coordinador Nacionales'],
    children: [
      { name: 'Reportes', to: '/dashboard/reportes', icon: 'fa-chart-pie' },
      { name: 'Permisos', to: '/dashboard/permisos', icon: 'fa-file-signature' },
    ],
  },
  // Configuración (Movido a nivel superior)
  { name: 'Configuración', to: '/dashboard/configuracion', icon: 'fa-cogs' },
]

// Función mejorada para determinar si un enlace está activo
const isLinkActive = (path: string) => {
  // Caso especial para la ruta de inicio (raíz '/' o '/dashboard')
  if (path === '/dashboard') {
    // CORRECCIÓN: Solo activo si es exactamente /dashboard o /dashboard/
    return route.path === '/dashboard' || route.path === '/dashboard/'
  }
  // Para el resto de rutas, verifica si la ruta actual comienza con el path
  return route.path.startsWith(path)
}

// Función para determinar si el dropdown contiene un enlace activo
const isDropdownActive = (children: { name: string; to: string; icon?: string }[]) => {
  return children.some((child) => isLinkActive(child.to))
}

const hasAccess = (roles?: string[]) => {
  if (!roles) return true
  // Usa el rol del usuario logueado para verificar el acceso
  return roles.includes(authStore.userRole || '')
}

// Función para alternar el colapso del sidebar (Desktop)
const toggleCollapse = () => {
  isCollapsed.value = !isCollapsed.value
  if (isCollapsed.value) {
    openDropdown.value = null
  }
}
</script>

<template>
  <!-- Contenedor principal de la aplicación -->
  <div class="flex h-screen bg-[#0a0a0a] text-gray-200">
    <ToastContainer />
    <ConfirmDialog />
    <!-- Overlay para cerrar el sidebar en móvil -->
    <div v-if="sidebarOpen && !isCollapsed" @click="sidebarOpen = false"
      class="fixed inset-0 bg-black/60 z-20 lg:hidden"></div>
    <!-- Indicador de Conexión -->
    <div v-if="!isOnline" class="fixed bottom-0 left-0 right-0 bg-red-600 text-white text-center text-xs py-1 z-50">
      <i class="fas fa-wifi-slash mr-2"></i> Sin conexión a internet
    </div>
    <!-- Sidebar -->
    <aside
      class="fixed lg:relative flex-shrink-0 bg-[#151515] border-r border-white/5 flex flex-col transition-all duration-300 ease-in-out h-full z-30 shadow-2xl"
      :class="[
        isCollapsed ? 'w-20' : 'w-64',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
      ]" id="sidebar">
      <!-- Logo y Botón de Colapso -->
      <div class="h-16 flex items-center justify-between px-4 bg-[#0a0a0a] border-b border-white/5 flex-shrink-0">
        <div class="flex items-center transition-all duration-300" :class="{ 'w-full justify-center': isCollapsed }">
          <!-- Icono de ordenador (similar al de la imagen) -->
          <img src="/logo.png" alt="Logo" class="h-12 transition-opacity" :class="{ 'opacity-0 w-0': isCollapsed }" />
          <h1 v-show="!isCollapsed" class="text-xl font-bold text-white whitespace-nowrap">
            CT & P. H.
          </h1>
        </div>
        <!-- Botón de Colapso (Solo en Desktop) -->
        <button @click="toggleCollapse"
          class="p-1 rounded-full text-gray-400 hover:text-white transition-colors hidden lg:block">
          <i class="fas text-lg" :class="{ 'fa-chevron-left': !isCollapsed, 'fa-chevron-right': isCollapsed }"></i>
        </button>
        <!-- Botón para cerrar en móvil -->
        <button @click="sidebarOpen = false"
          class="p-1 rounded-full text-gray-400 hover:text-white transition-colors lg:hidden">
          <i class="fas fa-times text-xl"></i>
        </button>
      </div>

      <!-- Navegación principal -->
      <nav class="flex-grow overflow-y-auto custom-scrollbar">
        <ul>
          <template v-for="link in navLinks" :key="link.name">
            <li v-if="hasAccess(link.roles) && !link.children">
              <!-- Enlace simple -->
              <RouterLink :to="link.to" active-class="" exact-active-class=""
                class="flex items-center py-3 text-gray-300 hover:bg-[#d60000] hover:text-white transition-colors group"
                :class="{
                  '!bg-[#d60000] !text-white font-semibold': isLinkActive(link.to),
                  'justify-center px-7': isCollapsed,
                  'px-6': !isCollapsed,
                }" :title="isCollapsed ? link.name : ''">
                <i class="fas text-center" :class="[link.icon, { 'w-full': isCollapsed }]"></i>
                <span v-show="!isCollapsed" class="ml-4 whitespace-nowrap">{{ link.name }}</span>
              </RouterLink>
            </li>

            <li v-else-if="hasAccess(link.roles) && link.children">
              <!-- Botón de Dropdown -->
              <button @click="openDropdown = openDropdown === link.name ? null : link.name"
                class="w-full flex items-center justify-between py-3 text-gray-300 hover:bg-[#d60000] hover:text-white transition-colors"
                :class="{
                  '!bg-[#d60000] !text-white font-semibold':
                    isDropdownActive(link.children) || openDropdown === link.name,
                  'justify-center px-7': isCollapsed,
                  'px-6': !isCollapsed,
                }" :title="isCollapsed ? link.name : ''">
                <span class="flex items-center" :class="{ 'w-full justify-center': isCollapsed }">
                  <i class="fas text-center" :class="[link.icon, { 'w-full': isCollapsed }]"></i>
                  <span v-show="!isCollapsed" class="ml-4 whitespace-nowrap">{{ link.name }}</span>
                </span>
                <i v-show="!isCollapsed" class="fas fa-chevron-down text-xs transition-transform"
                  :class="{ 'rotate-180': openDropdown === link.name }"></i>
              </button>

              <!-- Contenedor del Submenú -->
              <div v-show="openDropdown === link.name && !isCollapsed"
                class="bg-white/5 overflow-hidden transition-all duration-300 ease-in-out">
                <ul>
                  <li v-for="child in link.children" :key="child.name">
                    <RouterLink :to="child.to" active-class="" exact-active-class=""
                      class="flex items-center pl-10 pr-6 py-2 text-gray-400 hover:bg-[#d60000] hover:text-white transition-colors"
                      :class="{ '!text-white font-bold bg-[#d60000]/20': isLinkActive(child.to) }">
                      {{ child.name }}
                    </RouterLink>
                  </li>
                </ul>
              </div>
            </li>
          </template>
        </ul>
      </nav>

      <!-- Sección de Perfil de Usuario -->
      <div class="p-4 border-t border-white/5 flex-shrink-0">
        <div @click="showProfileModal = true"
          class="w-full flex items-center p-2 rounded-lg hover:bg-white/5 cursor-pointer"
          :class="{ 'justify-center': isCollapsed }">
          <div
            class="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white flex-shrink-0 bg-cyan-500">
            <img v-if="authStore.user?.photoURL" :key="authStore.user.photoURL" :src="authStore.user.photoURL"
              alt="Avatar" class="w-full h-full rounded-full object-cover" />
            <span v-else class="text-lg">{{ authStore.user?.email?.charAt(0).toUpperCase() }}</span>
          </div>
          <div class="flex-grow ml-3 overflow-hidden" :class="{ hidden: isCollapsed }">
            <p class="font-semibold text-white truncate">
              {{ authStore.user?.displayName || authStore.user?.email }}
            </p>
            <p class="text-xs text-gray-400">{{ authStore.userRole || 'Sin rol' }}</p>
          </div>
        </div>
        <!-- Botón de Cerrar Sesión -->
        <button @click="authStore.logout"
          class="flex justify-center items-center mt-4 w-full bg-[#d60000]/20 text-[#d60000] hover:bg-[#d60000] hover:text-white p-2 rounded-lg transition-colors"
          :class="{ 'w-full': !isCollapsed, 'w-10 h-10 mx-auto': isCollapsed }"
          :title="isCollapsed ? 'Cerrar Sesión' : ''">
          <i class="fas fa-sign-out-alt" :class="{ 'mr-2': !isCollapsed }"></i>
          <span v-show="!isCollapsed" class="whitespace-nowrap">Cerrar Sesión</span>
        </button>
      </div>
    </aside>

    <!-- Contenido Principal -->
    <div class="flex-1 flex flex-col overflow-hidden">
      <!-- Header con Búsqueda Global -->
      <AppHeader @toggle-sidebar="sidebarOpen = !sidebarOpen" />

      <!-- Área de la vista (donde se renderiza RouterView) -->
      <main class="flex-1 overflow-x-hidden overflow-y-auto bg-[#0a0a0a] p-4">
        <RouterView v-slot="{ Component }">
          <transition name="fade-slide" mode="out-in">
            <component :is="Component" />
          </transition>
        </RouterView>
      </main>
    </div>
    <!-- Modal de Perfil de Usuario -->
    <UserProfileModal :show="showProfileModal" @close="showProfileModal = false" />
  </div>
</template>

<style scoped>
/* Estilo para que el sidebar se muestre siempre en desktop y el botón de colapso funcione */
@media (min-width: 1024px) {
  #sidebar {
    transform: translateX(0) !important;
  }
}

/* Estilos de barra de desplazamiento personalizada para navegadores basados en WebKit */
.custom-scrollbar::-webkit-scrollbar {
  width: 8px;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
  background-color: #333;
  border-radius: 4px;
}

.custom-scrollbar::-webkit-scrollbar-track {
  background: #0a0a0a;
}

/* Transición para la vista (RouterView) */
.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}

.fade-slide-enter-from {
  opacity: 0;
  transform: translateX(-10px);
}

.fade-slide-leave-to {
  opacity: 0;
  transform: translateX(10px);
}
</style>
