<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { usePaymentsStore } from '@/stores/payments'
import { storeToRefs } from 'pinia'
import PaymentRegistrationModal from '@/components/PaymentRegistrationModal.vue'
import PaymentDetailDrawer from '@/components/PaymentDetailDrawer.vue'
import { useToast } from '@/composables/useToast'

defineOptions({ name: 'PaymentsView' })

const paymentsStore = usePaymentsStore()
const { showToast } = useToast()

// Usamos storeToRefs para mantener la reactividad de las propiedades del store
const {
  loading,
  error,
  currentDate,
  searchTerm,
  statusFilter,
  filteredGroups,
  kpis,
  selectedGroup,
} = storeToRefs(paymentsStore)

// Las acciones no necesitan storeToRefs
const { fetchPaymentData, changeMonth, exportToExcel, selectGroup } = paymentsStore

// Estado local para el modal
const showPaymentModal = ref(false)
const showDetailDrawer = ref(false)

// Cargar los datos iniciales cuando el componente se monta
onMounted(() => {
  fetchPaymentData()
})

const handleExport = async () => {
  try {
    const fileData = await exportToExcel()
    const link = document.createElement('a')
    link.href = `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${fileData}`
    const monthName = currentDate.value.toLocaleString('es-ES', { month: 'long', year: 'numeric' })
    link.download = `Reporte_Pagos_${monthName.replace(/\s/g, '_')}.xlsx`
    link.click()
    showToast({
      title: 'Exportación Exitosa',
      message: 'El reporte de pagos ha sido generado.',
      type: 'success',
    })
  } catch (err: any) {
    showToast({ title: 'Error de Exportación', message: err.message, type: 'error' })
  }
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(value)
}

