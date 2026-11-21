<!-- eslint-disable @typescript-eslint/no-explicit-any -->
<script setup lang="ts">
import { ref, onMounted, computed, nextTick } from 'vue'
import { useServicesStore, type PendingPriceRequest, type Service } from '@/stores/services'
import { useAuthStore } from '@/stores/auth'
import { useSettingsStore } from '@/stores/settings'
import ServiceFormModal from '@/components/ServiceFormModal.vue'
import { useToast } from '@/composables/useToast'
import { onClickOutside } from '@vueuse/core'
import { useRoute, useRouter } from 'vue-router'

const servicesStore = useServicesStore()
const authStore = useAuthStore()
const settingsStore = useSettingsStore()
const route = useRoute()
const router = useRouter()
const { showToast } = useToast()
const searchTerm = ref('')
const statusFilter = ref('')
const branchFilter = ref('')
const detail = ref<{ service: Service; index: number }>()
const detailDialog = ref<HTMLDialogElement>()
const priceDialog = ref<HTMLDialogElement>()
const assigningPrice = ref(false)
const priceFeedback = ref('')
const priceMode = ref(false)
const selectingClient = ref(false)
const currency = new Intl.NumberFormat('es-CO', {
  style: 'currency', currency: 'COP', maximumFractionDigits: 0,
})
const visibleServices = computed(() => (servicesStore.serviceSheet?.services ?? [])
  .map((service, index) => ({ service, index }))
  .filter(({ service }) => (!statusFilter.value || service.estado_servicio === statusFilter.value) &&
    (!branchFilter.value || !service.sucursales_asignadas.length ||
      service.sucursales_asignadas.includes(branchFilter.value))))
const isPricePending = (service: Service) => service.needsPriceApproval === true && Number(service.valor) === 0
const summary = computed(() => {
  const services = servicesStore.serviceSheet?.services ?? []
  return [
    { label: 'Activos', value: services.filter((item) => item.estado_servicio === 'Activo').length, icon: 'fa-check-circle' },
    { label: 'Precio pendiente', value: services.filter(isPricePending).length, icon: 'fa-dollar-sign' },
    { label: 'Completados', value: services.filter((item) => item.estado_servicio === 'Completado').length, icon: 'fa-clipboard-check' },
  ]
})

const showModal = ref(false)
const editingService = ref<Service | null>(null)
const editingServiceIndex = ref(-1)
const showClientResults = ref(false)
const searchResultsContainer = ref(null)

const normalizeSearchText = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')

// Filtro local de clientes
const filteredClients = computed(() => {
  if (!searchTerm.value) {
    return servicesStore.clientList.slice(0, 10)
  }
  const normalizedSearch = normalizeSearchText(searchTerm.value)

  return servicesStore.clientList.filter((client) =>
    normalizeSearchText(client.nombreComercial).includes(normalizedSearch),
  )
})

const canApprovePrices = computed(() => {
  return (
    authStore.userRole === 'Administrador' ||
    authStore.userRole === 'Jefe' ||
    authStore.userRole === 'Coordinador Nacional'
  )
})

onMounted(async () => {
  await settingsStore.fetchBusinessData()
  await servicesStore.fetchClients()
  const clientId = route.query.clientIdToOpen
  if (typeof clientId === 'string' && clientId) {
    await handleSelectClient(clientId)
    await router.replace({ query: { ...route.query, clientIdToOpen: undefined } })
  }
  if (canApprovePrices.value) {
    servicesStore.fetchPendingPriceRequests()
  }
})

onClickOutside(searchResultsContainer, () => {
  showClientResults.value = false
})

const handleSelectClient = async (clientId: string) => {
  if (selectingClient.value || servicesStore.savingSheet) return false
  selectingClient.value = true
  statusFilter.value = ''
  branchFilter.value = ''
  showClientResults.value = false
  try {
    await servicesStore.fetchServiceSheet(clientId)
  } finally {
    selectingClient.value = false
  }
  const client = servicesStore.clientList.find((c) => c.id === clientId)
  if (client) {
    searchTerm.value = client.nombreComercial
  }
  return servicesStore.serviceSheet?.clientId === clientId
}

const handleFocus = () => {
  showClientResults.value = true
  if (servicesStore.selectedClient && !searchTerm.value) {
    searchTerm.value = servicesStore.selectedClient.nombreComercial
  }
}

