const admin = require('firebase-admin')

admin.initializeApp()

const db = admin.firestore()
const invoicesRef = db.collection('grupos_facturacion')

async function backfillTechnicians() {
  let updatedInvoicesCount = 0
  let lastDoc = null
  const batchSize = 50

  while (true) {
    const query = lastDoc
      ? invoicesRef
          .orderBy(admin.firestore.FieldPath.documentId())
          .startAfter(lastDoc)
          .limit(batchSize)
      : invoicesRef.orderBy(admin.firestore.FieldPath.documentId()).limit(batchSize)

    const snapshot = await query.get()
    if (snapshot.empty) break

    const batch = db.batch()
    const invoicesToProcess = snapshot.docs
      .map((doc) => ({ doc, data: doc.data() }))
      .filter(({ data }) => Array.isArray(data.services) && data.services.length > 0)

    await Promise.all(
      invoicesToProcess.map(async ({ doc: invoiceDoc, data: invoiceData }) => {
        const rebuiltServices = await Promise.all(
          invoiceData.services.map(async (service) => {
            if (Array.isArray(service.fumigadores_asignados)) return service

            const serviceDate =
              service.date && typeof service.date.toDate === 'function'
                ? service.date.toDate()
                : typeof service.date === 'string'
                  ? new Date(service.date)
                  : null

            if (!serviceDate || Number.isNaN(serviceDate.getTime())) return service

            const startOfDay = new Date(serviceDate)
            startOfDay.setUTCHours(0, 0, 0, 0)
            const endOfDay = new Date(serviceDate)
            endOfDay.setUTCHours(23, 59, 59, 999)

            const visitSnapshot = await db
              .collection('visitas')
              .where('id_cliente', '==', invoiceData.clientId)
              .where('tipo_visita', '==', service.tipo_visita)
              .where('fecha_visita', '>=', startOfDay)
              .where('fecha_visita', '<=', endOfDay)
              .limit(1)
              .get()

            if (visitSnapshot.empty) return service

            return {
              ...service,
              fumigadores_asignados:
                visitSnapshot.docs[0].data().fumigadores_asignados || [],
            }
          }),
        )

        if (JSON.stringify(invoiceData.services) !== JSON.stringify(rebuiltServices)) {
          batch.update(invoiceDoc.ref, { services: rebuiltServices })
          updatedInvoicesCount++
        }
      }),
    )

    await batch.commit()
    lastDoc = snapshot.docs[snapshot.docs.length - 1]
  }

  return `Se actualizaron los datos de técnicos en ${updatedInvoicesCount} facturas.`
}

async function backfillZones() {
  let updatedCount = 0
  let lastDoc = null
  const batchSize = 100
  const clientsRef = db.collection('clientes')

  while (true) {
    const query = lastDoc
      ? invoicesRef
          .orderBy(admin.firestore.FieldPath.documentId())
          .startAfter(lastDoc)
          .limit(batchSize)
      : invoicesRef.orderBy(admin.firestore.FieldPath.documentId()).limit(batchSize)

    const snapshot = await query.get()
    if (snapshot.empty) break

    const invoicesToUpdate = snapshot.docs
      .map((doc) => ({ id: doc.id, clientId: doc.data().clientId, zona: doc.data().zona }))
      .filter(({ clientId, zona }) => clientId && !zona)

    const clientIds = [...new Set(invoicesToUpdate.map((invoice) => invoice.clientId))]
    const clientZoneMap = new Map()

    for (let index = 0; index < clientIds.length; index += 30) {
      const clientIdChunk = clientIds.slice(index, index + 30)
      const clientDocs = await clientsRef
        .where(admin.firestore.FieldPath.documentId(), 'in', clientIdChunk)
        .get()
      clientDocs.forEach((doc) => clientZoneMap.set(doc.id, doc.data().zona || 'Sin Zona'))
    }

    const batch = db.batch()
    invoicesToUpdate.forEach((invoice) => {
      const zone = clientZoneMap.get(invoice.clientId)
      if (zone) {
        batch.update(invoicesRef.doc(invoice.id), { zona: zone })
        updatedCount++
      }
    })

    if (invoicesToUpdate.length > 0) await batch.commit()
    lastDoc = snapshot.docs[snapshot.docs.length - 1]
  }

  return `Se actualizaron ${updatedCount} facturas con su zona correspondiente.`
}

const operation = process.argv[2]

if (!['technicians', 'zones'].includes(operation)) {
  console.error('Uso: node scripts/backfill-invoice-data.js technicians|zones')
  process.exitCode = 1
} else {
  const run = operation === 'technicians' ? backfillTechnicians : backfillZones
  run()
    .then((message) => console.log(message))
    .catch((error) => {
      console.error(error)
      process.exitCode = 1
    })
}
