<!-- eslint-disable @typescript-eslint/no-explicit-any -->
<script setup lang="ts">
import { onMounted, onUnmounted, ref, computed, reactive, watch, nextTick, defineAsyncComponent } from 'vue'
import type { Client } from '@/stores/clients'
import { useClientsStore } from '@/stores/clients'
import { useAuthStore } from '@/stores/auth'
import { useDialog } from '@/composables/useDialog'
import { useRoute, useRouter } from 'vue-router'
import { httpsCallable } from 'firebase/functions'
import { functions } from '@/firebase/config'

const authStore = useAuthStore()
const clientsStore = useClientsStore()
const route = useRoute()
const router = useRouter()

const ClientFormModal = defineAsyncComponent(() => import('@/components/ClientFormModal.vue'))
const ClientImportExportModal = defineAsyncComponent(() => import('@/components/ClientImportExportModal.vue'))

// Referencias para los filtros
const searchTerm = ref('')
const statusFilter = ref('Activo')
const typeFilter = ref('')
const branchFilter = ref('')
const pageSize = 12
const registrationFormatter = new Intl.DateTimeFormat('es-CO', {
  dateStyle: 'medium',
  timeZone: 'America/Bogota',
})

function formatRegistration(value: Client['createdAt']) {
  const seconds = typeof value === 'object' ? value?.seconds ?? value?._seconds : undefined
  const date = typeof value === 'string' ? new Date(value) : new Date((seconds ?? NaN) * 1000)
  return Number.isNaN(date.getTime()) ? '—' : registrationFormatter.format(date)
}
const matches = ref<Client[]>([])
const localMode = computed(() => Boolean(searchTerm.value.trim() || typeFilter.value || branchFilter.value))
let requestVersion = 0

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
const profileDialog = ref<HTMLDialogElement>()
const profileSections = [
  { id: 'summary', label: 'Resumen', icon: 'fa-building' },
  { id: 'branches', label: 'Sucursales', icon: 'fa-store' },
  { id: 'history', label: 'Historial', icon: 'fa-history' },
] as const
const profileSection = ref<(typeof profileSections)[number]['id']>('summary')
const profileBody = ref<HTMLElement>()

watch(profileSection, () => {
  if (profileBody.value) profileBody.value.scrollTop = 0
})

function visitStatus(status: string | undefined) {
  if (status === 'Realizada') return 'complete'
  if (status === 'Cancelada') return 'cancelled'
  return status === 'Programada' ? 'scheduled' : undefined
}
watch(showProfileModal, (open) => {
  if (open) profileDialog.value?.showModal()
  else profileDialog.value?.close()
}, { flush: 'post' })

const normalizeSearchText = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')

const matchesSearch = (client: Client, term: string) => {
  const normalizedTerm = normalizeSearchText(term)
  return [client.nombreComercial, client.razonSocial, client.nit, client.numeroIdentificacion, client.ciudad, client.zona, ...((client.sucursales ?? []).map((branch) => branch.nombre))]
    .filter(Boolean)
    .some((value) => normalizeSearchText(String(value)).includes(normalizedTerm))
}

// Propiedad computada para acceder fácilmente al perfil del cliente
const profile = computed(() => clientsStore.selectedClientProfile)

const canChangeZone = computed(() => {
  const allowedRoles = ['Administrador', 'Jefe', 'Coordinador Nacional']
  return allowedRoles.includes(authStore.userRole || '')
})

const viewClientProfile = (clientId: string) => {
  profileSection.value = 'summary'
  clientsStore.fetchClientProfile(clientId)
  showProfileModal.value = true
}

const initializeFilters = () => {
  if (!canChangeZone.value) {
    statusFilter.value = 'Activo' // Forzar a ver solo activos
  }
}
function showLocalPage() {
  const start = (pagination.currentPage - 1) * pageSize
  clientsStore.clients = matches.value.slice(start, start + pageSize)
  pagination.isLastPage = start + pageSize >= matches.value.length
}

