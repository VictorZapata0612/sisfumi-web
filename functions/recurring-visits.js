const {
  DAY, COLOMBIA_OFFSET, dayKey, colombiaDay, normalizeRecurrence,
  buildOccurrences, visitId, serviceBranches,
} = require('./recurrence')

function mutable(visit, today) {
  return visit.createdBy === 'SYSTEM' && [2, 3].includes(visit.recurrenceVersion) &&
    (visit.estado_visita === 'Programada' || visit.cancellationReason === 'RECURRENCE_CHANGED') &&
    !visit.updatedBy && !visit.activeOrganizerUid && !visit.googleEventId &&
    !visit.fumigadores_asignados?.length &&
    (!visit.estado_facturacion || visit.estado_facturacion === 'Pendiente') &&
    colombiaDay(visit.fecha_visita) >= today
}

function planRecurringVisits(sheet, client, visits, today, now) {
  const from = new Date(today)
  const through = new Date(+from + 90 * DAY)
  const changes = []
  const warnings = []
  const desired = []
  const services = (sheet.services || []).map((service, index) => ({
    ...service, id: service.id || sheet.clientId + '-service-' + (index + 1),
  }))
  const blocked = new Set()
  const entries = visits.map(visit => {
    const candidates = services.filter(service => visit.serviceId
      ? service.id === visit.serviceId : service.tipo_servicio === visit.tipo_visita)
    if (candidates.length > 1) {
      for (const candidate of candidates) blocked.add(candidate.id)
    }
    const service = candidates.length === 1 ? candidates[0] : null
    return { visit, service, used: false, day: colombiaDay(visit.fecha_visita) }
  })

  const normalizedServices = services.map((service) => {
    const fallback = colombiaDay(service.createdAt) || colombiaDay(sheet.createdAt) || today
    const recurrence = normalizeRecurrence(service, fallback)
    if (!recurrence) {
      if (service.estado_servicio === 'Activo' && service.frecuencia !== 'UNICA') {
        blocked.add(service.id)
        warnings.push({ serviceId: service.id, reason: 'Frecuencia desconocida' })
      }
      return service
    }
    if (service.recurrence?.startDate !== recurrence.startDate) {
      warnings.push({ serviceId: service.id, reason: 'Fecha inicial inferida', startDate: recurrence.startDate })
    }
    if (service.estado_servicio !== 'Activo') return { ...service, recurrence }
    const branches = serviceBranches(sheet.clientId, client, service.sucursales_asignadas)
    if (!branches?.length || branches.some(branch => !branch.address || !branch.zone)) {
      blocked.add(service.id)
      warnings.push({ serviceId: service.id, reason: 'Sede, direccion o zona no identificada' })
      return { ...service, recurrence }
    }
    const occurrences = buildOccurrences(recurrence, from, through)
    for (const branch of branches) {
      for (const occurrence of occurrences) {
        const id = visitId(sheet.clientId, service.id, branch.id, occurrence.period, occurrence.sequence)
        desired.push({ id, service, branch, ...occurrence })
      }
    }
    for (const entry of entries.filter(entry => entry.service?.id === service.id)) {
      const visit = entry.visit
      if (visit.recurrenceBranchId && visit.recurrenceVersion === 3) {
        entry.branchId = visit.recurrenceBranchId
        continue
      }
      const matches = branches.filter(branch => branch.address === visit.ubicacion)
      if (matches.length === 1) entry.branchId = matches[0].id
      else if (branches.length === 1 && visit.createdBy === 'SYSTEM' && visit.recurrenceVersion === 2) {
        entry.branchId = branches[0].id
      } else if ((visit.recurrenceKey || visit.createdBy !== 'SYSTEM') && entry.day >= from && entry.day <= through) {
        blocked.add(service.id)
        warnings.push({ serviceId: service.id, visitId: visit.id, reason: 'Sede de visita existente ambigua' })
      }
    }
    return { ...service, recurrence }
  })

  const pending = desired.filter(slot => !blocked.has(slot.service.id))
  const byId = new Map(entries.map(entry => [entry.visit.id, entry]))
  const byKey = new Map()
  for (const entry of entries) {
    if (entry.visit.recurrenceVersion !== 3) continue
    const key = entry.visit.recurrenceKey
    if (!byKey.has(key)) byKey.set(key, [])
    byKey.get(key).push(entry)
  }
  // Reserve explicit matches before reusing legacy documents.
  for (const slot of pending) {
    slot.entry = byId.get(slot.id) || byKey.get(slot.id)?.find(entry => !mutable(entry.visit, today)) || byKey.get(slot.id)?.[0]
    for (const entry of byKey.get(slot.id) || []) entry.used = true
    if (slot.entry) slot.entry.used = true
  }
  for (const slot of pending.filter(slot => !slot.entry)) {
    const matches = entries.filter(entry => !entry.used && entry.visit.recurrenceVersion !== 3 &&
      entry.service?.id === slot.service.id && entry.branchId === slot.branch.id && +entry.day === +slot.date)
    slot.entry = matches.find(entry => !mutable(entry.visit, today)) || matches[0]
    if (slot.entry) slot.entry.used = true
  }
  for (const slot of pending.filter(slot => !slot.entry)) {
    if (+slot.date + DAY + COLOMBIA_OFFSET <= now) continue
    const legacyPeriod = slot.service.frecuencia === 'SEMANAL' || slot.service.frecuencia === 'QUINCENAL'
      ? null : slot.period.slice(0, 7)
    if (legacyPeriod) {
      slot.entry = entries.find(entry => !entry.used && entry.visit.recurrenceVersion === 2 &&
        entry.service?.id === slot.service.id && entry.branchId === slot.branch.id &&
        entry.visit.periodoServicio === legacyPeriod && entry.visit.secuenciaPeriodo === slot.sequence)
      if (slot.entry) slot.entry.used = true
    }
  }

  for (const slot of pending) {
    const current = slot.entry?.visit
    if (current && !mutable(current, today)) continue
    const instant = new Date(+slot.date + COLOMBIA_OFFSET + 8 * 3_600_000)
    if (+instant < now) continue
    const schedule = {
      serviceId: slot.service.id, recurrenceBranchId: slot.branch.id,
      recurrenceKey: slot.id, recurrenceVersion: 3, periodoServicio: slot.period,
      secuenciaPeriodo: slot.sequence, fecha_visita: instant,
      zona: slot.branch.zone, ubicacion: slot.branch.address, tipo_visita: slot.service.tipo_servicio,
      estado_visita: 'Programada', cancellationReason: null,
    }
    if (current) {
      if (Object.entries(schedule).some(([key, value]) => key === 'fecha_visita'
        ? +current[key]?.toDate?.() !== +value : current[key] !== value)) {
        changes.push({ action: 'update', id: current.id, data: schedule })
      }
      continue
    }
    const billing = slot.service.billing || {}
    const model = billing.model || 'PER_VISIT'
    const value = Number(slot.service.valor) || 0
    changes.push({ action: 'create', id: slot.id, data: {
      ...schedule, id_cliente: sheet.clientId, nombre_cliente: client.nombreComercial || sheet.clientName || 'Cliente Sistema',
      estado_facturacion: 'Pendiente', billingModel: model,
      periodValue: Number(billing.periodValue ?? (model === 'PER_VISIT' ? 0 : value)),
      includedVisits: Number(billing.includedVisits) || 1,
      additionalVisitValue: Number(billing.additionalVisitValue ?? value),
      valor_servicio: model === 'PER_VISIT' ? Number(billing.additionalVisitValue ?? value) : 0,
      createdBy: 'SYSTEM', fumigadores_asignados: [],
    } })
  }
  for (const entry of entries) {
    const { visit, service, day } = entry
    if (entry.used || visit.estado_visita !== 'Programada' || !mutable(visit, today) || day > through || day <= today) continue
    if (service && blocked.has(service.id)) continue
    if (!service && !(visit.serviceId && visit.recurrenceVersion === 3)) continue
    if (service?.estado_servicio === 'Activo' && !entry.branchId) continue
    changes.push({ action: 'cancel', id: visit.id, data: { estado_visita: 'Cancelada', cancellationReason: 'RECURRENCE_CHANGED' } })
  }
  return { changes, warnings, normalizedServices }
}

