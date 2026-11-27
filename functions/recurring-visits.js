const {
  DAY, COLOMBIA_OFFSET, dayKey, colombiaDay, normalizeRecurrence,
  buildOccurrences, visitId, serviceBranches,
} = require('./recurrence')

// Manual coverage confirmed for Jardin Plaza during the recurrence migration.
const jardinPlazaClient = 'uPF7AXhtaL7VGIwyjRLa'
const jardinPlazaService = jardinPlazaClient + '-service-7af5b928-eef6-4d60-8761-ae74fd01cf4f'
const jardinPlazaVisits = new Set([
  '9rxTlk4kgSEqV9gdcfRl', 'CCJI3FredgdKjSrD2rwq', 'PMQX6UDtg8cVLTBFUzDQ',
  'UwYhACT5VwPquV8TLRrM', 'WYZwDl598bGumO2u9nP7', 'Xk8LB6jsZVpqcEjgJxlb',
  'f3QaNbm0r9Qzm3jvXFTr', 'hUoHquXlJYR8FKSuKuYV', 'tA33Pb38pnGj7sSLmeba',
  'tl6IpOxvPmJG99bBjwVN', 'wr2gILCS4zXW1eBw7KZn',
])

function isOccasional(service) {
  return String(service?.frecuencia || '').trim().toUpperCase() === 'OCASIONAL'
}

function mutable(visit, today) {
  return visit.createdBy === 'SYSTEM' && [2, 3].includes(visit.recurrenceVersion) &&
    (visit.estado_visita === 'Programada' || visit.cancellationReason === 'RECURRENCE_CHANGED') &&
    !visit.updatedBy && !visit.activeOrganizerUid && !visit.googleEventId &&
    !visit.fumigadores_asignados?.length &&
    (!visit.estado_facturacion || visit.estado_facturacion === 'Pendiente') &&
    colombiaDay(visit.fecha_visita) >= today
}

function visitDetails(visit) {
  return {
    fecha_visita: visit.fecha_visita?.toDate?.() || visit.fecha_visita || null,
    estado_visita: visit.estado_visita,
    ubicacion: visit.ubicacion,
    zona: visit.zona,
  }
}

