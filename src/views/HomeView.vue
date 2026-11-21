<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { useNotificationStore } from '@/stores/notifications'
import { useAuthStore } from '@/stores/auth'
import { useDashboardStore } from '@/stores/dashboard'
import Chart from 'chart.js/auto'

const dashboardStore = useDashboardStore()
const router = useRouter()
const auth = useAuthStore()
const notifications = useNotificationStore()
const dashboard = ref<HTMLElement | null>(null)
const dateOptions = { timeZone: 'America/Bogota' } as const
const dateLabel = new Intl.DateTimeFormat('es-CO', { ...dateOptions, weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).format(new Date())
const hour = Number(new Intl.DateTimeFormat('es-CO', { ...dateOptions, hour: 'numeric', hourCycle: 'h23' }).format(new Date()))
const greeting = hour < 12 ? 'Buenos días' : hour < 18 ? 'Buenas tardes' : 'Buenas noches'
const firstName = computed(() => auth.user?.displayName?.trim().replace(/^IT\s+/i, '').split(/\s+/)[0] || '')
const visitTime = new Intl.DateTimeFormat('es-CO', { ...dateOptions, timeStyle: 'short' })
const now = ref(new Date())
const recentNotifications = computed(() => notifications.notifications
  .map((item) => ({ ...item, date: item.timestamp?.toDate?.() }))
  .sort((a, b) => (b.date?.getTime() ?? 0) - (a.date?.getTime() ?? 0))
  .slice(0, 3))

const serviceColors = ['#e50914', '#232323', '#8b8b90', '#b8000b', '#626268', '#b5b5ba']
const serviceMix = computed(() => {
  const entries = Object.entries((dashboardStore.charts?.serviceTypeDistribution ?? {}) as Record<string, number>)
    .sort(([, a], [, b]) => b - a)
  const top = entries.slice(0, 3)
  const remaining = entries.slice(3).reduce((sum, [, value]) => sum + value, 0)
  if (remaining > 0) top.push(['Otros', remaining])
  return top
})
const serviceTotal = computed(() => serviceMix.value.reduce((sum, [, value]) => sum + value, 0))


function formatVisitTime(date: string) {
  const value = new Date(date)
  return Number.isNaN(value.getTime()) ? 'Sin hora' : visitTime.format(value)
}

const dailyActivity = computed(() => {
  const visits = dashboardStore.todaysAgenda.filter((visit) => visit.estado_visita !== 'Cancelada')
  const completed = visits.filter((visit) => visit.estado_visita === 'Realizada').length
  return {
    total: visits.length,
    completed,
    pending: visits.length - completed,
    percent: visits.length ? Math.round(completed / visits.length * 1000) / 10 : 0,
    hasStatus: visits.every((visit) => Boolean(visit.estado_visita)),
  }
})

function canOpen(name: string) {
  const roles = router.resolve({ name }).meta.roles
  return !Array.isArray(roles) || roles.includes(auth.userRole)
}

const shortcuts = [
  { label: 'Clientes', name: 'clientes', icon: 'fa-users' },
  { label: 'Servicios', name: 'servicios', icon: 'fa-bug' },
  { label: 'Ver agenda', name: 'planeacion', icon: 'fa-calendar-alt' },
  { label: 'Ver reportes', name: 'reportes', icon: 'fa-chart-column' },
]
const visibleShortcuts = computed(() => shortcuts.filter(({ name }) => canOpen(name)))

const metrics = computed(() => {
  const kpis = dashboardStore.kpis
  if (!kpis) return []
  return [
    { label: 'Clientes', value: kpis.totalClients, detail: kpis.totalBranches + ' sucursales', name: 'clientes', icon: 'fa-users' },
    { label: 'Visitas del mes', value: kpis.visitsThisMonth, detail: kpis.completionRateThisMonth + '% de cumplimiento', name: 'planeacion', icon: 'fa-calendar-check' },
    { label: 'Servicios activos', value: kpis.activeServices, name: 'servicios', icon: 'fa-check' },
    { label: 'Facturación del mes', value: formatCurrency(kpis.revenueThisMonth), name: 'facturacion', icon: 'fa-dollar-sign' },
  ]
})

type TechnicianStats = Record<string, { id: string; realizadas: number; programadas: number; canceladas: number }>
const technicianStats = computed(() => dashboardStore.charts?.technicianStats as TechnicianStats | undefined)
const team = computed(() => Object.entries(technicianStats.value ?? {})
  .sort(([, a], [, b]) => b.programadas - a.programadas)
  .slice(0, 3))


// Referencias a los elementos <canvas> de los gráficos
const visitsPerMonthChartCanvas = ref<HTMLCanvasElement | null>(null)
const serviceTypeChartCanvas = ref<HTMLCanvasElement | null>(null)

// Referencias a las instancias de Chart.js para poder destruirlas
let visitsPerMonthChartInstance: Chart | null = null
let serviceTypeChartInstance: Chart | null = null

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(value)
}

