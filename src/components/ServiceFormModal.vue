<!-- eslint-disable @typescript-eslint/no-explicit-any -->
<script setup lang="ts">
import { ref, watch, computed, nextTick, onUnmounted } from 'vue'
import type { Service } from '@/stores/services'
import { useServicesStore } from '@/stores/services'
import { useAuthStore } from '@/stores/auth'
import { useSettingsStore } from '@/stores/settings'
import { useToast } from '@/composables/useToast'

const props = defineProps<{
  show: boolean
  service: Service | null
  serviceIndex: number
  priceMode?: boolean
}>()

const emit = defineEmits(['close', 'save'])

const servicesStore = useServicesStore()
const authStore = useAuthStore()
const settingsStore = useSettingsStore()
const { showToast } = useToast()

const form = ref<Service>({
  tipo_servicio: '',
  frecuencia: '',
  valor: 0,
  recurrence: {
    unit: 'MONTH',
    interval: 1,
    visitsPerPeriod: 1,
    preferredDays: [],
    schedulingMode: 'FLEXIBLE',
    toleranceDays: 2,
    allowWeekends: false,
  },
  billing: {
    model: 'PER_VISIT',
    periodValue: 0,
    includedVisits: 1,
    additionalVisitValue: 0,
  },
  estado_servicio: 'Activo',
  sucursales_asignadas: [],
})
const preferredDaysText = ref('')

const serviceTypesList = computed(() => settingsStore.businessData?.serviceTypes || [])
// Reemplaza los valores de este array con la lista EXACTA (mayúsculas/minúsculas) de tu bot
const frequencyOptions = computed(() => ['UNICA', 'SEMANAL', 'QUINCENAL', 'MENSUAL', 'BIMESTRAL', 'TRIMESTRAL', 'SEMESTRAL', 'ANUAL'])
const weekly = computed(() => ['SEMANAL', 'QUINCENAL'].includes(form.value.frecuencia))
const recurrenceLimit = computed(() => weekly.value
  ? (form.value.recurrence?.allowWeekends ? 7 : 5)
  : (form.value.recurrence?.allowWeekends ? 28 : 20))
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
    authStore.userRole === 'Coordinador Nacional',
)

const showTooltip = ref(false)
const isSaving = ref(false)
const priceInput = ref<HTMLInputElement>()
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
    client.sucursales.forEach((s: any, index: number) => options.push({
      text: s.nombre,
      value: s.id || `${client.id}-branch-${index + 1}`,
    }))
  }
  return options
})

watch(
  () => props.show,
  (newVal) => {
    if (newVal) {
      isSaving.value = false

      if (props.service) {
        form.value = JSON.parse(JSON.stringify(props.service))
        if (!form.value.recurrence) {
          form.value.recurrence = {
            unit: ['SEMANAL', 'QUINCENAL'].includes(form.value.frecuencia) ? 'WEEK' : 'MONTH',
            interval: form.value.frecuencia === 'BIMENSUAL' ? 2 : form.value.frecuencia === 'TRIMESTRAL' ? 3 : 1,
            visitsPerPeriod: 1,
            preferredDays: [],
            schedulingMode: 'FLEXIBLE',
            toleranceDays: 2,
            allowWeekends: false,
          }
        }
        if (!form.value.billing) {
          form.value.billing = {
            model: 'PER_VISIT',
            periodValue: form.value.valor,
            includedVisits: 1,
            additionalVisitValue: form.value.valor,
          }
        }
      } else {
        form.value = {
          tipo_servicio: '',
          frecuencia: '',
          valor: 0,
          recurrence: {
            unit: 'MONTH',
            interval: 1,
            visitsPerPeriod: 1,
            preferredDays: [],
            schedulingMode: 'FLEXIBLE',
            toleranceDays: 2,
            allowWeekends: false,
          },
          billing: {
            model: 'PER_VISIT',
            periodValue: 0,
            includedVisits: 1,
            additionalVisitValue: 0,
          },
          estado_servicio: 'Activo',
          sucursales_asignadas: [],
        }
      }
      preferredDaysText.value = (form.value.recurrence?.preferredDays || []).join(', ')
      if (props.priceMode) void nextTick(() => priceInput.value?.focus())
    }
  },
  { immediate: true },
)

