<script setup lang="ts">
import { ref, onMounted, computed, watch, onUnmounted } from 'vue'
import { usePlanningStore, type Visit, type Technician } from '@/stores/planning'
import { useAuthStore } from '@/stores/auth'
import { useSettingsStore } from '@/stores/settings'
import { storeToRefs } from 'pinia'
import VisitFormModal from '@/components/VisitFormModal.vue'
import { useToast } from '@/composables/useToast'
import { useDialog } from '@/composables/useDialog'

defineOptions({ name: 'PlanningView' })

const planningStore = usePlanningStore()
const authStore = useAuthStore()
const settingsStore = useSettingsStore()
const { showToast } = useToast()
const { showDialog } = useDialog()

// ✅ Mapeo de colores para los técnicos
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

const { loading, error, allCalendarEvents, pendingVisits, technicians, needsAuthRefresh } =
  storeToRefs(planningStore)

const currentDate = ref(new Date())
const selectedDate = ref<Date | null>(new Date())
const selectedZone = ref('Todos')
const selectedTechnician = ref('todos')
const dayEventsStatusFilter = ref<'Todos' | 'Programada' | 'Realizada' | 'Cancelada'>('Todos')
const calendarViewMode = ref<'month' | 'week' | 'agenda'>('month')
const calendarView = ref<'month' | 'week' | 'agenda'>('month')
const selectedCalendarUid = ref('internal')

const showCreateModal = ref(false)
const showEditModal = ref(false)
const editingVisit = ref(null)

// --- Nuevos estados para las funcionalidades solicitadas ---
const selectedVisitIds = ref<string[]>([])
const isAssigning = ref(false)
const isSavingVisit = ref(false)
const isCompleting = ref<string | null>(null)

// --- Estados UI ---
const showDayDetailsModal = ref(false) // Para móvil
const isMobile = ref(false)

// --- Estados para el tooltip de resumen de eventos ---
const hoveredDay = ref<{ date: Date; events: any[] } | null>(null)
const tooltipPosition = ref({ top: '0px', left: '0px' })
const tooltipTimeout = ref<number | null>(null)

// Detectar móvil
const checkMobile = () => {
  isMobile.value = window.innerWidth < 1024
}

const handleCalendarChange = () => {
  const selectedOption = (document.getElementById('calendarAccountSelector') as HTMLSelectElement)?.selectedOptions[0];
  const coordinatorZone = selectedOption?.dataset.zona;

  if (coordinatorZone) {
    selectedZone.value = coordinatorZone;
  }

  loadData();
}

onMounted(async () => {
  if (authStore.userRole?.startsWith('Coordinador')) {
    selectedZone.value = authStore.userZone || 'Todos'
  }
  await settingsStore.fetchIntegrations()
  loadData()

  window.addEventListener('resize', checkMobile)
  checkMobile()
})

onUnmounted(() => {
  window.removeEventListener('resize', checkMobile)
})

const currentMonthDisplay = computed(() =>
  currentDate.value.toLocaleString('es-ES', { month: 'long', year: 'numeric' }),
)

const calendarGridDays = computed(() => {
  const year = currentDate.value.getFullYear()
  const month = currentDate.value.getMonth()
  const days = []

  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)

  const startDayOfWeek = firstDay.getDay()
  const endDayOfWeek = lastDay.getDay()

  // Días del mes anterior
  for (let i = startDayOfWeek; i > 0; i--) {
    const date = new Date(year, month, 1 - i)
    days.push({ date, isCurrentMonth: false })
  }

  // Días del mes actual
  for (let i = 1; i <= lastDay.getDate(); i++) {
    const date = new Date(year, month, i)
    days.push({ date, isCurrentMonth: true })
  }

  // Días del mes siguiente
  for (let i = 1; i < 7 - endDayOfWeek; i++) {
    const date = new Date(year, month + 1, i)
    days.push({ date, isCurrentMonth: false })
  }

  return days
})

const daysInWeek = computed(() => {
  const start = selectedDate.value || new Date()
  const dayOfWeek = start.getDay()
  const weekStart = new Date(start)
  weekStart.setDate(start.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1)) // Lunes como inicio de semana

  const weekDays = []
  for (let i = 0; i < 7; i++) {
    const date = new Date(weekStart)
    date.setDate(weekStart.getDate() + i)
    weekDays.push({ date, isCurrentMonth: true })
  }
  return weekDays
})

const agendaEvents = computed(() => {
  const events = (allCalendarEvents.value as any[])
    .filter((event) => {
      const eventDate = new Date(event.start)
      return (
        eventDate.getMonth() === currentDate.value.getMonth() &&
        eventDate.getFullYear() === currentDate.value.getFullYear()
      )
    })
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
  return events
})

