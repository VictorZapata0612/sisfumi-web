<script setup lang="ts">
import { ref, onMounted, watch, nextTick, computed } from 'vue'
import { useReportsStore } from '@/stores/reports'
import { useAuthStore } from '@/stores/auth'
import { storeToRefs } from 'pinia'
import Chart from 'chart.js/auto'

defineOptions({ name: 'AnnualReport' })

const reportsStore = useReportsStore()
const authStore = useAuthStore()
const { loading, error, annualReportData } = storeToRefs(reportsStore)

const selectedYear = ref(new Date().getFullYear())
const selectedZone = ref('Todos')

const monthlyTrendChartCanvas = ref<HTMLCanvasElement | null>(null)
const zoneDistributionChartCanvas = ref<HTMLCanvasElement | null>(null)
let monthlyTrendChartInstance: Chart | null = null
let zoneDistributionChartInstance: Chart | null = null

const canFilterByZone = computed(() => {
  // Aquí se configuran los roles que pueden ver TODAS las zonas
  const allowedRoles = ['Administrador', 'Jefe', 'Coordinador Nacionales', 'Coordinador Nacional', 'Gerente']
  return allowedRoles.includes(authStore.userRole || '')
})

const fetchReport = () => {
  reportsStore.fetchAnnualBillingReport(selectedYear.value, selectedZone.value)
}

onMounted(fetchReport)

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(value)
}

const renderCharts = () => {
  if (!annualReportData.value) return

  // Configuración global de Chart.js para tema oscuro
  Chart.defaults.color = '#9ca3af'
  Chart.defaults.borderColor = 'rgba(75, 85, 99, 0.2)'

  // Destruir gráfico anterior
  if (monthlyTrendChartInstance) {
    monthlyTrendChartInstance.destroy()
  }
  if (zoneDistributionChartInstance) {
    zoneDistributionChartInstance.destroy()
  }

  // Gráfico de Tendencia Mensual
  if (monthlyTrendChartCanvas.value) {
    const labels = [
      'Ene',
      'Feb',
      'Mar',
      'Abr',
      'May',
      'Jun',
      'Jul',
      'Ago',
      'Sep',
      'Oct',
      'Nov',
      'Dic',
    ]
    monthlyTrendChartInstance = new Chart(monthlyTrendChartCanvas.value, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Ingresos Pagados',
            data: annualReportData.value.monthlyTrend,
            borderColor: '#22d3ee', // cyan-400
            backgroundColor: 'rgba(34, 211, 238, 0.1)',
            fill: true,
            tension: 0.4,
            pointBackgroundColor: '#22d3ee',
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (context) => formatCurrency(context.parsed.y ?? 0),
            },
          },
        },
        scales: {
          y: {
            ticks: {
              callback: (value) => {
                const val = Number(value)
                return val >= 1000000
                  ? `$${(val / 1000000).toFixed(1)}M`
                  : `$${(val / 1000).toFixed(0)}k`
              },
            },
          },
        },
      },
    })
  }

  // Gráfico de Distribución por Zona
  if (zoneDistributionChartCanvas.value && annualReportData.value.serviceDistributionByZone) {
    const data = annualReportData.value.serviceDistributionByZone
    const labels = Object.keys(data)
    const values = Object.values(data)

    zoneDistributionChartInstance = new Chart(zoneDistributionChartCanvas.value, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [
          {
            label: 'Servicios por Zona',
            data: values,
            backgroundColor: ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'],
            borderWidth: 0,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '60%',
        plugins: {
          legend: { position: 'right', labels: { boxWidth: 12, usePointStyle: true } },
        },
      },
    })
  }
}

watch(annualReportData, (newData) => {
  if (newData) {
    nextTick(renderCharts)
  }
})
</script>