function destroyCharts() {
  visitsPerMonthChartInstance?.destroy()
  serviceTypeChartInstance?.destroy()
}

const renderCharts = () => {
  destroyCharts()
  if (!dashboardStore.charts || !dashboard.value || dashboardStore.loading) return

  const theme = getComputedStyle(dashboard.value)
  const text = theme.getPropertyValue('--shell-muted').trim()
  const grid = theme.getPropertyValue('--shell-border').trim()
  const ticks = { color: text }
  const chartGrid = { color: grid }

  // 1. Gráfico de Visitas por Mes
  if (visitsPerMonthChartCanvas.value && dashboardStore.charts.visitsPerMonth) {
    const data = dashboardStore.charts.visitsPerMonth
    const labels = Object.keys(data).map((key) =>
      new Date(key + '-02').toLocaleString('es-ES', { month: 'short', year: '2-digit' }),
    )
    const values = Object.values(data)
    visitsPerMonthChartInstance = new Chart(visitsPerMonthChartCanvas.value, {
      type: 'line', // Cambiado a Line para tendencia
      data: {
        labels,
        datasets: [
          {
            label: 'Visitas',
            data: values,
            borderColor: '#e50914',
            backgroundColor: 'rgba(229, 9, 20, 0.10)',
            fill: true,
            tension: 0.25,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: { x: { ticks, grid: chartGrid }, y: { ticks, grid: chartGrid, beginAtZero: true } },
        plugins: { legend: { display: false } },
      },
    })
  }

  // 2. Gráfico de Tipos de Servicio
  if (serviceTypeChartCanvas.value && dashboardStore.charts.serviceTypeDistribution) {
    const labels = serviceMix.value.map(([label]) => label)
    const values = serviceMix.value.map(([, value]) => value)
    serviceTypeChartInstance = new Chart(serviceTypeChartCanvas.value, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [
          {
            data: values,
            backgroundColor: serviceColors,
            borderWidth: 0,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '69%',
        plugins: { legend: { display: false } },
      },
    })
  }
}

onMounted(() => {
  dashboardStore.fetchDashboardData()
  clock = window.setInterval(() => { now.value = new Date() }, 15000)
  const shell = dashboard.value?.closest('[data-theme]')
  if (shell) {
    themeObserver = new MutationObserver(renderCharts)
    themeObserver.observe(shell, { attributeFilter: ['data-theme'] })
  }
})

let clock: number | undefined
let themeObserver: MutationObserver | undefined
onUnmounted(() => {
  window.clearInterval(clock)
  themeObserver?.disconnect()
  destroyCharts()
})

watch(
  [() => dashboardStore.charts, () => dashboardStore.loading],
  renderCharts,
  { flush: 'post' },
)
</script>

<template>
  <div ref="dashboard" class="dashboard space-y-4">
    <header class="welcome-banner flex flex-wrap items-center justify-between gap-4 rounded-2xl px-5 py-6 sm:px-7">
      <div class="welcome-copy">
        <h1 class="text-2xl font-extrabold tracking-tight sm:text-4xl">
          {{ greeting }}<span v-if="firstName" class="text-[#ff454e]">, {{ firstName }}</span>
        </h1>
        <p class="mt-1 text-sm text-neutral-200">Aquí tienes un resumen de la operación de hoy.</p>
      </div>
      <div class="welcome-date">
        <i class="fas fa-calendar-alt text-3xl" aria-hidden="true"></i>
        <time :datetime="now.toISOString()">
          <span class="block font-bold first-letter:uppercase">{{ dateLabel }}</span>
          <span class="block text-sm">{{ visitTime.format(now) }}</span>
        </time>
      </div>
    </header>

    <div v-if="dashboardStore.loading" role="status" class="panel p-6">
      Cargando el resumen de la operación…
    </div>
    <div v-else-if="dashboardStore.error" role="alert" class="panel p-6">
      <h2 class="font-bold">Error al cargar Inicio</h2>
      <p class="muted mt-2 text-sm">{{ dashboardStore.error }}</p>
      <button type="button" class="accent-link mt-2" @click="dashboardStore.fetchDashboardData">Reintentar</button>
    </div>

    <template v-else-if="dashboardStore.kpis">
      <section aria-label="Indicadores" class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <component v-for="metric in metrics" :key="metric.label"
          :is="canOpen(metric.name) ? RouterLink : 'div'"
          :to="canOpen(metric.name) ? { name: metric.name } : undefined"
          class="panel metric flex min-w-0 items-center gap-4 p-4">
          <span class="kpi-icon grid size-12 shrink-0 place-items-center text-2xl">
            <i class="fas" :class="metric.icon" aria-hidden="true"></i>
          </span>
          <div class="min-w-0">
            <p class="text-sm font-semibold">{{ metric.label }}</p>
            <p class="break-words text-3xl font-extrabold tabular-nums">{{ metric.value }}</p>
            <p v-if="metric.detail" class="muted text-xs">{{ metric.detail }}</p>
          </div>
        </component>
      </section>

      <div class="dashboard-primary grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
        <section class="panel p-4">
          <h2 class="section-title"><i class="fas fa-chart-bar" aria-hidden="true"></i> Actividad de hoy</h2>
          <div class="activity-layout">
            <div class="activity-gauge">
              <div class="activity-ring"
                :style="{ '--activity-total': (dailyActivity.hasStatus ? dailyActivity.percent : 0) + '%' }">
                <strong>{{ dailyActivity.hasStatus ? dailyActivity.percent + '%' : '—' }}</strong>
              </div>
              <span class="text-xs font-semibold">Cumplimiento del día</span>
            </div>
            <div class="activity-summary">
              <dl class="activity-stats">
                <div>
                  <i class="fas fa-calendar-check" aria-hidden="true"></i>
                  <dd>{{ dailyActivity.total }}</dd>
                  <dt>Visitas de hoy</dt>
                </div>
                <div>
                  <i class="fas fa-check text-green-600" aria-hidden="true"></i>
                  <dd>{{ dailyActivity.hasStatus ? dailyActivity.completed : '—' }}</dd>
                  <dt>Completadas</dt>
                </div>
                <div>
                  <i class="fas fa-clock" aria-hidden="true"></i>
                  <dd>{{ dailyActivity.hasStatus ? dailyActivity.pending : '—' }}</dd>
                  <dt>Pendientes</dt>
                </div>
              </dl>
              <progress v-if="dailyActivity.hasStatus" class="activity-progress" max="100" :value="dailyActivity.percent" aria-label="Cumplimiento del día"></progress>
              <p v-else class="muted text-xs">Estados de visita aún no disponibles.</p>
            </div>
          </div>
        </section>


        <section class="panel">
          <div class="panel-heading flex flex-wrap items-center justify-between gap-2 px-4 py-3">
            <h2 class="font-bold"><i class="fas fa-calendar-day mr-2" aria-hidden="true"></i> Agenda de hoy</h2>
            <RouterLink v-if="canOpen('planeacion')" :to="{ name: 'planeacion' }" class="text-xs font-semibold hover:underline">
              Ver calendario <i class="fas fa-arrow-right ml-1" aria-hidden="true"></i>
            </RouterLink>
          </div>
          <p v-if="!dashboardStore.todaysAgenda.length" class="muted p-4 text-sm">Sin visitas para hoy.</p>
          <ul v-else class="agenda-list max-h-48 overflow-y-auto px-4">
            <li v-for="visit in dashboardStore.todaysAgenda" :key="visit.id" class="list-row">
              <component :is="canOpen('planeacion') ? RouterLink : 'div'"
                :to="canOpen('planeacion') ? { name: 'planeacion', query: { visitIdToOpen: visit.id, date: visit.fecha_visita } } : undefined"
                class="flex items-center gap-3 py-2.5 text-sm">
                <span class="agenda-time shrink-0 font-semibold tabular-nums">{{ formatVisitTime(visit.fecha_visita) }}</span>
                <span class="min-w-0 flex-1">
                  <span class="block font-bold">{{ visit.nombre_cliente }}</span>
                  <span class="muted block text-xs">{{ visit.tipo_visita }}</span>
                </span>
                <span v-if="visit.estado_visita" class="status-chip" :data-status="visit.estado_visita">{{ visit.estado_visita }}</span>
              </component>
            </li>
          </ul>
        </section>
      </div>

      <div class="grid gap-4 lg:grid-cols-[1.35fr_1fr_1.05fr]">
        <section class="panel min-w-0 p-4">
          <h2 class="section-title"><i class="fas fa-chart-line" aria-hidden="true"></i> Tendencia de visitas</h2>
          <div class="mt-3 h-44"><canvas ref="visitsPerMonthChartCanvas" role="img" aria-label="Visitas realizadas por mes"></canvas></div>
        </section>
        <section class="panel min-w-0 p-4">
          <h2 class="section-title"><i class="fas fa-chart-pie" aria-hidden="true"></i> Tipos de servicio</h2>
          <div v-if="serviceTotal" class="service-mix mt-3">
            <div class="service-donut">
              <canvas ref="serviceTypeChartCanvas" role="img" aria-label="Distribución de tipos de servicio"></canvas>
              <div class="service-total"><strong>{{ serviceTotal }}</strong><span>Total</span></div>
            </div>
            <ul class="space-y-2 text-xs">
              <li v-for="([label, value], index) in serviceMix" :key="label" class="flex items-center gap-1.5">
                <span class="size-2 shrink-0 rounded-full" :style="{ backgroundColor: serviceColors[index] }"></span>
                <span class="min-w-0 flex-1 break-words">{{ label }}</span>
                <strong>{{ Math.round(value / serviceTotal * 100) }}%</strong>
              </li>
            </ul>
          </div>
          <p v-else class="muted mt-4 text-sm">Sin tipos de servicio para mostrar.</p>
        </section>
        <section class="panel min-w-0 p-4">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <h2 class="section-title"><i class="fas fa-users" aria-hidden="true"></i> Tu equipo</h2>
            <RouterLink v-if="canOpen('fumigadores')" :to="{ name: 'fumigadores' }" class="accent-link">Ver equipo →</RouterLink>
          </div>
          <p v-if="!team.length" class="muted mt-4 text-sm">Sin estadísticas del equipo para este mes.</p>
          <ul v-else class="mt-2">
            <li v-for="[name, stats] in team" :key="name" class="list-row">
              <component :is="canOpen('fumigadores') ? RouterLink : 'div'"
                :to="canOpen('fumigadores') ? { name: 'fumigadores', query: { itemIdToOpen: stats.id } } : undefined"
                class="flex items-center gap-3 py-2 text-sm">
                <span class="metric-icon grid size-8 shrink-0 place-items-center rounded-full font-semibold" aria-hidden="true">{{ name.charAt(0) }}</span>
                <span class="min-w-0 flex-1 font-semibold">{{ name }}</span>
                <span class="status-chip">{{ stats.programadas }} programadas</span>
              </component>
            </li>
          </ul>
        </section>
      </div>

      <div class="grid gap-4 lg:grid-cols-[1.85fr_1fr]">
        <section v-if="visibleShortcuts.length" class="panel flex flex-col justify-between p-4">
          <h2 class="section-title">Accesos rápidos</h2>
          <div class="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <RouterLink v-for="shortcut in visibleShortcuts" :key="shortcut.name" :to="{ name: shortcut.name }"
              class="shortcut flex min-h-16 flex-col items-center justify-center gap-2 rounded-xl p-2 text-center text-xs font-semibold text-white"
              :class="{ 'shortcut-primary': shortcut.name === 'planeacion' }">
              <i class="fas text-lg" :class="shortcut.icon" aria-hidden="true"></i>{{ shortcut.label }}
            </RouterLink>
          </div>
        </section>
        <section class="panel recent-panel">
          <div class="flex items-center justify-between gap-2 px-4 pt-3">
            <h2 class="font-bold">Últimas actividades</h2>
            <RouterLink :to="{ query: { ...$route.query, notificaciones: '1' }, hash: $route.hash }" aria-haspopup="dialog" class="text-xs font-bold text-[#ff747b] hover:underline">Ver todas →</RouterLink>
          </div>
          <p v-if="!recentNotifications.length" class="px-4 py-3 text-xs text-neutral-300">Sin notificaciones pendientes.</p>
          <ul v-else class="px-4 pb-2 pt-1">
            <li v-for="item in recentNotifications" :key="item.id" class="recent-row flex items-center gap-2 py-2 text-xs">
              <i class="fas fa-bell" aria-hidden="true"></i>
              <span class="min-w-0 flex-1 truncate" :title="item.message">{{ item.message }}</span>
              <time v-if="item.date" :datetime="item.date.toISOString()" class="shrink-0 text-neutral-300">{{ visitTime.format(item.date) }}</time>
            </li>
          </ul>
        </section>
      </div>
    </template>
  </div>
</template>

<style scoped>
.dashboard {
  --dashboard-accent: #b8000b;
  --dashboard-tint: #fff0f1;
  color: var(--shell-text);
}

[data-theme='dark'] .dashboard {
  --dashboard-accent: #ff747b;
  --dashboard-tint: #3b1e21;
}

.welcome-banner {
  min-height: 8rem;
  background:
    linear-gradient(127deg, transparent 76%, #a8000a 76% 78%, #e50914 78% 80%, #171717 80%),
    linear-gradient(90deg, #111 27%, #111c 42%, transparent 67%),
    #111 url('/images/servicio-manejo-plagas.jpg') right 57% / 61% auto no-repeat;
  color: #fff;
}

.welcome-copy { border-left: 5px solid #e50914; padding-left: 0.9rem; }
.welcome-date { display: flex; align-items: center; gap: 0.85rem; text-shadow: 0 1px 4px #111; }
.welcome-date time { min-width: 8.5rem; }

.panel {
  overflow: hidden;
  border: 1px solid var(--shell-border);
  border-radius: 0.9rem;
  background: var(--shell-surface);
  box-shadow: 0 1px 2px #0000000a;
}

.metric { position: relative; isolation: isolate; min-height: 6rem; background: linear-gradient(145deg, var(--shell-surface) 70%, var(--dashboard-tint)); }
.metric::after { content: ''; position: absolute; z-index: -1; inset: auto 0 0 auto; width: 35%; height: 56%; background: var(--dashboard-tint); clip-path: polygon(0 100%, 18% 82%, 38% 78%, 64% 37%, 81% 38%, 100% 0, 100% 100%); }
.metric:nth-child(even) { --dashboard-tint: var(--shell-input); }
.kpi-icon { color: var(--dashboard-accent); }
.metric:nth-child(2) .kpi-icon { color: var(--shell-text); }
.metric:nth-child(n + 3) .kpi-icon { background: #d40711; color: #fff; border-radius: 50%; }
.metric[href]:hover { border-color: #e50914; }
.metric-icon { background: var(--dashboard-tint); color: var(--dashboard-accent); }
.muted { color: var(--shell-muted); }
.section-title { display: flex; align-items: center; gap: 0.55rem; font-weight: 750; }
.section-title i, .accent-link { color: var(--dashboard-accent); }
.accent-link { font-size: 0.75rem; font-weight: 700; }
.accent-link:hover { text-decoration: underline; }
.panel-heading { background: #181818; color: #fff; }
.list-row + .list-row { border-top: 1px solid var(--shell-border); }
.list-row a:hover { color: var(--dashboard-accent); }
.activity-layout { display: grid; grid-template-columns: minmax(6rem, 1fr) minmax(0, 2fr); min-height: 10.5rem; align-items: center; gap: 0.75rem; margin-top: 0.5rem; }
.activity-gauge { display: grid; justify-items: center; gap: 0.5rem; text-align: center; }
.activity-ring { display: grid; place-items: center; width: clamp(5.5rem, 9vw, 8.3rem); aspect-ratio: 1; border-radius: 50%; background: conic-gradient(#e50914 var(--activity-total), #bfc1c7 0); }
.activity-ring strong { display: grid; place-items: center; width: 79%; aspect-ratio: 1; border-radius: 50%; background: var(--shell-surface); font-size: 1.35rem; }
.activity-summary { display: grid; min-width: 0; gap: 0.8rem; padding-left: 0.75rem; border-left: 1px solid var(--shell-border); }
.activity-stats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); text-align: center; }
.activity-stats div + div { border-left: 1px solid var(--shell-border); }
.activity-stats i { font-size: 1.2rem; }
.activity-stats i:not(.text-green-600) { color: var(--dashboard-accent); }
.activity-stats dd { font-size: 1.5rem; font-weight: 800; }
.activity-stats dt { font-size: 0.7rem; overflow-wrap: anywhere; }
.activity-progress { width: 100%; height: 0.6rem; accent-color: #e50914; }
.agenda-time { min-width: 5.7rem; border-right: 1px solid var(--shell-border); padding-right: 0.5rem; }
.agenda-time::before { content: ''; display: inline-block; width: 0.55rem; height: 0.55rem; margin-right: 0.35rem; border-radius: 50%; background: #e50914; }
.agenda-list li:nth-child(3n + 2) .agenda-time::before { background: #426591; }
.agenda-list li:nth-child(3n) .agenda-time::before { background: #bd5d04; }
.status-chip[data-status='Realizada'] { color: #086634; background: #dcf4e4; }
.status-chip[data-status='Programada'] { color: #174783; background: #e0ebff; }
.service-mix { display: grid; grid-template-columns: minmax(5rem, 1fr) minmax(0, 1fr); gap: 0.65rem; align-items: center; min-height: 11rem; }
.service-donut { position: relative; width: 100%; aspect-ratio: 1; }
.service-total { position: absolute; inset: 0; display: grid; place-content: center; text-align: center; line-height: 1.05; pointer-events: none; }
.service-total strong { font-size: 1.5rem; }
.service-total span { font-size: 0.7rem; }
.recent-panel { background: #181818; color: white; }
.recent-row i { color: #76b6f1; }
.recent-row + .recent-row { border-top: 1px solid #ffffff18; }
@media (max-width: 640px) {
  .welcome-banner { background: linear-gradient(90deg, #111, #111a), #111 url('/images/servicio-manejo-plagas.jpg') center / cover; }
  .welcome-date { font-size: 0.8rem; }
  .agenda-time { min-width: 0; }
}
.status-chip { border-radius: 99px; padding: 0.2rem 0.45rem; background: var(--shell-input); color: var(--shell-muted); font-size: 0.7rem; font-weight: 600; }
.shortcut { background: #222; }
.shortcut:hover { background: #3b3b3b; }
.shortcut-primary { background: #b8000b; }
.shortcut-primary:hover { background: #9e000a; }
</style>
