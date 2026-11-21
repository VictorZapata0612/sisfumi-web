<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, defineAsyncComponent } from 'vue'
import { RouterView, RouterLink, useRoute } from 'vue-router'

import NotificationsModal from '@/components/NotificationsModal.vue'
import AppHeader from '@/components/Header.vue'
import AgentPanel from '@/components/AgentPanel.vue'
import { useAuthStore } from '@/stores/auth'
import { useNotificationStore } from '@/stores/notifications'
import { ROLE_MATRIX } from '@/data/roleMatrix'

const UserProfileModal = defineAsyncComponent(() => import('@/components/UserProfileModal.vue'))
const ToastContainer = defineAsyncComponent(() => import('@/components/ToastContainer.vue'))
const ConfirmDialog = defineAsyncComponent(() => import('@/components/ConfirmDialog.vue'))

const authStore = useAuthStore()
const notificationStore = useNotificationStore()
const route = useRoute()

// Estado para la visibilidad en modo móvil
const sidebarOpen = ref(false)
const darkTheme = ref(localStorage.getItem('sisfumi-theme') === 'dark')
watch(darkTheme, (enabled) => localStorage.setItem('sisfumi-theme', enabled ? 'dark' : 'light'))
watch(() => route.fullPath, () => { sidebarOpen.value = false })
// Nuevo estado para el colapso parcial (solo iconos) en desktop
const isCollapsed = ref(false)
const openDropdown = ref<string | null>(null)
const showProfileModal = ref(false)
const showAgentPanel = ref(false)
const isOnline = ref(navigator.onLine)

const updateOnlineStatus = () => {
  isOnline.value = navigator.onLine
}