function billingPeriod(period, unit) {
  if (unit === 'MONTH') return period.slice(0, 7)
  const thursday = new Date(+new Date(period) + 3 * DAY)
  const year = thursday.getUTCFullYear()
  const week = Math.ceil(((+thursday - Date.UTC(year, 0, 1)) / DAY + 1) / 7)
  return year + '-' + week
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
  const allBranches = serviceBranches(sheet.clientId, client)
  const coverage = new Map(services.map(service => [
    service.id, serviceBranches(sheet.clientId, client, service.sucursales_asignadas),
  ]))
  const entries = visits.map(visit => {
    const namedBranches = visit.sucursal
      ? allBranches.filter(branch => branch.id === visit.sucursal || branch.name === visit.sucursal)
      : []
    const matches = namedBranches.length ? namedBranches : allBranches.filter(branch =>
      visit.ubicacion && branch.address === visit.ubicacion)
    let candidates = services.filter(service => visit.serviceId
      ? service.id === visit.serviceId : service.tipo_servicio === visit.tipo_visita)
    if (!visit.serviceId && candidates.length > 1 && matches.length) {
      const compatible = candidates.filter(service => {
        const covered = coverage.get(service.id)
        return !covered || matches.some(match => covered.some(branch => branch.id === match.id))
      })
      if (compatible.length) candidates = compatible
    }
    const confirmedMonthly = sheet.clientId === jardinPlazaClient && visit.id_cliente === jardinPlazaClient &&
      jardinPlazaVisits.has(visit.id) && visit.createdBy && visit.createdBy !== 'SYSTEM' &&
      ['Programada', 'Realizada'].includes(visit.estado_visita) &&
      matches.length === 1 && matches[0].id === 'Principal' &&
      coverage.get(jardinPlazaService)?.some(branch => branch.id === 'Principal')
      ? candidates.find(service => service.id === jardinPlazaService && service.frecuencia === 'MENSUAL' &&
        service.estado_servicio === 'Activo')
      : null
    if (confirmedMonthly) candidates = [confirmedMonthly]
    if (candidates.length > 1) {
      const day = colombiaDay(visit.fecha_visita)
      if (day >= from && day <= through) {
        for (const candidate of candidates) blocked.add(candidate.id)
        warnings.push({
          visitId: visit.id,
          reason: 'Visita existente coincide con varios servicios',
          tipo_visita: visit.tipo_visita ?? null,
          sucursal: visit.sucursal ?? null,
          ubicacion: visit.ubicacion ?? null,
          fecha_local: dayKey(day),
          estado_visita: visit.estado_visita ?? null,
          origen: visit.createdBy === 'SYSTEM' ? 'SYSTEM' : visit.createdBy ? 'Usuario' : null,
          recurrencia_version: visit.recurrenceVersion ?? null,
          periodo_servicio: visit.periodoServicio ?? null,
          tiene_tecnicos: Boolean(visit.fumigadores_asignados?.length),
          tiene_evento_google: Boolean(visit.googleEventId),
          sedes_coincidentes: matches.map(({ id, name }) => ({ id, name })),
          servicios_candidatos: candidates.map(candidate => ({
            id: candidate.id,
            frecuencia: candidate.frecuencia ?? null,
            estado: candidate.estado_servicio ?? null,
            sedes: coverage.get(candidate.id)?.map(({ id, name }) => ({ id, name })) ?? null,
          })),
        })
      }
    }
    const service = candidates.length === 1 ? candidates[0] : null
    return { visit, service, matches, confirmedMonthly: Boolean(confirmedMonthly), used: false, day: colombiaDay(visit.fecha_visita) }
  })

  const normalizedServices = services.map((service) => {
    if (isOccasional(service)) return service
    const fallback = colombiaDay(service.createdAt) || colombiaDay(sheet.createdAt)
    if (!service.recurrence?.startDate && !fallback && service.estado_servicio === 'Activo' && service.frecuencia !== 'UNICA') {
      blocked.add(service.id)
      warnings.push({ serviceId: service.id, reason: 'Falta fecha inicial y no hay fecha de alta verificable' })
      return service
    }
    const recurrence = normalizeRecurrence(service, fallback || today)
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
    const branches = coverage.get(service.id)
    if (!branches?.length || branches.some(branch => !branch.address || !branch.zone)) {
      blocked.add(service.id)
      warnings.push({ serviceId: service.id, reason: 'Sede, direccion o zona no identificada' })
      return { ...service, recurrence }
    }
    const occurrences = buildOccurrences(recurrence, from, through)
    for (const branch of branches) {
      for (const occurrence of occurrences) {
        const id = visitId(sheet.clientId, service.id, branch.id, occurrence.period, occurrence.sequence)
        desired.push({ id, service, branch, billingPeriod: billingPeriod(occurrence.period, recurrence.unit), ...occurrence })
      }
    }
    for (const entry of entries.filter(entry => entry.service?.id === service.id)) {
      const visit = entry.visit
      if (visit.recurrenceBranchId && visit.recurrenceVersion === 3) {
        entry.branchId = visit.recurrenceBranchId
        continue
      }
      const { matches } = entry
      const coveredMatches = matches.filter(match => branches.some(branch => branch.id === match.id))
      if (coveredMatches.length === 1) entry.branchId = coveredMatches[0].id
      else if (branches.length === 1 && visit.createdBy === 'SYSTEM' && visit.recurrenceVersion === 2) {
        entry.branchId = branches[0].id
      } else if (matches.length === 1) entry.branchId = matches[0].id
      else if ((visit.recurrenceKey || visit.createdBy !== 'SYSTEM') && entry.day >= from && entry.day <= through) {
        blocked.add(service.id)
        warnings.push({
          serviceId: service.id,
          visitId: visit.id,
          reason: 'Sede de visita existente ambigua',
          fecha_local: dayKey(entry.day),
          estado_visita: visit.estado_visita ?? null,
          sucursal: visit.sucursal ?? null,
          ubicacion: visit.ubicacion ?? null,
          zona: visit.zona ?? null,
          tiene_tecnicos: Boolean(visit.fumigadores_asignados?.length),
          tiene_evento_google: Boolean(visit.googleEventId),
          sedes_coincidentes: matches.map(({ id, name }) => ({ id, name })),
          sedes_cubiertas: branches.map(({ id, name, address, zone }) => ({ id, name, address, zone })),
        })
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
    for (const entry of byKey.get(slot.id) || []) {
      if (!mutable(entry.visit, today)) entry.used = true
    }
    if (slot.entry) slot.entry.used = true
  }
  for (const slot of pending.filter(slot => !slot.entry)) {
    const matches = entries.filter(entry => !entry.used && entry.visit.recurrenceVersion !== 3 &&
      entry.service?.id === slot.service.id && entry.branchId === slot.branch.id && +entry.day === +slot.date)
    slot.entry = matches.find(entry => !mutable(entry.visit, today)) || matches[0]
    if (slot.entry) slot.entry.used = true
  }
  for (const slot of pending.filter(slot => !slot.entry && slot.service.id === jardinPlazaService)) {
    const covered = entries.find(entry => entry.confirmedMonthly && !entry.used && entry.day &&
      entry.branchId === slot.branch.id && dayKey(entry.day).slice(0, 7) === slot.billingPeriod)
    if (!covered) continue
    slot.entry = covered
    covered.used = true
  }
  for (const slot of pending.filter(slot => !slot.entry)) {
    if (+slot.date + DAY + COLOMBIA_OFFSET <= now) continue
    slot.entry = entries.find(entry => !entry.used && entry.visit.recurrenceVersion === 2 &&
      entry.service?.id === slot.service.id && entry.branchId === slot.branch.id &&
      entry.visit.periodoServicio === slot.billingPeriod && entry.visit.secuenciaPeriodo === slot.sequence)
    if (slot.entry) slot.entry.used = true
  }

  for (const slot of pending) {
    const current = slot.entry?.visit
    if (current && !mutable(current, today)) continue
    const instant = new Date(+slot.date + COLOMBIA_OFFSET + 8 * 3_600_000)
    if (+instant < now) continue
    const schedule = {
      serviceId: slot.service.id, recurrenceBranchId: slot.branch.id,
      recurrenceKey: slot.id, recurrenceVersion: 3, periodoServicio: slot.billingPeriod,
      secuenciaPeriodo: slot.sequence, fecha_visita: instant,
      zona: slot.branch.zone, ubicacion: slot.branch.address, tipo_visita: slot.service.tipo_servicio,
      estado_visita: 'Programada', cancellationReason: null,
    }
    if (current) {
      if (Object.entries(schedule).some(([key, value]) => key === 'fecha_visita'
        ? +current[key]?.toDate?.() !== +value : current[key] !== value)) {
        changes.push({ action: 'update', id: current.id, previous: visitDetails(current), data: schedule })
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
    if (isOccasional(service) || (service && blocked.has(service.id))) continue
    if (!service && !visit.serviceId) continue
    if (service?.estado_servicio === 'Activo' && !entry.branchId) continue
    changes.push({ action: 'cancel', id: visit.id, previous: visitDetails(visit), data: { estado_visita: 'Cancelada', cancellationReason: 'RECURRENCE_CHANGED' } })
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
    if (sheetRef.id !== sheet.clientId) {
      const canonical = await read(db.collection('servicios').doc(sheet.clientId))
      const sheets = await read(db.collection('servicios').where('clientId', '==', sheet.clientId).limit(2))
      if (canonical.exists || sheets.size > 1) return { changes: [], serviceChanges: false,
        warnings: [{ reason: 'Ficha duplicada; se reserva la ficha canonica si existe' }] }
    }
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
