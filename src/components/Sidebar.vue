<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useNotificationStore } from '@/stores/notifications'
import UserProfileModal from './UserProfileModal.vue'
import { RouterLink } from 'vue-router'

defineOptions({ name: 'AppSidebar' })

const authStore = useAuthStore()
const notificationStore = useNotificationStore()

const handleLogout = () => {
  // Limpiamos los listeners antes de desloguear
  notificationStore.cleanupListeners()
  authStore.logout()
}

const isCollapsed = ref(false)
const showProfileModal = ref(false)

const isFinanceOpen = ref(false)
const isAdminOpen = ref(false)

onMounted(() => {
  // Iniciar ambos listeners
  notificationStore.listenForPriceRequests()
  notificationStore.listenForGeneralNotifications()
})

const roleColorClass = computed(() => {
  switch (authStore.userRole) {
    case 'Administrador':
      return 'bg-red-600 shadow-red-500/20'
    case 'Jefe':
      return 'bg-yellow-500 shadow-yellow-500/20'
    case 'Coordinador Nacionales':
      return 'bg-blue-500 shadow-blue-500/20'
    case 'Coordinador Valle':
      return 'bg-green-500 shadow-green-500/20'
    case 'Coordinador Norte de Santander':
      return 'bg-teal-500 shadow-teal-500/20'
    default:
      return 'bg-indigo-500 shadow-indigo-500/20'
  }
})

const userInitials = computed(() => {
  const name = authStore.user?.displayName || authStore.user?.email || 'U'
  return name.charAt(0).toUpperCase()
})
</script>

