<script setup lang="ts">
import { ref, computed } from 'vue'
import { useDialog } from '@/composables/useDialog'

const { isOpen, options, closeDialog } = useDialog()
const keywordInput = ref('')
const isLoading = ref(false)

const isKeywordValid = computed(() => {
  if (!options.value.confirmationKeyword) return true
  return keywordInput.value === options.value.confirmationKeyword
})

const handleConfirm = async () => {
  if (!isKeywordValid.value) return

  // Caso especial: Si hay selección de técnicos, validamos que haya al menos uno
  if (options.value.technicianSelection && options.value.technicianSelection.selected.length === 0) {
    return
  }

  if (options.value.onConfirm) {
    isLoading.value = true
    try {
      await options.value.onConfirm()
    } finally {
      isLoading.value = false
      closeDialog()
      keywordInput.value = ''
    }
  } else {
    closeDialog()
  }
}

const handleCancel = () => {
  closeDialog()
  keywordInput.value = ''
}
</script>

<template>
  <div v-if="isOpen" class="fixed inset-0 z-[9999] flex items-center justify-center p-4" role="dialog"
    aria-modal="true">
    <!-- Backdrop -->
    <div class="absolute inset-0 bg-[#0a0a0a]/80 backdrop-blur-sm transition-opacity"
      @click="!isLoading && handleCancel()"></div>

    <!-- Modal -->
    <div
      class="relative bg-[#151515] border border-white/10 rounded-xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all animate-fade-in">

      <div class="p-6">
        <h3 class="text-xl font-bold text-white mb-3 flex items-center gap-2">
          <i v-if="options.isConfirmation" class="fas fa-exclamation-triangle text-[#d60000]"></i>
          <i v-else class="fas fa-info-circle text-blue-500"></i>
          {{ options.title }}
        </h3>

        <div class="text-gray-300 text-sm leading-relaxed" v-html="options.message"></div>

        <!-- Input para Palabra Clave (Confirmación destructiva) -->
        <div v-if="options.confirmationKeyword" class="mt-4 bg-red-900/10 p-3 rounded-lg border border-red-900/30">
          <label class="block text-xs font-bold text-red-400 uppercase mb-2">
            Escribe <span class="text-white select-all font-mono bg-black/30 px-1 rounded">"{{
              options.confirmationKeyword }}"</span> para confirmar:
          </label>
          <input v-model="keywordInput" type="text"
            class="w-full bg-[#0a0a0a] border border-white/10 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-[#d60000] focus:border-[#d60000] focus:outline-none transition-all placeholder-gray-600"
            placeholder="Escribe aquí..." @keyup.enter="handleConfirm" />
        </div>

        <!-- Selección de Técnicos (Caso Especial) -->
        <div v-if="options.technicianSelection" class="mt-4">
          <label class="block text-xs font-bold text-gray-500 uppercase mb-2">Técnicos Disponibles</label>
          <div
            class="max-h-40 overflow-y-auto custom-scrollbar bg-[#0a0a0a] border border-white/10 rounded-lg p-2 space-y-1">
            <label v-for="tech in options.technicianSelection.available" :key="tech.id"
              class="flex items-center p-2 rounded hover:bg-white/5 cursor-pointer transition-colors">
              <input type="checkbox" :value="tech.nombreCompleto" v-model="options.technicianSelection.selected"
                class="rounded border-white/10 bg-[#202020] text-[#d60000] focus:ring-[#d60000] mr-3">
              <span class="text-sm text-gray-300">{{ tech.nombreCompleto }}</span>
            </label>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="p-4 bg-[#0a0a0a]/30 border-t border-white/10 flex justify-end gap-3">
        <button @click="handleCancel"
          class="px-4 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
          :disabled="isLoading">
          Cancelar
        </button>

        <button v-if="options.isConfirmation" @click="handleConfirm"
          class="px-4 py-2 rounded-lg text-sm font-bold text-white bg-[#d60000] hover:bg-red-700 shadow-lg shadow-red-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
          :disabled="!isKeywordValid || isLoading">
          <i v-if="isLoading" class="fas fa-circle-notch fa-spin mr-2"></i>
          {{ options.confirmationText || 'Confirmar' }}
        </button>

        <button v-else @click="handleCancel"
          class="px-4 py-2 rounded-lg text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-lg transition-all">
          Entendido
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.animate-fade-in {
  animation: fadeIn 0.2s ease-out;
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
  width: 4px;
}

.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
  background-color: #4b5563;
  border-radius: 10px;
}
</style>
