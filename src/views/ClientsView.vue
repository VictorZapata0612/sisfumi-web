<script setup lang="ts">
import { onMounted, onUnmounted, ref, computed, reactive, defineAsyncComponent } from 'vue'
import { useClientsStore } from '@/stores/clients'
import { useAuthStore } from '@/stores/auth'
import { useDialog } from '@/composables/useDialog'
import { useRoute } from 'vue-router'
import { httpsCallable } from 'firebase/functions'
import { functions } from '@/firebase/config'

const authStore = useAuthStore()
const clientsStore = useClientsStore()
const route = useRoute()

const ClientFormModal = defineAsyncComponent(() => import('@/components/ClientFormModal.vue'))
const ClientImportExportModal = defineAsyncComponent(() => import('@/components/ClientImportExportModal.vue'))

// Referencias para los filtros
const searchTerm = ref('')
const statusFilter = ref('Activo')

// Estado de paginación local
const pagination = reactive({
  currentPage: 1,
  isLastPage: false,
  pageHistory: [null] as (string | null)[],
})

// Estado para los modales
const showProfileModal = ref(false)
const showFormModal = ref(false)
const showImportModal = ref(false)
const editingClientId = ref<string | null>(null)
const { showDialog } = useDialog()
const loadMoreTrigger = ref<HTMLElement | null>(null)

// Propiedad computada para acceder fácilmente al perfil del cliente
const profile = computed(() => clientsStore.selectedClientProfile)

const canChangeZone = computed(() => {
  const allowedRoles = ['Administrador', 'Jefe', 'Coordinador Nacionales', 'Coordinador Nacional', 'Gerente']
  return allowedRoles.includes(authStore.userRole || '')
})

const viewClientProfile = (clientId: string) => {
  clientsStore.fetchClientProfile(clientId)
  showProfileModal.value = true
}

const initializeFilters = () => {
  if (!canChangeZone.value) {
    statusFilter.value = 'Activo' // Forzar a ver solo activos
  }
}
const fetchNextBatch = async () => {
  clientsStore.loading = true
  try {
    const getClientsPage = httpsCallable(functions, 'getClientsPage')
    const result = await getClientsPage({
      status: statusFilter.value === 'Todos' ? undefined : statusFilter.value,
      searchTerm: searchTerm.value || undefined,
      startAfterDocId: pagination.pageHistory[pagination.currentPage - 1],
    })

    const newClients = (result.data as { clients: any[] }).clients
    // Append instead of replace for infinite scroll
    if (pagination.currentPage === 1) {
      clientsStore.clients = newClients
    } else {
      clientsStore.clients.push(...newClients)
    }

    if (newClients.length > 0) {
      const lastId = newClients[newClients.length - 1].id
      if (pagination.pageHistory.length === pagination.currentPage) {
        pagination.pageHistory.push(lastId)
      }
    }
    pagination.isLastPage = newClients.length < 12 // Asumiendo PAGE_SIZE = 12
  } catch (error: any) {
    clientsStore.error = 'No se pudieron cargar los clientes. ' + error.message
  } finally {
    clientsStore.loading = false
  }
}

const resetAndFetch = () => {
  pagination.currentPage = 1
  pagination.pageHistory = [null]
  fetchNextBatch()
}

const openCreateModal = () => {
  editingClientId.value = null
  showFormModal.value = true
}

const openEditModal = (clientId: string) => {
  editingClientId.value = clientId
  showProfileModal.value = false // Cerramos el de perfil
  showFormModal.value = true
}

const handleClientSave = () => {
  showFormModal.value = false
  // Idealmente, aquí usarías un toast no bloqueante. Por ahora, lo omitimos.
  resetAndFetch()
}

const handleInactive = async (clientId: string | null) => {
  if (!clientId) return
  showDialog({
    title: 'Confirmar Inactivación',
    message:
      '¿Está seguro de que desea marcar este cliente como "Inactivo"? Se ocultará de las listas principales.',
    isConfirmation: true,
    confirmationText: 'Sí, Inactivar',
    async onConfirm() {
      try {
        await clientsStore.updateClientStatus(clientId, 'Inactivo')
        showFormModal.value = false
        handleClientSave()
      } catch (error: any) {
        showDialog({ title: 'Error', message: error.message, onConfirm: () => { } })
      }
    },
  })
}