<template>
  <aside
    class="bg-[#151515] border-r border-white/10 shadow-2xl flex flex-col flex-shrink-0 text-gray-300 transition-all duration-300 ease-in-out relative z-40"
    :class="isCollapsed ? 'w-20' : 'w-72'">
    <!-- Logo & Toggle -->
    <div class="h-20 flex items-center border-b border-white/10 px-4 bg-[#0a0a0a]/20"
      :class="isCollapsed ? 'justify-center' : 'justify-between'">
      <div class="flex items-center gap-3 overflow-hidden transition-all duration-300"
        :class="{ 'w-0 opacity-0': isCollapsed, 'w-auto opacity-100': !isCollapsed }">
        <div class="p-1.5 bg-red-600 rounded-lg shadow-lg shadow-red-600/20">
          <img src="/logo.png" alt="Sisfumi" class="h-7 w-auto brightness-0 invert" />
        </div>
        <span class="font-black text-xl text-white tracking-tighter uppercase">Sisfumi</span>
      </div>

      <img v-if="isCollapsed" src="/logo.png" alt="Sisfumi" class="h-10 w-10 object-contain p-1" />

      <button @click="isCollapsed = !isCollapsed"
        class="absolute -right-3 top-8 bg-[#151515] border border-white/10 text-gray-400 hover:text-white p-1.5 rounded-full shadow-xl transition-all hover:scale-110 z-50 hidden md:block">
        <i class="fas text-[10px]" :class="isCollapsed ? 'fa-chevron-right' : 'fa-chevron-left'"></i>
      </button>
    </div>

    <!-- Navigation Area -->
    <nav class="flex-grow py-6 px-3 space-y-1 overflow-y-auto custom-scrollbar">
      <RouterLink to="/" class="nav-item group" active-class="active" exact-active-class="active">
        <div class="nav-icon-wrapper">
          <i class="fas fa-grid-2 w-5 text-center"></i>
        </div>
        <span class="nav-text" :class="{ collapsed: isCollapsed }">Panel de Control</span>
        <div v-if="isCollapsed" class="nav-tooltip">Inicio</div>
      </RouterLink>

      <!-- Notificaciones Personales (Nuevo) -->
      <RouterLink to="/notificaciones" class="nav-item group relative" active-class="active">
        <div class="nav-icon-wrapper"><i class="fas fa-bell w-5 text-center"></i></div>
        <span class="nav-text" :class="{ collapsed: isCollapsed }">Notificaciones</span>
        <span v-if="notificationStore.generalNotificationsCount > 0" class="nav-badge !bg-blue-500"
          :class="{ 'badge-collapsed': isCollapsed }">
          {{ notificationStore.generalNotificationsCount }}
        </span>
        <div v-if="isCollapsed" class="nav-tooltip">Notificaciones</div>
      </RouterLink>

      <div class="nav-section-divider" :class="{ 'justify-center': isCollapsed }">
        <span v-if="!isCollapsed">Operaciones</span>
        <div v-else class="w-8 h-px bg-white/10"></div>
      </div>

      <RouterLink to="/clientes" class="nav-item group" active-class="active">
        <div class="nav-icon-wrapper">
          <i class="fas fa-building w-5 text-center"></i>
        </div>
        <span class="nav-text" :class="{ collapsed: isCollapsed }">Gestión Clientes</span>
        <div v-if="isCollapsed" class="nav-tooltip">Clientes</div>
      </RouterLink>

      <RouterLink to="/servicios" class="nav-item group relative" active-class="active">
        <div class="nav-icon-wrapper">
          <i class="fas fa-file-signature w-5 text-center"></i>
        </div>
        <span class="nav-text" :class="{ collapsed: isCollapsed }">Servicios</span>
        <span v-if="notificationStore.priceRequestsCount > 0" class="nav-badge"
          :class="{ 'badge-collapsed': isCollapsed }">
          {{ notificationStore.priceRequestsCount }}
        </span>
        <div v-if="isCollapsed" class="nav-tooltip">Servicios</div>
      </RouterLink>

      <RouterLink to="/planeacion" class="nav-item group" active-class="active">
        <div class="nav-icon-wrapper">
          <i class="fas fa-calendar-circle-plus w-5 text-center"></i>
        </div>
        <span class="nav-text" :class="{ collapsed: isCollapsed }">Planeación</span>
        <div v-if="isCollapsed" class="nav-tooltip">Calendario</div>
      </RouterLink>

      <RouterLink to="/fumigadores" class="nav-item group" active-class="active">
        <div class="nav-icon-wrapper">
          <i class="fas fa-user-helmet-safety w-5 text-center"></i>
        </div>
        <span class="nav-text" :class="{ collapsed: isCollapsed }">Personal Técnico</span>
        <div v-if="isCollapsed" class="nav-tooltip">Técnicos</div>
      </RouterLink>

      <!-- Finance Dropdown -->
      <div class="relative">
        <button @click="isFinanceOpen = !isFinanceOpen" class="nav-item w-full group"
          :class="[isFinanceOpen && !isCollapsed ? 'bg-white/5 text-white' : '']">
          <div class="flex items-center min-w-0">
            <div class="nav-icon-wrapper text-emerald-500">
              <i class="fas fa-sack-dollar w-5 text-center"></i>
            </div>
            <span class="nav-text" :class="{ collapsed: isCollapsed }">Finanzas</span>
          </div>
          <i v-if="!isCollapsed" class="fas fa-chevron-down text-[10px] transition-transform duration-300"
            :class="{ 'rotate-180': isFinanceOpen }"></i>
          <div v-if="isCollapsed" class="nav-tooltip">Finanzas</div>
        </button>
        <Transition name="expand">
          <div v-show="isFinanceOpen && !isCollapsed" class="sub-nav-container">
            <RouterLink to="/facturacion" class="sub-nav-item" active-class="sub-active">Facturación</RouterLink>
            <RouterLink to="/pagos" class="sub-nav-item" active-class="sub-active">Gestión de Pagos</RouterLink>
          </div>
        </Transition>
      </div>

      <!-- Admin Dropdown -->
      <div class="relative">
        <button @click="isAdminOpen = !isAdminOpen" class="nav-item w-full group"
          :class="[isAdminOpen && !isCollapsed ? 'bg-white/5 text-white' : '']">
          <div class="flex items-center min-w-0">
            <div class="nav-icon-wrapper text-indigo-400">
              <i class="fas fa-shield-halved w-5 text-center"></i>
            </div>
            <span class="nav-text" :class="{ collapsed: isCollapsed }">Configuración</span>
          </div>
          <i v-if="!isCollapsed" class="fas fa-chevron-down text-[10px] transition-transform duration-300"
            :class="{ 'rotate-180': isAdminOpen }"></i>
          <div v-if="isCollapsed" class="nav-tooltip">Admin</div>
        </button>
        <Transition name="expand">
          <div v-show="isAdminOpen && !isCollapsed" class="sub-nav-container">
            <RouterLink to="/reportes" class="sub-nav-item" active-class="sub-active">Reportes Ejecutivos</RouterLink>
            <RouterLink to="/permisos" class="sub-nav-item" active-class="sub-active">Control de Permisos</RouterLink>
            <RouterLink to="/configuracion" class="sub-nav-item" active-class="sub-active">Ajustes del Sistema
            </RouterLink>
          </div>
        </Transition>
      </div>
    </nav>

    <!-- User Section -->
    <div class="p-4 border-t border-white/10 bg-[#0a0a0a]/20">
      <div @click="showProfileModal = true"
        class="flex items-center gap-3 p-2 rounded-2xl hover:bg-white/5 cursor-pointer transition-all group relative"
        :class="{ 'justify-center': isCollapsed }">
        <div
          class="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white shadow-lg flex-shrink-0 transition-all group-hover:scale-105 border border-white/10"
          :class="roleColorClass">
          {{ userInitials }}
        </div>

        <div class="overflow-hidden transition-all duration-300"
          :class="{ 'w-0 opacity-0': isCollapsed, 'w-auto opacity-100': !isCollapsed }">
          <p class="font-bold text-white text-sm truncate leading-tight">
            {{ authStore.user?.displayName || 'Usuario' }}
          </p>
          <p class="text-[10px] text-gray-500 font-bold uppercase tracking-wider truncate mt-0.5">
            {{ authStore.userRole }}
          </p>
        </div>

        <div v-if="isCollapsed" class="nav-tooltip">Perfil de Usuario</div>
      </div>

      <button @click="handleLogout"
        class="w-full mt-4 flex items-center px-3 py-2.5 text-sm text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all"
        :class="isCollapsed ? 'justify-center' : ''">
        <i class="fas fa-power-off text-base"></i>
        <span class="ml-3 font-bold uppercase text-[11px] tracking-widest" :class="{ hidden: isCollapsed }">Cerrar
          Sesión</span>
      </button>

      <div class="mt-4 flex justify-center opacity-30 hover:opacity-100 transition-opacity">
        <RouterLink to="/about"
          class="text-[10px] text-gray-500 hover:text-indigo-400 transition-colors flex items-center gap-1">
          <i class="fas fa-code-branch"></i>
          <span :class="{ hidden: isCollapsed }">Sisfumi v2.4.0</span>
        </RouterLink>
      </div>
    </div>
  </aside>

  <UserProfileModal :show="showProfileModal" @close="showProfileModal = false" />
