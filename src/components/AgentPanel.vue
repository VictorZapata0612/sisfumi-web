<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useDashboardStore } from '@/stores/dashboard'
import {
  getAgentEntityContext,
  getPlanningConflictContext,
  getPlanningContext,
  getTechnicianWorkloadContext,
  getUnassignedVisitsContext,
  isTechnicianWorkloadQuestion,
  isUnassignedVisitsQuestion,
  type AgentVisit,
} from '@/agent/agentTools'

type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
  structured?: {
    type: 'visits' | 'services' | 'dashboard' | 'conflicts' | 'unassigned' | 'workload'
    subject?: string
    sections?: Array<{ title: string; items: Array<Record<string, unknown>> }>
    branches?: Record<string, Array<Record<string, unknown>>>
    kpis?: Array<{ label: string; value: string | number }>
    conflicts?: Array<Record<string, unknown>>
    metrics?: Array<{ label: string; value: string | number }>
  }
}

type OllamaResponse = {
  message?: {
    content?: string
  }

  type OllamaMessage = {
    role: 'system' | 'user' | 'assistant'
    content: string
  }
}

const emit = defineEmits<{
  close: []
}>()

const authStore = useAuthStore()
const dashboardStore = useDashboardStore()
const ollamaBaseUrl = (import.meta.env.VITE_OLLAMA_URL || 'http://127.0.0.1:11434').replace(/\/$/, '')
const ollamaModel = import.meta.env.VITE_OLLAMA_MODEL || 'sisfumi-assistant'
const input = ref('')
const isLoading = ref(false)
const loadingStatus = ref('Ollama está preparando la respuesta...')
const error = ref('')
const messagesContainer = ref<HTMLElement | null>(null)
const messages = ref<ChatMessage[]>([
  {
    role: 'assistant',
    content:
      'Hola. Soy el asistente local de SISFUMI. Puedo ayudarte a entender la aplicación y analizar los indicadores autorizados de tu operación.',
  },
])

const canSend = computed(() => input.value.trim().length > 0 && !isLoading.value)

const getRecentConversation = (): OllamaMessage[] =>
  messages.value
    .slice(-6)
    .map((message) => ({
      role: message.role,
      content: message.content.slice(0, 800),
    }))

const getRoutingQuestion = (currentQuestion: string) => {
  const previousUserMessage = [...messages.value]
    .reverse()
    .find((message) => message.role === 'user')?.content

  return previousUserMessage
    ? `Contexto de la pregunta anterior: ${previousUserMessage}\nPregunta actual: ${currentQuestion}`
    : currentQuestion
}

const scrollToBottom = async () => {
  await nextTick()
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
  }
}

