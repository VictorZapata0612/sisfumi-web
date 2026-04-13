<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { usePermissionsStore, type PermissionVisit } from '@/stores/permissions'
import { useDialog } from '@/composables/useDialog'
import { useToast } from '@/composables/useToast'
import PermissionDetailModal from '@/components/PermissionDetailModal.vue'

defineOptions({ name: 'PermissionsView' })

const permissionsStore = usePermissionsStore()
const { showDialog } = useDialog()
const { showToast } = useToast()

const showDetailModal = ref(false)
const selectedVisit = ref<PermissionVisit | null>(null)
const filterStatus = ref('Todos') // 'Todos', 'Pendiente', 'Aprobado', 'Rechazado'
const searchTerm = ref('') // Nuevo estado para el término de búsqueda
const sortKey = ref('fecha_visita') // Columna por defecto para ordenar
const sortOrder = ref('desc') // Dirección por defecto

onMounted(() => {
  permissionsStore.fetchPendingVisits()
})

const handleApprove = async (visitId: string, notes: string) => {
  try {
    await permissionsStore.approvePermission(visitId, notes)
    showToast({ title: 'Éxito', message: 'Permiso aprobado correctamente.', type: 'success' })
    showDetailModal.value = false
  } catch (error: any) {
    showToast({
      title: 'Error',
      message: `No se pudo aprobar: ${error.message}`,
      type: 'error',
    })
  }
}

const handleReject = async (visitId: string, reason: string) => {
  try {
    await permissionsStore.rejectPermission(visitId, reason)
    showToast({ title: 'Éxito', message: 'Permiso rechazado.', type: 'success' })
  } catch (error: any) {
    showToast({ title: 'Error', message: `No se pudo rechazar: ${error.message}`, type: 'error' })
  } finally {
    showDetailModal.value = false
  }
}

const openDetails = (visit: PermissionVisit) => {
  selectedVisit.value = visit
  showDetailModal.value = true
}

const sortBy = (key: string) => {
  if (sortKey.value === key) {
    sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortKey.value = key
    sortOrder.value = 'asc'
  }
}

