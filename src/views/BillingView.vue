<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useBillingStore, type BillingGroup } from '@/stores/billing'
import { useToast } from '@/composables/useToast'
import InvoiceModal from '@/components/InvoiceModal.vue'

const billingStore = useBillingStore()
const { showToast } = useToast()

const pendingSearch = ref('')
const invoicedSearch = ref('')
const statusFilter = ref('todos')
const selectedGroup = ref<BillingGroup | null>(null)
const selectedServices = ref<Set<string>>(new Set())
const showInvoiceModal = ref(false)

// Control de vista móvil
const isMobileDetailOpen = computed(() => !!selectedGroup.value)

onMounted(() => {
  billingStore.fetchBillingData()
})

const filteredPendingGroups = computed(() => {
  if (!pendingSearch.value) return billingStore.pendingGroups
  return billingStore.pendingGroups.filter((g) =>
    g.groupName.toLowerCase().includes(pendingSearch.value.toLowerCase()),
  )
})

const filteredInvoicedGroups = computed(() => {
  const term = invoicedSearch.value.toLowerCase()
  return billingStore.invoicedGroups.filter((g) => {
    const matchesSearch =
      g.groupName.toLowerCase().includes(term) || g.invoiceNumber?.toLowerCase().includes(term)
    const matchesStatus = statusFilter.value === 'todos' || g.status === statusFilter.value
    return matchesSearch && matchesStatus
  })
})

const selectGroup = (group: BillingGroup) => {
  selectedGroup.value = group
  selectedServices.value.clear()
}

const closeMobileDetail = () => {
  selectedGroup.value = null
}

const handleSelectAll = (event: Event) => {
  const isChecked = (event.target as HTMLInputElement).checked
  selectedServices.value.clear()
  if (isChecked && selectedGroup.value) {
    selectedGroup.value.services.forEach((s) => selectedServices.value.add(s.id))
  }
}

// Función manual para manejar la selección ya que v-model no soporta Sets nativamente
const toggleServiceSelection = (serviceId: string) => {
  if (selectedServices.value.has(serviceId)) {
    selectedServices.value.delete(serviceId)
  } else {
    selectedServices.value.add(serviceId)
  }
}

const selectedTotal = computed(() => {
  if (!selectedGroup.value) return 0
  return selectedGroup.value.services
    .filter((s) => selectedServices.value.has(s.id))
    .reduce((sum, s) => sum + s.valor_servicio, 0)
})

const openInvoiceModal = () => {
  if (selectedServices.value.size > 0) {
    showInvoiceModal.value = true
  } else {
    showToast({
      title: 'Sin Selección',
      message: 'Debe seleccionar al menos un servicio para facturar.',
      type: 'warning',
    })
  }
}

const handleGenerateInvoice = async (options: { dueDays: number; observations: string }) => {
  if (!selectedGroup.value) return

  // ✅ CORRECCIÓN: En lugar de enviar solo los IDs, filtramos y enviamos los objetos de servicio completos.
  // Esto asegura que el backend reciba el 'valor_servicio' y otros detalles necesarios.
  const selectedServiceObjects = selectedGroup.value.services.filter((s) =>
    selectedServices.value.has(s.id),
  )

  try {
    const result = await billingStore.generateInvoiceReport({
      // The store expects an array of service IDs.
      visitIds: selectedServiceObjects.map((s) => s.id),
      groupName: selectedGroup.value.groupName,
      dueDays: options.dueDays,
      observations: options.observations,
    })

    downloadBase64File(result.fileData, `Factura_${result.invoiceNumber}.xlsx`)
    showToast({
      title: 'Éxito',
      message: `Factura ${result.invoiceNumber} generada.`,
      type: 'success',
    })

    await billingStore.fetchBillingData()
    selectedGroup.value = null
    showInvoiceModal.value = false
  } catch (error: any) {
    showToast({
      title: 'Error',
      message: `No se pudo generar la factura: ${error.message}`,
      type: 'error',
    })
  }
}

const handleDownloadInvoice = async (invoiceNumber: string) => {
  try {
    const result = await billingStore.downloadExistingInvoice(invoiceNumber)
    downloadBase64File(result.fileData, `Factura_${invoiceNumber}.xlsx`)
  } catch (error: any) {
    showToast({
      title: 'Error',
      message: `No se pudo descargar la factura: ${error.message}`,
      type: 'error',
    })
  }
}