<template>
  <div class="space-y-6">
    <!-- Toolbar de Filtros -->
    <div
      class="bg-[#151515] p-4 rounded-xl border border-white/10 shadow-lg flex flex-col md:flex-row gap-4 items-end md:items-center justify-between">
      <div class="flex flex-col md:flex-row gap-4 w-full md:w-auto">
        <div>
          <label for="reportYear" class="text-xs font-bold text-gray-500 uppercase mb-1 block">Año</label>
          <div class="relative">
            <select id="reportYear" v-model="selectedYear" class="input-field-dark appearance-none pr-8">
              <option v-for="year in [2025, 2024, 2023]" :key="year">{{ year }}</option>
            </select>
            <div class="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none text-gray-400">
              <i class="fas fa-chevron-down text-xs"></i>
            </div>
          </div>
        </div>

        <div v-if="canFilterByZone">
          <label for="reportZone" class="text-xs font-bold text-gray-500 uppercase mb-1 block">Zona</label>
          <div class="relative">
            <select id="reportZone" v-model="selectedZone" class="input-field-dark appearance-none pr-8 min-w-[180px]">
              <option>Todos</option>
              <option>Norte de Santander</option>
              <option>Valle del Cauca</option>
              <option>Nacionales</option>
            </select>
            <div class="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none text-gray-400">
              <i class="fas fa-chevron-down text-xs"></i>
            </div>
          </div>
        </div>
      </div>

      <button @click="fetchReport"
        class="btn btn-primary bg-[#d60000] hover:bg-red-700 w-full md:w-auto shadow-lg shadow-red-500/20"
        :disabled="loading">
        <i class="fas fa-sync-alt mr-2" :class="{ 'fa-spin': loading }"></i>
        {{ loading ? 'Generando...' : 'Actualizar Reporte' }}
      </button>
    </div>

    <!-- Estados de Carga y Error -->
    <div v-if="loading" class="text-center p-12 bg-[#151515] rounded-xl border border-white/10 border-dashed">
      <i class="fas fa-circle-notch fa-spin text-4xl text-[#d60000]"></i>
      <p class="mt-4 text-gray-400">Analizando datos financieros...</p>
    </div>

    <div v-else-if="error" class="text-center p-8 bg-red-900/20 border border-red-800 rounded-xl">
      <i class="fas fa-exclamation-circle text-4xl text-red-500 mb-2"></i>
      <p class="text-red-300">{{ error }}</p>
    </div>

    <!-- Dashboard Content -->
    <div v-else-if="annualReportData" class="space-y-6 animate-fade-in">
      <!-- KPIs -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <!-- Total Pagado -->
        <div class="bg-[#151515] p-6 rounded-xl border border-white/10 shadow-lg relative overflow-hidden group">
          <div class="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <i class="fas fa-coins text-6xl text-emerald-500"></i>
          </div>
          <h3 class="text-sm font-bold text-gray-400 uppercase tracking-wider">
            Ingresos Totales (Pagado)
          </h3>
          <p class="text-3xl font-bold text-white mt-2">
            {{ formatCurrency(annualReportData.kpis.totalPaid) }}
          </p>
          <div class="mt-4 h-1 w-full bg-white/10 rounded-full overflow-hidden">
            <div class="h-full bg-emerald-500 w-full"></div>
          </div>
        </div>

        <!-- Facturado Pendiente -->
        <div class="bg-[#151515] p-6 rounded-xl border border-white/10 shadow-lg relative overflow-hidden group">
          <div class="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <i class="fas fa-file-invoice-dollar text-6xl text-yellow-500"></i>
          </div>
          <h3 class="text-sm font-bold text-gray-400 uppercase tracking-wider">
            Facturado (Pendiente Pago)
          </h3>
          <p class="text-3xl font-bold text-white mt-2">
            {{ formatCurrency(annualReportData.kpis.totalBilledUnpaid) }}
          </p>
          <div class="mt-4 h-1 w-full bg-white/10 rounded-full overflow-hidden">
            <div class="h-full bg-yellow-500 w-2/3"></div>
          </div>
        </div>

        <!-- Pendiente de Facturar -->
        <div class="bg-[#151515] p-6 rounded-xl border border-white/10 shadow-lg relative overflow-hidden group">
          <div class="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <i class="fas fa-clock text-6xl text-red-500"></i>
          </div>
          <h3 class="text-sm font-bold text-gray-400 uppercase tracking-wider">
            Pendiente de Facturar
          </h3>
          <p class="text-3xl font-bold text-white mt-2">
            {{ formatCurrency(annualReportData.kpis.totalPendingBilling) }}
          </p>
          <div class="mt-4 h-1 w-full bg-white/10 rounded-full overflow-hidden">
            <div class="h-full bg-red-500 w-1/3"></div>
          </div>
        </div>
      </div>

      <!-- Gráficos -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Tendencia Principal -->
        <div class="lg:col-span-2 bg-[#151515] p-6 rounded-xl border border-white/10 shadow-lg">
          <h3 class="font-bold text-gray-200 mb-6 flex items-center gap-2">
            <i class="fas fa-chart-line text-cyan-400"></i> Tendencia de Ingresos Mensuales
          </h3>
          <div class="h-80 relative">
            <canvas ref="monthlyTrendChartCanvas"></canvas>
          </div>
        </div>

        <!-- Distribución Zonas -->
        <div class="bg-[#151515] p-6 rounded-xl border border-white/10 shadow-lg">
          <h3 class="font-bold text-gray-200 mb-6 flex items-center gap-2">
            <i class="fas fa-chart-pie text-purple-400"></i> Distribución por Zona
          </h3>
          <div class="h-64 relative flex justify-center">
            <canvas ref="zoneDistributionChartCanvas"></canvas>
          </div>
        </div>
      </div>

      <!-- Listas Detalladas -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- Top Clientes -->
        <div class="bg-[#151515] rounded-xl border border-white/10 shadow-lg flex flex-col h-96">
          <div class="p-5 border-b border-white/10 bg-[#0a0a0a]/30">
            <h3 class="font-bold text-gray-200 flex items-center gap-2">
              <i class="fas fa-trophy text-yellow-500"></i> Top 10 Clientes (Ingresos)
            </h3>
          </div>
          <div class="flex-grow overflow-y-auto custom-scrollbar p-2">
            <div v-for="(client, index) in annualReportData.topClients" :key="client.clientId"
              class="flex justify-between items-center p-3 hover:bg-white/5 rounded-lg transition-colors border-b border-white/5 last:border-0">
              <div class="flex items-center gap-3">
                <span
                  class="text-xs font-bold bg-gray-700 text-gray-300 w-6 h-6 flex items-center justify-center rounded-full">{{
                    index + 1 }}</span>
                <span class="text-gray-300 text-sm font-medium">{{ client.clientName }}</span>
              </div>
              <span class="font-bold text-white text-sm">{{
                formatCurrency(client.totalPaid)
              }}</span>
            </div>
          </div>
        </div>

        <!-- Rendimiento Técnicos -->
        <div v-if="annualReportData.technicianRates && annualReportData.technicianRates.length > 0"
          class="bg-[#151515] rounded-xl border border-white/10 shadow-lg flex flex-col h-96">
          <div class="p-5 border-b border-white/10 bg-[#0a0a0a]/30">
            <h3 class="font-bold text-gray-200 flex items-center gap-2">
              <i class="fas fa-hard-hat text-orange-500"></i> Eficiencia Técnica (Visitas
              Facturadas)
            </h3>
          </div>
          <div class="flex-grow overflow-y-auto custom-scrollbar p-2">
            <div v-for="tech in annualReportData.technicianRates" :key="tech.technicianId"
              class="p-3 hover:bg-white/5 rounded-lg transition-colors border-b border-white/5 last:border-0">
              <div class="flex justify-between items-center mb-1">
                <span class="text-gray-300 text-sm font-medium">{{ tech.technicianName }}</span>
                <span class="font-bold" :class="tech.complianceRate >= 90
                  ? 'text-green-400'
                  : tech.complianceRate >= 70
                    ? 'text-yellow-400'
                    : 'text-red-400'
                  ">{{ tech.complianceRate }}%</span>
              </div>
              <div class="w-full bg-white/10 rounded-full h-1.5">
                <div class="bg-indigo-500 h-1.5 rounded-full" :style="{ width: tech.complianceRate + '%' }"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
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