const openCreateModal = () => {
  priceMode.value = false
  editingService.value = null
  editingServiceIndex.value = -1
  showModal.value = true
}

const openEditModal = (service: Service, index: number, forPrice = false) => {
  priceMode.value = forPrice
  editingService.value = service
  editingServiceIndex.value = index
  showModal.value = true
}

function openDetail(service: Service, index: number) {
  detail.value = { service, index }
  detailDialog.value?.showModal()
}

function editDetail() {
  if (!detail.value) return
  detailDialog.value?.close()
  openEditModal(detail.value.service, detail.value.index)
}

async function handlePriceRequest(request: PendingPriceRequest) {
  if (assigningPrice.value) return
  assigningPrice.value = true
  priceFeedback.value = ''
  try {
    const loaded = servicesStore.serviceSheet?.clientId === request.clientId ||
      await handleSelectClient(request.clientId)
    const services = loaded ? servicesStore.serviceSheet?.services : undefined
    const index = request.service.id
      ? services?.findIndex((service) => service.id === request.service.id) ?? -1
      : request.serviceIndex
    const service = services?.[index]
    if (!service || !isPricePending(service) || (!request.service.id && service.tipo_servicio !== request.service.tipo_servicio)) {
      priceFeedback.value = 'La solicitud ya no está disponible. Actualiza la bandeja y vuelve a intentarlo.'
      return
    }
    priceDialog.value?.close()
    await nextTick()
    openEditModal(service, index, true)
  } finally {
    assigningPrice.value = false
  }
}

