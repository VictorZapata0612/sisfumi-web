/**
 * Script de migración: Actualiza el colorId de los eventos en Google Calendar
 * asignando el color '11' (Tomate / Rojo) a las visitas grupales (>1 técnico).
 *
 * Ejecución desde la carpeta functions:
 * node scripts/update-calendar-colors.js
 */

const admin = require('firebase-admin')
const { google } = require('googleapis')
const path = require('path')

const serviceAccountPath = path.join(__dirname, '../serviceAccountKey.json')
let serviceAccount

try {
  serviceAccount = require(serviceAccountPath)
} catch (e) {
  console.error('❌ Error: No se encontró serviceAccountKey.json en functions/.')
  process.exit(1)
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  })
}

const db = admin.firestore()

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || ''
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || ''
const GROUP_COLOR_ID = '11' // Color Tomate (Rojo)

async function updateCalendarColorsToTomato() {
  console.log('🚀 Actualizando eventos grupales al color Tomate (11)...')

  try {
    const visitsSnapshot = await db
      .collection('visitas')
      .where('googleEventId', '!=', null)
      .get()

    if (visitsSnapshot.empty) {
      console.log('⚠️ No se encontraron visitas sincronizadas con Google Calendar.')
      process.exit(0)
    }

    const oauthClientsCache = {}
    let updatedCount = 0
    let skippedCount = 0
    let errorCount = 0

    for (const doc of visitsSnapshot.docs) {
      const visitData = doc.data()
      const visitId = doc.id
      const googleEventId = visitData.googleEventId
      const organizerUid = visitData.organizerUid || visitData.createdBy
      const fumigadores = visitData.fumigadores_asignados || []

      // Solo procesamos eventos grupales (más de 1 técnico)
      if (fumigadores.length <= 1) {
        skippedCount++
        continue
      }

      if (!googleEventId || !organizerUid) {
        console.log(`⏩ Omitiendo visita ${visitId}: falta googleEventId u organizerUid.`)
        continue
      }

      try {
        if (!oauthClientsCache[organizerUid]) {
          const integrationDoc = await db
            .collection('calendar_integrations')
            .doc(organizerUid)
            .get()

          if (!integrationDoc.exists) {
            console.log(`⚠️ Integración no encontrada para ${organizerUid}. Omitiendo...`)
            continue
          }

          const tokens = integrationDoc.data()
          const oAuth2Client = new google.auth.OAuth2(
            GOOGLE_CLIENT_ID || tokens.clientId,
            GOOGLE_CLIENT_SECRET || tokens.clientSecret
          )
          oAuth2Client.setCredentials(tokens)

          oauthClientsCache[organizerUid] = google.calendar({ version: 'v3', auth: oAuth2Client })
        }

        const calendar = oauthClientsCache[organizerUid]

        // Aplicar el color Tomate '11'
        await calendar.events.patch({
          calendarId: 'primary',
          eventId: googleEventId,
          requestBody: {
            colorId: GROUP_COLOR_ID,
          },
        })

        updatedCount++
        console.log(`✅ [${updatedCount}] Evento ${googleEventId} cambiado a Tomate (${fumigadores.length} técnicos).`)
      } catch (err) {
        errorCount++
        console.error(`❌ Error actualizando color para visita ${visitId}:`, err.message)
      }
    }

    console.log('\n🎉 Proceso finalizado:')
    console.log(`- Eventos cambiados a Tomate: ${updatedCount}`)
    console.log(`- Eventos individuales conservados: ${skippedCount}`)
    console.log(`- Errores: ${errorCount}`)
  } catch (error) {
    console.error('💥 Error en el script:', error)
  }

  process.exit(0)
}

updateCalendarColorsToTomato()
