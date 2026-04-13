import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { httpsCallable } from 'firebase/functions'
import { useAuthStore } from './auth'
import { functions } from '@/firebase/config'
import { db } from '@/firebase/config'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'

// --- Interfaces para Tipado ---

interface Client {
  id: string
  nombreComercial: string
  [key: string]: any
}

export interface Service {
  tipo_servicio: string
  frecuencia: string
  valor: number
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
      const params: { status: string; zone?: string } = { status: 'Activo' }

      // Si el rol es de un coordinador de zona (no Nacionales), filtramos por su zona.
      if (
        authStore.userRole?.startsWith('Coordinador') &&
        authStore.userRole !== 'Coordinador Nacionales'
      ) {
        params.zone = authStore.userZone || undefined
      }

      const result = (await getClientsFn(params)) as { data: { clients: Client[] } }
      clients.value = result.data.clients.sort((a, b) =>
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
  async function fetchServiceSheet(clientId: string) {
    if (!clientId) return
    loadingSheet.value = true
    error.value = null
    selectedClient.value = clients.value.find((c) => c.id === clientId) || null

    try {
      const getSheetFn = httpsCallable(functions, 'getServiceSheetByClientId')
      const result = (await getSheetFn({ clientId })) as { data: ServiceSheet | null }

      if (result.data) {
        serviceSheet.value = result.data
      } else if (selectedClient.value) {
        // Si no existe, creamos una ficha vacía en memoria
        serviceSheet.value = {
          clientId: selectedClient.value.id,
          clientName: selectedClient.value.nombreComercial,
          zona: selectedClient.value.zona,
          services: [],
        }
      }
      hasUnsavedChanges.value = false
    } catch (err: any) {
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

    if (index === -1) {
      serviceSheet.value.services.push(service)
    } else {
      serviceSheet.value.services[index] = service
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
      authStore.userRole === 'Coordinador Nacionales'

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
