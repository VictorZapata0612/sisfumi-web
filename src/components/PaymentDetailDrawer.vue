<script setup lang="ts">
import { computed } from 'vue'
import { usePaymentsStore } from '@/stores/payments'
import { storeToRefs } from 'pinia'

const props = defineProps<{
  show: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'register-payment'): void
}>()

const paymentsStore = usePaymentsStore()
const { selectedGroup: group } = storeToRefs(paymentsStore)

const formatCurrency = (value: number) => {
  if (typeof value !== 'number') return '$ 0'
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(value)
}

const formatDate = (dateString: string | Date) => {
  if (!dateString) return 'N/A'
  return new Date(dateString).toLocaleDateString('es-CO', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}
</script>

<template>
  <!-- Overlay Backdrop -->
  <div class="fixed inset-0 bg-[#0a0a0a]/60 backdrop-blur-sm z-40 transition-opacity duration-300"
    :class="show ? 'opacity-100' : 'opacity-0 pointer-events-none'" @click="emit('close')"></div>

  <!-- Drawer Panel -->
  <div
    class="fixed top-0 right-0 h-full w-full max-w-md bg-[#151515] border-l border-white/10 shadow-2xl z-50 transform transition-transform duration-300 ease-out flex flex-col"
    :class="show ? 'translate-x-0' : 'translate-x-full'">
    <div v-if="group" class="h-full flex flex-col">
      <!-- Header -->
      <header class="p-6 bg-[#0a0a0a]/50 border-b border-white/10 flex justify-between items-start">
        <div>
          <h3 class="text-xl font-bold text-white leading-tight">{{ group.groupName }}</h3>
          <p class="text-sm text-gray-400 mt-1 flex items-center gap-1">
            <i class="fas fa-building text-gray-500"></i> {{ group.clientName }}
          </p>
          <div class="mt-3 flex items-center gap-2">
            <span class="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider border" :class="group.status === 'paid'
                ? 'bg-green-900/30 text-green-400 border-green-800'
                : group.status === 'partially_paid'
                  ? 'bg-yellow-900/30 text-yellow-400 border-yellow-800'
                  : 'bg-red-900/30 text-red-400 border-red-800'
              ">
              {{
                group.status === 'paid'
                  ? 'Pagado'
                  : group.status === 'partially_paid'
                    ? 'Abonado'
                    : 'Pendiente'
              }}
            </span>
          </div>
        </div>
        <button @click="emit('close')"
          class="text-gray-500 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/10">
          <i class="fas fa-times text-xl"></i>
        </button>
      </header>

      <!-- Content Scrollable -->
      <div class="flex-grow overflow-y-auto custom-scrollbar p-6 space-y-8">
        <!-- KPIs Summary -->
        <div class="grid grid-cols-1 gap-3">
          <div class="bg-white/5 p-4 rounded-xl border border-white/10 flex justify-between items-center">
            <span class="text-gray-400 text-sm font-medium">Total Facturado</span>
            <span class="text-white font-bold text-lg">{{
              formatCurrency(group.totalBilled)
              }}</span>
          </div>
          <div class="bg-white/5 p-4 rounded-xl border border-white/10 flex justify-between items-center">
            <span class="text-gray-400 text-sm font-medium">Total Abonado</span>
            <span class="text-green-400 font-bold text-lg">{{
              formatCurrency(group.totalPaid)
              }}</span>
          </div>
          <div
            class="bg-[#0a0a0a]/50 p-4 rounded-xl border border-white/10 flex justify-between items-center relative overflow-hidden">
            <div class="absolute inset-0 border-l-4 border-red-500"></div>
            <span class="text-gray-400 text-sm font-bold uppercase tracking-wide pl-2">Saldo Pendiente</span>
            <span class="text-red-400 font-bold text-2xl">{{
              formatCurrency(group.currentBalance)
              }}</span>
          </div>
        </div>

        <!-- Historial Timeline -->
        <div>
          <h4 class="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4 border-b border-white/10 pb-2">
            Historial de Pagos
          </h4>

          <div v-if="group.paymentHistory && group.paymentHistory.length > 0"
            class="space-y-4 relative before:absolute before:inset-0 before:ml-2.5 before:w-0.5 before:bg-white/10">
            <div v-for="payment in group.paymentHistory" :key="payment.id" class="relative pl-8">
              <!-- Timeline Dot -->
              <div
                class="absolute left-0 top-1.5 w-5 h-5 bg-[#151515] border-2 border-emerald-500 rounded-full flex items-center justify-center">
                <div class="w-1.5 h-1.5 bg-emerald-500 rounded-full"></div>
              </div>

              <div class="bg-white/5 p-3 rounded-lg border border-white/10 hover:bg-white/10 transition-colors">
                <div class="flex justify-between items-start mb-1">
                  <span class="font-bold text-emerald-400">{{
                    formatCurrency(payment.amount)
                    }}</span>
                  <span class="text-xs text-gray-400 bg-[#0a0a0a] px-2 py-0.5 rounded">{{
                    formatDate(payment.paymentDate)
                    }}</span>
                </div>
                <p class="text-sm text-white">{{ payment.method }}</p>
                <p v-if="payment.reference" class="text-xs text-gray-500 mt-1 flex items-center gap-1">
                  <i class="fas fa-hashtag text-[10px]"></i> {{ payment.reference }}
                </p>
              </div>
            </div>
          </div>

          <!-- Empty State -->
          <div v-else class="text-center py-10 border-2 border-dashed border-white/10 rounded-xl bg-[#0a0a0a]/50">
            <i class="fas fa-receipt text-gray-600 text-3xl mb-3"></i>
            <p class="text-gray-500 text-sm">No se han registrado abonos aún.</p>
          </div>
        </div>
      </div>

      <!-- Footer Actions -->
      <div class="p-6 border-t border-white/10 bg-[#0a0a0a]/30">
        <button @click="emit('register-payment')"
          class="btn btn-primary w-full bg-[#d60000] hover:bg-red-700 py-3 shadow-lg shadow-red-500/20 flex items-center justify-center gap-2"
          :disabled="group.status === 'paid'">
          <i class="fas fa-plus-circle"></i>
          Registrar Nuevo Abono
        </button>
      </div>
    </div>
  </div>
</template>
