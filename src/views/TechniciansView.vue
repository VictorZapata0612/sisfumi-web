<!-- eslint-disable @typescript-eslint/no-explicit-any -->
<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed } from 'vue'
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
let searchTimeout: ReturnType<typeof setTimeout> | undefined
const canDelete = computed(() => ['Administrador', 'Jefe'].includes(authStore.userRole ?? ''))
const canEdit = computed(() => canDelete.value || ['Coordinador Valle', 'Coordinador Norte de Santander'].includes(authStore.userRole ?? ''))
const zones = ['Todos', 'Norte de Santander', 'Valle del Cauca', 'Nacionales']


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

const normalizeSearch = (term: string) =>
  term
    .trim()
    .toLowerCase()

const fetchData = (direction: 'next' | 'prev' | 'reset' = 'reset') => {
  techniciansStore.fetchTechnicians({
    zoneFilter: zoneFilter.value === 'Todos' ? null : zoneFilter.value,
    searchTerm: searchTerm.value ? normalizeSearch(searchTerm.value) : '',
    direction,
  })
}

onMounted(() => fetchData())
onUnmounted(() => clearTimeout(searchTimeout))

watch(() => route.query.itemIdToOpen, (id) => {
  if (typeof id !== 'string' || !id) return
  openProfileModal(id)
  void router.replace({ query: { ...route.query, itemIdToOpen: undefined }, hash: route.hash })
}, { immediate: true, flush: 'post' })

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

const handleRefresh = () => {
  fetchData('reset')
}

