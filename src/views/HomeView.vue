<script setup lang="ts">
import { onMounted, ref, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useDashboardStore } from '@/stores/dashboard'
import Chart from 'chart.js/auto'
import type { ChartOptions } from 'chart.js'
import ChartDataLabels from 'chartjs-plugin-datalabels'

const dashboardStore = useDashboardStore()
const router = useRouter()

// Referencias a los elementos <canvas> de los gráficos
const visitsPerMonthChartCanvas = ref<HTMLCanvasElement | null>(null)
const serviceTypeChartCanvas = ref<HTMLCanvasElement | null>(null)
const servicesByFrequencyChartCanvas = ref<HTMLCanvasElement | null>(null)
const clientsByCityChartCanvas = ref<HTMLCanvasElement | null>(null)
const technicianProductivityChartCanvas = ref<HTMLCanvasElement | null>(null)

// Referencias a las instancias de Chart.js para poder destruirlas
let visitsPerMonthChartInstance: Chart | null = null
let serviceTypeChartInstance: Chart | null = null
let servicesByFrequencyChartInstance: Chart | null = null
let clientsByCityChartInstance: Chart | null = null
let technicianProductivityChartInstance: Chart | null = null

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(value)
}

const navigateToClientsByCity = (city: string) => {
  router.push({ name: 'clientes', query: { cityFilter: city } })
}

const navigateToPlanning = (visitId: string) => {
  router.push({ name: 'planeacion', query: { visitIdToOpen: visitId } })
}

const navigateToTechnician = (technicianId: string) => {
  router.push({ name: 'fumigadores', query: { itemIdToOpen: technicianId } })
}