const formatDate = (dateString: string) => {
  if (!dateString) return 'N/A'
  return new Date(dateString).toLocaleDateString('es-CO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

const isOverdue = (dueDate: string, status: string) => {
  if (status === 'paid' || !dueDate) {
    return false
  }
  const today = new Date()
  today.setHours(0, 0, 0, 0) // Ignorar la hora para la comparación
  const overdueDate = new Date(dueDate)
  return overdueDate < today
}

const getStatusPill = (status: string) => {
  switch (status) {
    case 'billed':
      return 'bg-blue-900/50 text-blue-300 border border-blue-700'
    case 'partially_paid':
      return 'bg-yellow-900/50 text-yellow-300 border border-yellow-700'
    case 'paid':
      return 'bg-green-900/50 text-green-300 border border-green-700'
    default:
      return 'bg-gray-700 text-gray-300'
  }
}

const getStatusText = (status: string) => {
  switch (status) {
    case 'billed': return 'Pendiente'
    case 'partially_paid': return 'Abonado'
    case 'paid': return 'Pagado'
    default: return status
  }
}

// Función para manejar el cierre simple del modal
const handleModalClose = () => {
  showPaymentModal.value = false
}

// Función para manejar el guardado exitoso y mostrar el toast
const handlePaymentSaved = () => {
  showToast({
    title: 'Operación Exitosa',
    message: 'El pago ha sido registrado correctamente.',
    type: 'success',
  })
  // Recargar datos para actualizar saldos y estados
  fetchPaymentData()
}

// Función para abrir detalle (Drawer en móvil, modal o expandir en desktop si quisieras)
const openDetail = (groupId: string) => {
  selectGroup(groupId)
  showDetailDrawer.value = true
}

const openPaymentModal = (groupId: string) => {
  selectGroup(groupId)
  showPaymentModal.value = true
}
</script>

<template>
  <div class="h-full bg-[#0a0a0a] text-gray-100 flex flex-col p-4 md:p-6 overflow-hidden">

    <!-- Cabecera -->
    <header class="flex-shrink-0 mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
      <div>
        <h2 class="text-2xl md:text-3xl font-bold text-white flex items-center gap-2">
          Pagos y Cartera
          <span
            class="text-sm bg-indigo-900/50 text-indigo-300 px-3 py-1 rounded-full border border-indigo-700/50 font-normal">
            {{ currentDate.toLocaleString('es-ES', { month: 'long', year: 'numeric' }) }}
          </span>
        </h2>
        <p class="text-sm text-gray-400 mt-1">Control de cobranza y abonos</p>
      </div>

      <div class="flex items-center gap-2 w-full md:w-auto">
        <!-- Navegación Meses -->
        <div class="flex items-center bg-[#151515] rounded-lg border border-white/10 mr-2">
          <button @click="changeMonth(-1)"
            class="p-2 hover:text-white text-gray-400 transition-colors border-r border-gray-700">
            <i class="fas fa-chevron-left"></i>
          </button>
          <button @click="changeMonth(1)" class="p-2 hover:text-white text-gray-400 transition-colors">
            <i class="fas fa-chevron-right"></i>
          </button>
        </div>

        <button @click="fetchPaymentData" class="btn btn-secondary !p-2" title="Recargar datos">
          <i class="fas fa-sync-alt"></i>
        </button>

        <button @click="handleExport"
          class="btn btn-primary bg-[#d60000] hover:bg-red-700 shadow-lg flex-grow md:flex-grow-0 justify-center">
          <i class="fas fa-file-excel mr-2"></i> Exportar
        </button>
      </div>
    </header>

    <!-- KPIs -->
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6 flex-shrink-0">
      <div class="bg-[#151515] p-4 rounded-xl shadow-lg border border-white/10 relative overflow-hidden">
        <div class="absolute right-0 top-0 p-3 opacity-10">
          <i class="fas fa-file-invoice-dollar text-5xl text-yellow-500"></i>
        </div>
        <h3 class="text-xs font-bold text-gray-400 uppercase tracking-wider">Total Facturado</h3>
        <p class="text-xl md:text-2xl font-bold mt-1 text-yellow-400">
          {{ formatCurrency(kpis.totalBilled) }}
        </p>
      </div>
      <div class="bg-[#151515] p-4 rounded-xl shadow-lg border border-white/10 relative overflow-hidden">
        <div class="absolute right-0 top-0 p-3 opacity-10">
          <i class="fas fa-hand-holding-usd text-5xl text-green-500"></i>
        </div>
        <h3 class="text-xs font-bold text-gray-400 uppercase tracking-wider">Total Recaudado</h3>
        <p class="text-xl md:text-2xl font-bold mt-1 text-green-400">{{ formatCurrency(kpis.totalPaid) }}</p>
      </div>
      <div class="bg-[#151515] p-4 rounded-xl shadow-lg border border-white/10 relative overflow-hidden">
        <div class="absolute right-0 top-0 p-3 opacity-10">
          <i class="fas fa-exclamation-circle text-5xl text-red-500"></i>
        </div>
        <h3 class="text-xs font-bold text-gray-400 uppercase tracking-wider">Saldo Pendiente</h3>
        <p class="text-xl md:text-2xl font-bold mt-1 text-red-400">{{ formatCurrency(kpis.totalPending) }}</p>
      </div>
    </div>

    <!-- Filtros y Tabla -->
    <div class="bg-[#151515] rounded-xl border border-white/10 shadow-xl flex flex-col flex-grow overflow-hidden">

      <!-- Toolbar Filtros -->
      <div class="p-4 border-b border-white/10 flex flex-col sm:flex-row gap-4">
        <div class="relative flex-grow">
          <i class="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
          <input v-model="searchTerm" type="search"
            class="w-full bg-[#0a0a0a] border border-white/10 rounded-lg py-2 pl-10 pr-4 text-white placeholder-gray-400 focus:ring-2 focus:ring-[#d60000]"
            placeholder="Buscar por factura o cliente..." />
        </div>
        <div class="relative w-full sm:w-auto">
          <select v-model="statusFilter"
            class="w-full sm:w-48 bg-[#0a0a0a] border border-white/10 rounded-lg py-2 pl-3 pr-10 text-white focus:ring-2 focus:ring-[#d60000] appearance-none cursor-pointer">
            <option value="todos">Todos los estados</option>
            <option value="billed">Pendiente</option>
            <option value="partially_paid">Abonado</option>
            <option value="paid">Pagado</option>
          </select>
          <span class="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none text-gray-400">
            <i class="fas fa-filter text-xs"></i>
          </span>
        </div>
      </div>

      <!-- Tabla / Lista -->
      <div class="flex-grow overflow-y-auto custom-scrollbar bg-[#151515] relative">
        <div v-if="loading" class="absolute inset-0 flex items-center justify-center bg-[#151515]/80 z-10">
          <div class="text-center">
            <i class="fas fa-spinner fa-spin text-3xl text-indigo-400 mb-2"></i>
            <p class="text-gray-400">Cargando...</p>
          </div>
        </div>

        <div v-else-if="filteredGroups.length === 0"
          class="flex flex-col items-center justify-center h-full text-gray-500 p-8">
          <i class="fas fa-search text-4xl mb-3 opacity-20"></i>
          <p>No se encontraron resultados.</p>
        </div>

        <table v-else class="min-w-full divide-y divide-white/5">
          <thead class="bg-[#0a0a0a]/50 sticky top-0 z-10">
            <tr>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                Factura</th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                Cliente</th>
              <th scope="col"
                class="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider hidden md:table-cell">
                Vencimiento</th>
              <th scope="col"
                class="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider hidden sm:table-cell">
                Total</th>
              <th scope="col" class="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                Saldo</th>
              <th scope="col" class="px-6 py-3 text-center text-xs font-medium text-gray-400 uppercase tracking-wider">
                Estado</th>
              <th scope="col" class="px-6 py-3 text-center text-xs font-medium text-gray-400 uppercase tracking-wider">
                Acciones</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-white/5 bg-[#151515]">
            <tr v-for="group in filteredGroups" :key="group.id" class="hover:bg-white/5 transition-colors group"
              :class="{ 'bg-red-900/10 hover:bg-red-900/20': isOverdue(group.dueDate, group.status) }">
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="flex items-center gap-2">
                  <span class="text-sm font-bold text-white font-mono bg-white/5 px-2 py-0.5 rounded">#{{
                    group.invoiceNumber }}</span>
                  <i v-if="isOverdue(group.dueDate, group.status)" class="fas fa-clock text-red-500 text-xs"
                    title="Vencida"></i>
                </div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-sm font-medium text-white truncate max-w-[150px] md:max-w-xs"
                  :title="group.clientName">
                  {{ group.clientName }}
                </div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-400 hidden md:table-cell">
                {{ formatDate(group.dueDate) }}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-300 hidden sm:table-cell">
                {{ formatCurrency(group.totalBilled) }}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-right font-bold"
                :class="group.currentBalance > 0 ? 'text-red-400' : 'text-green-400'">
                {{ formatCurrency(group.currentBalance) }}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-center">
                <span
                  class="px-2 py-1 inline-flex text-[10px] leading-tight font-bold rounded-full uppercase tracking-wide"
                  :class="getStatusPill(group.status)">
                  {{ getStatusText(group.status) }}
                </span>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                <div class="flex items-center justify-center gap-2">
                  <button @click="openDetail(group.id)"
                    class="text-gray-400 hover:text-white transition-colors bg-white/5 hover:bg-white/10 p-2 rounded-lg"
                    title="Ver Detalles">
                    <i class="fas fa-eye"></i>
                  </button>
                  <button @click="openPaymentModal(group.id)"
                    class="p-2 rounded-lg transition-colors text-white shadow-sm"
                    :class="group.status === 'paid' ? 'bg-white/5 text-gray-500 cursor-not-allowed' : 'bg-[#d60000] hover:bg-red-700'"
                    title="Registrar Abono" :disabled="group.status === 'paid'">
                    <i class="fas fa-hand-holding-usd"></i>
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Modales -->
    <PaymentRegistrationModal :show="showPaymentModal" :group="selectedGroup" @close="handleModalClose"
      @saved="handlePaymentSaved" />

    <PaymentDetailDrawer :show="showDetailDrawer" @close="showDetailDrawer = false"
      @register-payment="((showDetailDrawer = false), (showPaymentModal = true))" />
  </div>
</template>
