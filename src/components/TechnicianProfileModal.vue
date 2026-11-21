<script setup lang="ts">
import { ref, watch, nextTick, onUnmounted } from 'vue'
import { useTechniciansStore, type Technician } from '@/stores/technicians'
import Chart from 'chart.js/auto'

const props = defineProps<{
  show: boolean
  technicianId: string | null
  canEdit?: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'edit', technician: Technician): void
}>()

const store = useTechniciansStore()
const currentProfileDate = ref(new Date())
let workloadChartInstance: Chart | null = null
const workloadCanvas = ref<HTMLCanvasElement>()
const profileTab = ref<'summary' | 'upcoming' | 'history'>('summary')
const tabs = [
  { id: 'summary', label: 'Rendimiento' },
  { id: 'upcoming', label: 'Asignaciones' },
  { id: 'history', label: 'Historial' },
] as const

function destroyChart() {
  workloadChartInstance?.destroy()
  workloadChartInstance = null
}
onUnmounted(destroyChart)
watch(profileTab, () => nextTick(renderWorkloadChart))


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
      profileTab.value = 'summary'
      loadProfileData()
    } else destroyChart()
  },
)

const changeMonth = (offset: number) => {
  const newDate = new Date(currentProfileDate.value)
  newDate.setDate(1)
  newDate.setMonth(newDate.getMonth() + offset)
  currentProfileDate.value = newDate
  loadProfileData()
}

