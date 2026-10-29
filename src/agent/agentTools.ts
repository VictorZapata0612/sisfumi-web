import { httpsCallable } from 'firebase/functions'
import { functions } from '@/firebase/config'

type SearchResult = {
  id: string
  nombreComercial?: string
  nombreCompleto?: string
  ciudad?: string
  zona?: string
  estado?: string
  sucursales?: Array<{ id?: string; nombre?: string }>
}

export const isUnassignedVisitsQuestion = (question: string) => {
  const asksForUnassigned = /sin técnico|sin tecnico|no tienen|sin asignar|no asignad[oa]s?/i.test(question)
  // Si pide proponer o asignar explícitamente, gana la intención de propuesta
  return asksForUnassigned && !isAssignmentProposalQuestion(question)
}

export const isTechnicianWorkloadQuestion = (question: string) => {
  const asksForWorkload = /sobrecarg|carga de técnicos|carga de tecnicos|técnicos disponibles|tecnicos disponibles|qu[eé] técnicos hay|que tecnicos hay|menos carga/i.test(question)
  return asksForWorkload && !isAssignmentProposalQuestion(question)
}

export const isAssignmentProposalQuestion = (question: string) => {
  // Limpiamos frases de estado para no confundir verbos (ej. quitamos "sin asignar" para que no detecte "asignar")
  const cleanQ = question.replace(/sin asignar|no asignad[oa]s?/gi, '')

  // Verbos explícitos de acción / propuesta
  const hasProposalVerb = /\b(proponer|prop[oó]n|sugerir|sugiere|recomendar|recomienda|asignar|asigna|asígnale|c[uú]brela|cubrir|cambia|quita|cancela)\b/i.test(cleanQ)

  // Sujetos de la acción
  const targetsAssignment = /\b(técnic[oa]s?|tecnic[oa]s?|visitas?|primera|segunda|esta|esa|selección|seleccion|propuesta)\b/i.test(cleanQ)

  return hasProposalVerb && targetsAssignment
}

export const isPlanningQuestion = (question: string) =>
  /agenda|visitas?|planeación|planeacion|hoy|mañana|manana|esta semana|próxima semana|proxima semana|este mes|\d{1,2}\s+de\s+/i.test(
    question,
  ) || isUnassignedVisitsQuestion(question) || isTechnicianWorkloadQuestion(question) || isAssignmentProposalQuestion(question)

type ClientProfile = {
  client?: SearchResult
  serviceSheet?: {
    services?: Array<{
      tipo_servicio?: string
      frecuencia?: string
      estado_servicio?: string
      sucursales_asignadas?: string[]
    }>
  } | null
  upcomingVisits?: Array<Record<string, unknown>>
  visitHistory?: Array<Record<string, unknown>>
}

type TechnicianProfile = {
  technician?: SearchResult
  kpis?: { assigned: number; completed: number; rate: number }
  upcomingVisits?: Array<Record<string, unknown>>
  recentHistory?: Array<Record<string, unknown>>
}

export type AgentVisit = {
  id?: string
  nombre_cliente?: string
  clientName?: string
  tipo_visita?: string
  fecha_visita?: string
  estado_visita?: string
  fumigadores_asignados?: string[]
  duracion_minutos?: number
  zona?: string
  sucursal?: string
  nombre_sucursal?: string
}

export type AgentTechnician = {
  id?: string
  nombreCompleto?: string
  nombre?: string
  zona?: string
}

const isUnassignedVisit = (visit: AgentVisit) =>
  !Array.isArray(visit.fumigadores_asignados) || visit.fumigadores_asignados.length === 0

const isActiveVisit = (visit: AgentVisit) =>
  visit.estado_visita !== 'Realizada' && visit.estado_visita !== 'Cancelada'

