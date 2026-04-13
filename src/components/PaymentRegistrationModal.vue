<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { usePaymentsStore } from '@/stores/payments'
import type { InvoiceGroup } from '@/stores/payments'

const props = defineProps<{
  show: boolean
  group: InvoiceGroup | null
}>()

const emit = defineEmits(['close', 'saved'])

const paymentsStore = usePaymentsStore()
const loading = ref(false)
const errorMessage = ref<string | null>(null)
const formattedAmount = ref('') // Referencia para el valor visual formateado

// Métodos de pago disponibles
const paymentMethods = [
  'Transferencia Bancaria',
  'Efectivo',
  'Tarjeta de Crédito/Débito',
  'Cheque',
  'Consignación',
  'Nequi/Daviplata',
  'Otro'
]

const paymentDetails = ref({
  amount: 0,
  currency: 'COP',
  method: 'Transferencia Bancaria',
  reference: '',
  date: new Date().toISOString().split('T')[0],
})

// Lógica para formatear con puntos de miles mientras se escribe
const handleAmountInput = (e: Event) => {
  const target = e.target as HTMLInputElement
  // Eliminamos cualquier caracter que no sea número
  const val = target.value.replace(/\D/g, '')

  if (!val) {
    paymentDetails.value.amount = 0
    formattedAmount.value = ''
    return
  }

  const numericVal = parseInt(val)
  paymentDetails.value.amount = numericVal

  // Aplicamos formato de miles con puntos (es-CO)
  formattedAmount.value = new Intl.NumberFormat('es-CO').format(numericVal)
}

watch(
  () => props.show,
  (newVal) => {
    if (newVal && props.group) {
      // Resetear el formulario al abrir el modal
      paymentDetails.value = {
        amount: 0,
        currency: 'COP',
        method: 'Transferencia Bancaria',
        reference: '',
        date: new Date().toISOString().split('T')[0],
      }
      formattedAmount.value = ''
      errorMessage.value = null
    }
  },
)

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(value)
}

const remainingBalance = computed(() => props.group?.currentBalance || 0)