const handleSave = async () => {
  if (isSaving.value) return
  if (props.priceMode && (!canSetPrice.value || form.value.valor <= 0)) {
    showToast({ title: 'Precio requerido', message: 'Ingresa un valor mayor que cero para asignar el precio.', type: 'warning' })
    return
  }
  if (!form.value.tipo_servicio || !form.value.frecuencia) {
    showToast({
      title: 'Campos Incompletos',
      message: 'Por favor, complete todos los campos requeridos.',
      type: 'warning',
    })
    return
  }

  if (form.value.valor < 0) {
    showToast({
      title: 'Valor Inválido',
      message: 'El valor del servicio no puede ser negativo.',
      type: 'warning',
    })
    return
  }

  const recurrence = form.value.recurrence || {
    unit: 'MONTH' as const,
    interval: 1,
    visitsPerPeriod: 1,
    preferredDays: [],
    schedulingMode: 'FLEXIBLE' as const,
    toleranceDays: 2,
    allowWeekends: false,
  }
  const billing = form.value.billing || {
    model: 'PER_VISIT' as const,
    periodValue: form.value.valor,
    includedVisits: 1,
    additionalVisitValue: form.value.valor,
  }
  recurrence.unit = weekly.value ? 'WEEK' : 'MONTH'
  recurrence.interval = ({ QUINCENAL: 2, BIMESTRAL: 2, BIMENSUAL: 2, TRIMESTRAL: 3, SEMESTRAL: 6, ANUAL: 12 } as Record<string, number>)[form.value.frecuencia] || 1
  recurrence.visitsPerPeriod = Math.min(recurrenceLimit.value, Math.max(1, Math.floor(Number(recurrence.visitsPerPeriod)) || 1))
  recurrence.preferredDays = [...new Set(preferredDaysText.value.split(',')
    .map(day => day.trim()).filter(Boolean).map(Number)
    .filter(day => Number.isInteger(day) && (weekly.value ? day >= 0 && day <= 6 : day >= 1 && day <= 31)))]
  billing.periodValue = Math.max(0, Number(billing.periodValue) || form.value.valor)
  billing.includedVisits = Math.max(1, Number(billing.includedVisits) || recurrence.visitsPerPeriod)
  billing.additionalVisitValue = Math.max(
    0,
    Number(billing.additionalVisitValue) || form.value.valor,
  )
  form.value.recurrence = recurrence
  form.value.billing = billing

  // Salvaguarda: Si no tiene permisos, forzamos el valor a 0
  if (!canSetPrice.value) {
    form.value.valor = 0
  }

  isSaving.value = true
  const previousSheet = servicesStore.serviceSheet
    ? JSON.parse(JSON.stringify(servicesStore.serviceSheet))
    : null

  try {
    servicesStore.upsertService(form.value, props.serviceIndex)

    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('El guardado está tardando demasiado. Verifique su conexión.')), 10000)
    )

    await Promise.race([
      servicesStore.saveServiceSheet(),
      timeout
    ])

    emit('save', form.value, props.serviceIndex)

    // Retroalimentación visual diferenciada según el rol
    if (!canSetPrice.value) {
      showToast({
        title: 'Servicio en Revisión',
        message: 'Servicio creado sin precio. Se ha notificado al Coordinador Nacional para su asignación.',
        type: 'info'
      })
    } else {
      showToast({ title: 'Éxito', message: 'Servicio guardado correctamente.', type: 'success' })
    }

    emit('close')
  } catch (error: any) {
    if (previousSheet) servicesStore.serviceSheet = previousSheet
    servicesStore.hasUnsavedChanges = Boolean(previousSheet)
    showToast({
      title: 'Error de Guardado',
      message: `Se actualizó localmente pero falló en la nube: ${error.message}`,
      type: 'error',
    })
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <div v-if="show" class="fixed inset-0 z-[60] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="service-form-title" @keydown.esc.stop="!isSaving && $emit('close')">
    <!-- Backdrop -->
    <div class="fixed inset-0 bg-[#0a0a0a]/80 backdrop-blur-sm transition-opacity" @click="!isSaving && $emit('close')">
    </div>

    <div
      class="service-editor-panel relative flex w-full flex-col overflow-hidden rounded-2xl border border-[var(--shell-border)] bg-[var(--shell-surface)] shadow-2xl" :class="{ 'price-editor': priceMode }">
      <header class="service-form-heading flex shrink-0 items-start gap-3 p-4 sm:p-5">
        <span class="service-form-icon grid size-11 shrink-0 place-items-center rounded-xl" aria-hidden="true">
          <i class="fas" :class="priceMode ? 'fa-dollar-sign' : isEditMode ? 'fa-edit' : 'fa-plus'"></i>
        </span>
        <div class="min-w-0 flex-1">
          <h2 id="service-form-title" class="text-xl font-extrabold">{{ priceMode ? 'Asignar precio' : isEditMode ? 'Editar servicio' : 'Nuevo servicio' }}</h2>
          <p class="mt-1 text-sm text-[var(--shell-muted)]">{{ servicesStore.selectedClient?.nombreComercial || servicesStore.serviceSheet?.clientName }}</p>
        </div>
        <button type="button" aria-label="Cerrar formulario de servicio" class="service-form-button shrink-0"
          :disabled="isSaving" @click="$emit('close')"><i class="fas fa-times" aria-hidden="true"></i></button>
      </header>

      <form @submit.prevent="handleSave" id="service-editor" class="service-editor-body min-h-0 overflow-y-auto p-4 sm:p-5" :class="{ 'price-body': priceMode }" :aria-busy="isSaving">
        <!-- Configuración Básica -->
        <section class="service-editor-card">
          <h3 class="editor-section-title"><i class="fas fa-clipboard-list" aria-hidden="true"></i> Datos del servicio</h3>
          <div class="grid gap-3 sm:grid-cols-2">
            <div>
              <label for="serviceType" class="form-label">Tipo de Servicio <span class="text-red-400">*</span></label>
              <div class="relative">
                <select v-model="form.tipo_servicio" id="serviceType" class="input-field-dark w-full appearance-none"
                  required>
                  <option disabled value="">Seleccione...</option>
                  <option v-for="s in serviceTypesList" :key="s.name" :value="s.name">
                    {{ s.name }}
                  </option>
                </select>
                <div class="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none text-[var(--shell-muted)]">
                  <i class="fas fa-chevron-down text-xs"></i>
                </div>
              </div>
            </div>
            <div>
              <label for="serviceFrequency" class="form-label flex items-center gap-2">
                Frecuencia <span class="text-red-400">*</span>
                <div class="relative" @mouseenter="handleTooltipEnter" @mouseleave="handleTooltipLeave"
                  @mousemove="resetTooltipTimer">
                  <i class="fas fa-info-circle text-[var(--shell-muted)] hover:text-cyan-400 cursor-help text-xs"></i>
                  <div
                    class="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-48 bg-gray-800 text-xs text-gray-200 p-2 rounded shadow-lg transition-opacity duration-300 ease-in-out pointer-events-none z-10 border border-[var(--shell-border)] text-center"
                    :class="showTooltip ? 'opacity-100' : 'opacity-0'">
                    Opciones: Mensual, Bimestral, Trimestral, Semestral, Anual, Ocasional.
                  </div>
                </div>
              </label>
              <div class="relative">
                <select v-model="form.frecuencia" id="serviceFrequency" class="input-field-dark w-full appearance-none"
                  required>
                  <option disabled value="">Seleccione...</option>
                  <option v-for="f in frequencyOptions" :key="f" :value="f">
                    {{ f }}
                  </option>
                </select>
                <div class="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none text-[var(--shell-muted)]">
                  <i class="fas fa-chevron-down text-xs"></i>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- Planificación y facturación -->
        <section class="service-editor-card">
          <h3 class="editor-section-title"><i class="fas fa-calendar-alt" aria-hidden="true"></i> Planificación y facturación</h3>
          <div class="grid gap-3 sm:grid-cols-2">
            <div>
              <label for="visitsPerPeriod" class="form-label">Visitas por periodo y por sede</label>
              <input v-model.number="form.recurrence!.visitsPerPeriod" type="number" min="1" :max="recurrenceLimit"
                id="visitsPerPeriod" class="input-field-dark w-full" />
              <p class="text-xs text-[var(--shell-muted)] mt-1">La cantidad se aplica a cada sede seleccionada.</p>
            </div>
            <div>
              <label for="preferredDays" class="form-label">Días preferidos</label>
              <input v-model="preferredDaysText" type="text" id="preferredDays" class="input-field-dark w-full"
                placeholder="Ej.: 2, 4, 6" />
              <p class="text-xs text-[var(--shell-muted)] mt-1">{{ weekly ? 'Días separados por coma. Lunes = 0, domingo = 6.' : 'Días del mes separados por coma.' }}</p>
            </div>
            <div v-if="form.frecuencia && form.frecuencia !== 'UNICA'">
              <label for="recurrenceStart" class="form-label">Fecha inicial del ciclo</label>
              <input v-model="form.recurrence!.startDate" id="recurrenceStart" type="date" class="input-field-dark w-full" />
              <p class="mt-1 text-xs text-[var(--shell-muted)]">Si se omite, se usa la fecha existente o la fecha de alta.</p>
            </div>
            <label v-if="form.frecuencia && form.frecuencia !== 'UNICA'" class="flex items-center gap-2 text-sm">
              <input v-model="form.recurrence!.allowWeekends" type="checkbox" /> Permitir fines de semana
            </label>
            <div>
              <label for="billingModel" class="form-label">Modelo de facturación</label>
              <select v-model="form.billing!.model" id="billingModel" class="input-field-dark w-full">
                <option value="PER_VISIT">Por visita</option>
                <option value="FIXED_PERIOD">Fija por periodo</option>
                <option value="INCLUDED_PLUS_ADDITIONAL">Incluidas + adicionales</option>
              </select>
            </div>
            <div v-if="form.billing?.model !== 'PER_VISIT'">
              <label for="periodValue" class="form-label">Valor del periodo</label>
              <input v-model.number="form.billing!.periodValue" type="number" min="0" id="periodValue"
                class="input-field-dark w-full" />
            </div>
            <div v-if="form.billing?.model === 'INCLUDED_PLUS_ADDITIONAL'">
              <label for="includedVisits" class="form-label">Visitas incluidas</label>
              <input v-model.number="form.billing!.includedVisits" type="number" min="1" id="includedVisits"
                class="input-field-dark w-full" />
            </div>
            <div v-if="form.billing?.model === 'INCLUDED_PLUS_ADDITIONAL'">
              <label for="additionalVisitValue" class="form-label">Valor visita adicional</label>
              <input v-model.number="form.billing!.additionalVisitValue" type="number" min="0"
                id="additionalVisitValue" class="input-field-dark w-full" />
            </div>
          </div>
        </section>

        <!-- Detalles Financieros y Estado -->
        <section class="service-editor-card" :class="{ 'order-first': priceMode }">
          <h3 class="editor-section-title"><i class="fas fa-dollar-sign" aria-hidden="true"></i> Valor y estado</h3>
          <div class="grid gap-3 sm:grid-cols-2">
            <p v-if="!canSetPrice" class="pricing-note sm:col-span-2">El valor quedará pendiente de asignación.</p>
            <div v-if="canSetPrice">
              <label for="serviceValue" class="form-label">Valor del Servicio</label>
              <div class="relative">
                <span class="absolute inset-y-0 left-0 pl-3 flex items-center text-[var(--shell-muted)] font-bold">$</span>
                <input v-model="formattedValor" type="text" id="serviceValue" ref="priceInput" inputmode="numeric"
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
                <div class="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none text-[var(--shell-muted)]">
                  <i class="fas fa-chevron-down text-xs"></i>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- Asignación de Sucursales -->
        <section class="service-editor-card" aria-labelledby="service-branches-title">
          <h3 id="service-branches-title" class="editor-section-title"><i class="fas fa-store" aria-hidden="true"></i> Sucursales</h3>
          <div class="bg-[var(--shell-input)] rounded-lg border border-[var(--shell-border)] p-2 max-h-40 overflow-y-auto custom-scrollbar">
            <div v-if="sucursalesOptions.length === 0" class="text-[var(--shell-muted)] text-sm p-2 text-center">
              No hay sucursales disponibles.
            </div>
            <div v-else class="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <label v-for="sucursal in sucursalesOptions" :key="sucursal.value"
                class="flex items-center p-2 rounded hover:bg-[var(--shell-input)] cursor-pointer transition-colors" :class="form.sucursales_asignadas.includes(sucursal.value)
                  ? 'bg-red-900/20 border border-red-500/30'
                  : ''
                  ">
                <input type="checkbox" :value="sucursal.value" v-model="form.sucursales_asignadas"
                  class="rounded border-[var(--shell-border)] text-[#d60000] focus:ring-[#d60000] bg-[var(--shell-input)] mr-2" />
                <span class="text-sm text-[var(--shell-text)]">{{ sucursal.text }}</span>
              </label>
            </div>
          </div>
          <p class="mt-2 text-xs text-[var(--shell-muted)]">{{ form.sucursales_asignadas.length ? form.sucursales_asignadas.length + ' seleccionadas' : 'Aplica a todas las sucursales si no seleccionas ninguna.' }}</p>
        </section>
      </form>

      <footer class="flex shrink-0 flex-wrap justify-end gap-2 border-t border-[var(--shell-border)] bg-[var(--shell-input)] p-4 sm:px-5">
        <button @click="$emit('close')" type="button" class="service-form-button" :disabled="isSaving">Cancelar</button>
        <button type="submit" form="service-editor" class="service-form-button service-form-primary" :disabled="isSaving">
          <i v-if="isSaving" class="fas fa-circle-notch fa-spin mr-2"></i>
          <i v-else class="fas fa-save mr-2"></i>
          {{ isSaving ? 'Guardando...' : (priceMode ? 'Guardar precio' : isEditMode ? 'Guardar cambios' : 'Crear servicio') }}
        </button>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.service-editor-panel { max-width: 58rem; max-height: calc(100dvh - 2rem); color: var(--shell-text); }
.price-editor { max-width: 42rem; }
.service-editor-body { display: grid; gap: 0.85rem; scrollbar-color: var(--shell-scroll-thumb) var(--shell-scroll-track); }
.service-editor-card { min-width: 0; padding: 0.9rem; border: 1px solid var(--shell-border); border-radius: 0.75rem; }
.editor-section-title {
  display: flex; align-items: center; gap: 0.55rem;
  margin-bottom: 0.8rem; padding-bottom: 0.65rem; border-bottom: 1px solid var(--shell-border);
  font-size: 0.9rem; font-weight: 750;
}
.editor-section-title i { color: var(--service-accent); }
.pricing-note { padding: 0.6rem; border-radius: 0.55rem; background: var(--service-tint); color: var(--service-accent); font-size: 0.8rem; }
@media (min-width: 900px) {
  .service-editor-body:not(.price-body) { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); align-items: start; }
}