const formatDate = (dateString: string | null) => {
  if (!dateString) return 'N/A'
  return new Date(dateString).toLocaleDateString('es-CO', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

const getStatusInfo = (visit: PermissionVisit) => {
  if (visit.gestionPermiso.aprobado) {
    return {
      text: 'Aprobado',
      color: 'bg-green-900/50 text-green-300 border border-green-700',
      icon: 'fas fa-check-double',
    }
  }
  if (visit.gestionPermiso.estado === 'rechazado') {
    return {
      text: 'Rechazado',
      color: 'bg-red-900/50 text-red-300 border border-red-700',
      icon: 'fas fa-times-circle'
    }
  }
  return {
    text: 'Pendiente',
    color: 'bg-yellow-900/50 text-yellow-300 border border-yellow-700',
    icon: 'fas fa-hourglass-half',
  }
}

const filteredVisits = computed(() => {
  let visits = permissionsStore.pendingVisits || [] // Ensure array

  // 1. Filtrar por estado
  if (filterStatus.value !== 'Todos') {
    visits = visits.filter((visit) => {
      const statusInfo = getStatusInfo(visit)
      return statusInfo.text === filterStatus.value
    })
  }

  // 2. Filtrar por término de búsqueda
  if (searchTerm.value.trim()) {
    const term = searchTerm.value.toLowerCase().trim()
    visits = visits.filter(
      (visit) =>
        visit.nombre_cliente.toLowerCase().includes(term) ||
        visit.tipo_visita.toLowerCase().includes(term) ||
        (visit.zona && visit.zona.toLowerCase().includes(term)),
    )
  }

  // 3. Ordenar los resultados
  const key = sortKey.value
  if (key) {
    visits.sort((a, b) => {
      let valA: any
      let valB: any

      if (key === 'estado') {
        valA = getStatusInfo(a).text
        valB = getStatusInfo(b).text
      } else if (key === 'fecha_visita') {
        valA = a.fecha_visita ? new Date(a.fecha_visita).getTime() : 0
        valB = b.fecha_visita ? new Date(b.fecha_visita).getTime() : 0
      } else {
        valA = a[key as keyof PermissionVisit] || ''
        valB = b[key as keyof PermissionVisit] || ''
      }

      const comparison = valA > valB ? 1 : valA < valB ? -1 : 0
      return sortOrder.value === 'asc' ? comparison : -comparison
    })
  }

  return visits
})
</script>

<template>
  <div class="h-full bg-[#0a0a0a] text-gray-100 flex flex-col p-4 md:p-6 overflow-hidden">
    <!-- Header -->
    <header class="flex-shrink-0 mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
      <div>
        <h2 class="text-2xl md:text-3xl font-bold text-white flex items-center gap-2">
          <i class="fas fa-user-check text-indigo-500"></i>
          Gestión de Permisos
        </h2>
        <p class="text-sm text-gray-400 mt-1">Autorización y control de visitas especiales</p>
      </div>

      <div class="flex gap-2">
        <button @click="permissionsStore.fetchPendingVisits" class="btn btn-secondary bg-white/5 hover:bg-white/10 !p-2"
          title="Recargar">
          <i class="fas fa-sync-alt"></i>
        </button>
      </div>
    </header>

    <!-- Main Card -->
    <div class="flex-grow flex flex-col bg-[#151515] rounded-xl border border-white/10 shadow-xl overflow-hidden">

      <!-- Toolbar -->
      <div
        class="p-4 border-b border-white/10 bg-[#0a0a0a]/30 flex flex-col md:flex-row gap-4 justify-between items-center">

        <!-- Filters (Pills) -->
        <div class="flex flex-wrap gap-2 w-full md:w-auto">
          <button v-for="status in ['Todos', 'Pendiente', 'Aprobado', 'Rechazado']" :key="status"
            @click="filterStatus = status" class="px-3 py-1.5 rounded-full text-xs font-bold transition-all border"
            :class="filterStatus === status
              ? 'bg-[#d60000] border-[#d60000] text-white shadow-md'
              : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-white'">
            {{ status }}
          </button>
        </div>

        <!-- Search -->
        <div class="relative w-full md:w-72">
          <i class="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs"></i>
          <input v-model="searchTerm" type="text" placeholder="Buscar cliente, zona..."
            class="w-full bg-[#0a0a0a] border border-white/10 rounded-lg py-2 pl-9 pr-4 text-sm focus:ring-2 focus:ring-[#d60000] focus:border-transparent placeholder-gray-500 text-white" />
        </div>
      </div>

      <!-- Content Area -->
      <div class="flex-grow overflow-y-auto custom-scrollbar relative p-4 bg-[#151515]">

        <!-- Loading State -->
        <div v-if="permissionsStore.loading" class="space-y-4 p-2">
          <div v-for="n in 5" :key="n"
            class="bg-white/5 rounded-lg border border-white/10 p-4 animate-pulse flex justify-between items-center">
            <div class="space-y-2 w-1/2">
              <div class="h-4 bg-white/10 rounded w-3/4"></div>
              <div class="h-3 bg-white/10 rounded w-1/2"></div>
            </div>
            <div class="h-6 bg-white/10 rounded-full w-20"></div>
            <div class="h-8 bg-white/10 rounded w-8"></div>
          </div>
        </div>

        <!-- Error State -->
        <div v-else-if="permissionsStore.error" class="h-full flex flex-col items-center justify-center text-red-400">
          <i class="fas fa-exclamation-circle text-4xl mb-2"></i>
          <p>{{ permissionsStore.error }}</p>
        </div>

        <!-- Empty State -->
        <div v-else-if="filteredVisits.length === 0"
          class="h-full flex flex-col items-center justify-center text-gray-500 opacity-60">
          <i class="fas fa-clipboard-check text-6xl mb-4"></i>
          <p class="text-lg">No hay solicitudes para mostrar.</p>
        </div>

        <div v-else>
          <!-- Mobile View (Cards) -->
          <div class="md:hidden space-y-4">
            <div v-for="visit in filteredVisits" :key="visit.id"
              class="bg-white/5 rounded-lg border border-white/10 p-4 shadow-sm">
              <div class="flex justify-between items-start mb-3">
                <div>
                  <h3 class="font-bold text-white text-lg">{{ visit.nombre_cliente }}</h3>
                  <p class="text-xs text-indigo-300 font-bold uppercase tracking-wider">{{ visit.tipo_visita }}</p>
                </div>
                <span class="px-2 py-1 text-[10px] font-bold rounded-full border uppercase"
                  :class="getStatusInfo(visit).color">
                  {{ getStatusInfo(visit).text }}
                </span>
              </div>

              <div class="space-y-2 mb-4 text-sm text-gray-300">
                <div class="flex items-center gap-2">
                  <i class="far fa-calendar text-gray-500 w-4"></i>
                  <span>{{ formatDate(visit.fecha_visita) }}</span>
                </div>
                <div class="flex items-center gap-2">
                  <i class="fas fa-map-marker-alt text-gray-500 w-4"></i>
                  <span>{{ visit.zona || 'Zona no especificada' }}</span>
                </div>
              </div>

              <button @click="openDetails(visit)"
                class="w-full btn btn-primary bg-[#d60000] hover:bg-red-700 py-2 text-sm">
                <i class="fas fa-search-plus mr-2"></i> Revisar Solicitud
              </button>
            </div>
          </div>

          <!-- Desktop View (Table) -->
          <table class="hidden md:table min-w-full divide-y divide-white/5">
            <thead class="bg-[#0a0a0a]/50 sticky top-0 z-10">
              <tr>
                <th @click="sortBy('nombre_cliente')"
                  class="px-6 py-3 text-left text-xs font-bold text-gray-400 uppercase tracking-wider cursor-pointer hover:text-white transition-colors group">
                  Cliente
                  <i class="fas ml-1 text-gray-600 group-hover:text-gray-400"
                    :class="sortKey === 'nombre_cliente' ? (sortOrder === 'asc' ? 'fa-sort-up' : 'fa-sort-down') : 'fa-sort'"></i>
                </th>
                <th @click="sortBy('tipo_visita')"
                  class="px-6 py-3 text-left text-xs font-bold text-gray-400 uppercase tracking-wider cursor-pointer hover:text-white transition-colors group">
                  Servicio
                  <i class="fas ml-1 text-gray-600 group-hover:text-gray-400"
                    :class="sortKey === 'tipo_visita' ? (sortOrder === 'asc' ? 'fa-sort-up' : 'fa-sort-down') : 'fa-sort'"></i>
                </th>
                <th @click="sortBy('fecha_visita')"
                  class="px-6 py-3 text-left text-xs font-bold text-gray-400 uppercase tracking-wider cursor-pointer hover:text-white transition-colors group">
                  Fecha Programada
                  <i class="fas ml-1 text-gray-600 group-hover:text-gray-400"
                    :class="sortKey === 'fecha_visita' ? (sortOrder === 'asc' ? 'fa-sort-up' : 'fa-sort-down') : 'fa-sort'"></i>
                </th>
                <th @click="sortBy('estado')"
                  class="px-6 py-3 text-center text-xs font-bold text-gray-400 uppercase tracking-wider cursor-pointer hover:text-white transition-colors group">
                  Estado
                  <i class="fas ml-1 text-gray-600 group-hover:text-gray-400"
                    :class="sortKey === 'estado' ? (sortOrder === 'asc' ? 'fa-sort-up' : 'fa-sort-down') : 'fa-sort'"></i>
                </th>
                <th @click="sortBy('zona')"
                  class="px-6 py-3 text-left text-xs font-bold text-gray-400 uppercase tracking-wider cursor-pointer hover:text-white transition-colors group">
                  Zona
                  <i class="fas ml-1 text-gray-600 group-hover:text-gray-400"
                    :class="sortKey === 'zona' ? (sortOrder === 'asc' ? 'fa-sort-up' : 'fa-sort-down') : 'fa-sort'"></i>
                </th>
                <th class="px-6 py-3 text-center text-xs font-bold text-gray-400 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-white/5 bg-[#151515]">
              <tr v-for="visit in filteredVisits" :key="visit.id" class="hover:bg-white/5 transition-colors">
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="text-sm font-bold text-white">{{ visit.nombre_cliente }}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <span class="text-xs font-mono text-indigo-300 bg-indigo-900/30 px-2 py-1 rounded">{{
                    visit.tipo_visita }}</span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                  {{ formatDate(visit.fecha_visita) }}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-center">
                  <span class="px-2 py-1 inline-flex text-[10px] leading-tight font-bold rounded-full uppercase border"
                    :class="getStatusInfo(visit).color">
                    <i :class="getStatusInfo(visit).icon" class="mr-1.5"></i>
                    {{ getStatusInfo(visit).text }}
                  </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                  {{ visit.zona || 'N/A' }}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-center">
                  <button @click="openDetails(visit)"
                    class="text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 p-2 rounded-lg transition-colors"
                    title="Revisar">
                    <i class="fas fa-eye"></i>
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Modals -->
    <PermissionDetailModal :show="showDetailModal" :visit="selectedVisit" @close="showDetailModal = false"
      @approve="handleApprove" @reject="handleReject" />
  </div>
</template>
