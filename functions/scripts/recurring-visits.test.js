const { test } = require('node:test')
const assert = require('node:assert/strict')
const { parseDay, colombiaDay, normalizeRecurrence, buildOccurrences, dayKey } = require('../recurrence')
const { planRecurringVisits } = require('../recurring-visits')

const day = parseDay
const monthly = {
  id: 's1', frecuencia: 'MENSUAL', tipo_servicio: 'Control', estado_servicio: 'Activo',
  recurrence: { unit: 'WEEK', interval: 9, startDate: '2026-12-01', visitsPerPeriod: 2, preferredDays: [5, 20] },
}
const client = {
  nombreComercial: 'Ejemplo', direccion: 'Principal calle 1', zona: 'Norte',
  sucursales: [{ id: 'b1', nombre: 'Sur', direccion: 'Sucursal calle 2', zona: 'Sur' }],
}
const sheet = { clientId: 'c1', services: [monthly] }
const plan = (visits, current = sheet) =>
  planRecurringVisits(current, client, visits, day('2026-12-01'), +new Date('2026-12-01T12:00:00Z'))
const stored = change => ({
  ...change.data, id: change.id, fecha_visita: { toDate: () => change.data.fecha_visita },
})

test('monthly sequences stay stable after early occurrences pass', () => {
  const recurrence = normalizeRecurrence(monthly, day('2026-01-01'))
  assert.equal(recurrence.unit, 'MONTH')
  assert.equal(recurrence.interval, 1)
  const expected = [['2026-12-07', 1], ['2026-12-21', 2]]
  const sequences = from => buildOccurrences(recurrence, day(from), day('2026-12-31'))
    .map(({ date, sequence }) => [dayKey(date), sequence])
  assert.deepEqual(sequences('2026-12-01'), expected)
  assert.deepEqual(sequences('2026-12-10'), expected.slice(1))
})

test('quarterly and annual cycles remain anchored', () => {
  const months = frecuencia => buildOccurrences(normalizeRecurrence({
    ...monthly, frecuencia, recurrence: { ...monthly.recurrence, visitsPerPeriod: 1 },
  }, day('2026-12-01')), day('2027-01-01'), day('2027-06-30')).map(slot => slot.period)
  assert.deepEqual(months('TRIMESTRAL'), ['2027-03-01', '2027-06-01'])
  assert.deepEqual(months('ANUAL'), [])
  assert.equal(dayKey(colombiaDay(new Date('2026-12-02T01:00:00Z'))), '2026-12-01')
})

test('weekend and colliding preferences stay on distinct dates in the period', () => {
  const rule = normalizeRecurrence({ ...monthly,
    recurrence: { startDate: '2026-01-01', visitsPerPeriod: 2, preferredDays: [30, 31] },
  }, day('2026-01-01'))
  const dates = buildOccurrences(rule, day('2026-01-01'), day('2026-01-31'))
  assert.equal(new Set(dates.map(slot => dayKey(slot.date))).size, 2)
  assert.ok(dates.every(slot => slot.date.getUTCMonth() === 0 && ![0, 6].includes(slot.date.getUTCDay())))
})

test('each branch gets its visits and running twice is idempotent', () => {
  const first = plan([])
  const december = first.changes.filter(change => change.data.periodoServicio === '2026-12')
  assert.equal(december.length, 4)
  assert.deepEqual([...new Set(december.map(change => change.data.zona))], ['Norte', 'Sur'])
  assert.equal(new Set(first.changes.map(change => change.id)).size, first.changes.length)
  assert.deepEqual(plan(first.changes.map(stored)).changes, [])
})

test('updates a legacy visit in place and preserves confirmed visits when inactivating', () => {
  const legacy = {
    id: 'legacy', createdBy: 'SYSTEM', recurrenceVersion: 2, serviceId: 's1', periodoServicio: '2026-12',
    secuenciaPeriodo: 1, estado_visita: 'Programada', ubicacion: client.direccion,
    fecha_visita: new Date('2026-12-05T00:00Z'), fumigadores_asignados: [],
  }
  const migration = plan([legacy])
  const update = migration.changes.find(change => change.id === 'legacy')
  assert.equal(update.action, 'update')
  assert.equal(update.data.fecha_visita.toISOString(), '2026-12-07T13:00:00.000Z')
  const visits = migration.changes.map(change => ({
    ...stored(change), createdBy: 'SYSTEM',
  }))
  visits[0].fumigadores_asignados = ['Tecnico']
  visits[1].estado_visita = 'Realizada'
  const inactive = plan(visits, { ...sheet, services: [{ ...monthly, estado_servicio: 'Inactivo' }] })
  assert.equal(inactive.changes.length, visits.length - 2)
  assert.ok(inactive.changes.every(change => change.action === 'cancel' && !visits.slice(0, 2).some(visit => visit.id === change.id)))
})

