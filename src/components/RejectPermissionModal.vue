<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps<{
  show: boolean
  clientName: string
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'confirm', reason: string): void
}>()

const reason = ref('')

watch(
  () => props.show,
  (newVal) => {
    if (newVal) {
      reason.value = ''
    }
  },
)

const handleConfirm = () => {
  if (reason.value.trim()) {
    emit('confirm', reason.value.trim())
  }
}
</script>

<template>
  <div v-if="show" class="fixed inset-0 z-[60] flex items-center justify-center p-4" role="dialog" aria-modal="true">
    <!-- Backdrop -->
    <div class="fixed inset-0 bg-[#0a0a0a]/80 backdrop-blur-sm transition-opacity" @click="$emit('close')"></div>

    <div
      class="relative bg-[#151515] rounded-xl border border-white/10 shadow-2xl w-full max-w-md overflow-hidden transform transition-all">

      <div class="bg-red-900/20 p-6 border-b border-red-900/50 flex items-center gap-4">
        <div class="bg-red-900/50 p-3 rounded-full text-red-400">
          <i class="fas fa-exclamation-triangle text-xl"></i>
        </div>
        <div>
          <h2 class="text-xl font-bold text-white">Rechazar Permiso</h2>
          <p class="text-sm text-gray-400">Acción requerida</p>
        </div>
      </div>

      <form @submit.prevent="handleConfirm" class="p-6 space-y-4">
        <p class="text-gray-300 text-sm">
          Estás a punto de rechazar la visita para <strong class="text-white">{{ clientName }}</strong>. Por favor,
          indica el motivo para notificar a los coordinadores.
        </p>

        <div>
          <label for="rejectionReason" class="block text-sm font-medium text-gray-400 mb-1">Motivo del Rechazo <span
              class="text-red-400">*</span></label>
          <textarea id="rejectionReason" v-model="reason" rows="4" class="input-field-dark w-full resize-none"
            placeholder="Ej: Documentación incompleta, fecha no disponible..." required autoFocus></textarea>
        </div>

        <div class="flex justify-end gap-3 pt-2">
          <button @click="$emit('close')" type="button" class="btn btn-secondary">Cancelar</button>
          <button type="submit" class="btn btn-primary bg-[#d60000] hover:bg-red-700 shadow-lg shadow-red-500/20"
            :disabled="!reason.trim()">
            Confirmar Rechazo
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<style scoped>
.input-field-dark {
  background-color: #202020;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 0.5rem;
  color: #fff;
  padding: 0.75rem;
  transition: all 0.2s;
}

.input-field-dark:focus {
  outline: none;
  border-color: #d60000;
  /* red-400 -> brand-red */
  box-shadow: 0 0 0 2px rgba(214, 0, 0, 0.2);
}
</style>
