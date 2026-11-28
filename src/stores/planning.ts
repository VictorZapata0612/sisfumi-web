/* eslint-disable @typescript-eslint/no-explicit-any */
import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { httpsCallable } from 'firebase/functions'
import { functions } from '@/firebase/config'
import { useAuthStore } from '@/stores/auth'

// ✅ NUEVO: reintento automático para llamadas a Cloud Functions.
// Motivo: cuando una función lleva un rato sin tráfico, Cloud Run la escala
// a 0 instancias. La primera petición (el preflight OPTIONS) puede tardar
// más de lo tolerado en lo que arranca una instancia nueva, y responde 503
// sin headers de CORS — el navegador lo reporta como error de CORS aunque
// el problema real es un "cold start". Reintentar una vez tras una breve
// espera resuelve el caso sin que el usuario vea nada.
function isLikelyColdStartError(err: any): boolean {
  const code = err?.code || ''
  const message = String(err?.message || '')
  return (
    code === 'functions/internal' ||
    code === 'functions/unavailable' ||
    code === 'functions/deadline-exceeded' ||
    message.toLowerCase().includes('cors') ||
    message.toLowerCase().includes('failed to fetch') ||
    message.toLowerCase().includes('network')
  )
}

async function callWithRetry<T>(
  fn: () => Promise<T>,
  retries = 1,
  delayMs = 1500,
): Promise<T> {
  try {
    return await fn()
  } catch (err: any) {
    if (retries > 0 && isLikelyColdStartError(err)) {
      await new Promise((resolve) => setTimeout(resolve, delayMs))
      return callWithRetry(fn, retries - 1, delayMs)
    }
    throw err
  }
}

// --- Interfaces para un tipado fuerte ---

export interface Visit {
  id: string
  id_cliente: string
  nombre_cliente: string
  fecha_visita: string | Date
  tipo_visita: string
  ubicacion: string
  zona: string
  estado_visita: 'Programada' | 'Realizada' | 'Cancelada'
  fumigadores_asignados: string[]
  duracion_minutos?: number
  isUrgent?: boolean
  [key: string]: any // Para otros campos
}

export interface Client {
  id: string
  nombreComercial: string
  ciudad?: string
  zona: string
  direccion: string
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  serviceSheet?: { services: Service[] }
  sucursales?: { nombre: string; direccion: string; zona: string }[]
}

export interface Technician {
  id: string
  nombreCompleto: string
  googleColorId?: string
  color?: string
}

export interface Service {
  id?: string
  tipo_servicio: string
  frecuencia: string
  estado_servicio: 'Activo' | 'Inactivo' | 'Completado'
  [key: string]: any
}

export interface GoogleEvent {
  summary: string
  start: string | Date
  end: string | Date
  htmlLink?: string
  source: 'google'
}

export interface VisitTemplate {
  id: string
  templateName: string
  notesOnly?: boolean
  tipo_visita: string
  notas_visita?: string
}

export interface VisitHistoryLog {
  id: string
  timestamp: { toDate: () => Date }
  userEmail: string
  action: string
  details: string
}

