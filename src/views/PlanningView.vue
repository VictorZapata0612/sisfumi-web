<!-- eslint-disable @typescript-eslint/ban-ts-comment -->
<!-- eslint-disable @typescript-eslint/no-explicit-any -->
<script setup lang="ts">
import { ref, onMounted, computed, watch, onUnmounted } from 'vue'
import { usePlanningStore, type Visit, type Technician } from '@/stores/planning'
import { useAuthStore } from '@/stores/auth'
import { useSettingsStore } from '@/stores/settings'
import { storeToRefs } from 'pinia'
import VisitFormModal from '@/components/VisitFormModal.vue'
import { useToast } from '@/composables/useToast'
import { useDialog } from '@/composables/useDialog'
import { useRoute, useRouter } from 'vue-router'

defineOptions({ name: 'PlanningView' })

const planningStore = usePlanningStore()
const authStore = useAuthStore()
const settingsStore = useSettingsStore()
const { showToast } = useToast()
const { showDialog } = useDialog()
const route = useRoute()
const router = useRouter()
const openedVisitFromUrl = ref<string | null>(null)

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

const { allCalendarEvents, pendingVisits, technicians, needsAuthRefresh } =
  storeToRefs(planningStore)

const currentDate = ref(new Date())
const selectedDate = ref<Date | null>(new Date())
const selectedZone = ref('Todos')
const selectedTechnician = ref('todos')
const calendarStatus = ref('')
const locationFilter = ref('')
const dayEventsStatusFilter = ref<'Todos' | 'Programada' | 'Realizada' | 'Cancelada'>('Todos')
const calendarView = ref<'month' | 'week' | 'day' | 'agenda'>('month')
const selectedCalendarUid = ref('internal')

const showCreateModal = ref(false)
const showEditModal = ref(false)
const editingVisit = ref<any>(null)
const externalEvent = ref<{ title: string; start: Date; end: Date; link?: string }>()
const externalDialog = ref<HTMLDialogElement>()

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
  planningStore.selectedCalendarUid = selectedCalendarUid.value
  loadData()
}

onMounted(() => {
  const requestedDate = route.query.date
  if (typeof requestedDate === 'string') {
    const parsedDate = new Date(requestedDate)
    if (!Number.isNaN(parsedDate.getTime())) {
      currentDate.value = parsedDate
      selectedDate.value = parsedDate
    }
  }
  if (authStore.userRole?.startsWith('Coordinador')) {
    selectedZone.value = authStore.userZone || 'Todos'
    selectedCalendarUid.value = authStore.user?.uid || 'internal'
  }
  // ✅ FIX: fetchIntegrations es admin-only en el backend (403 para el
  // resto de roles). Solo se usa para el selector de calendarios de
  // Administrador/Jefe (ver el v-if de abajo), así que solo se pide para
  // esos roles.
  if (authStore.userRole === 'Administrador' || authStore.userRole === 'Jefe') {
    void settingsStore.fetchIntegrations()
  }
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

  const startDayOfWeek = (firstDay.getDay() + 6) % 7
  const endDayOfWeek = (lastDay.getDay() + 6) % 7

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

const visibleEvents = computed(() => {
  const location = locationFilter.value.trim().toLocaleLowerCase('es-CO')
  return allCalendarEvents.value.filter((event) => {
    if (event.source === 'google') return !calendarStatus.value && !location
    const visit = event.extendedProps
    return (selectedTechnician.value === 'todos' || visit?.fumigadores_asignados?.includes(selectedTechnician.value)) &&
      (!calendarStatus.value || visit?.estado_visita === calendarStatus.value) &&
      (!location || visit?.ubicacion?.toLocaleLowerCase('es-CO').includes(location))
  }).sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
})

const agendaEvents = computed(() => visibleEvents.value.filter((event) => {
  const date = new Date(event.start)
  return date.getMonth() === currentDate.value.getMonth() && date.getFullYear() === currentDate.value.getFullYear()
}))

const eventsByDay = computed(() => {
  const days = new Map<string, (typeof visibleEvents.value)>()
  for (const event of visibleEvents.value) {
    const key = new Date(event.start).toDateString()
    const entries = days.get(key) ?? []
    entries.push(event)
    days.set(key, entries)
  }
  return days
})

const conflictIds = computed(() => {
  const conflicts = new Set<string>()
  const latestByTechnician = new Map<string, { end: number; id: string }>()
  const events = [...allCalendarEvents.value].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
  for (const event of events) {
    if (event.source !== 'internal' || event.extendedProps?.estado_visita !== 'Programada' || !event.end) continue
    const start = new Date(event.start).getTime()
    const end = new Date(event.end).getTime()
    if (!(end > start)) continue
    for (const name of new Set<string>(event.extendedProps.fumigadores_asignados ?? [])) {
      const previous = latestByTechnician.get(name)
      if (previous && previous.end > start) {
        conflicts.add(previous.id)
        conflicts.add(event.id)
      }
      if (!previous || end > previous.end) latestByTechnician.set(name, { end, id: event.id })
    }
  }
  return conflicts
})
const conflictEvents = computed(() => {
  const events = calendarView.value === 'day' ? selectedDateEvents.value
    : calendarView.value === 'week' ? daysInWeek.value.flatMap(({ date }) => eventsByDay.value.get(date.toDateString()) ?? [])
      : agendaEvents.value
  return events.filter((event) => conflictIds.value.has(event.id))
})
const showConflicts = ref(false)

const isToday = (day: Date) => {
  const today = new Date()
  return (
    day.getDate() === today.getDate() &&
    day.getMonth() === today.getMonth() &&
    day.getFullYear() === today.getFullYear()
  )
}

const selectedDateEvents = computed(() =>
  selectedDate.value ? eventsByDay.value.get(selectedDate.value.toDateString()) ?? [] : [],
)

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
})

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
        ;(counts as any)[status]++
      }
    }
  })
  return counts
})

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

