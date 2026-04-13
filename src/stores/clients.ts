import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { httpsCallable } from 'firebase/functions'
import { functions } from '@/firebase/config'
import router from '@/router'

// Define la estructura de un cliente para que TypeScript nos ayude
export interface Client {
  id: string
  nombreComercial: string
  ciudad: string
  zona: string
  estado: string
  // Añadimos más campos para el perfil
  departamento?: string
  sucursales?: { nombre: string; direccion: string }[]
  contactoPrincipal?: { nombre: string; celular: string; email: string }
  contactoFinanciero?: { nombre: string; celular: string; email: string }
}

// Interfaz para los datos del perfil que vienen de la Cloud Function
interface ClientProfileData {
  client: Client
  serviceSheet: { services: unknown[] } | null
  upcomingVisits: unknown[]
  visitHistory: unknown[]
}

export const useClientsStore = defineStore('clients', () => {
  // --- State ---
  const clients = ref<Client[]>([])
  const loading = ref(false)
  const loadingProfile = ref(false)
  const error = ref<string | null>(null)
  // Paginación para la lista principal de clientes
  const currentPage = ref(1)
  const lastDocId = ref<string | null>(null)
  const pageHistory = ref<(string | null)[]>([null]) // Historial de cursores para paginación hacia atrás
  const isLastPage = ref(false)

  // Estado para el perfil del cliente seleccionado
  const selectedClientProfile = ref<ClientProfileData | null>(null)

  // --- Getters ---

  /**
   * Carga una página de clientes.
   */
  async function fetchClients(options: {
    status?: string
    searchTerm?: string
    zone?: string
    direction?: 'next' | 'prev' | 'reset'
  }) {
    loading.value = true
    error.value = null

    if (options.direction === 'reset' || !options.direction) {
      currentPage.value = 1
      pageHistory.value = [null]
      lastDocId.value = null
    } else if (options.direction === 'prev') {
      if (currentPage.value > 1) {
        currentPage.value--
      }
    } else if (options.direction === 'next' && !isLastPage.value) {
      currentPage.value++
    }

    try {
      // Asumimos que tienes una Cloud Function llamada 'getClientsPage'
      // que replica la lógica de tu 'clientController.js' original.
      const getClientsPage = httpsCallable(functions, 'getClientsPage')
      const result = await getClientsPage({
        status: options.status,
        searchTerm: options.searchTerm,
        zone: options.zone,
        startAfterDocId: pageHistory.value[currentPage.value - 1],
        direction: 'next', // El backend siempre va hacia adelante, la paginación hacia atrás la gestiona el historial
      })

      clients.value = (result.data as { clients: Client[] }).clients

      // Actualizar estado de paginación
      if (clients.value.length > 0) {
        const lastClient = clients.value[clients.value.length - 1]
        if (lastClient) lastDocId.value = lastClient.id
        if (pageHistory.value.length === currentPage.value) {
          pageHistory.value.push(lastDocId.value)
        }
      }
      isLastPage.value = clients.value.length < 12 // Asumiendo PAGE_SIZE = 12
    } catch (err: unknown) {
      console.error('Error al obtener los clientes:', err)
      if (err instanceof Error) {
        error.value = 'No se pudieron cargar los clientes. ' + err.message
      } else if (typeof err === 'object' && err !== null && 'message' in err) {
        error.value = 'No se pudieron cargar los clientes. ' + (err as { message: string }).message
      } else {
        error.value = 'No se pudieron cargar los clientes.'
      }
    } finally {
      loading.value = false
    }
  }

  async function fetchClientProfile(clientId: string) {
    loadingProfile.value = true
    selectedClientProfile.value = null
    try {
      const getProfileData = httpsCallable(functions, 'getClientProfileData')
      const result = await getProfileData({ clientId })
      selectedClientProfile.value = result.data as ClientProfileData
    } catch (err: unknown) {
      console.error('Error al obtener el perfil del cliente:', err)
      if (err instanceof Error) {
        error.value = 'No se pudo cargar el perfil del cliente. ' + err.message
      } else if (typeof err === 'object' && err !== null && 'message' in err) {
        error.value =
          'No se pudo cargar el perfil del cliente. ' + (err as { message: string }).message
      } else {
        error.value = 'No se pudo cargar el perfil del cliente.'
      }
    } finally {
      loadingProfile.value = false
    }
  }

  /**
   * Actualiza el estado de un cliente (Activo/Inactivo).
   */
  async function updateClientStatus(clientId: string, status: 'Activo' | 'Inactivo') {
    try {
      const updateClient = httpsCallable(functions, 'updateClient')
      await updateClient({ clientId, clientData: { estado: status } })
    } catch (err: any) {
      console.error('Error al actualizar el estado del cliente:', err)
      throw new Error('No se pudo actualizar el estado del cliente. ' + err.message)
    }
  }

  /**
   * Elimina permanentemente un cliente y todos sus datos asociados.
   */
  async function deleteClient(clientId: string) {
    try {
      const deleteClientFn = httpsCallable(functions, 'deleteClientAndRelatedData')
      await deleteClientFn({ clientId })
    } catch (err: any) {
      console.error('Error al eliminar el cliente:', err)
      throw new Error('No se pudo eliminar el cliente. ' + err.message)
    }
  }

  /**
   * Procesa un archivo Excel e importa los clientes en lotes.
   */
  async function importClients(
    clientsData: any[],
    onProgress: (progress: { message: string; percentage: number }) => void,
  ) {
    const batchSize = 400 // Límite seguro para Firestore
    const totalBatches = Math.ceil(clientsData.length / batchSize)
    let totalImported = 0
    const allErrors: { row: number; error: string }[] = []

    const batchImportFn = httpsCallable(functions, 'batchImportClients')

    for (let i = 0; i < totalBatches; i++) {
      const start = i * batchSize
      const end = start + batchSize
      const batch = clientsData.slice(start, end)

      onProgress({
        message: `Procesando lote ${i + 1} de ${totalBatches}...`,
        percentage: Math.round(((i + 1) / totalBatches) * 100),
      })

      try {
        const result = (await batchImportFn({ clients: batch })) as {
          data: { imported: number; errors: { row: number; error: string }[] }
        }
        totalImported += result.data.imported || 0
        if (result.data.errors && result.data.errors.length > 0) {
          allErrors.push(...result.data.errors)
        }
      } catch (error: any) {
        // Si toda la función de nube falla, registrar un error para el lote completo.
        allErrors.push({ row: start + 2, error: `Error de servidor en el lote: ${error.message}` })
      }
    }

    return { totalImported, errors: allErrors }
  }

  return {
    clients,
    loading,
    loadingProfile,
    error,
    currentPage,
    isLastPage,
    selectedClientProfile,
    fetchClients,
    fetchClientProfile,
    updateClientStatus,
    deleteClient,
    importClients,
  }
})
