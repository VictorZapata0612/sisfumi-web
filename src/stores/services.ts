<<<<<<< HEAD
/* eslint-disable @typescript-eslint/no-explicit-any */
=======
>>>>>>> c933029 (Initial commit)
import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { httpsCallable } from 'firebase/functions'
import { useAuthStore } from './auth'
import { functions } from '@/firebase/config'
<<<<<<< HEAD
=======
import { db } from '@/firebase/config'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
>>>>>>> c933029 (Initial commit)

// --- Interfaces para Tipado ---

interface Client {
  id: string
  nombreComercial: string
  [key: string]: any
}

export interface Service {
<<<<<<< HEAD
  id?: string
  tipo_servicio: string
  frecuencia: string
  valor: number
  recurrence?: {
    unit: 'WEEK' | 'MONTH'
    interval: number
    visitsPerPeriod: number
    preferredDays?: number[]
    schedulingMode?: 'FIXED' | 'FLEXIBLE'
    toleranceDays?: number
    allowWeekends?: boolean
  }
  billing?: {
    model: 'PER_VISIT' | 'FIXED_PERIOD' | 'INCLUDED_PLUS_ADDITIONAL'
    periodValue?: number
    includedVisits?: number
    additionalVisitValue?: number
  }
=======
  tipo_servicio: string
  frecuencia: string
  valor: number
>>>>>>> c933029 (Initial commit)
  estado_servicio: 'Activo' | 'Inactivo' | 'Completado'
  sucursales_asignadas: string[]
  needsPriceApproval?: boolean
  requesterUid?: string
}

export interface ServiceSheet {
  id?: string
  clientId: string
  clientName: string
  zona: string
  services: Service[]
}

export interface PendingPriceRequest {
  clientId: string
  clientName: string
  serviceSheetId: string
  serviceIndex: number
  service: Service
}

<<<<<<< HEAD
const createStableId = (prefix: string) => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return `${prefix}-${crypto.randomUUID()}`
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

=======
>>>>>>> c933029 (Initial commit)
// --- Store de Pinia ---