const visitTimeFormatter = new Intl.DateTimeFormat('es-CO', { timeZone: 'America/Bogota', hour: '2-digit', minute: '2-digit', hour12: false })
const visitDayFormatter = new Intl.DateTimeFormat('es-CO', { timeZone: 'America/Bogota', day: 'numeric', month: 'short' })
function formatVisitRange(event: { start: string | Date; end?: string | Date }) {
  const start = new Date(event.start)
  if (!Number.isFinite(start.getTime())) return '—'
  const startLabel = visitTimeFormatter.format(start)
  if (!event.end) return startLabel
  const end = new Date(event.end)
  if (!(end.getTime() > start.getTime())) return startLabel
  const endDay = visitDayFormatter.format(end)
  return startLabel + ' – ' + visitTimeFormatter.format(end) +
    (endDay === visitDayFormatter.format(start) ? '' : ' (' + endDay + ')')
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
  planningStore.selectedCalendarUid = selectedCalendarUid.value
  const dateRange =
    calendarView.value === 'week'
      ? (() => {
          const referenceDate = selectedDate.value || currentDate.value
          const weekStart = new Date(referenceDate)
          const dayOfWeek = weekStart.getDay()
          weekStart.setDate(weekStart.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1))
          weekStart.setHours(0, 0, 0, 0)
          const weekEnd = new Date(weekStart)
          weekEnd.setDate(weekEnd.getDate() + 7)

          return {
            startDateISO: weekStart.toISOString(),
            endDateISO: weekEnd.toISOString(),
          }
        })()
      : undefined

  planningStore.fetchPlanningData(
    currentDate.value.getFullYear(),
    currentDate.value.getMonth(),
    selectedZone.value,
    selectedCalendarUid.value,
    dateRange,
  )
}

watch(calendarView, loadData)

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
      appearance: 'planning',
      title: 'Reconexión Necesaria',
      message:
        'Tu conexión con Google Calendar ha expirado. Por favor, vuelve a conectar tu cuenta.',
      isConfirmation: true,
      confirmationText: 'Reconectar',
      onConfirm: () => {
        if (authStore.user?.uid) {
          authStore.connectGoogleAccount(import.meta.env.VITE_GOOGLE_CLIENT_ID, authStore.user.uid)
        }
      },
    })
  }
})

function movePeriod(offset: number) {
  const reference = selectedDate.value || currentDate.value
  if (calendarView.value === 'week' || calendarView.value === 'day') {
    const next = new Date(reference)
    next.setDate(next.getDate() + offset * (calendarView.value === 'week' ? 7 : 1))
    selectedDate.value = next
    const sameMonth = next.getMonth() === currentDate.value.getMonth() &&
      next.getFullYear() === currentDate.value.getFullYear()
    currentDate.value = next
    if (calendarView.value === 'day' && sameMonth) return
  } else {
    const next = new Date(currentDate.value.getFullYear(), currentDate.value.getMonth() + offset, 1)
    selectedDate.value = next
    currentDate.value = next
  }
  planningStore.clearCalendarData()
  loadData()
}

const periodLabel = computed(() => {
  const format = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })
  if (calendarView.value === 'day' && selectedDate.value) return format.format(selectedDate.value)
  if (calendarView.value === 'week') {
    const first = daysInWeek.value[0]?.date
    const last = daysInWeek.value[6]?.date
    if (first && last) return format.format(first) + ' – ' + format.format(last)
  }
  return currentMonthDisplay.value
})

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
  selectedDate.value = today
  currentDate.value = today
  loadData()
}

const openCreateModal = () => {
  editingVisit.value = null
  showCreateModal.value = true
}

function showGoogleEventDetails(event: any) {
  let link: string | undefined
  try {
    const target = new URL(event.extendedProps?.htmlLink)
    if (target.protocol === 'https:' && ['calendar.google.com', 'www.google.com'].includes(target.hostname)) link = target.href
  } catch {
    // Los eventos sin vínculo siguen mostrando su horario.
  }
  externalEvent.value = { title: event.title, start: new Date(event.start), end: new Date(event.end), link }
  showDayDetailsModal.value = false
  externalDialog.value?.showModal()
}

const openEditModal = (event: any) => {
  if (event.source === 'google') {
    showGoogleEventDetails(event)
    return
  }
  const visitWithHistory = { ...event, history: [] }
  planningStore
    .fetchVisitHistory(event.id)
    .then((history) => {
      if (editingVisit.value?.id === event.id) editingVisit.value.history = history
    })
  editingVisit.value = visitWithHistory

  // Cerrar modal de detalles si está abierto (móvil)
  showDayDetailsModal.value = false

  showEditModal.value = true
}

