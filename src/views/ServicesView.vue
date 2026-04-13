<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useServicesStore, type Service } from '@/stores/services'
import { useAuthStore } from '@/stores/auth'
import ServiceFormModal from '@/components/ServiceFormModal.vue'
import { useToast } from '@/composables/useToast'
import { onClickOutside } from '@vueuse/core'

const servicesStore = useServicesStore()
const authStore = useAuthStore()
const { showToast } = useToast()
const searchTerm = ref('')
const showModal = ref(false)
const editingService = ref<Service | null>(null)
const editingServiceIndex = ref(-1)
const showClientResults = ref(false)
const searchResultsContainer = ref(null)

// Filtro local de clientes
const filteredClients = computed(() => {
  // Si no hay término de búsqueda, mostrar los primeros 10 para no saturar la lista
  if (!searchTerm.value) {
    return servicesStore.clientList.slice(0, 10)
  }
  // Filtrar por nombre comercial (case insensitive)
  return servicesStore.clientList.filter((client) =>
    client.nombreComercial.toLowerCase().includes(searchTerm.value.toLowerCase()),
  )
})

const canApprovePrices = computed(() => {
  return (
    authStore.userRole === 'Administrador' ||
    authStore.userRole === 'Jefe' ||
    authStore.userRole === 'Coordinador Nacionales'
  )
})

onMounted(() => {
  // Aseguramos cargar la lista completa para el buscador local
  servicesStore.fetchClients()
  // Si el usuario tiene permisos, cargamos las solicitudes pendientes
  if (canApprovePrices.value) {
    servicesStore.fetchPendingPriceRequests()
  }
})

// Cerrar dropdown al hacer click fuera
onClickOutside(searchResultsContainer, () => {
  showClientResults.value = false
})

const handleSelectClient = (clientId: string) => {
  servicesStore.fetchServiceSheet(clientId)
  // Actualizar el input con el nombre seleccionado
  const client = servicesStore.clientList.find((c) => c.id === clientId)
  if (client) {
    searchTerm.value = client.nombreComercial
  }
  showClientResults.value = false
}

// Al enfocar, mostramos resultados (o los top 10 si está vacío)
const handleFocus = () => {
  showClientResults.value = true
  if (servicesStore.selectedClient && !searchTerm.value) {
    searchTerm.value = servicesStore.selectedClient.nombreComercial
  }
}

const openCreateModal = () => {
  editingService.value = null
  editingServiceIndex.value = -1
  showModal.value = true
}

const openEditModal = (service: Service, index: number) => {
  editingService.value = service
  editingServiceIndex.value = index
  showModal.value = true
}

const handlePriceRequest = (request: any) => {
  // 1. Seleccionar el cliente
  handleSelectClient(request.clientId)

  // 2. Abrir el modal con el servicio correcto
  // Esperamos un tick para que la ficha de servicio del cliente se cargue
  setTimeout(() => {
    openEditModal(request.service, request.serviceIndex)
  }, 200) // Un pequeño delay para asegurar la carga
}

const handleSaveService = (service: Service, index: number) => {
  servicesStore.upsertService(service, index)
  showModal.value = false
}

const handleDeleteService = (index: number) => {
  servicesStore.deleteService(index)
}

const handleSaveSheet = async () => {
  try {
    await servicesStore.saveServiceSheet()
    showToast({
      title: 'Éxito',
      message: 'Ficha de servicio guardada correctamente.',
      type: 'success',
    })
  } catch (error: any) {
    showToast({
      title: 'Error',
      message: `No se pudo guardar la ficha: ${error.message}`,
      type: 'error',
    })
  }
}
</script>