const renderWorkloadChart = () => {
  destroyChart()
  const ctx = workloadCanvas.value
  if (!ctx || !store.selectedProfile || !props.show || profileTab.value !== 'summary') return
  const theme = getComputedStyle(ctx)
  const textColor = theme.getPropertyValue('--shell-muted').trim()
  const gridColor = theme.getPropertyValue('--shell-border').trim()

  workloadChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Semana 1', 'Semana 2', 'Semana 3', 'Semana 4', 'Semana 5'],
      datasets: [
        {
          label: 'Visitas',
          data: store.selectedProfile.workload,
          backgroundColor: 'rgba(199, 0, 12, 0.72)',
          borderColor: '#c7000c',
          borderWidth: 2,
          borderRadius: 4,
          hoverBackgroundColor: '#c7000c',
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
          bodyColor: '#c7000c',
          padding: 10,
          displayColors: false
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: gridColor },
          ticks: { stepSize: 1, color: textColor }
        },
        x: {
          grid: { display: false }, ticks: { color: textColor }
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
    aria-modal="true" aria-label="Ficha de técnico" @keydown.esc.stop="emit('close')">
    <!-- Backdrop -->
    <div class="fixed inset-0 bg-[#0a0a0a]/80 backdrop-blur-sm transition-opacity" @click="emit('close')"></div>

    <!-- Modal Panel -->
    <div
      class="relative bg-[var(--shell-surface)] rounded-xl border border-[var(--shell-border)] shadow-2xl w-full max-w-5xl flex flex-col max-h-[calc(100dvh-2rem)] overflow-hidden transform transition-all animate-fade-in">

      <!-- Loading Overlay -->
      <div v-if="store.loadingProfile"
        class="flex min-h-48 flex-col items-center justify-center">
        <i class="fas fa-circle-notch fa-spin text-4xl text-[var(--tech-accent)] mb-4"></i>
        <p class="text-[var(--shell-muted)] font-medium">Consultando historial del técnico...</p>
      </div>

      <!-- Error State -->
      <div v-else-if="store.profileError && !store.selectedProfile"
        class="flex min-h-48 flex-col items-center justify-center gap-4 p-6">
        <i class="fas fa-exclamation-triangle text-4xl text-red-400"></i>
        <div class="text-center">
          <p class="text-[var(--tech-accent)] font-medium mb-2">No se pudo cargar el perfil</p>
          <p class="text-[var(--shell-muted)] text-sm">{{ store.profileError }}</p>
        </div>
        <button @click="loadProfileData()" type="button" class="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors">
          Reintentar
        </button>
        <button type="button" class="text-sm hover:underline" @click="emit('close')">Cerrar ficha</button>
      </div>

      <template v-else-if="store.selectedProfile">
        <!-- Header Section -->
        <header class="tech-profile-header flex shrink-0 flex-wrap items-center gap-3 p-4 sm:p-5">
          <div
            class="w-12 h-12 rounded-xl flex-shrink-0 flex items-center justify-center text-white text-xl font-bold border-2 border-[var(--shell-border)]"
            :style="{
              backgroundColor: googleCalendarColors[store.selectedProfile.technician.googleColorId || '8'],
            }">
            {{ store.selectedProfile.technician.nombreCompleto.charAt(0) }}
          </div>

          <div class="min-w-0 flex-1">
            <h2 class="break-words text-xl font-extrabold leading-tight sm:text-2xl">
              {{ store.selectedProfile.technician.nombreCompleto }}
            </h2>
            <div class="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
              <span class="text-[#d60000] font-semibold flex items-center gap-1">
                <i class="fas fa-map-marker-alt text-xs"></i>
                {{ store.selectedProfile.technician.zona }}
              </span>
              <a v-if="store.selectedProfile.technician.email" :href="'mailto:' + store.selectedProfile.technician.email" class="text-sm hover:underline">{{ store.selectedProfile.technician.email }}</a>
              <a v-if="store.selectedProfile.technician.telefono" :href="'tel:' + store.selectedProfile.technician.telefono" class="text-sm hover:underline">{{ store.selectedProfile.technician.telefono }}</a>
            </div>
          </div>

          <!-- Controls -->
          <div class="flex flex-wrap items-center gap-2">
            <div class="flex items-center bg-[var(--shell-input)] rounded-lg p-1 border border-[var(--shell-border)] w-full sm:w-auto">
              <button type="button" aria-label="Mes anterior" @click="changeMonth(-1)" class="p-2 hover:text-[var(--shell-text)] text-[var(--shell-muted)] transition-colors">
                <i class="fas fa-chevron-left text-xs"></i>
              </button>
              <span class="px-4 text-xs font-bold uppercase tracking-wider text-[var(--shell-muted)] min-w-[140px] text-center">
                {{ currentProfileDate.toLocaleString('es-ES', { month: 'long', year: 'numeric' }) }}
              </span>
              <button type="button" aria-label="Mes siguiente" @click="changeMonth(1)" class="p-2 hover:text-[var(--shell-text)] text-[var(--shell-muted)] transition-colors">
                <i class="fas fa-chevron-right text-xs"></i>
              </button>
            </div>

            <button v-if="canEdit" type="button" @click="emit('edit', store.selectedProfile!.technician)"
              class="btn btn-secondary w-full sm:w-auto flex items-center justify-center gap-2 bg-[var(--shell-input)] hover:bg-[var(--shell-input)] border-[var(--shell-border)]">
              <i class="fas fa-user-edit text-sm"></i>
              <span>Editar</span>
            </button>

            <button @click="emit('close')" class="px-3 py-2 text-sm font-semibold" aria-label="Cerrar ficha">✕</button>
          </div>
        </header>

        <nav class="tech-profile-tabs flex shrink-0 gap-1 px-3" aria-label="Secciones de la ficha">
          <button v-for="tab in tabs" :key="tab.id" type="button" :aria-pressed="profileTab === tab.id"
            @click="profileTab = tab.id">{{ tab.label }}</button>
        </nav>

        <!-- Main Scrollable Content -->
        <div class="tech-profile-body min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">

          <!-- Performance & Workload Grid -->
          <div v-if="profileTab === 'summary'" class="grid grid-cols-1 lg:grid-cols-12 gap-4">

            <!-- Performance Section -->
            <div class="lg:col-span-5 space-y-4">
              <h3 class="text-sm font-bold text-[var(--shell-muted)] uppercase tracking-widest flex items-center gap-2">
                <i class="fas fa-chart-line text-[#d60000]"></i> Rendimiento Mensual
              </h3>
              <div class="grid grid-cols-3 gap-3">
                <div class="bg-[var(--shell-input)] p-4 rounded-xl border border-[var(--shell-border)] flex flex-col items-center text-center">
                  <span class="text-2xl font-bold text-[var(--tech-accent)] leading-none mb-1">
                    {{ store.selectedProfile.kpis.assigned }}
                  </span>
                  <span class="text-[10px] text-[var(--shell-muted)] font-bold uppercase">Asignadas</span>
                </div>
                <div class="bg-[var(--shell-input)] p-4 rounded-xl border border-[var(--shell-border)] flex flex-col items-center text-center">
                  <span class="text-2xl font-bold text-[var(--tech-accent)] leading-none mb-1">
                    {{ store.selectedProfile.kpis.completed }}
                  </span>
                  <span class="text-[10px] text-[var(--shell-muted)] font-bold uppercase">Completas</span>
                </div>
                <div
                  class="bg-[var(--shell-input)] p-4 rounded-xl border border-[#d60000]/30 flex flex-col items-center text-center">
                  <span class="text-2xl font-bold text-[#d60000] leading-none mb-1">
                    {{ store.selectedProfile.kpis.rate }}%
                  </span>
                  <span class="text-[10px] text-[var(--shell-muted)] font-bold uppercase">Eficiencia</span>
                </div>
              </div>

              <!-- Extra Info -->
              <div class="bg-[var(--shell-input)] p-4 rounded-xl border border-[var(--shell-border)] border-dashed space-y-3">
                <div class="flex justify-between items-center text-sm">
                  <span class="text-[var(--shell-muted)]">Total Programadas</span>
                  <span class="font-medium">{{ store.selectedProfile.kpis.assigned }}</span>
                </div>
                <div class="w-full bg-[var(--shell-input)] rounded-full h-1.5 overflow-hidden">
                  <div class="bg-[#d60000] h-full rounded-full"
                    :style="{ width: store.selectedProfile.kpis.rate + '%' }"></div>
                </div>
              </div>
            </div>

            <!-- Workload Chart -->
            <div class="lg:col-span-7">
              <h3 class="text-sm font-bold text-[var(--shell-muted)] uppercase tracking-widest flex items-center gap-2 mb-4">
                <i class="fas fa-tasks text-[var(--tech-accent)]"></i> Carga de Trabajo por Semana
              </h3>
              <div class="bg-[var(--shell-input)] p-4 rounded-xl border border-[var(--shell-border)] h-52 relative">
                <canvas ref="workloadCanvas" role="img" aria-label="Carga de trabajo por semana"></canvas>
              </div>
            </div>
          </div>

          <!-- Lists Section -->
          <div v-else>

            <!-- Proximas -->
            <section v-if="profileTab === 'upcoming'" class="flex flex-col min-h-52 bg-[var(--shell-input)] rounded-xl border border-[var(--shell-border)] overflow-hidden">
              <div
                class="p-4 bg-[var(--shell-surface)] border-b border-[var(--shell-border)] flex justify-between items-center sticky top-0 z-10">
                <h4 class="text-sm font-bold text-[var(--tech-accent)] uppercase flex items-center gap-2">
                  <i class="fas fa-calendar-alt"></i> Próximas Asignaciones
                </h4>
                <span class="text-xs text-[var(--shell-muted)] font-mono">{{ store.selectedProfile.upcomingVisits.length }}</span>
              </div>
              <div class="flex-grow overflow-y-auto custom-scrollbar p-3 space-y-2">
                <div v-if="store.selectedProfile.upcomingVisits.length === 0"
                  class="flex flex-col items-center justify-center h-full text-[var(--shell-muted)] opacity-50">
                  <i class="fas fa-coffee text-2xl mb-2"></i>
                  <p class="text-xs">Sin pendientes próximamente</p>
                </div>
                <div v-for="visit in store.selectedProfile.upcomingVisits" :key="visit.id"
                  class="bg-[var(--shell-surface)] border border-[var(--shell-border)] p-3 rounded-lg flex justify-between items-center group hover:border-[#d60000]/50 transition-colors">
                  <div class="min-w-0 pr-2">
                    <p
                      class="font-bold text-[var(--shell-muted)] text-sm truncate leading-tight group-hover:text-[var(--shell-text)] transition-colors">
                      {{ visit.nombre_cliente }}</p>
                    <p class="text-[10px] text-[#d60000] font-bold uppercase mt-0.5 tracking-tight">{{ visit.tipo_visita
                      }}</p>
                  </div>
                  <div class="text-right flex-shrink-0">
                    <p class="text-xs text-[var(--shell-muted)] font-mono font-bold">{{ formatDate(visit.fecha_visita) }}</p>
                    <p class="text-[10px] text-[var(--shell-muted)] italic">Programada</p>
                  </div>
                </div>
              </div>
            </section>

            <!-- Historial -->
            <section v-else class="flex flex-col min-h-52 bg-[var(--shell-input)] rounded-xl border border-[var(--shell-border)] overflow-hidden">
              <div
                class="p-4 bg-[var(--shell-surface)] border-b border-[var(--shell-border)] flex justify-between items-center sticky top-0 z-10">
                <h4 class="text-sm font-bold text-[var(--tech-accent)] uppercase flex items-center gap-2">
                  <i class="fas fa-history"></i> Historial Reciente
                </h4>
                <span class="text-xs text-[var(--shell-muted)] font-mono">{{ store.selectedProfile.recentHistory.length }}</span>
              </div>
              <div class="flex-grow overflow-y-auto custom-scrollbar p-3 space-y-2">
                <div v-if="store.selectedProfile.recentHistory.length === 0"
                  class="flex flex-col items-center justify-center h-full text-[var(--shell-muted)] opacity-50">
                  <i class="fas fa-search text-2xl mb-2"></i>
                  <p class="text-xs">Sin registros recientes</p>
                </div>
                <div v-for="visit in store.selectedProfile.recentHistory" :key="visit.id"
                  class="bg-emerald-900/10 border border-emerald-900/30 p-3 rounded-lg flex justify-between items-center">
                  <div class="min-w-0 pr-2">
                    <p class="font-bold text-[var(--shell-muted)] text-sm truncate leading-tight">{{ visit.nombre_cliente }}</p>
                    <div class="flex items-center gap-1.5 mt-0.5">
                      <i class="fas fa-check-circle text-emerald-500 text-[10px]"></i>
                      <p class="text-[10px] text-[var(--tech-accent)] font-bold uppercase tracking-tight">{{ visit.tipo_visita }}
                      </p>
                    </div>
                  </div>
                  <div class="text-right flex-shrink-0">
                    <p class="text-xs text-[var(--shell-muted)] font-mono">{{ formatDate(visit.fecha_visita) }}</p>
                    <p class="text-[10px] text-emerald-600 font-bold uppercase">Realizada</p>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>

      </template>
    </div>
  </div>
</template>

<style scoped>
.tech-profile-header { border-bottom: 1px solid var(--shell-border); background: linear-gradient(115deg, var(--tech-tint), var(--shell-surface) 72%); }
.tech-profile-tabs { border-bottom: 1px solid var(--shell-border); }
.tech-profile-tabs button { padding: 0.75rem 0.65rem; border-bottom: 2px solid transparent; font-size: 0.85rem; font-weight: 650; }
.tech-profile-tabs button[aria-pressed='true'] { border-color: #e50914; color: var(--tech-accent); }
.tech-profile-tabs button:hover { background: var(--shell-input); }
.tech-profile-body { scrollbar-color: var(--shell-scroll-thumb) var(--shell-scroll-track); }
@media (prefers-reduced-motion: reduce) { .animate-fade-in { animation: none; } }

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
