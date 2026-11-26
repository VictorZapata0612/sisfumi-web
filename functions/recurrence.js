const { createHash } = require('node:crypto')

const DAY = 86_400_000
const COLOMBIA_OFFSET = 5 * 3_600_000
const frequencies = {
  SEMANAL: ['WEEK', 1], QUINCENAL: ['WEEK', 2], MENSUAL: ['MONTH', 1],
  BIMESTRAL: ['MONTH', 2], BIMENSUAL: ['MONTH', 2], TRIMESTRAL: ['MONTH', 3],
  SEMESTRAL: ['MONTH', 6], ANUAL: ['MONTH', 12],
}

function parseDay(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const date = new Date(value + 'T00:00:00Z')
  return Number.isFinite(+date) && dayKey(date) === value ? date : null
}

function dayKey(date) {
  return date.toISOString().slice(0, 10)
}

function colombiaDay(value) {
  if (!value) return null
  if (typeof value.toDate === 'function') value = value.toDate()
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return parseDay(value)
  const date = new Date(+new Date(value) - COLOMBIA_OFFSET)
  return Number.isFinite(+date) ? parseDay(dayKey(date)) : null
}

function normalizeRecurrence(service, fallbackStart) {
  const frequency = frequencies[String(service.frecuencia || '').trim().toUpperCase()]
  if (!frequency) return null
  const [unit, interval] = frequency
  const configured = service.recurrence || {}
  const allowWeekends = configured.allowWeekends === true
  const minimum = unit === 'WEEK' ? 0 : 1
  const maximum = unit === 'WEEK' ? 6 : 31
  return {
    ...configured, unit, interval, allowWeekends,
    startDate: dayKey(parseDay(configured.startDate) || fallbackStart),
    visitsPerPeriod: Math.min(unit === 'WEEK' ? (allowWeekends ? 7 : 5) : (allowWeekends ? 28 : 20),
      Math.max(1, Math.floor(Number(configured.visitsPerPeriod)) || 1)),
    preferredDays: [...new Set((Array.isArray(configured.preferredDays) ? configured.preferredDays : [])
      .filter(day => Number.isInteger(day) && day >= minimum && day <= maximum))],
  }
}

function periodStart(date, unit) {
  if (unit === 'MONTH') return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
  return new Date(+date - ((date.getUTCDay() + 6) % 7) * DAY)
}

function shiftPeriod(date, recurrence, periods) {
  const step = recurrence.interval * periods
  return recurrence.unit === 'MONTH'
    ? new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + step, 1))
    : new Date(+date + step * 7 * DAY)
}

function buildOccurrences(recurrence, from, through) {
  const anchor = parseDay(recurrence.startDate)
  const first = periodStart(anchor, recurrence.unit)
  const occurrences = []
  for (let period = first; period <= through; period = shiftPeriod(period, recurrence, 1)) {
    const end = recurrence.unit === 'MONTH'
      ? new Date(Date.UTC(period.getUTCFullYear(), period.getUTCMonth() + 1, 0))
      : new Date(+period + 6 * DAY)
    if (end < from) continue
    const count = (+end - +period) / DAY + 1
    const available = Array.from({ length: count }, (_, index) => new Date(+period + index * DAY))
      .filter(date => date >= anchor && (recurrence.allowWeekends || ![0, 6].includes(date.getUTCDay())))
    for (let index = 0; index < recurrence.visitsPerPeriod && available.length; index++) {
      const preferred = recurrence.preferredDays[index]
      const offset = preferred === undefined
        ? Math.round(((index + 1) * (count + 1)) / (recurrence.visitsPerPeriod + 1)) - 1
        : Math.min(count - 1, preferred - (recurrence.unit === 'MONTH' ? 1 : 0))
      const target = +period + offset * DAY
      // In a tie, prefer the later working day without leaving the period.
      const nearest = available.reduce((best, date, pos) =>
        Math.abs(+date - target) <= Math.abs(+available[best] - target) ? pos : best, 0)
      const [date] = available.splice(nearest, 1)
      if (date >= from && date <= through) {
        occurrences.push({ date, period: dayKey(period), sequence: index + 1 })
      }
    }
  }
  return occurrences
}

function visitId(clientId, serviceId, branchId, period, sequence) {
  const key = JSON.stringify([clientId, serviceId, branchId, period, sequence])
  return 'rec_' + createHash('sha256').update(key).digest('hex')
}

function serviceBranches(clientId, client, selections) {
  const principal = { id: 'Principal', name: 'Principal', address: client.direccion, zone: client.zona }
  const branches = [principal, ...(Array.isArray(client.sucursales) ? client.sucursales : []).map((branch, index) => ({
    id: branch.id || clientId + '-branch-' + (index + 1), name: branch.nombre,
    address: branch.direccion, zone: branch.zona || client.zona,
  }))]
  if (!selections?.length) return branches
  const selected = new Set()
  for (const value of selections) {
    const candidates = branches.filter(branch => branch.id === value || branch.name === value)
    if (candidates.length !== 1) return null
    selected.add(candidates[0])
  }
  return [...selected]
}

module.exports = { DAY, COLOMBIA_OFFSET, dayKey, parseDay, colombiaDay, normalizeRecurrence, buildOccurrences, visitId, serviceBranches }
