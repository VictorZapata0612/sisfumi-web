<script setup lang="ts">
import { ref, watch, computed, nextTick } from 'vue'
import { useTechniciansStore, type Technician } from '@/stores/technicians'
import Chart from 'chart.js/auto'

const props = defineProps<{
  show: boolean
  technicianId: string | null
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'edit', technician: Technician): void
}>()

const store = useTechniciansStore()
const currentProfileDate = ref(new Date())
let workloadChartInstance: Chart | null = null

const googleCalendarColors: Record<string, string> = {
  '1': '#7986cb',
  '2': '#33b679',
  '3': '#8e24aa',
  '4': '#e67c73',
  '5': '#f6c026',
  '6': '#f5511d',
  '7': '#039be5',
  '8': '#616161',
  '9': '#3f51b5',
  '10': '#0b8043',
  '11': '#d60000',
}

const loadProfileData = async () => {
  if (!props.technicianId) return
  await store.fetchTechnicianProfile(
    props.technicianId,
    currentProfileDate.value.getMonth(),
    currentProfileDate.value.getFullYear(),
  )
  nextTick(() => {
    renderWorkloadChart()
  })
}

watch(
  () => props.show,
  (newVal) => {
    if (newVal) {
      currentProfileDate.value = new Date()
      loadProfileData()
    }
  },
)

const changeMonth = (offset: number) => {
  const newDate = new Date(currentProfileDate.value)
  newDate.setMonth(newDate.getMonth() + offset)
  currentProfileDate.value = newDate
  loadProfileData()
}

const renderWorkloadChart = () => {
  const ctx = document.getElementById('workloadChart') as HTMLCanvasElement
  if (!ctx || !store.selectedProfile) return

  if (workloadChartInstance) {
    workloadChartInstance.destroy()
  }

  // Configuración de estilo para el gráfico
  Chart.defaults.color = '#9ca3af'
  Chart.defaults.font.family = "'Inter', sans-serif"

  workloadChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Semana 1', 'Semana 2', 'Semana 3', 'Semana 4', 'Semana 5'],
      datasets: [
        {
          label: 'Visitas',
          data: store.selectedProfile.workload,
          backgroundColor: 'rgba(56, 189, 248, 0.6)',
          borderColor: '#38bdf8',
          borderWidth: 2,
          borderRadius: 4,
          hoverBackgroundColor: '#38bdf8',
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#1f2937',
          titleColor: '#f3f4f6',
          bodyColor: '#38bdf8',
          padding: 10,
          displayColors: false
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: 'rgba(75, 85, 99, 0.2)' },
          ticks: { stepSize: 1 }
        },
        x: {
          grid: { display: false }
        },
      },
    },
  })
}

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: '2-digit'
  })
}
</script>

