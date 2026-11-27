const admin = require('firebase-admin')
const { reconcileRecurringSheet } = require('../recurring-visits')

async function main() {
  const args = process.argv.slice(2)
  const project = args.find(arg => arg.startsWith('--project='))?.slice(10)
  const clientId = args.find(arg => arg.startsWith('--client='))?.slice(9)
  const apply = args.includes('--apply')
  const all = args.includes('--all')
  if (!project || (clientId && all) || (apply && !clientId && !all) ||
    args.some(arg => !/^--(project|client)=[^/]+$/.test(arg) && !['--apply', '--all'].includes(arg))) {
    throw new Error('Uso: node functions/scripts/reconcile-recurring-visits.js --project=PROYECTO [--client=ID | --all] [--apply]')
  }
  admin.initializeApp({ projectId: project })
  const db = admin.firestore()
  const catalog = db.collection('servicios')
  const snapshot = await (clientId ? catalog.where('clientId', '==', clientId) : catalog).select('clientId').get()
  if (clientId && snapshot.empty) throw new Error('No se encontro ninguna ficha para el cliente indicado.')

  const totals = { create: 0, update: 0, cancel: 0, serviceSheets: 0, warnings: 0, failures: 0 }
  const now = Date.now()
  console.log(JSON.stringify({ project, mode: apply ? 'apply' : 'dry-run', clientId, sheets: snapshot.size }))
  for (const doc of snapshot.docs) {
    try {
      const result = await reconcileRecurringSheet(db, admin, doc.ref, { apply, persistServices: true, now })
      if (result.serviceChanges) totals.serviceSheets++
      for (const warning of result.warnings) {
        totals.warnings++
        console.log(JSON.stringify({ sheetId: doc.id, ...warning }))
      }
      for (const { action, id, previous, data } of result.changes) {
        totals[action]++
        console.log(JSON.stringify({ sheetId: doc.id, action, visitId: id, previous, next: data }))
      }
    } catch (error) {
      totals.failures++
      console.error(JSON.stringify({ sheetId: doc.id, error: error.message }))
    }
  }
  console.log(JSON.stringify({ totals }))
  if (totals.failures) process.exitCode = 1
}

main().catch(error => {
  console.error(error.message)
  process.exitCode = 1
})