const handleKeydown = (e: KeyboardEvent) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
    document.getElementById('sisfumi-global-search')?.focus()
    e.preventDefault()
  }
  if (e.key === 'Escape') {
    if (sidebarOpen.value) sidebarOpen.value = false
    if (showProfileModal.value) showProfileModal.value = false
    if (showAgentPanel.value) showAgentPanel.value = false
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

type NavChildLink = { name: string; to: string; icon?: string; roles?: string[] }
type NavLink =
  | { name: string; to: string; icon: string; roles?: string[]; children?: never }
  | { name: string; icon: string; roles?: string[]; children: NavChildLink[] }

// Estructura de navegación ajustada para coincidir con la imagen
const navLinks: NavLink[] = [
  // Ítems de nivel superior
  // Nota: La ruta de inicio es '/dashboard' para coincidir con el router y el menú
  { name: 'Inicio', to: '/dashboard', icon: 'fa-house' }, // Ya es correcto
  { name: 'Clientes', to: '/dashboard/clientes', icon: 'fa-users', roles: [...ROLE_MATRIX.operational] },
  { name: 'Servicios', to: '/dashboard/servicios', icon: 'fa-bug', roles: [...ROLE_MATRIX.operational] },
  { name: 'Planeación', to: '/dashboard/planeacion', icon: 'fa-calendar-alt', roles: [...ROLE_MATRIX.operational] },
  { name: 'Técnicos', to: '/dashboard/fumigadores', icon: 'fa-hard-hat', roles: [...ROLE_MATRIX.operational] },

  // Dropdown Finanzas (Nuevo grupo)
  {
    name: 'Finanzas',
    icon: 'fa-coins',
    roles: [...ROLE_MATRIX.financial],
    children: [
      { name: 'Facturación', to: '/dashboard/facturacion', icon: 'fa-file-invoice-dollar', roles: [...ROLE_MATRIX.financial] },
      { name: 'Pagos', to: '/dashboard/pagos', icon: 'fa-money-bill-wave', roles: [...ROLE_MATRIX.financial] },
    ],
  },
  { name: 'Reportes', to: '/dashboard/reportes', icon: 'fa-chart-column', roles: [...ROLE_MATRIX.financial] },
  { name: 'Administración', to: '/dashboard/permisos', icon: 'fa-layer-group', roles: [...ROLE_MATRIX.permissions] },
  { name: 'Configuración', to: '/dashboard/configuracion', icon: 'fa-gear', roles: [...ROLE_MATRIX.operational] },
]

// Función mejorada para determinar si un enlace está activo
const isLinkActive = (path: string) => {
  // Caso especial para la ruta de inicio (raíz '/' o '/dashboard')
  if (path === '/dashboard') {
    // CORRECCIÓN: Solo activo si es exactamente /dashboard o /dashboard/
    return route.path === '/dashboard' || route.path === '/dashboard/'
  }
  // Para el resto de rutas, verifica si la ruta actual comienza con el path
  return route.path === path || route.path.startsWith(path + '/')
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
  if (isCollapsed.value) openDropdown.value = null
}

const toggleGroup = (name: string) => {
  isCollapsed.value = false
  openDropdown.value = openDropdown.value === name ? null : name
}
</script>

<template>
  <!-- Contenedor principal de la aplicación -->
  <div class="app-shell flex h-dvh" :data-theme="darkTheme ? 'dark' : 'light'">
    <ToastContainer />
    <NotificationsModal />
    <ConfirmDialog />
    <AgentPanel v-if="showAgentPanel" @close="showAgentPanel = false" />
    <button
      type="button"
      class="fixed bottom-5 right-5 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-red-700 text-white shadow-xl transition hover:scale-105 hover:bg-red-600"
      title="Abrir asistente SISFUMI"
      aria-label="Abrir asistente SISFUMI"
      @click="showAgentPanel = !showAgentPanel"
    >
      <i class="fas fa-sparkles"></i>
    </button>
    <!-- Overlay para cerrar el sidebar en móvil -->
    <div v-if="sidebarOpen" @click="sidebarOpen = false"
      class="fixed inset-0 bg-black/60 z-[35] lg:hidden"></div>
    <!-- Indicador de Conexión -->
    <div v-if="!isOnline" class="fixed bottom-0 left-0 right-0 bg-red-600 text-white text-center text-xs py-1 z-50">
      <i class="fas fa-wifi-slash mr-2"></i> Sin conexión a internet
    </div>
    <!-- Sidebar -->
    <aside
      class="fixed lg:relative brand-sidebar flex shrink-0 flex-col text-white transition-[width,transform] duration-200 motion-reduce:transition-none h-full z-40 border-r border-white/10"
      :class="[
        isCollapsed ? 'w-[13.5rem] lg:w-20' : 'w-[13.5rem]',
        sidebarOpen ? 'translate-x-0' : 'invisible -translate-x-full lg:visible lg:translate-x-0',
      ]" id="sidebar">
      <!-- Logo y Botón de Colapso -->
      <div class="relative shrink-0 px-4 pb-3 pt-4 text-center"
        :class="{ 'lg:px-1 lg:pb-2 lg:pt-7': isCollapsed }">
        <div class="mx-auto mb-1 grid h-[4.5rem] w-24 place-items-center overflow-hidden"
          :class="{ 'lg:size-11': isCollapsed }">
          <img src="/logo.png" alt="" class="size-full min-h-0 object-contain scale-[1.85]" />
        </div>
        <div :class="{ 'lg:sr-only': isCollapsed }">
          <p class="text-[2rem] font-extrabold leading-none tracking-tight">SisFumi</p>
          <p class="mt-1 text-xs text-neutral-200">Control de Plagas</p>
        </div>
        <button type="button" @click="toggleCollapse"
          class="absolute right-1 top-1 hidden size-7 items-center justify-center rounded-md text-neutral-300 hover:bg-white/10 lg:flex"
          :aria-label="isCollapsed ? 'Expandir navegación' : 'Contraer navegación'">
          <i class="fas text-xs" :class="isCollapsed ? 'fa-chevron-right' : 'fa-chevron-left'" aria-hidden="true"></i>
        </button>
        <button type="button" @click="sidebarOpen = false"
          class="absolute right-1 top-1 size-8 rounded-md hover:bg-white/10 lg:hidden" aria-label="Cerrar navegación">
          <i class="fas fa-times" aria-hidden="true"></i>
        </button>
      </div>
      <nav aria-label="Navegación principal" class="sidebar-nav flex min-h-0 flex-1 flex-col overflow-y-auto px-2.5 pb-3 pt-2">
        <ul class="shrink-0 space-y-0.5">
          <template v-for="link in navLinks" :key="link.name">
            <li v-if="hasAccess(link.roles) && !link.children">
              <!-- Enlace simple -->
              <RouterLink :to="link.to" active-class="" exact-active-class="" :aria-label="link.name" @click="sidebarOpen = false"
                class="nav-button flex items-center gap-3 rounded-lg px-3 text-sm text-neutral-200 transition-colors hover:bg-white/10"
                :class="{
                  'nav-active text-white font-semibold': isLinkActive(link.to),
                  'lg:justify-center': isCollapsed,
                }" :title="isCollapsed ? link.name : ''">
                <i class="fas w-5 shrink-0 text-center text-base" :class="[link.icon, { 'lg:w-full': isCollapsed }]"></i>
                <span :class="{ 'lg:hidden': isCollapsed }" class="ml-1 whitespace-nowrap">{{ link.name }}</span>
              </RouterLink>
            </li>

            <li v-else-if="hasAccess(link.roles) && link.children">
              <!-- Botón de Dropdown -->
              <button @click="toggleGroup(link.name)" :aria-expanded="openDropdown === link.name && !isCollapsed" :aria-label="link.name"
                class="nav-button flex w-full items-center justify-between rounded-lg px-3 text-sm text-neutral-200 transition-colors hover:bg-white/10"
                :class="{
                  'nav-active text-white font-semibold':
                    isDropdownActive(link.children),
                  'lg:justify-center': isCollapsed,
                }" :title="isCollapsed ? link.name : ''">
                <span class="flex items-center gap-3" :class="{ 'lg:w-full lg:justify-center': isCollapsed }">
                  <i class="fas w-5 shrink-0 text-center text-base" :class="[link.icon, { 'lg:w-full': isCollapsed }]"></i>
                  <span :class="{ 'lg:hidden': isCollapsed }" class="ml-1 whitespace-nowrap">{{ link.name }}</span>
                </span>
                <i class="fas fa-chevron-down text-xs transition-transform"
                  :class="{ 'rotate-180': openDropdown === link.name, 'lg:hidden': isCollapsed }"></i>
              </button>

              <!-- Contenedor del Submenú -->
              <div v-show="openDropdown === link.name && !isCollapsed"
                class="bg-white/5 overflow-hidden transition-all duration-300 ease-in-out">
                <ul>
                  <li v-for="child in link.children" :key="child.name">
                    <RouterLink v-if="hasAccess(child.roles)" :to="child.to" active-class="" exact-active-class="" @click="sidebarOpen = false"
                      class="flex items-center pl-10 pr-6 py-2 text-gray-400 hover:bg-[#E50914] hover:text-white transition-colors"
                      :class="{ '!text-white font-bold bg-[#E50914]/20': isLinkActive(child.to) }">
                      {{ child.name }}
                    </RouterLink>
                  </li>
                </ul>
              </div>
            </li>
          </template>
        </ul>
        <div class="brand-panel mt-auto pb-6 pt-4" :class="{ 'lg:hidden': isCollapsed }">
          <div class="brand-card mx-2 grid min-h-[11.4rem] content-center px-3 py-5 text-center">
            <span class="brand-shield relative mx-auto mb-3 grid size-10 place-items-center" aria-hidden="true">
              <i class="fas fa-shield-alt text-[2.5rem]"></i>
              <i class="fas fa-check absolute inset-0 grid place-items-center text-base text-[#111111]"></i>
            </span>
            <p class="text-base font-bold leading-tight">Protegemos<br />tu entorno</p>
            <p class="mt-2 brand-description text-xs leading-snug text-neutral-200">Soluciones profesionales en control de plagas</p>
          </div>
        </div>
      </nav>

      <!-- Sección de Perfil de Usuario -->
      <div class="relative shrink-0 rounded-tr-2xl border-t border-white/10 bg-[#111111] p-3">
        <button type="button" @click="showProfileModal = true; sidebarOpen = false" aria-label="Abrir perfil"
          class="w-full flex items-center p-2 rounded-lg hover:bg-white/5 cursor-pointer"
          :class="{ 'justify-center': isCollapsed }">
          <div
            class="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white flex-shrink-0 bg-neutral-800">
            <img v-if="authStore.user?.photoURL" :key="authStore.user.photoURL" :src="authStore.user.photoURL"
              alt="Avatar" class="w-full h-full rounded-full object-cover" />
            <span v-else class="text-lg">{{ authStore.user?.email?.charAt(0).toUpperCase() }}</span>
          </div>
          <div class="flex-grow ml-3 overflow-hidden text-left" :class="{ 'lg:hidden': isCollapsed }">
            <p class="font-semibold text-white truncate">
              {{ authStore.user?.displayName || authStore.user?.email }}
            </p>
            <p class="text-xs text-gray-400">{{ authStore.userRole || 'Sin rol' }}</p>
          </div>
          <i class="fas fa-chevron-down ml-2 text-xs" :class="{ 'lg:hidden': isCollapsed }" aria-hidden="true"></i>
        </button>
        <button type="button" @click="authStore.logout" aria-label="Cerrar sesión"
          class="flex justify-center items-center mt-2 w-full bg-[#E50914]/25 text-[#ff666d] hover:bg-[#E50914] hover:text-white p-2 rounded-lg transition-colors"
          :class="{ 'lg:mx-auto lg:size-10': isCollapsed }"
          :title="isCollapsed ? 'Cerrar Sesión' : ''">
          <i class="fas fa-sign-out-alt mr-2" :class="{ 'lg:mr-0': isCollapsed }"></i>
          <span :class="{ 'lg:hidden': isCollapsed }" class="whitespace-nowrap">Cerrar Sesión</span>
        </button>
      </div>
    </aside>

    <!-- Contenido Principal -->
    <div class="flex-1 flex flex-col overflow-hidden">
      <!-- Header con Búsqueda Global -->
      <AppHeader
        :sidebar-open="sidebarOpen"
        :dark-theme="darkTheme"
        :show-clock="route.name !== 'dashboard'"
        @toggle-sidebar="sidebarOpen = !sidebarOpen"
        @set-theme="darkTheme = $event"
      />

      <!-- Área de la vista (donde se renderiza RouterView) -->
      <main class="app-content flex-1 overflow-x-hidden overflow-y-auto bg-[var(--shell-canvas)] p-4">
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
.brand-sidebar {
  background:
    linear-gradient(155deg, #111 0%, #1b1b1b 58%, #111 100%);
}

.nav-active {
  background: linear-gradient(120deg, #e50914, #b8000b);
}

.app-content,
.app-content :deep(*) {
  scrollbar-color: var(--shell-scroll-thumb) var(--shell-scroll-track);
}

.sidebar-nav {
  scrollbar-width: none;
}

.sidebar-nav::-webkit-scrollbar {
  display: none;
}

.nav-button {
  min-height: 2.375rem;
}

@media (max-height: 860px) {
  .nav-button {
    min-height: 2.25rem;
  }

  .brand-card {
    min-height: 10rem;
    padding-block: 0.75rem;
  }

  .brand-panel {
    padding-block: 0.75rem;
  }
}

.brand-panel {
  position: relative;
  isolation: isolate;
}

.brand-panel::before {
  position: absolute;
  z-index: -1;
  inset: 1.5rem -0.625rem -1.25rem;
  background: linear-gradient(128deg, transparent 0 49%, #9d060d 49% 55%, #c00a13 55% 59%, transparent 59%);
  pointer-events: none;
  content: '';
}

.brand-card {
  position: relative;
  overflow: hidden;
  border: 1px solid #676767;
  border-radius: 2.75rem 0.625rem 2.75rem 0.625rem;
  background: linear-gradient(145deg, #121212 0%, #141414 66%, #1b1b1b 100%);
}

@media (max-height: 780px) {
  .brand-panel {
    padding-block: 0.375rem;
  }

  .brand-panel::before {
    inset: 0 -0.625rem;
  }

  .brand-card {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.65rem;
    min-height: 3rem;
    padding: 0.35rem 0.5rem;
    border-radius: 1.25rem 0.5rem 1.25rem 0.5rem;
    text-align: left;
  }

  .brand-card p {
    font-size: 0.75rem;
  }

  .brand-description {
    display: none;
  }

  .brand-shield {
    width: 1.75rem;
    height: 1.75rem;
    margin: 0;
  }

  .brand-shield .fa-shield-alt {
    font-size: 1.65rem;
  }

  .brand-shield .fa-check {
    font-size: 0.65rem;
  }
}

.brand-shield :deep(.fa-check) {
  display: grid;
  place-items: center;
}

.app-shell {
  --shell-scroll-thumb: #dedee2;
  --shell-scroll-track: #fff;
  --shell-canvas: #f5f5f5;
  --shell-surface: #fff;
  --shell-input: #f5f5f5;
  --shell-border: #e5e5e5;
  --shell-text: #111;
  --shell-muted: #525252;
  color: var(--shell-text);
}

.app-shell[data-theme="dark"] {
  --shell-scroll-thumb: #404040;
  --shell-scroll-track: #111;
  --shell-canvas: #111;
  --shell-surface: #1b1b1b;
  --shell-input: #111;
  --shell-border: #404040;
  --shell-text: #fafafa;
  --shell-muted: #b5b5b5;
}

/* Estilo para que el sidebar se muestre siempre en desktop y el botón de colapso funcione */
@media (min-width: 1024px) {
  #sidebar {
    transform: translateX(0) !important;
  }
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
