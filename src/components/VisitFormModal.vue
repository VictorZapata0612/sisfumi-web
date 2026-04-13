<script setup lang="ts">
import { ref, watch, computed, nextTick, onMounted } from 'vue'
import {
  usePlanningStore,
  type Visit,
  type Client,
  type Service,
  type VisitTemplate,
} from '@/stores/planning'
import { useSettingsStore } from '@/stores/settings'
import { httpsCallable } from 'firebase/functions'
import { functions } from '@/firebase/config'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'
import { useDialog } from '@/composables/useDialog'

const props = defineProps<{
  show: boolean
  visit: Visit | null
  selectedDate: Date | null
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'save', visit: Omit<Visit, 'id'> & { id?: string }): void
  (e: 'refresh'): void
}>()

const planningStore = usePlanningStore()
const settingsStore = useSettingsStore()
const authStore = useAuthStore()
const { showToast } = useToast()
const { showDialog } = useDialog()

const localVisit = ref<
  Omit<Visit, 'id'> & { id?: string; fecha_visita_date?: string; fecha_visita_time?: string; isUrgent?: boolean }
>({})

const activeTab = ref('details')
const organizerName = ref<string | null>(null)
const newChatNote = ref('')

onMounted(() => {
  planningStore.fetchVisitTemplates()
})

const isEditMode = computed(() => !!localVisit.value.id)

const availableServices = computed(() => {
  const client = planningStore.clients.find((c: Client) => c.id === localVisit.value.id_cliente)
  if (client?.serviceSheet?.services?.length) {
    return client.serviceSheet.services.filter((s: Service) => s.estado_servicio === 'Activo')
  }
  return settingsStore.businessData.serviceTypes || []
})

const availableLocations = computed(() => {
  if (!localVisit.value.id_cliente) return []
  const client = planningStore.clients.find((c: Client) => c.id === localVisit.value.id_cliente)
  if (!client) return []

  const locations = [{ text: `Principal - ${client.direccion}`, value: client.direccion }]
  if (client.sucursales) {
    // @ts-ignore
    client.sucursales.forEach((s) =>
      locations.push({ text: `${s.nombre} - ${s.direccion}`, value: s.direccion }),
    )
  }
  return locations
})

watch(
  () => props.show,
  (newVal) => {
    if (newVal) activeTab.value = 'details'

    if (newVal) {
      if (props.visit) {
        const client = planningStore.clients.find((c: Client) => c.id === props.visit?.id_cliente)
        if (client) {
          localVisit.value.id_cliente = client.id
        }
        const visitDate = props.visit.start || props.visit.fecha_visita
        const dateObj = new Date(visitDate)
        localVisit.value = {
          // @ts-ignore
          ...(props.visit.extendedProps || props.visit),
          fecha_visita_date: !isNaN(dateObj.getTime()) ? dateObj.toISOString().split('T')[0] : '',
          fecha_visita_time: !isNaN(dateObj.getTime())
            ? String(dateObj.toTimeString().split(' ')[0] ?? '00:00').substring(0, 5)
            : '08:00',
        }
        nextTick(() => {
          localVisit.value.tipo_visita = (props.visit?.extendedProps as Visit)?.tipo_visita || props.visit?.tipo_visita
          localVisit.value.ubicacion = (props.visit?.extendedProps as Visit)?.ubicacion || props.visit?.ubicacion
        })
      } else {
        localVisit.value = {
          fecha_visita_date: props.selectedDate
            ? props.selectedDate.toISOString().split('T')[0]
            : new Date().toISOString().split('T')[0],
          fecha_visita_time: '08:00',
          estado_visita: 'Programada',
          fumigadores_asignados: [],
          isUrgent: false
        }
      }
    }
  },
)

async function updateOrganizerName(zone: string | undefined) {
  if (!zone) {
    organizerName.value = 'Desconocido'
    return
  }
  try {
    const getOrganizerFn = httpsCallable(functions, 'getCoordinatorForZone')
    const result = (await getOrganizerFn({ zone })) as { data: { name: string } }
    organizerName.value = result.data.name || 'No asignado'
  } catch (error) {
    organizerName.value = 'Error al buscar'
  }
}

watch(
  () => localVisit.value.id_cliente,
  (newClientId) => {
    const client = planningStore.clients.find((c: Client) => c.id === newClientId)
    updateOrganizerName(client?.zona)
    if (!isEditMode.value) {
      localVisit.value.tipo_visita = ''
      localVisit.value.ubicacion = ''
    }
  },
)