const renderCharts = () => {
  if (!dashboardStore.charts) return

  // Configuración global para el tema oscuro
  Chart.defaults.color = '#9ca3af' // gray-400
  Chart.defaults.borderColor = 'rgba(75, 85, 99, 0.2)' // gray-600 low opacity
  Chart.defaults.font.family = "'Inter', sans-serif"

  // Destruir gráficos anteriores
  if (visitsPerMonthChartInstance) visitsPerMonthChartInstance.destroy()
  if (serviceTypeChartInstance) serviceTypeChartInstance.destroy()
  if (servicesByFrequencyChartInstance) servicesByFrequencyChartInstance.destroy()
  if (clientsByCityChartInstance) clientsByCityChartInstance.destroy()
  if (technicianProductivityChartInstance) technicianProductivityChartInstance.destroy()

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
            borderColor: '#3b82f6',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            fill: true,
            tension: 0.4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
        },
      },
    })
  }

  // 2. Gráfico de Tipos de Servicio
  if (serviceTypeChartCanvas.value && dashboardStore.charts.serviceTypeDistribution) {
    const data = dashboardStore.charts.serviceTypeDistribution
    const sortedData = Object.entries(data).sort(([, a], [, b]) => (b as number) - (a as number))
    const labels = sortedData.map((item) => item[0])
    const values = sortedData.map((item) => item[1] as number)
    serviceTypeChartInstance = new Chart(serviceTypeChartCanvas.value, {
      type: 'doughnut',
      plugins: [ChartDataLabels],
      data: {
        labels,
        datasets: [
          {
            data: values,
            backgroundColor: ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'],
            borderWidth: 0,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '70%',
        plugins: {
          legend: { display: false },
          datalabels: {
            color: '#fff',
            font: { weight: 'bold' },
            formatter: (value: number, context: { chart: Chart }) => {
              const dataset = context.chart.data.datasets[0]
              if (!dataset) return ''
              const data = dataset.data as number[]
              const total = data.reduce((a, b) => a + b, 0)
              const percentage = (value / total) * 100
              return percentage > 5 ? `${percentage.toFixed(0)}%` : ''
            },
          },
        },
      } as ChartOptions<'doughnut'>,
    })
  }

  // 3. Gráfico de Servicios por Frecuencia
  if (servicesByFrequencyChartCanvas.value && dashboardStore.charts.servicesByFrequency) {
    const data = dashboardStore.charts.servicesByFrequency
    const sortedData = Object.entries(data).sort(([, a], [, b]) => (b as number) - (a as number))
    const labels = sortedData.map((item) => item[0])
    const values = sortedData.map((item) => item[1])
    servicesByFrequencyChartInstance = new Chart(servicesByFrequencyChartCanvas.value, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Servicios',
            data: values,
            backgroundColor: '#10b981',
            borderRadius: 4,
          },
        ],
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false }, datalabels: { display: false } },
        scales: {
          y: { grid: { display: false } },
          x: { display: false },
        },
        onClick: (event, elements) => {
          if (elements.length > 0) {
            const element = elements[0]!
            const index = element.index
            const cityName = labels[index]
            if (cityName) {
              router.push({ name: 'clientes', query: { cityFilter: cityName } })
            }
          }
        },
        onHover: (event, chartElement) => {
          const target = event.native?.target as HTMLElement
          if (target) target.style.cursor = chartElement[0] ? 'pointer' : 'default'
        },
      },
    })
  }

  // 4. Gráfico de Clientes por Ciudad
  if (clientsByCityChartCanvas.value && dashboardStore.charts.clientsByCity) {
    const data = dashboardStore.charts.clientsByCity
    const sortedData = Object.entries(data).sort(([, a], [, b]) => (b as number) - (a as number))
    const labels = sortedData.map((item) => item[0])
    const values = sortedData.map((item) => item[1] as number)
    clientsByCityChartInstance = new Chart(clientsByCityChartCanvas.value, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Clientes',
            data: values,
            backgroundColor: '#8b5cf6',
            borderRadius: 4,
          },
        ],
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          datalabels: { display: false },
          tooltip: {
            callbacks: {
              label: (context) => ` ${context.parsed.x} clientes`,
            },
          },
        },
        scales: {
          y: { grid: { display: false } },
          x: { display: false },
        },
        onClick: (event, elements) => {
          if (elements.length > 0) {
            const index = elements[0]!.index
            const cityName = labels[index]
            if (cityName) {
              navigateToClientsByCity(cityName)
            }
          }
        },
        onHover: (event, chartElement) => {
          const target = event.native?.target as HTMLElement
          if (target) target.style.cursor = chartElement[0] ? 'pointer' : 'default'
        },
      },
    })
  }

  // 5. Gráfico de Productividad de Técnicos
  if (technicianProductivityChartCanvas.value && dashboardStore.charts.technicianStats) {
    const data = dashboardStore.charts.technicianStats as Record<
      string,
      { realizadas: number; id: string; programadas: number; canceladas: number }
    >
    const labels = Object.keys(data)
    const realizadasData = labels.map((label) => data[label]!.realizadas)
    const technicianIds = labels.map((label) => data[label]!.id)
    const programadasData = labels.map((label) => data[label]!.programadas)
    const canceladasData = labels.map((label) => data[label]!.canceladas)

    technicianProductivityChartInstance = new Chart(technicianProductivityChartCanvas.value, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Realizadas',
            data: realizadasData,
            backgroundColor: '#4ade80',
            borderRadius: 4,
          },
          {
            label: 'Programadas',
            data: programadasData,
            backgroundColor: '#60a5fa',
            borderRadius: 4,
          },
          {
            label: 'Canceladas',
            data: canceladasData,
            backgroundColor: '#f87171',
            borderRadius: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { stacked: true, grid: { display: false } },
          y: { stacked: true, beginAtZero: true },
        },
        plugins: {
          legend: { position: 'top', align: 'end', labels: { boxWidth: 10 } },
          datalabels: { display: false },
        },
        onClick: (event, elements) => {
          if (elements.length > 0) {
            const index = elements[0]!.index
            const techId = technicianIds[index]
            if (techId) {
              navigateToTechnician(techId)
            }
          }
        },
        onHover: (event, chartElement) => {
          const target = event.native?.target as HTMLElement
          if (target) target.style.cursor = chartElement[0] ? 'pointer' : 'default'
        },
      },
    })
  }
}

