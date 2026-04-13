import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { httpsCallable } from 'firebase/functions'
import { functions } from '@/firebase/config'

// --- Interfaces para Tipado ---

export interface BillingService {
  id: string
  nombre_cliente: string
  tipo_visita: string
  ubicacion: string
  fecha_visita: string | Date
  valor_servicio: number
  [key: string]: any
}

export interface BillingGroup {
  clientId: string
  groupName: string
  clientName?: string // <-- AÑADIDO
  clientNit: string
  clientAddress: string
  services: BillingService[]
  totalValue: number
  status: 'pending' | 'billed' | 'paid' | 'partially_paid'
  month: number
  year: number
  invoiceNumber?: string
  createdAt?: string | Date
  dueDate?: string | Date
  observations?: string
  paymentHistory?: any[] // <-- AÑADIDO
}

// --- Store de Pinia ---

export const useBillingStore = defineStore('billing', () => {
  // --- State ---
  const pendingGroups = ref<BillingGroup[]>([])
  const invoicedGroups = ref<BillingGroup[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const currentDate = ref(new Date())
  // --- ✅ NUEVO: Estado para filtros y búsqueda ---
  const pendingSearchTerm = ref('')
  const invoicedSearchTerm = ref('')
  const invoicedStatusFilter = ref('todos') // 'todos', 'billed', 'partially_paid', 'paid'

  // --- ✅ NUEVO: Estado para el ordenamiento de la tabla de detalles ---
  const detailSort = ref({ key: 'fecha_visita', order: 'asc' })

  // --- ✅ NUEVO: Getters para listas filtradas (DEFINIDOS ANTES DE USARSE) ---
  const filteredPendingGroups = computed(() => {
    if (!pendingSearchTerm.value) return pendingGroups.value
    const term = pendingSearchTerm.value.toLowerCase()
    return pendingGroups.value.filter(
      (g) =>
        g.groupName.toLowerCase().includes(term) ||
        (g.clientName && g.clientName.toLowerCase().includes(term)),
    )
  })

  const filteredInvoicedGroups = computed(() => {
    const term = invoicedSearchTerm.value.toLowerCase()
    return invoicedGroups.value.filter((g) => {
      const matchesSearch =
        g.groupName.toLowerCase().includes(term) ||
        (g.clientName && g.clientName.toLowerCase().includes(term)) ||
        (g.invoiceNumber && g.invoiceNumber.toLowerCase().includes(term))
      const matchesStatus =
        invoicedStatusFilter.value === 'todos' || g.status === invoicedStatusFilter.value
      return matchesSearch && matchesStatus
    })
  })

  // --- Getters ---
  const kpis = computed(() => {
    // ✅ CORRECCIÓN: Usar las listas filtradas para que los KPIs sean dinámicos.
    const billed = filteredInvoicedGroups.value.reduce((sum, g) => sum + g.totalValue, 0)
    const pendingToInvoice = filteredPendingGroups.value.reduce((sum, g) => sum + g.totalValue, 0)
    // Aquí necesitarías una lógica más compleja para el total pagado si manejas pagos parciales.
    // Por ahora, asumimos que 'paid' significa 100% pagado.
    const paid = filteredInvoicedGroups.value.reduce((sum, g) => {
      // Si el grupo está totalmente pagado, suma el valor total.
      if (g.status === 'paid') {
        return sum + g.totalValue
      }
      // Si tiene historial de pagos, suma los abonos.
      if (g.paymentHistory && g.paymentHistory.length > 0) {
        const paidInGroup = g.paymentHistory.reduce(
          (paymentSum: number, p: any) => paymentSum + (p.amount || 0),
          0,
        )
        return sum + paidInGroup
      }
      return sum
    }, 0)

    const pendingPayment = billed - paid

    return { billed, pendingToInvoice, paid, pendingPayment, totalBilled: billed }
  })

  // --- Actions ---

  /**
   * Carga los datos de facturación para un mes y año específicos.
   */
  async function fetchBillingData() {
    loading.value = true
    error.value = null
    try {
      const getBillingDataFn = httpsCallable(functions, 'getBillingDataForMonth')
      const result = (await getBillingDataFn({
        month: currentDate.value.getMonth(),
        year: currentDate.value.getFullYear(),
      })) as { data: { pendingGroups: BillingGroup[]; invoicedGroups: BillingGroup[] } }

      // ✅ CORRECCIÓN: Mapear y limpiar los datos recibidos para asegurar tipos correctos.
      const processGroup = (group: any): BillingGroup => {
        const safeServices = (group.services || []).map((s: any) => {
          // --- Lógica robusta para encontrar una fecha válida ---
          let safeDate = new Date() // Fallback a la fecha actual
          const dateFields = [s.fecha_visita, s.date, s.createdAt]
          for (const field of dateFields) {
            if (field) {
              let d
              if (field.toDate)
                d = field.toDate() // Timestamp de Firestore
              else if (field._seconds)
                d = new Date(field._seconds * 1000) // Objeto Timestamp serializado
              else d = new Date(field) // String ISO u otro formato

              if (d instanceof Date && !isNaN(d.getTime())) {
                safeDate = d
                break // Encontramos una fecha válida, salimos del bucle
              }
            }
          }

          // --- Lógica robusta para encontrar un valor válido ---
          const finalValue =
            Number(s.valor_servicio) || Number(s.value) || Number(s.billingData?.serviceValue) || 0

          return { ...s, fecha_visita: safeDate, valor_servicio: finalValue }
        })

        return {
          ...group,
          services: safeServices,
          totalValue: Number(group.totalValue) || 0,
          // Asegurar que las fechas del grupo también sean objetos Date
          createdAt: group.createdAt ? new Date(group.createdAt) : null,
          dueDate: group.dueDate ? new Date(group.dueDate) : null,
        }
      }
      pendingGroups.value = (result.data.pendingGroups || []).map(processGroup)
      invoicedGroups.value = (result.data.invoicedGroups || []).map(processGroup)
    } catch (err: any) {
      error.value = `Error al cargar datos de facturación: ${err.message}`
    } finally {
      loading.value = false
    }
  }

  /**
   * Genera un reporte de factura y devuelve el archivo Excel en base64.
   */
  async function generateInvoiceReport(options: {
    visitIds: string[]
    groupName: string
    dueDays: number
    observations: string
  }) {
    const generateFn = httpsCallable(functions, 'generateInvoiceReport')
    const result = (await generateFn(options)) as {
      data: { success: boolean; invoiceId: string; invoiceNumber: string; fileData: string }
    }
    return result.data
  }

  /**
   * Descarga un reporte de factura existente.
   */
  async function downloadExistingInvoice(invoiceNumber: string) {
    const downloadFn = httpsCallable(functions, 'getInvoiceExcel')
    const result = (await downloadFn({ invoiceNumber })) as { data: { fileData: string } }
    return result.data
  }

  const changeMonth = (offset: number) => {
    currentDate.value = new Date(currentDate.value.setMonth(currentDate.value.getMonth() + offset))
    fetchBillingData()
  }

  // --- ✅ NUEVO: Acción para cambiar el ordenamiento ---
  const setDetailSort = (key: string) => {
    if (detailSort.value.key === key) {
      detailSort.value.order = detailSort.value.order === 'asc' ? 'desc' : 'asc'
    } else {
      detailSort.value.key = key
      // Por defecto, las fechas se ordenan ascendente y los valores descendente.
      detailSort.value.order = key === 'valor_servicio' ? 'desc' : 'asc'
    }
  }

  return {
    pendingGroups,
    invoicedGroups,
    loading,
    error,
    currentDate,
    kpis,
    fetchBillingData,
    generateInvoiceReport,
    downloadExistingInvoice,
    changeMonth,
    // --- ✅ NUEVO: Exponer nuevos estados y getters ---
    // ✅ CORRECCIÓN: Se añaden las propiedades que faltaban al return.
    pendingSearchTerm,
    invoicedSearchTerm,
    invoicedStatusFilter,
    filteredPendingGroups,
    filteredInvoicedGroups,
    detailSort,
    setDetailSort,
  }
})