watch(
  () => localVisit.value.ubicacion,
  (newLocation) => {
    const client = planningStore.clients.find((c: Client) => c.id === localVisit.value.id_cliente)
    const sucursal = client?.sucursales?.find((s: any) => s.direccion === newLocation)
    updateOrganizerName(sucursal?.zona || client?.zona)
  },
)

const applyTemplate = (templateId: string) => {
  if (!templateId) return
  const template = planningStore.visitTemplates.find((t: VisitTemplate) => t.id === templateId)
  if (template) {
    localVisit.value.tipo_visita = template.tipo_visita
    localVisit.value.notas_visita = template.notas_visita
    showToast({
      title: 'Plantilla Aplicada',
      message: `Cargada configuración de "${template.templateName}".`,
      type: 'info',
    })
  }
}

const handleSubmit = async () => {
  const client = planningStore.clients.find((c: Client) => c.id === localVisit.value.id_cliente)
  let visitZone = client?.zona || 'Sin Zona'

  if (client && client.sucursales) {
    const sucursalMatch = client.sucursales.find((s: any) => s.direccion === localVisit.value.ubicacion)
    if (sucursalMatch && sucursalMatch.zona) {
      visitZone = sucursalMatch.zona
    }
  }

  localVisit.value.zona = visitZone

  const visitToSave = { ...localVisit.value }
  const combinedDateTime = new Date(`${visitToSave.fecha_visita_date}T${visitToSave.fecha_visita_time || '00:00'}:00`)
  visitToSave.fecha_visita = combinedDateTime.toISOString()
  delete visitToSave.fecha_visita_date
  delete visitToSave.fecha_visita_time

  if (planningStore.selectedCalendarUid && planningStore.selectedCalendarUid !== 'internal') {
    visitToSave.calendarOwnerUid = planningStore.selectedCalendarUid
  } else {
    // @ts-ignore
    visitToSave.calendarOwnerUid = authStore.user?.uid
  }

  const technicians = visitToSave.fumigadores_asignados || []

  if (technicians.length === 0 || visitToSave.isUrgent) {
    emit('save', visitToSave)
    return
  }

  try {
    const checkForConflictsFn = httpsCallable(functions, 'checkForConflicts')
    const result = (await checkForConflictsFn({
      technicians: technicians,
      startTimeISO: combinedDateTime.toISOString(),
      visitIdToIgnore: visitToSave.id || null,
    })) as { data: { hasConflict: boolean; conflictingClient?: string; conflictingTechnician?: string } }

    if (result.data.hasConflict) {
      showDialog({
        title: 'Conflicto de Horario',
        message: `El técnico <strong>${result.data.conflictingTechnician}</strong> ya tiene una visita con <strong>${result.data.conflictingClient}</strong>. <br><br>¿Desea ignorar el aviso y programar de todas formas?`,
        isConfirmation: true,
        confirmationText: 'Sí, programar',
        onConfirm: () => emit('save', visitToSave)
      })
    } else {
      emit('save', visitToSave)
    }
  } catch (error: any) {
    showToast({
      title: 'Error de Verificación',
      message: `No se pudo verificar disponibilidad: ${error.message}`,
      type: 'error',
    })
  }
}

const handleDelete = async () => {
  if (localVisit.value.id) {
    showDialog({
      title: 'Eliminar Visita',
      message: '¿Estás seguro de que deseas eliminar esta visita programada? Esta acción no se puede deshacer.',
      isConfirmation: true,
      confirmationText: 'Sí, Eliminar',
      onConfirm: async () => {
        try {
          const deleteFn = httpsCallable(functions, 'deleteVisitAndCalendarEvent')
          await deleteFn({ visitId: localVisit.value.id })
          showToast({ title: 'Éxito', message: 'Visita eliminada correctamente.', type: 'success' })
          emit('refresh')
          emit('close')
        } catch (error: any) {
          showToast({
            title: 'Error',
            message: `No se pudo eliminar la visita: ${error.message}`,
            type: 'error',
          })
        }
      }
    })
  }
}

// Técnicos ordenados por zona (Asignación Inteligente)
const sortedTechnicians = computed(() => {
  const visitZone = localVisit.value.zona
  if (!visitZone) return planningStore.technicians

  return [...planningStore.technicians].sort((a: any, b: any) => {
    const aInZone = a.zona === visitZone ? 1 : 0
    const bInZone = b.zona === visitZone ? 1 : 0
    return bInZone - aInZone
  })
})