const eventsByDay = computed(() => {
  const eventsMap = new Map<number, any[]>()
  const filteredEvents =
    selectedTechnician.value === 'todos'
      ? allCalendarEvents.value
      : allCalendarEvents.value.filter((e: any) =>
        e.source === 'google'
          ? true
          : e.extendedProps?.fumigadores_asignados?.includes(selectedTechnician.value),
      )

  filteredEvents.forEach((event) => {
    const day = new Date(event.start).getDate()
    // Aseguramos que el evento sea del mes actual para el mapa
    const eventDate = new Date(event.start)
    if (eventDate.getMonth() === currentDate.value.getMonth() && eventDate.getFullYear() === currentDate.value.getFullYear()) {
      if (!eventsMap.has(day)) {
        eventsMap.set(day, [])
      }
      eventsMap.get(day)?.push(event)
    }
  })
  return eventsMap
})

const isToday = (day: Date) => {
  const today = new Date()
  return (
    day.getDate() === today.getDate() &&
    day.getMonth() === today.getMonth() &&
    day.getFullYear() === today.getFullYear()
  )
}

const selectedDateEvents = computed(() => {
  if (!selectedDate.value) return []
  // Para obtener eventos del día seleccionado, filtramos sobre todos los eventos
  // porque eventsByDay solo tiene índices del mes actual visualizado
  const targetDateStr = selectedDate.value.toDateString()

  const events = allCalendarEvents.value.filter(e => {
    return new Date(e.start).toDateString() === targetDateStr
  })

  if (selectedTechnician.value !== 'todos') {
    return events.filter((e: any) =>
      e.source === 'google'
        ? true
        : e.extendedProps?.fumigadores_asignados?.includes(selectedTechnician.value),
    ).sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
  }

  return events.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
})

const isWeekend = (date: Date) => {
  const day = date.getDay()
  return day === 0 || day === 6
}

const filteredSelectedDateEvents = computed(() => {
  if (dayEventsStatusFilter.value === 'Todos') {
    return selectedDateEvents.value
  }
  return selectedDateEvents.value.filter((event) => {
    if (event.source === 'google') {
      return false
    }
    return event.extendedProps?.estado_visita === dayEventsStatusFilter.value
  })
}
)

const statusCounts = computed(() => {
  const counts = {
    Todos: selectedDateEvents.value.length,
    Programada: 0,
    Realizada: 0,
    Cancelada: 0,
  }
  selectedDateEvents.value.forEach((event) => {
    if (event.source === 'internal') {
      const status = event.extendedProps?.estado_visita
      if (status && counts.hasOwnProperty(status)) {
        ; (counts as any)[status]++
      }
    }
  })
  return counts
})

const getVisitFromEvent = (event: any): Visit | null => {
  if (event.source === 'internal' && event.extendedProps) return event.extendedProps
  return null
}

const getTechnicianColor = (techName: string | undefined): string => {
  if (!techName) return '#4a5568'
  const technician = (technicians.value as Technician[]).find(
    (t: any) => t.nombreCompleto === techName,
  )
  if (technician) {
    if (technician.color) return technician.color
    if (technician.googleColorId) return googleCalendarColors[technician.googleColorId] || '#4a5568'
  }
  return '#4a5568'
}

const getEventStyle = (event: any) => {
  const backgroundColor =
    event.source === 'google'
      ? '#f59e0b'
      : getTechnicianColor(event.extendedProps?.fumigadores_asignados?.[0]) || '#4a5568'

  let height = 'auto'
  if (event.start && event.end) {
    const start = new Date(event.start)
    const end = new Date(event.end)
    const durationInMinutes = (end.getTime() - start.getTime()) / (1000 * 60)
    const calculatedHeight = Math.max(40, Math.min(durationInMinutes * 1.5, 400))
    height = `${calculatedHeight}px`
  }

  return { backgroundColor, height, minHeight: '40px' }
}

const loadData = () => {
  planningStore.fetchPlanningData(
    currentDate.value.getFullYear(),
    currentDate.value.getMonth(),
    selectedZone.value,
    selectedCalendarUid.value,
  )
}

watch(
  () => planningStore.lastSyncUpdate,
  (newVal, oldVal) => {
    if (newVal > oldVal) {
      loadData()
    }
  },
)

watch(needsAuthRefresh, (newVal) => {
  if (newVal) {
    showDialog({
      title: 'Reconexión Necesaria',
      message: 'Tu conexión con Google Calendar ha expirado. Por favor, vuelve a conectar tu cuenta.',
      isConfirmation: true,
      confirmationText: 'Reconectar',
      onConfirm: () => {
        if (authStore.user?.uid) {
          authStore.connectGoogleAccount(import.meta.env.VITE_GOOGLE_CLIENT_ID, authStore.user.uid)
        }
      },
    })
  }
}
)

const changeMonth = (offset: number) => {
  currentDate.value.setMonth(currentDate.value.getMonth() + offset)
  currentDate.value = new Date(currentDate.value)
  planningStore.clearCalendarData()
  loadData()
}