export const usePlanningStore = defineStore('planning', () => {
  // --- State ---
  const loading = ref(false)
  const error = ref<string | null>(null)
  const monthlyVisits = ref<Visit[]>([])
  const pendingVisits = ref<Visit[]>([])
  const clients = ref<Client[]>([])
  const technicians = ref<Technician[]>([])
  const googleEvents = ref<GoogleEvent[]>([])
  const needsAuthRefresh = ref(false)
  const visitTemplates = ref<VisitTemplate[]>([])
  const selectedCalendarUid = ref('internal')
  const lastSyncUpdate = ref(0) // Para la sincronización bidireccional

  const calendarLoading = ref(false)
  const calendarError = ref(false)
  const clientsLoading = ref(false)
  const clientsError = ref(false)
  const clientsReady = ref(false)
  let latestRequest = 0
  let clientsScope = ''
  let clientsRequest: Promise<void> | undefined
  let clientsLoadedAt = 0

  const getPlanningData = httpsCallable<Record<string, unknown>, {
    monthlyVisits?: Visit[]
    pendingVisits?: Visit[]
    clients?: Client[]
    technicians?: Technician[]
    googleEvents?: GoogleEvent[]
    needsAuthRefresh?: boolean
  }>(functions, 'getConsolidatedPlanningData')

  // --- Getters ---
  const allCalendarEvents = computed(() => {
    const internalEvents = monthlyVisits.value.map((v) => ({
      id: v.id,
      title: v.nombre_cliente,
      start: new Date(v.fecha_visita as string),
      end: new Date(
        new Date(v.fecha_visita as string).getTime() + (v.duracion_minutos || 60) * 60 * 1000,
      ),
      source: 'internal',
      extendedProps: v, // Guardar todos los datos de la visita
    }))
    // ✅ CORRECCIÓN: Procesar y combinar los eventos de Google.
    const externalEvents = googleEvents.value.map((e) => ({
      id: `google-${e.summary}-${e.start}`, // Crear un ID único
      title: e.summary,
      start: new Date(e.start as string),
      end: new Date(e.end as string),
      source: 'google',
      color: '#f59e0b', // Asignar un color distintivo (ámbar)
      extendedProps: { htmlLink: e.htmlLink },
    })) as any[]
    return [...internalEvents, ...externalEvents]
  })

  // --- Actions ---

  /**
   * Carga todos los datos necesarios para la vista de planeación.
   */
  async function fetchPlanningData(
    year: number,
    month: number,
    zone: string,
    calendarTargetUid: string | null,
    dateRange?: { startDateISO: string; endDateISO: string },
  ) {
    const requestId = ++latestRequest
    const auth = useAuthStore()
    const scope = JSON.stringify([auth.user?.uid, auth.userRole, auth.userZone, zone])
    if (scope !== clientsScope) {
      clientsScope = scope
      clientsRequest = undefined
      clientsLoadedAt = 0
      clientsReady.value = false
      clients.value = []
      monthlyVisits.value = []
      pendingVisits.value = []
      technicians.value = []
    }

    loading.value = true
    error.value = null
    calendarLoading.value = false
    calendarError.value = false
    needsAuthRefresh.value = false
    googleEvents.value = []

    const params = { year, month, zone, ...dateRange }
    if (!clientsRequest && (!clientsLoadedAt || Date.now() - clientsLoadedAt >= 60_000)) {
      clientsLoading.value = true
      clientsError.value = false
      const catalogRequest = callWithRetry(() => getPlanningData({ ...params, section: 'clients' }))
        .then(({ data }) => {
          if (clientsRequest !== catalogRequest) return
          clients.value = data.clients || []
          clientsLoadedAt = Date.now()
          clientsReady.value = true
        })
        .catch((err: unknown) => {
          if (clientsRequest !== catalogRequest) return
          console.error('Error al cargar el catálogo de Planeación:', err)
          clientsError.value = true
        })
        .finally(() => {
          if (clientsRequest !== catalogRequest) return
          clientsLoading.value = false
          clientsRequest = undefined
        })
      clientsRequest = catalogRequest
    }

    if (calendarTargetUid && calendarTargetUid !== 'internal') {
      calendarLoading.value = true
      void callWithRetry(() => getPlanningData({ ...params, calendarTargetUid, section: 'google' }))
        .then(({ data }) => {
          if (requestId !== latestRequest) return
          needsAuthRefresh.value = !!data.needsAuthRefresh
          googleEvents.value = data.googleEvents || []
        })
        .catch((err: unknown) => {
          if (requestId !== latestRequest) return
          console.error('Error al cargar Google Calendar:', err)
          calendarError.value = true
        })
        .finally(() => {
          if (requestId === latestRequest) calendarLoading.value = false
        })
    }

    try {
      const { data } = await callWithRetry(() => getPlanningData({ ...params, section: 'visits' }))
      if (requestId !== latestRequest) return
      monthlyVisits.value = data.monthlyVisits || []
      pendingVisits.value = data.pendingVisits || []
      technicians.value = data.technicians || []
    } catch (err: unknown) {
      if (requestId !== latestRequest) return
      console.error('Error al cargar las visitas:', err)
      error.value = 'No se pudieron cargar las visitas.'
    } finally {
      if (requestId === latestRequest) loading.value = false
    }
  }

  /**
   * Obtiene las plantillas de visita.
   */
  async function fetchVisitTemplates() {
    try {
      const getTemplatesFn = httpsCallable(functions, 'getVisitTemplates')
      const result = (await getTemplatesFn()) as { data: { templates: VisitTemplate[] } }
      visitTemplates.value = result.data.templates || []
    } catch (err) {
      console.error('Error fetching visit templates:', err)
    }
  }

  /**
   * Guarda (crea o actualiza) una plantilla de visita.
   */
  async function saveVisitTemplate(templateData: Omit<VisitTemplate, 'id'> & { id?: string }) {
    const saveTemplateFn = httpsCallable(functions, 'saveVisitTemplate')
    await saveTemplateFn({ templateData })
    // After saving, refresh the list
    await fetchVisitTemplates()
  }

  /**
   * Elimina una plantilla de visita.
   */
  async function deleteVisitTemplate(templateId: string) {
    const deleteTemplateFn = httpsCallable(functions, 'deleteVisitTemplate')
    await deleteTemplateFn({ templateId })
    // After deleting, refresh the list
    await fetchVisitTemplates()
  }

  /**
   * Crea o actualiza una visita.
   */
  async function saveVisit(visitData: Omit<Visit, 'id'> & { id?: string }) {
    const functionName = visitData.id ? 'updateVisit' : 'createVisit'
    const saveVisitFn = httpsCallable(functions, functionName)

    // Asegurarse de que la fecha se envíe en un formato que Firestore entienda (ISO string)
    const dataToSend = {
      ...visitData,
      fecha_visita: new Date(visitData.fecha_visita).toISOString(),
    }

    if (visitData.id) {
      await callWithRetry(() => saveVisitFn({ visitId: visitData.id, visitData: dataToSend }))
    } else {
      await callWithRetry(() => saveVisitFn({ visitData: dataToSend }))
    }
  }

  /**
   * Elimina una visita y su evento de calendario asociado.
   */
  async function deleteVisit(visitId: string) {
    const deleteVisitFn = httpsCallable(functions, 'deleteVisitAndCalendarEvent')
    await callWithRetry(() => deleteVisitFn({ visitId }))
  }

  /**
   * Limpia los datos del calendario, útil al cambiar de mes.
   */
  function clearCalendarData() {
    monthlyVisits.value = []
    googleEvents.value = []
  }

  /**
   * Asigna múltiples visitas a un grupo de técnicos.
   */
  async function batchAssignVisits(visitIds: string[], technicians: string[]) {
    if (visitIds.length === 0 || technicians.length === 0) {
      throw new Error('Se requieren visitas y técnicos para la asignación.')
    }
    const batchAssignFn = httpsCallable(functions, 'batchAssignVisits')
    await batchAssignFn({ visitIds, technicians })
  }

  /**
   * Marca una visita como completada rápidamente.
   */
  async function quickCompleteVisit(visitId: string) {
    const completeVisitFn = httpsCallable(functions, 'quickCompleteVisit')
    await callWithRetry(() => completeVisitFn({ visitId }))
    // Actualiza el estado en el store para que la UI reaccione inmediatamente
    const eventIndex = allCalendarEvents.value.findIndex((e) => e.id === visitId)
    const eventToUpdate = allCalendarEvents.value[eventIndex]
    if (eventToUpdate && eventToUpdate.source === 'internal') {
      ;(eventToUpdate.extendedProps as Visit).estado_visita = 'Realizada'
    }
  }

  async function completeVisitsByDay(date: string, zone: string) {
    const completeDay = httpsCallable<{ date: string; zone: string }, { completedIds: string[] }>(
      functions, 'completeVisitsByDay',
    )
    const { data } = await completeDay({ date, zone })
    const ids = new Set(data.completedIds)
    for (const visit of monthlyVisits.value) {
      if (ids.has(visit.id)) visit.estado_visita = 'Realizada'
    }
    pendingVisits.value = pendingVisits.value.filter(visit => !ids.has(visit.id))
    return ids.size
  }

  /**
   * Obtiene el historial de cambios para una visita específica.
   */
  async function fetchVisitHistory(visitId: string): Promise<VisitHistoryLog[]> {
    try {
      const getHistoryFn = httpsCallable(functions, 'getVisitHistory')
      const result = (await getHistoryFn({ visitId })) as {
        data: { history: VisitHistoryLog[] }
      }
      return result.data.history || []
    } catch (err: any) {
      console.error(`Error fetching history for visit ${visitId}:`, err)
      // Devuelve un array vacío en caso de error para no romper la UI
      return []
    }
  }

  return {
    loading,
    error,
    calendarLoading,
    calendarError,
    clientsLoading,
    clientsError,
    clientsReady,
    monthlyVisits,
    pendingVisits,
    clients,
    technicians,
    googleEvents,
    needsAuthRefresh,
    allCalendarEvents,
    visitTemplates,
    lastSyncUpdate,
    selectedCalendarUid,
    fetchPlanningData,
    saveVisit,
    deleteVisit,
    batchAssignVisits,
    quickCompleteVisit,
    completeVisitsByDay,
    clearCalendarData,
    saveVisitTemplate,
    deleteVisitTemplate,
    fetchVisitTemplates,
    fetchVisitHistory,
  }
})