const handlePermanentDelete = async (clientId: string | null) => {
  if (!clientId) return
  showDialog({
    title: '¡ACCIÓN IRREVERSIBLE!',
    message: `Está a punto de eliminar permanentemente este cliente y todos sus datos. Esta acción no se puede deshacer. <br><br> Escriba <strong>ELIMINAR</strong> para confirmar.`,
    isConfirmation: true,
    confirmationText: 'Eliminar Permanentemente',
    confirmationKeyword: 'ELIMINAR',
    async onConfirm() {
      try {
        await clientsStore.deleteClient(clientId)
        showFormModal.value = false
        handleClientSave()
      } catch (error: any) {
        showDialog({ title: 'Error', message: error.message, onConfirm: () => { } })
      }
    },
  })
}

let observer: IntersectionObserver

onMounted(() => {
  // Si se pasa un filtro de ciudad en la URL (desde el dashboard)
  if (route.query.cityFilter) {
    searchTerm.value = route.query.cityFilter as string
  }

  initializeFilters()
  resetAndFetch()

  // Infinite Scroll Observer
  observer = new IntersectionObserver((entries) => {
    const entry = entries[0]
    if (entry?.isIntersecting && !clientsStore.loading && !pagination.isLastPage) {
      pagination.currentPage++
      fetchNextBatch()
    }
  }, { rootMargin: '100px' })

  if (loadMoreTrigger.value) observer.observe(loadMoreTrigger.value)
})

onUnmounted(() => {
  if (observer) observer.disconnect()
})

const handleFilterChange = () => {
  resetAndFetch()
}

let searchTimeout: number
const handleSearch = () => {
  clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => {
    resetAndFetch()
  }, 400)
}
</script>