.service-form-heading { border-bottom: 1px solid var(--shell-border); background: linear-gradient(115deg, var(--service-tint), var(--shell-surface) 72%); }
.service-form-icon { background: var(--service-tint); color: var(--service-accent); }
.form-label { display: block; color: var(--shell-muted); font-size: 0.8rem; font-weight: 650; margin-bottom: 0.25rem; }
.service-form-button { display: inline-flex; min-height: 2.5rem; align-items: center; justify-content: center; padding: 0.45rem 0.75rem; border: 1px solid var(--shell-border); border-radius: 0.55rem; background: var(--shell-surface); color: var(--shell-text); font-size: 0.8rem; font-weight: 650; }
.service-form-button:hover { background: var(--shell-input); }
.service-form-button:disabled { opacity: 0.55; }
.service-form-primary { background: #c7000c; color: #fff; border-color: #bc000b; }
.service-form-primary:hover { background: #a9000a; }

.input-field-dark {
  background-color: var(--shell-input);
  border: 1px solid var(--shell-border);
  border-radius: 0.5rem;
  color: var(--shell-text);
  padding: 0.5rem 0.75rem;
  transition: all 0.2s;
}

.input-field-dark:focus {
  outline: none;
  border-color: #d60000;
  box-shadow: 0 0 0 2px rgba(214, 0, 0, 0.2);
}
</style>
