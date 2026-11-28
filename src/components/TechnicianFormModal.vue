<!-- eslint-disable @typescript-eslint/no-explicit-any -->
<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { useTechniciansStore } from '@/stores/technicians'
import { useToast } from '@/composables/useToast'
import type { Technician } from '@/stores/technicians'

const props = defineProps<{
  show: boolean
  technician: Technician | null
  canDelete?: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'refresh'): void
  (e: 'delete', id: string): void
}>()

const techniciansStore = useTechniciansStore()
const { showToast } = useToast()

const form = ref<Omit<Technician, 'id'> & { id?: string }>({
  nombreCompleto: '',
  email: '',
  zona: 'Norte de Santander',
  googleColorId: '1',
  telefono: '',
})

const isEditing = computed(() => !!props.technician)
const isLoading = ref(false)
const formError = ref<string | null>(null)
const originalForm = ref<Omit<Technician, 'id'> & { id?: string } | null>(null)

// Mapeo de colores de Google Calendar para previsualización
const colorOptions = [
  { id: '1', name: 'Lavanda', hex: '#7986cb' },
  { id: '2', name: 'Salvia', hex: '#33b679' },
  { id: '3', name: 'Uva', hex: '#8e24aa' },
  { id: '4', name: 'Flamenco', hex: '#e67c73' },
  { id: '5', name: 'Plátano', hex: '#f6c026' },
  { id: '6', name: 'Mandarina', hex: '#f5511d' },
  { id: '7', name: 'Pavo real', hex: '#039be5' },
  { id: '8', name: 'Grafito', hex: '#616161' },
  { id: '9', name: 'Arándano', hex: '#3f51b5' },
  { id: '10', name: 'Albahaca', hex: '#0b8043' },
  { id: '11', name: 'Tomate', hex: '#d50000' },
]

const initials = computed(() => form.value.nombreCompleto.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'T')
const currentColorHex = computed(() => {
  return colorOptions.find(c => c.id === form.value.googleColorId)?.hex || '#616161'
})

watch(
  () => props.show,
  (newVal) => {
    if (newVal) {
      formError.value = null
      if (props.technician) {
        form.value = { ...props.technician }
        originalForm.value = { ...props.technician }
      } else {
        form.value = {
          nombreCompleto: '',
          email: '',
          zona: 'Norte de Santander',
          googleColorId: '1',
          telefono: '',
        }
        originalForm.value = null
      }
    }
  },
)

const handleSubmit = async () => {
  if (isLoading.value) return
  try {
    formError.value = null
    if (!form.value.nombreCompleto || !form.value.nombreCompleto.trim()) {
      formError.value = 'El nombre del técnico es obligatorio'
      return
    }
    if (!form.value.email || !form.value.email.trim()) {
      formError.value = 'El correo electrónico es obligatorio'
      return
    }

    isLoading.value = true
    if (isEditing.value && form.value.id) {
      await techniciansStore.updateTechnician(form.value.id, form.value)
    } else {
      await techniciansStore.addTechnician(form.value)
    }
    showToast({
      title: 'Éxito',
      message: isEditing.value ? 'Técnico actualizado correctamente.' : 'Técnico creado correctamente.',
      type: 'success',
    })
    emit('refresh')
    emit('close')
  } catch (err: any) {
    // Rollback del estado del formulario
    if (originalForm.value) {
      form.value = { ...originalForm.value }
    }
    const errorMsg = err?.message || 'Error al guardar técnico'
    formError.value = errorMsg
    showToast({
      title: 'Error',
      message: errorMsg,
      type: 'error',
    })
  } finally {
    isLoading.value = false
  }
}

function handleDelete() {
  if (props.canDelete && !isLoading.value && form.value.id) emit('delete', form.value.id)
}
</script>

