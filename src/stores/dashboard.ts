import { ref } from 'vue'
import { defineStore } from 'pinia'
import { httpsCallable } from 'firebase/functions'
import { useAuthStore } from '@/stores/auth'
import { functions } from '@/firebase/config'

// Definimos las interfaces para que TypeScript nos ayude con la estructura de datos
interface Kpis {
  totalClients: number
  activeServices: number
  visitsThisMonth: number
  completionRateThisMonth: number
  revenueThisMonth: number
}

interface Charts {
  [key: string]: unknown // Se mantiene 'any' aquí porque la estructura de los gráficos es muy variable.
}

// Definimos una interfaz para las visitas, basada en los datos que esperamos.
interface Visit {
  id: string
  id_cliente: string
  nombre_cliente: string
  tipo_visita: string
  fecha_visita: string // Esperamos un string en formato ISO
  fumigadores_asignados?: string[]
}

// Definimos la estructura de la respuesta de la Cloud Function
interface DashboardData {
  kpis: Kpis
  charts: Charts
  todaysAgenda: Visit[]
  pendingVisits: Visit[]
}

export const useDashboardStore = defineStore('dashboard', () => {
  // --- State ---
  const kpis = ref<Kpis | null>(null)
  const charts = ref<Charts | null>(null)
  const todaysAgenda = ref<Visit[]>([])
  const pendingVisits = ref<Visit[]>([])
  const loading = ref(true)
  const error = ref<string | null>(null)

  // --- Actions ---
  async function fetchDashboardData() {
    loading.value = true
    error.value = null
    const authStore = useAuthStore()

    try {
      const getDashboardData = httpsCallable(functions, 'getConsolidatedDashboardStats')
      // La Cloud Function espera la fecha del cliente para evitar desajustes de zona horaria.
      const today = new Date()
      const clientDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

      const params: { clientDate: string; zone?: string } = { clientDate }
      // Si el rol es de un coordinador de zona (no Nacionales), filtramos por su zona.
      if (
        authStore.userRole?.startsWith('Coordinador') &&
        authStore.userRole !== 'Coordinador Nacionales'
      ) {
        params.zone = authStore.userZone || undefined
      }

      const result = await getDashboardData(params)
      const data = result.data as DashboardData

      kpis.value = data.kpis
      charts.value = data.charts
      todaysAgenda.value = data.todaysAgenda
      pendingVisits.value = data.pendingVisits
    } catch (err: unknown) {
      console.error('Error al obtener los datos del dashboard:', err)
      if (err instanceof Error) {
        error.value = 'No se pudieron cargar los datos del dashboard. ' + err.message
      } else {
        error.value = 'No se pudieron cargar los datos del dashboard.'
      }
    } finally {
      loading.value = false
    }
  }

  return { kpis, charts, todaysAgenda, pendingVisits, loading, error, fetchDashboardData }
})