async function fetchPage(page: number) {
  const version = ++requestVersion
  const status = statusFilter.value
  const search = searchTerm.value
  const type = typeFilter.value
  const branch = normalizeSearchText(branchFilter.value)
  clientsStore.loading = true
  clientsStore.error = null
  try {
    if (localMode.value) {
      const result = await httpsCallable<unknown, { clients: Client[] }>(functions, 'getAllClients')()
      if (version !== requestVersion) return
      matches.value = result.data.clients.filter((client) =>
        (status === 'Todos' || client.estado === status) &&
        (!type || client.tipo?.toUpperCase() === type) &&
        (!branch || client.sucursales?.some((item) => normalizeSearchText(item.nombre || '').includes(branch))) &&
        (!search.trim() || matchesSearch(client, search)),
      ).sort((a, b) => (a.nombreComercial || '').localeCompare(b.nombreComercial || '', 'es-CO'))
      pagination.currentPage = page
      showLocalPage()
    } else {
      const result = await httpsCallable<unknown, { clients: Client[] }>(functions, 'getClientsPage')({
        status: status === 'Todos' ? undefined : status,
        pageSize: pageSize + 1,
        startAfterDocId: pagination.pageHistory[page - 1],
      })
      if (version !== requestVersion) return
      clientsStore.clients = result.data.clients.slice(0, pageSize)
      pagination.currentPage = page
      pagination.isLastPage = result.data.clients.length <= pageSize
      if (!pagination.isLastPage) pagination.pageHistory[page] = clientsStore.clients[pageSize - 1]!.id
    }
  } catch (error: unknown) {
    if (version === requestVersion) {
      clientsStore.error = error instanceof Error ? error.message : 'No se pudieron cargar los clientes.'
    }
  } finally {
    if (version === requestVersion) clientsStore.loading = false
  }
}

function resetAndFetch() {
  clearTimeout(searchTimeout)
  pagination.currentPage = 1
  pagination.pageHistory = [null]
  void fetchPage(1)
}