const getOperationalContext = async (question: string) => {
  const asksUnassigned = isUnassignedVisitsQuestion(question)
  const asksWorkload = isTechnicianWorkloadQuestion(question)
  const asksConflict = /conflict|cruce|solapamiento|choque/i.test(question)
  const asksPlanning =
    asksUnassigned ||
    asksWorkload ||
    asksConflict ||
    /agenda|hoy|mañana|manana|esta semana|próxima semana|proxima semana|este mes|\d{1,2}\s+de\s+/i.test(
      question,
    )
  const asksEntity = /cliente|técnic|tecnico|servicio|sucursal|rendimiento|desempeño/i.test(question)

  loadingStatus.value = asksPlanning
    ? 'Consultando agenda autorizada...'
    : asksEntity
      ? 'Consultando entidad autorizada...'
      : 'Consultando indicadores autorizados...'

  const entityContext = asksEntity ? await getAgentEntityContext(question) : null
  const planningContext = asksPlanning ? await getPlanningContext(question) : null
  const conflictContext = asksConflict
    ? await getPlanningConflictContext(question, planningContext)
    : null
  const planningVisits = (planningContext?.visitas || []) as AgentVisit[]

  if (asksUnassigned || asksWorkload) {
    let visits = planningVisits
    if (visits.length === 0) {
      await dashboardStore.fetchDashboardData()
      visits = [...dashboardStore.todaysAgenda, ...dashboardStore.pendingVisits] as AgentVisit[]
    }
    return {
      entidadConsultada: null,
      agendaConsultada: planningContext,
      conflictosAgenda: conflictContext,
      visitasSinTecnico: asksUnassigned ? getUnassignedVisitsContext(visits) : null,
      cargaTecnicos: asksWorkload ? getTechnicianWorkloadContext(visits) : null,
    }
  }

  if (entityContext || planningContext || conflictContext) {
    return {
      entidadConsultada: entityContext,
      agendaConsultada: planningContext,
      conflictosAgenda: conflictContext,
      visitasSinTecnico: null,
      cargaTecnicos: null,
    }
  }

  loadingStatus.value = 'Consultando indicadores autorizados...'
  await dashboardStore.fetchDashboardData()
  if (!dashboardStore.kpis) {
    throw new Error(dashboardStore.error || 'No se pudieron cargar los indicadores operativos.')
  }

  const summarizeVisit = (visit: (typeof dashboardStore.todaysAgenda)[number]) => ({
    id: visit.id,
    cliente: visit.nombre_cliente,
    tipo: visit.tipo_visita,
    fecha: visit.fecha_visita,
    estado: visit.estado_visita || 'Programada',
    tecnicos: visit.fumigadores_asignados || [],
    zona: visit.zona,
  })
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const isFutureVisit = (visit: (typeof dashboardStore.pendingVisits)[number]) => {
    const date = new Date(visit.fecha_visita)
    return !Number.isNaN(date.getTime()) && date >= today
  }
  const futurePendingVisits = dashboardStore.pendingVisits.filter(isFutureVisit)
  const overduePendingVisits = dashboardStore.pendingVisits.filter((visit) => !isFutureVisit(visit))

  return {
    fechaConsulta: new Date().toISOString().slice(0, 10),
    alcance: {
      rol: authStore.userRole || 'Sin rol',
      zona: authStore.userZone || 'Sin zona',
    },
    indicadores: {
      sucursales: dashboardStore.kpis.totalBranches,
      serviciosActivos: dashboardStore.kpis.activeServices,
      visitasDelMes: dashboardStore.kpis.visitsThisMonth,
      porcentajeCumplimientoDelMes: dashboardStore.kpis.completionRateThisMonth,
      ingresosDelMes: dashboardStore.kpis.revenueThisMonth,
    },
    agendaDeHoy: {
      total: dashboardStore.todaysAgenda.length,
      registros: dashboardStore.todaysAgenda.slice(0, 30).map(summarizeVisit),
    },
    visitasPendientes: {
      total: dashboardStore.pendingVisits.length,
      registros: dashboardStore.pendingVisits.slice(0, 30).map(summarizeVisit),
    },
    visitasPendientesFuturas: {
      total: futurePendingVisits.length,
      registros: futurePendingVisits.slice(0, 30).map(summarizeVisit),
    },
    visitasVencidas: {
      total: overduePendingVisits.length,
      registros: overduePendingVisits.slice(0, 30).map(summarizeVisit),
    },
    entidadConsultada: entityContext,
    agendaConsultada: planningContext,
    conflictosAgenda: conflictContext,
    visitasSinTecnico: null,
    cargaTecnicos: null,
    nota: 'Estos datos fueron obtenidos por la aplicación usando los permisos del usuario actual. El total de visitas pendientes pertenece al conjunto devuelto por el dashboard y no debe interpretarse automáticamente como un total mensual.',
  }

}

const formatUnassignedVisits = (operationalContext: unknown): ChatMessage => {
  const context = operationalContext as {
    total?: number
    limitado?: boolean
    visitas?: Array<Record<string, string | undefined>>
  }
  return {
    role: 'assistant',
    content: context.total
      ? `Encontré ${context.total} visita${context.total === 1 ? '' : 's'} activa${context.total === 1 ? '' : 's'} sin técnico asignado.`
      : 'No encontré visitas activas sin técnico asignado en el conjunto consultado.',
    structured: {
      type: 'unassigned',
      sections: [
        {
          title: context.limitado ? 'Primeras 30 visitas' : 'Visitas',
          items: context.visitas || [],
        },
      ],
    },
  }
}

const formatWorkload = (operationalContext: unknown): ChatMessage => {
  const context = operationalContext as {
    promedio?: number
    sobrecargados?: Array<Record<string, unknown>>
    técnicos?: Array<Record<string, unknown>>
  }
  return {
    role: 'assistant',
    content: context.sobrecargados?.length
      ? `Detecté ${context.sobrecargados.length} técnico${context.sobrecargados.length === 1 ? '' : 's'} con carga alta.`
      : 'No detecté técnicos con carga alta en el conjunto consultado.',
    structured: {
      type: 'workload',
      kpis: [{ label: 'Promedio de visitas activas', value: context.promedio ?? 0 }],
      sections: [
        {
          title: 'Técnicos con carga alta',
          items: context.sobrecargados || [],
        },
        {
          title: 'Carga por técnico',
          items: context.técnicos || [],
        },
      ],
    },
  }
}

