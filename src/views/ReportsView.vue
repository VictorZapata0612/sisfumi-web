<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue'
import { httpsCallable } from 'firebase/functions'
import { functions } from '@/firebase/config'
import { useSettingsStore } from '@/stores/settings'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'
import Chart from 'chart.js/auto'
import ChartDataLabels from 'chartjs-plugin-datalabels'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

defineOptions({ name: 'ReportsView' })

const settingsStore = useSettingsStore()
const authStore = useAuthStore()
const { showToast } = useToast()

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(value)
}

// --- Estado del Componente ---
const loading = ref(false)
const reportData = ref<any>(null)
const selectedReport = ref('annualBilling')
const selectedYear = ref(new Date().getFullYear())
const selectedZone = ref('Todos')

// --- Referencias a los Elementos Canvas ---
const monthlyRevenueCanvas = ref<HTMLCanvasElement | null>(null)
const topClientsCanvas = ref<HTMLCanvasElement | null>(null)
const serviceDistributionCanvas = ref<HTMLCanvasElement | null>(null)

let chartInstances: Chart[] = []

// --- Lógica del Componente ---
onMounted(() => {
  settingsStore.fetchBusinessData()
  Chart.register(ChartDataLabels)
})

const years = computed(() => {
  const currentYear = new Date().getFullYear()
  return Array.from({ length: 5 }, (_, i) => currentYear - i)
})

const generateReport = async () => {
  loading.value = true
  reportData.value = null
  destroyCharts()

  try {
    const getAnnualBillingReport = httpsCallable(functions, 'getAnnualBillingReport')
    const result = await getAnnualBillingReport({
      year: selectedYear.value,
      zone: selectedZone.value,
    })

    if (!result.data) throw new Error('No se recibieron datos del servidor.')

    reportData.value = result.data

    // ✅ CORRECCIÓN CRÍTICA:
    // 1. Apagamos el loading PRIMERO para que el v-else muestre los <canvas> en el DOM.
    loading.value = false

    // 2. Esperamos a que Vue actualice el DOM y los <canvas> existan.
    await nextTick()

    // 3. Ahora sí renderizamos los gráficos.
    renderAllCharts(result.data)
  } catch (error: any) {
    loading.value = false // Aseguramos apagar el loading si hay error
    console.error(error)
    showToast({
      title: 'Error al generar reporte',
      message: error.message || 'No se pudieron cargar los datos.',
      type: 'error',
    })
  }
}

const destroyCharts = () => {
  chartInstances.forEach((chart) => chart.destroy())
  chartInstances = []
}