const selectDay = (day: { date: Date; isCurrentMonth?: boolean }) => {
  if (!day.isCurrentMonth) {
    currentDate.value = new Date(day.date.getFullYear(), day.date.getMonth(), 1)
    selectedDate.value = day.date
    loadData()
  } else {
    selectedDate.value = day.date
  }

  // ✅ MOBILE: Abrir modal al seleccionar día
  if (isMobile.value) {
    showDayDetailsModal.value = true
  }
}

const goToToday = () => {
  const today = new Date()
  const isSameMonth =
    today.getMonth() === currentDate.value.getMonth() &&
    today.getFullYear() === currentDate.value.getFullYear()

  if (calendarView.value === 'month' && !isSameMonth) {
    selectDay({ date: today, isCurrentMonth: false })
  } else {
    selectedDate.value = today
    if (isMobile.value) showDayDetailsModal.value = true
  }
}

const openCreateModal = () => {
  editingVisit.value = null
  showCreateModal.value = true
}

const showGoogleEventDetails = (event: any) => {
  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('es-CO', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
  }
  showDialog({
    title: 'Detalle del Evento de Google',
    message: `<strong>Título:</strong> ${event.title}<br><strong>Inicio:</strong> ${formatTime(event.start)}<br><strong>Fin:</strong> ${formatTime(event.end)}<br><br><a href="${event.extendedProps.htmlLink}" target="_blank" class="btn btn-primary bg-blue-600 mt-4">Ver en Google Calendar</a>`,
  })
}

const openEditModal = (event: any) => {
  if (event.source === 'google') {
    showGoogleEventDetails(event)
    return
  }
  const visitWithHistory = { ...event, history: [] }
  planningStore
    .fetchVisitHistory(event.id)
    .then((history: any) => (visitWithHistory.history = history))
  editingVisit.value = visitWithHistory

  // Cerrar modal de detalles si está abierto (móvil)
  showDayDetailsModal.value = false

  showEditModal.value = true
}

const handleSaveVisit = async (visitData: any) => {
  if (isSavingVisit.value) return
  isSavingVisit.value = true
  try {
    await planningStore.saveVisit(visitData) // @ts-ignore
    showToast({ title: 'Éxito', message: 'Visita guardada correctamente.', type: 'success' })
    showCreateModal.value = false
    showEditModal.value = false
    loadData()
  } catch (error: any) {
    showToast({
      title: 'Error',
      message: `No se pudo guardar la visita: ${error.message}`,
      type: 'error',
    })
  } finally {
    isSavingVisit.value = false
  }
}

const handleDeleteVisit = async (visitId: string) => {
  showDialog({
    title: 'Confirmar Eliminación',
    message: '¿Está seguro de que desea eliminar esta visita?',
    isConfirmation: true,
    confirmationText: 'Sí, Eliminar',
    async onConfirm() {
      try {
        await planningStore.deleteVisit(visitId)
        showToast({ title: 'Éxito', message: 'Visita eliminada.', type: 'success' })
        showEditModal.value = false
        loadData()
      } catch (error: any) {
        showToast({ title: 'Error', message: error.message, type: 'error' })
      }
    },
  })
}

const handleBatchAssign = () => {
  const selectedTechnicians: string[] = []
  showDialog({
    title: 'Asignar Técnicos en Bloque',
    message: `Selecciona los técnicos para asignar a las ${selectedVisitIds.value.length} visitas.`,
    isConfirmation: true,
    confirmationText: 'Asignar',
    technicianSelection: {
      available: technicians.value,
      selected: [],
    },
    async onConfirm() {
      if (selectedTechnicians.length === 0) return
      isAssigning.value = true
      try {
        await planningStore.batchAssignVisits(selectedVisitIds.value, selectedTechnicians)
        showToast({ title: 'Éxito', message: 'Asignación completada.', type: 'success' })
        selectedVisitIds.value = []
        loadData()
      } catch (error: any) {
        showToast({ title: 'Error', message: error.message, type: 'error' })
      } finally {
        isAssigning.value = false
      }
    },
  })
}