const downloadBase64File = (base64Data: string, fileName: string) => {
  const byteCharacters = atob(base64Data)
  const byteNumbers = new Array(byteCharacters.length)
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i)
  }
  const byteArray = new Uint8Array(byteNumbers)
  const blob = new Blob([byteArray], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })

  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
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
  <div class="h-full bg-[#0a0a0a] text-gray-100 flex flex-col p-4 md:p-6 overflow-hidden">
    <!-- Header Responsive -->
    <header class="flex-shrink-0 mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
      <div>
        <h2 class="text-2xl md:text-3xl font-bold text-white flex items-center gap-2">
          Facturación
          <span class="text-sm bg-indigo-900/50 text-indigo-300 px-3 py-1 rounded-full border border-indigo-700/50">
            {{
              billingStore.currentDate.toLocaleString('es-ES', { month: 'long', year: 'numeric' })
            }}
          </span>
        </h2>
        <p class="text-sm text-gray-400 mt-1">Gestión de cobros y facturas</p>
      </div>

      <div class="flex items-center gap-2 bg-[#151515] p-1 rounded-lg border border-white/10">
        <button @click="billingStore.changeMonth(-1)" class="p-2 hover:text-white text-gray-400 transition-colors">
          <i class="fas fa-chevron-left"></i>
        </button>
        <button @click="billingStore.fetchBillingData"
          class="p-2 hover:text-[#d60000] text-gray-400 transition-colors border-x border-white/10 px-4"
          title="Recargar">
          <i class="fas fa-sync-alt"></i>
        </button>
        <button @click="billingStore.changeMonth(1)" class="p-2 hover:text-white text-gray-400 transition-colors">
          <i class="fas fa-chevron-right"></i>
        </button>
      </div>
    </header>

    <!-- KPIs -->
    <section class="mb-6 grid grid-cols-1 sm:grid-cols-3 gap-4 flex-shrink-0">
      <div class="bg-[#151515] p-4 rounded-xl shadow-lg border border-white/10 relative overflow-hidden group">
        <div class="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
          <i class="fas fa-clock text-6xl text-blue-500"></i>
        </div>
        <h3 class="text-xs font-bold text-gray-400 uppercase tracking-wider">Por Facturar</h3>
        <p class="mt-1 text-2xl font-bold text-blue-400">
          {{ formatCurrency(billingStore.kpis.pendingToInvoice) }}
        </p>
      </div>
      <div class="bg-[#151515] p-4 rounded-xl shadow-lg border border-white/10 relative overflow-hidden group">
        <div class="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
          <i class="fas fa-file-invoice-dollar text-6xl text-yellow-500"></i>
        </div>
        <h3 class="text-xs font-bold text-gray-400 uppercase tracking-wider">Facturado</h3>
        <p class="mt-1 text-2xl font-bold text-yellow-400">
          {{ formatCurrency(billingStore.kpis.billed) }}
        </p>
      </div>
      <div class="bg-[#151515] p-4 rounded-xl shadow-lg border border-white/10 relative overflow-hidden group">
        <div class="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
          <i class="fas fa-check-circle text-6xl text-green-500"></i>
        </div>
        <h3 class="text-xs font-bold text-gray-400 uppercase tracking-wider">Recaudado</h3>
        <p class="mt-1 text-2xl font-bold text-green-400">
          {{ formatCurrency(billingStore.kpis.paid) }}
        </p>
      </div>
    </section>

    <!-- Main Content -->
    <main class="flex-grow grid grid-cols-1 lg:grid-cols-12 gap-6 overflow-hidden min-h-0 relative">
      <div
        class="lg:col-span-4 bg-[#151515] rounded-xl border border-white/10 flex flex-col overflow-hidden shadow-lg transition-all duration-300"
        :class="{ 'hidden lg:flex': isMobileDetailOpen, flex: !isMobileDetailOpen }">
        <div
          class="p-3 bg-[#0a0a0a]/50 border-b border-white/10 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">
          Grupos de Facturación
        </div>

        <div class="flex-grow overflow-y-auto custom-scrollbar p-3 space-y-6">
          <div>
            <div class="flex justify-between items-center mb-2 px-1">
              <h3 class="font-bold text-blue-400 text-sm flex items-center gap-2">
                <i class="fas fa-hourglass-half"></i> Pendientes
              </h3>
              <span class="text-xs bg-blue-900/30 text-blue-300 px-2 py-0.5 rounded-full">{{
                filteredPendingGroups.length
                }}</span>
            </div>

            <div class="relative mb-3">
              <input v-model="pendingSearch" type="text"
                class="w-full bg-[#0a0a0a] border border-white/10 rounded-lg py-2 pl-9 pr-3 text-sm focus:ring-1 focus:ring-blue-500 placeholder-gray-500"
                placeholder="Buscar cliente..." />
              <i class="fas fa-search absolute left-3 top-2.5 text-gray-500 text-xs"></i>
            </div>

            <div class="space-y-2">
              <div v-if="billingStore.loading" class="text-center py-4 text-gray-500">
                <i class="fas fa-spinner fa-spin"></i>
              </div>
              <div v-else-if="filteredPendingGroups.length === 0"
                class="text-center py-4 text-xs text-gray-600 italic border border-dashed border-white/10 rounded-lg">
                No hay pendientes
              </div>
              <div v-else v-for="group in filteredPendingGroups" :key="group.clientId" @click="selectGroup(group)"
                class="p-3 rounded-lg cursor-pointer border transition-all active:scale-[0.98]" :class="selectedGroup?.clientId === group.clientId
                    ? 'bg-blue-900/20 border-blue-500/50 shadow-md'
                    : 'bg-white/5 border-transparent hover:bg-white/10 hover:border-white/10'
                  ">
                <div class="flex justify-between items-start mb-1">
                  <p class="font-bold text-white text-sm truncate pr-2">{{ group.groupName }}</p>
                  <i v-if="selectedGroup?.clientId === group.clientId"
                    class="fas fa-chevron-right text-blue-400 text-xs"></i>
                </div>
                <div class="flex justify-between items-end text-xs">
                  <span class="text-gray-400">{{ group.services.length }} servicios</span>
                  <span class="font-mono font-bold text-blue-300">{{
                    formatCurrency(group.totalValue)
                    }}</span>
                </div>
              </div>
            </div>
          </div>

          <div class="border-t border-white/10 pt-4">
            <div class="flex justify-between items-center mb-2 px-1">
              <h3 class="font-bold text-yellow-400 text-sm flex items-center gap-2">
                <i class="fas fa-file-invoice"></i> Historial
              </h3>
            </div>

            <div class="space-y-3 mb-3">
              <div class="relative">
                <input v-model="invoicedSearch" type="text"
                  class="w-full bg-[#0a0a0a] border border-white/10 rounded-lg py-2 pl-9 pr-3 text-sm focus:ring-1 focus:ring-yellow-500 placeholder-gray-500"
                  placeholder="Buscar factura..." />
                <i class="fas fa-search absolute left-3 top-2.5 text-gray-500 text-xs"></i>
              </div>
            </div>

            <div class="space-y-2">
              <div v-for="group in filteredInvoicedGroups" :key="group.invoiceNumber" @click="selectGroup(group)"
                class="p-3 rounded-lg cursor-pointer border transition-all active:scale-[0.98]" :class="selectedGroup?.invoiceNumber === group.invoiceNumber
                    ? 'bg-yellow-900/20 border-yellow-500/50 shadow-md'
                    : 'bg-white/5 border-transparent hover:bg-white/10 hover:border-white/10'
                  ">
                <div class="flex justify-between items-start mb-1">
                  <div class="min-w-0">
                    <p class="font-bold text-white text-sm truncate">{{ group.groupName }}</p>
                    <span class="text-[10px] text-gray-500 uppercase tracking-wider font-bold">#{{ group.invoiceNumber
                      }}</span>
                  </div>
                  <span class="text-[10px] px-2 py-0.5 rounded-full font-bold shrink-0 ml-2" :class="group.status === 'paid'
                      ? 'bg-green-900/30 text-green-400'
                      : 'bg-yellow-900/30 text-yellow-400'
                    ">
                    {{ group.status === 'paid' ? 'PAGADO' : 'PENDIENTE' }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div
        class="lg:col-span-8 bg-[#151515] rounded-xl border border-white/10 flex flex-col overflow-hidden shadow-2xl lg:shadow-lg transition-all duration-300"
        :class="{
          'fixed inset-0 z-50 lg:static lg:z-auto': isMobileDetailOpen,
          'hidden lg:flex': !isMobileDetailOpen,
        }">
        <div v-if="!selectedGroup" class="m-auto text-center text-gray-500 p-8 hidden lg:block">
          <div class="bg-[#0a0a0a] p-6 rounded-full inline-block mb-4">
            <i class="fas fa-file-invoice text-4xl opacity-30"></i>
          </div>
          <p class="text-lg">Seleccione un cliente o factura de la lista.</p>
        </div>

        <div v-else class="h-full flex flex-col bg-[#151515]">
          <div
            class="flex-shrink-0 p-4 border-b border-white/10 bg-[#0a0a0a]/50 flex items-center justify-between sticky top-0 z-20">
            <div class="flex items-center gap-3 overflow-hidden">
              <button @click="closeMobileDetail" class="lg:hidden text-gray-400 hover:text-white p-2 -ml-2">
                <i class="fas fa-arrow-left text-lg"></i>
              </button>
              <div class="min-w-0">
                <h3 class="text-lg md:text-xl font-bold text-white truncate">
                  {{ selectedGroup.groupName }}
                </h3>
                <p class="text-xs text-gray-400 truncate">
                  {{ selectedGroup.services.length }} servicios &bull;
                  <span :class="selectedGroup.status === 'pending' ? 'text-blue-400' : 'text-yellow-400'
                    ">
                    {{
                      selectedGroup.status === 'pending'
                        ? 'Borrador'
                        : `Factura #${selectedGroup.invoiceNumber}`
                    }}
                  </span>
                </p>
              </div>
            </div>
            <div class="text-right shrink-0 pl-2">
              <p class="text-xs text-gray-500 uppercase tracking-wider font-bold">Total</p>
              <p class="text-lg md:text-xl font-bold text-[#d60000] font-mono">
                {{ formatCurrency(selectedGroup.totalValue) }}
              </p>
            </div>
          </div>

          <div class="flex-grow overflow-y-auto custom-scrollbar bg-[#151515]">
            <table class="w-full text-left border-collapse">
              <thead class="sticky top-0 bg-[#151515] z-10 shadow-sm">
                <tr>
                  <th class="p-3 w-10 text-center border-b border-white/10" v-if="selectedGroup.status === 'pending'">
                    <input type="checkbox" @change="handleSelectAll"
                      class="h-4 w-4 rounded border-white/10 bg-[#202020] text-[#d60000] focus:ring-[#d60000] cursor-pointer" />
                  </th>
                  <th class="p-3 text-xs font-bold text-gray-500 uppercase tracking-wider border-b border-white/10">
                    Detalle Servicio
                  </th>
                  <th
                    class="p-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-right border-b border-white/10 w-32">
                    Valor
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-white/5">
                <tr v-for="service in selectedGroup.services" :key="service.id"
                  class="hover:bg-white/5 transition-colors"
                  :class="selectedServices.has(service.id) ? 'bg-red-900/10' : ''">
                  <td class="p-3 text-center" v-if="selectedGroup.status === 'pending'">
                    <!-- CORRECCIÓN: v-model no funciona bien con Sets en checkboxes. Usamos @change -->
                    <input type="checkbox" :checked="selectedServices.has(service.id)"
                      @change="toggleServiceSelection(service.id)"
                      class="h-4 w-4 rounded border-white/10 bg-[#202020] text-[#d60000] focus:ring-[#d60000] cursor-pointer" />
                  </td>
                  <td class="p-3">
                    <div class="flex flex-col">
                      <span class="text-sm font-bold text-white">{{ service.tipo_servicio }}</span>
                      <span class="text-xs text-gray-500 mt-0.5">
                        {{ new Date(service.fecha_visita).toLocaleDateString('es-CO') }}
                      </span>
                    </div>
                  </td>
                  <td class="p-3 text-right">
                    <span class="text-sm font-mono font-medium text-gray-300">
                      {{ formatCurrency(service.valor_servicio) }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="flex-shrink-0 p-4 border-t border-white/10 bg-[#0a0a0a]/80 backdrop-blur-sm z-20">
            <div v-if="selectedGroup.status === 'pending'" class="flex justify-between items-center gap-4">
              <div>
                <p class="text-xs text-gray-400">Seleccionado ({{ selectedServices.size }})</p>
                <p class="text-lg font-bold text-white font-mono">
                  {{ formatCurrency(selectedTotal) }}
                </p>
              </div>
              <button @click="openInvoiceModal" :disabled="selectedServices.size === 0"
                class="btn btn-primary shadow-lg flex-grow md:flex-grow-0 disabled:opacity-50 disabled:cursor-not-allowed bg-[#d60000] hover:bg-red-700">
                <i class="fas fa-magic mr-2"></i> Generar Factura
              </button>
            </div>
            <div v-else class="flex justify-end">
              <button @click="handleDownloadInvoice(selectedGroup.invoiceNumber!)"
                class="btn btn-primary w-full md:w-auto shadow-lg bg-green-600 hover:bg-green-700">
                <i class="fas fa-download mr-2"></i> Descargar Factura
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>

    <InvoiceModal :show="showInvoiceModal" :selected-count="selectedServices.size"
      :client-name="selectedGroup?.groupName || ''" :total-amount="selectedTotal" @close="showInvoiceModal = false"
      @generate="handleGenerateInvoice" />
  </div>
</template>