const renderAllCharts = (data: any) => {
  if (!data) return

  // Configuración global para el tema oscuro
  Chart.defaults.color = '#9ca3af' // gray-400
  Chart.defaults.borderColor = 'rgba(255, 255, 255, 0.1)' // border-white/10

  // 1. Gráfico de Tendencia Mensual
  if (monthlyRevenueCanvas.value) {
    const monthlyTrend = data.monthlyTrend || []
    const monthLabels = [
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
    const dataPoints = Array.isArray(monthlyTrend)
      ? monthlyTrend
      : monthLabels.map((_, i) => monthlyTrend[i + 1] || 0)

    chartInstances.push(
      new Chart(monthlyRevenueCanvas.value, {
        type: 'line',
        data: {
          labels: monthLabels,
          datasets: [
            {
              label: `Ingresos Pagados ${selectedYear.value}`,
              data: dataPoints,
              backgroundColor: (context) => {
                const ctx = context.chart.ctx
                const gradient = ctx.createLinearGradient(0, 0, 0, 400)
                gradient.addColorStop(0, 'rgba(56, 189, 248, 0.5)') // sky-400
                gradient.addColorStop(1, 'rgba(56, 189, 248, 0.0)')
                return gradient
              },
              borderColor: '#38bdf8', // sky-400
              borderWidth: 2,
              pointBackgroundColor: '#0ea5e9',
              pointBorderColor: '#fff',
              pointHoverBackgroundColor: '#fff',
              pointHoverBorderColor: '#0ea5e9',
              tension: 0.4,
              fill: true,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              mode: 'index',
              intersect: false,
              callbacks: {
                label: function (context) {
                  let label = context.dataset.label || ''
                  if (label) {
                    label += ': '
                  }
                  if (context.parsed.y !== null) {
                    label += new Intl.NumberFormat('es-CO', {
                      style: 'currency',
                      currency: 'COP',
                      minimumFractionDigits: 0,
                    }).format(context.parsed.y)
                  }
                  return label
                },
              },
            },
            datalabels: { display: false },
          },
          scales: {
            y: {
              beginAtZero: true,
              ticks: {
                callback: function (value) {
                  return new Intl.NumberFormat('es-CO', {
                    notation: 'compact',
                    compactDisplay: 'short',
                  }).format(Number(value))
                },
              },
            },
          },
        },
      }),
    )
  }

  // 2. Gráfico Top Clientes
  if (topClientsCanvas.value) {
    const topClients = data.topClients || []
    chartInstances.push(
      new Chart(topClientsCanvas.value, {
        type: 'bar',
        data: {
          labels: topClients.map((c: any) => c.clientName),
          datasets: [
            {
              label: 'Facturación Total',
              data: topClients.map((c: any) => c.totalPaid),
              backgroundColor: '#8b5cf6', // violet-500
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
            datalabels: {
              color: '#fff',
              anchor: 'end',
              align: 'end',
              offset: -4,
              formatter: (value) =>
                new Intl.NumberFormat('es-CO', { notation: 'compact' }).format(value),
            },
          },
          scales: {
            x: { display: false },
            y: { grid: { display: false } },
          },
        },
      }),
    )
  }

  // 3. Distribución por Servicio
  if (serviceDistributionCanvas.value) {
    const distribution = data.serviceDistributionByZone || {}
    const labels = Object.keys(distribution)
    const values = Object.values(distribution)

    chartInstances.push(
      new Chart(serviceDistributionCanvas.value, {
        type: 'doughnut',
        data: {
          labels: labels as string[],
          datasets: [
            {
              data: values as number[],
              backgroundColor: ['#10b981', '#f59e0b', '#38bdf8', '#8b5cf6', '#ec4899'],
              borderWidth: 0,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '70%',
          plugins: {
            legend: {
              position: 'right',
              labels: { usePointStyle: true, boxWidth: 8 },
            },
            datalabels: { display: false },
          },
        },
      }),
    )
  }
}

const exportReportAsPDF = async () => {
  if (!reportData.value) {
    showToast({ title: 'Sin Datos', message: 'Primero debe generar un reporte.', type: 'info' })
    return
  }

  const exportBtn = document.getElementById('exportReportBtn') as HTMLButtonElement
  if (exportBtn) {
    exportBtn.disabled = true
    exportBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Generando...'
  }

  try {
    const pdf = new jsPDF({ orientation: 'p', unit: 'pt', format: 'a4' })

    // Título
    pdf.setFontSize(22)
    pdf.setTextColor(40, 40, 40)
    pdf.text(`Reporte Anual de Facturación - ${selectedYear.value}`, 40, 60)

    pdf.setFontSize(10)
    pdf.setTextColor(100, 100, 100)
    pdf.text(`Generado el: ${new Date().toLocaleDateString()}`, 40, 75)

    // Tabla KPI
    autoTable(pdf, {
      startY: 90,
      head: [['Indicador', 'Valor']],
      body: [
        ['Pagado Anual', `$${reportData.value.kpis.totalPaid.toLocaleString('es-CO')}`],
        [
          'Pendiente de Pago',
          `$${reportData.value.kpis.totalBilledUnpaid.toLocaleString('es-CO')}`,
        ],
        [
          'Pendiente de Facturar',
          `$${reportData.value.kpis.totalPendingBilling.toLocaleString('es-CO')}`,
        ],
      ],
      theme: 'striped',
      headStyles: { fillColor: [220, 38, 38] }, // Red header
    })

    // Función helper para gráficos
    const addChartToPdf = async (
      canvasRef: HTMLCanvasElement | null,
      title: string,
      yOffset = 0,
    ) => {
      if (canvasRef) {
        let finalY = (pdf as any).lastAutoTable ? (pdf as any).lastAutoTable.finalY : 150
        finalY += yOffset + 40

        if (finalY > 700) {
          pdf.addPage()
          finalY = 60
        }

        pdf.setFontSize(14)
        pdf.setTextColor(0, 0, 0)
        pdf.text(title, 40, finalY)

        const context = canvasRef.getContext('2d')
        if (context) {
          context.save()
          context.globalCompositeOperation = 'destination-over'
          context.fillStyle = 'white'
          context.fillRect(0, 0, canvasRef.width, canvasRef.height)
          context.restore()
        }

        const chartImage = canvasRef.toDataURL('image/png', 1.0)
        pdf.addImage(chartImage, 'PNG', 40, finalY + 10, 515, 200)
          ; (pdf as any).lastAutoTable.finalY = finalY + 220
      }
    }

    await addChartToPdf(monthlyRevenueCanvas.value, 'Tendencia de Ingresos Pagados')
    await addChartToPdf(topClientsCanvas.value, 'Top Clientes por Facturación', 20)

    pdf.save(`Reporte_Anual_${selectedYear.value}.pdf`)
    showToast({ title: 'PDF Generado', message: 'El reporte se ha descargado.', type: 'success' })
  } catch (e: any) {
    console.error(e)
    showToast({ title: 'Error PDF', message: 'No se pudo generar el PDF.', type: 'error' })
  } finally {
    if (exportBtn) {
      exportBtn.disabled = false
      exportBtn.innerHTML = '<i class="fas fa-file-pdf mr-2"></i>Exportar PDF'
    }
  }
}
</script>

<template>
  <div class="h-full bg-[#0a0a0a] text-gray-100 flex flex-col p-4 md:p-6 overflow-hidden">
    <!-- Header -->
    <header class="flex-shrink-0 mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
      <div>
        <h2 class="text-2xl md:text-3xl font-bold text-white flex items-center gap-2">
          <i class="fas fa-chart-pie text-[#d60000]"></i>
          Reportes
        </h2>
        <p class="text-sm text-gray-400 mt-1">Análisis financiero y operativo</p>
      </div>
    </header>

    <!-- Panel de Control y Contenido -->
    <div class="flex-grow flex flex-col bg-[#151515] rounded-xl border border-white/10 shadow-xl overflow-hidden">
      <!-- Barra de Filtros -->
      <div class="p-4 md:p-6 border-b border-white/10 bg-[#0a0a0a]/50">
        <div class="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <!-- Tipo de Reporte -->
          <div class="md:col-span-1">
            <label class="block text-xs font-bold text-gray-400 uppercase mb-1">Reporte</label>
            <div class="relative">
              <select v-model="selectedReport"
                class="w-full bg-[#0a0a0a] border border-white/10 rounded-lg py-2.5 px-3 text-white focus:ring-2 focus:ring-[#d60000] appearance-none cursor-pointer">
                <option value="annualBilling">Facturación Anual</option>
              </select>
              <i class="fas fa-chevron-down absolute right-3 top-3 text-gray-400 text-xs pointer-events-none"></i>
            </div>
          </div>

          <!-- Año -->
          <div>
            <label class="block text-xs font-bold text-gray-400 uppercase mb-1">Año</label>
            <div class="relative">
              <select v-model="selectedYear"
                class="w-full bg-[#0a0a0a] border border-white/10 rounded-lg py-2.5 px-3 text-white focus:ring-2 focus:ring-[#d60000] appearance-none cursor-pointer">
                <option v-for="year in years" :key="year" :value="year">{{ year }}</option>
              </select>
              <i class="fas fa-chevron-down absolute right-3 top-3 text-gray-400 text-xs pointer-events-none"></i>
            </div>
          </div>

          <!-- Zona -->
          <div v-if="authStore.userRole !== 'Coordinador'">
            <label class="block text-xs font-bold text-gray-400 uppercase mb-1">Zona</label>
            <div class="relative">
              <select v-model="selectedZone"
                class="w-full bg-[#0a0a0a] border border-white/10 rounded-lg py-2.5 px-3 text-white focus:ring-2 focus:ring-[#d60000] appearance-none cursor-pointer">
                <option value="Todos">Todas</option>
                <option v-for="zone in settingsStore.businessData.businessZones" :key="zone.name" :value="zone.name">
                  {{ zone.name }}
                </option>
              </select>
              <i class="fas fa-chevron-down absolute right-3 top-3 text-gray-400 text-xs pointer-events-none"></i>
            </div>
          </div>

          <!-- Botones -->
          <div class="flex gap-2">
            <button @click="generateReport" :disabled="loading"
              class="btn btn-primary bg-[#d60000] hover:bg-red-700 flex-grow shadow-lg flex items-center justify-center">
              <i v-if="loading" class="fas fa-spinner fa-spin mr-2"></i>
              <i v-else class="fas fa-sync-alt mr-2"></i>
              Generar
            </button>
            <button id="exportReportBtn" @click="exportReportAsPDF" :disabled="!reportData"
              class="btn btn-secondary bg-white/5 hover:bg-white/10 flex items-center justify-center px-4"
              title="Descargar PDF">
              <i class="fas fa-file-pdf"></i>
            </button>
          </div>
        </div>
      </div>

      <!-- Área de Visualización -->
      <div class="flex-grow overflow-y-auto custom-scrollbar p-4 md:p-6 relative">
        <!-- Estado Carga -->
        <div v-if="loading" class="absolute inset-0 flex flex-col items-center justify-center bg-[#151515]/90 z-20">
          <i class="fas fa-circle-notch fa-spin text-5xl text-[#d60000] mb-4"></i>
          <p class="text-gray-300 animate-pulse">Procesando datos del negocio...</p>
        </div>

        <!-- Estado Vacío -->
        <div v-else-if="!reportData" class="h-full flex flex-col items-center justify-center text-gray-500 opacity-60">
          <i class="fas fa-chart-bar text-6xl mb-4"></i>
          <p class="text-lg">Selecciona parámetros y genera un reporte.</p>
        </div>

        <!-- Resultados -->
        <div v-else class="space-y-6 animate-fade-in">
          <!-- Tarjetas KPI -->
          <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div
              class="bg-white/5 p-5 rounded-xl border border-white/10 flex flex-col items-center justify-center text-center relative overflow-hidden">
              <div class="absolute inset-0 bg-green-500/5"></div>
              <p class="text-xs font-bold text-gray-400 uppercase tracking-wider z-10">
                Ingresos Totales (Pagado)
              </p>
              <p class="text-3xl font-bold text-green-400 mt-2 z-10">
                {{ formatCurrency(reportData.kpis.totalPaid) }}
              </p>
            </div>

            <div
              class="bg-white/5 p-5 rounded-xl border border-white/10 flex flex-col items-center justify-center text-center relative overflow-hidden">
              <div class="absolute inset-0 bg-yellow-500/5"></div>
              <p class="text-xs font-bold text-gray-400 uppercase tracking-wider z-10">
                Por Cobrar (Facturado)
              </p>
              <p class="text-3xl font-bold text-yellow-400 mt-2 z-10">
                {{ formatCurrency(reportData.kpis.totalBilledUnpaid) }}
              </p>
            </div>

            <div
              class="bg-white/5 p-5 rounded-xl border border-white/10 flex flex-col items-center justify-center text-center relative overflow-hidden">
              <div class="absolute inset-0 bg-cyan-500/5"></div>
              <p class="text-xs font-bold text-gray-400 uppercase tracking-wider z-10">
                Pendiente de Facturar
              </p>
              <p class="text-3xl font-bold text-cyan-400 mt-2 z-10">
                {{ formatCurrency(reportData.kpis.totalPendingBilling) }}
              </p>
            </div>
          </div>

          <!-- Gráficos -->
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <!-- Tendencia -->
            <div class="bg-white/5 p-4 rounded-xl border border-white/10 flex flex-col">
              <h3 class="text-sm font-bold text-gray-300 mb-4 ml-1 flex items-center">
                <i class="fas fa-chart-line mr-2 text-blue-400"></i> Tendencia Mensual
              </h3>
              <div class="flex-grow min-h-[300px] relative">
                <canvas ref="monthlyRevenueCanvas"></canvas>
              </div>
            </div>

            <!-- Top Clientes -->
            <div class="bg-white/5 p-4 rounded-xl border border-white/10 flex flex-col">
              <h3 class="text-sm font-bold text-gray-300 mb-4 ml-1 flex items-center">
                <i class="fas fa-trophy mr-2 text-violet-400"></i> Top Clientes
              </h3>
              <div class="flex-grow min-h-[300px] relative">
                <canvas ref="topClientsCanvas"></canvas>
              </div>
            </div>

            <!-- Distribución (Opcional - Full Width en Móvil) -->
            <div
              class="lg:col-span-2 bg-white/5 p-4 rounded-xl border border-white/10 flex flex-col md:flex-row items-center gap-6">
              <div class="w-full md:w-1/2 min-h-[250px] relative">
                <h3 class="text-sm font-bold text-gray-300 mb-4 absolute top-0 left-0">
                  <i class="fas fa-chart-pie mr-2 text-emerald-400"></i> Distribución
                </h3>
                <div class="h-full pt-8">
                  <canvas ref="serviceDistributionCanvas"></canvas>
                </div>
              </div>
              <div class="w-full md:w-1/2 text-sm text-gray-400">
                <h4 class="font-bold text-white mb-2">Resumen Operativo</h4>
                <p>
                  El gráfico muestra la distribución porcentual de los ingresos. Utilice estos datos
                  para identificar las zonas o servicios de mayor rentabilidad.
                </p>
                <ul class="mt-4 space-y-2">
                  <li class="flex items-center gap-2">
                    <div class="w-3 h-3 bg-emerald-500 rounded-full"></div>
                    Mayor volumen
                  </li>
                  <li class="flex items-center gap-2">
                    <div class="w-3 h-3 bg-amber-500 rounded-full"></div>
                    Volumen medio
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
@keyframes fade-in {
  from {
    opacity: 0;
    transform: translateY(10px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-fade-in {
  animation: fade-in 0.5s ease-out forwards;
}
</style>
