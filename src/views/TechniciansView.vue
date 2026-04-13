<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useTechniciansStore, type Technician } from '@/stores/technicians'
import { useAuthStore } from '@/stores/auth'
import { useDialog } from '@/composables/useDialog'
import { useToast } from '@/composables/useToast'
import TechnicianFormModal from '@/components/TechnicianFormModal.vue'
import TechnicianProfileModal from '@/components/TechnicianProfileModal.vue'
import { useRoute, useRouter } from 'vue-router'

const techniciansStore = useTechniciansStore()
const authStore = useAuthStore()
const { showDialog } = useDialog()
const { showToast } = useToast()
const route = useRoute()
const router = useRouter()

const zoneFilter = ref('Todos')
const searchTerm = ref('')
let searchTimeout: number

const showFormModal = ref(false)
const editingTechnician = ref<Technician | null>(null)

const showProfileModal = ref(false)
const viewingTechnicianId = ref<string | null>(null)

const googleCalendarColors: Record<string, string> = {
  '1': '#7986cb', // Lavanda
  '2': '#33b679', // Salvia
  '3': '#8e24aa', // Uva
  '4': '#e67c73', // Flamenco
  '5': '#f6c026', // Plátano
  '6': '#f5511d', // Mandarina
  '7': '#039be5', // Pavo real
  '8': '#616161', // Grafito
  '9': '#3f51b5', // Arándano
  '10': '#0b8043', // Albahaca
  '11': '#d60000', // Tomate
}

const fetchData = (direction: 'next' | 'prev' | 'reset' = 'reset') => {
  techniciansStore.fetchTechnicians({
    zoneFilter: zoneFilter.value === 'Todos' ? null : zoneFilter.value,
    searchTerm: searchTerm.value,
    direction,
  })
}

onMounted(() => {
  fetchData()
  if (route.query.itemIdToOpen) {
    openProfileModal(route.query.itemIdToOpen as string)
    router.replace({ query: { ...route.query, itemIdToOpen: undefined } })
  }
})

watch([zoneFilter, searchTerm], () => {
  clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => fetchData('reset'), 300)
})

const openCreateModal = () => {
  editingTechnician.value = null
  showFormModal.value = true
}

const openEditModal = (technician: Technician) => {
  editingTechnician.value = technician
  showFormModal.value = true
  showProfileModal.value = false
}

const openProfileModal = (technicianId: string) => {
  viewingTechnicianId.value = technicianId
  showProfileModal.value = true
}

const handleSave = async (technician: Omit<Technician, 'id'> & { id?: string }) => {
  try {
    if (technician.id) {
      await techniciansStore.updateTechnician(technician.id, technician)
      showToast({ title: 'Éxito', message: 'Técnico actualizado.', type: 'success' })
    } else {
      await techniciansStore.addTechnician(technician)
      showToast({ title: 'Éxito', message: 'Técnico creado.', type: 'success' })
    }
    showFormModal.value = false
    fetchData('reset')
  } catch (error: any) {
    showToast({ title: 'Error', message: `No se pudo guardar: ${error.message}`, type: 'error' })
  }
}

const handleDelete = async (technicianId: string) => {
  await showDialog({
    title: 'Confirmar Eliminación',
    message: '¿Está seguro de que desea eliminar este técnico? Esta acción no se puede deshacer.',
    isConfirmation: true,
    onConfirm: async () => {
      try {
        await techniciansStore.deleteTechnician(technicianId)
        showToast({ title: 'Éxito', message: 'Técnico eliminado.', type: 'success' })
        showFormModal.value = false
        fetchData('reset')
      } catch (error: any) {
        showToast({
          title: 'Error',
          message: `No se pudo eliminar: ${error.message}`,
          type: 'error',
        })
      }
    },
  })
}
</script>