watch(
  () => [route.query.visitIdToOpen, planningStore.monthlyVisits, planningStore.pendingVisits],
  ([visitId]) => {
    if (typeof visitId !== 'string' || !visitId || openedVisitFromUrl.value === visitId) return
    const visit = [...planningStore.monthlyVisits, ...planningStore.pendingVisits].find(
      (item) => item.id === visitId,
    )
    if (!visit) return
    openedVisitFromUrl.value = visitId
    openEditModal(visit)
    void router.replace({
      query: { ...route.query, visitIdToOpen: undefined, date: undefined },
    })
  },
  { immediate: true },
)

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
    appearance: 'planning',
    title: 'Confirmar Eliminación',
    message: '¿Está seguro de que desea eliminar esta visita?',
    isConfirmation: true,
    confirmationText: 'Sí, Eliminar',
    async onConfirm() {
      try {
        await planningStore.deleteVisit(visitId)

        // CORRECCIÓN: Quitamos el .value y tipamos explícitamente 'v'
        planningStore.monthlyVisits = planningStore.monthlyVisits.filter(
          (v: Visit) => v.id !== visitId,
        )
        // Hacemos lo mismo con pendingVisits por si acaso
        planningStore.pendingVisits = planningStore.pendingVisits.filter(
          (v: Visit) => v.id !== visitId,
        )

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
  const visitIds = [...selectedVisitIds.value]
  showDialog({
    appearance: 'planning',
    title: 'Asignar Técnicos en Bloque',
    message: `Selecciona los técnicos para asignar a las ${selectedVisitIds.value.length} visitas.`,
    isConfirmation: true,
    confirmationText: 'Asignar',
    technicianSelection: {
      available: technicians.value,
      selected: selectedTechnicians,
    },
    async onConfirm() {
      if (selectedTechnicians.length === 0) return
      isAssigning.value = true
      try {
        await planningStore.batchAssignVisits(visitIds, selectedTechnicians)
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
  const events = eventsByDay.value.get(day.date.toDateString()) ?? []
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

const handleQuickComplete = (visit: Visit) => {
  showDialog({
    appearance: 'planning',
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
  <div class="planning-page space-y-4">
    <!-- Header Responsive -->
    <header
      class="planning-header flex flex-wrap items-center justify-between gap-4 py-2"
    >
      <div>
        <h1 class="flex items-center gap-3 text-2xl font-extrabold sm:text-3xl">
          <span class="planning-icon grid size-11 place-items-center rounded-xl text-xl"><i class="fas fa-calendar-alt" aria-hidden="true"></i></span>
          Planeación
          <button
            @click="loadData"
            class="text-sm bg-[var(--shell-surface)] p-2 rounded-full hover:text-[#d60000] transition-colors"
            title="Recargar"
          >
            <i class="fas fa-sync-alt"></i>
          </button>
        </h1>
        <p class="text-sm text-[var(--shell-muted)] mt-1">Gestión de agenda y rutas</p>
      </div>

      <!-- Botonera Acciones en Bloque -->
      <div
        v-if="selectedVisitIds.length > 0"
        class="flex items-center gap-2 bg-blue-900/30 p-2 rounded-lg border border-blue-500/50 w-full md:w-auto justify-between"
      >
        <span class="text-sm font-bold text-blue-200 px-2"
          >{{ selectedVisitIds.length }} seleccionadas</span
        >
        <div class="flex gap-2">
          <button
            @click="handleBatchAssign"
            class="btn btn-primary bg-blue-600 hover:bg-blue-700 text-xs py-1.5"
            :disabled="isAssigning"
          >
            <i v-if="isAssigning" class="fas fa-spinner fa-spin mr-1"></i>
            <i v-else class="fas fa-users mr-1"></i> Asignar
          </button>
          <button @click="selectedVisitIds = []" class="btn btn-icon btn-danger text-xs py-1.5">
            <i class="fas fa-times"></i>
          </button>
        </div>
      </div>

      <!-- Filtros Responsivos -->
      <div class="planning-panel flex w-full flex-wrap items-center gap-3 p-3">
        <select
          v-model="selectedZone" aria-label="Zona"
          @change="loadData"
          class="input-field-dark text-sm py-1.5 w-full sm:w-auto"
        >
          <option value="Todos">Todas las Zonas</option>
          <option
            v-for="zone in settingsStore.businessData.businessZones"
            :key="zone.name"
            :value="zone.name"
          >
            {{ zone.name }}
          </option>
        </select>

        <select
          v-model="selectedTechnician" aria-label="Técnico"
          class="input-field-dark text-sm py-1.5 w-full sm:w-auto"
        >
          <option value="todos">Todos los Técnicos</option>
          <option v-for="tech in technicians" :key="tech.id" :value="tech.nombreCompleto">
            {{ tech.nombreCompleto }}
          </option>
        </select>

        <!-- ✅ NUEVO: Selector de Calendario para Admins/Jefes -->
        <div v-if="authStore.userRole === 'Administrador' || authStore.userRole === 'Jefe'">
          <select
            id="calendarAccountSelector" aria-label="Calendario"
            v-model="selectedCalendarUid"
            @change="handleCalendarChange"
            class="input-field-dark text-sm py-1.5 w-full sm:w-auto"
          >
            <option value="internal">Calendario de la Aplicación</option>
            <option
              v-for="coord in settingsStore.integrations"
              :key="coord.uid"
              :value="coord.uid"
              :data-zona="coord.zona"
            >
              {{ coord.googleUserName }}
            </option>
          </select>
        </div>

        <button
          @click="openCreateModal"
          class="planning-primary w-full sm:w-auto"
        >
          <i class="fas fa-plus mr-2"></i>Nueva Visita
        </button>
      </div>
    </header>

    <div v-if="planningStore.loading" role="status" class="text-sm text-[var(--shell-muted)]">
      Cargando visitas…
    </div>
    <p v-if="planningStore.calendarLoading" role="status" class="text-sm text-[var(--shell-muted)]">
      Sincronizando Google Calendar…
    </p>
    <div v-if="planningStore.error || planningStore.calendarError || planningStore.clientsError" role="alert" class="text-sm">
      <p v-if="planningStore.error">{{ planningStore.error }}</p>
      <p v-if="planningStore.calendarError">No se pudo cargar Google Calendar.</p>
      <p v-if="planningStore.clientsError">No se pudo cargar el catálogo para el formulario de visitas.</p>
      <button type="button" class="font-semibold underline" @click="loadData">Reintentar</button>
    </div>
    <p v-if="(showCreateModal || showEditModal) && !planningStore.clientsReady && planningStore.clientsLoading" role="status" class="text-sm">
      Cargando el formulario de visita…
    </p>

    <!-- Contenido Principal (Grid Adaptable) -->
    <main class="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,2.15fr)_minmax(0,1fr)]">
      <!-- Columna Izquierda: Calendario -->
      <div
        class="planning-panel calendar-panel flex min-w-0 flex-col overflow-hidden"
      >
        <!-- Toolbar Calendario -->
        <div
          class="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--shell-border)] p-3"
        >
          <div class="flex items-center gap-2 bg-[var(--shell-input)] p-1 rounded-lg shrink-0">
            <button type="button" @click="movePeriod(-1)" aria-label="Periodo anterior" class="p-2 hover:text-white text-[var(--shell-muted)]">
              <i class="fas fa-chevron-left"></i>
            </button>
            <span class="min-w-32 px-1 text-center font-bold capitalize select-none text-sm md:text-base">{{
              periodLabel
            }}</span>
            <button type="button" @click="movePeriod(1)" aria-label="Periodo siguiente" class="p-2 hover:text-white text-[var(--shell-muted)]">
              <i class="fas fa-chevron-right"></i>
            </button>
          </div>

          <div class="flex gap-2 bg-[var(--shell-input)] p-1 rounded-lg text-xs font-medium shrink-0">
            <button
              type="button" :aria-pressed="calendarView === 'month'" @click="calendarView = 'month'"
              class="px-3 py-1.5 rounded transition-colors"
              :class="
                calendarView === 'month'
                  ? 'bg-[#d60000] text-white shadow'
                  : 'text-[var(--shell-muted)] hover:text-white'
              "
            >
              Mes
            </button>
            <button
              type="button" :aria-pressed="calendarView === 'week'" @click="calendarView = 'week'"
              class="px-3 py-1.5 rounded transition-colors"
              :class="
                calendarView === 'week'
                  ? 'bg-[#d60000] text-white shadow'
                  : 'text-[var(--shell-muted)] hover:text-white'
              "
            >
              Semana
            </button>
            <button
              type="button" :aria-pressed="calendarView === 'day'" @click="calendarView = 'day'"
              class="px-3 py-1.5 rounded transition-colors"
              :class="calendarView === 'day' ? 'bg-[#d60000] text-white shadow' : 'text-[var(--shell-muted)] hover:text-white'"
            >
              Día
            </button>
            <button
              type="button" :aria-pressed="calendarView === 'agenda'" @click="calendarView = 'agenda'"
              class="px-3 py-1.5 rounded transition-colors"
              :class="
                calendarView === 'agenda'
                  ? 'bg-[#d60000] text-white shadow'
                  : 'text-[var(--shell-muted)] hover:text-white'
              "
            >
              Agenda
            </button>
          </div>

          <button
            @click="goToToday"
            class="text-xs text-[#d60000] hover:text-red-400 font-bold underline shrink-0"
          >
            Ir a Hoy
          </button>
        </div>

        <div v-if="conflictEvents.length" class="conflict-bar px-4 py-2 text-sm">
          <button type="button" class="font-semibold hover:underline" :aria-expanded="showConflicts" @click="showConflicts = !showConflicts">
            <i class="fas fa-exclamation-triangle mr-1" aria-hidden="true"></i>
            {{ conflictEvents.length }} visitas con solapamientos
          </button>
          <ul v-if="showConflicts" class="mt-2 space-y-1">
            <li v-for="event in conflictEvents" :key="event.id">
              <button type="button" class="text-left hover:underline" @click="openEditModal(event)">
                {{ new Date(event.start).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' }) }} · {{ event.title }}
              </button>
            </li>
          </ul>
        </div>

        <!-- Vista MES -->
        <div v-if="calendarView === 'month'" class="flex-grow flex flex-col overflow-hidden">
          <!-- Días Semana -->
          <div
            class="grid grid-cols-7 border-b border-[var(--shell-border)] bg-[var(--shell-surface)] text-center py-2 shrink-0"
          >
            <span
              v-for="day in ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']"
              :key="day"
              class="text-xs font-bold text-[var(--shell-muted)] uppercase"
              >{{ day }}</span
            >
          </div>

          <!-- Grid Días -->
          <div class="grid grid-cols-7 flex-grow overflow-y-auto">
            <div
              v-for="(day, index) in calendarGridDays"
              :key="index"
              role="button" tabindex="0"
              :aria-label="day.date.toLocaleDateString('es-CO', { dateStyle: 'full' }) + ' · ' + (eventsByDay.get(day.date.toDateString())?.length ?? 0) + ' eventos'"
              @keydown.enter.prevent="selectDay(day)" @keydown.space.prevent="selectDay(day)"
              @click="selectDay(day)"
              @mouseenter="showTooltip($event, day)"
              @mouseleave="hideTooltip"
              class="relative border-b border-r border-[var(--shell-border)] min-h-[64px] md:min-h-[94px] p-1 md:p-2 cursor-pointer transition-colors hover:bg-[var(--shell-input)] flex flex-col"
              :class="{
                'bg-[var(--shell-input)]': !day.isCurrentMonth,
                'ring-1 ring-inset ring-[#d60000]/50 bg-red-900/10':
                  selectedDate?.toDateString() === day.date.toDateString(),
              }"
            >
              <span
                class="text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full mb-1"
                :class="isToday(day.date) ? 'bg-[#d60000] text-white shadow-lg' : 'text-[var(--shell-muted)]'"
              >
                {{ day.date.getDate() }}
              </span>

              <span v-if="eventsByDay.get(day.date.toDateString())?.length" class="day-count absolute right-1 top-1.5 rounded-full px-1.5 text-[10px] font-bold sm:right-2">
                {{ eventsByDay.get(day.date.toDateString())?.length }}
              </span>

              <!-- Contenedor Eventos -->
              <div class="flex-grow flex flex-col gap-1 overflow-hidden">
                <div class="flex-grow relative w-full">
                  <!-- VISTA MÓVIL: Puntos/Indicadores Compactos -->
                  <div class="md:hidden flex flex-wrap gap-1 content-start absolute inset-0">
                    <div
                      v-for="event in eventsByDay.get(day.date.toDateString())?.slice(0, 8)"
                      :key="event.id"
                      class="w-1.5 h-1.5 rounded-full"
                      :class="event.source === 'google' ? 'bg-yellow-500' : ''"
                      :style="
                        event.source !== 'google'
                          ? { backgroundColor: getEventStyle(event).backgroundColor }
                          : {}
                      "
                    ></div>
                  </div>

                  <!-- VISTA ESCRITORIO: Barras de Texto -->
                  <div class="hidden md:flex flex-col gap-1 absolute inset-0 overflow-hidden">
                    <div
                      v-for="event in eventsByDay.get(day.date.toDateString())?.slice(0, 3)"
                      :key="event.id"
                      class="month-event text-[10px] px-1.5 py-0.5 rounded truncate shadow-sm border-l-2 leading-tight opacity-90 hover:opacity-100"
                      :style="{
                        backgroundColor:
                          event.source === 'google'
                            ? '#f59e0b80'
                            : `${getEventStyle(event).backgroundColor}80`,
                        borderColor:
                          event.source === 'google'
                            ? '#f59e0b'
                            : getEventStyle(event).backgroundColor,
                      }"
                    >
                      {{ event.title }}
                    </div>
                    <span
                      v-if="(eventsByDay.get(day.date.toDateString())?.length || 0) > 3"
                      class="text-[9px] text-[var(--shell-muted)] pl-1"
                    >
                      +{{ (eventsByDay.get(day.date.toDateString())?.length || 0) - 3 }} más
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Vista SEMANA (Con scroll horizontal para móviles) -->
        <div v-else-if="calendarView === 'week'" class="flex-grow overflow-auto">
          <div class="grid min-w-[720px] grid-cols-7 gap-px bg-[var(--shell-border)]">
            <div
              v-for="day in daysInWeek"
              :key="day.date.toISOString()"
              class="bg-[var(--shell-surface)] flex flex-col h-full"
              :class="isToday(day.date) ? 'bg-[var(--shell-surface)]' : 'bg-[var(--shell-input)]'"
            >
              <div class="p-2 text-center border-b border-[var(--shell-border)] sticky top-0 bg-[var(--shell-surface)] z-10">
                <p class="text-xs uppercase text-[var(--shell-muted)] font-bold">
                  {{
                    day.date.toLocaleString('es-ES', {
                      weekday: 'short',
                    })
                  }}
                </p>
                <p
                  class="text-lg font-bold"
                  :class="isToday(day.date) ? 'text-[#d60000]' : 'text-[var(--shell-text)]'"
                >
                  {{ day.date.getDate() }}
                </p>
              </div>
              <div class="p-2 space-y-2 overflow-y-auto flex-grow custom-scrollbar">
                <div
                  v-for="event in eventsByDay.get(day.date.toDateString())"
                  :key="event.id"
                  @click="openEditModal(event)"
                  class="p-2 rounded text-xs cursor-pointer text-white relative hover:brightness-110 transition-all shadow-sm"
                  :style="getEventStyle(event)"
                >
                  <p class="font-bold truncate">{{ event.title }}</p>
                  <p class="opacity-80 truncate text-[10px]">
                    {{ formatVisitRange(event) }}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <section v-else-if="calendarView === 'day'" class="space-y-2 p-4" aria-label="Visitas del día">
          <p v-if="!selectedDateEvents.length" class="py-8 text-center text-sm text-[var(--shell-muted)]">No hay visitas para este día.</p>
          <button v-for="event in selectedDateEvents" :key="event.id" type="button"
            class="day-event flex w-full items-start gap-3 rounded-lg border border-[var(--shell-border)] p-3 text-left"
            @click="openEditModal(event)">
            <time class="shrink-0 text-sm font-bold">{{ formatVisitRange(event) }}</time>
            <span class="min-w-0 flex-1">
              <strong class="block text-sm">{{ event.title }}</strong>
              <span class="block text-xs text-[var(--shell-muted)]">{{ [event.extendedProps?.tipo_visita, event.extendedProps?.ubicacion, event.extendedProps?.fumigadores_asignados?.join(', ')].filter(Boolean).join(' · ') }}</span>
            </span>
            <span v-if="conflictIds.has(event.id)" class="conflict-label text-xs font-bold">Solapamiento</span>
            <span v-else class="text-xs text-[var(--shell-muted)]">{{ event.extendedProps?.estado_visita || 'Google Calendar' }}</span>
          </button>
        </section>

        <!-- Vista AGENDA -->
        <div
          v-else-if="calendarView === 'agenda'"
          class="flex-grow overflow-y-auto custom-scrollbar p-4"
        >
          <div v-if="!agendaEvents.length" class="text-center text-[var(--shell-muted)] py-10">
            <i class="far fa-calendar-times text-4xl mb-3 opacity-50"></i>
            <p>No hay eventos para este mes.</p>
          </div>
          <div v-else class="space-y-6">
            <div
              v-for="(group, dateStr) in (agendaEvents as any[]).reduce((acc, e) => {
                const d = new Date(e.start).toDateString()
                if (!acc[d]) acc[d] = []
                acc[d].push(e)
                return acc
              }, {})"
              :key="dateStr"
              class="bg-[var(--shell-input)] rounded-lg overflow-hidden border border-[var(--shell-border)]"
            >
              <div
                class="bg-[var(--shell-surface)] px-4 py-2 font-bold text-[#d60000] text-sm flex items-center gap-2"
              >
                <i class="far fa-calendar-alt"></i>
                {{
                  new Date(dateStr).toLocaleDateString('es-ES', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                  })
                }}
              </div>
              <div class="divide-y divide-[var(--shell-border)]">
                <div
                  v-for="event in group"
                  :key="event.id"
                  @click="openEditModal(event)"
                  class="p-3 hover:bg-[var(--shell-input)] cursor-pointer flex items-center gap-3 transition-colors"
                >
                  <div class="text-xs text-[var(--shell-muted)] w-16 text-right shrink-0">
                    <p>
                      {{
                        new Date(event.start).toLocaleTimeString('es-CO', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      }}
                    </p>
                  </div>
                  <div
                    class="w-1 h-8 rounded-full shrink-0"
                    :style="{ backgroundColor: getEventStyle(event).backgroundColor }"
                  ></div>
                  <div class="min-w-0">
                    <p class="font-bold text-sm text-[var(--shell-text)] truncate">{{ event.title }}</p>
                    <p class="text-xs text-[var(--shell-muted)] truncate">
                      {{ event.extendedProps?.tipo_visita || 'Evento Externo' }}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Columna Derecha: Panel de Detalles (Oculto en móvil, se muestra en Modal) -->
      <div class="hidden min-w-0 flex-col gap-4 lg:flex">
        <!-- Panel Detalles Día -->
        <div
          class="bg-[var(--shell-surface)] rounded-xl shadow-lg border border-[var(--shell-border)] flex flex-col flex-grow min-h-0 overflow-hidden"
        >
          <div class="p-4 border-b border-[var(--shell-border)] bg-[var(--shell-input)]">
            <h3 class="font-bold text-lg text-[var(--shell-text)]">
              {{
                selectedDate?.toLocaleDateString('es-ES', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                })
              }}
            </h3>
            <!-- Filtros Estado -->
            <div class="flex flex-wrap gap-1 mt-3">
              <button
                v-for="status in ['Todos', 'Programada', 'Realizada', 'Cancelada']"
                :key="status"
                @click="dayEventsStatusFilter = status as any"
                class="text-[10px] px-2 py-1 rounded-full border transition-colors"
                :class="
                  dayEventsStatusFilter === status
                    ? 'bg-[#d60000] border-[#d60000] text-white'
                    : 'border-gray-600 text-[var(--shell-muted)] hover:border-gray-400'
                "
              >
                {{ status }}
                <span class="ml-1 opacity-70"
                  >({{ statusCounts[status as keyof typeof statusCounts] }})</span
                >
              </button>
            </div>
          </div>

          <div class="flex-grow overflow-y-auto custom-scrollbar p-3 space-y-2">
            <div
              v-if="!filteredSelectedDateEvents.length"
              class="text-center py-10 text-[var(--shell-muted)] text-sm"
            >
              No hay visitas para mostrar.
            </div>
            <div
              v-for="event in filteredSelectedDateEvents"
              :key="event.id"
              @click="openEditModal(event)"
              class="bg-[var(--shell-input)] p-3 rounded-lg border border-[var(--shell-border)] hover:border-[var(--shell-border)] transition-all cursor-pointer flex gap-3 group"
            >
              <div class="pt-1">
                <input
                  v-if="event.source === 'internal'"
                  type="checkbox"
                  :value="event.id"
                  v-model="selectedVisitIds"
                  @click.stop
                  class="rounded border-[var(--shell-border)] bg-[var(--shell-input)] text-[#d60000] focus:ring-[#d60000] cursor-pointer"
                />
              </div>
              <div class="flex-grow min-w-0">
                <p
                  class="font-bold text-sm text-[var(--shell-text)] group-hover:text-[#d60000] transition-colors truncate"
                >
                  {{ event.title }}
                </p>
                <p class="text-xs text-[var(--shell-muted)]">
                  {{ event.extendedProps?.tipo_visita }} - {{ event.extendedProps?.ubicacion }}
                </p>

                <span v-if="event.source === 'internal' && event.extendedProps?.createdBy === 'SYSTEM' && event.extendedProps?.estado_visita === 'Programada' && !event.extendedProps?.fumigadores_asignados?.length" class="mt-1 inline-block rounded bg-[var(--planning-tint)] px-2 py-0.5 text-xs text-[var(--planning-accent)]">Automática · Sin técnico</span>
                <div
                  v-if="event.source === 'internal'"
                  class="mt-2 flex items-center justify-between"
                >
                  <div class="flex -space-x-1">
                    <div
                      v-for="tech in event.extendedProps?.fumigadores_asignados"
                      :key="tech"
                      class="w-4 h-4 rounded-full border border-[#151515]"
                      :style="{ backgroundColor: getTechnicianColor(tech) }"
                      :title="tech"
                    ></div>
                  </div>
                  <span
                    class="text-[10px] px-2 py-0.5 rounded-full font-bold"
                    :class="{
                      'bg-blue-500/20 planning-status-blue':
                        event.extendedProps.estado_visita === 'Programada',
                      'bg-green-500/20 planning-status-green':
                        event.extendedProps.estado_visita === 'Realizada',
                      'bg-red-500/20 planning-status-red':
                        event.extendedProps.estado_visita === 'Cancelada',
                    }"
                  >
                    {{ event.extendedProps.estado_visita }}
                  </span>
                </div>
              </div>
              <button
                v-if="
                  event.source === 'internal' && event.extendedProps?.estado_visita === 'Programada'
                "
                @click.stop="handleQuickComplete(event.extendedProps)"
                class="text-[var(--shell-muted)] hover:text-green-400 self-center p-2"
                title="Completar"
              >
                <i v-if="isCompleting === event.id" class="fas fa-spinner fa-spin"></i>
                <i v-else class="fas fa-check-circle text-lg"></i>
              </button>
            </div>
          </div>
        </div>

        <!-- Panel Urgentes -->
        <div
          class="bg-[var(--shell-surface)] rounded-xl shadow-lg border border-[var(--shell-border)] p-4 h-64 flex flex-col"
        >
          <h3
            class="font-bold text-sm text-yellow-400 mb-3 uppercase tracking-wider flex items-center gap-2"
          >
            <i class="fas fa-exclamation-triangle"></i> Pendientes Urgentes
          </h3>
          <div class="flex-grow overflow-y-auto custom-scrollbar space-y-2">
            <div v-if="!pendingVisits.length" class="text-center text-xs text-[var(--shell-muted)] italic py-4">
              ¡Todo al día!
            </div>
            <div
              v-for="visit in pendingVisits"
              :key="visit.id"
              @click="openEditModal(visit)"
              class="bg-[var(--shell-input)] p-2 rounded border-l-2 border-yellow-500 cursor-pointer hover:bg-white/10 transition-colors"
            >
              <p class="font-bold text-xs text-[var(--shell-text)]">{{ visit.nombre_cliente }}</p>
              <p class="text-[10px] text-yellow-200/70">{{ visit.tipo_visita }}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- VISITAS URGENTES (Versión Móvil - Debajo del calendario) -->
      <div class="lg:hidden bg-[var(--shell-surface)] rounded-xl p-4 border border-[var(--shell-border)]">
        <h3 class="font-bold text-sm text-yellow-400 mb-3 flex items-center gap-2">
          <i class="fas fa-exclamation-triangle"></i> Pendientes Urgentes
        </h3>
        <div class="flex gap-2 overflow-x-auto pb-2">
          <div v-if="!pendingVisits.length" class="text-xs text-[var(--shell-muted)]">No hay pendientes.</div>
          <div
            v-for="visit in pendingVisits"
            :key="visit.id"
            @click="openEditModal(visit)"
            class="bg-[var(--shell-input)] p-2 rounded min-w-[140px] border-l-2 border-yellow-500 shrink-0"
          >
            <p class="font-bold text-xs text-[var(--shell-text)] truncate">{{ visit.nombre_cliente }}</p>
            <p class="text-[10px] text-[var(--shell-muted)]">{{ visit.tipo_visita }}</p>
          </div>
        </div>
      </div>
    </main>

    <!-- MODAL DETALLES DÍA (Solo Móvil) -->
    <div v-if="showDayDetailsModal" class="fixed inset-0 z-[60] lg:hidden" role="dialog" aria-modal="true" aria-label="Visitas del día" @keydown.esc.stop="showDayDetailsModal = false">
      <!-- Backdrop -->
      <div
        class="absolute inset-0 bg-black/80 backdrop-blur-sm"
        @click="showDayDetailsModal = false"
      ></div>

      <!-- Sheet -->
      <div
        class="absolute bottom-0 left-0 right-0 bg-[var(--shell-surface)] rounded-t-2xl shadow-2xl max-h-[80vh] flex flex-col border-t border-[var(--shell-border)] animate-slide-up"
      >
        <div
          class="p-4 border-b border-[var(--shell-border)] flex justify-between items-center sticky top-0 bg-[var(--shell-surface)] z-10 rounded-t-2xl"
        >
          <div>
            <h3 class="font-bold text-lg text-[var(--shell-text)]">
              {{
                selectedDate?.toLocaleDateString('es-ES', {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'long',
                })
              }}
            </h3>
            <p class="text-xs text-[var(--shell-muted)]">{{ filteredSelectedDateEvents.length }} eventos</p>
          </div>
          <button
            @click="showDayDetailsModal = false"
            class="bg-[var(--shell-input)] p-2 rounded-full text-[var(--shell-text)]"
          >
            <i class="fas fa-times"></i>
          </button>
        </div>

        <div class="flex-grow overflow-y-auto p-4 space-y-3 pb-8">
          <div v-if="!filteredSelectedDateEvents.length" class="text-center py-8 text-[var(--shell-muted)]">
            No hay visitas programadas.

            <button
              @click="
                openCreateModal(),
                showDayDetailsModal = false
              "
              class="block mx-auto mt-2 text-[#d60000] underline"
            >
              Crear una
            </button>
          </div>

          <div
            v-for="event in filteredSelectedDateEvents"
            :key="event.id"
            @click="openEditModal(event)"
            class="bg-[var(--shell-input)] p-3 rounded-lg border-l-4 shadow-sm active:scale-95 transition-transform"
            :style="{
              borderColor:
                event.source === 'google' ? '#f59e0b' : getEventStyle(event).backgroundColor,
            }"
          >
            <div class="flex justify-between items-start">
              <div>
                <h4 class="font-bold text-[var(--shell-text)] text-sm">{{ event.title }}</h4>
                <p class="text-xs text-[var(--shell-muted)] mt-1">{{ event.extendedProps?.tipo_visita }}</p>
                <span v-if="event.source === 'internal' && event.extendedProps?.createdBy === 'SYSTEM' && event.extendedProps?.estado_visita === 'Programada' && !event.extendedProps?.fumigadores_asignados?.length" class="mt-1 inline-block rounded bg-[var(--planning-tint)] px-2 py-0.5 text-xs text-[var(--planning-accent)]">Automática · Sin técnico</span>
              </div>
              <span
                v-if="event.source === 'internal'"
                class="text-[10px] px-2 py-0.5 rounded font-bold"
                :class="
                  event.extendedProps.estado_visita === 'Realizada'
                    ? 'bg-green-900 text-green-400'
                    : 'bg-gray-900 text-[var(--shell-muted)]'
                "
              >
                {{ event.extendedProps.estado_visita }}
              </span>
            </div>

            <div class="mt-3 flex items-center justify-between">
              <div class="text-xs text-[var(--shell-muted)]">
                <i class="far fa-clock mr-1"></i>
                {{
                  new Date(event.start).toLocaleTimeString('es-CO', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                }}
              </div>

              <button
                v-if="
                  event.source === 'internal' && event.extendedProps?.estado_visita === 'Programada'
                "
                @click.stop="handleQuickComplete(event.extendedProps)"
                class="btn btn-sm btn-success py-1 px-3 text-xs"
              >
                Completar
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <dialog ref="externalDialog" class="planning-panel external-dialog" aria-labelledby="external-title">
      <header class="external-heading flex items-start justify-between gap-3 p-4">
        <div><p class="text-xs text-[var(--shell-muted)]">Google Calendar</p><h2 id="external-title" class="text-lg font-bold">{{ externalEvent?.title }}</h2></div>
        <button type="button" autofocus aria-label="Cerrar evento" class="rounded-lg border border-[var(--shell-border)] px-3 py-1" @click="externalDialog?.close()">✕</button>
      </header>
      <dl v-if="externalEvent" class="grid gap-3 p-4 text-sm sm:grid-cols-2">
        <div><dt class="text-[var(--shell-muted)]">Inicio</dt><dd class="font-semibold">{{ externalEvent.start.toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' }) }}</dd></div>
        <div><dt class="text-[var(--shell-muted)]">Fin</dt><dd class="font-semibold">{{ externalEvent.end.toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' }) }}</dd></div>
      </dl>
      <footer v-if="externalEvent?.link" class="flex justify-end px-4 pb-4">
        <a :href="externalEvent.link" target="_blank" rel="noopener noreferrer" class="planning-primary">Abrir en Google Calendar</a>
      </footer>
    </dialog>

    <!-- Modales Globales -->
    <VisitFormModal
      :show="(showCreateModal || showEditModal) && planningStore.clientsReady"
      :visit="editingVisit"
      :selected-date="selectedDate"
      :saving="isSavingVisit"
      @close="((showCreateModal = false), (showEditModal = false))"
      @save="handleSaveVisit"
      @delete="handleDeleteVisit"
    />

    <!-- Tooltip (Solo Desktop) -->
    <div
      v-if="hoveredDay"
      class="fixed z-[70] bg-[var(--shell-surface)] border border-[var(--shell-border)] rounded-lg shadow-2xl p-3 w-56 pointer-events-none text-left hidden lg:block"
      :style="tooltipPosition"
    >
      <h4 class="font-bold text-xs border-b border-[var(--shell-border)] pb-1 mb-2 text-[#d60000]">
        {{ hoveredDay.date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric' }) }}
      </h4>
      <ul class="space-y-1">
        <li
          v-for="event in hoveredDay.events.slice(0, 5)"
          :key="event.id"
          class="text-xs truncate flex items-center gap-2"
        >
          <div
            class="w-1.5 h-1.5 rounded-full shrink-0"
            :style="{
              backgroundColor:
                event.source === 'google' ? '#f59e0b' : getEventStyle(event).backgroundColor,
            }"
          ></div>
          <span class="text-[var(--shell-muted)]">{{ event.title }}</span>
        </li>
        <li v-if="hoveredDay.events.length > 5" class="text-[10px] text-[var(--shell-muted)] italic pl-3">
          y {{ hoveredDay.events.length - 5 }} más...
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.external-dialog { width: min(32rem, calc(100vw - 2rem)); margin: auto; padding: 0; color: var(--shell-text); overflow: hidden; }
.external-dialog::backdrop { background: #0009; }
.external-heading { border-bottom: 1px solid var(--shell-border); background: linear-gradient(115deg, var(--planning-tint), var(--shell-surface) 72%); }

.planning-page { color: var(--shell-text); --planning-accent: #b8000b; --planning-tint: #fff0f1; --planning-warning: #794300; }
[data-theme='dark'] .planning-page { color-scheme: dark; --planning-accent: #ff858b; --planning-tint: #412328; --planning-warning: #ffcc7a; }
.planning-panel { border: 1px solid var(--shell-border); border-radius: 0.9rem; background: var(--shell-surface); }
.planning-icon, .day-count { color: var(--planning-accent); background: var(--planning-tint); }
.planning-primary { display: inline-flex; min-height: 2.5rem; align-items: center; justify-content: center; padding: 0.45rem 0.8rem; border-radius: 0.55rem; background: #c7000c; color: #fff; font-size: 0.85rem; font-weight: 700; }
.planning-primary:hover { background: #a9000a; }
.calendar-panel { min-height: 32rem; }
.month-event { color: #111; }
[data-theme='dark'] .month-event { color: #fff; }
.conflict-bar { color: var(--planning-warning); border-bottom: 1px solid var(--shell-border); background: var(--shell-input); }
.conflict-label { color: var(--planning-warning); }
.day-event:hover { background: var(--shell-input); }
.planning-status-blue { color: #205084; }
.planning-status-green { color: #086534; }
.planning-status-red { color: #ac1221; }
[data-theme='dark'] .planning-status-blue { color: #b0d0ff; }
[data-theme='dark'] .planning-status-green { color: #a4e9b9; }
[data-theme='dark'] .planning-status-red { color: #ffb0b4; }
@media (prefers-reduced-motion: reduce) { .animate-slide-up { animation: none; } }

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
  background-color: var(--shell-input);
  /* gray-800 -> #202020 */
  border: 1px solid var(--shell-border);
  /* gray-700 -> border-[var(--shell-border)] */
  border-radius: 0.75rem;
  color: var(--shell-text);
  padding: 0.625rem 0.875rem;
  transition: all 0.2s ease-in-out;
  font-size: 0.875rem;
}

.input-field-dark:focus {
  outline: none;
  border-color: #d60000;
  /* indigo-500 -> brand-red */
  box-shadow: 0 0 0 4px rgba(214, 0, 0, 0.1);
  background-color: var(--shell-input);
  /* gray-900 */
}

.custom-scrollbar::-webkit-scrollbar {
  width: 5px;
}

.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
  background-color: var(--shell-scroll-thumb);
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