const getVisitInterval = (visit: AgentVisit) => {
  const start = new Date(String(visit.fecha_visita || ''))
  if (Number.isNaN(start.getTime())) return null

  const duration = Number(visit.duracion_minutos) || 60
  return {
    start,
    end: new Date(start.getTime() + duration * 60 * 1000),
  }
}

const visitsOverlap = (first: AgentVisit, second: AgentVisit) => {
  const firstInterval = getVisitInterval(first)
  const secondInterval = getVisitInterval(second)
  if (!firstInterval || !secondInterval) return false

  return firstInterval.start < secondInterval.end && secondInterval.start < firstInterval.end
}

const formatVisitDate = (value?: string) => {
  if (!value) return 'Fecha sin dato'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

const uniqueVisits = (visits: AgentVisit[]) =>
  Array.from(new Map(visits.filter((visit) => visit.id).map((visit) => [visit.id, visit])).values())

export function getUnassignedVisitsContext(visits: AgentVisit[]) {
  const unassigned = uniqueVisits(visits)
    .filter((visit) => isActiveVisit(visit) && isUnassignedVisit(visit))
    .sort((first, second) =>
      String(first.fecha_visita || '').localeCompare(String(second.fecha_visita || '')),
    )

  return {
    tipo: 'visitas sin técnico',
    total: unassigned.length,
    visitas: unassigned.slice(0, 30).map((visit) => ({
      id: visit.id,
      cliente: visit.nombre_cliente || visit.clientName || 'Cliente sin dato',
      sucursal: visit.sucursal || visit.nombre_sucursal || 'Sucursal sin dato',
      tipo: visit.tipo_visita || 'Tipo sin dato',
      fecha: formatVisitDate(visit.fecha_visita),
      estado: visit.estado_visita || 'Sin estado',
      zona: visit.zona || 'Zona sin dato',
    })),
    limitado: unassigned.length > 30,
    nota: unassigned.length > 30
      ? 'NOTA PARA EL LLM: Has recibido solo las primeras 30 visitas. Informa al usuario que hay más registros pero no se muestran todos para no saturar la vista.'
      : 'Lista completa de visitas sin asignar obtenidas en el contexto actual.',
  }
}

export function getTechnicianWorkloadContext(visits: AgentVisit[]) {
  const activeVisits = uniqueVisits(visits).filter(
    (visit) => isActiveVisit(visit) && !isUnassignedVisit(visit),
  )
  const workload = new Map<string, { total: number; visits: Array<Record<string, string | undefined>> }>()

  activeVisits.forEach((visit) => {
    visit.fumigadores_asignados?.forEach((technician) => {
      const current = workload.get(technician) || { total: 0, visits: [] }
      current.total += 1
      current.visits.push({
        cliente: visit.nombre_cliente || visit.clientName || 'Cliente sin dato',
        fecha: formatVisitDate(visit.fecha_visita),
        tipo: visit.tipo_visita || 'Tipo sin dato',
      })
      workload.set(technician, current)
    })
  })

  const entries = Array.from(workload.entries())
    .map(([tecnico, data]) => ({ tecnico, ...data }))
    .sort((first, second) => second.total - first.total)
  const average = entries.length
    ? entries.reduce((total, entry) => total + entry.total, 0) / entries.length
    : 0
  const overloaded = entries.filter((entry) => entry.total >= 5 || entry.total > average + 2)

  return {
    tipo: 'carga de técnicos',
    promedio: Number(average.toFixed(1)),
    sobrecargados: overloaded.map((entry) => ({
      ...entry,
      visitas: entry.visits.slice(0, 10),
    })),
    técnicos: entries.map((entry) => ({
      tecnico: entry.tecnico,
      total: entry.total,
    })),
    nota: 'La sobrecarga es una señal operativa basada en visitas activas del conjunto consultado; debe revisarse antes de reasignar.',
  }
}

export function getAssignmentProposalContext(
    visits: AgentVisit[],
    technicians: AgentTechnician[],
  ) {
    const unassigned = uniqueVisits(visits).filter(
      (visit) => isActiveVisit(visit) && isUnassignedVisit(visit),
    )
    const activeVisits = uniqueVisits(visits).filter(
      (visit) => isActiveVisit(visit) && !isUnassignedVisit(visit),
    )
    const workload = new Map<string, number>()

    activeVisits.forEach((visit) => {
      visit.fumigadores_asignados?.forEach((technician) => {
        workload.set(technician, (workload.get(technician) || 0) + 1)
      })
    })

    const proposals = unassigned.slice(0, 20).map((visit) => {
      const candidates = technicians
        .filter((technician) => !visit.zona || !technician.zona || technician.zona === visit.zona)
        .map((technician) => {
          const name = technician.nombreCompleto || technician.nombre || technician.id || 'Técnico sin nombre'
          const conflictingVisits = activeVisits
            .filter(
              (scheduledVisit) =>
                scheduledVisit.fumigadores_asignados?.includes(name) &&
                visitsOverlap(visit, scheduledVisit),
            )
            .slice(0, 3)

          return {
            tecnico: name,
            zona: technician.zona || 'Zona sin dato',
            visitasActivas: workload.get(name) || 0,
            tieneConflicto: conflictingVisits.length > 0,
            conflictos: conflictingVisits.map((conflictingVisit) => ({
              cliente:
                conflictingVisit.nombre_cliente ||
                conflictingVisit.clientName ||
                'Cliente sin dato',
              fecha: formatVisitDate(conflictingVisit.fecha_visita),
            })),
          }
        })
        .sort((first, second) => {
          if (first.tieneConflicto !== second.tieneConflicto) {
            return first.tieneConflicto ? 1 : -1
          }
          return first.visitasActivas - second.visitasActivas
        })

      return {
        visita: {
          id: visit.id,
          cliente: visit.nombre_cliente || visit.clientName || 'Cliente sin dato',
          fecha: formatVisitDate(visit.fecha_visita),
          zona: visit.zona || 'Zona sin dato',
          tipo: visit.tipo_visita || 'Tipo sin dato',
        },
        candidatos: candidates.slice(0, 3),
        advertencia:
          candidates.length === 0 ? 'No hay técnicos candidatos en la zona.' : undefined,
      }
    })

return {
      tipo: 'propuesta de asignación',
      totalVisitas: unassigned.length,
      propuestas: proposals,
      limitado: unassigned.length > 20,
      nota: 'Esto es una propuesta de solo lectura. No se ha ejecutado ninguna escritura en base de datos. Pide al usuario que use los botones de la interfaz para seleccionar a los técnicos.',
    }
}

const cleanSearchTerm = (value: string) =>
  value
    .replace(/^según los datos proporcionados[,\s]*/i, '')
    .replace(/^segun los datos proporcionados[,\s]*/i, '')
    .replace(/^datos proporcionados[,\s]*/i, '')
    .replace(/[¿?¡!,:;]/g, ' ')
    .replace(/\b(hoy|ahora|este mes|del mes|de hoy)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const extractClientTerm = (question: string) => {
  const afterTiene = question.match(/\btiene\s+(?:el\s+cliente\s+)?(.+)$/i)
  if (afterTiene?.[1]) {
    const term = cleanSearchTerm(afterTiene[1]).replace(/^el\s+técnico\s+/i, '').trim()
    if (
      term.length >= 3 &&
      !/servicio|sucursal|contratad|programad/i.test(term) &&
      !/^(en|para)$/i.test(term)
    ) {
      return term
    }
  }

  const beforeTiene = question.match(/(?:^|,\s*)(.+?)\s+tiene\b/i)
  if (beforeTiene?.[1]) {
    const term = cleanSearchTerm(beforeTiene[1])
      .replace(/^(qué|que)\s+(servicios?|ficha)\s+/i, '')
      .replace(/^el\s+cliente\s+/i, '')
      .trim()
    if (term.length >= 3 && !/^(según|segun|los datos)$/i.test(term)) return term
  }

  const explicitClient = question.match(/\bcliente\s+(.+?)(?:\s+(?:tiene|posee|cuenta|dispone)|$)/i)
  return explicitClient?.[1] ? cleanSearchTerm(explicitClient[1]) : null
}

const extractEntity = (question: string, kind: 'client' | 'technician') => {
  if (kind === 'client') return extractClientTerm(question)

  const pattern = /(?:técnico|tecnico|visitas de|perfil de|rendimiento de|desempeño de|carga de)\s+(?:del|de la|de|para)?\s*(.+)$/i
  const match = question.match(pattern)
  const term = match?.[1] ? cleanSearchTerm(match[1]) : ''
  if (!term || term.length < 3 || /^(un cliente|un técnico|un tecnico)$/i.test(term)) return null
  return term
}

const isServiceQuestion = (question: string) =>
  /servicio|servicios|contratad|frecuencia|sucursal/i.test(question)

const isVisitQuestion = (question: string) =>
  /visita|visitas|agenda|pendiente|historial|programad|realizad/i.test(question)

const searchEntity = async (term: string, kind: 'client' | 'technician') => {
  const searchFn = httpsCallable(functions, 'globalSearch')
  const candidates = Array.from(
    new Set([term, term.replace(/[.,]+$/, ''), term.split(/\s+/)[0]]),
  ).filter(Boolean)

  for (const candidate of candidates) {
    const result = (await searchFn({ term: candidate })) as {
      data: { clients?: SearchResult[]; fumigadores?: SearchResult[] }
    }
    const results = kind === 'client' ? result.data.clients || [] : result.data.fumigadores || []
    if (results.length > 0) {
      const normalizedTerm = term.toLowerCase().replace(/[.,]/g, '')
      const exact = results.find((item) => {
        const name = (kind === 'client' ? item.nombreComercial : item.nombreCompleto) || ''
        return name.toLowerCase().replace(/[.,]/g, '').includes(normalizedTerm)
      })
      return exact || results[0]
    }
  }

  return null
}

const summarizeVisits = (
  visits: Array<Record<string, unknown>> = [],
  futureOnly = false,
) =>
  visits
    .filter((visit) => {
      if (!futureOnly) return true
      const date = new Date(String(visit.fecha_visita || ''))
      return !Number.isNaN(date.getTime()) && date >= new Date()
    })
    .slice(0, 10)
    .map((visit) => ({
    cliente: visit.nombre_cliente || visit.clientName || 'Cliente sin dato',
    sucursal: visit.sucursal || visit.nombre_sucursal || 'Sucursal sin dato',
    fecha: visit.fecha_visita,
    tipo: visit.tipo_visita,
    estado: visit.estado_visita,
    zona: visit.zona,
    tecnicos: visit.fumigadores_asignados,
    }))

const summarizeByStatus = (
  visits: Array<Record<string, unknown>> = [],
  status: string,
) => summarizeVisits(visits.filter((visit) => visit.estado_visita === status))

const summarizeOverdue = (visits: Array<Record<string, unknown>> = []) =>
  summarizeVisits(
    visits.filter(
      (visit) => visit.estado_visita !== 'Realizada' && visit.estado_visita !== 'Cancelada',
    ),
  )

const getTechnicianContext = async (technician: SearchResult) => {
  const today = new Date()
  const profileFn = httpsCallable(functions, 'getTechnicianProfileData')
  const profileResult = (await profileFn({
    technicianId: technician.id,
    month: today.getMonth(),
    year: today.getFullYear(),
  })) as { data: TechnicianProfile }
  const profile = profileResult.data

  return {
    tipo: 'visitas de técnico',
    encontrado: true,
    técnico: {
      id: profile.technician?.id,
      nombre: profile.technician?.nombreCompleto,
      zona: profile.technician?.zona,
    },
    indicadores: profile.kpis,
    visitasFuturas: summarizeVisits(profile.upcomingVisits, true),
    visitasVencidas: summarizeOverdue(profile.recentHistory),
    historialPasado: summarizeByStatus(profile.recentHistory, 'Realizada'),
  }
}

export async function getAgentEntityContext(question: string) {
  const hasTechnicianHint = /\btécnic[oa]\b|\btecnico\b|rendimiento|desempeño|carga de/i.test(question)
  const clientTerm = hasTechnicianHint ? null : extractEntity(question, 'client')
  const technicianTerm = extractEntity(question, 'technician')
  if (!clientTerm && !technicianTerm) return null

  if (clientTerm) {
    const client = await searchEntity(clientTerm, 'client')
    if (!client) {
      const technician = await searchEntity(clientTerm, 'technician')
      if (technician) return getTechnicianContext(technician)
      return { tipo: 'cliente', encontrado: false, termino: clientTerm }
    }

    const profileFn = httpsCallable(functions, 'getClientProfileData')
    const profileResult = (await profileFn({ clientId: client.id })) as { data: ClientProfile }
    const profile = profileResult.data
    const branchNames = new Map<string, string>([['Principal', 'Principal']])
    ;(profile.client?.sucursales || []).forEach((branch, index) => {
      const name = branch.nombre || `Sucursal ${index + 1}`
      const id = branch.id || `${profile.client?.id}-branch-${index + 1}`
      branchNames.set(id, name)
      branchNames.set(name, name)
    })
    const services = (profile.serviceSheet?.services || []).map((service) => ({
      tipo: service.tipo_servicio,
      frecuencia: service.frecuencia,
      estado: service.estado_servicio,
      sucursales: (service.sucursales_asignadas || []).map(
        (branch) => branchNames.get(branch) || branch,
      ),
    }))

    if (isServiceQuestion(question)) {
      const servicesByBranch = services.reduce<Record<string, typeof services>>((groups, service) => {
        const branches = service.sucursales.length > 0 ? service.sucursales : ['Sin sucursal especificada']
        branches.forEach((branch) => {
          if (!groups[branch]) groups[branch] = []
          groups[branch].push({ ...service, sucursales: [branch] })
        })
        return groups
      }, {})

      return {
        tipo: 'servicios por sucursal',
        encontrado: true,
        cliente: {
          id: profile.client?.id,
          nombre: profile.client?.nombreComercial,
        },
        serviciosPorSucursal: servicesByBranch,
        nota: 'Esta consulta es de servicios contratados. No incluye agenda, historial ni fechas de visitas.',
      }
    }

    if (isVisitQuestion(question)) {
      return {
        tipo: 'visitas de cliente',
        encontrado: true,
        cliente: {
          id: profile.client?.id,
          nombre: profile.client?.nombreComercial,
        },
        visitasFuturas: summarizeVisits(profile.upcomingVisits, true),
        historialPasado: summarizeVisits(profile.visitHistory),
        nota: 'Esta consulta es de visitas. No incluye servicios contratados como si fueran visitas.',
      }
    }

    return {
      tipo: 'cliente',
      encontrado: true,
      cliente: {
        id: profile.client?.id,
        nombre: profile.client?.nombreComercial,
        ciudad: profile.client?.ciudad,
        zona: profile.client?.zona,
        estado: profile.client?.estado,
      },
      serviciosContratados: services,
      visitasFuturas: summarizeVisits(profile.upcomingVisits, true),
      visitasVencidas: summarizeOverdue(profile.visitHistory),
      historialPasado: summarizeByStatus(profile.visitHistory, 'Realizada'),
    }
  }

  const technician = technicianTerm ? await searchEntity(technicianTerm, 'technician') : null
  if (!technician) return { tipo: 'técnico', encontrado: false, termino: technicianTerm }
  return getTechnicianContext(technician)
}

const addDays = (date: Date, days: number) => {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

const getPlanningDateRange = (question: string) => {
  const now = new Date()
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  const normalized = question.toLowerCase()
  let end: Date | null = null

  if (normalized.includes('pasado mañana') || normalized.includes('pasado manana')) {
    start.setDate(start.getDate() + 2)
    end = addDays(start, 1)
  } else if (normalized.includes('mañana') || normalized.includes('manana')) {
    start.setDate(start.getDate() + 1)
    end = addDays(start, 1)
  } else if (normalized.includes('hoy')) {
    end = addDays(start, 1)
  } else if (normalized.includes('esta semana')) {
    end = addDays(start, 7)
  } else if (normalized.includes('próxima semana') || normalized.includes('proxima semana')) {
    start.setDate(start.getDate() + 7)
    end = addDays(start, 7)
  } else if (normalized.includes('este mes')) {
    end = new Date(start.getFullYear(), start.getMonth() + 1, 1)
  } else {
    const match = normalized.match(/(\d{1,2})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)/)
    if (!match) return null
    const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
    start.setMonth(months.indexOf(match[2] || ''), Number(match[1]))
    end = addDays(start, 1)
  }

  return { startDateISO: start.toISOString(), endDateISO: end.toISOString() }
}

export async function getPlanningContext(question: string) {
  if (!isPlanningQuestion(question)) {
    return null
  }

  const dateRange = getPlanningDateRange(question)
  if (!dateRange) return null

  const planningFn = httpsCallable(functions, 'getConsolidatedPlanningData')
  const result = (await planningFn({
    ...dateRange,
    calendarTargetUid: 'internal',
  })) as {
    data: {
      monthlyVisits?: Array<Record<string, unknown>>
      technicians?: AgentTechnician[]
    }
  }

  return {
    rango: dateRange,
    visitas: result.data.monthlyVisits || [],
    técnicos: result.data.technicians || [],
  }
}

export async function getPlanningConflictContext(
  question: string,
  existingPlanning?: Awaited<ReturnType<typeof getPlanningContext>>,
) {
  if (!/conflict|cruce|solapamiento|choque/i.test(question)) return null

  const planning = existingPlanning ?? (await getPlanningContext(question))
  if (!planning) return { conflictos: [] }

  const visits = planning.visitas.filter((visit) => visit.estado_visita !== 'Cancelada')
  const conflicts: Array<Record<string, unknown>> = []

  for (let index = 0; index < visits.length; index++) {
    const first = visits[index] as
      | { fecha_visita?: unknown; duracion_minutos?: unknown; fumigadores_asignados?: string[] }
      | undefined
    if (!first) continue
    const firstDate = new Date(String(first.fecha_visita || ''))
    const firstEnd = new Date(
      firstDate.getTime() + (Number(first.duracion_minutos) || 60) * 60 * 1000,
    )
    if (Number.isNaN(firstDate.getTime())) continue

    for (let otherIndex = index + 1; otherIndex < visits.length; otherIndex++) {
      const second = visits[otherIndex] as
        | { fecha_visita?: unknown; duracion_minutos?: unknown; fumigadores_asignados?: string[] }
        | undefined
      if (!second) continue
      const secondDate = new Date(String(second.fecha_visita || ''))
      const secondEnd = new Date(
        secondDate.getTime() + (Number(second.duracion_minutos) || 60) * 60 * 1000,
      )
      if (Number.isNaN(secondDate.getTime())) continue

      const technicians = (first.fumigadores_asignados || []).filter((technician) =>
        (second.fumigadores_asignados || []).includes(technician),
      )
      if (technicians.length === 0 || firstDate >= secondEnd || secondDate >= firstEnd) continue

      conflicts.push({
        técnicos: technicians,
        primera: first,
        segunda: second,
      })
    }
  }

  return { conflictos: conflicts, rango: planning.rango }
}