const handleDelete = async (technicianId: string) => {
  if (!canDelete.value) return
  showDialog({
    appearance: 'technicians',
    title: 'Confirmar Eliminación',
    message: '¿Está seguro de que desea eliminar este técnico? Esta acción no se puede deshacer.',
    isConfirmation: true,
    confirmationText: 'Eliminar técnico',
    onConfirm: async () => {
      try {
        await techniciansStore.deleteTechnician(technicianId)
        showToast({ title: 'Éxito', message: 'Técnico eliminado.', type: 'success' })
        showFormModal.value = false
        showProfileModal.value = false
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
  <section class="technicians-page space-y-4">
    <header class="flex flex-wrap items-center justify-between gap-4 py-2">
      <div class="flex items-center gap-3">
        <span class="tech-icon grid size-12 place-items-center rounded-xl text-xl"><i class="fas fa-hard-hat" aria-hidden="true"></i></span>
        <div>
          <h1 class="text-2xl font-extrabold tracking-tight sm:text-3xl">Técnicos</h1>
          <p class="tech-muted mt-1 text-sm">Consulta el equipo, sus zonas y las visitas asignadas.</p>
        </div>
      </div>
      <button v-if="canEdit" type="button" class="tech-button tech-primary" @click="openCreateModal">
        <i class="fas fa-user-plus" aria-hidden="true"></i> Registrar técnico
      </button>
    </header>

    <section class="tech-panel grid gap-3 p-4 sm:grid-cols-[2fr_1fr]" aria-label="Filtros de técnicos">
      <label class="grid gap-1 text-xs font-semibold">Búsqueda
        <input v-model="searchTerm" type="search" class="tech-field" placeholder="Buscar por nombre…" />
      </label>
      <label v-if="canDelete" class="grid gap-1 text-xs font-semibold">Zona
        <select v-model="zoneFilter" class="tech-field">
          <option v-for="zone in zones" :key="zone" :value="zone">{{ zone === 'Todos' ? 'Todas las zonas' : zone }}</option>
        </select>
      </label>
    </section>

    <section class="tech-panel overflow-hidden" aria-label="Directorio de técnicos" :aria-busy="techniciansStore.loading">
      <p v-if="techniciansStore.loading" role="status" class="tech-muted p-8 text-center text-sm">Cargando técnicos…</p>
      <div v-else-if="techniciansStore.error" role="alert" class="tech-muted p-8 text-center text-sm">
        <p>{{ techniciansStore.error }}</p>
        <button type="button" class="tech-button mt-3" @click="fetchData()">Reintentar</button>
      </div>
      <p v-else-if="!techniciansStore.technicians.length" class="tech-muted p-8 text-center text-sm">No se encontraron técnicos con estos filtros.</p>
      <template v-else>
        <div class="hidden overflow-x-auto md:block">
          <table class="tech-table w-full text-left text-sm">
            <thead><tr><th scope="col">Técnico</th><th scope="col">Contacto</th><th scope="col">Zona</th><th scope="col">Color en agenda</th><th scope="col">Acciones</th></tr></thead>
            <tbody>
              <tr v-for="tech in techniciansStore.technicians" :key="tech.id">
                <td>
                  <button type="button" class="tech-name flex items-center gap-3 text-left font-bold" @click="openProfileModal(tech.id)">
                    <span class="tech-icon grid size-9 shrink-0 place-items-center rounded-full" aria-hidden="true">{{ tech.nombreCompleto?.charAt(0)?.toUpperCase() || 'T' }}</span>
                    {{ tech.nombreCompleto || 'Sin nombre' }}
                  </button>
                </td>
                <td><p>{{ tech.email || '—' }}</p><p v-if="tech.telefono" class="tech-muted text-xs">{{ tech.telefono }}</p></td>
                <td>{{ tech.zona || '—' }}</td>
                <td><span class="flex items-center gap-2 text-xs"><span class="size-3 rounded-full" aria-hidden="true" :style="{ background: googleCalendarColors[tech.googleColorId || '8'] || '#616161' }"></span>{{ tech.googleColorId ? 'Configurado' : 'Predeterminado' }}</span></td>
                <td>
                  <div class="flex gap-1">
                    <button type="button" class="tech-button tech-action" :aria-label="'Ver ficha de ' + tech.nombreCompleto" @click="openProfileModal(tech.id)"><i class="fas fa-eye" aria-hidden="true"></i></button>
                    <button v-if="canEdit" type="button" class="tech-button tech-action" :aria-label="'Editar a ' + tech.nombreCompleto" @click="openEditModal(tech)"><i class="fas fa-edit" aria-hidden="true"></i></button>
                    <button v-if="canDelete" type="button" class="tech-button tech-action" :aria-label="'Eliminar a ' + tech.nombreCompleto" @click="handleDelete(tech.id)"><i class="fas fa-trash-alt" aria-hidden="true"></i></button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <ul class="md:hidden">
          <li v-for="tech in techniciansStore.technicians" :key="tech.id" class="tech-mobile-row">
            <button type="button" class="flex w-full items-center gap-3 p-4 text-left" @click="openProfileModal(tech.id)">
              <span class="tech-icon grid size-9 shrink-0 place-items-center rounded-full font-bold" aria-hidden="true">{{ tech.nombreCompleto?.charAt(0)?.toUpperCase() || 'T' }}</span>
              <span class="min-w-0 flex-1"><strong class="block">{{ tech.nombreCompleto }}</strong><span class="tech-muted break-all text-xs">{{ [tech.zona, tech.email].filter(Boolean).join(' · ') }}</span></span>
              <i class="fas fa-chevron-right tech-muted" aria-hidden="true"></i>
            </button>
          </li>
        </ul>
      </template>
      <footer v-if="!techniciansStore.error && (techniciansStore.technicians.length || techniciansStore.currentPage > 1)" class="tech-footer flex flex-wrap items-center justify-between gap-2 px-4 py-3">
        <span class="tech-muted text-sm">Página {{ techniciansStore.currentPage }}</span>
        <div class="flex gap-2">
          <button type="button" class="tech-button" :disabled="techniciansStore.loading || techniciansStore.currentPage <= 1" @click="fetchData('prev')">Anterior</button>
          <button type="button" class="tech-button" :disabled="techniciansStore.loading || techniciansStore.isLastPage" @click="fetchData('next')">Siguiente</button>
        </div>
      </footer>
    </section>

    <TechnicianFormModal :show="showFormModal" :technician="editingTechnician" :can-delete="canDelete"
      @close="showFormModal = false" @refresh="handleRefresh" @delete="handleDelete" />
    <TechnicianProfileModal :show="showProfileModal" :technician-id="viewingTechnicianId" :can-edit="canEdit"
      @close="showProfileModal = false" @edit="openEditModal" />
  </section>
</template>

<style scoped>
.technicians-page { color: var(--shell-text); --tech-accent: #b8000b; --tech-tint: #fff0f1; }
[data-theme='dark'] .technicians-page { color-scheme: dark; --tech-accent: #ff858b; --tech-tint: #412328; }
.tech-panel { border: 1px solid var(--shell-border); border-radius: 0.9rem; background: var(--shell-surface); }
.tech-icon { color: var(--tech-accent); background: var(--tech-tint); }
.tech-muted { color: var(--shell-muted); }
.tech-field, .tech-button {
  min-height: 2.5rem; padding: 0.45rem 0.75rem; border: 1px solid var(--shell-border); border-radius: 0.55rem;
  background: var(--shell-surface); color: var(--shell-text);
}
.tech-field { width: 100%; font-size: 0.875rem; font-weight: 400; }
.tech-button { display: inline-flex; align-items: center; justify-content: center; gap: 0.5rem; font-size: 0.8rem; font-weight: 650; }
.tech-button:hover, .tech-table tbody tr:hover { background: var(--shell-input); }
.tech-button:disabled { opacity: 0.5; cursor: default; }
.tech-primary { border-color: #bc000b; background: #c7000c; color: #fff; }
.tech-primary:hover { background: #a9000a; }
.tech-action { min-height: 2rem; padding: 0.25rem 0.5rem; }
.tech-name:hover { color: var(--tech-accent); text-decoration: underline; }
.tech-field:focus-visible, .tech-name:focus-visible, .tech-button:focus-visible { outline: 2px solid #e50914; outline-offset: -2px; }
.tech-table th, .tech-table td { padding: 0.75rem; border-bottom: 1px solid var(--shell-border); }
.tech-table th { background: var(--shell-input); font-size: 0.75rem; white-space: nowrap; }
.tech-footer, .tech-mobile-row + .tech-mobile-row { border-top: 1px solid var(--shell-border); }
</style>