const addChatNote = () => {
  if (!newChatNote.value.trim()) return
  const note = {
    id: Date.now().toString(),
    text: newChatNote.value,
    author: authStore.user?.displayName || authStore.user?.email || 'Usuario',
    timestamp: new Date().toISOString()
  }
  if (!localVisit.value.internalNotes) localVisit.value.internalNotes = []
  localVisit.value.internalNotes.push(note)
  newChatNote.value = ''
}
</script>

<template>
  <div v-if="show" class="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6" role="dialog"
    aria-modal="true">
    <!-- Backdrop -->
    <div class="fixed inset-0 bg-[#0a0a0a]/80 backdrop-blur-sm transition-opacity" @click="$emit('close')"></div>

    <!-- Modal Panel -->
    <div
      class="relative bg-[#151515] rounded-2xl border border-white/10 shadow-2xl w-full max-w-3xl flex flex-col max-h-[95vh] overflow-hidden transform transition-all animate-fade-in">

      <!-- Header -->
      <div class="p-6 bg-[#0a0a0a]/50 border-b border-white/10 flex justify-between items-start">
        <div class="flex items-center gap-4">
          <div class="p-3 rounded-xl bg-red-500/10 text-[#d60000]">
            <i class="fas fa-calendar-check text-2xl"></i>
          </div>
          <div>
            <h2 class="text-xl font-bold text-white">
              {{ isEditMode ? 'Gestionar Visita' : 'Programar Visita' }}
            </h2>
            <p class="text-xs text-gray-500 font-bold uppercase tracking-widest mt-0.5">Módulo de Planeación Operativa
            </p>
          </div>
        </div>
        <button @click="$emit('close')" class="text-gray-400 hover:text-white transition-colors p-1">
          <i class="fas fa-times text-xl"></i>
        </button>
      </div>

      <!-- Tab Navigation -->
      <div class="flex px-6 bg-[#0a0a0a]/20 border-b border-white/10">
        <button @click="activeTab = 'details'"
          class="py-3 px-6 text-sm font-bold uppercase tracking-wider transition-all border-b-2"
          :class="activeTab === 'details' ? 'border-[#d60000] text-white' : 'border-transparent text-gray-500 hover:text-gray-300'">
          Información General
        </button>
        <button v-if="isEditMode" @click="activeTab = 'history'"
          class="py-3 px-6 text-sm font-bold uppercase tracking-wider transition-all border-b-2"
          :class="activeTab === 'history' ? 'border-[#d60000] text-white' : 'border-transparent text-gray-500 hover:text-gray-300'">
          Historial de Cambios
        </button>
        <button v-if="isEditMode" @click="activeTab = 'chat'"
          class="py-3 px-6 text-sm font-bold uppercase tracking-wider transition-all border-b-2"
          :class="activeTab === 'chat' ? 'border-[#d60000] text-white' : 'border-transparent text-gray-500 hover:text-gray-300'">
          Notas Internas
        </button>
      </div>

      <!-- Main Form -->
      <form @submit.prevent="handleSubmit" class="flex-grow overflow-y-auto custom-scrollbar p-6 space-y-6">

        <!-- Pestaña: DETALLES -->
        <div v-show="activeTab === 'details'" class="space-y-6 animate-fade-in">

          <!-- Sección: Plantilla y Cliente -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div v-if="!isEditMode && planningStore.visitTemplates.length > 0">
              <label class="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">Utilizar
                Plantilla</label>
              <div class="relative">
                <select @change="applyTemplate(($event.target as HTMLSelectElement).value)"
                  class="input-field-dark w-full appearance-none">
                  <option value="">-- Selección Manual --</option>
                  <option v-for="t in planningStore.visitTemplates" :key="t.id" :value="t.id">{{ t.templateName }}
                  </option>
                </select>
                <div class="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none text-gray-500">
                  <i class="fas fa-magic text-xs"></i>
                </div>
              </div>
            </div>

            <div :class="{ 'md:col-span-2': isEditMode || planningStore.visitTemplates.length === 0 }">
              <label class="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">Cliente <span
                  class="text-[#d60000]">*</span></label>
              <select v-model="localVisit.id_cliente" class="input-field-dark w-full" required>
                <option disabled value="">Seleccione un cliente...</option>
                <option v-for="c in planningStore.clients" :key="c.id" :value="c.id">{{ c.nombreComercial }}</option>
              </select>
            </div>
          </div>

          <!-- Sección: Servicio y Ubicación -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-white/5 rounded-xl border border-white/10">
            <div>
              <label class="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">Servicio a
                Realizar</label>
              <select v-model="localVisit.tipo_visita" class="input-field-dark w-full" required
                :disabled="!localVisit.id_cliente">
                <option disabled value="">Seleccione tipo...</option>
                <option v-for="s in availableServices" :key="(s as any).name || (s as any).tipo_servicio"
                  :value="(s as any).tipo_servicio || (s as any).name">
                  {{ (s as any).tipo_servicio || (s as any).name }}
                </option>
              </select>
            </div>
            <div>
              <label class="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">Punto de Servicio /
                Ubicación</label>
              <select v-model="localVisit.ubicacion" class="input-field-dark w-full" required
                :disabled="!localVisit.id_cliente">
                <option disabled value="">Seleccione dirección...</option>
                <option v-for="loc in availableLocations" :key="loc.value" :value="loc.value">{{ loc.text }}</option>
              </select>
            </div>
          </div>

          <!-- Sección: Fecha, Hora y Estado -->
          <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label class="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">Fecha</label>
              <input type="date" v-model="localVisit.fecha_visita_date" class="input-field-dark w-full" required />
            </div>
            <div>
              <label class="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">Hora Estimada</label>
              <input type="time" v-model="localVisit.fecha_visita_time" class="input-field-dark w-full" />
            </div>
            <div>
              <label class="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">Estado de
                Gestión</label>
              <select v-model="localVisit.estado_visita" class="input-field-dark w-full" required>
                <option>Programada</option>
                <option>Realizada</option>
                <option>Cancelada</option>
              </select>
            </div>
          </div>

          <!-- Sección: Técnicos -->
          <div>
            <label class="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">Asignación de
              Técnicos</label>
            <div
              class="bg-[#0a0a0a]/50 p-2 rounded-xl border border-white/10 min-h-[100px] max-h-40 overflow-y-auto custom-scrollbar">
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <label v-for="tech in sortedTechnicians" :key="tech.id"
                  class="flex items-center p-2 rounded-lg hover:bg-white/5 cursor-pointer transition-colors border border-transparent"
                  :class="localVisit.fumigadores_asignados?.includes(tech.nombreCompleto) ? 'bg-red-900/20 border-red-500/30' : ''">
                  <input type="checkbox" :value="tech.nombreCompleto" v-model="localVisit.fumigadores_asignados"
                    class="rounded border-white/10 text-[#d60000] focus:ring-[#d60000] bg-[#202020] mr-3">
                  <div class="flex flex-col">
                    <span class="text-sm text-gray-200">{{ tech.nombreCompleto }}</span>
                    <span v-if="(tech as any).zona === localVisit.zona"
                      class="text-[9px] text-green-400 font-bold uppercase tracking-wider">Recomendado</span>
                  </div>
                </label>
              </div>
            </div>
          </div>

          <!-- Sección: Notas -->
          <div>
            <label class="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">Observaciones y
              Notas</label>
            <textarea v-model="localVisit.notas_visita" rows="3" class="input-field-dark w-full resize-none"
              placeholder="Escribe instrucciones especiales para los técnicos..."></textarea>
          </div>

          <!-- Sección: Urgencia y Organizador -->
          <div class="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-white/10">
            <div class="flex items-center gap-4 px-4 py-3 rounded-2xl transition-all w-full sm:w-auto"
              :class="localVisit.isUrgent ? 'bg-red-500/10 border border-red-500/30' : 'bg-white/5 border border-transparent'">
              <div class="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" v-model="localVisit.isUrgent" class="sr-only peer" />
                <div
                  class="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600">
                </div>
              </div>
              <div class="flex flex-col">
                <span class="text-sm font-bold uppercase tracking-wide"
                  :class="localVisit.isUrgent ? 'text-red-400' : 'text-gray-400'">Marcar como Urgente</span>
                <span class="text-[10px] text-gray-500">Ignora advertencias de agenda</span>
              </div>
            </div>

            <div class="text-right flex flex-col items-end">
              <span class="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Sincronización de
                Calendario</span>
              <p class="text-sm text-gray-300 flex items-center gap-2">
                <i class="fas fa-user-circle text-[#d60000]"></i>
                {{ organizerName || 'Cargando...' }}
              </p>
            </div>
          </div>
        </div>

        <!-- Pestaña: HISTORIAL -->
        <div v-show="activeTab === 'history'" class="space-y-4 animate-fade-in">
          <div v-if="!visit?.history?.length" class="flex flex-col items-center justify-center py-20 text-gray-600">
            <i class="fas fa-history text-4xl mb-3 opacity-20"></i>
            <p>No se registran cambios previos para esta visita.</p>
          </div>
          <div v-else
            class="space-y-4 relative before:absolute before:inset-y-0 before:left-4 before:w-0.5 before:bg-white/10">
            <div v-for="log in visit.history" :key="log.id" class="relative pl-10">
              <div
                class="absolute left-2.5 top-1.5 w-3 h-3 bg-[#d60000] rounded-full border-2 border-[#151515] shadow-sm shadow-red-500/50">
              </div>
              <div class="bg-[#0a0a0a]/40 border border-white/10 p-4 rounded-xl">
                <div class="flex justify-between items-start mb-2">
                  <span class="text-xs font-bold text-[#d60000] uppercase tracking-wider">{{ log.action }}</span>
                  <span class="text-[10px] text-gray-500 font-mono">{{ new Date(log.timestamp.toDate()).toLocaleString()
                  }}</span>
                </div>
                <p class="text-sm text-gray-200 leading-relaxed">{{ log.details }}</p>
                <div class="mt-2 flex items-center gap-2 text-xs text-gray-500">
                  <i class="fas fa-user-circle"></i>
                  <span>{{ log.userEmail }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Pestaña: CHAT INTERNO -->
        <div v-show="activeTab === 'chat'" class="space-y-4 animate-fade-in h-full flex flex-col">
          <div
            class="flex-grow bg-[#0a0a0a]/30 rounded-lg p-4 border border-white/10 overflow-y-auto custom-scrollbar min-h-[200px]">
            <div v-if="!localVisit.internalNotes?.length" class="text-center text-gray-500 py-8">
              No hay notas internas registradas.
            </div>
            <div v-else class="space-y-3">
              <div v-for="note in localVisit.internalNotes" :key="note.id"
                class="bg-white/5 p-3 rounded-lg border border-white/5">
                <div class="flex justify-between text-xs text-gray-400 mb-1">
                  <span class="font-bold text-cyan-400">{{ note.author }}</span>
                  <span>{{ new Date(note.timestamp).toLocaleString() }}</span>
                </div>
                <p class="text-sm text-gray-200">{{ note.text }}</p>
              </div>
            </div>
          </div>
          <div class="flex gap-2">
            <input v-model="newChatNote" @keyup.enter="addChatNote" type="text" class="input-field-dark w-full"
              placeholder="Escribe una nota rápida..." />
            <button @click="addChatNote" type="button" class="btn btn-primary bg-[#d60000]"><i
                class="fas fa-paper-plane"></i></button>
          </div>
        </div>

      </form>

      <!-- Footer Actions -->
      <div class="p-6 bg-[#0a0a0a]/50 border-t border-white/10 flex flex-col sm:flex-row justify-between gap-4">
        <button v-if="isEditMode" @click.prevent="handleDelete" type="button"
          class="text-red-400 hover:text-white hover:bg-red-600 transition-all px-4 py-2 rounded-lg font-bold text-sm flex items-center justify-center gap-2">
          <i class="fas fa-trash-alt"></i>
          Eliminar Visita
        </button>
        <div v-else class="hidden sm:block"></div>

        <div class="flex gap-3 justify-end">
          <button @click="$emit('close')" type="button"
            class="btn btn-secondary bg-white/5 hover:bg-white/10 border-white/10">Cancelar</button>
          <button @click="handleSubmit" type="button"
            class="btn btn-primary bg-[#d60000] hover:bg-red-700 shadow-lg shadow-red-500/20 px-8">
            <i class="fas fa-save mr-2"></i>
            {{ isEditMode ? 'Guardar Cambios' : 'Confirmar Programación' }}
          </button>
        </div>
      </div>

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
    transform: translateY(10px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.input-field-dark {
  background-color: #202020;
  /* gray-800 -> #202020 */
  border: 1px solid rgba(255, 255, 255, 0.1);
  /* gray-700 -> border-white/10 */
  border-radius: 0.75rem;
  color: #f3f4f6;
  padding: 0.625rem 0.875rem;
  transition: all 0.2s ease-in-out;
  font-size: 0.875rem;
}

.input-field-dark:focus {
  outline: none;
  border-color: #d60000;
  /* indigo-500 -> brand-red */
  box-shadow: 0 0 0 4px rgba(214, 0, 0, 0.1);
  background-color: #111827;
  /* gray-900 */
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

/* Toggle Switch Styling */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}
</style>