const formatServicesByBranch = (entityContext: unknown) => {
  const context = entityContext as {
    cliente?: { nombre?: string }
    serviciosPorSucursal?: Record<string, Array<{ tipo?: string; frecuencia?: string; estado?: string }>>
  }
  const groups = context.serviciosPorSucursal || {}
  const branches = Object.entries(groups)

  if (branches.length === 0) {
    return {
      role: 'assistant' as const,
      content: `No encontré servicios contratados con una sucursal asociada para ${context.cliente?.nombre || 'este cliente'}.`,
    }
  }

  return {
    role: 'assistant' as const,
    content: `Servicios contratados de ${context.cliente?.nombre || 'este cliente'} por sucursal:`,
    structured: {
      type: 'services' as const,
      subject: context.cliente?.nombre || 'este cliente',
      branches: Object.fromEntries(branches),
    },
  }
}

const formatDashboard = (operationalContext: unknown, question: string): ChatMessage => {
  const context = operationalContext as {
    indicadores?: Record<string, string | number>
    visitasPendientes?: { total?: number }
  }
  const indicators = context.indicadores || {}
  const availableKpis = [
    { key: 'clientes', label: 'Clientes', value: indicators.clientes ?? 'Sin dato', match: /clientes?/i },
    { key: 'sucursales', label: 'Sucursales', value: indicators.sucursales ?? 'Sin dato', match: /sucursales?/i },
    { key: 'serviciosActivos', label: 'Servicios activos', value: indicators.serviciosActivos ?? 'Sin dato', match: /servicios? activos?/i },
    { key: 'visitasDelMes', label: 'Visitas del mes', value: indicators.visitasDelMes ?? 'Sin dato', match: /visitas? del mes/i },
    { key: 'visitasPendientes', label: 'Visitas pendientes', value: context.visitasPendientes?.total ?? 'Sin dato', match: /visitas? pendientes?/i },
    { key: 'cumplimiento', label: 'Cumplimiento del mes', value: `${indicators.porcentajeCumplimientoDelMes ?? 'Sin dato'}%`, match: /cumplimiento/i },
    { key: 'ingresos', label: 'Ingresos del mes', value: indicators.ingresosDelMes ?? 'Sin dato', match: /ingresos?|facturación|facturacion/i },
  ]
  const requested = availableKpis.filter((kpi) => kpi.match.test(question))
  const kpis = (requested.length > 0 ? requested : availableKpis).map((kpi) => ({
    label: kpi.label,
    value: kpi.value,
  }))

  return {
    role: 'assistant',
    content: requested.length === 1 ? requested[0]!.label : 'Indicadores operativos actualizados',
    structured: { type: 'dashboard', kpis },
  }
}

const formatVisits = (entityContext: unknown): ChatMessage => {
  const context = entityContext as {
    tipo?: string
    cliente?: { nombre?: string }
    técnico?: { nombre?: string }
    indicadores?: { assigned?: number; completed?: number; rate?: number }
    visitasFuturas?: Array<Record<string, unknown>>
    visitasVencidas?: Array<Record<string, unknown>>
    historialPasado?: Array<Record<string, unknown>>
  }
  const subject = context.cliente?.nombre || context.técnico?.nombre || 'la entidad consultada'
  const future = context.visitasFuturas || []
  const overdue = context.visitasVencidas || []
  const history = context.historialPasado || []
  const formatDate = (value: unknown) => {
    const date = new Date(String(value || ''))
    if (Number.isNaN(date.getTime())) return 'Fecha sin dato'
    return new Intl.DateTimeFormat('es-CO', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date)
  }

  return {
    role: 'assistant',
    content: `Visitas de ${subject}`,
    structured: {
      type: 'visits',
      subject,
      metrics: context.indicadores
        ? [
            { label: 'Asignadas', value: context.indicadores.assigned ?? 'Sin dato' },
            { label: 'Realizadas', value: context.indicadores.completed ?? 'Sin dato' },
            { label: 'Cumplimiento', value: `${context.indicadores.rate ?? 'Sin dato'}%` },
          ]
        : undefined,
      sections: [
        { title: 'Próximas visitas', items: future },
        { title: 'Pendientes vencidas', items: overdue },
        { title: 'Historial realizado', items: history },
      ].map((section) => ({
        ...section,
        items: section.items.map((visit) => ({
          ...visit,
          fechaLegible: formatDate(visit.fecha),
        })),
      })),
    },
  }
}