<template>
  <div v-if="show" class="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6" role="dialog"
    aria-modal="true" aria-labelledby="tech-form-title" @keydown.esc.stop="!isLoading && emit('close')">
    <!-- Backdrop con desenfoque -->
    <div class="fixed inset-0 bg-[#0a0a0a]/80 backdrop-blur-sm transition-opacity" @click="!isLoading && emit('close')"></div>

    <!-- Modal Panel -->
    <div
      class="relative bg-[var(--shell-surface)] rounded-xl border border-[var(--shell-border)] shadow-2xl w-full max-w-4xl transform transition-all flex flex-col max-h-[calc(100dvh-2rem)] overflow-hidden">

      <!-- Header -->
      <div class="tech-form-header flex shrink-0 items-start justify-between gap-3 p-4 sm:p-5">
        <div class="flex min-w-0 items-center gap-3">
          <span class="tech-form-icon grid size-11 shrink-0 place-items-center rounded-xl" aria-hidden="true">
            <i class="fas" :class="isEditing ? 'fa-user-edit' : 'fa-user-plus'"></i>
          </span>
          <div class="min-w-0">
            <h2 id="tech-form-title" class="text-xl font-extrabold">{{ isEditing ? 'Editar técnico' : 'Nuevo técnico' }}</h2>
            <p class="mt-1 text-sm text-[var(--shell-muted)]">{{ isEditing ? technician?.nombreCompleto : 'Registra el contacto y la zona de operación.' }}</p>
          </div>
        </div>
        <button type="button" class="tech-form-button" aria-label="Cerrar formulario"
          :disabled="isLoading" @click="emit('close')"><i class="fas fa-times" aria-hidden="true"></i></button>
      </div>

      <!-- Form Content -->
      <form id="technician-editor" @submit.prevent="handleSubmit" class="tech-form-body min-h-0 space-y-4 overflow-y-auto p-4 sm:p-5">

        <!-- Error Message -->
        <div v-if="formError" role="alert" class="bg-red-500/10 border border-red-500/30 rounded-lg p-4 flex gap-3">
          <i class="fas fa-exclamation-circle text-red-400 flex-shrink-0 mt-0.5"></i>
          <p class="text-[var(--tech-accent)] text-sm">{{ formError }}</p>
        </div>

        <div class="grid gap-5 md:grid-cols-[3fr_2fr]">
          <div class="min-w-0 space-y-4">
        <!-- Sección 1: Información Personal -->
        <div class="bg-[var(--shell-input)] rounded-lg p-4 border border-[var(--shell-border)] space-y-4">
          <h4 class="text-xs font-bold text-[var(--shell-text)] border-b border-[var(--shell-border)] pb-2 mb-4">
            Información Personal
          </h4>

          <div>
            <label for="techName" class="form-label">Nombre Completo <span class="text-red-400">*</span></label>
            <input id="techName" v-model="form.nombreCompleto" type="text" class="input-field-dark w-full"
              placeholder="Ej: Juan Pérez" required />
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label for="techEmail" class="form-label">Correo Electrónico <span class="text-red-400">*</span></label>
              <input id="techEmail" v-model="form.email" type="email" class="input-field-dark w-full"
                placeholder="usuario@ejemplo.com" required />
            </div>
            <div>
              <label for="telefono" class="form-label">Teléfono</label>
              <input type="tel" id="telefono" v-model="form.telefono" class="input-field-dark w-full"
                placeholder="300 000 0000" />
            </div>
          </div>
        </div>

        <!-- Sección 2: Configuración de Operación -->
        <div class="bg-[var(--shell-input)] rounded-lg p-4 border border-[var(--shell-border)] space-y-4">
          <h4 class="text-xs font-bold text-[var(--shell-text)] border-b border-[var(--shell-border)] pb-2 mb-4">
            Asignación y Calendario
          </h4>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label for="techZone" class="form-label">Zona de Operación</label>
              <div class="relative">
                <select id="techZone" v-model="form.zona" class="input-field-dark w-full appearance-none">
                  <option>Norte de Santander</option>
                  <option>Valle del Cauca</option>
                  <option>Nacionales</option>
                </select>
                <div class="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none text-[var(--shell-muted)]">
                  <i class="fas fa-chevron-down text-xs"></i>
                </div>
              </div>
            </div>

            <fieldset class="min-w-0">
              <legend class="form-label">Color en calendario</legend>
              <div class="flex flex-wrap gap-2">
                <label v-for="color in colorOptions" :key="color.id" :title="color.name" class="cursor-pointer">
                  <input v-model="form.googleColorId" type="radio" name="tech-calendar-color" :value="color.id" :aria-label="color.name" class="peer sr-only" />
                  <span class="grid size-8 place-items-center rounded-md text-black peer-focus-visible:ring-2 peer-focus-visible:ring-red-500" :style="{ backgroundColor: color.hex }">
                    <i v-if="form.googleColorId === color.id" class="fas fa-check rounded bg-white p-0.5" aria-hidden="true"></i>
                  </span>
                </label>
              </div>
            </fieldset>
          </div>
          <p class="text-xs text-[var(--shell-muted)] italic mt-2">
            <i class="fas fa-info-circle mr-1"></i> El color seleccionado se utilizará para sincronizar los eventos en
            Google Calendar.
          </p>
        </div>

          </div>
          <aside class="space-y-4 rounded-xl border border-[var(--shell-border)] bg-[var(--shell-input)] p-5">
            <h3 class="text-lg font-bold">Vista previa</h3>
            <div class="flex items-center gap-3">
              <span class="grid size-12 shrink-0 place-items-center rounded-full bg-[var(--shell-surface)] font-bold" :style="{ border: '2px solid ' + currentColorHex }">{{ initials }}</span>
              <div class="min-w-0 break-words">
                <p class="font-bold">{{ form.nombreCompleto || 'Nombre del técnico' }}</p>
                <p class="text-sm text-[var(--shell-muted)]">{{ form.zona || 'Zona de operación' }}</p>
              </div>
            </div>
            <div class="border-t border-[var(--shell-border)] pt-4">
              <h4 class="text-sm font-semibold">Así se verá en la agenda</h4>
              <p class="mt-2 rounded-lg border-l-4 bg-[var(--shell-surface)] p-3 text-sm" :style="{ borderLeftColor: currentColorHex }">
                Visita de servicio<br /><span class="text-[var(--shell-muted)]">09:00–10:00 · Ejemplo</span>
              </p>
            </div>
          </aside>
        </div>
      </form>

      <!-- Footer Actions -->
      <div class="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-[var(--shell-border)] bg-[var(--shell-input)] p-4 sm:px-5">
        <button v-if="isEditing && canDelete" @click="handleDelete" type="button" :disabled="isLoading"
          class="tech-form-button text-[var(--tech-accent)]">
          <i v-if="!isLoading" class="fas fa-trash-alt"></i>
          <i v-else class="fas fa-spinner animate-spin"></i>
          <span>{{ isLoading ? 'Eliminando...' : 'Eliminar' }}</span>
        </button>
        <div v-else class="hidden sm:block"></div> <!-- Spacer -->

        <div class="ml-auto flex flex-wrap justify-end gap-2">
          <button @click="!isLoading && emit('close')" type="button" :disabled="isLoading" class="tech-form-button">Cancelar</button>
          <button type="submit" form="technician-editor" :disabled="isLoading"
            class="tech-form-button tech-form-primary">
            <i v-if="!isLoading" class="fas fa-save"></i>
            <i v-else class="fas fa-spinner animate-spin"></i>
            {{ isLoading ? (isEditing ? 'Guardando...' : 'Creando...') : (isEditing ? 'Guardar Cambios' : 'Crear Técnico') }}
          </button>
        </div>
      </div>

    </div>
  </div>