const handleSubmit = async () => {
  if (!props.group?.id) return

  // Validaciones básicas
  if (paymentDetails.value.amount <= 0) {
    errorMessage.value = "El monto debe ser mayor a 0."
    return
  }

  loading.value = true
  errorMessage.value = null

  try {
    /**
     * FIX COMPATIBILIDAD:
     * Para evitar el "N/A" en el historial, enviamos la fecha duplicada en las dos llaves
     * más comunes (date y paymentDate). Así, cualquier componente que lea el historial
     * encontrará el valor correcto.
     */
    const payload = {
      ...paymentDetails.value,
      paymentDate: paymentDetails.value.date // Duplicamos para asegurar que el historial lo lea
    }

    await paymentsStore.registerPayment(props.group.id, payload as any)
    emit('saved')
    emit('close')
  } catch (err: any) {
    errorMessage.value = err.message || 'Ocurrió un error al registrar el pago.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div v-if="show" class="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6" role="dialog"
    aria-modal="true">
    <!-- Backdrop con desenfoque -->
    <div class="fixed inset-0 bg-[#0a0a0a]/80 backdrop-blur-sm transition-opacity" @click="!loading && emit('close')">
    </div>

    <!-- Modal Panel -->
    <div
      class="relative bg-[#151515] rounded-xl border border-white/10 shadow-2xl w-full max-w-lg transform transition-all flex flex-col max-h-[90vh] overflow-hidden">

      <!-- Header -->
      <div class="flex items-center justify-between p-4 sm:p-6 border-b border-white/10 bg-[#0a0a0a]/30">
        <h3 class="text-xl font-bold text-white flex items-center gap-2">
          <i class="fas fa-hand-holding-usd text-[#d60000]"></i>
          Registrar Abono
        </h3>
        <button @click="emit('close')" class="text-gray-400 hover:text-white transition-colors focus:outline-none"
          :disabled="loading">
          <i class="fas fa-times text-xl"></i>
        </button>
      </div>

      <!-- Content -->
      <div class="p-4 sm:p-6 overflow-y-auto custom-scrollbar space-y-6">

        <!-- Tarjeta de Resumen de Saldo -->
        <div
          class="bg-white/5 rounded-lg p-4 border border-white/10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <p class="text-xs text-gray-400 uppercase font-bold tracking-wider mb-1">Cliente / Grupo</p>
            <p class="text-white font-semibold text-sm sm:text-base line-clamp-1">{{ group?.groupName || 'Sin Nombre' }}
            </p>
          </div>
          <div class="text-right w-full sm:w-auto bg-red-900/20 p-2 rounded border border-red-900/50">
            <p class="text-xs text-red-400 uppercase font-bold tracking-wider mb-1">Saldo Pendiente</p>
            <p class="text-xl font-bold text-red-400">{{ formatCurrency(remainingBalance) }}</p>
          </div>
        </div>

        <form @submit.prevent="handleSubmit" class="space-y-4">

          <!-- Monto -->
          <div>
            <label for="paymentAmount" class="form-label mb-2 block text-sm font-medium text-gray-400">Monto del Abono
              <span class="text-red-400">*</span></label>
            <div class="relative">
              <span class="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-500">
                <i class="fas fa-dollar-sign"></i>
              </span>
              <input type="text" :value="formattedAmount" @input="handleAmountInput" id="paymentAmount"
                class="input-field-dark w-full pl-9 font-bold text-white text-lg bg-[#0a0a0a] border border-white/10 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-[#d60000]/50"
                placeholder="0" required />
            </div>
            <!-- Advertencia si supera el saldo -->
            <p v-if="paymentDetails.amount > remainingBalance"
              class="text-xs text-yellow-400 mt-2 flex items-center animate-pulse">
              <i class="fas fa-exclamation-triangle mr-1"></i> El monto ingresado supera el saldo pendiente.
            </p>
          </div>

          <!-- Grid: Método y Fecha -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label for="paymentMethod" class="form-label mb-2 block text-sm font-medium text-gray-400">Método de Pago
                <span class="text-red-400">*</span></label>
              <div class="relative">
                <select v-model="paymentDetails.method" id="paymentMethod"
                  class="input-field-dark w-full appearance-none bg-[#0a0a0a] border border-white/10 rounded-lg p-2.5 text-white outline-none focus:ring-2 focus:ring-[#d60000]/50"
                  required>
                  <option v-for="method in paymentMethods" :key="method" :value="method">{{ method }}</option>
                </select>
                <div class="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none text-gray-400">
                  <i class="fas fa-chevron-down text-xs"></i>
                </div>
              </div>
            </div>
            <div>
              <label for="paymentDate" class="form-label mb-2 block text-sm font-medium text-gray-400">Fecha <span
                  class="text-red-400">*</span></label>
              <input v-model="paymentDetails.date" type="date" id="paymentDate"
                class="input-field-dark w-full bg-[#0a0a0a] border border-white/10 rounded-lg p-2.5 text-white outline-none focus:ring-2 focus:ring-[#d60000]/50"
                required />
            </div>
          </div>

          <!-- Referencia -->
          <div>
            <label for="paymentReference" class="form-label mb-2 block text-sm font-medium text-gray-400">Referencia /
              Comprobante</label>
            <div class="relative">
              <span class="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-500">
                <i class="fas fa-hashtag"></i>
              </span>
              <input v-model="paymentDetails.reference" type="text" id="paymentReference"
                class="input-field-dark w-full pl-9 bg-[#0a0a0a] border border-white/10 rounded-lg p-2.5 text-white outline-none focus:ring-2 focus:ring-[#d60000]/50"
                placeholder="Ej. Transferencia #123456" />
            </div>
          </div>

          <!-- Mensaje de Error -->
          <div v-if="errorMessage"
            class="bg-red-900/30 border border-red-800 text-red-300 p-3 rounded-lg text-sm flex items-start gap-2">
            <i class="fas fa-exclamation-circle mt-0.5 text-red-400"></i>
            <span>{{ errorMessage }}</span>
          </div>

        </form>
      </div>

      <!-- Footer Actions -->
      <div class="p-4 sm:p-6 border-t border-white/10 bg-[#0a0a0a]/30 flex justify-end gap-3">
        <button @click="emit('close')" type="button"
          class="px-4 py-2 bg-white/5 text-gray-300 rounded-lg hover:bg-white/10 font-bold transition-all"
          :disabled="loading">
          Cancelar
        </button>
        <button @click="handleSubmit" type="button"
          class="px-6 py-2 bg-[#d60000] hover:bg-red-700 text-white font-bold rounded-lg shadow-lg shadow-red-500/20 transition-all active:scale-95 disabled:opacity-50"
          :disabled="loading">
          <i v-if="loading" class="fas fa-spinner fa-spin mr-2"></i>
          <span v-else><i class="fas fa-check mr-2"></i></span>
          {{ loading ? 'Registrando...' : 'Confirmar Pago' }}
        </button>
      </div>

    </div>
  </div>
</template>

<style scoped>
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

.animate-slide-up {
  animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