const formatPlanning = (planningContext: unknown): ChatMessage => {
  const context = planningContext as { visitas?: Array<Record<string, unknown>> }
  const visits = context.visitas || []
  const formatDate = (value: unknown) => {
    const date = new Date(String(value || ''))
    if (Number.isNaN(date.getTime())) return 'Fecha sin dato'
    return new Intl.DateTimeFormat('es-CO', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    }).format(date)
  }

  return {
    role: 'assistant',
    content: 'Agenda consultada',
    structured: {
      type: 'visits',
      subject: 'la agenda solicitada',
      sections: [{
        title: 'Visitas encontradas',
        items: visits.map((visit) => ({
          ...visit,
          fechaLegible: formatDate(visit.fecha_visita),
          tipo: visit.tipo_visita,
          cliente: visit.nombre_cliente,
          sucursal: visit.sucursal || visit.nombre_sucursal || 'Sucursal sin dato',
          estado: visit.estado_visita || 'Sin estado',
        })),
      }],
    },
  }
}

const formatConflicts = (conflictContext: unknown): ChatMessage => {
  const context = conflictContext as { conflictos?: Array<Record<string, unknown>> }
  const conflicts = context.conflictos || []
  const cards = conflicts.map((conflict) => {
    const first = (conflict.primera || {}) as Record<string, unknown>
    const second = (conflict.segunda || {}) as Record<string, unknown>
    return {
      técnicos: Array.isArray(conflict.técnicos) ? conflict.técnicos.join(', ') : 'Sin técnico',
      primera: `${first.nombre_cliente || 'Cliente sin dato'} · ${first.fecha_visita || 'Fecha sin dato'}`,
      segunda: `${second.nombre_cliente || 'Cliente sin dato'} · ${second.fecha_visita || 'Fecha sin dato'}`,
    }
  })
  return {
    role: 'assistant',
    content: cards.length ? 'Conflictos de agenda detectados' : 'No se detectaron conflictos de agenda',
    structured: { type: 'conflicts', conflicts: cards },
  }
}