onMounted(() => {
  dashboardStore.fetchDashboardData()
})

watch(
  () => dashboardStore.charts,
  (newCharts) => {
    if (newCharts && !dashboardStore.loading) {
      nextTick(() => {
        renderCharts()
      })
    }
  },
  { deep: true, immediate: true },
)
</script>

<template>
  <div class="h-full bg-[#0a0a0a] text-gray-100 flex flex-col p-4 md:p-6 overflow-y-auto custom-scrollbar">
    <!-- Header -->
    <header class="flex-shrink-0 mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
      <div>
        <h2 class="text-2xl md:text-3xl font-bold text-white flex items-center gap-2">
          <i class="fas fa-tachometer-alt text-indigo-500"></i>
          Resumen del Sistema
        </h2>
        <p class="text-sm text-gray-400 mt-1">
          Visión general de métricas, actividad diaria y pendientes
        </p>
      </div>
      <button @click="dashboardStore.fetchDashboardData" class="btn btn-secondary flex items-center gap-2 shadow-lg"
        :disabled="dashboardStore.loading">
        <i class="fas fa-sync-alt" :class="{ 'fa-spin': dashboardStore.loading }"></i>
        <span>Actualizar</span>
      </button>
    </header>

    <!-- Skeleton Loader -->
    <div v-if="dashboardStore.loading" class="animate-pulse space-y-6">
      <div class="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div v-for="i in 5" :key="i" class="bg-[#151515] rounded-xl h-24"></div>
      </div>
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div class="lg:col-span-2 bg-[#151515] rounded-xl h-80"></div>
        <div class="bg-[#151515] rounded-xl h-80"></div>
      </div>
    </div>

    <!-- Error State -->
    <div v-else-if="dashboardStore.error" class="flex flex-col items-center justify-center h-full text-[#d60000]">
      <i class="fas fa-exclamation-triangle text-5xl mb-4"></i>
      <h3 class="text-2xl font-bold">Error de Carga</h3>
      <p class="text-gray-400 mt-2">{{ dashboardStore.error }}</p>
      <button @click="dashboardStore.fetchDashboardData" class="btn btn-primary mt-4">
        Intentar de nuevo
      </button>
    </div>

    <!-- Dashboard Content -->
    <div v-else-if="dashboardStore.kpis" class="space-y-6 animate-fade-in">
      <!-- KPIs Grid -->
      <section class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <!-- Clientes -->
        <RouterLink to="/clientes"
          class="bg-[#151515] p-4 rounded-xl border border-white/10 shadow-lg hover:border-indigo-500/50 hover:shadow-indigo-500/10 transition-all group">
          <div class="flex justify-between items-start">
            <div>
              <p class="text-xs font-bold text-gray-400 uppercase tracking-wider">Clientes</p>
              <p class="text-2xl font-bold text-white mt-1 group-hover:text-indigo-400 transition-colors">
                {{ dashboardStore.kpis.totalClients }}
              </p>
            </div>
            <div class="bg-[#0a0a0a]/50 p-2 rounded-lg text-indigo-400">
              <i class="fas fa-users"></i>
            </div>
          </div>
        </RouterLink>

        <!-- Servicios -->
        <RouterLink to="/servicios"
          class="bg-[#151515] p-4 rounded-xl border border-white/10 shadow-lg hover:border-emerald-500/50 hover:shadow-emerald-500/10 transition-all group">
          <div class="flex justify-between items-start">
            <div>
              <p class="text-xs font-bold text-gray-400 uppercase tracking-wider">
                Servicios Activos
              </p>
              <p class="text-2xl font-bold text-white mt-1 group-hover:text-emerald-400 transition-colors">
                {{ dashboardStore.kpis.activeServices }}
              </p>
            </div>
            <div class="bg-[#0a0a0a]/50 p-2 rounded-lg text-emerald-400">
              <i class="fas fa-bug"></i>
            </div>
          </div>
        </RouterLink>

        <!-- Visitas -->
        <RouterLink to="/planeacion"
          class="bg-[#151515] p-4 rounded-xl border border-white/10 shadow-lg hover:border-blue-500/50 hover:shadow-blue-500/10 transition-all group">
          <div class="flex justify-between items-start">
            <div>
              <p class="text-xs font-bold text-gray-400 uppercase tracking-wider">Visitas (Mes)</p>
              <p class="text-2xl font-bold text-white mt-1 group-hover:text-blue-400 transition-colors">
                {{ dashboardStore.kpis.visitsThisMonth }}
              </p>
            </div>
            <div class="bg-[#0a0a0a]/50 p-2 rounded-lg text-blue-400">
              <i class="fas fa-calendar-check"></i>
            </div>
          </div>
        </RouterLink>

        <!-- Cumplimiento -->
        <RouterLink to="/reportes"
          class="bg-[#151515] p-4 rounded-xl border border-white/10 shadow-lg hover:border-cyan-500/50 hover:shadow-cyan-500/10 transition-all group">
          <div class="flex justify-between items-start">
            <div>
              <p class="text-xs font-bold text-gray-400 uppercase tracking-wider">Cumplimiento</p>
              <p class="text-2xl font-bold text-white mt-1 group-hover:text-cyan-400 transition-colors">
                {{ dashboardStore.kpis.completionRateThisMonth }}%
              </p>
            </div>
            <div class="bg-[#0a0a0a]/50 p-2 rounded-lg text-cyan-400">
              <i class="fas fa-chart-line"></i>
            </div>
          </div>
        </RouterLink>

        <!-- Facturación -->
        <RouterLink to="/facturacion"
          class="bg-[#151515] p-4 rounded-xl border border-white/10 shadow-lg hover:border-green-500/50 hover:shadow-green-500/10 transition-all group">
          <div class="flex justify-between items-start">
            <div>
              <p class="text-xs font-bold text-gray-400 uppercase tracking-wider">Facturado</p>
              <p class="text-xl font-bold text-white mt-1 group-hover:text-green-400 transition-colors truncate"
                :title="formatCurrency(dashboardStore.kpis.revenueThisMonth)">
                {{ formatCurrency(dashboardStore.kpis.revenueThisMonth) }}
              </p>
            </div>
            <div class="bg-[#0a0a0a]/50 p-2 rounded-lg text-green-400">
              <i class="fas fa-dollar-sign"></i>
            </div>
          </div>
        </RouterLink>
      </section>

      <!-- Main Layout -->
      <section class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Left Column (Charts & Main Data) -->
        <div class="lg:col-span-2 space-y-6">
          <!-- Visitas por Mes (Tendencia) -->
          <div class="bg-[#151515] rounded-xl border border-white/10 shadow-lg p-5">
            <h3 class="font-bold text-gray-200 mb-4 flex items-center gap-2">
              <i class="fas fa-chart-area text-blue-500"></i> Tendencia de Visitas
            </h3>
            <div class="h-64 relative">
              <canvas ref="visitsPerMonthChartCanvas"></canvas>
            </div>
          </div>

          <!-- Productividad Técnicos -->
          <div class="bg-[#151515] rounded-xl border border-white/10 shadow-lg p-5">
            <h3 class="font-bold text-gray-200 mb-4 flex items-center gap-2">
              <i class="fas fa-user-clock text-green-500"></i> Productividad Técnica (Mes)
            </h3>
            <div class="h-80 relative">
              <canvas ref="technicianProductivityChartCanvas"></canvas>
            </div>
          </div>

          <!-- Distribución y Frecuencia -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div class="bg-[#151515] rounded-xl border border-white/10 shadow-lg p-5">
              <h3 class="font-bold text-gray-200 mb-4 text-sm uppercase">Tipos de Servicio</h3>
              <div class="h-48 relative">
                <canvas ref="serviceTypeChartCanvas"></canvas>
              </div>
            </div>
            <div class="bg-[#151515] rounded-xl border border-white/10 shadow-lg p-5">
              <h3 class="font-bold text-gray-200 mb-4 text-sm uppercase">Frecuencias</h3>
              <div class="h-48 relative">
                <canvas ref="servicesByFrequencyChartCanvas"></canvas>
              </div>
            </div>
          </div>
        </div>

        <!-- Right Column (Sidebar Lists) -->
        <div class="space-y-6">
          <!-- Agenda Hoy -->
          <div class="bg-[#151515] rounded-xl border border-white/10 shadow-lg flex flex-col h-[500px]">
            <div class="p-4 border-b border-white/10 bg-[#151515] rounded-t-xl sticky top-0 z-10">
              <h3 class="font-bold text-white flex items-center gap-2">
                <i class="fas fa-calendar-day text-orange-500"></i> Agenda Hoy
              </h3>
            </div>
            <div class="flex-grow overflow-y-auto custom-scrollbar p-3 space-y-2">
              <div v-if="!dashboardStore.todaysAgenda.length" class="text-center py-8 text-gray-500">
                <i class="fas fa-mug-hot text-3xl mb-2 opacity-50"></i>
                <p>Sin visitas para hoy.</p>
              </div>
              <div v-else v-for="visit in dashboardStore.todaysAgenda" :key="visit.id"
                @click="navigateToPlanning(visit.id)"
                class="bg-white/5 border border-white/10 p-3 rounded-lg hover:bg-white/10 cursor-pointer transition-all border-l-4 border-l-orange-500">
                <p class="font-bold text-gray-200 text-sm line-clamp-1">
                  {{ visit.nombre_cliente }}
                </p>
                <div class="flex justify-between items-center mt-1">
                  <span class="text-xs text-gray-400 bg-[#0a0a0a]/50 px-2 py-0.5 rounded">{{
                    visit.tipo_visita
                    }}</span>
                  <i class="fas fa-chevron-right text-gray-600 text-xs"></i>
                </div>
              </div>
            </div>
          </div>

          <!-- Pendientes de Asignar -->
          <div class="bg-[#151515] rounded-xl border border-white/10 shadow-lg flex flex-col max-h-[400px]">
            <div class="p-4 border-b border-white/10 bg-[#151515] rounded-t-xl sticky top-0 z-10">
              <h3 class="font-bold text-white flex items-center gap-2">
                <i class="fas fa-clipboard-list text-yellow-500"></i> Por Asignar
                <span v-if="dashboardStore.pendingVisits.length"
                  class="bg-yellow-500/20 text-yellow-400 text-xs px-2 py-0.5 rounded-full ml-auto">{{
                    dashboardStore.pendingVisits.length }}</span>
              </h3>
            </div>
            <div class="flex-grow overflow-y-auto custom-scrollbar p-3 space-y-2">
              <div v-if="!dashboardStore.pendingVisits.length" class="text-center py-8 text-gray-500">
                <i class="fas fa-check-circle text-3xl mb-2 opacity-50 text-green-500"></i>
                <p>Todo asignado.</p>
              </div>
              <div v-else v-for="visit in dashboardStore.pendingVisits" :key="visit.id"
                class="bg-white/5 border border-white/10 p-3 rounded-lg flex flex-col gap-2">
                <div>
                  <p class="font-bold text-gray-200 text-sm line-clamp-1">
                    {{ visit.nombre_cliente }}
                  </p>
                  <p class="text-xs text-yellow-500/80 font-medium">{{ visit.tipo_visita }}</p>
                </div>
                <button @click="navigateToPlanning(visit.id)"
                  class="btn btn-secondary text-xs w-full justify-center bg-[#151515] hover:bg-[#202020] border border-white/10">
                  Asignar Ahora
                </button>
              </div>
            </div>
          </div>

          <!-- Clientes por Ciudad (Mini Chart) -->
          <div class="bg-[#151515] rounded-xl border border-white/10 shadow-lg p-4">
            <h3 class="font-bold text-gray-200 mb-2 text-sm uppercase">Top Ciudades</h3>
            <div class="h-40 relative">
              <canvas ref="clientsByCityChartCanvas"></canvas>
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.animate-fade-in {
  animation: fadeIn 0.5s ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