const showTooltip = (event: MouseEvent, day: { date: Date }) => {
  if (isMobile.value) return // No tooltip on mobile

  if (tooltipTimeout.value) clearTimeout(tooltipTimeout.value)
  const dayNumber = day.date.getDate()
  const events = (eventsByDay.value.get(dayNumber) || []).sort(
    (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime(),
  )
  if (events.length > 0) {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
    // Ajustar posición para que no se salga
    let left = rect.right + 10
    if (left + 220 > window.innerWidth) left = rect.left - 230

    tooltipPosition.value = {
      top: `${rect.top + window.scrollY}px`,
      left: `${left}px`,
    }
    hoveredDay.value = { date: day.date, events }
  }
}

const hideTooltip = () => {
  tooltipTimeout.value = window.setTimeout(() => {
    hoveredDay.value = null
  }, 200)
}

const cancelTooltipHide = () => {
  if (tooltipTimeout.value) clearTimeout(tooltipTimeout.value)
}

const handleQuickComplete = (visit: Visit) => {
  showDialog({
    title: 'Completar Visita',
    message: `¿Marcar visita a "${visit.nombre_cliente}" como "Realizada"?`,
    isConfirmation: true,
    confirmationText: 'Sí, Completar',
    async onConfirm() {
      isCompleting.value = visit.id // @ts-ignore
      try {
        await planningStore.quickCompleteVisit(visit.id) // @ts-ignore
        const eventToUpdate = allCalendarEvents.value.find((e) => e.id === visit.id)
        if (eventToUpdate && eventToUpdate.source === 'internal') {
          eventToUpdate.extendedProps.estado_visita = 'Realizada'
        }
        showToast({ title: 'Éxito', message: 'Visita completada.', type: 'success' })
      } catch (error: any) {
        showToast({ title: 'Error', message: error.message, type: 'error' })
      } finally {
        isCompleting.value = null
      }
    },
  })
}
</script>

<template>
  <div class="h-full bg-[#0a0a0a] text-gray-100 flex flex-col p-4 md:p-6 overflow-hidden">
    <!-- Header Responsive -->
    <header class="flex-shrink-0 mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
      <div>
        <h2 class="text-2xl md:text-3xl font-bold text-white flex items-center gap-3">
          Planeación
          <button @click="loadData" class="text-sm bg-[#151515] p-2 rounded-full hover:text-[#d60000] transition-colors"
            title="Recargar">
            <i class="fas fa-sync-alt"></i>
          </button>
        </h2>
        <p class="text-sm text-gray-400 mt-1">Gestión de agenda y rutas</p>
      </div>

      <!-- Botonera Acciones en Bloque -->
      <div v-if="selectedVisitIds.length > 0"
        class="flex items-center gap-2 bg-blue-900/30 p-2 rounded-lg border border-blue-500/50 w-full md:w-auto justify-between">
        <span class="text-sm font-bold text-blue-200 px-2">{{ selectedVisitIds.length }} seleccionadas</span>
        <div class="flex gap-2">
          <button @click="handleBatchAssign" class="btn btn-primary bg-blue-600 hover:bg-blue-700 text-xs py-1.5"
            :disabled="isAssigning">
            <i v-if="isAssigning" class="fas fa-spinner fa-spin mr-1"></i>
            <i v-else class="fas fa-users mr-1"></i> Asignar
          </button>
          <button @click="selectedVisitIds = []" class="btn btn-icon btn-danger text-xs py-1.5">
            <i class="fas fa-times"></i>
          </button>
        </div>
      </div>

      <!-- Filtros Responsivos -->
      <div class="flex flex-wrap items-center gap-3 w-full md:w-auto">
        <select v-model="selectedZone" @change="loadData" class="input-field-dark text-sm py-1.5 w-full sm:w-auto">
          <option value="Todos">Todas las Zonas</option>
          <option v-for="zone in settingsStore.businessData.businessZones" :key="zone.name" :value="zone.name">{{
            zone.name }}</option>
        </select>

        <select v-model="selectedTechnician" class="input-field-dark text-sm py-1.5 w-full sm:w-auto">
          <option value="todos">Todos los Técnicos</option>
          <option v-for="tech in technicians" :key="tech.id" :value="tech.nombreCompleto">{{ tech.nombreCompleto }}
          </option>
        </select>

        <!-- ✅ NUEVO: Selector de Calendario para Admins/Jefes -->
        <div v-if="authStore.userRole === 'Administrador' || authStore.userRole === 'Jefe'">
          <select id="calendarAccountSelector" v-model="selectedCalendarUid" @change="handleCalendarChange"
            class="input-field-dark text-sm py-1.5 w-full sm:w-auto">
            <option value="internal">Calendario de la Aplicación</option>
            <option v-for="coord in settingsStore.integrations" :key="coord.uid" :value="coord.uid"
              :data-zona="coord.zona">{{ coord.googleUserName }}</option>
          </select>
        </div>

        <button @click="openCreateModal" class="btn btn-primary bg-[#d60000] w-full sm:w-auto justify-center shadow-lg">
          <i class="fas fa-plus mr-2"></i>Nueva Visita
        </button>
      </div>
    </header>

    <!-- Contenido Principal (Grid Adaptable) -->
    <main class="flex-grow grid grid-cols-1 lg:grid-cols-3 gap-6 overflow-hidden min-h-0">

      <!-- Columna Izquierda: Calendario -->
      <div class="lg:col-span-2 bg-[#151515] rounded-xl shadow-lg border border-white/10 flex flex-col overflow-hidden">

        <!-- Toolbar Calendario -->
        <div
          class="p-4 border-b border-white/10 bg-[#0a0a0a]/30 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div class="flex items-center gap-2 bg-white/5 p-1 rounded-lg shrink-0">
            <button @click="changeMonth(-1)" class="p-2 hover:text-white text-gray-400"><i
                class="fas fa-chevron-left"></i></button>
            <span class="w-32 text-center font-bold capitalize select-none text-sm md:text-base">{{ currentMonthDisplay
            }}</span>
            <button @click="changeMonth(1)" class="p-2 hover:text-white text-gray-400"><i
                class="fas fa-chevron-right"></i></button>
          </div>

          <div class="flex gap-2 bg-white/5 p-1 rounded-lg text-xs font-medium shrink-0">
            <button @click="calendarView = 'month'" class="px-3 py-1.5 rounded transition-colors"
              :class="calendarView === 'month' ? 'bg-[#d60000] text-white shadow' : 'text-gray-400 hover:text-white'">Mes</button>
            <button @click="calendarView = 'week'" class="px-3 py-1.5 rounded transition-colors"
              :class="calendarView === 'week' ? 'bg-[#d60000] text-white shadow' : 'text-gray-400 hover:text-white'">Semana</button>
            <button @click="calendarView = 'agenda'" class="px-3 py-1.5 rounded transition-colors"
              :class="calendarView === 'agenda' ? 'bg-[#d60000] text-white shadow' : 'text-gray-400 hover:text-white'">Agenda</button>
          </div>

          <button @click="goToToday" class="text-xs text-[#d60000] hover:text-red-400 font-bold underline shrink-0">Ir a
            Hoy</button>
        </div>

        <!-- Vista MES -->
        <div v-if="calendarView === 'month'" class="flex-grow flex flex-col overflow-hidden">
          <!-- Días Semana -->
          <div class="grid grid-cols-7 border-b border-white/10 bg-[#151515]/80 text-center py-2 shrink-0">
            <span v-for="day in ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']" :key="day"
              class="text-xs font-bold text-gray-500 uppercase">{{ day }}</span>
          </div>

          <!-- Grid Días -->
          <div class="grid grid-cols-7 flex-grow overflow-y-auto">
            <div v-for="(day, index) in calendarGridDays" :key="index" @click="selectDay(day)"
              @mouseenter="showTooltip($event, day)" @mouseleave="hideTooltip"
              class="relative border-b border-r border-white/10 min-h-[60px] md:min-h-[100px] p-1 md:p-2 cursor-pointer transition-colors hover:bg-white/5 flex flex-col"
              :class="{
                'bg-[#0a0a0a]/40': !day.isCurrentMonth,
                'ring-1 ring-inset ring-[#d60000]/50 bg-red-900/10': selectedDate?.toDateString() === day.date.toDateString()
              }">
              <span class="text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full mb-1"
                :class="isToday(day.date) ? 'bg-[#d60000] text-white shadow-lg' : 'text-gray-400'">
                {{ day.date.getDate() }}
              </span>

              <!-- Contenedor Eventos -->
              <div class="flex-grow flex flex-col gap-1 overflow-hidden">
                <div class="flex-grow relative w-full">
                  <!-- VISTA MÓVIL: Puntos/Indicadores Compactos -->
                  <div class="md:hidden flex flex-wrap gap-1 content-start absolute inset-0">
                    <div v-for="event in eventsByDay.get(day.date.getDate())?.slice(0, 8)" :key="event.id"
                      class="w-1.5 h-1.5 rounded-full" :class="event.source === 'google' ? 'bg-yellow-500' : ''"
                      :style="event.source !== 'google' ? { backgroundColor: getEventStyle(event).backgroundColor } : {}">
                    </div>
                  </div>

                  <!-- VISTA ESCRITORIO: Barras de Texto -->
                  <div class="hidden md:flex flex-col gap-1 absolute inset-0 overflow-hidden">
                    <div v-for="event in eventsByDay.get(day.date.getDate())?.slice(0, 3)" :key="event.id"
                      class="text-[10px] px-1.5 py-0.5 rounded truncate text-white shadow-sm border-l-2 leading-tight opacity-90 hover:opacity-100"
                      :style="{
                        backgroundColor: event.source === 'google' ? '#f59e0b80' : `${getEventStyle(event).backgroundColor}80`,
                        borderColor: event.source === 'google' ? '#f59e0b' : getEventStyle(event).backgroundColor
                      }">
                      {{ event.title }}
                    </div>
                    <span v-if="(eventsByDay.get(day.date.getDate())?.length || 0) > 3"
                      class="text-[9px] text-gray-500 pl-1">
                      +{{ (eventsByDay.get(day.date.getDate())?.length || 0) - 3 }} más
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Vista SEMANA (Con scroll horizontal para móviles) -->
        <div v-else-if="calendarView === 'week'" class="flex-grow overflow-auto">
          <div class="min-w-[800px] h-full grid grid-cols-7 gap-px bg-white/10">
            <div v-for="day in daysInWeek" :key="day.date.toISOString()" class="bg-[#151515] flex flex-col h-full"
              :class="isToday(day.date) ? 'bg-[#151515]' : 'bg-[#0a0a0a]/20'">
              <div class="p-2 text-center border-b border-white/10 sticky top-0 bg-[#151515] z-10">
                <p class="text-xs uppercase text-gray-500 font-bold">{{ day.date.toLocaleString('es-ES', {
                  weekday:
                    'short'
                }) }}</p>
                <p class="text-lg font-bold" :class="isToday(day.date) ? 'text-[#d60000]' : 'text-white'">{{
                  day.date.getDate() }}</p>
              </div>
              <div class="p-2 space-y-2 overflow-y-auto flex-grow custom-scrollbar">
                <div
                  v-for="event in (eventsByDay.get(day.date.getDate()) || []).sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())"
                  :key="event.id" @click="openEditModal(event)"
                  class="p-2 rounded text-xs cursor-pointer text-white relative hover:brightness-110 transition-all shadow-sm"
                  :style="getEventStyle(event)">
                  <p class="font-bold truncate">{{ event.title }}</p>
                  <p class="opacity-80 truncate text-[10px]">{{ new Date(event.start).toLocaleTimeString('es-CO', {
                    hour:
                      'numeric', minute: '2-digit'
                  }) }}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Vista AGENDA -->
        <div v-else-if="calendarView === 'agenda'" class="flex-grow overflow-y-auto custom-scrollbar p-4">
          <div v-if="!agendaEvents.length" class="text-center text-gray-500 py-10">
            <i class="far fa-calendar-times text-4xl mb-3 opacity-50"></i>
            <p>No hay eventos para este mes.</p>
          </div>
          <div v-else class="space-y-6">
            <div v-for="(group, dateStr) in (agendaEvents as any[]).reduce((acc, e) => {
              const d = new Date(e.start).toDateString();
              if (!acc[d]) acc[d] = [];
              acc[d].push(e);
              return acc;
            }, {})" :key="dateStr" class="bg-white/5 rounded-lg overflow-hidden border border-white/10">
              <div class="bg-[#151515] px-4 py-2 font-bold text-[#d60000] text-sm flex items-center gap-2">
                <i class="far fa-calendar-alt"></i>
                {{ new Date(dateStr).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }) }}
              </div>
              <div class="divide-y divide-white/10">
                <div v-for="event in group" :key="event.id" @click="openEditModal(event)"
                  class="p-3 hover:bg-white/5 cursor-pointer flex items-center gap-3 transition-colors">
                  <div class="text-xs text-gray-400 w-16 text-right shrink-0">
                    <p>{{ new Date(event.start).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }) }}
                    </p>
                  </div>
                  <div class="w-1 h-8 rounded-full shrink-0"
                    :style="{ backgroundColor: getEventStyle(event).backgroundColor }"></div>
                  <div class="min-w-0">
                    <p class="font-bold text-sm text-white truncate">{{ event.title }}</p>
                    <p class="text-xs text-gray-400 truncate">{{ event.extendedProps?.tipo_visita || 'Evento Externo' }}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Columna Derecha: Panel de Detalles (Oculto en móvil, se muestra en Modal) -->
      <div class="hidden lg:flex lg:col-span-1 flex-col gap-6 overflow-hidden">

        <!-- Panel Detalles Día -->
        <div
          class="bg-[#151515] rounded-xl shadow-lg border border-white/10 flex flex-col flex-grow min-h-0 overflow-hidden">
          <div class="p-4 border-b border-white/10 bg-[#0a0a0a]/30">
            <h3 class="font-bold text-lg text-white">
              {{ selectedDate?.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }) }}
            </h3>
            <!-- Filtros Estado -->
            <div class="flex flex-wrap gap-1 mt-3">
              <button v-for="status in ['Todos', 'Programada', 'Realizada', 'Cancelada']" :key="status"
                @click="dayEventsStatusFilter = status as any"
                class="text-[10px] px-2 py-1 rounded-full border transition-colors"
                :class="dayEventsStatusFilter === status ? 'bg-[#d60000] border-[#d60000] text-white' : 'border-gray-600 text-gray-400 hover:border-gray-400'">
                {{ status }} <span class="ml-1 opacity-70">({{ statusCounts[status as keyof typeof statusCounts]
                }})</span>
              </button>
            </div>
          </div>

          <div class="flex-grow overflow-y-auto custom-scrollbar p-3 space-y-2">
            <div v-if="!filteredSelectedDateEvents.length" class="text-center py-10 text-gray-500 text-sm">
              No hay visitas para mostrar.
            </div>
            <div v-for="event in filteredSelectedDateEvents" :key="event.id" @click="openEditModal(event)"
              class="bg-white/5 p-3 rounded-lg border border-white/10 hover:border-white/20 transition-all cursor-pointer flex gap-3 group">
              <div class="pt-1">
                <input v-if="event.source === 'internal'" type="checkbox" :value="event.id" v-model="selectedVisitIds"
                  @click.stop
                  class="rounded border-white/10 bg-[#202020] text-[#d60000] focus:ring-[#d60000] cursor-pointer">
              </div>
              <div class="flex-grow min-w-0">
                <p class="font-bold text-sm text-white group-hover:text-[#d60000] transition-colors truncate">{{
                  event.title }}</p>
                <p class="text-xs text-gray-400">{{ event.extendedProps?.tipo_visita }} - {{
                  event.extendedProps?.ubicacion }}</p>

                <div v-if="event.source === 'internal'" class="mt-2 flex items-center justify-between">
                  <div class="flex -space-x-1">
                    <div v-for="tech in event.extendedProps?.fumigadores_asignados" :key="tech"
                      class="w-4 h-4 rounded-full border border-[#151515]"
                      :style="{ backgroundColor: getTechnicianColor(tech) }" :title="tech"></div>
                  </div>
                  <span class="text-[10px] px-2 py-0.5 rounded-full font-bold" :class="{
                    'bg-blue-500/20 text-blue-300': event.extendedProps.estado_visita === 'Programada',
                    'bg-green-500/20 text-green-300': event.extendedProps.estado_visita === 'Realizada',
                    'bg-red-500/20 text-red-300': event.extendedProps.estado_visita === 'Cancelada'
                  }">
                    {{ event.extendedProps.estado_visita }}
                  </span>
                </div>
              </div>
              <button v-if="event.source === 'internal' && event.extendedProps?.estado_visita === 'Programada'"
                @click.stop="handleQuickComplete(event.extendedProps)"
                class="text-gray-500 hover:text-green-400 self-center p-2" title="Completar">
                <i v-if="isCompleting === event.id" class="fas fa-spinner fa-spin"></i>
                <i v-else class="fas fa-check-circle text-lg"></i>
              </button>
            </div>
          </div>
        </div>

        <!-- Panel Urgentes -->
        <div class="bg-[#151515] rounded-xl shadow-lg border border-white/10 p-4 h-64 flex flex-col">
          <h3 class="font-bold text-sm text-yellow-400 mb-3 uppercase tracking-wider flex items-center gap-2">
            <i class="fas fa-exclamation-triangle"></i> Pendientes Urgentes
          </h3>
          <div class="flex-grow overflow-y-auto custom-scrollbar space-y-2">
            <div v-if="!pendingVisits.length" class="text-center text-xs text-gray-500 italic py-4">¡Todo al día!</div>
            <div v-for="visit in pendingVisits" :key="visit.id" @click="openEditModal(visit)"
              class="bg-white/5 p-2 rounded border-l-2 border-yellow-500 cursor-pointer hover:bg-white/10 transition-colors">
              <p class="font-bold text-xs text-white">{{ visit.nombre_cliente }}</p>
              <p class="text-[10px] text-yellow-200/70">{{ visit.tipo_visita }}</p>
            </div>
          </div>
        </div>

      </div>

      <!-- VISITAS URGENTES (Versión Móvil - Debajo del calendario) -->
      <div class="lg:hidden bg-[#151515] rounded-xl p-4 border border-white/10">
        <h3 class="font-bold text-sm text-yellow-400 mb-3 flex items-center gap-2">
          <i class="fas fa-exclamation-triangle"></i> Pendientes Urgentes
        </h3>
        <div class="flex gap-2 overflow-x-auto pb-2">
          <div v-if="!pendingVisits.length" class="text-xs text-gray-500">No hay pendientes.</div>
          <div v-for="visit in pendingVisits" :key="visit.id" @click="openEditModal(visit)"
            class="bg-white/5 p-2 rounded min-w-[140px] border-l-2 border-yellow-500 shrink-0">
            <p class="font-bold text-xs text-white truncate">{{ visit.nombre_cliente }}</p>
            <p class="text-[10px] text-gray-400">{{ visit.tipo_visita }}</p>
          </div>
        </div>
      </div>

    </main>

    <!-- MODAL DETALLES DÍA (Solo Móvil) -->
    <div v-if="showDayDetailsModal" class="fixed inset-0 z-[60] lg:hidden">
      <!-- Backdrop -->
      <div class="absolute inset-0 bg-black/80 backdrop-blur-sm" @click="showDayDetailsModal = false"></div>

      <!-- Sheet -->
      <div
        class="absolute bottom-0 left-0 right-0 bg-[#151515] rounded-t-2xl shadow-2xl max-h-[80vh] flex flex-col border-t border-white/10 animate-slide-up">
        <div
          class="p-4 border-b border-white/10 flex justify-between items-center sticky top-0 bg-[#151515] z-10 rounded-t-2xl">
          <div>
            <h3 class="font-bold text-lg text-white">
              {{ selectedDate?.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'long' }) }}
            </h3>
            <p class="text-xs text-gray-400">{{ filteredSelectedDateEvents.length }} eventos</p>
          </div>
          <button @click="showDayDetailsModal = false" class="bg-white/5 p-2 rounded-full text-white"><i
              class="fas fa-times"></i></button>
        </div>

        <div class="flex-grow overflow-y-auto p-4 space-y-3 pb-8">
          <div v-if="!filteredSelectedDateEvents.length" class="text-center py-8 text-gray-500">
            No hay visitas programadas.
            <button @click="openCreateModal(); showDayDetailsModal = false"
              class="block mx-auto mt-2 text-[#d60000] underline">Crear una</button>
          </div>

          <div v-for="event in filteredSelectedDateEvents" :key="event.id" @click="openEditModal(event)"
            class="bg-white/5 p-3 rounded-lg border-l-4 shadow-sm active:scale-95 transition-transform"
            :style="{ borderColor: event.source === 'google' ? '#f59e0b' : getEventStyle(event).backgroundColor }">
            <div class="flex justify-between items-start">
              <div>
                <h4 class="font-bold text-white text-sm">{{ event.title }}</h4>
                <p class="text-xs text-gray-400 mt-1">{{ event.extendedProps?.tipo_visita }}</p>
              </div>
              <span v-if="event.source === 'internal'" class="text-[10px] px-2 py-0.5 rounded font-bold"
                :class="event.extendedProps.estado_visita === 'Realizada' ? 'bg-green-900 text-green-400' : 'bg-gray-900 text-gray-400'">
                {{ event.extendedProps.estado_visita }}
              </span>
            </div>

            <div class="mt-3 flex items-center justify-between">
              <div class="text-xs text-gray-400">
                <i class="far fa-clock mr-1"></i>
                {{ new Date(event.start).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }) }}
              </div>

              <button v-if="event.source === 'internal' && event.extendedProps?.estado_visita === 'Programada'"
                @click.stop="handleQuickComplete(event.extendedProps)" class="btn btn-sm btn-success py-1 px-3 text-xs">
                Completar
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Modales Globales -->
    <VisitFormModal :show="showCreateModal || showEditModal" :visit="editingVisit" :selected-date="selectedDate"
      @close="((showCreateModal = false), (showEditModal = false))" @save="handleSaveVisit"
      @delete="handleDeleteVisit" />

    <!-- Tooltip (Solo Desktop) -->
    <div v-if="hoveredDay"
      class="fixed z-[70] bg-[#151515] border border-white/10 rounded-lg shadow-2xl p-3 w-56 pointer-events-none text-left hidden lg:block"
      :style="tooltipPosition">
      <h4 class="font-bold text-xs border-b border-white/10 pb-1 mb-2 text-[#d60000]">
        {{ hoveredDay.date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric' }) }}
      </h4>
      <ul class="space-y-1">
        <li v-for="event in hoveredDay.events.slice(0, 5)" :key="event.id"
          class="text-xs truncate flex items-center gap-2">
          <div class="w-1.5 h-1.5 rounded-full shrink-0"
            :style="{ backgroundColor: event.source === 'google' ? '#f59e0b' : getEventStyle(event).backgroundColor }">
          </div>
          <span class="text-gray-300">{{ event.title }}</span>
        </li>
        <li v-if="hoveredDay.events.length > 5" class="text-[10px] text-gray-500 italic pl-3">
          y {{ hoveredDay.events.length - 5 }} más...
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
@keyframes slide-up {
  from {
    transform: translateY(100%);
  }

  to {
    transform: translateY(0);
  }
}

.animate-slide-up {
  animation: slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.input-field-dark {
  background-color: #202020;
  /* gray-800 -> #202020 */
  border: 1px solid rgba(255, 255, 255, 0.1);
  /* gray-700 -> border-white/10 */
  border-radius: 0.75rem;
  color: #f3f4f6;
  padding: 0.625rem 0.875rem;
  transition: all 0.2s ease-in-out;
  font-size: 0.875rem;
}

.input-field-dark:focus {
  outline: none;
  border-color: #d60000;
  /* indigo-500 -> brand-red */
  box-shadow: 0 0 0 4px rgba(214, 0, 0, 0.1);
  background-color: #111827;
  /* gray-900 */
}

.custom-scrollbar::-webkit-scrollbar {
  width: 5px;
}

.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
  background-color: #4b5563;
  border-radius: 10px;
}

/* Toggle Switch Styling */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}
</style>
