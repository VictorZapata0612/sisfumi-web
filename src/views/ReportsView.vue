<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { httpsCallable } from 'firebase/functions'
import { functions } from '@/firebase/config'
import { useSettingsStore } from '@/stores/settings'
import { downloadReport, type ReportCell as Cell } from '@/utils/reportExports'

type ReportRow = { label: string; visits: number; completed: number }
type Report = {
  kpis: { totalInvoiced: number; totalPendingBilling: number; totalVisits: number; billedVisits: number }
  monthlyTrend: number[]
  topClients: { clientId: string; clientName: string; totalInvoiced: number }[]
  operational?: {
    months: { visits: number; completed: number; pendingBilling: number }[]
    statuses: { scheduled: number; completed: number; cancelled: number; other: number }
    clientsWithVisits: number
    techniciansWithVisits: number
    services: ReportRow[]
    clients: ReportRow[]
    technicians: ReportRow[]
    zones: ReportRow[]
  }
}

const tabs = [
  { id: 'summary', label: 'Resumen', icon: 'fa-chart-column' },
  { id: 'services', label: 'Servicios', icon: 'fa-bug' },
  { id: 'clients', label: 'Clientes', icon: 'fa-users' },
  { id: 'technicians', label: 'Técnicos', icon: 'fa-hard-hat' },
  { id: 'billing', label: 'Resumen económico', icon: 'fa-file-invoice' },
] as const
type Tab = (typeof tabs)[number]['id']
const settings = useSettingsStore()
const year = ref(Number(new Intl.DateTimeFormat('en', { year: 'numeric', timeZone: 'America/Bogota' }).format(new Date())))
const zone = ref('Todos')
const years = Array.from({ length: 5 }, (_, index) => year.value - index)
const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
const active = ref<Tab>('summary')
const report = ref<Report>()
const generatedFor = ref<{ year: number; zone: string }>()
const loading = ref(false)
const exporting = ref(false)
const error = ref('')
const exportError = ref('')
const money = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })
const number = new Intl.NumberFormat('es-CO')
const ops = computed(() => report.value?.operational)

const statistics = computed(() => {
  if (!ops.value || !report.value) return []
  const { statuses, clientsWithVisits, techniciansWithVisits } = ops.value
  const eligible = statuses.scheduled + statuses.completed
  return [
    { label: 'Visitas registradas', value: number.format(report.value.kpis.totalVisits), icon: 'fa-calendar-alt' },
    { label: 'Visitas realizadas', value: number.format(statuses.completed), icon: 'fa-check-circle' },
    { label: 'Cumplimiento operativo', value: eligible ? Math.round(statuses.completed / eligible * 100) + '%' : '—', icon: 'fa-chart-line' },
    { label: 'Clientes con visitas', value: number.format(clientsWithVisits), icon: 'fa-users' },
    { label: 'Técnicos con asignaciones', value: number.format(techniciansWithVisits), icon: 'fa-hard-hat' },
  ]
})
const monthlyVisits = computed(() => ops.value?.months.map((item) => item.visits) ?? [])
const monthlyCompleted = computed(() => ops.value?.months.map((item) => item.completed) ?? [])
const financeTrend = computed(() => report.value?.monthlyTrend ?? [])
const seriesMax = computed(() => Math.max(1, ...monthlyVisits.value))
const breakdownTitle = computed(() => ({
  summary: 'Actividad por zona',
  services: 'Visitas por tipo de servicio',
  clients: 'Visitas por cliente',
  technicians: 'Visitas asignadas por técnico',
  billing: 'Clientes con mayor facturación',
})[active.value])
const breakdown = computed(() => {
  if (!ops.value) return []
  return ({ summary: ops.value.zones, services: ops.value.services, clients: ops.value.clients, technicians: ops.value.technicians, billing: [] })[active.value]
})
const statusRows = computed(() => ops.value ? [
  { label: 'Programadas', value: ops.value.statuses.scheduled },
  { label: 'Realizadas', value: ops.value.statuses.completed },
  { label: 'Canceladas', value: ops.value.statuses.cancelled },
  { label: 'Otros estados', value: ops.value.statuses.other },
] : [])
const zoneLabel = (value: string) => value === 'Todos' ? 'Todas las zonas' : value

async function generate() {
  if (loading.value) return
  loading.value = true
  error.value = ''
  exportError.value = ''
  const filters = { year: year.value, zone: zone.value }
  try {
    const result = await httpsCallable<typeof filters, Report>(functions, 'getAnnualBillingReport')(filters)
    report.value = result.data
    generatedFor.value = filters
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'No se pudo generar el reporte.'
  } finally {
    loading.value = false
  }
}

