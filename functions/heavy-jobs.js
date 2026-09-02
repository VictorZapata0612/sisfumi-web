/* eslint-disable @typescript-eslint/no-require-imports */

const { onCall, HttpsError } = require('firebase-functions/v2/https')
const { logger } = require('firebase-functions')
const admin = require('firebase-admin')

if (!admin.apps.length) {
  admin.initializeApp()
}

function getDb() {
  return admin.firestore()
}

exports.backfillInvoiceTechnicians = onCall(
  {
    cors: true,
    timeoutSeconds: 540,
    memory: '1GiB',
  },
  async (request) => {
    if (!request.auth || request.auth.token.role !== 'Administrador') {
      throw new HttpsError(
        'permission-denied',
        'Solo los administradores pueden ejecutar este script.',
      )
    }

    const db = getDb()
    const invoicesRef = db.collection('grupos_facturacion')
    let updatedInvoicesCount = 0
    const batchSize = 50
    let lastDoc = null

    logger.log('Iniciando script de backfill para técnicos en facturas...')

    try {
      while (true) {
        const query = lastDoc
          ? invoicesRef.orderBy(admin.firestore.FieldPath.documentId()).startAfter(lastDoc).limit(batchSize)
          : invoicesRef.orderBy(admin.firestore.FieldPath.documentId()).limit(batchSize)

        const snapshot = await query.get()
        if (snapshot.empty) break

        const batch = db.batch()

        for (const invoiceDoc of snapshot.docs) {
          const invoiceData = invoiceDoc.data()

          if (invoiceData.services && Array.isArray(invoiceData.services)) {
            const updatedServices = [...invoiceData.services]

            const servicePromises = updatedServices.map(async (service) => {
              if (Array.isArray(service.fumigadores_asignados)) {
                return service
              }

              let serviceDate
              if (service.date && typeof service.date.toDate === 'function') {
                serviceDate = service.date.toDate()
              } else if (typeof service.date === 'string') {
                serviceDate = new Date(service.date)
              } else {
                return service
              }

              const startOfDay = new Date(serviceDate)
              startOfDay.setUTCHours(0, 0, 0, 0)
              const endOfDay = new Date(serviceDate)
              endOfDay.setUTCHours(23, 59, 59, 999)

              const visitQuery = db
                .collection('visitas')
                .where('id_cliente', '==', invoiceData.clientId)
                .where('tipo_visita', '==', service.tipo_visita)
                .where('fecha_visita', '>=', startOfDay)
                .where('fecha_visita', '<=', endOfDay)
                .limit(1)

              const visitSnapshot = await visitQuery.get()

              if (!visitSnapshot.empty) {
                const originalVisitData = visitSnapshot.docs[0].data()
                return {
                  ...service,
                  fumigadores_asignados: originalVisitData.fumigadores_asignados || [],
                }
              }

              return service
            })

            const rebuiltServices = await Promise.all(servicePromises)

            if (JSON.stringify(invoiceData.services) !== JSON.stringify(rebuiltServices)) {
              batch.update(invoiceDoc.ref, { services: rebuiltServices })
              updatedInvoicesCount++
            }
          }
        }

        await batch.commit()
        lastDoc = snapshot.docs[snapshot.docs.length - 1]
      }

      const message = `¡Éxito! Se actualizaron los datos de técnicos en ${updatedInvoicesCount} facturas.`
      logger.log(message)
      return { success: true, message }
    } catch (error) {
      logger.error('Error durante el backfill de técnicos en facturas:', error)
      throw new HttpsError('internal', 'Ocurrió un error al actualizar las facturas.')
    }
  },
)

exports.backfillInvoiceZones = onCall(
  {
    cors: true,
    timeoutSeconds: 540,
    memory: '1GiB',
  },
  async (request) => {
    if (!request.auth || request.auth.token.role !== 'Administrador') {
      throw new HttpsError(
        'permission-denied',
        'Solo los administradores pueden ejecutar este script.',
      )
    }

    const db = getDb()
    const invoicesRef = db.collection('grupos_facturacion')
    const clientsRef = db.collection('clientes')
    let updatedCount = 0
    const batchSize = 100
    let lastDoc = null

    logger.log('Iniciando script de backfill para zonas de facturas...')

    try {
      while (true) {
        const query = lastDoc
          ? invoicesRef.orderBy(admin.firestore.FieldPath.documentId()).startAfter(lastDoc).limit(batchSize)
          : invoicesRef.orderBy(admin.firestore.FieldPath.documentId()).limit(batchSize)

        const snapshot = await query.get()
        if (snapshot.empty) {
          break
        }

        const batch = db.batch()
        const invoicesToUpdate = []

        snapshot.forEach((doc) => {
          const data = doc.data()
          if (!data.zona && data.clientId) {
            invoicesToUpdate.push({ id: doc.id, clientId: data.clientId })
          }
        })

        if (invoicesToUpdate.length > 0) {
          const clientIds = [...new Set(invoicesToUpdate.map((inv) => inv.clientId))]
          const clientDocs = await clientsRef.where(admin.firestore.FieldPath.documentId(), 'in', clientIds).get()
          const clientZoneMap = new Map()
          clientDocs.forEach((doc) => clientZoneMap.set(doc.id, doc.data().zona || 'Sin Zona'))

          invoicesToUpdate.forEach((invoice) => {
            const zone = clientZoneMap.get(invoice.clientId)
            if (zone) {
              const invoiceRef = invoicesRef.doc(invoice.id)
              batch.update(invoiceRef, { zona: zone })
              updatedCount++
            }
          })
          await batch.commit()
        }

        lastDoc = snapshot.docs[snapshot.docs.length - 1]
      }

      const message = `¡Éxito! Se actualizaron ${updatedCount} facturas con su zona correspondiente.`
      logger.log(message)
      return { success: true, message }
    } catch (error) {
      logger.error('Error durante el backfill de zonas en facturas:', error)
      throw new HttpsError('internal', 'Ocurrió un error al actualizar las facturas.')
    }
  },
)