async function reconcileRecurringSheet(db, admin, sheetRef, { apply, persistServices = false, now = Date.now() }) {
  async function inspect(read) {
    const doc = await read(sheetRef)
    if (!doc.exists || !doc.data()?.clientId) return { changes: [], warnings: [], serviceChanges: false }
    const sheet = doc.data()
    const client = await read(db.collection('clientes').doc(sheet.clientId))
    if (!client.exists) return { changes: [], warnings: [{ reason: 'Cliente no encontrado' }], serviceChanges: false }
    const visits = await read(db.collection('visitas').where('id_cliente', '==', sheet.clientId))
    const result = planRecurringVisits(sheet, client.data(), visits.docs.map(visit => ({ ...visit.data(), id: visit.id })), colombiaDay(new Date(now)), now)
    const serviceChanges = JSON.stringify(sheet.services || []) !== JSON.stringify(result.normalizedServices)
    return { ...result, serviceChanges }
  }

  if (!apply) return inspect(ref => ref.get())
  return db.runTransaction(async transaction => {
    const result = await inspect(ref => transaction.get(ref))
    if (result.changes.length > 450) throw new Error('Mas de 450 cambios para una ficha; revisar primero el plan.')
    if (persistServices && result.serviceChanges) transaction.update(sheetRef, { services: result.normalizedServices })
    for (const { action, id, data } of result.changes) {
      const ref = db.collection('visitas').doc(id)
      const timestamp = admin.firestore.FieldValue.serverTimestamp()
      if (action === 'create') transaction.create(ref, { ...data, createdAt: timestamp })
      else transaction.update(ref, { ...data, updatedAt: timestamp })
    }
    return result
  })
}

module.exports = { planRecurringVisits, reconcileRecurringSheet }