</template>

<style scoped>
/* Core Item Styles */
.nav-item {
  display: flex;
  align-items: center;
  padding: 0.75rem;
  color: #9ca3af;
  border-radius: 0.875rem;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  border: 1px solid transparent;
}

.nav-item:hover {
  background-color: rgba(255, 255, 255, 0.05);
  color: #f3f4f6;
  border-color: rgba(255, 255, 255, 0.05);
}

.nav-item.active {
  background-color: rgba(214, 0, 0, 0.1);
  color: #fff;
  border-color: rgba(214, 0, 0, 0.2);
}

.nav-item.active::before {
  content: '';
  position: absolute;
  left: -12px;
  top: 25%;
  bottom: 25%;
  width: 4px;
  background-color: #d60000;
  border-radius: 0 4px 4px 0;
  box-shadow: 0 0 10px rgba(214, 0, 0, 0.5);
}

.nav-icon-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.5rem;
  flex-shrink: 0;
}

.nav-text {
  margin-left: 0.875rem;
  font-size: 0.875rem;
  font-weight: 500;
  white-space: nowrap;
  transition: opacity 0.2s;
}

.nav-text.collapsed {
  opacity: 0;
  width: 0;
  display: none;
}

/* Divider */
.nav-section-divider {
  display: flex;
  align-items: center;
  padding: 1.25rem 0.75rem 0.5rem;
  font-size: 0.65rem;
  font-weight: 800;
  color: #4b5563;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

/* Tooltips */
.nav-tooltip {
  position: absolute;
  left: 100%;
  margin-left: 1rem;
  padding: 0.5rem 0.75rem;
  background-color: #151515;
  color: white;
  font-size: 0.75rem;
  font-weight: 600;
  border-radius: 0.5rem;
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.5);
  white-space: nowrap;
  pointer-events: none;
  opacity: 0;
  transform: translateX(-10px);
  transition: all 0.2s;
  z-index: 100;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.group:hover .nav-tooltip {
  opacity: 1;
  transform: translateX(0);
}

/* Badges */
.nav-badge {
  position: absolute;
  right: 0.75rem;
  background-color: #f59e0b;
  color: #000;
  font-size: 10px;
  font-weight: 900;
  border-radius: 6px;
  height: 18px;
  min-width: 18px;
  padding: 0 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 0 10px rgba(245, 158, 11, 0.3);
}

.badge-collapsed {
  top: -4px;
  right: -4px;
}

/* Sub-navigation */
.sub-nav-container {
  margin-top: 0.25rem;
  margin-left: 2.5rem;
  margin-right: 0.5rem;
  padding-left: 0.75rem;
  border-left: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.sub-nav-item {
  padding: 0.5rem 0.75rem;
  font-size: 0.8rem;
  font-weight: 500;
  color: #6b7280;
  border-radius: 0.5rem;
  transition: all 0.2s;
}

.sub-nav-item:hover {
  color: #f3f4f6;
  background-color: rgba(255, 255, 255, 0.05);
}

.sub-active {
  color: #22d3ee;
  font-weight: 700;
  background-color: rgba(34, 211, 238, 0.05);
}

/* Transition expand */
.expand-enter-active,
.expand-leave-active {
  transition: all 0.3s ease-in-out;
  max-height: 200px;
  overflow: hidden;
}

.expand-enter-from,
.expand-leave-to {
  max-height: 0;
  opacity: 0;
}

.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}

.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
  background-color: #4b5563;
  border-radius: 10px;
}
</style>
