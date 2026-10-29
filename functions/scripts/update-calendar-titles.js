/**
 * Script de migración: Actualiza el título (summary) de todos los eventos
 * existentes en Google Calendar creados previamente por SISFUMI.
 *
 * Ejecución desde la carpeta functions:
 * node scripts/update-calendar-titles.js
 */

const admin = require('firebase-admin')
const { google } = require('googleapis')
const path = require('path')

// Cargar credenciales de la cuenta de servicio local
const serviceAccountPath = path.join(__dirname, '../serviceAccountKey.json')
let serviceAccount

try {
  serviceAccount = require(serviceAccountPath)
} catch (e) {
  console.error('❌ Error: No se encontró el archivo serviceAccountKey.json en la carpeta functions/.')
  console.error('Descárgalo desde Firebase Console -> Configuración del proyecto -> Cuentas de servicio.')
  process.exit(1)
}

// Inicializar Firebase Admin con las credenciales
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  })
}

const db = admin.firestore()

// Opcional: Si tienes el CLIENT_ID y CLIENT_SECRET configurados
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID ||
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET ||

async function updateExistingCalendarEvents() {
  console.log('🚀 Iniciando actualización de títulos en Google Calendar...')

  try {
    const visitsSnapshot = await db
      .collection('visitas')
      .where('googleEventId', '!=', null)
      .get()

    if (visitsSnapshot.empty) {
      console.log('⚠️ No se encontraron visitas con eventos de Google Calendar.')
      process.exit(0)
    }

    console.log(`📋 Se encontraron ${visitsSnapshot.size} visitas con eventos en Google Calendar.`)

    const oauthClientsCache = {}
    let updatedCount = 0
    let errorCount = 0

    for (const doc of visitsSnapshot.docs) {
      const visitData = doc.data()
      const visitId = doc.id
      const googleEventId = visitData.googleEventId
      const organizerUid = visitData.organizerUid || visitData.createdBy

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
            console.log(`⚠️ Integración no encontrada para el organizador ${organizerUid}. Omitiendo...`)
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

        // Formato: "CLIENTE - SUCURSAL / UBICACIÓN - TIPO DE SERVICIO"
        const sucursalInfo = visitData.sucursal || visitData.ubicacion || ''
        const sucursalPart = sucursalInfo ? ` - ${sucursalInfo}` : ''
        const tipoServicioPart = visitData.tipo_visita ? ` - ${visitData.tipo_visita}` : ''
        const newTitle = `${visitData.nombre_cliente}${sucursalPart}${tipoServicioPart}`

        await calendar.events.patch({
          calendarId: 'primary',
          eventId: googleEventId,
          requestBody: {
            summary: newTitle,
          },
        })

        updatedCount++
        console.log(`✅ [${updatedCount}/${visitsSnapshot.size}] Evento actualizado: "${newTitle}"`)
      } catch (err) {
        errorCount++
        console.error(`❌ Error actualizando evento para visita ${visitId}:`, err.message)
      }
    }

    console.log('\n🎉 Proceso finalizado:')
    console.log(`- Total eventos actualizados: ${updatedCount}`)
    console.log(`- Errores / Omitidos: ${errorCount}`)
  } catch (error) {
    console.error('💥 Error durante el proceso:', error)
  }

  process.exit(0)
}

updateExistingCalendarEvents()
