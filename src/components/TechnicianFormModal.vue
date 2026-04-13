<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import type { Technician } from '@/stores/technicians'

const props = defineProps<{
  show: boolean
  technician: Technician | null
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'save', technician: Omit<Technician, 'id'> & { id?: string }): void
  (e: 'delete', technicianId: string): void
}>()

const form = ref<Omit<Technician, 'id'> & { id?: string }>({
  nombreCompleto: '',
  email: '',
  zona: 'Norte de Santander',
  googleColorId: '1',
  telefono: '',
})

const isEditing = computed(() => !!props.technician)

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

const currentColorHex = computed(() => {
  return colorOptions.find(c => c.id === form.value.googleColorId)?.hex || '#616161'
})

watch(
  () => props.show,
  (newVal) => {
    if (newVal) {
      if (props.technician) {
        form.value = { ...props.technician }
      } else {
        form.value = {
          nombreCompleto: '',
          email: '',
          zona: 'Norte de Santander',
          googleColorId: '1',
          telefono: '',
        }
      }
    }
  },
)

const handleSubmit = () => {
  emit('save', form.value)
}

const handleDelete = () => {
  if (form.value.id) {
    emit('delete', form.value.id)
  }
}
</script>

<template>
  <div v-if="show" class="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6" role="dialog"
    aria-modal="true">
    <!-- Backdrop con desenfoque -->
    <div class="fixed inset-0 bg-[#0a0a0a]/80 backdrop-blur-sm transition-opacity" @click="emit('close')"></div>

    <!-- Modal Panel -->
    <div
      class="relative bg-[#151515] rounded-xl border border-white/10 shadow-2xl w-full max-w-xl transform transition-all flex flex-col max-h-[90vh] overflow-hidden">

      <!-- Header -->
      <div class="flex items-center justify-between p-4 sm:p-6 border-b border-white/10 bg-[#0a0a0a]/30">
        <h3 class="text-xl font-bold text-white flex items-center gap-2">
          <i :class="isEditing ? 'fas fa-user-edit text-[#d60000]' : 'fas fa-user-plus text-green-400'"></i>
          {{ isEditing ? 'Editar Técnico' : 'Nuevo Técnico' }}
        </h3>
        <button @click="emit('close')" class="text-gray-400 hover:text-white transition-colors focus:outline-none p-1">
          <i class="fas fa-times text-xl"></i>
        </button>
      </div>

      <!-- Form Content -->
      <form @submit.prevent="handleSubmit" class="p-4 sm:p-6 overflow-y-auto custom-scrollbar flex flex-col gap-6">

        <!-- Sección 1: Información Personal -->
        <div class="bg-white/5 rounded-lg p-4 border border-white/10 space-y-4">
          <h4 class="text-xs font-bold text-[#d60000] uppercase tracking-widest border-b border-white/10 pb-2 mb-4">
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
        <div class="bg-white/5 rounded-lg p-4 border border-white/10 space-y-4">
          <h4 class="text-xs font-bold text-[#d60000] uppercase tracking-widest border-b border-white/10 pb-2 mb-4">
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
                <div class="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none text-gray-400">
                  <i class="fas fa-chevron-down text-xs"></i>
                </div>
              </div>
            </div>

            <div>
              <label for="techColor" class="form-label">Color en Calendario</label>
              <div class="flex items-center gap-3">
                <div class="relative flex-grow">
                  <select id="techColor" v-model="form.googleColorId" class="input-field-dark w-full appearance-none">
                    <option v-for="color in colorOptions" :key="color.id" :value="color.id">
                      {{ color.name }}
                    </option>
                  </select>
                  <div class="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none text-gray-400">
                    <i class="fas fa-chevron-down text-xs"></i>
                  </div>
                </div>
                <!-- Previsualización del Color -->
                <div
                  class="w-10 h-10 rounded-lg border border-white/20 shadow-lg flex-shrink-0 transition-colors duration-300"
                  :style="{ backgroundColor: currentColorHex }" :title="currentColorHex"></div>
              </div>
            </div>
          </div>
          <p class="text-xs text-gray-500 italic mt-2">
            <i class="fas fa-info-circle mr-1"></i> El color seleccionado se utilizará para sincronizar los eventos en
            Google Calendar.
          </p>
        </div>

      </form>

      <!-- Footer Actions -->
      <div class="p-4 sm:p-6 border-t border-white/10 bg-[#0a0a0a]/30 flex flex-col sm:flex-row justify-between gap-4">
        <button v-if="isEditing" @click.prevent="handleDelete" type="button"
          class="btn btn-danger w-full sm:w-auto flex items-center justify-center gap-2">
          <i class="fas fa-trash-alt"></i>
          <span>Eliminar</span>
        </button>
        <div v-else class="hidden sm:block"></div> <!-- Spacer -->

        <div class="flex gap-3 justify-end w-full sm:w-auto">
          <button @click="emit('close')" type="button" class="btn btn-secondary">Cancelar</button>
          <button @click="handleSubmit" type="button"
            class="btn btn-primary bg-[#d60000] hover:bg-red-700 shadow-lg shadow-red-500/20 px-6">
            <i class="fas fa-save mr-2"></i>
            {{ isEditing ? 'Guardar Cambios' : 'Crear Técnico' }}
          </button>
        </div>
      </div>

    </div>
  </div>
</template>

<style scoped>
.input-field-dark {
  background-color: #202020;
  /* bg-gray-700 -> #202020 */
  border: 1px solid rgba(255, 255, 255, 0.1);
  /* border-gray-600 -> border-white/10 */
  border-radius: 0.5rem;
  color: #fff;
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
  color: #9ca3af;
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
