import { ref } from 'vue'
import { defineStore } from 'pinia'
import { httpsCallable } from 'firebase/functions'
import { functions } from '@/firebase/config'

// --- Interfaces para Tipado ---

export interface Technician {
  id: string
  nombreCompleto: string
  zona: string
  email?: string
  telefono?: string
  googleColorId?: string
}

export interface TechnicianProfile {
  kpis: {
    assigned: number
    completed: number
    rate: number
  }
  workload: number[]
  upcomingVisits: any[]
  recentHistory: any[]
  technician: Technician
}

// --- Store de Pinia ---

export const useTechniciansStore = defineStore('technicians', () => {
  // --- State ---
  const technicians = ref<Technician[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  // Paginación
  const currentPage = ref(1)
  const isLastPage = ref(false)
  const pageHistory = ref<(string | null)[]>([null]) // Historial de cursores

  // Perfil
  const selectedProfile = ref<TechnicianProfile | null>(null)
  const loadingProfile = ref(false)

  // --- Actions ---

  /**
   * Carga una página de técnicos con filtros y paginación.
   */
  async function fetchTechnicians(options: {
    zoneFilter?: string | null
    searchTerm?: string
    direction?: 'next' | 'prev' | 'reset'
  }) {
    loading.value = true
    error.value = null

    if (options.direction === 'reset' || !options.direction) {
      currentPage.value = 1
      pageHistory.value = [null]
    } else if (options.direction === 'prev' && currentPage.value > 1) {
      currentPage.value--
    } else if (options.direction === 'next' && !isLastPage.value) {
      currentPage.value++
    }

    try {
      const getFumigadoresPage = httpsCallable(functions, 'getFumigadoresPage')
      const result = (await getFumigadoresPage({
        zone: options.zoneFilter,
        searchTerm: options.searchTerm,
        startAfterDocId: pageHistory.value[currentPage.value - 1],
        direction: 'next',
      })) as { data: { technicians: Technician[] } }

      const newTechnicians = result.data.technicians || []
      technicians.value = newTechnicians

      if (newTechnicians.length > 0) {
        const lastDocId = newTechnicians[newTechnicians.length - 1]?.id
        if (lastDocId && pageHistory.value.length === currentPage.value) {
          pageHistory.value.push(lastDocId)
        }
      }
      isLastPage.value = newTechnicians.length < 15 // Asumiendo PAGE_SIZE = 15
    } catch (err: any) {
      error.value = `Error al cargar técnicos: ${err.message}`
    } finally {
      loading.value = false
    }
  }

  /**
   * Añade un nuevo técnico.
   */
  async function addTechnician(technicianData: Omit<Technician, 'id'>) {
    const addFn = httpsCallable(functions, 'addFumigador')
    await addFn({ technicianData })
  }

  /**
   * Actualiza un técnico existente.
   */
  async function updateTechnician(technicianId: string, technicianData: Partial<Technician>) {
    const updateFn = httpsCallable(functions, 'updateFumigador')
    await updateFn({ technicianId, technicianData })
  }

  /**
   * Elimina un técnico.
   */
  async function deleteTechnician(technicianId: string) {
    const deleteFn = httpsCallable(functions, 'deleteFumigador')
    await deleteFn({ technicianId })
  }

  /**
   * Carga los datos de perfil y rendimiento de un técnico para un mes específico.
   */
  async function fetchTechnicianProfile(technicianId: string, month: number, year: number) {
    loadingProfile.value = true
    try {
      const getProfileFn = httpsCallable(functions, 'getTechnicianProfileData')
      const result = (await getProfileFn({ technicianId, month, year })) as {
        data: TechnicianProfile
      }
      selectedProfile.value = result.data
    } catch (err: any) {
      error.value = `Error al cargar perfil: ${err.message}`
    } finally {
      loadingProfile.value = false
    }
  }

  return {
    technicians,
    loading,
    error,
    currentPage,
    isLastPage,
    selectedProfile,
    loadingProfile,
    fetchTechnicians,
    addTechnician,
    updateTechnician,
    deleteTechnician,
    fetchTechnicianProfile,
  }
})