function changePage(page: number) {
  if (clientsStore.loading || page < 1) return
  if (localMode.value) {
    pagination.currentPage = page
    showLocalPage()
  } else {
    void fetchPage(page)
  }
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
    appearance: 'client',
    title: 'Inactivar cliente',
    message:
      '¿Está seguro de que desea marcar este cliente como "Inactivo"? Se ocultará de las listas principales.',
    isConfirmation: true,
    confirmationText: 'Inactivar cliente',
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
    appearance: 'client',
    title: 'Eliminar cliente permanentemente',
    message: `Está a punto de eliminar permanentemente este cliente y todos sus datos. Esta acción no se puede deshacer. <br><br> Escriba <strong>ELIMINAR</strong> para confirmar.`,
    isConfirmation: true,
    confirmationText: 'Eliminar cliente',
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

let searchTimeout: ReturnType<typeof setTimeout> | undefined

onMounted(() => {
  if (typeof route.query.cityFilter === 'string') searchTerm.value = route.query.cityFilter
  initializeFilters()
  resetAndFetch()
})

watch(() => route.query.clientIdToOpen ?? route.query.itemIdToOpen, async (id) => {
  if (typeof id !== 'string' || !id) return
  await nextTick()
  viewClientProfile(id)
  void router.replace({ query: { ...route.query, clientIdToOpen: undefined, itemIdToOpen: undefined } })
}, { immediate: true })

onUnmounted(() => {
  clearTimeout(searchTimeout)
  requestVersion++
})

function handleSearch() {
  clearTimeout(searchTimeout)
  requestVersion++
  clientsStore.loading = true
  searchTimeout = setTimeout(resetAndFetch, 350)
}
</script>

<template>
  <section class="clients-page space-y-4">
    <header class="flex flex-wrap items-center justify-between gap-4 py-2">
      <div class="flex items-center gap-3">
        <span class="client-icon grid size-12 shrink-0 place-items-center rounded-xl text-xl" aria-hidden="true">
          <i class="fas fa-users"></i>
        </span>
        <div>
          <h1 class="text-2xl font-extrabold tracking-tight sm:text-3xl">Clientes</h1>
          <p class="client-muted mt-1 text-sm">Gestiona tus clientes, contactos y sucursales.</p>
        </div>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <button v-if="authStore.canAccess('clientes', 'create') || authStore.canAccess('clientes', 'export')" type="button" class="client-button" @click="showImportModal = true">
          <i class="fas fa-file-csv" aria-hidden="true"></i> Importar / exportar
        </button>
        <button v-if="authStore.canAccess('clientes', 'create')" type="button" class="client-button client-primary" @click="openCreateModal">
          <i class="fas fa-plus" aria-hidden="true"></i> Nuevo cliente
        </button>
      </div>
    </header>

    <section class="clients-panel grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-[2fr_1fr_1fr_1fr]" aria-label="Filtros de clientes">
      <label class="grid gap-1 text-xs font-semibold">
        Búsqueda
        <input v-model="searchTerm" @input="handleSearch" type="search" class="client-field"
          placeholder="Nombre, documento o ciudad…" />
      </label>
      <label v-if="canChangeZone" class="grid gap-1 text-xs font-semibold">
        Estado
        <select v-model="statusFilter" @change="resetAndFetch" class="client-field">
          <option value="Todos">Todos</option>
          <option value="Activo">Activo</option>
          <option value="Inactivo">Inactivo</option>
        </select>
      </label>
      <label class="grid gap-1 text-xs font-semibold">
        Tipo
        <select v-model="typeFilter" @change="resetAndFetch" class="client-field">
          <option value="">Todos</option>
          <option value="DIRECTO">Directo</option>
          <option value="ALIADO">Aliado</option>
        </select>
      </label>
      <label class="grid gap-1 text-xs font-semibold">
        Sucursal
        <input v-model="branchFilter" @input="handleSearch" type="search" class="client-field"
          placeholder="Nombre de sucursal" />
      </label>
    </section>

    <section class="clients-panel overflow-hidden" aria-label="Directorio de clientes" :aria-busy="clientsStore.loading">
      <p v-if="clientsStore.loading" class="client-muted p-8 text-center text-sm" role="status">Cargando clientes…</p>
      <div v-else-if="clientsStore.error" class="p-8 text-center text-sm" role="alert">
        <p>{{ clientsStore.error }}</p>
        <button type="button" class="client-button mt-3" @click="resetAndFetch">Reintentar</button>
      </div>
      <p v-else-if="!clientsStore.clients.length" class="client-muted p-8 text-center text-sm">No se encontraron clientes con estos filtros.</p>

      <template v-else>
        <div class="hidden overflow-x-auto md:block">
          <table class="clients-table w-full text-left text-sm">
            <thead>
              <tr>
                <th scope="col">Cliente / ID</th>
                <th scope="col">Documento</th>
                <th scope="col">Contacto</th>
                <th scope="col">Sucursales</th>
                <th scope="col">Estado</th>
                <th scope="col">Registro</th>
                <th scope="col">Acciones</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="client in clientsStore.clients" :key="client.id">
                <td>
                  <button type="button" class="client-link text-left font-bold" @click="viewClientProfile(client.id)">
                    {{ client.nombreComercial || client.razonSocial || 'Sin nombre' }}
                  </button>
                  <p v-if="client.razonSocial && client.razonSocial !== client.nombreComercial" class="client-muted text-xs">{{ client.razonSocial }}</p>
                  <p class="client-muted text-xs" :title="client.id">ID {{ client.id.slice(0, 8) }}</p>
                </td>
                <td>{{ client.nit || client.numeroIdentificacion || '—' }}</td>
                <td>
                  <p>{{ client.contactoPrincipal?.nombre || '—' }}</p>
                  <p v-if="client.contactoPrincipal?.celular || client.contactoPrincipal?.email" class="client-muted break-all text-xs">
                    {{ client.contactoPrincipal?.celular || client.contactoPrincipal?.email }}
                  </p>
                </td>
                <td>
                  <p>{{ client.sucursales?.length ?? '—' }}</p>
                  <p class="client-muted text-xs">{{ client.ciudad || client.zona }}</p>
                </td>
                <td><span class="client-status" :data-active="client.estado === 'Activo'">{{ client.estado || 'Sin estado' }}</span></td>
                <td>{{ formatRegistration(client.createdAt) }}</td>
                <td>
                  <button type="button" class="client-button client-action" :aria-label="'Ver ficha de ' + (client.nombreComercial || client.id)" @click="viewClientProfile(client.id)">
                    <i class="fas fa-eye" aria-hidden="true"></i>
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <ul class="md:hidden">
          <li v-for="client in clientsStore.clients" :key="client.id" class="client-mobile-row">
            <button type="button" class="flex w-full items-start justify-between gap-3 p-4 text-left" @click="viewClientProfile(client.id)">
              <span class="min-w-0">
                <strong class="block break-words">{{ client.nombreComercial || client.razonSocial || 'Sin nombre' }}</strong>
                <span class="client-muted text-xs">{{ [client.nit || client.numeroIdentificacion, client.ciudad].filter(Boolean).join(' · ') }}</span>
              </span>
              <span class="client-status" :data-active="client.estado === 'Activo'">{{ client.estado || 'Sin estado' }}</span>
            </button>
          </li>
        </ul>
      </template>

      <footer v-if="!clientsStore.error && (pagination.currentPage > 1 || clientsStore.clients.length)"
        class="client-footer flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
        <span class="client-muted">Página {{ pagination.currentPage }}<template v-if="!clientsStore.loading && localMode"> · {{ matches.length }} resultados</template></span>
        <div class="flex gap-2">
          <button type="button" class="client-button" :disabled="clientsStore.loading || pagination.currentPage === 1" @click="changePage(pagination.currentPage - 1)">Anterior</button>
          <button type="button" class="client-button" :disabled="clientsStore.loading || pagination.isLastPage" @click="changePage(pagination.currentPage + 1)">Siguiente</button>
        </div>
      </footer>
    </section>

    <dialog ref="profileDialog" class="client-dialog clients-panel" aria-labelledby="client-profile-title"
      @cancel.prevent="showProfileModal = false">
      <div class="profile-shell">
        <header class="profile-header flex items-start gap-3 p-4 sm:p-5">
          <span class="client-icon grid size-11 shrink-0 place-items-center rounded-xl text-lg" aria-hidden="true">
            <i class="fas fa-building"></i>
          </span>
          <div class="min-w-0 flex-1">
            <p v-if="profile" class="client-muted text-xs font-semibold">Ficha de cliente</p>
            <h2 id="client-profile-title" class="break-words text-lg font-extrabold leading-tight sm:text-2xl">
              {{ profile?.client.nombreComercial || profile?.client.razonSocial || 'Ficha de cliente' }}
            </h2>
            <div v-if="profile" class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
              <span class="client-status" :data-active="profile.client.estado === 'Activo'">{{ profile.client.estado || 'Sin estado' }}</span>
              <span class="client-muted">{{ [profile.client.ciudad, profile.client.departamento].filter(Boolean).join(', ') }}</span>
            </div>
          </div>
          <button v-if="profile && !clientsStore.loadingProfile && authStore.canAccess('clientes', 'edit')" type="button" class="client-button client-primary shrink-0"
            aria-label="Editar cliente" @click="openEditModal(profile.client.id)">
            <i class="fas fa-edit" aria-hidden="true"></i><span class="hidden sm:inline">Editar cliente</span>
          </button>
          <button type="button" class="client-button shrink-0" aria-label="Cerrar ficha" autofocus @click="showProfileModal = false">
            <i class="fas fa-times" aria-hidden="true"></i>
          </button>
        </header>

        <nav v-if="profile && !clientsStore.loadingProfile" class="profile-nav" aria-label="Secciones de la ficha">
          <button v-for="section in profileSections" :key="section.id" type="button"
            :aria-pressed="profileSection === section.id" @click="profileSection = section.id">
            <i class="fas" :class="section.icon" aria-hidden="true"></i>{{ section.label }}
          </button>
        </nav>

        <div ref="profileBody" class="profile-body p-4 sm:p-5">
          <p v-if="clientsStore.loadingProfile" class="client-muted py-8 text-center text-sm" role="status">Cargando ficha del cliente…</p>
          <template v-else-if="profile">
            <div v-if="profileSection === 'summary'" class="grid gap-4 md:grid-cols-[0.95fr_1.05fr]">
              <div class="space-y-4">
                <section class="profile-card">
                  <h3 class="profile-card-title"><i class="fas fa-id-card client-accent" aria-hidden="true"></i> Información general</h3>
                  <dl class="space-y-2 p-4 text-sm">
                    <div v-for="[label, value] in [
                      ['Razón social', profile.client.razonSocial],
                      ['Documento', profile.client.nit || profile.client.numeroIdentificacion],
                      ['Tipo de cliente', profile.client.tipo],
                      ['Zona', profile.client.zona],
                      ['Registro', formatRegistration(profile.client.createdAt)],
                    ]" :key="label" class="grid grid-cols-[7rem_1fr] gap-2">
                      <dt class="client-muted">{{ label }}</dt>
                      <dd class="min-w-0 break-words font-semibold">{{ value || '—' }}</dd>
                    </div>
                  </dl>
                </section>

                <section class="profile-card">
                  <h3 class="profile-card-title"><i class="fas fa-address-book client-accent" aria-hidden="true"></i> Contactos</h3>
                  <div v-for="entry in [
                    { label: 'Principal', contact: profile.client.contactoPrincipal },
                    { label: 'Financiero', contact: profile.client.contactoFinanciero },
                  ]" :key="entry.label" class="profile-row px-4 py-3 text-sm">
                    <p class="client-muted text-xs">{{ entry.label }}</p>
                    <p class="font-semibold">{{ entry.contact?.nombre || 'Sin contacto registrado' }}</p>
                    <a v-if="entry.contact?.celular" :href="'tel:' + entry.contact.celular" class="client-link block text-xs">{{ entry.contact.celular }}</a>
                    <a v-if="entry.contact?.email" :href="'mailto:' + entry.contact.email" class="client-link block break-all text-xs">{{ entry.contact.email }}</a>
                  </div>
                </section>
              </div>

              <div class="space-y-4">
                <section class="profile-card">
                  <h3 class="profile-card-title"><i class="fas fa-clipboard-list client-accent" aria-hidden="true"></i> Servicios contratados</h3>
                  <ul v-if="profile.serviceSheet?.services.length">
                    <li v-for="(service, index) in profile.serviceSheet.services as any[]" :key="index" class="profile-row flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                      <span class="font-semibold">{{ service.tipo_servicio }}</span>
                      <span v-if="service.frecuencia" class="client-status">{{ service.frecuencia }}</span>
                    </li>
                  </ul>
                  <p v-else class="client-muted p-4 text-sm">No hay servicios configurados.</p>
                </section>

                <section class="profile-card">
                  <h3 class="profile-card-title"><i class="fas fa-calendar-alt client-accent" aria-hidden="true"></i> Próximas visitas</h3>
                  <ul v-if="profile.upcomingVisits.length">
                    <li v-for="visit in profile.upcomingVisits as any[]" :key="visit.id" class="profile-row px-4 py-3 text-sm">
                      <p class="font-semibold">{{ visit.tipo_visita }}</p>
                      <p class="client-muted mt-1 text-xs">{{ formatRegistration(visit.fecha_visita) }}</p>
                    </li>
                  </ul>
                  <p v-else class="client-muted p-4 text-sm">No hay próximas visitas programadas.</p>
                </section>
              </div>
            </div>

            <section v-else-if="profileSection === 'branches'" class="profile-card">
              <h3 class="profile-card-title"><i class="fas fa-store client-accent" aria-hidden="true"></i> Sucursales registradas</h3>
              <ul v-if="profile.client.sucursales?.length">
                <li v-for="(branch, index) in profile.client.sucursales" :key="index" class="profile-row flex flex-wrap items-start justify-between gap-2 px-4 py-3 text-sm">
                  <div>
                    <p class="font-semibold">{{ branch.nombre || 'Sucursal sin nombre' }}</p>
                    <p class="client-muted">{{ branch.direccion || 'Sin dirección registrada' }}</p>
                  </div>
                  <span v-if="branch.zona" class="client-status">{{ branch.zona }}</span>
                </li>
              </ul>
              <p v-else class="client-muted p-4 text-sm">Este cliente no tiene sucursales registradas.</p>
            </section>

            <section v-else class="profile-card">
              <h3 class="profile-card-title"><i class="fas fa-history client-accent" aria-hidden="true"></i> Historial reciente de visitas</h3>
              <div v-if="profile.visitHistory.length" class="overflow-x-auto">
                <table class="clients-table w-full text-left text-sm">
                  <thead><tr><th scope="col">Servicio</th><th scope="col">Fecha</th><th scope="col">Técnicos</th><th scope="col">Estado</th></tr></thead>
                  <tbody>
                    <tr v-for="visit in profile.visitHistory as any[]" :key="visit.id">
                      <td class="font-semibold">{{ visit.tipo_visita }}</td>
                      <td>{{ formatRegistration(visit.fecha_visita) }}</td>
                      <td>{{ visit.fumigadores_asignados?.join(', ') || 'Sin asignar' }}</td>
                      <td><span class="client-status visit-status" :data-status="visitStatus(visit.estado_visita)">{{ visit.estado_visita || 'Sin estado' }}</span></td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p v-else class="client-muted p-4 text-sm">No hay visitas en el historial.</p>
            </section>
          </template>
          <p v-else class="client-muted py-8 text-center text-sm" role="alert">{{ clientsStore.error || 'No se pudo cargar la ficha.' }}</p>
        </div>
      </div>
    </dialog>

    <!-- Modal de Formulario para Crear/Editar -->
    <ClientFormModal :show="showFormModal" :client-id="editingClientId" @close="showFormModal = false"
      @save="handleClientSave" @delete-inactive="handleInactive" @delete-permanent="handlePermanentDelete" />

    <!-- Modal de Importación/Exportación -->
    <ClientImportExportModal :show="showImportModal" @close="showImportModal = false" @refresh="resetAndFetch" />
  </section>