onMounted(() => { void settings.fetchBusinessData() })

function reportTables() {
  const data = report.value
  if (!data) return []
  const operational = data.operational
  const group = (title: string, rows: ReportRow[]) => ({
    title, columns: ['Nombre', 'Visitas', 'Realizadas'],
    rows: rows.map((row): Cell[] => [row.label, row.visits, row.completed]),
  })
  const tables: { title: string; columns: string[]; rows: Cell[][] }[] = []
  if (operational) {
    tables.push(
      { title: 'Indicadores', columns: ['Indicador', 'Valor'], rows: statistics.value.map((item) => [item.label, item.value]) },
      { title: 'Estados de visita', columns: ['Estado', 'Visitas'], rows: statusRows.value.map((item) => [item.label, item.value]) },
      group('Actividad por zona', operational.zones),
      group('Visitas por servicio', operational.services),
      group('Visitas por cliente', operational.clients),
      group('Asignaciones por técnico', operational.technicians),
    )
  }
  tables.push({
    title: 'Resumen económico',
    columns: ['Indicador', 'Total COP'],
    rows: [['Facturación emitida', data.kpis.totalInvoiced], [operational ? 'Por facturar en el periodo' : 'Por facturar · saldo general', data.kpis.totalPendingBilling]],
  }, {
    title: 'Evolución mensual',
    columns: operational ? ['Mes', 'Visitas', 'Realizadas', 'Facturación COP', 'Por facturar COP'] : ['Mes', 'Facturación COP'],
    rows: months.map((month, index) => {
      const activity = operational?.months[index]
      const billed = data.monthlyTrend[index] ?? 0
      return activity ? [month, activity.visits, activity.completed, billed, activity.pendingBilling] : [month, billed]
    }),
  }, {
    title: 'Facturación por cliente',
    columns: ['Cliente', 'Facturación COP'],
    rows: data.topClients.map((client) => [client.clientName || 'Sin nombre', client.totalInvoiced]),
  })
  return tables
}

async function exportReport(format: 'pdf' | 'xlsx') {
  if (!generatedFor.value || exporting.value) return
  const { year, zone } = generatedFor.value
  const tables = reportTables()
  const fileName = 'SisFumi-Reportes-' + year
  exporting.value = true
  exportError.value = ''
  try {
    await downloadReport({ year, zone: zoneLabel(zone), filename: fileName, tables, generatedAt: new Date() }, format)
  } catch (err) {
    exportError.value = err instanceof Error ? err.message : 'No se pudo exportar el reporte.'
  } finally {
    exporting.value = false
  }
}
</script>

