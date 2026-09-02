const { onCall, HttpsError } = require('firebase-functions/v2/https')
const { logger } = require('firebase-functions')
const admin = require('firebase-admin')

if (!admin.apps.length) {
  admin.initializeApp()
}

exports.getAnnualBillingReport = onCall(
  { timeoutSeconds: 180, memory: '512MB' },
  async (request) => {
    const { auth, data } = request
    if (!auth) {
      throw new HttpsError('unauthenticated', 'El usuario no está autenticado.')
    }

    const userZone = auth.token.zona
    const userRole = auth.token.role
    const hasGlobalAccess = [
      'Administrador',
      'Jefe',
      'Coordinador Nacionales',
      'Coordinador Nacional',
      'Gerente',
    ].includes(userRole)

    const { year, zone: requestedZone } = data
    if (typeof year !== 'number') {
      throw new HttpsError('invalid-argument', 'Se requiere el año.')
    }

    if (!userZone && !hasGlobalAccess) {
      throw new HttpsError(
        'permission-denied',
        'No tienes los permisos o la zona asignada para ver reportes.',
      )
    }

    try {
      const db = admin.firestore()

      let zoneToFilter = null
      if (hasGlobalAccess && requestedZone && requestedZone !== 'Todos') {
        zoneToFilter = requestedZone
      } else if (!hasGlobalAccess) {
        zoneToFilter = userZone
      }

      let invoicesQuery = db.collection('grupos_facturacion').where('year', '==', year)
      if (zoneToFilter) {
        invoicesQuery = invoicesQuery.where('zona', '==', zoneToFilter)
      }
      const invoicesSnapshot = await invoicesQuery.get()

      const paymentPromises = invoicesSnapshot.docs.map((doc) => doc.ref.collection('payments').get())
      const paymentsByInvoice = await Promise.all(paymentPromises)

      const monthlyTrend = new Array(12).fill(0)
      const clientRevenue = {}
      const serviceDistributionByZone = {}
      let totalPaid = 0
      let totalBilledUnpaid = 0

      invoicesSnapshot.docs.forEach((invoiceDoc, index) => {
        const invoiceData = invoiceDoc.data()
        const paymentsSnapshot = paymentsByInvoice[index]

        const invoiceTotal = invoiceData.totalValue || 0
        let invoicePaidAmount = 0

        paymentsSnapshot.forEach((paymentDoc) => {
          const paymentData = paymentDoc.data()
          const paymentAmount = paymentData.amount || 0
          invoicePaidAmount += paymentAmount

          const paymentDate = paymentData.paymentDate?.toDate()
          if (paymentDate && !isNaN(paymentDate.getTime())) {
            const month = paymentDate.getMonth()
            monthlyTrend[month] += paymentAmount
          }
        })

        totalPaid += invoicePaidAmount
        totalBilledUnpaid += invoiceTotal - invoicePaidAmount

        const clientId = invoiceData.clientId
        if (clientId) {
          if (!clientRevenue[clientId]) {
            clientRevenue[clientId] = {
              totalPaid: 0,
              clientName: invoiceData.clientName,
            }
          }
          clientRevenue[clientId].totalPaid += invoicePaidAmount
        }

        const zoneKey = invoiceData.zona || 'Sin Zona'
        serviceDistributionByZone[zoneKey] =
          (serviceDistributionByZone[zoneKey] || 0) + (invoiceData.servicesCount || 0)
      })

      let pendingVisitsQuery = db
        .collection('visitas')
        .where('estado_visita', '==', 'Realizada')
        .where('estado_facturacion', '==', 'Pendiente')
      if (zoneToFilter) {
        pendingVisitsQuery = pendingVisitsQuery.where('zona', '==', zoneToFilter)
      }
      const pendingVisitsSnapshot = await pendingVisitsQuery.get()
      let totalPendingBilling = 0
      pendingVisitsSnapshot.forEach((doc) => {
        totalPendingBilling += doc.data().valor_servicio || 0
      })

      const topClients = Object.entries(clientRevenue)
        .sort(([, a], [, b]) => b.totalPaid - a.totalPaid)
        .slice(0, 10)
        .map(([clientId, data]) => ({
          clientId,
          clientName: data.clientName,
          totalPaid: data.totalPaid,
        }))

      return {
        kpis: {
          totalPaid,
          totalBilledUnpaid,
          totalPendingBilling,
          totalVisits: 0,
          billedVisits: 0,
        },
        monthlyTrend,
        quarterlyComparison: {},
        topClients,
        technicianRates: [],
        serviceDistributionByZone,
      }
    } catch (error) {
      logger.error('Error en getAnnualBillingReport:', error)
      throw new HttpsError('internal', 'Ocurrió un error al generar el reporte anual.')
    }
  },
)
