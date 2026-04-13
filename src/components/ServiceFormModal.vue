<script setup lang="ts">
import { ref, watch, computed, onUnmounted } from 'vue'
import { httpsCallable } from 'firebase/functions'
import { functions } from '@/firebase/config'
import type { Service } from '@/stores/services'
import { useServicesStore } from '@/stores/services'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'

const props = defineProps<{
  show: boolean
  service: Service | null
  serviceIndex: number
}>()

const emit = defineEmits(['close', 'save'])

const servicesStore = useServicesStore()
const authStore = useAuthStore()
const { showToast } = useToast()

const form = ref<Service>({
  tipo_servicio: '',
  frecuencia: '',
  valor: 0,
  estado_servicio: 'Activo',
  sucursales_asignadas: [],
})

const businessData = ref<any>({})

const formattedValor = computed({
  get() {
    return form.value.valor.toLocaleString('es-CO')
  },
  set(newValue: string) {
    const numericOnly = newValue.replace(/\D/g, '')
    form.value.valor = Math.max(0, parseInt(numericOnly, 10) || 0)
  },
})

const isEditMode = computed(() => props.serviceIndex !== -1)
const canSetPrice = computed(
  () =>
    authStore.userRole === 'Administrador' ||
    authStore.userRole === 'Jefe' ||
    authStore.userRole === 'Coordinador Nacionales',
)

const showTooltip = ref(false)
const isSaving = ref(false)
let tooltipTimer: ReturnType<typeof setTimeout>

const handleTooltipEnter = () => {
  showTooltip.value = true
  resetTooltipTimer()
}

const handleTooltipLeave = () => {
  showTooltip.value = false
  clearTimeout(tooltipTimer)
}

const resetTooltipTimer = () => {
  clearTimeout(tooltipTimer)
  tooltipTimer = setTimeout(() => {
    showTooltip.value = false
  }, 3000)
}

onUnmounted(() => clearTimeout(tooltipTimer))

const sucursalesOptions = computed(() => {
  const client = servicesStore.selectedClient
  if (!client) return []
  const options = [{ text: 'Principal', value: 'Principal' }]
  if (client.sucursales && client.sucursales.length > 0) {
    client.sucursales.forEach((s: any) => options.push({ text: s.nombre, value: s.nombre }))
  }
  return options
})

watch(
  () => props.show,
  async (newVal) => {
    if (newVal) {
      isSaving.value = false
      const getBusinessData = httpsCallable(functions, 'getBusinessData')
      const result = (await getBusinessData()) as { data: any }
      businessData.value = result.data

      if (props.service) {
        form.value = JSON.parse(JSON.stringify(props.service))
      } else {
        form.value = {
          tipo_servicio: '',
          frecuencia: '',
          valor: 0,
          estado_servicio: 'Activo',
          sucursales_asignadas: [],
        }
      }
    }
  },
  { immediate: true },
)