</template>

<style scoped>
.tech-form-header { border-bottom: 1px solid var(--shell-border); background: linear-gradient(115deg, var(--tech-tint), var(--shell-surface) 72%); }
.tech-form-icon { background: var(--tech-tint); color: var(--tech-accent); }
.tech-form-body { scrollbar-color: var(--shell-scroll-thumb) var(--shell-scroll-track); }
.tech-form-button { display: inline-flex; min-height: 2.5rem; align-items: center; justify-content: center; gap: 0.45rem; padding: 0.45rem 0.75rem; border: 1px solid var(--shell-border); border-radius: 0.55rem; background: var(--shell-surface); font-size: 0.8rem; font-weight: 650; }
.tech-form-button:hover { background: var(--shell-input); }
.tech-form-button:disabled { opacity: 0.55; }
.tech-form-primary { background: #c7000c; color: #fff; border-color: #bc000b; }
.tech-form-primary:hover { background: #a9000a; }

.input-field-dark {
  background-color: var(--shell-input);
  /* bg-gray-700 -> #202020 */
  border: 1px solid var(--shell-border);
  /* border-gray-600 -> border-[var(--shell-border)] */
  border-radius: 0.5rem;
  color: var(--shell-text);
  padding: 0.5rem 0.75rem;
  transition: all 0.2s;
}

.input-field-dark:focus {
  outline: none;
  border-color: #d60000;
  /* indigo-500 -> brand-red */
  box-shadow: 0 0 0 2px rgba(214, 0, 0, 0.2);
}

.form-label {
  display: block;
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--shell-muted);
  /* gray-400 */
  margin-bottom: 0.25rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}

.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
  background-color: #4b5563;
  border-radius: 10px;
}
</style>
