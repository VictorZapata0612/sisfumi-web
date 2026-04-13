import { ref } from 'vue'
import { defineStore } from 'pinia'
import { httpsCallable } from 'firebase/functions'
import { functions } from '@/firebase/config'

// Interfaces para los datos del reporte anual
export interface AnnualReportData {
  kpis: {
    totalPaid: number
    totalBilledUnpaid: number
    totalPendingBilling: number
    totalVisits: number
    billedVisits: number
  }
  monthlyTrend: number[]
  quarterlyComparison: Record<string, { totalServices: number; billedServices: number }>
  topClients: { clientId: string; clientName: string; totalPaid: number }[]
  technicianRates: {
    technicianId: string
    technicianName: string
    complianceRate: number
    totalVisits: number
  }[]
  serviceDistributionByZone: Record<string, number>
}

export const useReportsStore = defineStore('reports', () => {
  // --- State ---
  const loading = ref(false)
  const error = ref<string | null>(null)
  const annualReportData = ref<AnnualReportData | null>(null)

  // --- Actions ---

  /**
   * Obtiene los datos para el reporte anual de facturación.
   * @param year - El año para el cual generar el reporte.
   * @param zone - La zona a filtrar (opcional, para admins).
   */
  async function fetchAnnualBillingReport(year: number, zone?: string) {
    loading.value = true
    error.value = null
    annualReportData.value = null // Limpiar datos anteriores

    try {
      const getReportFn = httpsCallable(functions, 'getAnnualBillingReport')
      const result = (await getReportFn({ year, zone })) as { data: AnnualReportData }
      annualReportData.value = result.data
    } catch (err: any) {
      console.error('Error fetching annual report:', err)
      error.value = `No se pudo generar el reporte: ${err.message}`
    } finally {
      loading.value = false
    }
  }

  return {
    loading,
    error,
    annualReportData,
    fetchAnnualBillingReport,
  }
})