const handleSave = async () => {
  console.log('🕵️ [SPY] handleSave iniciado. Datos del formulario:', JSON.parse(JSON.stringify(form.value)))
  if (!form.value.tipo_servicio || !form.value.frecuencia) {
    console.warn('🕵️ [SPY] Validación fallida: Campos incompletos (tipo o frecuencia)')
    showToast({
      title: 'Campos Incompletos',
      message: 'Por favor, complete todos los campos requeridos.',
      type: 'warning',
    })
    return
  }

  if (form.value.valor < 0) {
    console.warn('🕵️ [SPY] Validación fallida: Valor negativo')
    showToast({
      title: 'Valor Inválido',
      message: 'El valor del servicio no puede ser negativo.',
      type: 'warning',
    })
    return
  }

  isSaving.value = true
  console.log('🕵️ [SPY] Estado isSaving establecido a TRUE. Botón debería deshabilitarse.')

  try {
    // 1. Actualizar estado local (Padre/Store)
    console.log('🕵️ [SPY] Emitiendo evento "save" al componente padre...')
    emit('save', form.value, props.serviceIndex)
    console.log('🕵️ [SPY] Evento "save" emitido correctamente.')

    // 2. Persistir en Base de Datos
    // @ts-ignore: Acción del store para guardar la ficha completa
    // Usamos Promise.race para evitar que se quede colgado indefinidamente
    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('El guardado está tardando demasiado. Verifique su conexión.')), 10000))


    console.log('🕵️ [SPY] Iniciando llamada a servicesStore.saveServiceSheet() con timeout de 10s...')
    await Promise.race([
      servicesStore.saveServiceSheet(),
      timeout
    ])
    console.log('🕵️ [SPY] servicesStore.saveServiceSheet() completado exitosamente.')


    showToast({ title: 'Éxito', message: 'Servicio guardado correctamente.', type: 'success' })
    emit('close')
  } catch (error: any) {
    console.error('🕵️ [SPY] ERROR CAPTURADO en handleSave:', error)
    showToast({
      title: 'Error de Guardado',
      message: `Se actualizó localmente pero falló en la nube: ${error.message}`,
      type: 'error',
    })
  } finally {
    isSaving.value = false
    console.log('🕵️ [SPY] Bloque finally ejecutado. isSaving establecido a FALSE.')
  }
}
</script>

