import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { httpsCallable } from 'firebase/functions'
import { functions } from '@/firebase/config'

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
  isUrgent?: boolean
  [key: string]: any // Para otros campos
}

export interface Client {
  id: string
  nombreComercial: string
  zona: string
  direccion: string
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

  // --- Getters ---
  const allCalendarEvents = computed(() => {
    const internalEvents = monthlyVisits.value.map((v) => ({
      id: v.id,
      title: v.nombre_cliente,
      start: new Date(v.fecha_visita as string),
      end: new Date(new Date(v.fecha_visita as string).getTime() + 60 * 60 * 1000), // Asumir 1 hora
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
  ) {
    loading.value = true
    error.value = null
    needsAuthRefresh.value = false

    try {
      const getPlanningDataFn = httpsCallable(functions, 'getConsolidatedPlanningData')
      const result = (await getPlanningDataFn({
        year,
        month,
        zone,
        calendarTargetUid,
      })) as {
        data: {
          monthlyVisits: Visit[]
          pendingVisits: Visit[]
          clients: Client[]
          technicians: Technician[]
          googleEvents?: GoogleEvent[]
          needsAuthRefresh?: boolean
        }
      }

      if (result.data.needsAuthRefresh) {
        needsAuthRefresh.value = true
        return
      }

      monthlyVisits.value = result.data.monthlyVisits || []
      pendingVisits.value = result.data.pendingVisits || []
      clients.value = result.data.clients || []
      technicians.value = result.data.technicians || []
      googleEvents.value = result.data.googleEvents || []
    } catch (err: any) {
      console.error('Error en fetchPlanningData:', err)
      error.value = `No se pudieron cargar los datos: ${err.message}`
    } finally {
      loading.value = false
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
      await saveVisitFn({ visitId: visitData.id, visitData: dataToSend })
    } else {
      await saveVisitFn({ visitData: dataToSend })
    }
  }

  /**
   * Elimina una visita y su evento de calendario asociado.
   */
  async function deleteVisit(visitId: string) {
    const deleteVisitFn = httpsCallable(functions, 'deleteVisitAndCalendarEvent')
    await deleteVisitFn({ visitId })
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
    await completeVisitFn({ visitId })
    // Actualiza el estado en el store para que la UI reaccione inmediatamente
    const eventIndex = allCalendarEvents.value.findIndex((e) => e.id === visitId)
    const eventToUpdate = allCalendarEvents.value[eventIndex]
    if (eventToUpdate && eventToUpdate.source === 'internal') {
      ;(eventToUpdate.extendedProps as Visit).estado_visita = 'Realizada'
    }
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
    clearCalendarData,
    saveVisitTemplate,
    deleteVisitTemplate,
    fetchVisitTemplates,
    fetchVisitHistory,
  }
})