const handleSaveService = () => {
  showModal.value = false
  if (canApprovePrices.value) void servicesStore.fetchPendingPriceRequests()
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

// Función auxiliar para obtener los nombres de las sucursales a partir de sus IDs (Ficha seleccionada)
const getBranchNames = (branchIds: string[]) => {
  if (!branchIds || branchIds.length === 0) return 'Todas'
  if (!servicesStore.selectedClient || !servicesStore.selectedClient.sucursales) return branchIds.join(', ')

  const branchNames = branchIds.map(id => {
    const branch = servicesStore.selectedClient!.sucursales.find((b: any) => b.id === id)
    return branch ? branch.nombre : id
  })

  return branchNames.join(', ')
}

// Función auxiliar para obtener nombres de sucursales en la bandeja de solicitudes pendientes
const getBranchNamesForRequest = (branchIds?: string[], clientId?: string) => {
  if (!branchIds || branchIds.length === 0) return 'Todas las sucursales'

  const client = servicesStore.clientList.find((c: any) => c.id === clientId)
  if (!client || !client.sucursales) return branchIds.join(', ')

  const branchNames = branchIds.map((id: string) => {
    if (id === 'Principal') return 'Principal'
    const branch = client.sucursales?.find((b: any) => b.id === id || b.nombre === id)
    return branch ? branch.nombre : id
  })

  return branchNames.join(', ')
}
</script>

<template>
  <section class="services-page space-y-4">
    <header class="flex flex-wrap items-center justify-between gap-3 py-2">
      <div class="flex items-center gap-3">
        <span class="service-icon grid size-12 shrink-0 place-items-center rounded-xl text-xl"><i class="fas fa-bug" aria-hidden="true"></i></span>
        <div>
          <h1 class="text-2xl font-extrabold tracking-tight sm:text-3xl">Servicios</h1>
          <p class="muted mt-1 text-sm">Consulta y administra las fichas de servicio por cliente.</p>
        </div>
      </div>
      <div class="flex flex-wrap gap-2">
        <button v-if="canApprovePrices" type="button" class="service-button" aria-haspopup="dialog" @click="priceFeedback = ''; priceDialog?.showModal()">
          <i class="fas fa-dollar-sign" aria-hidden="true"></i> Precios pendientes
          <span class="service-chip price-chip">{{ servicesStore.pendingPriceRequests.length }}</span>
        </button>
        <button type="button" class="service-button primary" :disabled="!servicesStore.serviceSheet || servicesStore.loadingSheet || servicesStore.savingSheet"
          @click="openCreateModal"><i class="fas fa-plus" aria-hidden="true"></i> Nuevo servicio</button>
      </div>
    </header>

    <div v-if="servicesStore.serviceSheet" class="grid gap-3 sm:grid-cols-3">
      <article v-for="item in summary" :key="item.label" class="service-panel flex items-center gap-3 p-4">
        <span class="service-icon grid size-10 shrink-0 place-items-center rounded-lg"><i class="fas" :class="item.icon" aria-hidden="true"></i></span>
        <div><p class="muted text-sm">{{ item.label }}</p><p class="text-xl font-extrabold tabular-nums">{{ item.value }}</p></div>
      </article>
    </div>

    <section class="service-panel grid gap-3 p-4 sm:grid-cols-[2fr_1fr_1fr]" aria-label="Filtros de servicios">
      <div ref="searchResultsContainer" class="relative min-w-0">
        <label for="clientSearchInput" class="mb-1 block text-xs font-semibold">Cliente</label>
        <input id="clientSearchInput" v-model="searchTerm" type="search" class="service-field"
          placeholder="Buscar cliente por nombre…" autocomplete="off" :disabled="selectingClient || servicesStore.savingSheet"
          @focus="handleFocus" @input="showClientResults = true" @keydown.esc.stop="showClientResults = false" />
        <div v-if="showClientResults" class="service-panel absolute z-20 mt-1 max-h-64 w-full overflow-y-auto shadow-lg">
          <button v-for="client in filteredClients" :key="client.id" type="button" class="result-row w-full px-3 py-2 text-left text-sm"
            @click="handleSelectClient(client.id)">
            <strong class="block">{{ client.nombreComercial }}</strong>
            <span class="muted text-xs">{{ client.ciudad || 'Sin ciudad' }}</span>
          </button>
          <p v-if="!filteredClients.length" class="muted p-3 text-sm">{{ servicesStore.loadingClients ? 'Cargando clientes…' : 'No se encontraron clientes.' }}</p>
        </div>
      </div>
      <label class="grid gap-1 text-xs font-semibold">Estado
        <select v-model="statusFilter" class="service-field" :disabled="!servicesStore.serviceSheet">
          <option value="">Todos</option><option>Activo</option><option>Inactivo</option><option>Completado</option>
        </select>
      </label>
      <label class="grid gap-1 text-xs font-semibold">Sucursal
        <select v-model="branchFilter" class="service-field" :disabled="!servicesStore.serviceSheet">
          <option value="">Todas</option>
          <option value="Principal">Principal</option>
          <option v-for="branch in servicesStore.selectedClient?.sucursales ?? []" :key="branch.id" :value="branch.id">{{ branch.nombre }}</option>
        </select>
      </label>
    </section>

    <section class="service-panel overflow-hidden" aria-label="Ficha de servicios">
      <p v-if="servicesStore.loadingSheet || servicesStore.loadingClients" class="muted p-8 text-center text-sm" role="status">Cargando servicios…</p>
      <p v-else-if="!servicesStore.serviceSheet" class="muted p-8 text-center text-sm" :role="servicesStore.error ? 'alert' : undefined">
        {{ servicesStore.error || 'Selecciona un cliente para consultar sus servicios.' }}
      </p>
      <template v-else>
        <header class="service-divider flex flex-wrap items-center justify-between gap-2 p-4">
          <div>
            <p class="muted text-xs">Ficha de servicio</p>
            <h2 class="text-lg font-bold">{{ servicesStore.selectedClient?.nombreComercial || servicesStore.serviceSheet.clientName }}</h2>
          </div>
          <span class="muted text-xs">{{ visibleServices.length }} servicios</span>
        </header>
        <p v-if="!visibleServices.length" class="muted p-8 text-center text-sm">No hay servicios para esta selección.</p>
        <div v-else class="overflow-x-auto">
          <table class="service-table w-full text-left text-sm">
            <thead><tr><th scope="col">Servicio</th><th scope="col">Frecuencia</th><th scope="col">Sucursales</th><th scope="col">Estado</th><th scope="col">Valor</th><th scope="col">Acciones</th></tr></thead>
            <tbody>
              <tr v-for="{ service, index } in visibleServices" :key="service.id ?? index">
                <td><button type="button" class="service-link text-left font-bold" @click="openDetail(service, index)">{{ service.tipo_servicio }}</button>
                  <p v-if="service.estado_servicio === 'Activo' && service.frecuencia !== 'UNICA'" class="muted mt-1 text-xs">Revisar agenda</p></td>
                <td>{{ service.frecuencia }}</td>
                <td>{{ getBranchNames(service.sucursales_asignadas) }}</td>
                <td><span class="service-chip" :data-state="service.estado_servicio">{{ service.estado_servicio }}</span></td>
                <td><span v-if="isPricePending(service)" class="service-chip price-chip">Por asignar</span><span v-else>{{ currency.format(service.valor) }}</span></td>
                <td>
                  <div class="flex gap-1">
                    <button type="button" class="service-button service-action" aria-label="Editar servicio" @click="openEditModal(service, index)"><i class="fas fa-edit" aria-hidden="true"></i></button>
                    <button type="button" class="service-button service-action" aria-label="Quitar servicio de la ficha" @click="handleDeleteService(index)"><i class="fas fa-trash-alt" aria-hidden="true"></i></button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <footer class="service-footer flex flex-wrap items-center justify-between gap-2 px-4 py-3">
          <span class="muted text-sm">{{ servicesStore.hasUnsavedChanges ? 'Tienes cambios sin guardar.' : 'Ficha al día' }}</span>
          <button type="button" class="service-button primary" :disabled="!servicesStore.hasUnsavedChanges || servicesStore.savingSheet" @click="handleSaveSheet">
            {{ servicesStore.savingSheet ? 'Guardando…' : 'Guardar cambios de la ficha' }}
          </button>
        </footer>
      </template>
    </section>

    <dialog v-if="canApprovePrices" ref="priceDialog" class="service-dialog service-panel" aria-labelledby="prices-title"
      @cancel.prevent="!assigningPrice && priceDialog?.close()">
      <header class="dialog-heading">
        <div><h2 id="prices-title" class="text-xl font-extrabold">Precios pendientes</h2><p class="muted mt-1 text-sm">Selecciona un servicio para asignarle un valor.</p></div>
        <button type="button" class="service-button" aria-label="Cerrar precios pendientes" autofocus :disabled="assigningPrice" @click="priceDialog?.close()">✕</button>
      </header>
      <div class="dialog-content">
        <div v-if="priceFeedback" class="mb-3 flex flex-wrap items-center gap-2 text-sm" role="alert">
          <span>{{ priceFeedback }}</span>
          <button type="button" class="service-button" @click="priceFeedback = ''; servicesStore.fetchPendingPriceRequests()">Actualizar</button>
        </div>
        <p v-if="!servicesStore.pendingPriceRequests.length" class="muted text-sm">{{ servicesStore.loadingSheet ? 'Consultando solicitudes…' : 'No hay solicitudes pendientes.' }}</p>
        <ul v-else class="space-y-2">
          <li v-for="request in servicesStore.pendingPriceRequests" :key="request.serviceSheetId + ':' + request.serviceIndex"
            class="service-panel flex flex-wrap items-center justify-between gap-3 p-3">
            <div class="min-w-0"><p class="font-bold">{{ request.clientName }}</p>
              <p class="muted text-sm">{{ request.service.tipo_servicio }}</p>
              <p class="muted text-xs">{{ getBranchNamesForRequest(request.service.sucursales_asignadas, request.clientId) }}</p>
            </div>
            <button type="button" class="service-button primary" :disabled="assigningPrice || selectingClient || servicesStore.savingSheet" @click="handlePriceRequest(request)">Asignar precio</button>
          </li>
        </ul>
      </div>
    </dialog>

    <dialog ref="detailDialog" class="service-dialog service-panel" aria-labelledby="service-detail-title">
      <header class="dialog-heading">
        <div><p class="muted text-xs">Detalle del servicio</p><h2 id="service-detail-title" class="text-xl font-extrabold">{{ detail?.service.tipo_servicio }}</h2></div>
        <button type="button" class="service-button" aria-label="Cerrar detalle" autofocus @click="detailDialog?.close()">✕</button>
      </header>
      <div v-if="detail" class="dialog-content">
        <dl class="grid gap-4 text-sm sm:grid-cols-2">
          <div><dt class="muted">Cliente</dt><dd class="font-semibold">{{ servicesStore.serviceSheet?.clientName }}</dd></div>
          <div><dt class="muted">Sucursales</dt><dd class="font-semibold">{{ getBranchNames(detail.service.sucursales_asignadas) }}</dd></div>
          <div><dt class="muted">Frecuencia</dt><dd class="font-semibold">{{ detail.service.frecuencia }}</dd></div>
          <div><dt class="muted">Estado</dt><dd class="font-semibold">{{ detail.service.estado_servicio }}</dd></div>
          <div><dt class="muted">Valor</dt><dd class="font-semibold">{{ isPricePending(detail.service) ? 'Pendiente de asignación' : currency.format(detail.service.valor) }}</dd></div>
          <div v-if="detail.service.recurrence"><dt class="muted">Visitas por periodo</dt><dd class="font-semibold">{{ detail.service.recurrence.visitsPerPeriod }}</dd></div>
        </dl>
        <div class="mt-5 flex justify-end"><button type="button" class="service-button primary" @click="editDetail">Editar servicio</button></div>
      </div>
    </dialog>

    <ServiceFormModal :show="showModal" :service="editingService" :service-index="editingServiceIndex" :price-mode="priceMode"
      @close="showModal = false" @save="handleSaveService" />
  </section>
</template>

<style scoped>
.services-page { color: var(--shell-text); --service-accent: #b8000b; --service-tint: #fff0f1; }
[data-theme='dark'] .services-page { color-scheme: dark; --service-accent: #ff858b; --service-tint: #412328; }
.service-panel { border: 1px solid var(--shell-border); border-radius: 0.9rem; background: var(--shell-surface); }
.service-icon { color: var(--service-accent); background: var(--service-tint); }
.muted { color: var(--shell-muted); }
.service-button, .service-field {
  min-height: 2.5rem; border: 1px solid var(--shell-border); border-radius: 0.55rem;
  padding: 0.45rem 0.7rem; background: var(--shell-surface); color: var(--shell-text);
}
.service-field { width: 100%; font-size: 0.875rem; font-weight: 400; }
.service-button { display: inline-flex; align-items: center; justify-content: center; gap: 0.45rem; font-size: 0.8rem; font-weight: 650; }
.service-button:hover, .result-row:hover, .service-table tbody tr:hover { background: var(--shell-input); }
.service-button:disabled, .service-field:disabled { opacity: 0.55; cursor: default; }
.primary { border-color: #bc000b; background: #c7000c; color: #fff; }
.primary:hover { background: #a9000a; }
.service-action { min-height: 2rem; padding: 0.25rem 0.5rem; }
.service-link:hover { color: var(--service-accent); text-decoration: underline; }
.service-button:focus-visible, .service-field:focus-visible, .service-link:focus-visible, .result-row:focus-visible { outline: 2px solid #e50914; outline-offset: -2px; }
.service-table th, .service-table td { padding: 0.75rem; border-bottom: 1px solid var(--shell-border); vertical-align: middle; }
.service-table td:first-child { min-width: 11rem; }
.service-table th { background: var(--shell-input); font-size: 0.75rem; white-space: nowrap; }
.service-divider { border-bottom: 1px solid var(--shell-border); }
.service-footer { border-top: 1px solid var(--shell-border); }
.service-chip { display: inline-block; padding: 0.18rem 0.5rem; border-radius: 999px; font-size: 0.7rem; font-weight: 700; background: var(--shell-input); color: var(--shell-muted); }
.service-chip[data-state='Activo'], .service-chip[data-state='Completado'] { color: #086534; background: #dbf2e4; }
.price-chip { color: #824302; background: #fff0d9; }
[data-theme='dark'] .price-chip { color: #ffce83; background: #513419; }
[data-theme='dark'] .service-chip[data-state='Activo'], [data-theme='dark'] .service-chip[data-state='Completado'] { color: #a4e9b9; background: #173c27; }
.service-dialog { width: min(43rem, calc(100vw - 2rem)); max-height: calc(100dvh - 2rem); padding: 0; margin: auto; color: var(--shell-text); box-shadow: 0 24px 64px #0005; }
.service-dialog::backdrop { background: #0009; }
.dialog-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; padding: 1rem; border-bottom: 1px solid var(--shell-border); background: linear-gradient(115deg, var(--service-tint), var(--shell-surface) 72%); }
.dialog-content { max-height: min(34rem, 65dvh); overflow-y: auto; padding: 1rem; }
</style>