<template>
  <main class="p-4 md:p-8 min-h-screen bg-[#0a0a0a] text-gray-100 flex flex-col">
    <!-- Header -->
    <header class="mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
      <div>
        <h2 class="text-2xl md:text-3xl font-bold text-white">Gestión de Técnicos</h2>
        <p class="text-sm text-gray-400 mt-1">Administra tu equipo de trabajo y sus zonas</p>
      </div>
      <button @click="openCreateModal"
        class="btn btn-primary bg-[#d60000] hover:bg-red-700 w-full md:w-auto justify-center shadow-lg">
        <i class="fas fa-user-plus mr-2"></i>Registrar Técnico
      </button>
    </header>

    <!-- Filtros -->
    <div
      class="bg-[#151515] p-4 rounded-xl border border-white/10 shadow-sm mb-6 flex flex-col md:flex-row gap-4 items-center">
      <div class="relative flex-grow w-full">
        <i class="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
        <input v-model="searchTerm" type="text" placeholder="Buscar técnico por nombre..."
          class="w-full pl-10 pr-4 py-2.5 bg-[#0a0a0a] border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#d60000] focus:border-transparent" />
      </div>

      <div v-if="authStore.userRole === 'Administrador' || authStore.userRole === 'Jefe'"
        class="w-full md:w-auto flex flex-nowrap overflow-x-auto gap-2 pb-2 md:pb-0">
        <button v-for="zone in ['Todos', 'Norte de Santander', 'Valle del Cauca', 'Nacionales']" :key="zone"
          @click="zoneFilter = zone" class="btn btn-sm whitespace-nowrap"
          :class="zoneFilter === zone ? 'btn-primary bg-[#d60000]' : 'bg-white/5 text-gray-300 hover:text-white hover:bg-white/10'">
          {{ zone }}
        </button>
      </div>
    </div>

    <!-- Contenido Principal -->
    <div class="flex-grow">

      <!-- Loading State -->
      <div v-if="techniciansStore.loading" class="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div v-for="n in 8" :key="n"
          class="bg-[#151515] p-4 rounded-xl shadow-lg animate-pulse h-32 border border-white/10"></div>
      </div>

      <!-- Empty State -->
      <div v-else-if="techniciansStore.technicians.length === 0" class="text-center py-16 text-gray-500">
        <div class="bg-[#151515] p-6 rounded-full inline-block mb-4">
          <i class="fas fa-users-slash text-4xl opacity-50"></i>
        </div>
        <p class="text-lg">No se encontraron técnicos con los filtros actuales.</p>
        <button @click="zoneFilter = 'Todos'; searchTerm = ''" class="mt-4 text-[#d60000] hover:underline">
          Limpiar filtros
        </button>
      </div>

      <div v-else>
        <!-- ========================================== -->
        <!-- VISTA MÓVIL (Cards) - Visible < md -->
        <!-- ========================================== -->
        <div class="md:hidden grid grid-cols-1 gap-4">
          <div v-for="tech in techniciansStore.technicians" :key="tech.id" @click="openProfileModal(tech.id)"
            class="bg-[#151515] p-5 rounded-xl shadow-md border-l-4 border-white/10 hover:border-l-8 transition-all cursor-pointer relative overflow-hidden group"
            :style="{ borderLeftColor: googleCalendarColors[tech.googleColorId || '8'] }">
            <div class="flex justify-between items-start">
              <div>
                <h3 class="font-bold text-lg text-white group-hover:text-[#d60000] transition-colors">{{
                  tech.nombreCompleto }}</h3>
                <div class="flex items-center gap-2 mt-1 text-sm text-gray-400">
                  <i class="fas fa-map-marker-alt text-xs"></i>
                  <span>{{ tech.zona }}</span>
                </div>
              </div>
              <div class="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-sm"
                :style="{ backgroundColor: googleCalendarColors[tech.googleColorId || '8'] }">
                {{ tech.nombreCompleto.charAt(0).toUpperCase() }}
              </div>
            </div>

            <div class="mt-4 pt-3 border-t border-white/10 flex justify-between items-center">
              <span class="text-xs text-gray-500">ID: ...{{ tech.id.slice(-6) }}</span>
              <button class="text-[#d60000] text-sm font-medium flex items-center">
                Ver Perfil <i class="fas fa-chevron-right ml-1 text-xs"></i>
              </button>
            </div>
          </div>
        </div>

        <!-- ========================================== -->
        <!-- VISTA ESCRITORIO (Tabla) - Visible >= md -->
        <!-- ========================================== -->
        <div class="hidden md:block bg-[#151515] rounded-xl border border-white/10 shadow-xl overflow-hidden">
          <table class="min-w-full divide-y divide-white/5">
            <thead class="bg-[#0a0a0a]/50">
              <tr>
                <th scope="col" class="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Técnico</th>
                <th scope="col" class="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Zona</th>
                <th scope="col" class="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Color Calendario</th>
                <th scope="col"
                  class="px-6 py-4 text-center text-xs font-medium text-gray-400 uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-white/5 bg-[#151515]">
              <tr v-for="tech in techniciansStore.technicians" :key="tech.id"
                class="hover:bg-white/5 transition-colors group">
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="flex items-center">
                    <div
                      class="flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-md"
                      :style="{ backgroundColor: googleCalendarColors[tech.googleColorId || '8'] }">
                      {{ tech.nombreCompleto.charAt(0).toUpperCase() }}
                    </div>
                    <div class="ml-4">
                      <div
                        class="text-sm font-bold text-white group-hover:text-[#d60000] transition-colors cursor-pointer"
                        @click="openProfileModal(tech.id)">
                        {{ tech.nombreCompleto }}
                      </div>
                      <div class="text-xs text-gray-500">ID: {{ tech.id }}</div>
                    </div>
                  </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <span
                    class="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-white/5 text-gray-300 border border-white/10">
                    {{ tech.zona }}
                  </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="flex items-center gap-2">
                    <div class="w-4 h-4 rounded-full"
                      :style="{ backgroundColor: googleCalendarColors[tech.googleColorId || '8'] }"></div>
                    <span class="text-xs text-gray-400">Asignado en agenda</span>
                  </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                  <div class="flex justify-center space-x-3">
                    <button @click="openProfileModal(tech.id)"
                      class="text-gray-400 hover:text-[#d60000] transition-colors" title="Ver Perfil">
                      <i class="fas fa-eye"></i>
                    </button>
                    <button @click="openEditModal(tech)" class="text-gray-400 hover:text-white transition-colors"
                      title="Editar">
                      <i class="fas fa-edit"></i>
                    </button>
                    <button @click="handleDelete(tech.id)" class="text-gray-400 hover:text-red-400 transition-colors"
                      title="Eliminar">
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

    <!-- Paginación -->
    <div class="flex-shrink-0 flex justify-center items-center mt-8 space-x-4">
      <button @click="fetchData('prev')" :disabled="techniciansStore.currentPage <= 1"
        class="btn btn-secondary disabled:opacity-50 disabled:cursor-not-allowed">
        <i class="fas fa-chevron-left mr-2"></i>Anterior
      </button>
      <span class="text-white font-semibold bg-[#151515] px-4 py-2 rounded-lg border border-white/10">
        Página {{ techniciansStore.currentPage }}
      </span>
      <button @click="fetchData('next')" :disabled="techniciansStore.isLastPage"
        class="btn btn-secondary disabled:opacity-50 disabled:cursor-not-allowed">
        Siguiente<i class="fas fa-chevron-right ml-2"></i>
      </button>
    </div>

    <!-- Modales -->
    <TechnicianFormModal :show="showFormModal" :technician="editingTechnician" @close="showFormModal = false"
      @save="handleSave" @delete="handleDelete" />
    <TechnicianProfileModal :show="showProfileModal" :technician-id="viewingTechnicianId"
      @close="showProfileModal = false" @edit="openEditModal" />
  </main>
</template>