<template>
  <main class="p-4 md:p-8 overflow-y-auto min-h-screen bg-[#0a0a0a] text-gray-100">
    <!-- Header: Responsive (Columna en móvil, Fila en PC) -->
    <header class="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
      <div>
        <h1 class="text-2xl md:text-3xl font-bold text-white">Gestión de Clientes</h1>
        <p class="text-sm text-gray-400 mt-1">Administra tu cartera y contactos</p>
      </div>

      <!-- Botonera: Stack en móvil -->
      <div class="flex flex-wrap items-center gap-2 w-full md:w-auto">
        <button @click="showImportModal = true" class="btn btn-secondary flex-1 md:flex-none justify-center text-sm">
          <i class="fas fa-file-csv mr-2"></i><span class="hidden sm:inline">Importar / Exportar</span>
        </button>
        <button @click="openCreateModal"
          class="btn btn-primary bg-[#d60000] hover:bg-red-700 w-full md:w-auto mt-2 md:mt-0 justify-center shadow-lg shadow-red-500/20">
          <i class="fas fa-plus mr-2"></i>Añadir Cliente
        </button>
      </div>
    </header>

    <!-- Filtros: Responsive -->
    <div
      class="flex flex-col md:flex-row items-center gap-4 mb-6 bg-[#151515] p-4 rounded-lg border border-white/10 shadow-lg">
      <div class="relative flex-grow w-full">
        <i class="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
        <input v-model="searchTerm" @input="handleSearch" type="search"
          placeholder="Buscar por nombre, ciudad o zona..."
          class="w-full pl-10 pr-3 py-2 text-white bg-[#0a0a0a] border border-white/10 rounded-md focus:outline-none focus:ring-2 focus:ring-[#d60000] placeholder-gray-500" />
      </div>
      <div v-if="canChangeZone">
        <select v-model="statusFilter" @change="handleFilterChange"
          class="w-full md:w-48 text-white bg-[#0a0a0a] border border-white/10 rounded-md focus:outline-none focus:ring-2 focus:ring-[#d60000] px-3 py-2">
          <option value="Todos">Todos los Estados</option>
          <option value="Activo">Activo</option>
          <option value="Inactivo">Inactivo</option>
        </select>
      </div>
    </div>

    <!-- Estados de Carga y Error -->
    <div v-if="clientsStore.loading" class="grid grid-cols-1 md:grid-cols-4 gap-6">
      <div v-for="i in 8" :key="i"
        class="bg-[#151515] p-4 rounded-lg shadow-lg animate-pulse h-32 border border-white/10"></div>
    </div>

    <div v-else-if="clientsStore.error"
      class="text-center text-red-400 p-8 bg-[#151515] rounded-lg border border-red-900/50">
      <i class="fas fa-exclamation-triangle text-4xl mb-4"></i>
      <p>Error: {{ clientsStore.error }}</p>
    </div>

    <div v-else-if="clientsStore.clients.length === 0" class="text-center text-gray-500 py-16">
      <i class="fas fa-folder-open text-5xl mb-4 opacity-50"></i>
      <p>No se encontraron clientes que coincidan con los filtros.</p>
    </div>

    <!-- CONTENIDO PRINCIPAL -->
    <div v-else>
      <!-- VISTA MÓVIL (Cards): Visible solo en pantallas pequeñas (< md) -->
      <div class="md:hidden grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div v-for="client in clientsStore.clients" :key="client.id" @click="viewClientProfile(client.id)"
          class="bg-[#151515] p-5 rounded-lg shadow-md border border-white/10 active:bg-white/5 transition-colors cursor-pointer">
          <div class="flex justify-between items-start mb-3">
            <h3 class="font-bold text-lg text-white truncate max-w-[70%]">
              {{ client.nombreComercial }}
            </h3>
            <span class="text-xs font-bold px-2 py-1 rounded-full" :class="client.estado === 'Activo'
              ? 'bg-green-500/20 text-green-300'
              : 'bg-red-500/20 text-red-300'
              ">
              {{ client.estado }}
            </span>
          </div>
          <div class="space-y-1 text-sm text-gray-400">
            <p class="flex items-center">
              <i class="fas fa-map-marker-alt w-5 text-center mr-1"></i>
              {{ client.ciudad || 'Sin ciudad' }}
            </p>
            <p class="flex items-center">
              <i class="fas fa-map w-5 text-center mr-1"></i> {{ client.zona || 'Sin zona' }}
            </p>
          </div>
          <div class="mt-4 pt-3 border-t border-white/10 text-center">
            <span class="text-cyan-400 text-sm font-medium">Ver Perfil</span>
          </div>
        </div>
      </div>

      <!-- VISTA DE ESCRITORIO (Tabla): Visible solo en pantallas medianas y grandes (>= md) -->
      <div class="hidden md:block bg-[#151515] rounded-xl border border-white/10 shadow-xl overflow-hidden">
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-white/5">
            <thead class="bg-[#0a0a0a]/50">
              <tr>
                <th scope="col" class="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Cliente / Razón Social
                </th>
                <th scope="col" class="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Ubicación
                </th>
                <th scope="col" class="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Estado
                </th>
                <th scope="col"
                  class="px-6 py-4 text-center text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-white/5 bg-[#151515]">
              <tr v-for="client in clientsStore.clients" :key="client.id"
                class="hover:bg-white/5 transition-colors group cursor-pointer" @click="viewClientProfile(client.id)">
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="flex items-center">
                    <div
                      class="flex-shrink-0 h-10 w-10 bg-white/10 rounded-full flex items-center justify-center text-cyan-400 font-bold border border-white/10">
                      {{ client.nombreComercial.charAt(0).toUpperCase() }}
                    </div>
                    <div class="ml-4">
                      <div class="text-sm font-bold text-white group-hover:text-cyan-400 transition-colors">
                        {{ client.nombreComercial }}
                      </div>
                      <div class="text-xs text-gray-500">
                        ID: {{ client.id.substring(0, 8) }}...
                      </div>
                    </div>
                  </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="text-sm text-gray-300">{{ client.ciudad || '---' }}</div>
                  <div class="text-xs text-gray-500">{{ client.zona || 'Sin Zona' }}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <span class="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full" :class="client.estado === 'Activo'
                    ? 'bg-green-900/50 text-green-400'
                    : 'bg-red-900/50 text-red-400'
                    ">
                    {{ client.estado }}
                  </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                  <button @click.stop="viewClientProfile(client.id)"
                    class="text-cyan-400 hover:text-cyan-300 bg-white/5 hover:bg-white/10 p-2 rounded-lg transition-all"
                    title="Ver Perfil">
                    <i class="fas fa-eye"></i>
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Infinite Scroll Trigger -->
    <div ref="loadMoreTrigger" class="h-10 mt-4 flex justify-center items-center">
      <div v-if="clientsStore.loading && pagination.currentPage > 1" class="text-cyan-500">
        <i class="fas fa-circle-notch fa-spin"></i> Cargando más...
      </div>
    </div>

    <!-- Modal de Perfil de Cliente -->
    <div v-if="showProfileModal"
      class="fixed inset-0 bg-[#0a0a0a]/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div
        class="bg-[#151515] p-4 md:p-8 rounded-lg shadow-xl w-full max-w-5xl relative max-h-[90vh] flex flex-col border border-white/10">
        <button @click="showProfileModal = false"
          class="absolute top-4 right-4 text-gray-400 hover:text-white text-2xl transition-colors z-10">
          &times;
        </button>

        <!-- Contenido del Modal -->
        <div v-if="clientsStore.loadingProfile" class="text-center text-gray-400 py-12">
          <i class="fas fa-spinner fa-spin text-4xl text-cyan-500"></i>
          <p class="mt-4">Cargando perfil completo...</p>
        </div>

        <div v-else-if="profile" class="flex-grow overflow-y-auto custom-scrollbar -mr-4 pr-4">
          <!-- Header Perfil -->
          <div class="flex flex-col md:flex-row items-start mb-8 pb-6 border-b border-white/10 gap-4">
            <div class="bg-white/5 p-4 rounded-xl hidden md:block">
              <i class="fas fa-building text-4xl text-cyan-400"></i>
            </div>
            <div class="flex-grow">
              <h2 class="text-2xl md:text-3xl font-bold text-white">
                {{ profile.client.nombreComercial }}
              </h2>
              <div class="flex items-center gap-2 mt-1 text-gray-400">
                <i class="fas fa-map-marker-alt text-sm"></i>
                <p>{{ profile.client.ciudad }}, {{ profile.client.departamento }}</p>
              </div>
              <div class="mt-3">
                <span class="text-xs font-bold px-3 py-1 rounded-full border" :class="profile.client.estado === 'Activo'
                  ? 'bg-green-500/10 text-green-400 border-green-500/30'
                  : 'bg-red-500/10 text-red-400 border-red-500/30'
                  ">
                  {{ profile.client.estado }}
                </span>
              </div>
            </div>
            <button @click="openEditModal(profile.client.id)" class="btn btn-secondary w-full md:w-auto mt-2 md:mt-0">
              <i class="fas fa-edit mr-2"></i>Editar Cliente
            </button>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-8">
            <!-- Columna Izquierda -->
            <div class="space-y-8">
              <div>
                <h3 class="text-lg font-bold mb-4 text-cyan-400 border-l-4 border-cyan-500 pl-3">
                  Sucursales y Contactos
                </h3>
                <div class="space-y-3">
                  <div v-for="sucursal in profile.client.sucursales" :key="sucursal.nombre"
                    class="bg-white/5 p-4 rounded-lg border border-white/10">
                    <div class="flex items-start">
                      <i class="fas fa-store text-gray-400 mt-1 mr-3"></i>
                      <div>
                        <p class="font-semibold text-white">{{ sucursal.nombre }}</p>
                        <p class="text-sm text-gray-400">{{ sucursal.direccion }}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                  <div class="bg-white/5 p-3 rounded-lg border border-white/10">
                    <p class="text-xs text-gray-400 uppercase tracking-wider mb-1">Principal</p>
                    <p class="font-semibold text-white truncate">
                      <i class="fas fa-user-tie mr-2 text-blue-400"></i>
                      {{ profile.client.contactoPrincipal?.nombre || 'N/A' }}
                    </p>
                  </div>
                  <div class="bg-white/5 p-3 rounded-lg border border-white/10">
                    <p class="text-xs text-gray-400 uppercase tracking-wider mb-1">Financiero</p>
                    <p class="font-semibold text-white truncate">
                      <i class="fas fa-file-invoice-dollar mr-2 text-green-400"></i>
                      {{ profile.client.contactoFinanciero?.nombre || 'N/A' }}
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <h3 class="text-lg font-bold mb-4 text-cyan-400 border-l-4 border-cyan-500 pl-3">
                  Servicios Contratados
                </h3>
                <div class="space-y-2 max-h-60 overflow-y-auto custom-scrollbar pr-2 bg-[#0a0a0a]/30 p-2 rounded-lg">
                  <template v-if="
                    profile.serviceSheet?.services && profile.serviceSheet.services.length > 0
                  ">
                    <div v-for="service in profile.serviceSheet.services as any[]" :key="service.tipo_servicio"
                      class="bg-white/5 p-3 rounded flex justify-between items-center">
                      <span class="font-semibold text-white">{{ service.tipo_servicio }}</span>
                      <span class="text-xs bg-white/10 px-2 py-1 rounded text-gray-300">{{
                        service.frecuencia
                        }}</span>
                    </div>
                  </template>
                  <div v-else class="text-center py-4 text-gray-500">
                    <i class="fas fa-clipboard-list mb-2 block text-2xl"></i>
                    No hay servicios configurados.
                  </div>
                </div>
              </div>
            </div>

            <!-- Columna Derecha -->
            <div class="space-y-8">
              <div>
                <h3 class="text-lg font-bold mb-4 text-cyan-400 border-l-4 border-cyan-500 pl-3">
                  Próximas Visitas
                </h3>
                <div class="space-y-2">
                  <template v-if="profile.upcomingVisits && profile.upcomingVisits.length > 0">
                    <div v-for="visit in profile.upcomingVisits as any[]" :key="visit.id"
                      class="bg-blue-900/20 border border-blue-900/50 p-3 rounded-lg flex justify-between items-center">
                      <div>
                        <p class="font-bold text-blue-100">{{ visit.tipo_visita }}</p>
                        <p class="text-xs text-blue-300">
                          {{
                            new Date(visit.fecha_visita).toLocaleDateString('es-ES', {
                              weekday: 'long',
                              day: 'numeric',
                              month: 'long',
                            })
                          }}
                        </p>
                      </div>
                      <i class="fas fa-calendar-alt text-blue-400"></i>
                    </div>
                  </template>
                  <p v-else class="text-sm text-gray-500 italic bg-[#0a0a0a]/30 p-3 rounded">
                    No hay visitas próximas programadas.
                  </p>
                </div>
              </div>

              <div>
                <h3 class="text-lg font-bold mb-4 text-cyan-400 border-l-4 border-cyan-500 pl-3">
                  Historial Reciente
                </h3>
                <div class="space-y-2 max-h-80 overflow-y-auto custom-scrollbar pr-2">
                  <template v-if="profile.visitHistory && profile.visitHistory.length > 0">
                    <div v-for="visit in profile.visitHistory as any[]" :key="visit.id"
                      class="bg-white/5 p-3 rounded-lg flex justify-between items-center border border-white/10 hover:border-white/20 transition-colors">
                      <div>
                        <p class="font-semibold text-white text-sm">{{ visit.tipo_visita }}</p>
                        <p class="text-xs text-gray-400 mt-1">
                          <i class="fas fa-user-hard-hat mr-1"></i>
                          {{ visit.fumigadores_asignados?.join(', ') || 'N/A' }}
                        </p>
                      </div>
                      <div class="text-right">
                        <span class="text-xs font-bold px-2 py-0.5 rounded" :class="visit.estado_visita === 'Realizada'
                          ? 'bg-green-900/50 text-green-400'
                          : 'bg-yellow-900/50 text-yellow-400'
                          ">
                          {{ visit.estado_visita }}
                        </span>
                        <p class="text-xs text-gray-500 mt-1">
                          {{ new Date(visit.fecha_visita).toLocaleDateString('es-ES') }}
                        </p>
                      </div>
                    </div>
                  </template>
                  <p v-else class="text-sm text-gray-500 italic text-center py-4">
                    No hay historial disponible.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal de Formulario para Crear/Editar -->
    <ClientFormModal :show="showFormModal" :client-id="editingClientId" @close="showFormModal = false"
      @save="handleClientSave" @delete-inactive="handleInactive" @delete-permanent="handlePermanentDelete" />

    <!-- Modal de Importación/Exportación -->
    <ClientImportExportModal :show="showImportModal" @close="showImportModal = false" @refresh="resetAndFetch" />
  </main>
</template>