export const useServicesStore = defineStore('services', () => {
  // --- State ---
  const clients = ref<Client[]>([])
  const selectedClient = ref<Client | null>(null)
  const serviceSheet = ref<ServiceSheet | null>(null)
  const pendingPriceRequests = ref<PendingPriceRequest[]>([])
  const loadingClients = ref(false)
  const loadingSheet = ref(false)
  const savingSheet = ref(false)
  const error = ref<string | null>(null)
  const hasUnsavedChanges = ref(false)

  // --- Getters ---
  const clientList = computed(() => clients.value)

<<<<<<< HEAD
  const normalizeClient = (client: Client): Client => ({
    ...client,
    sucursales: Array.isArray(client.sucursales)
      ? client.sucursales.map((branch: any, index: number) => ({
        ...branch,
        id: branch.id || `${client.id}-branch-${index + 1}`,
      }))
      : [],
  })

  const normalizeSheet = (sheet: ServiceSheet): ServiceSheet => ({
    ...sheet,
    services: (Array.isArray(sheet.services) ? sheet.services : []).map((service, index) => ({
      ...service,
      id: service.id || `${sheet.clientId}-service-${index + 1}`,
      sucursales_asignadas: Array.isArray(service.sucursales_asignadas)
        ? service.sucursales_asignadas
        : [],
    })),
  })

=======
>>>>>>> c933029 (Initial commit)
  // --- Actions ---

  /**
   * Carga la lista de clientes activos para el selector.
   */
  async function fetchClients() {
    const authStore = useAuthStore()
    // Para coordinadores, siempre recargamos para asegurar que el filtro de zona se aplique
    // si navegan entre vistas. Para otros roles, mantenemos el caché.
    if (clients.value.length > 0 && !authStore.userRole?.startsWith('Coordinador')) return

    loadingClients.value = true
    error.value = null
    try {
      const getClientsFn = httpsCallable(functions, 'getClientsPage')
<<<<<<< HEAD
      const params: { status: string; pageSize: number; zone?: string } = {
        status: 'Activo',
        pageSize: 1000,
      }
=======
      const params: { status: string; zone?: string } = { status: 'Activo' }
>>>>>>> c933029 (Initial commit)

      // Si el rol es de un coordinador de zona (no Nacionales), filtramos por su zona.
      if (
        authStore.userRole?.startsWith('Coordinador') &&
        authStore.userRole !== 'Coordinador Nacionales'
      ) {
        params.zone = authStore.userZone || undefined
      }

      const result = (await getClientsFn(params)) as { data: { clients: Client[] } }
<<<<<<< HEAD
      clients.value = result.data.clients.map(normalizeClient).sort((a, b) =>
=======
      clients.value = result.data.clients.sort((a, b) =>
>>>>>>> c933029 (Initial commit)
        a.nombreComercial.localeCompare(b.nombreComercial),
      )
    } catch (err: any) {
      error.value = err.message || 'Error al cargar los clientes.'
    } finally {
      loadingClients.value = false
    }
  }

  /**
   * Carga la ficha de servicio para un cliente específico.
   */
<<<<<<< HEAD
  async function fetchServiceSheet(clientId: string): Promise<void> {
    if (!clientId) return
    loadingSheet.value = true
    error.value = null
    serviceSheet.value = null
    hasUnsavedChanges.value = false
=======
  async function fetchServiceSheet(clientId: string) {
    if (!clientId) return
    loadingSheet.value = true
    error.value = null
>>>>>>> c933029 (Initial commit)
    selectedClient.value = clients.value.find((c) => c.id === clientId) || null

    try {
      const getSheetFn = httpsCallable(functions, 'getServiceSheetByClientId')
      const result = (await getSheetFn({ clientId })) as { data: ServiceSheet | null }

      if (result.data) {
<<<<<<< HEAD
        serviceSheet.value = normalizeSheet(result.data)
=======
        serviceSheet.value = result.data
>>>>>>> c933029 (Initial commit)
      } else if (selectedClient.value) {
        // Si no existe, creamos una ficha vacía en memoria
        serviceSheet.value = {
          clientId: selectedClient.value.id,
          clientName: selectedClient.value.nombreComercial,
          zona: selectedClient.value.zona,
          services: [],
        }
      }
<<<<<<< HEAD
    } catch (err: any) {
      serviceSheet.value = null
=======
      hasUnsavedChanges.value = false
    } catch (err: any) {
>>>>>>> c933029 (Initial commit)
      error.value = err.message || 'Error al cargar la ficha de servicio.'
    } finally {
      loadingSheet.value = false
    }
  }

  /**
   * Guarda la ficha de servicio (crea o actualiza).
   */
  async function saveServiceSheet() {
    if (!serviceSheet.value) return
<<<<<<< HEAD
    if (!serviceSheet.value.clientId || !selectedClient.value) throw new Error('No hay un cliente válido seleccionado.')
=======
>>>>>>> c933029 (Initial commit)
    savingSheet.value = true
    error.value = null
    try {
      const saveSheetFn = httpsCallable(functions, 'saveServiceSheet')

      // ✅ CORRECCIÓN: Convertir a objeto plano para evitar problemas de serialización con Proxies de Vue
      const sheetData = JSON.parse(JSON.stringify(serviceSheet.value))

      const result = (await saveSheetFn({ sheetData })) as {
        data: { success: boolean; sheetId?: string }
      }

      // ✅ Sincronizar ID: Si era una ficha nueva, ahora ya tiene ID oficial.
      if (result.data.sheetId && serviceSheet.value) {
        serviceSheet.value.id = result.data.sheetId
      }

      hasUnsavedChanges.value = false
    } catch (err: any) {
      console.error('Error guardando ficha:', err)
      error.value = err.message || 'Error al guardar la ficha.'
      throw err // Relanzar para que el componente lo maneje
    } finally {
      savingSheet.value = false
    }
  }

  /**
   * Añade o actualiza un servicio en la ficha local.
   */
  function upsertService(service: Service, index: number) {
    const authStore = useAuthStore()
    if (!serviceSheet.value) return

    // Lógica para Solicitud de Precio
    // Si el usuario es un coordinador de zona y el valor es 0, se marca para aprobación.
    const isZoneCoordinator =
      authStore.userRole?.startsWith('Coordinador') &&
      authStore.userRole !== 'Coordinador Nacionales'

    if (isZoneCoordinator && service.valor === 0) {
      service.needsPriceApproval = true
      service.requesterUid = authStore.user?.uid
    }

<<<<<<< HEAD
    const serviceToSave = {
      ...service,
      id: service.id || createStableId(`${serviceSheet.value.clientId}-service`),
      sucursales_asignadas: service.sucursales_asignadas || [],
    }

    if (index === -1) {
      serviceSheet.value.services.push(serviceToSave)
    } else {
      serviceSheet.value.services[index] = serviceToSave
=======
    if (index === -1) {
      serviceSheet.value.services.push(service)
    } else {
      serviceSheet.value.services[index] = service
>>>>>>> c933029 (Initial commit)
    }
    hasUnsavedChanges.value = true
  }

  /**
   * Elimina un servicio de la ficha local.
   */
  function deleteService(index: number) {
    if (serviceSheet.value) {
      serviceSheet.value.services.splice(index, 1)
      hasUnsavedChanges.value = true
    }
  }

  /**
   * Carga la lista de servicios pendientes de asignación de precio.
   */
  async function fetchPendingPriceRequests() {
    const authStore = useAuthStore()
    const canView =
      authStore.userRole === 'Administrador' ||
      authStore.userRole === 'Jefe' ||
<<<<<<< HEAD
      authStore.userRole === 'Coordinador Nacionales' ||
      authStore.userRole === 'Coordinador Nacional' ||
      authStore.userRole === 'Gerente'
=======
      authStore.userRole === 'Coordinador Nacionales'
>>>>>>> c933029 (Initial commit)

    if (!canView) return

    loadingSheet.value = true // Reutilizamos el loading
    try {
      const getPendingFn = httpsCallable(functions, 'getPendingPriceRequests')
      const result = (await getPendingFn()) as { data: { requests: PendingPriceRequest[] } }
      pendingPriceRequests.value = result.data.requests
    } catch (err: any) {
      error.value = err.message || 'Error al cargar las solicitudes pendientes.'
    } finally {
      loadingSheet.value = false
    }
  }

  return {
    clientList,
    selectedClient,
    serviceSheet,
    loadingClients,
    loadingSheet,
    savingSheet,
    error,
    hasUnsavedChanges,
    pendingPriceRequests,
    fetchClients,
    fetchServiceSheet,
    saveServiceSheet,
    upsertService,
    deleteService,
    fetchPendingPriceRequests,
  }
})