<template>
  <section class="reports-page space-y-4">
    <header class="flex flex-wrap items-center justify-between gap-4 py-2">
      <div class="flex items-center gap-3">
        <span class="report-icon grid size-12 place-items-center rounded-xl text-xl"><i class="fas fa-chart-column" aria-hidden="true"></i></span>
        <div><h1 class="text-2xl font-extrabold tracking-tight sm:text-3xl">Reportes</h1><p class="muted mt-1 text-sm">Consulta la operación por año y zona.</p></div>
      </div>
      <div v-if="report" class="flex flex-wrap gap-2">
        <button type="button" class="report-button" :disabled="loading || exporting" @click="exportReport('pdf')"><i class="fas fa-file-pdf" aria-hidden="true"></i> Descargar PDF</button>
        <button type="button" class="report-button" :disabled="loading || exporting" @click="exportReport('xlsx')"><i class="fas fa-file-excel" aria-hidden="true"></i> Descargar Excel</button>
      </div>
    </header>

    <form class="panel flex flex-wrap items-end gap-3 p-4" @submit.prevent="generate">
      <label class="grid gap-1 text-xs font-semibold">Año
        <select v-model.number="year" class="report-field min-w-28" :disabled="loading"><option v-for="item in years" :key="item" :value="item">{{ item }}</option></select>
      </label>
      <label class="grid min-w-48 flex-1 gap-1 text-xs font-semibold sm:flex-none">Zona
        <select v-model="zone" class="report-field" :disabled="loading">
          <option value="Todos">Todas las zonas</option>
          <option v-for="item in settings.businessData.businessZones" :key="item.name" :value="item.name">{{ item.name }}</option>
        </select>
      </label>
      <button type="submit" class="report-button primary" :disabled="loading"><i class="fas fa-sync-alt" :class="{ 'fa-spin': loading }" aria-hidden="true"></i>{{ loading ? 'Generando…' : 'Generar reporte' }}</button>
    </form>

    <p v-if="error || exportError" class="panel p-4 text-sm" role="alert">{{ error || exportError }}</p>
    <p v-if="!report && !error" class="panel muted px-4 py-10 text-center text-sm" role="status">{{ loading ? 'Consultando datos del periodo…' : 'Selecciona el año y la zona para generar el reporte.' }}</p>

    <template v-if="report && generatedFor">
      <nav class="report-tabs flex flex-wrap gap-1" aria-label="Secciones del reporte">
        <button v-for="tab in tabs" :key="tab.id" type="button" class="report-button"
          :aria-pressed="active === tab.id" @click="active = tab.id"><i class="fas" :class="tab.icon" aria-hidden="true"></i>{{ tab.label }}</button>
      </nav>
      <p class="muted text-xs" aria-live="polite">Reporte generado · {{ generatedFor.year }} · {{ zoneLabel(generatedFor.zone) }}</p>
      <p v-if="active !== 'billing' && !ops" class="panel muted p-4 text-sm">Los datos operativos estarán disponibles cuando se actualice la función de reportes.</p>

      <template v-if="active === 'summary' && ops">
        <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <article v-for="item in statistics" :key="item.label" class="panel flex items-center gap-3 p-3">
            <span class="report-icon grid size-9 shrink-0 place-items-center rounded-lg"><i class="fas" :class="item.icon" aria-hidden="true"></i></span>
            <div><p class="muted text-xs">{{ item.label }}</p><p class="text-xl font-extrabold tabular-nums">{{ item.value }}</p></div>
          </article>
        </div>
        <div class="grid gap-4 lg:grid-cols-[2fr_1fr]">
          <section class="panel p-4">
            <h2 class="font-bold">Tendencia mensual de visitas</h2>
            <p class="muted mt-1 text-xs">Barras grises: registradas · Barras rojas: realizadas</p>
            <div class="chart mt-3" aria-label="Visitas mensuales">
              <div v-for="(month, index) in months" :key="month" class="chart-item">
                <div class="chart-bars" role="img" :aria-label="month + ': ' + (monthlyVisits[index] ?? 0) + ' registradas, ' + (monthlyCompleted[index] ?? 0) + ' realizadas'"
                  :title="month + ': ' + (monthlyVisits[index] ?? 0) + ' registradas, ' + (monthlyCompleted[index] ?? 0) + ' realizadas'">
                  <span class="bar total" :style="{ height: ((monthlyVisits[index] ?? 0) / seriesMax * 100) + '%' }"></span>
                  <span class="bar completed" :style="{ height: ((monthlyCompleted[index] ?? 0) / seriesMax * 100) + '%' }"></span>
                </div>
                <span class="muted text-xs">{{ month }}</span>
              </div>
            </div>
            <details class="mt-3 text-sm">
              <summary class="cursor-pointer font-semibold">Ver valores por mes</summary>
              <table class="report-table mt-2 w-full text-left text-xs">
                <thead><tr><th scope="col">Mes</th><th scope="col">Registradas</th><th scope="col">Realizadas</th></tr></thead>
                <tbody><tr v-for="(month, index) in months" :key="month"><td>{{ month }}</td><td>{{ monthlyVisits[index] ?? 0 }}</td><td>{{ monthlyCompleted[index] ?? 0 }}</td></tr></tbody>
              </table>
            </details>
          </section>
          <section class="panel p-4">
            <h2 class="font-bold">Estados de visita</h2>
            <dl class="mt-3 divide-y divide-[var(--shell-border)]">
              <div v-for="item in statusRows" :key="item.label" class="flex items-center justify-between gap-2 py-2 text-sm"><dt class="muted">{{ item.label }}</dt><dd class="font-bold">{{ number.format(item.value) }}</dd></div>
            </dl>
          </section>
        </div>
      </template>

      <template v-if="active === 'billing'">
        <div class="grid gap-3 sm:grid-cols-2">
          <article class="panel p-4"><p class="muted text-sm">Facturación emitida</p><p class="mt-1 text-2xl font-extrabold">{{ money.format(report.kpis.totalInvoiced) }}</p></article>
          <article class="panel p-4"><p class="muted text-sm">Visitas realizadas por facturar{{ ops ? '' : ' · saldo general' }}</p><p class="mt-1 text-2xl font-extrabold">{{ money.format(report.kpis.totalPendingBilling) }}</p></article>
        </div>
        <section class="panel overflow-hidden">
          <h2 class="p-4 font-bold">Facturación por mes</h2>
          <div class="overflow-x-auto">
            <table class="report-table w-full text-left text-sm">
              <thead><tr><th scope="col">Mes</th><th scope="col">Facturación emitida</th><th v-if="ops" scope="col">Por facturar</th></tr></thead>
              <tbody><tr v-for="(month, index) in months" :key="month"><td>{{ month }}</td><td>{{ money.format(financeTrend[index] ?? 0) }}</td><td v-if="ops">{{ money.format(ops.months[index]?.pendingBilling ?? 0) }}</td></tr></tbody>
            </table>
          </div>
        </section>
      </template>

      <section v-if="active === 'billing' || ops" class="panel overflow-hidden">
        <div class="flex flex-wrap items-center justify-between gap-2 p-4">
          <h2 class="font-bold">{{ breakdownTitle }}</h2>
          <p v-if="active === 'technicians'" class="muted text-xs">Una visita puede contar para varios técnicos.</p>
        </div>
        <div class="overflow-x-auto">
          <table v-if="active === 'billing' && report.topClients.length" class="report-table w-full text-left text-sm">
            <thead><tr><th scope="col">Cliente</th><th scope="col">Facturación emitida</th></tr></thead>
            <tbody><tr v-for="item in report.topClients" :key="item.clientId"><td>{{ item.clientName || 'Sin nombre' }}</td><td>{{ money.format(item.totalInvoiced) }}</td></tr></tbody>
          </table>
          <table v-else-if="active !== 'billing' && breakdown.length" class="report-table w-full text-left text-sm">
            <thead><tr><th scope="col">Nombre</th><th scope="col">Visitas</th><th scope="col">Realizadas</th><th v-if="active === 'services'" scope="col">Distribución</th></tr></thead>
            <tbody><tr v-for="(item, index) in breakdown" :key="index"><td class="font-semibold">{{ item.label }}</td><td>{{ number.format(item.visits) }}</td><td>{{ number.format(item.completed) }}</td><td v-if="active === 'services'">{{ report.kpis.totalVisits ? number.format(Math.round(item.visits / report.kpis.totalVisits * 1000) / 10) + '%' : '—' }}</td></tr></tbody>
          </table>
          <p v-else class="muted px-4 pb-4 text-sm">Sin registros para el periodo seleccionado.</p>
        </div>
      </section>
    </template>
  </section>
