const admin = require('firebase-admin')

admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT || 'sisfumi2' })

const db = admin.firestore()
const FieldPath = admin.firestore.FieldPath
const Timestamp = admin.firestore.Timestamp
const APPLY = process.argv.includes('--apply')
const clientArg = process.argv.find((arg) => arg.startsWith('--client='))
const clientFilter = clientArg ? clientArg.slice('--client='.length) : null
const limitArg = process.argv.find((arg) => arg.startsWith('--limit='))
const documentLimit = limitArg ? Math.max(1, Number(limitArg.slice('--limit='.length))) : Infinity
const resolveArg = process.argv.find((arg) => arg.startsWith('--resolve='))
const resolutions = new Map(
  (resolveArg ? resolveArg.slice('--resolve='.length) : '')
    .split(',')
    .map((entry) => entry.split(':'))
    .filter(([visitId, serviceId]) => visitId && serviceId),
)

function normalizeRecurrence(service) {
  const configured = service.recurrence || {}
  const frequency = service.frecuencia
  const unit = configured.unit || (['SEMANAL', 'QUINCENAL'].includes(frequency) ? 'WEEK' : 'MONTH')
  const legacyInterval =
    {
      BIMENSUAL: 2,
      TRIMESTRAL: 3,
      SEMESTRAL: 6,
      ANUAL: 12,
    }[frequency] || (frequency === 'QUINCENAL' ? 2 : 1)

  return {
    unit,
    interval: Math.max(1, Number(configured.interval) || legacyInterval),
    visitsPerPeriod: Math.max(1, Number(configured.visitsPerPeriod) || 1),
    preferredDays: Array.isArray(configured.preferredDays) ? configured.preferredDays : [],
    schedulingMode: configured.schedulingMode || 'FLEXIBLE',
    toleranceDays: Math.max(0, Number(configured.toleranceDays) || 2),
    allowWeekends: configured.allowWeekends === true,
  }
}

function normalizeBilling(service, recurrence) {
  const configured = service.billing || {}
  const value = Math.max(0, Number(service.valor) || 0)
  return {
    model: configured.model || 'PER_VISIT',
    periodValue: Math.max(
      0,
      Number(configured.periodValue) || (configured.model === 'PER_VISIT' ? 0 : value),
    ),
    includedVisits: Math.max(
      1,
      Number(configured.includedVisits) || recurrence.visitsPerPeriod,
    ),
    additionalVisitValue: Math.max(0, Number(configured.additionalVisitValue) || value),
  }
}