<template>
  <main class="p-4 md:p-8 h-full flex flex-col overflow-hidden bg-[#0a0a0a] text-gray-100">
    <!-- Header: Flexible -->
    <header class="mb-6 flex-shrink-0 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
      <div>
        <h1 class="text-2xl md:text-3xl font-bold text-white">Gestión de Servicios</h1>
        <p class="text-sm text-gray-400 mt-1">Configura las fichas técnicas por cliente</p>
      </div>

      <!-- Buscador de Clientes -->
      <!-- Corrección Z-Index: Bajamos a z-10 para no tapar el menú lateral -->
      <div class="relative w-full md:w-96 z-10" ref="searchResultsContainer">
        <div class="relative">
          <input v-model="searchTerm" @focus="handleFocus" type="search" id="clientSearchInput"
            class="w-full pl-10 pr-4 py-2.5 bg-[#0a0a0a] border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#d60000] focus:border-[#d60000] transition-all shadow-sm"
            placeholder="Buscar cliente..." autocomplete="off" />
          <i class="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>

          <!-- Botón X para limpiar búsqueda -->
          <button v-if="searchTerm" @click="
            searchTerm = '',
            showClientResults = true
            " class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
            <i class="fas fa-times"></i>
          </button>
        </div>

        <!-- Dropdown de Resultados -->
        <!-- Corrección Z-Index: z-20 es suficiente para estar sobre el contenido pero bajo el menú -->
        <div v-if="showClientResults"
          class="absolute top-full mt-2 w-full bg-[#151515] border border-white/10 rounded-lg shadow-2xl max-h-60 overflow-y-auto custom-scrollbar z-20">
          <div v-if="filteredClients.length > 0">
            <div v-for="client in filteredClients" :key="client.id" @click="handleSelectClient(client.id)"
              class="px-4 py-3 hover:bg-white/5 cursor-pointer border-b border-white/5 last:border-0 transition-colors">
              <p class="font-semibold text-white">{{ client.nombreComercial }}</p>
              <p class="text-xs text-gray-400">{{ client.ciudad || 'Sin ciudad' }}</p>
            </div>
          </div>

          <!-- Estado vacío explícito -->
          <div v-else class="px-4 py-6 text-center text-gray-500">
            <i class="fas fa-search mb-2 text-xl block opacity-50"></i>
            <p class="text-sm">No se encontraron clientes.</p>
          </div>
        </div>
      </div>
    </header>

    <!-- BANDEJA DE SOLICITUDES DE PRECIO (Solo para Admins/Jefes) -->
    <section v-if="canApprovePrices && servicesStore.pendingPriceRequests.length > 0" class="mb-6">
      <div class="bg-yellow-900/10 border border-yellow-700/50 rounded-xl shadow-lg">
        <div class="p-4 border-b border-yellow-700/50 flex items-center gap-3">
          <i class="fas fa-dollar-sign text-yellow-400 text-xl"></i>
          <div>
            <h3 class="font-bold text-white">Solicitudes de Precio Pendientes</h3>
            <p class="text-xs text-yellow-300/80">
              Estos servicios requieren que se les asigne un valor.
            </p>
          </div>
        </div>
        <div class="max-h-48 overflow-y-auto custom-scrollbar p-2">
          <div v-for="request in servicesStore.pendingPriceRequests"
            :key="`${request.serviceSheetId}-${request.serviceIndex}`"
            class="flex justify-between items-center p-2 hover:bg-yellow-900/20 rounded-lg">
            <div class="min-w-0">
              <p class="text-sm font-semibold text-white truncate">{{ request.clientName }}</p>
              <p class="text-xs text-gray-400 truncate">{{ request.service.tipo_servicio }}</p>
            </div>
            <button @click="handlePriceRequest(request)"
              class="btn btn-secondary !py-1 !px-3 text-xs bg-yellow-600 hover:bg-yellow-700 text-white shrink-0 ml-2">
              Asignar Precio
            </button>
          </div>
        </div>
      </div>
    </section>

    <!-- Estado: Ningún Cliente Seleccionado -->
    <div v-if="!servicesStore.selectedClient"
      class="flex-grow flex flex-col items-center justify-center text-gray-500 opacity-60">
      <div class="bg-[#151515] p-6 rounded-full mb-4 animate-pulse">
        <i class="fas fa-hand-pointer text-4xl text-[#d60000]"></i>
      </div>
      <p class="text-lg font-medium">Busca y selecciona un cliente para comenzar.</p>
    </div>

    <!-- Contenedor de la Ficha de Servicio -->
    <section v-else class="flex-grow flex flex-col overflow-hidden">
      <!-- Cabecera del Cliente -->
      <div
        class="flex-shrink-0 mb-6 bg-[#151515] p-4 rounded-xl border border-white/10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-sm">
        <div class="flex items-center gap-3">
          <div
            class="hidden md:flex h-12 w-12 bg-white/5 rounded-lg items-center justify-center text-[#d60000] text-xl">
            <i class="fas fa-file-contract"></i>
          </div>
          <div>
            <p class="text-xs text-gray-400 uppercase tracking-wider">Cliente Seleccionado</p>
            <h3 class="text-xl md:text-2xl font-bold text-white">
              {{ servicesStore.selectedClient.nombreComercial }}
            </h3>
          </div>
        </div>
        <button @click="openCreateModal"
          class="btn btn-primary bg-[#d60000] hover:bg-red-700 w-full md:w-auto flex items-center justify-center shadow-lg">
          <i class="fas fa-plus mr-2"></i>Añadir Servicio
        </button>
      </div>

      <!-- Área de Contenido con Scroll -->
      <div class="flex-grow overflow-y-auto custom-scrollbar pr-2">
        <!-- Loading State -->
        <div v-if="servicesStore.loadingSheet" class="h-full flex items-center justify-center">
          <i class="fas fa-spinner fa-spin text-4xl text-cyan-400"></i>
        </div>

        <!-- Empty State -->
        <div v-else-if="!servicesStore.serviceSheet?.services.length"
          class="h-full flex flex-col items-center justify-center text-gray-500">
          <i class="fas fa-clipboard-list text-6xl mb-4 opacity-20"></i>
          <p>No hay servicios configurados para este cliente.</p>
          <button @click="openCreateModal" class="mt-4 text-[#d60000] hover:text-red-400 underline">
            Crear el primer servicio
          </button>
        </div>

        <div v-else>
          <!-- ========================================== -->
          <!-- VISTA MÓVIL (Cards) - Visible < md -->
          <!-- ========================================== -->
          <div class="md:hidden grid grid-cols-1 gap-4">
            <div v-for="(service, index) in servicesStore.serviceSheet.services" :key="index"
              class="bg-[#151515] p-4 rounded-lg shadow-md border border-white/10 relative">
              <!-- Botones flotantes en la card -->
              <div class="absolute top-3 right-3 flex gap-2">
                <button @click="openEditModal(service, index)"
                  class="p-2 bg-white/5 rounded-full text-gray-400 hover:text-white">
                  <i class="fas fa-pencil-alt text-xs"></i>
                </button>
                <button @click="handleDeleteService(index)"
                  class="p-2 bg-white/5 rounded-full text-gray-400 hover:text-red-400">
                  <i class="fas fa-trash-alt text-xs"></i>
                </button>
              </div>

              <div class="pr-16">
                <h4 class="font-bold text-lg text-white mb-1">{{ service.tipo_servicio }}</h4>
                <div class="flex flex-wrap gap-2 mb-3">
                  <span class="text-xs bg-white/5 px-2 py-1 rounded text-gray-300">
                    <i class="fas fa-clock mr-1"></i> {{ service.frecuencia }}
                  </span>
                  <span class="text-xs px-2 py-1 rounded font-bold" :class="service.estado_servicio === 'Activo'
                      ? 'bg-green-900/50 text-green-400'
                      : 'bg-red-900/50 text-red-400'
                    ">
                    {{ service.estado_servicio }}
                  </span>
                </div>
              </div>

              <div class="flex justify-between items-end border-t border-white/10 pt-3 mt-2">
                <div class="text-xs text-gray-400 max-w-[60%]">
                  <p class="truncate">
                    <i class="fas fa-map-marker-alt mr-1"></i> Sucursales:
                    {{ service.sucursales_asignadas.length }}
                  </p>
                </div>
                <div class="text-right">
                  <p class="text-xs text-gray-500">Valor</p>
                  <p class="font-bold text-white text-lg">
                    {{
                      new Intl.NumberFormat('es-CO', {
                        style: 'currency',
                        currency: 'COP',
                        minimumFractionDigits: 0,
                      }).format(service.valor)
                    }}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <!-- ========================================== -->
          <!-- VISTA ESCRITORIO (Tabla) - Visible >= md -->
          <!-- ========================================== -->
          <div class="hidden md:block bg-[#151515] rounded-lg shadow-lg border border-white/10 overflow-hidden">
            <table class="min-w-full divide-y divide-white/5">
              <thead class="bg-[#0a0a0a]/50">
                <tr>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Servicio
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Frecuencia
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Sucursales
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Estado
                  </th>
                  <th class="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Valor
                  </th>
                  <th class="px-6 py-3 text-center text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-white/5 bg-[#151515]">
                <tr v-for="(service, index) in servicesStore.serviceSheet.services" :key="index"
                  class="hover:bg-white/5 transition-colors">
                  <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm font-bold text-white">{{ service.tipo_servicio }}</div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <span class="px-2 py-1 text-xs rounded bg-white/5 text-gray-300 border border-white/10">
                      {{ service.frecuencia }}
                    </span>
                  </td>
                  <td class="px-6 py-4">
                    <div class="text-sm text-gray-300 truncate max-w-xs"
                      :title="service.sucursales_asignadas.join(', ')">
                      {{
                        service.sucursales_asignadas.length > 0
                          ? service.sucursales_asignadas.join(', ')
                          : 'Todas'
                      }}
                    </div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full" :class="service.estado_servicio === 'Activo'
                        ? 'bg-green-900/50 text-green-400'
                        : 'bg-red-900/50 text-red-400'
                      ">
                      {{ service.estado_servicio }}
                    </span>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-right">
                    <div class="text-sm font-mono font-bold text-white">
                      {{
                        new Intl.NumberFormat('es-CO', {
                          style: 'currency',
                          currency: 'COP',
                          minimumFractionDigits: 0,
                        }).format(service.valor)
                      }}
                    </div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                    <div class="flex justify-center space-x-3">
                      <button @click="openEditModal(service, index)"
                        class="text-gray-400 hover:text-white transition-colors" title="Editar">
                        <i class="fas fa-pencil-alt"></i>
                      </button>
                      <button @click="handleDeleteService(index)"
                        class="text-gray-400 hover:text-red-400 transition-colors" title="Eliminar">
                        <i class="fas fa-trash-alt"></i>
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Botón de Guardado (Sticky Bottom) -->
      <div class="flex-shrink-0 mt-4 pt-4 border-t border-white/10 flex justify-end">
        <button @click="handleSaveSheet" :disabled="!servicesStore.hasUnsavedChanges || servicesStore.savingSheet"
          class="btn btn-primary bg-[#d60000] hover:bg-red-700 w-full md:w-auto py-3 px-6 shadow-xl text-lg md:text-base flex items-center justify-center"
          :class="{
            'opacity-50 cursor-not-allowed':
              !servicesStore.hasUnsavedChanges && !servicesStore.savingSheet,
          }">
          <i v-if="servicesStore.savingSheet" class="fas fa-spinner fa-spin mr-2"></i>
          <i v-else class="fas fa-save mr-2"></i>
          {{ servicesStore.savingSheet ? 'Guardando...' : 'Guardar Cambios' }}
        </button>
      </div>
    </section>

    <!-- Modal -->
    <ServiceFormModal :show="showModal" :service="editingService" :service-index="editingServiceIndex"
      @close="showModal = false" @save="handleSaveService" />
  </main>
</template>