const sendMessage = async () => {
  const content = input.value.trim()
  if (!content || isLoading.value) return

  error.value = ''
  input.value = ''
  const conversationHistory = getRecentConversation()
  const routingQuestion = getRoutingQuestion(content)
  messages.value.push({ role: 'user', content })
  await scrollToBottom()
  isLoading.value = true
  loadingStatus.value = 'Ollama está preparando la respuesta...'
  let timeoutId: number | undefined

  try {
    const operationalContext = await getOperationalContext(routingQuestion)
    const entityContext = operationalContext.entidadConsultada as
      | { tipo?: string; cliente?: { nombre?: string }; serviciosPorSucursal?: Record<string, Array<{ tipo?: string; frecuencia?: string; estado?: string }>> }
      | null

    if (operationalContext.visitasSinTecnico) {
      messages.value.push(formatUnassignedVisits(operationalContext.visitasSinTecnico))
      return
    }

    if (operationalContext.cargaTecnicos) {
      messages.value.push(formatWorkload(operationalContext.cargaTecnicos))
      return
    }

    if (entityContext?.tipo === 'servicios por sucursal') {
      const serviceAnswer = formatServicesByBranch(entityContext)
        messages.value.push(serviceAnswer)
      return
    }

    if (entityContext?.tipo === 'visitas de cliente' || entityContext?.tipo === 'visitas de técnico') {
      messages.value.push(formatVisits(entityContext))
      return
    }

    if (operationalContext.conflictosAgenda) {
      messages.value.push(formatConflicts(operationalContext.conflictosAgenda))
      return
    }

    if (operationalContext.agendaConsultada) {
      messages.value.push(formatPlanning(operationalContext.agendaConsultada))
      return
    }

    if (/cuántos clientes|cuántas visitas|cumplimiento|ingresos|indicadores|dashboard|servicios activos|visitas pendientes/i.test(routingQuestion)) {
      messages.value.push(formatDashboard(operationalContext, routingQuestion))
      return
    }

    const context = `Contexto operativo autorizado de SISFUMI:\n${JSON.stringify(operationalContext)}\n\nReglas de interpretación: si existe serviciosPorSucursal, responde agrupando cada servicio bajo su sucursal y no enumeres fechas ni menciones agenda o historial. Usa serviciosContratados solo para describir servicios contratados. Usa visitasFuturas para preguntas sobre próximas visitas. Usa historialPasado solo para visitas anteriores. Nunca presentes una fecha de historial como pendiente, futura o programada. Usa visitasDelMes únicamente para el indicador mensual, agendaDeHoy para la fecha actual y visitasPendientesFuturas para pendientes futuros.`
    const apiMessages: OllamaMessage[] = [
      {
        role: 'system',
        content:
          'Eres el asistente interno de SISFUMI. Usa la conversación reciente para entender preguntas de seguimiento. Responde únicamente con el contexto operativo entregado y no inventes datos. Este asistente es de solo lectura.',
      },
      ...conversationHistory,
      {
        role: 'user' as const,
        content: `${context}\n\nPregunta del usuario:\n${content}`,
      },
    ]
    loadingStatus.value = 'Ollama está generando la respuesta...'
    const controller = new AbortController()
    timeoutId = window.setTimeout(() => controller.abort(), 300000)
    const response = await fetch(`${ollamaBaseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model: ollamaModel,
        stream: false,
        keep_alive: '10m',
        options: { temperature: 0.2, num_predict: 192 },
        messages: apiMessages,
      }),
    })

    if (!response.ok) {
      throw new Error(`Ollama respondió con HTTP ${response.status}.`)
    }

    loadingStatus.value = 'Ollama está escribiendo...'
    const data = (await response.json()) as OllamaResponse
    const answer = data.message?.content?.trim()
    if (!answer) throw new Error('Ollama no devolvió una respuesta.')

    messages.value.push({ role: 'assistant', content: answer })

  } catch (requestError) {
    console.error('Error conectando con Ollama:', requestError)
    error.value = requestError instanceof DOMException && requestError.name === 'AbortError'
      ? `Ollama tardó más de 5 minutos en responder. Verifica el modelo ${ollamaModel} o reduce el volumen de datos de la consulta.`
      : `No se pudo conectar con el asistente local (${ollamaBaseUrl}). Verifica que Ollama esté ejecutándose con el modelo ${ollamaModel}.`
  } finally {
    if (timeoutId !== undefined) window.clearTimeout(timeoutId)
    isLoading.value = false
    await scrollToBottom()
  }
}
</script>

<template>
  <aside
    class="fixed right-4 bottom-20 z-[60] flex h-[min(680px,calc(100vh-7rem))] w-[min(420px,calc(100vw-2rem))] flex-col overflow-hidden rounded-xl border border-white/10 bg-[#151515] shadow-2xl"
    aria-label="Asistente SISFUMI"
  >
    <header class="flex items-center justify-between border-b border-white/10 px-4 py-3">
      <div>
        <p class="font-semibold text-white">Asistente SISFUMI</p>
        <p class="text-xs text-gray-400">Modelo local · solo lectura</p>
      </div>
      <button
        type="button"
        class="rounded p-2 text-gray-400 transition hover:bg-white/10 hover:text-white"
        title="Cerrar asistente"
        aria-label="Cerrar asistente"
        @click="emit('close')"
      >
        <i class="fas fa-times"></i>
      </button>
    </header>

    <div ref="messagesContainer" class="flex-1 space-y-3 overflow-y-auto p-4">
      <div
        v-for="(message, index) in messages"
        :key="`${message.role}-${index}`"
        class="max-w-[90%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap"
        :class="message.role === 'user' ? 'ml-auto bg-red-700 text-white' : 'bg-white/10 text-gray-200'"
      >
        <template v-if="message.structured?.type === 'visits'">
          <p class="mb-3 font-semibold text-white">Visitas de {{ message.structured.subject }}</p>
          <div v-if="message.structured.metrics" class="mb-3 grid grid-cols-3 gap-2">
            <article
              v-for="metric in message.structured.metrics"
              :key="metric.label"
              class="rounded-md border border-white/10 bg-black/20 p-2"
            >
              <p class="text-[10px] uppercase tracking-wide text-gray-500">{{ metric.label }}</p>
              <p class="mt-1 text-sm font-semibold text-white">{{ metric.value }}</p>
            </article>
          </div>
          <section
            v-for="section in message.structured.sections"
            :key="section.title"
            class="mb-3 last:mb-0"
          >
            <h4 class="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
              {{ section.title }}
            </h4>
            <p v-if="section.items.length === 0" class="text-xs text-gray-500">
              No hay registros.
            </p>
            <article
              v-for="(visit, visitIndex) in section.items"
              :key="`${section.title}-${visitIndex}`"
              class="mb-2 rounded-md border border-white/10 bg-black/20 p-2 last:mb-0"
            >
              <div class="flex items-start justify-between gap-2">
                <p class="font-medium text-gray-100">{{ visit.tipo || 'Tipo sin dato' }}</p>
                <span class="shrink-0 rounded-full bg-yellow-500/15 px-2 py-0.5 text-[10px] text-yellow-300">
                  {{ visit.estado || 'Sin estado' }}
                </span>
              </div>
              <p class="mt-1 text-xs text-gray-300">{{ visit.fechaLegible }}</p>
              <p class="mt-1 text-xs text-gray-400">
                Cliente: {{ visit.cliente || 'Cliente sin dato' }}
              </p>
              <p class="text-xs text-gray-400">
                Sucursal: {{ visit.sucursal || 'Sucursal sin dato' }}
              </p>
              <p v-if="visit.zona" class="text-xs text-gray-500">{{ visit.zona }}</p>
            </article>
          </section>
        </template>
        <template v-else-if="message.structured?.type === 'services'">
          <p class="mb-3 font-semibold text-white">
            Servicios de {{ message.structured.subject }}
          </p>
          <section
            v-for="(services, branch) in message.structured.branches"
            :key="branch"
            class="mb-3 last:mb-0"
          >
            <h4 class="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
              {{ branch }}
            </h4>
            <article
              v-for="(service, serviceIndex) in services"
              :key="`${branch}-${serviceIndex}`"
              class="mb-2 rounded-md border border-white/10 bg-black/20 p-2 last:mb-0"
            >
              <p class="font-medium text-gray-100">{{ service.tipo || 'Servicio sin dato' }}</p>
              <p class="mt-1 text-xs text-gray-400">
                {{ service.frecuencia || 'Frecuencia sin dato' }} ·
                {{ service.estado || 'Estado sin dato' }}
              </p>
            </article>
          </section>
        </template>
        <template v-else-if="message.structured?.type === 'dashboard'">
          <p class="mb-3 font-semibold text-white">Indicadores operativos</p>
          <div class="grid grid-cols-2 gap-2">
            <article
              v-for="kpi in message.structured.kpis"
              :key="kpi.label"
              class="rounded-md border border-white/10 bg-black/20 p-2"
            >
              <p class="text-[10px] uppercase tracking-wide text-gray-500">{{ kpi.label }}</p>
              <p class="mt-1 text-base font-semibold text-white">{{ kpi.value }}</p>
            </article>
          </div>
        </template>
        <template v-else-if="message.structured?.type === 'conflicts'">
          <p class="mb-3 font-semibold text-white">Conflictos de agenda</p>
          <p v-if="message.structured.conflicts?.length === 0" class="text-sm text-gray-400">
            No se detectaron conflictos en el rango consultado.
          </p>
          <article
            v-for="(conflict, conflictIndex) in message.structured.conflicts"
            :key="`conflict-${conflictIndex}`"
            class="mb-2 rounded-md border border-red-500/30 bg-red-950/20 p-3 last:mb-0"
          >
            <p class="font-medium text-red-200">
              Técnico: {{ conflict.técnicos }}
            </p>
            <p class="mt-2 text-xs text-gray-300">{{ conflict.primera }}</p>
            <p class="text-xs text-gray-400">{{ conflict.segunda }}</p>
          </article>
        </template>
        <template v-else-if="message.structured?.type === 'unassigned'">
          <p class="mb-3 font-semibold text-white">Visitas sin técnico asignado</p>
          <section
            v-for="section in message.structured.sections"
            :key="section.title"
            class="mb-3 last:mb-0"
          >
            <h4 class="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
              {{ section.title }}
            </h4>
            <p v-if="section.items.length === 0" class="text-xs text-gray-500">
              No hay registros.
            </p>
            <article
              v-for="(visit, visitIndex) in section.items"
              :key="`unassigned-${visitIndex}`"
              class="mb-2 rounded-md border border-yellow-500/20 bg-black/20 p-2 last:mb-0"
            >
              <p class="font-medium text-gray-100">{{ visit.cliente || 'Cliente sin dato' }}</p>
              <p class="mt-1 text-xs text-gray-300">{{ visit.fecha || 'Fecha sin dato' }}</p>
              <p class="text-xs text-gray-400">
                {{ visit.tipo || 'Tipo sin dato' }} · {{ visit.sucursal || 'Sucursal sin dato' }}
              </p>
              <p class="text-xs text-gray-500">
                {{ visit.zona || 'Zona sin dato' }} · {{ visit.estado || 'Sin estado' }}
              </p>
            </article>
          </section>
        </template>
        <template v-else-if="message.structured?.type === 'workload'">
          <p class="mb-3 font-semibold text-white">Carga operativa de técnicos</p>
          <div class="mb-3 grid grid-cols-2 gap-2">
            <article
              v-for="kpi in message.structured.kpis"
              :key="kpi.label"
              class="rounded-md border border-white/10 bg-black/20 p-2"
            >
              <p class="text-[10px] uppercase tracking-wide text-gray-500">{{ kpi.label }}</p>
              <p class="mt-1 text-base font-semibold text-white">{{ kpi.value }}</p>
            </article>
          </div>
          <section
            v-for="section in message.structured.sections"
            :key="section.title"
            class="mb-3 last:mb-0"
          >
            <h4 class="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
              {{ section.title }}
            </h4>
            <p v-if="section.items.length === 0" class="text-xs text-gray-500">
              No hay registros.
            </p>
            <article
              v-for="(technician, technicianIndex) in section.items"
              :key="`workload-${section.title}-${technicianIndex}`"
              class="mb-2 rounded-md border border-white/10 bg-black/20 p-2 last:mb-0"
            >
              <p class="font-medium text-gray-100">
                {{ technician.tecnico || 'Técnico sin dato' }}
              </p>
              <p class="mt-1 text-xs text-gray-400">
                {{ technician.total || 0 }} visita(s) activa(s)
              </p>
            </article>
          </section>
        </template>
        <template v-else>{{ message.content }}</template>
      </div>
      <div
        v-if="isLoading"
        class="flex max-w-[90%] items-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-sm text-gray-400"
        aria-live="polite"
      >
        <span class="typing-dots" aria-hidden="true">
          <span class="typing-dot"></span>
          <span class="typing-dot"></span>
          <span class="typing-dot"></span>
        </span>
        <span>{{ loadingStatus }}</span>
      </div>
    </div>

    <p v-if="error" class="border-t border-red-500/30 bg-red-950/40 px-4 py-2 text-xs text-red-200">
      {{ error }}
    </p>

    <form class="border-t border-white/10 p-3" @submit.prevent="sendMessage">
      <div class="flex items-end gap-2">
        <textarea
          v-model="input"
          rows="2"
          class="min-w-0 flex-1 resize-none rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none placeholder:text-gray-500 focus:border-red-500"
          placeholder="Escribe una pregunta..."
          :disabled="isLoading"
          @keydown.enter.exact.prevent="sendMessage"
        ></textarea>
        <button
          type="submit"
          class="rounded-lg bg-red-700 p-3 text-white transition hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-50"
          title="Enviar pregunta"
          aria-label="Enviar pregunta"
          :disabled="!canSend"
        >
          <i class="fas fa-paper-plane"></i>
        </button>
      </div>
    </form>
  </aside>
</template>

<style scoped>
.typing-dots {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  min-width: 22px;
}

.typing-dot {
  width: 5px;
  height: 5px;
  border-radius: 999px;
  background: currentColor;
  animation: typing-bounce 1.2s infinite ease-in-out;
}

.typing-dot:nth-child(2) {
  animation-delay: 0.15s;
}

.typing-dot:nth-child(3) {
  animation-delay: 0.3s;
}

@keyframes typing-bounce {
  0%,
  60%,
  100% {
    transform: translateY(0);
    opacity: 0.45;
  }

  30% {
    transform: translateY(-3px);
    opacity: 1;
  }
}
</style>