<template>
  <div v-if="show" class="fixed inset-0 z-[60] flex items-center justify-center p-4" role="dialog" aria-modal="true">
    <!-- Backdrop -->
    <div class="fixed inset-0 bg-[#0a0a0a]/80 backdrop-blur-sm transition-opacity" @click="!isSaving && $emit('close')">
    </div>

    <div
      class="relative bg-[#151515] rounded-xl border border-white/10 shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh] overflow-hidden transform transition-all">
      <!-- Header -->
      <div class="p-6 bg-[#0a0a0a]/50 border-b border-white/10 flex justify-between items-center">
        <h2 class="text-xl font-bold text-white flex items-center gap-2">
          <i :class="isEditMode ? 'fas fa-edit text-yellow-500' : 'fas fa-plus-circle text-green-500'
            "></i>
          {{ isEditMode ? 'Editar Servicio' : 'Añadir Nuevo Servicio' }}
        </h2>
        <button @click="!isSaving && $emit('close')" class="text-gray-400 hover:text-white transition-colors p-1"
          :disabled="isSaving">
          <i class="fas fa-times text-xl"></i>
        </button>
      </div>

      <form @submit.prevent="handleSave" class="flex-grow overflow-y-auto custom-scrollbar p-6 space-y-6">
        <!-- Configuración Básica -->
        <div class="bg-white/5 p-4 rounded-lg border border-white/10">
          <h3 class="text-sm font-bold text-cyan-400 uppercase mb-4 border-b border-white/10 pb-2">
            Configuración Básica
          </h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label for="serviceType" class="form-label">Tipo de Servicio <span class="text-red-400">*</span></label>
              <div class="relative">
                <select v-model="form.tipo_servicio" id="serviceType" class="input-field-dark w-full appearance-none"
                  required>
                  <option disabled value="">Seleccione...</option>
                  <option v-for="s in businessData.serviceTypesList" :key="s" :value="s">
                    {{ s }}
                  </option>
                </select>
                <div class="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none text-gray-400">
                  <i class="fas fa-chevron-down text-xs"></i>
                </div>
              </div>
            </div>
            <div>
              <label for="serviceFrequency" class="form-label flex items-center gap-2">
                Frecuencia <span class="text-red-400">*</span>
                <div class="relative" @mouseenter="handleTooltipEnter" @mouseleave="handleTooltipLeave"
                  @mousemove="resetTooltipTimer">
                  <i class="fas fa-info-circle text-gray-500 hover:text-cyan-400 cursor-help text-xs"></i>
                  <div
                    class="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-48 bg-gray-800 text-xs text-gray-200 p-2 rounded shadow-lg transition-opacity duration-300 ease-in-out pointer-events-none z-10 border border-white/10 text-center"
                    :class="showTooltip ? 'opacity-100' : 'opacity-0'">
                    Opciones: Mensual, Bimestral, Trimestral, Semestral, Anual, Ocasional.
                  </div>
                </div>
              </label>
              <div class="relative">
                <select v-model="form.frecuencia" id="serviceFrequency" class="input-field-dark w-full appearance-none"
                  required>
                  <option disabled value="">Seleccione...</option>
                  <option v-for="f in businessData.frequencyOptions" :key="f" :value="f">
                    {{ f }}
                  </option>
                </select>
                <div class="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none text-gray-400">
                  <i class="fas fa-chevron-down text-xs"></i>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Detalles Financieros y Estado -->
        <div class="bg-white/5 p-4 rounded-lg border border-white/10">
          <h3 class="text-sm font-bold text-cyan-400 uppercase mb-4 border-b border-white/10 pb-2">
            Detalles
          </h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div v-if="canSetPrice">
              <label for="serviceValue" class="form-label">Valor del Servicio</label>
              <div class="relative">
                <span class="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400 font-bold">$</span>
                <input v-model="formattedValor" type="text" id="serviceValue"
                  class="input-field-dark w-full !pl-8 font-mono" placeholder="0" required />
              </div>
            </div>
            <div>
              <label for="serviceStatus" class="form-label">Estado</label>
              <div class="relative">
                <select v-model="form.estado_servicio" id="serviceStatus"
                  class="input-field-dark w-full appearance-none" required>
                  <option value="Activo">Activo</option>
                  <option value="Inactivo">Inactivo</option>
                  <option value="Completado">Completado</option>
                </select>
                <div class="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none text-gray-400">
                  <i class="fas fa-chevron-down text-xs"></i>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Asignación de Sucursales -->
        <div>
          <label for="serviceSucursales" class="form-label mb-2 block">Asignar a Sucursales</label>
          <div class="bg-[#0a0a0a]/50 rounded-lg border border-white/10 p-2 max-h-40 overflow-y-auto custom-scrollbar">
            <div v-if="sucursalesOptions.length === 0" class="text-gray-500 text-sm p-2 text-center">
              No hay sucursales disponibles.
            </div>
            <div v-else class="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <label v-for="sucursal in sucursalesOptions" :key="sucursal.value"
                class="flex items-center p-2 rounded hover:bg-white/5 cursor-pointer transition-colors" :class="form.sucursales_asignadas.includes(sucursal.value)
                  ? 'bg-red-900/20 border border-red-500/30'
                  : ''
                  ">
                <input type="checkbox" :value="sucursal.value" v-model="form.sucursales_asignadas"
                  class="rounded border-white/10 text-[#d60000] focus:ring-[#d60000] bg-[#202020] mr-2" />
                <span class="text-sm text-gray-200">{{ sucursal.text }}</span>
              </label>
            </div>
          </div>
          <p class="text-xs text-gray-500 mt-1">Seleccione las sedes donde aplica este servicio.</p>
        </div>
      </form>

      <!-- Footer -->
      <div class="p-6 border-t border-white/10 bg-[#0a0a0a]/30 flex justify-end gap-3">
        <button @click="$emit('close')" type="button" class="btn btn-secondary" :disabled="isSaving">Cancelar</button>
        <button @click="handleSave" type="button"
          class="btn btn-primary bg-[#d60000] hover:bg-red-700 shadow-lg shadow-red-500/20" :disabled="isSaving">
          <i v-if="isSaving" class="fas fa-circle-notch fa-spin mr-2"></i>
          <i v-else class="fas fa-save mr-2"></i>
          {{ isSaving ? 'Guardando...' : (isEditMode ? 'Guardar Cambios' : 'Crear Servicio') }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.input-field-dark {
  background-color: #202020;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 0.5rem;
  color: #fff;
  padding: 0.5rem 0.75rem;
  transition: all 0.2s;
}

.input-field-dark:focus {
  outline: none;
  border-color: #d60000;
  box-shadow: 0 0 0 2px rgba(214, 0, 0, 0.2);
}
</style>