test('reports ambiguous locations without modifying that service', () => {
  const result = plan([{
    id: 'ambiguous', serviceId: 's1', createdBy: 'SYSTEM', recurrenceVersion: 2,
    recurrenceKey: 'old', fecha_visita: new Date('2026-12-07T13:00Z'),
  }])
  assert.equal(result.changes.length, 0)
  assert.ok(result.warnings.some(warning => warning.visitId === 'ambiguous'))
})

test('preserves occasional services and their existing visits without warnings', () => {
  const occasional = { ...monthly, frecuencia: 'Ocasional' }
  const existing = {
    id: 'occasional', serviceId: 's1', createdBy: 'SYSTEM', recurrenceVersion: 2,
    estado_visita: 'Programada', fecha_visita: new Date('2026-12-07T13:00Z'),
  }
  const result = plan([existing], { ...sheet, services: [occasional] })
  assert.deepEqual(result.changes, [])
  assert.deepEqual(result.warnings, [])
  assert.deepEqual(result.normalizedServices, [occasional])
})

test('uses the only covered exact match when the main office shares its address', () => {
  const shared = {
    ...client,
    sucursales: [
      { id: 'b1', nombre: 'Sushi', address: client.direccion, direccion: client.direccion, zona: client.zona },
      { id: 'b2', nombre: 'Trattorina', direccion: client.direccion + ' CC', zona: client.zona },
    ],
  }
  const legacy = {
    id: 'shared-address', serviceId: 's1', createdBy: 'SYSTEM', recurrenceVersion: 2,
    recurrenceKey: 'old', estado_visita: 'Programada', ubicacion: shared.direccion,
    fecha_visita: new Date('2026-12-07T13:00Z'),
  }
  const run = selections => planRecurringVisits({
    ...sheet, services: [{ ...monthly, sucursales_asignadas: selections }],
  }, shared, [legacy], day('2026-12-01'), +new Date('2026-12-01T12:00Z'))
  const resolved = run(['b1', 'b2'])
  assert.deepEqual(resolved.warnings, [])
  assert.equal(resolved.changes.find(change => change.id === legacy.id).data.recurrenceBranchId, 'b1')
  const ambiguous = run(['Principal', 'b1'])
  assert.equal(ambiguous.changes.length, 0)
  assert.ok(ambiguous.warnings.some(warning => warning.visitId === legacy.id))
})

test('matches a protected visit by named branch when service types are shared', () => {
  const visit = {
    id: 'manual', tipo_visita: monthly.tipo_servicio, sucursal: 'Sur',
    estado_visita: 'Programada', fecha_visita: new Date('2026-12-07T13:00Z'),
    fumigadores_asignados: ['Tecnico'], googleEventId: 'event',
  }
  const result = plan([visit], { ...sheet, services: [
    { ...monthly, sucursales_asignadas: ['Principal'] },
    { ...monthly, id: 's2', sucursales_asignadas: ['b1'] },
  ] })
  assert.deepEqual(result.warnings, [])
  assert.ok(!result.changes.some(change => change.id === visit.id))
  const firstDay = result.changes.filter(change => change.data.fecha_visita?.toISOString() === '2026-12-07T13:00:00.000Z')
  assert.deepEqual(firstDay.map(change => change.data.serviceId), ['s1'])
})

test('confirmed Jardin Plaza visits cover their own months and stay unchanged', () => {
  const clientId = 'uPF7AXhtaL7VGIwyjRLa'
  const serviceId = clientId + '-service-7af5b928-eef6-4d60-8761-ae74fd01cf4f'
  const service = {
    ...monthly, id: serviceId, sucursales_asignadas: ['Principal'],
    recurrence: { startDate: '2026-09-29', visitsPerPeriod: 1, preferredDays: [7] },
  }
  const current = { clientId, services: [
    service, { ...service, id: 'historico', frecuencia: 'UNICA', estado_servicio: 'Completado' },
  ] }
  const visits = [
    ['9rxTlk4kgSEqV9gdcfRl', '2026-12-15'],
    ['f3QaNbm0r9Qzm3jvXFTr', '2026-12-15'],
  ].map(([id, date]) => ({
    id, id_cliente: clientId, tipo_visita: service.tipo_servicio, createdBy: 'coordinador',
    estado_visita: 'Programada', fecha_visita: new Date(date + 'T15:00Z'),
    ubicacion: client.direccion, fumigadores_asignados: ['Tecnico'], googleEventId: id,
  }))
  const run = records => planRecurringVisits(current, client, records, day('2026-12-01'), +new Date('2026-12-01T12:00Z'))
  const result = run(visits)
  assert.deepEqual(result.warnings, [])
  assert.deepEqual(result.changes.map(change => [change.action, change.data.periodoServicio]),
    [['create', '2027-01'], ['create', '2027-02']])
  assert.ok(run([...visits, { ...visits[0], id: 'not-confirmed' }]).warnings.some(warning => warning.visitId === 'not-confirmed'))
})