<template>
  <div v-if="show" class="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6" role="dialog"
    aria-modal="true">
    <!-- Backdrop -->
    <div class="fixed inset-0 bg-[#0a0a0a]/80 backdrop-blur-sm transition-opacity" @click="emit('close')"></div>

    <!-- Modal Panel -->
    <div
      class="relative bg-[#151515] rounded-xl border border-white/10 shadow-2xl w-full max-w-4xl flex flex-col max-h-[90vh] overflow-hidden transform transition-all animate-fade-in">

      <!-- Loading Overlay -->
      <div v-if="store.loadingProfile"
        class="absolute inset-0 z-10 bg-[#151515]/60 backdrop-blur-md flex flex-col items-center justify-center">
        <i class="fas fa-circle-notch fa-spin text-4xl text-indigo-500 mb-4"></i>
        <p class="text-gray-300 font-medium">Consultando historial del técnico...</p>
      </div>

      <template v-if="store.selectedProfile">
        <!-- Header Section -->
        <header class="p-6 bg-[#0a0a0a]/50 border-b border-white/10 flex flex-col sm:flex-row items-center gap-6">
          <div
            class="w-20 h-20 rounded-2xl shadow-lg flex-shrink-0 flex items-center justify-center text-white text-3xl font-bold border-2 border-white/10"
            :style="{
              backgroundColor: googleCalendarColors[store.selectedProfile.technician.googleColorId || '8'],
            }">
            {{ store.selectedProfile.technician.nombreCompleto.charAt(0) }}
          </div>

          <div class="flex-grow text-center sm:text-left">
            <h2 class="text-2xl sm:text-3xl font-bold text-white leading-tight">
              {{ store.selectedProfile.technician.nombreCompleto }}
            </h2>
            <div class="flex flex-wrap justify-center sm:justify-start items-center gap-3 mt-1">
              <span class="text-[#d60000] font-semibold flex items-center gap-1">
                <i class="fas fa-map-marker-alt text-xs"></i>
                {{ store.selectedProfile.technician.zona }}
              </span>
              <span class="text-gray-500 hidden sm:inline">•</span>
              <span class="text-gray-400 text-sm italic">{{ store.selectedProfile.technician.email }}</span>
            </div>
          </div>

          <!-- Controls -->
          <div class="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
            <div class="flex items-center bg-[#0a0a0a] rounded-lg p-1 border border-white/10 w-full sm:w-auto">
              <button @click="changeMonth(-1)" class="p-2 hover:text-white text-gray-400 transition-colors">
                <i class="fas fa-chevron-left text-xs"></i>
              </button>
              <span class="px-4 text-xs font-bold uppercase tracking-wider text-gray-200 min-w-[140px] text-center">
                {{ currentProfileDate.toLocaleString('es-ES', { month: 'long', year: 'numeric' }) }}
              </span>
              <button @click="changeMonth(1)" class="p-2 hover:text-white text-gray-400 transition-colors">
                <i class="fas fa-chevron-right text-xs"></i>
              </button>
            </div>

            <button @click="emit('edit', store.selectedProfile!.technician)"
              class="btn btn-secondary w-full sm:w-auto flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 border-white/10">
              <i class="fas fa-user-edit text-sm"></i>
              <span>Editar</span>
            </button>

            <button @click="emit('close')" class="sm:hidden btn btn-gray w-full">Cerrar</button>
          </div>
        </header>

        <!-- Main Scrollable Content -->
        <div class="flex-grow overflow-y-auto custom-scrollbar p-6 space-y-8">

          <!-- Performance & Workload Grid -->
          <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">

            <!-- Performance Section -->
            <div class="lg:col-span-5 space-y-4">
              <h3 class="text-sm font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                <i class="fas fa-chart-line text-[#d60000]"></i> Rendimiento Mensual
              </h3>
              <div class="grid grid-cols-3 gap-3">
                <div class="bg-white/5 p-4 rounded-xl border border-white/10 flex flex-col items-center text-center">
                  <span class="text-2xl font-bold text-sky-400 leading-none mb-1">
                    {{ store.selectedProfile.kpis.assigned }}
                  </span>
                  <span class="text-[10px] text-gray-500 font-bold uppercase">Asignadas</span>
                </div>
                <div class="bg-white/5 p-4 rounded-xl border border-white/10 flex flex-col items-center text-center">
                  <span class="text-2xl font-bold text-emerald-400 leading-none mb-1">
                    {{ store.selectedProfile.kpis.completed }}
                  </span>
                  <span class="text-[10px] text-gray-500 font-bold uppercase">Completas</span>
                </div>
                <div
                  class="bg-[#0a0a0a]/50 p-4 rounded-xl border border-[#d60000]/30 flex flex-col items-center text-center">
                  <span class="text-2xl font-bold text-[#d60000] leading-none mb-1">
                    {{ store.selectedProfile.kpis.rate }}%
                  </span>
                  <span class="text-[10px] text-gray-500 font-bold uppercase">Eficiencia</span>
                </div>
              </div>

              <!-- Extra Info -->
              <div class="bg-[#0a0a0a]/20 p-4 rounded-xl border border-white/10 border-dashed space-y-3">
                <div class="flex justify-between items-center text-sm">
                  <span class="text-gray-400">Total Programadas</span>
                  <span class="text-white font-medium">{{ store.selectedProfile.kpis.assigned }}</span>
                </div>
                <div class="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
                  <div class="bg-[#d60000] h-full rounded-full"
                    :style="{ width: store.selectedProfile.kpis.rate + '%' }"></div>
                </div>
              </div>
            </div>

            <!-- Workload Chart -->
            <div class="lg:col-span-7">
              <h3 class="text-sm font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2 mb-4">
                <i class="fas fa-tasks text-sky-400"></i> Carga de Trabajo por Semana
              </h3>
              <div class="bg-white/5 p-4 rounded-xl border border-white/10 h-52 relative">
                <canvas id="workloadChart"></canvas>
              </div>
            </div>
          </div>

          <!-- Lists Section -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-8">

            <!-- Proximas -->
            <section class="flex flex-col h-80 bg-[#0a0a0a]/30 rounded-xl border border-white/10 overflow-hidden">
              <div
                class="p-4 bg-[#151515] border-b border-white/10 flex justify-between items-center sticky top-0 z-10">
                <h4 class="text-sm font-bold text-sky-400 uppercase flex items-center gap-2">
                  <i class="fas fa-calendar-alt"></i> Próximas Asignaciones
                </h4>
                <span class="text-xs text-gray-500 font-mono">{{ store.selectedProfile.upcomingVisits.length }}</span>
              </div>
              <div class="flex-grow overflow-y-auto custom-scrollbar p-3 space-y-2">
                <div v-if="store.selectedProfile.upcomingVisits.length === 0"
                  class="flex flex-col items-center justify-center h-full text-gray-600 opacity-50">
                  <i class="fas fa-coffee text-2xl mb-2"></i>
                  <p class="text-xs">Sin pendientes próximamente</p>
                </div>
                <div v-for="visit in store.selectedProfile.upcomingVisits" :key="visit.id"
                  class="bg-[#151515]/80 border border-white/10 p-3 rounded-lg flex justify-between items-center group hover:border-[#d60000]/50 transition-colors">
                  <div class="min-w-0 pr-2">
                    <p
                      class="font-bold text-gray-200 text-sm truncate leading-tight group-hover:text-white transition-colors">
                      {{ visit.nombre_cliente }}</p>
                    <p class="text-[10px] text-[#d60000] font-bold uppercase mt-0.5 tracking-tight">{{ visit.tipo_visita
                      }}</p>
                  </div>
                  <div class="text-right flex-shrink-0">
                    <p class="text-xs text-gray-300 font-mono font-bold">{{ formatDate(visit.fecha_visita) }}</p>
                    <p class="text-[10px] text-gray-500 italic">Programada</p>
                  </div>
                </div>
              </div>
            </section>

            <!-- Historial -->
            <section class="flex flex-col h-80 bg-[#0a0a0a]/30 rounded-xl border border-white/10 overflow-hidden">
              <div
                class="p-4 bg-[#151515] border-b border-white/10 flex justify-between items-center sticky top-0 z-10">
                <h4 class="text-sm font-bold text-emerald-400 uppercase flex items-center gap-2">
                  <i class="fas fa-history"></i> Historial Reciente
                </h4>
                <span class="text-xs text-gray-500 font-mono">{{ store.selectedProfile.recentHistory.length }}</span>
              </div>
              <div class="flex-grow overflow-y-auto custom-scrollbar p-3 space-y-2">
                <div v-if="store.selectedProfile.recentHistory.length === 0"
                  class="flex flex-col items-center justify-center h-full text-gray-600 opacity-50">
                  <i class="fas fa-search text-2xl mb-2"></i>
                  <p class="text-xs">Sin registros recientes</p>
                </div>
                <div v-for="visit in store.selectedProfile.recentHistory" :key="visit.id"
                  class="bg-emerald-900/10 border border-emerald-900/30 p-3 rounded-lg flex justify-between items-center">
                  <div class="min-w-0 pr-2">
                    <p class="font-bold text-gray-300 text-sm truncate leading-tight">{{ visit.nombre_cliente }}</p>
                    <div class="flex items-center gap-1.5 mt-0.5">
                      <i class="fas fa-check-circle text-emerald-500 text-[10px]"></i>
                      <p class="text-[10px] text-emerald-400 font-bold uppercase tracking-tight">{{ visit.tipo_visita }}
                      </p>
                    </div>
                  </div>
                  <div class="text-right flex-shrink-0">
                    <p class="text-xs text-gray-400 font-mono">{{ formatDate(visit.fecha_visita) }}</p>
                    <p class="text-[10px] text-emerald-600 font-bold uppercase">Realizada</p>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>

        <!-- Desktop Close Button (Floating corner) -->
        <button @click="emit('close')"
          class="hidden sm:flex absolute top-4 right-4 text-gray-500 hover:text-white transition-colors bg-[#0a0a0a]/50 p-2 rounded-full border border-white/10 hover:bg-[#151515]">
          <i class="fas fa-times"></i>
        </button>

      </template>
    </div>
  </div>
</template>

<style scoped>
.animate-fade-in {
  animation: fadeIn 0.3s ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: scale(0.95);
  }

  to {
    opacity: 1;
    transform: scale(1);
  }
}

.custom-scrollbar::-webkit-scrollbar {
  width: 5px;
}

.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
  background-color: #4b5563;
  border-radius: 10px;
}
</style>
