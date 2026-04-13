<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps<{
  show: boolean
  selectedCount: number
  clientName: string
  totalAmount: number
}>()

const emit = defineEmits(['close', 'generate'])

const dueDays = ref(30)
const observations = ref('')

// Resetear campos al abrir
watch(() => props.show, (newVal) => {
  if (newVal) {
    // CORRECCIÓN: .ref no existe en una referencia reactiva, se usa .value
    dueDays.value = 30
    observations.value = ''
  }
})

const handleGenerate = () => {
  emit('generate', {
    dueDays: dueDays.value,
    observations: observations.value
  })
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(value)
}
</script>

<template>
  <div v-if="show" class="fixed inset-0 z-[60] flex items-center justify-center p-4">
    <!-- Backdrop -->
    <div class="absolute inset-0 bg-[#0a0a0a]/80 backdrop-blur-sm" @click="emit('close')"></div>

    <!-- Modal Content -->
    <div
      class="relative bg-[#151515] rounded-2xl border border-white/10 shadow-2xl w-full max-w-md overflow-hidden transform transition-all animate-fade-in">

      <!-- Header -->
      <div class="p-6 border-b border-white/10 bg-[#0a0a0a]/30 flex justify-between items-center">
        <h3 class="text-xl font-bold text-white flex items-center gap-2">
          <i class="fas fa-file-invoice-dollar text-blue-400"></i>
          Generar Factura
        </h3>
        <button @click="emit('close')" class="text-gray-400 hover:text-white">
          <i class="fas fa-times text-xl"></i>
        </button>
      </div>

      <!-- Body -->
      <div class="p-6 space-y-6">
        <!-- Info Resumen -->
        <div class="bg-blue-900/20 rounded-xl border border-blue-500/30 p-4">
          <p class="text-xs text-blue-300 font-bold uppercase tracking-wider mb-2">Resumen de Selección</p>
          <div class="flex justify-between items-end">
            <div>
              <p class="text-sm text-white font-medium">{{ clientName }}</p>
              <p class="text-xs text-gray-400">{{ selectedCount }} servicios seleccionados</p>
            </div>
            <div class="text-right">
              <p class="text-lg font-bold text-[#d60000] font-mono">{{ formatCurrency(totalAmount) }}</p>
            </div>
          </div>
        </div>

        <!-- Formulario -->
        <div class="space-y-4">
          <div>
            <label class="block text-xs font-bold text-gray-500 uppercase mb-2">Días para Vencimiento</label>
            <div class="grid grid-cols-4 gap-2">
              <button v-for="days in [15, 30, 45, 60]" :key="days" @click="dueDays = days" type="button"
                class="py-2 rounded-lg text-sm font-bold transition-all"
                :class="dueDays === days ? 'bg-[#d60000] text-white shadow-lg' : 'bg-white/5 text-gray-400 hover:bg-white/10'">
                {{ days }}
              </button>
            </div>
          </div>

          <div>
            <label class="block text-xs font-bold text-gray-500 uppercase mb-2">Observaciones Internas</label>
            <textarea v-model="observations" rows="3"
              class="w-full bg-[#0a0a0a] border border-white/10 rounded-xl p-3 text-sm text-white focus:ring-2 focus:ring-[#d60000] focus:outline-none placeholder-gray-600 resize-none"
              placeholder="Ej: Facturar por separado el servicio de desinfección..."></textarea>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="p-6 bg-[#0a0a0a]/30 border-t border-white/10 flex gap-3">
        <button @click="emit('close')" type="button"
          class="flex-1 py-3 px-4 rounded-xl font-bold text-gray-400 hover:text-white hover:bg-white/10 transition-colors">
          Cancelar
        </button>
        <button @click="handleGenerate" type="button"
          class="flex-1 py-3 px-4 bg-[#d60000] hover:bg-red-700 text-white font-bold rounded-xl shadow-lg shadow-red-500/20 transition-all active:scale-95">
          Confirmar y Crear
        </button>
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
    transform: scale(0.95);
  }

  to {
    opacity: 1;
    transform: scale(1);
  }
}
</style>