</template>

<style scoped>
.reports-page { --report-accent: #b8000b; --report-tint: #fff0f1; color: var(--shell-text); }
[data-theme='dark'] .reports-page { --report-accent: #ff858b; --report-tint: #412328; color-scheme: dark; }
.panel { border: 1px solid var(--shell-border); border-radius: 0.9rem; background: var(--shell-surface); }
.muted { color: var(--shell-muted); }
.report-icon { color: var(--report-accent); background: var(--report-tint); }
.report-field, .report-button {
  min-height: 2.5rem; border: 1px solid var(--shell-border); border-radius: 0.55rem; padding: 0.45rem 0.75rem;
  background: var(--shell-surface); color: var(--shell-text); font-size: 0.85rem;
}
.report-button { display: inline-flex; align-items: center; justify-content: center; gap: 0.5rem; font-weight: 650; }
.report-button:hover { background: var(--shell-input); }
.report-button:disabled { opacity: 0.5; }
.primary { border-color: #bc000b; background: #c7000c; color: #fff; }
.primary:hover { background: #a9000a; }
.report-tabs button[aria-pressed='true'] { color: var(--report-accent); background: var(--report-tint); border-color: var(--report-accent); }
.report-table th, .report-table td { padding: 0.7rem 1rem; border-bottom: 1px solid var(--shell-border); }
.report-table th { background: var(--shell-input); font-size: 0.75rem; }
.report-table tbody tr:hover { background: var(--shell-input); }
.chart { display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); gap: 0.25rem; }
.chart-item { display: grid; text-align: center; gap: 0.25rem; }
.chart-bars { position: relative; display: flex; align-items: end; justify-content: center; gap: 2px; height: 9rem; border-bottom: 1px solid var(--shell-border); }
.bar { width: min(35%, 1.25rem); border-radius: 3px 3px 0 0; }
.bar.total { background: #85858e; }
.bar.completed { background: #e50914; }
</style>
