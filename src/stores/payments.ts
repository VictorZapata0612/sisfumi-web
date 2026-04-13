import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { httpsCallable } from 'firebase/functions'
import { functions } from '@/firebase/config'
import * as XLSX from 'xlsx'

export interface Payment {
  id: string
  amount: number
  paymentDate: string // ISO String
  method: string
  reference?: string
  registeredAt: string // ISO String
}

export interface InvoiceGroup {
  id: string
  clientName: string
  invoiceNumber: string
  totalBilled: number
  totalPaid: number
  currentBalance: number
  status: 'billed' | 'partially_paid' | 'paid'
  dueDate: string // ISO String
  paymentHistory: Payment[]
  [key: string]: any
}

export const usePaymentsStore = defineStore('payments', () => {
  // --- State ---
  const loading = ref(false)
  const error = ref<string | null>(null)
  const allGroups = ref<InvoiceGroup[]>([])
  const currentDate = ref(new Date()) // Inicializar currentDate
  const searchTerm = ref('') // Estado para el término de búsqueda
  const statusFilter = ref('todos') // Estado para el filtro de estado
  const selectedGroup = ref<InvoiceGroup | null>(null) // Estado para el grupo seleccionado

  // --- Getters ---
  const filteredGroups = computed(() => {
    let groups = allGroups.value

    // Aplicar filtro de búsqueda
    if (searchTerm.value) {
      const term = searchTerm.value.toLowerCase()
      groups = groups.filter(
        (group) =>
          group.invoiceNumber.toLowerCase().includes(term) ||
          group.clientName.toLowerCase().includes(term),
      )
    }

    // Aplicar filtro de estado
    if (statusFilter.value !== 'todos') {
      groups = groups.filter((group) => group.status === statusFilter.value)
    }

    return groups
  })

  const kpis = computed(() => {
    const totalBilled = filteredGroups.value.reduce((sum, g) => sum + g.totalBilled, 0)
    const totalPaid = filteredGroups.value.reduce((sum, g) => sum + g.totalPaid, 0)
    // Calcular el saldo pendiente de los grupos filtrados
    const totalPending = filteredGroups.value.reduce((sum, g) => sum + g.currentBalance, 0)

    return {
      totalBilled,
      totalPaid,
      totalPending,
    }
  })

  // --- Actions ---

  /**
   * Obtiene todos los datos de facturación y pagos para un mes y año específicos.
   */
  async function fetchPaymentData() {
    loading.value = true
    error.value = null
    try {
      const getPaymentDataFn = httpsCallable(functions, 'getPaymentDataForMonth') // Asume que esta función existe en tu backend
      const result = (await getPaymentDataFn({
        month: currentDate.value.getMonth(), // Usar currentDate del store
        year: currentDate.value.getFullYear(), // Usar currentDate del store
      })) as {
        data: { allGroups: InvoiceGroup[] }
      }
      allGroups.value = result.data.allGroups
    } catch (err: any) {
      console.error('Error fetching payment data:', err)
      error.value = `No se pudieron cargar los datos de pagos: ${err.message}`
    } finally {
      loading.value = false
    }
  }

  /**
   * Registra un nuevo abono a una factura.
   */
  async function registerPayment(invoiceId: string, paymentDetails: any) {
    const invoice = allGroups.value.find((g) => g.id === invoiceId)
    if (!invoice) throw new Error('No se encontró la factura para registrar el pago.')

    const registerPaymentFn = httpsCallable(functions, 'registerPartialPayment') // Asume que esta función existe en tu backend
    await registerPaymentFn({
      invoiceNumber: invoice.invoiceNumber, // Se asume que la Cloud Function usa invoiceNumber
      paymentDetails,
    })
    // Después de un registro exitoso, recargar los datos para actualizar KPIs y listas
    await fetchPaymentData()
  }

  /**
   * Exporta los datos de pago actuales a un archivo Excel.
   */
  async function exportToExcel() {
    loading.value = true
    try {
      const exportFn = httpsCallable(functions, 'exportPaymentDataToExcel')
      const result = (await exportFn({ paymentGroups: allGroups.value })) as {
        data: { fileData: string } // La Cloud Function debe devolver el base64 directamente
      }

      // La vista espera el string base64 para manejar la descarga
      return result.data.fileData
    } catch (err: any) {
      console.error('Error exporting to Excel:', err)
      throw new Error(`No se pudo generar el archivo Excel: ${err.message}`)
    } finally {
      loading.value = false
    }
  }

  /**
   * Cambia el mes actual y recarga los datos de pagos.
   */
  function changeMonth(offset: number) {
    const newDate = new Date(currentDate.value)
    newDate.setDate(1) // Ir al primer día para evitar problemas con meses de distinta duración
    newDate.setMonth(newDate.getMonth() + offset)
    currentDate.value = newDate
    fetchPaymentData()
  }

  /**
   * Selecciona un grupo de facturas por su ID.
   */
  function selectGroup(groupId: string) {
    selectedGroup.value = allGroups.value.find((g) => g.id === groupId) || null
  }

  return {
    loading,
    error,
    allGroups,
    currentDate, // Exponer currentDate
    searchTerm, // Exponer searchTerm
    statusFilter, // Exponer statusFilter
    filteredGroups, // Exponer filteredGroups
    kpis, // Exponer kpis
    selectedGroup, // Exponer selectedGroup
    fetchPaymentData,
    registerPayment,
    exportToExcel,
    changeMonth, // Exponer changeMonth
    selectGroup, // Exponer selectGroup
  }
})