function toDate(value) {
  if (!value) return null
  if (typeof value.toDate === 'function') return value.toDate()
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function periodForDate(date, recurrence) {
  if (recurrence.unit === 'WEEK') {
    const copy = new Date(date)
    copy.setHours(0, 0, 0, 0)
    copy.setDate(copy.getDate() + 3 - ((copy.getDay() + 6) % 7))
    const firstThursday = new Date(copy.getFullYear(), 0, 4)
    const week = 1 + Math.round(
      ((copy - firstThursday) / 86400000 - 3 + ((firstThursday.getDay() + 6) % 7)) / 7,
    )
    return `${copy.getFullYear()}-${String(week).padStart(2, '0')}`
  }
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

async function getAllDocs(collection, limit) {
  const docs = []
  let lastDoc = null
  while (docs.length < limit) {
    const pageSize = Math.min(400, limit - docs.length)
    let query = collection.orderBy(FieldPath.documentId()).limit(pageSize)
    if (lastDoc) query = query.startAfter(lastDoc)
    const snapshot = await query.get()
    if (snapshot.empty) break
    docs.push(...snapshot.docs)
    lastDoc = snapshot.docs[snapshot.docs.length - 1]
    if (snapshot.docs.length < pageSize) break
  }
  return docs
}

function buildServiceCatalog(serviceSheets) {
  const services = []
  const updates = []

  for (const sheetDoc of serviceSheets) {
    const sheet = sheetDoc.data()
    if (!Array.isArray(sheet.services) || !sheet.clientId) continue

    let changed = false
    const normalizedServices = sheet.services.map((service, index) => {
      const serviceId = service.id || `${sheet.clientId}-service-${index + 1}`
      const recurrence = normalizeRecurrence(service)
      const billing = normalizeBilling(service, recurrence)
      const normalized = { ...service, id: serviceId, recurrence, billing }
      if (JSON.stringify(normalized) !== JSON.stringify(service)) changed = true
      services.push({
        clientId: sheet.clientId,
        serviceId,
        tipoServicio: service.tipo_servicio,
        value: Number(service.valor) || 0,
        branches: Array.isArray(service.sucursales_asignadas) ? service.sucursales_asignadas : [],
        recurrence,
        billing,
      })
      return normalized
    })

    if (changed) {
      updates.push({
        ref: sheetDoc.ref,
        data: { services: normalizedServices, recurrenceSchemaVersion: 2 },
      })
    }
  }

  return { services, updates }
}

function getBranchDetails(client, branchIds) {
  const branches = Array.isArray(client?.sucursales) ? client.sucursales : []
  return branchIds.map((branchId) => {
    if (branchId === 'Principal') {
      return {
        id: 'Principal',
        nombre: 'Principal',
        direccion: client?.direccion || null,
        zona: client?.zona || null,
      }
    }

    const branch = branches.find(
      (item, index) =>
        item?.id === branchId ||
        item?.nombre === branchId ||
        (!item?.id && `${client?.id}-branch-${index + 1}` === branchId),
    )

    return {
      id: branchId,
      nombre: branch?.nombre || null,
      direccion: branch?.direccion || null,
      zona: branch?.zona || null,
    }
  })
}

function buildVisitUpdate(visitDoc, service, sequence) {
  const visit = visitDoc.data()
  const date = toDate(visit.fecha_visita)
  if (!date) return null
  const period = visit.periodoServicio || periodForDate(date, service.recurrence)
  const recurrenceKey =
    visit.recurrenceKey || `${service.serviceId}_${period}_${sequence}`

  const data = {}
  const assign = (key, value) => {
    if (visit[key] === undefined || visit[key] === null || visit[key] === '') data[key] = value
  }

  assign('serviceId', service.serviceId)
  assign('periodoServicio', period)
  assign('recurrenceVersion', 2)
  assign('recurrenceKey', recurrenceKey)
  assign('billingModel', service.billing.model)
  assign('periodValue', service.billing.periodValue)
  assign('includedVisits', service.billing.includedVisits)
  assign('additionalVisitValue', service.billing.additionalVisitValue)
  if (service.billing.model === 'PER_VISIT') assign('valor_servicio', service.billing.additionalVisitValue)

  return Object.keys(data).length > 0 ? { ref: visitDoc.ref, data, recurrenceKey } : null
}

async function main() {
  console.log(`Modo: ${APPLY ? 'APPLY (escritura)' : 'DRY-RUN (solo lectura)'}`)
  if (clientFilter) console.log(`Cliente filtrado: ${clientFilter}`)
  if (resolutions.size > 0) console.log(`Resoluciones explícitas: ${resolutions.size}`)

  let serviceQuery = db.collection('servicios')
  if (clientFilter) serviceQuery = serviceQuery.where('clientId', '==', clientFilter)
  const serviceSheets = await getAllDocs(serviceQuery, documentLimit)
  const { services, updates: sheetUpdates } = buildServiceCatalog(serviceSheets)

  const clientDocs = await getAllDocs(
    clientFilter ? db.collection('clientes').where(FieldPath.documentId(), '==', clientFilter) : db.collection('clientes'),
    documentLimit,
  )
  const clientsById = new Map(clientDocs.map((doc) => ({ ...doc.data(), id: doc.id })).map((client) => [client.id, client]))

  let visitsQuery = db.collection('visitas')
  if (clientFilter) visitsQuery = visitsQuery.where('id_cliente', '==', clientFilter)
  const visitDocs = await getAllDocs(visitsQuery, documentLimit)
  const servicesByClientAndType = new Map()
  const servicesById = new Map()
  services.forEach((service) => {
    const key = `${service.clientId}::${service.tipoServicio}`
    if (!servicesByClientAndType.has(key)) servicesByClientAndType.set(key, [])
    servicesByClientAndType.get(key).push(service)
    servicesById.set(service.serviceId, service)
  })

  const visitUpdates = []
  const keyToVisits = new Map()
  let unmatchedVisits = 0
  let ambiguousVisits = 0
  const ambiguousDetails = []
  const unmatchedDetails = []

  for (const visitDoc of visitDocs) {
    const visit = visitDoc.data()
    if (visit.serviceId) {
      const service = services.find((item) => item.serviceId === visit.serviceId)
      if (!service) {
        unmatchedVisits++
        unmatchedDetails.push({
          visitId: visitDoc.id,
          clientId: visit.id_cliente || null,
          tipoVisita: visit.tipo_visita || null,
          reason: 'serviceId_not_found',
        })
        continue
      }
      const update = buildVisitUpdate(visitDoc, service, Number(visit.secuenciaPeriodo) || 1)
      if (update) visitUpdates.push(update)
      keyToVisits.set(update?.recurrenceKey || visit.recurrenceKey, visitDoc.id)
      continue
    }

    const candidates = servicesByClientAndType.get(`${visit.id_cliente}::${visit.tipo_visita}`) || []
    const resolvedServiceId = resolutions.get(visitDoc.id)
    const resolvedService = resolvedServiceId
      ? servicesById.get(resolvedServiceId)?.clientId === visit.id_cliente
        ? servicesById.get(resolvedServiceId)
        : null
      : null
    if (resolvedService) {
      const update = buildVisitUpdate(visitDoc, resolvedService, Number(visit.secuenciaPeriodo) || 1)
      if (update) {
        visitUpdates.push(update)
        keyToVisits.set(update.recurrenceKey, visitDoc.id)
      }
      continue
    }
    if (candidates.length !== 1) {
      if (candidates.length === 0) {
        unmatchedVisits++
        unmatchedDetails.push({
          visitId: visitDoc.id,
          clientId: visit.id_cliente || null,
          tipoVisita: visit.tipo_visita || null,
          reason: 'no_matching_service',
        })
      } else {
        ambiguousVisits++
        ambiguousDetails.push({
          visitId: visitDoc.id,
          clientId: visit.id_cliente || null,
          tipoVisita: visit.tipo_visita || null,
          fechaVisita: toDate(visit.fecha_visita)?.toISOString() || null,
          ubicacion: visit.ubicacion || null,
          zona: visit.zona || null,
          candidates: candidates.map((candidate) => ({
            serviceId: candidate.serviceId,
            value: candidate.value,
            branches: candidate.branches,
            branchDetails: getBranchDetails(clientsById.get(candidate.clientId), candidate.branches),
            recurrence: candidate.recurrence,
            billing: candidate.billing,
          })),
        })
      }
      continue
    }
    const update = buildVisitUpdate(visitDoc, candidates[0], 1)
    if (update) {
      visitUpdates.push(update)
      if (keyToVisits.has(update.recurrenceKey)) {
        console.warn(`COLISIÓN: ${update.recurrenceKey} en ${keyToVisits.get(update.recurrenceKey)} y ${visitDoc.id}`)
      } else {
        keyToVisits.set(update.recurrenceKey, visitDoc.id)
      }
    }
  }

  console.log(`Fichas de servicio: ${serviceSheets.length}`)
  console.log(`Servicios normalizados: ${services.length}`)
  console.log(`Fichas a actualizar: ${sheetUpdates.length}`)
  console.log(`Visitas leídas: ${visitDocs.length}`)
  console.log(`Visitas a actualizar: ${visitUpdates.length}`)
  console.log(`Visitas sin servicio identificable: ${unmatchedVisits}`)
  console.log(`Visitas ambiguas: ${ambiguousVisits}`)
  if (unmatchedDetails.length > 0) {
    console.log('Detalle de visitas sin servicio:')
    console.log(JSON.stringify(unmatchedDetails, null, 2))
  }
  if (ambiguousDetails.length > 0) {
    console.log('Detalle de visitas ambiguas:')
    console.log(JSON.stringify(ambiguousDetails, null, 2))
  }

  if (!APPLY) {
    console.log('Dry-run finalizado. Use --apply para escribir cambios.')
    return
  }

  const operations = [...sheetUpdates, ...visitUpdates]
  for (let index = 0; index < operations.length; index += 400) {
    const batch = db.batch()
    operations.slice(index, index + 400).forEach((operation) => {
      batch.update(operation.ref, operation.data)
    })
    await batch.commit()
    console.log(`Lote aplicado: ${Math.min(index + 400, operations.length)}/${operations.length}`)
  }
  console.log('Backfill aplicado correctamente.')
}

main().catch((error) => {
  if (error.message.includes('Could not load the default credentials')) {
    console.error(
      'Backfill fallido: configure Application Default Credentials (gcloud auth application-default login) o use FIRESTORE_EMULATOR_HOST.',
    )
  } else {
    console.error('Backfill fallido:', error)
  }
  process.exitCode = 1
})