</template>

<style scoped>
.clients-page { color: var(--shell-text); }
.clients-panel { border: 1px solid var(--shell-border); border-radius: 0.9rem; background: var(--shell-surface); }
.client-muted { color: var(--shell-muted); }
.client-accent, .client-link:hover { color: var(--client-accent, #b8000b); }
.client-link:hover { text-decoration: underline; }
.client-icon { color: var(--client-accent, #b8000b); background: var(--client-tint, #fff0f1); }
.client-field, .client-button {
  min-height: 2.5rem;
  border: 1px solid var(--shell-border);
  border-radius: 0.55rem;
  background: var(--shell-surface);
  color: var(--shell-text);
  padding: 0.45rem 0.7rem;
}
.client-field { width: 100%; font-size: 0.875rem; font-weight: 400; }
.client-button { display: inline-flex; align-items: center; justify-content: center; gap: 0.5rem; font-size: 0.8rem; font-weight: 650; }
.client-button:hover { background: var(--shell-input); }
.client-button:disabled { opacity: 0.45; cursor: default; }
.client-primary { border-color: #bc000b; background: #c7000c; color: #fff; }
.client-primary:hover { background: #a9000a; }
.client-action { min-height: 2rem; padding: 0.35rem 0.55rem; }
.client-field:focus-visible, .client-button:focus-visible, .client-link:focus-visible { outline: 2px solid #e50914; outline-offset: 2px; }
.clients-table th, .clients-table td { padding: 0.75rem; border-bottom: 1px solid var(--shell-border); vertical-align: middle; }
.clients-table th { background: var(--shell-input); font-size: 0.75rem; white-space: nowrap; }
.clients-table td:first-child { min-width: 10rem; }
.clients-table tbody tr:hover { background: var(--shell-input); }
.client-footer, .client-mobile-row + .client-mobile-row { border-top: 1px solid var(--shell-border); }
.client-status { display: inline-block; white-space: nowrap; padding: 0.2rem 0.55rem; border-radius: 999px; font-size: 0.7rem; font-weight: 700; color: var(--shell-muted); background: var(--shell-input); }
.client-status[data-active='true'] { color: #086534; background: #dbf2e4; }
.client-dialog {
  width: min(66rem, calc(100vw - 2rem));
  max-height: calc(100dvh - 2rem);
  margin: auto;
  padding: 0;
  overflow: hidden;
  color: var(--shell-text);
  box-shadow: 0 24px 64px #0005;
}
.profile-shell { display: flex; flex-direction: column; max-height: min(48rem, calc(100dvh - 2rem)); }
.profile-header, .profile-nav { flex-shrink: 0; border-bottom: 1px solid var(--shell-border); }
.profile-header { background: linear-gradient(110deg, var(--client-tint, #fff0f1), var(--shell-surface) 70%); }
.profile-nav { display: flex; gap: 0.25rem; overflow-x: auto; padding-inline: 0.75rem; }
.profile-nav button {
  display: flex; align-items: center; gap: 0.5rem; flex-shrink: 0;
  padding: 0.8rem 0.65rem; border-bottom: 2px solid transparent;
  color: var(--shell-muted); font-size: 0.85rem; font-weight: 650;
}
.profile-nav button[aria-pressed='true'] { border-color: #e50914; color: var(--client-accent, #b8000b); }
.profile-nav button:hover { background: var(--shell-input); color: var(--shell-text); }
.profile-nav button:focus-visible { outline: 2px solid #e50914; outline-offset: -3px; }
.profile-body { min-height: 0; overflow: auto; scrollbar-color: var(--shell-scroll-thumb) var(--shell-scroll-track); }
.profile-card { border: 1px solid var(--shell-border); border-radius: 0.75rem; overflow: hidden; }
.profile-card-title { display: flex; align-items: center; gap: 0.55rem; padding: 0.85rem 1rem; background: var(--shell-input); font-size: 0.9rem; font-weight: 750; }
.profile-row + .profile-row { border-top: 1px solid var(--shell-border); }
.visit-status[data-status='complete'] { color: #086534; background: #dbf2e4; }
.visit-status[data-status='scheduled'] { color: #23518a; background: #e7effd; }
.visit-status[data-status='cancelled'] { color: #a20d16; background: #ffe8e9; }
[data-theme='dark'] .visit-status[data-status='complete'] { color: #a4e9b9; background: #173c27; }
[data-theme='dark'] .visit-status[data-status='scheduled'] { color: #b0d0ff; background: #233753; }
[data-theme='dark'] .visit-status[data-status='cancelled'] { color: #ffb0b4; background: #4d2428; }
.client-dialog::backdrop { background: #0009; }
[data-theme='dark'] .clients-page { color-scheme: dark; --client-accent: #ff8087; --client-tint: #412328; }
[data-theme='dark'] .client-status[data-active='true'] { color: #a4e9b9; background: #173c27; }
</style>
