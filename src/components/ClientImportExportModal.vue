<!-- eslint-disable @typescript-eslint/no-explicit-any -->
<script setup lang="ts">
import { ref, watch } from 'vue'
import { httpsCallable } from 'firebase/functions'
import { functions } from '@/firebase/config'
import ExcelJS from 'exceljs'
import { saveAs } from 'file-saver'
import * as XLSX from 'xlsx' // Se mantiene para la lectura/importación
import { validateRow } from '@/utils/clientValidators'

// Importamos los catálogos estáticos
import {
  ZONAS, TIPOS, ALIADOS, TIPOS_DIRECTO, SEDES, ESTADOS,
  DEPARTAMENTOS, CIUDADES_POR_DEP
} from '@/data/catalogs'

const props = defineProps<{
  show: boolean
}>()

const emit = defineEmits(['close', 'refresh'])

const dialog = ref<HTMLDialogElement>()
const feedback = ref('')
watch([() => props.show, dialog], ([show, element]) => {
  if (show && !element?.open) element?.showModal()
  if (!show && element?.open) element.close()
}, { flush: 'post' })

const loading = ref(false)
const processing = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)
const selectedFile = ref<File | null>(null)
const importStats = ref<{ total: number; success: number; failed: number; errors: string[] } | null>(
  null,
)
const showConfirmation = ref(false)
const importPreview = ref<{
  validRows: any[]
  invalidRows: { row: number; errors: string[] }[]
  total: number
} | null>(null)
const importProgress = ref(0)
const MAX_BRANCHES = 50
const MAX_TEMPLATE_ROWS = 5000

// Cabeceras EXACTAS de la hoja "Plantilla Clientes"
const BASE_EXCEL_HEADERS = [
  'nombreComercial',                 // 0
  'razonSocial',                     // 1
  'nit',                             // 2
  'zona',                            // 3
  'departamento',                    // 4
  'ciudad',                          // 5
  'direccion',                       // 6
  'estado',                          // 7
  'tipo',                            // 8
  'aliado',                          // 9
  'tipoDirecto',                     // 10
  'sede',                            // 11
  'contactoPrincipal_nombre',        // 12
  'contactoPrincipal_celular',       // 13
  'contactoPrincipal_email',         // 14
  'contactoFinanciero_nombre',       // 15
  'contactoFinanciero_celular',      // 16
  'contactoFinanciero_email',        // 17
]

const createExcelHeaders = (branchCount: number) => [
  ...BASE_EXCEL_HEADERS.slice(0, 18),
  ...Array.from({ length: branchCount }, (_, index) => {
    const branchNumber = index + 1
    return [`sucursal${branchNumber}_nombre`, `sucursal${branchNumber}_direccion`, `sucursal${branchNumber}_zona`]
  }).flat(),
]

const EXCEL_HEADERS = createExcelHeaders(MAX_BRANCHES)


// Mapeo de filas de Excel a Objeto Cliente
const mapRowToClient = (row: any[]) => {
  // Validaciones básicas: Nombre y NIT son obligatorios
  if (!row[0] || !row[2]) return null

  const sucursales = []
  const branchCount = Math.floor(Math.max(0, row.length - 18) / 3)
  for (let index = 0; index < branchCount; index++) {
    const branchOffset = 18 + index * 3
    if (!row[branchOffset] && !row[branchOffset + 1]) continue
    if (!row[branchOffset] || !row[branchOffset + 1]) continue
    sucursales.push({
      nombre: String(row[branchOffset]).trim(),
      direccion: String(row[branchOffset + 1]).trim(),
      zona: row[branchOffset + 2] ? String(row[branchOffset + 2]).trim() : String(row[3]).trim(),
    })
  }

  return {
    nombreComercial: String(row[0]).trim(), // 0
    razonSocial: row[1] ? String(row[1]).trim() : '', // 1
    nit: String(row[2]).trim(), // 2
    zona: row[3] ? String(row[3]).trim() : 'Sin Zona', // 3
    departamento: row[4] ? String(row[4]).trim() : '', // 4
    ciudad: row[5] ? String(row[5]).trim() : '', // 5
    direccion: row[6] ? String(row[6]).trim() : '', // 6
    estado: row[7] ? String(row[7]).trim() : 'Activo', // 7
    tipo: row[8] ? String(row[8]).trim() : 'Directo', // 8
    aliado: row[9] ? String(row[9]).trim() : '', // 9
    tipoDirecto: row[10] ? String(row[10]).trim() : '', // 10
    sede: row[11] ? String(row[11]).trim() : '', // 11
    contactoPrincipal: {
      nombre: row[12] ? String(row[12]).trim() : '',
      celular: row[13] ? String(row[13]).trim() : '',
      email: row[14] ? String(row[14]).trim() : '',
    },
    contactoFinanciero: {
      nombre: row[15] ? String(row[15]).trim() : '',
      celular: row[16] ? String(row[16]).trim() : '',
      email: row[17] ? String(row[17]).trim() : '',
    },
    sucursales: sucursales,
    createdAt: new Date(),
  }
}

const sanitizeName = (name: string) =>
  name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9_]/g, '')
    .trim()

const downloadTemplate = async () => {
  loading.value = true
  console.log('Iniciando generación de plantilla...')

  // 1. DIAGNÓSTICO: Verificar longitudes
  console.log('Cantidad de ZONAS:', ZONAS?.length)
  console.log('Cantidad de DEPARTAMENTOS:', DEPARTAMENTOS?.length)

  // Guard de seguridad
  if (DEPARTAMENTOS.length > 200) {
    alert(`Advertencia: Hay muchos departamentos (${DEPARTAMENTOS.length}). Esto podría tardar.`)
  }

  try {
    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet('Plantilla Clientes')

    ws.addRow(EXCEL_HEADERS)

    // Anchos de columna
    ws.columns = [
      { width: 30 }, { width: 30 }, { width: 18 }, { width: 20 }, { width: 22 }, { width: 22 },
      { width: 40 }, { width: 14 }, { width: 16 }, { width: 26 }, { width: 18 }, { width: 22 },
      { width: 26 }, { width: 16 }, { width: 30 }, { width: 26 }, { width: 16 }, { width: 30 },
      ...Array.from({ length: MAX_BRANCHES }, () => [
        { width: 26 }, { width: 40 }, { width: 20 },
      ]).flat(),
    ]

    const MAX_ROWS = MAX_TEMPLATE_ROWS

    // Helper seguro para validaciones simples
    const addListDV = (sheetName: string, count: number, colIdx1Based: number) => {
      try {
        if (count === 0) return
        const colLetter = ws.getColumn(colIdx1Based).letter;
        (ws as any).dataValidations.add(`${colLetter}2:${colLetter}${MAX_ROWS}`, {
          type: 'list',
          allowBlank: true,
          formulae: [`='${sheetName}'!$A$2:$A$${count + 1}`] // Agregadas comillas simples por seguridad
        })
      } catch (e: any) {
        console.warn(`Aviso: No se pudo agregar validación para hoja ${sheetName}`, e.message)
      }
    }

    // Helper para crear hojas ocultas
    const addSingleColumnSheet = (name: string, values: string[]) => {
      const s = wb.addWorksheet(name)
      s.addRow([name])
      values.forEach(v => s.addRow([v]))
      s.state = 'hidden'
      return s
    }

    // Crear hojas de catálogos
    addSingleColumnSheet('Datos_Zonas', ZONAS)
    addSingleColumnSheet('Datos_Tipos', TIPOS)
    addSingleColumnSheet('Datos_Aliados', ALIADOS)
    addSingleColumnSheet('Datos_TiposDirecto', TIPOS_DIRECTO)
    addSingleColumnSheet('Datos_Sedes', SEDES)
    addSingleColumnSheet('Datos_Estados', ESTADOS)

    // --- APLICAR VALIDACIONES SIMPLES ---
    addListDV('Datos_Zonas', ZONAS.length, 4)       // zona
    addListDV('Datos_Estados', ESTADOS.length, 8)   // estado
    addListDV('Datos_Tipos', TIPOS.length, 9)       // tipo

    // Validaciones para las zonas de todas las sucursales.
    for (let index = 0; index < MAX_BRANCHES; index++) {
      addListDV('Datos_Zonas', ZONAS.length, 21 + index * 3)
    }

    // --- VALIDACIONES CONDICIONALES (Protegidas) ---

    try {
      (ws as any).dataValidations.add(`J2:J${MAX_ROWS}`, {
        type: 'list', allowBlank: true,
        // Uso de INDIRECT para robustez ante cortar/pegar filas
        formulae: [`=IF(INDIRECT("I"&ROW())="Aliado", 'Datos_Aliados'!$A$2:$A$${ALIADOS.length + 1}, 'Datos_Zonas'!$B$1)`]
      })
    } catch (e) { console.error('Error validación Aliado', e) }

    try {
      (ws as any).dataValidations.add(`K2:K${MAX_ROWS}`, {
        type: 'list', allowBlank: true,
        formulae: [`=IF(INDIRECT("I"&ROW())="Directo", 'Datos_TiposDirecto'!$A$2:$A$${TIPOS_DIRECTO.length + 1}, 'Datos_Zonas'!$B$1)`]
      })
    } catch (e) { console.error('Error validación Tipo Directo', e) }

    try {
      (ws as any).dataValidations.add(`L2:L${MAX_ROWS}`, {
        type: 'list', allowBlank: true,
        formulae: [`=IF(OR(INDIRECT("K"&ROW())="Sedes", INDIRECT("K"&ROW())="Nacionales"), 'Datos_Sedes'!$A$2:$A$${SEDES.length + 1}, 'Datos_Zonas'!$B$1)`]
      })
    } catch (e) { console.error('Error validación Sedes', e) }

    // --- HOJA DE DEPARTAMENTOS POR ZONA (Horizontal) ---
    const wsDepsByZone = wb.addWorksheet('RefZones')
    let colZ = 1

    for (const zona of ZONAS) {
      // Prefijo 'ListZ' (alfabético simple) para evitar errores de columna en exceljs y Excel
      const zonaKey = 'ListZ' + sanitizeName(zona)

      let depsForZone: string[] = []

      if (zona === 'Norte de Santander') depsForZone = ['Norte de Santander']
      else if (zona === 'Valle del Cauca') depsForZone = ['Valle del Cauca']
      else depsForZone = DEPARTAMENTOS

      if (depsForZone.length > 0) {
        wsDepsByZone.getCell(1, colZ).value = zonaKey
        depsForZone.forEach((d, i) => {
          wsDepsByZone.getCell(2 + i, colZ).value = d
        })

        const lastRow = 1 + depsForZone.length
        const colLetter = wsDepsByZone.getColumn(colZ).letter

        try {
          // Referencia segura con comillas simples
          wb.definedNames.add(`'${wsDepsByZone.name}'!$${colLetter}$2:$${colLetter}$${lastRow}`, zonaKey)
        } catch (e: any) { console.warn(`Error agregando nombre zona ${zonaKey}:`, e.message) }

        colZ++
      }
    }
    wsDepsByZone.state = 'hidden'

    // --- FÓRMULAS AUTOMÁTICAS ---
    for (let i = 2; i <= MAX_TEMPLATE_ROWS; i++) {
      // Uso de INDIRECT para evitar errores de referencia (#REF!) si el usuario mueve filas
      ws.getCell(`D${i}`).value = {
        formula: `IF(INDIRECT("E"&ROW())="Valle del Cauca", "Valle del Cauca", IF(INDIRECT("E"&ROW())="Norte de Santander", "Norte de Santander", IF(INDIRECT("E"&ROW())<>"", "Nacionales", "")))`
      }

      // Zonas de sucursales: prellenado automático con la zona principal.
      const zonaRef = `INDIRECT("D"&ROW())`
      for (let index = 0; index < MAX_BRANCHES; index++) {
        const zoneColumn = ws.getColumn(21 + index * 3).letter
        ws.getCell(`${zoneColumn}${i}`).value = { formula: `IF(${zonaRef}<>"", ${zonaRef}, "")` }
      }
    }

    // --- DEPARTAMENTOS Y CIUDADES ---
    const wsCities = wb.addWorksheet('RefCities')
    let col = 1

    for (const dep of DEPARTAMENTOS) {
      if (col > 2000) break;

      const depKey = 'ListC' + sanitizeName(dep)
      const cities = CIUDADES_POR_DEP[dep] || []

      if (!depKey || cities.length === 0) continue

      wsCities.getCell(1, col).value = depKey
      cities.forEach((c: string, i: number) => {
        wsCities.getCell(2 + i, col).value = c
      })

      const lastRow = 1 + cities.length
      const colLetter = wsCities.getColumn(col).letter

      try {
        // Referencia segura con comillas simples
        wb.definedNames.add(`'${wsCities.name}'!$${colLetter}$2:$${colLetter}$${lastRow}`, depKey)
      } catch (e: any) { console.warn(`Error agregando nombre ciudad ${depKey}:`, e.message) }

      col++
    }
    wsCities.state = 'hidden'

    // Hoja Departamentos (Vertical)
    const shDeps = wb.addWorksheet('Datos_Departamentos')
    shDeps.addRow(['Departamento'])
    DEPARTAMENTOS.forEach(d => shDeps.addRow([d]))
    shDeps.state = 'hidden'

    // Validación Departamento
    const depColLetter = ws.getColumn(5).letter
    try {
      (ws as any).dataValidations.add(`${depColLetter}2:${depColLetter}${MAX_ROWS}`, {
        type: 'list',
        allowBlank: true,
        // Usamos comillas simples en las referencias a hojas dentro de INDIRECT si fuera necesario,
        // pero aquí referenciamos el Named Range que creamos con el prefijo.
        formulae: [`=IF(INDIRECT("D"&ROW())="", 'Datos_Departamentos'!$A$2:$A$${DEPARTAMENTOS.length + 1}, INDIRECT("ListZ"&SUBSTITUTE(SUBSTITUTE(INDIRECT("D"&ROW())," ",""),".","")))`]
      })
    } catch (e: any) { console.error('Error validación Departamento', e.message) }

    // Validación Ciudad
    const ciudadColLetter = ws.getColumn(6).letter
    try {
      (ws as any).dataValidations.add(`${ciudadColLetter}2:${ciudadColLetter}${MAX_ROWS}`, {
        type: 'list',
        allowBlank: true,
        formulae: ['=INDIRECT("ListC"&SUBSTITUTE(SUBSTITUTE(INDIRECT("E"&ROW())," ",""),".",""))']
      })
    } catch (e: any) { console.error('Error validación Ciudad', e.message) }

    // Protección y descarga...
    ws.columns.forEach((col, index) => {
      if (index !== 3) col.protection = { locked: false }
    })

    await ws.protect('controltotal', {
      selectLockedCells: true, selectUnlockedCells: true, formatCells: true,
      formatColumns: true, formatRows: true, insertRows: true, deleteRows: true,
      insertColumns: true, deleteColumns: true,
      sort: true, autoFilter: true
    })

    const buf = await wb.xlsx.writeBuffer()
    saveAs(new Blob([buf]), 'Plantilla_Importacion_Clientes.xlsx')

  } catch (error: any) {
    console.error('Error generando plantilla:', error)
    feedback.value = 'Error al generar la plantilla: ' + error.message
  } finally {
    loading.value = false
  }
}

const handleFileChange = (event: Event) => {
  const target = event.target as HTMLInputElement
  if (target.files && target.files[0]) {
    feedback.value = ''
    selectedFile.value = target.files[0]
    importStats.value = null
  }
}

const analyzeFile = async () => {
  if (!selectedFile.value || processing.value) return
  feedback.value = ''

  processing.value = true
  importStats.value = null
  importPreview.value = null

  const reader = new FileReader()

  reader.onload = async (e) => {
    try {
      const data = new Uint8Array(e.target?.result as ArrayBuffer)
      const workbook = XLSX.read(data, { type: 'array' })

      // Leer la primera hoja
      const firstSheetName = workbook.SheetNames[0]
      if (!firstSheetName) throw new Error('El archivo Excel no contiene hojas.')
      const worksheet = workbook.Sheets[firstSheetName]
      if (!worksheet) throw new Error('La hoja de cálculo no se pudo leer.')

      // Convertir a JSON (array de arrays para manejar columnas por índice)
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][]

      // Ignorar la fila de cabecera (índice 0) y filtrar filas vacías
      const dataRows = jsonData.slice(1).filter(row => row.length > 0 && row[0])

      const preview = {
        validRows: [] as any[],
        invalidRows: [] as { row: number; errors: string[] }[],
        total: dataRows.length,
      }

      // Obtener clientes existentes para validar duplicados
      const existingNits = new Set<string>()
      try {
        const getClients = httpsCallable(functions, 'getAllClients')
        const result = await getClients()
        const clients = (result.data as any).clients || []
        clients.forEach((c: any) => {
          const val = c.nit || c.numeroIdentificacion
          if (val) existingNits.add(String(val).trim())
        })
      } catch (error: any) {
        console.error('Error al cargar clientes para validación:', error)
        throw new Error(`Error de conexión con el servidor (Validación de Duplicados). Verifica que la función 'getAllClients' esté desplegada y funcionando. Detalles: ${error.message}`)
      }

      for (const [index, row] of dataRows.entries()) {
        try {
          // 1. Validar y Normalizar
          const v = validateRow(row)
          if (!v.ok) {
            preview.invalidRows.push({ row: index + 2, errors: v.errors })
            continue
          }

          // 2. Aplicar correcciones al row original antes de mapear
          const patchedRow = [...row]
          patchedRow[2] = v.fixed.nit
          patchedRow[3] = v.fixed.zona
          patchedRow[7] = v.fixed.estado
          patchedRow[10] = v.fixed.tipoDirecto ?? row[10]
          patchedRow[11] = v.fixed.sede ?? row[11]
          patchedRow[13] = v.fixed.contactoPrincipal_celular
          patchedRow[16] = v.fixed.contactoFinanciero_celular

          const clientData = mapRowToClient(patchedRow)

          if (!clientData) {
            preview.invalidRows.push({ row: index + 2, errors: ['Error interno al procesar datos.'] })
            continue
          }

          if (existingNits.has(clientData.nit)) {
            preview.invalidRows.push({ row: index + 2, errors: [`El NIT ${clientData.nit} ya existe.`] })
            continue
          }

          preview.validRows.push(clientData)
          existingNits.add(clientData.nit) // Evitar duplicados dentro del mismo archivo
        } catch (error: any) {
          console.error('Error importando fila', index, error)
          preview.invalidRows.push({
            row: index + 2,
            errors: [`Error desconocido: ${error.message}`],
          })
        }
      }

      importPreview.value = preview
      showConfirmation.value = true
    } catch (error: any) {
      console.error('Error al procesar el archivo Excel:', error)
      feedback.value = `Error crítico de lectura: ${error.message}`
    } finally {
      processing.value = false
    }
  }

  reader.onerror = () => {
    feedback.value = 'No se pudo leer el archivo Excel.'
    processing.value = false
  }
  reader.readAsArrayBuffer(selectedFile.value)
}

const confirmImport = async () => {
  if (!importPreview.value?.validRows.length || processing.value) return

  processing.value = true
  importProgress.value = 0
  // Inicializar estadísticas con los errores ya detectados
  importStats.value = {
    total: importPreview.value.total,
    success: 0,
    failed: importPreview.value.invalidRows.length,
    errors: importPreview.value.invalidRows.map((r) => `Fila ${r.row}: ${r.errors.join('; ')}`),
  }

  const batchImportClients = httpsCallable(functions, 'batchImportClients')
  const batchSize = 400
  const validRows = importPreview.value.validRows
  const totalBatches = Math.ceil(validRows.length / batchSize)

  for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
    const batch = validRows.slice(batchIndex * batchSize, (batchIndex + 1) * batchSize)
    try {
      const result = await batchImportClients({ clients: batch }) as {
        data: { imported: number }
      }
      importStats.value.success += result.data.imported || 0
    } catch (error: any) {
      importStats.value.failed += batch.length
      importStats.value.errors.push(
        `Error al guardar el lote ${batchIndex + 1}: ${error.message}`,
      )
    }
    importProgress.value = Math.round(((batchIndex + 1) / totalBatches) * 100)
  }

  if (importStats.value.success > 0) {
    emit('refresh')
  }
  showConfirmation.value = false
  processing.value = false
}

const exportClients = async () => {
  loading.value = true
  try {
    const getClients = httpsCallable(functions, 'getAllClients')
    const result = await getClients({ forExport: true })
    const clients = (result.data as any).clients || []

    if (clients.length === 0) {
      feedback.value = 'No hay clientes para exportar.'
      return
    }

    // Mapear clientes al formato de filas
    const branchCount = clients.reduce(
      (max: number, client: any) => Math.max(max, Array.isArray(client.sucursales) ? client.sucursales.length : 0),
      0,
    )
    const exportHeaders = createExcelHeaders(branchCount)
    const rows = clients.map((c: any) => {
      const branchCells = Array.from({ length: branchCount }, (_, index) => {
        const branch = c.sucursales?.[index] || {}
        return [branch.nombre || '', branch.direccion || '', branch.zona || '']
      }).flat()

      return [
        c.nombreComercial || '',
        c.razonSocial || '',
        c.nit || c.numeroIdentificacion || '',
        c.zona || '',
        c.departamento || '',
        c.ciudad || '',
        c.direccion || '',
        c.estado || 'Activo',
        c.tipo || '',
        c.aliado || '',
        c.tipoDirecto || '',
        c.sede || '',
        c.contactoPrincipal?.nombre || '',
        c.contactoPrincipal?.celular || '',
        c.contactoPrincipal?.email || '',
        c.contactoFinanciero?.nombre || '',
        c.contactoFinanciero?.celular || '',
        c.contactoFinanciero?.email || '',
        ...branchCells,
      ]
    })

    // Crear libro y hoja
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.aoa_to_sheet([exportHeaders, ...rows])

    // Ajustar anchos para todos los campos y grupos de sucursales.
    ws['!cols'] = [
      { wch: 30 }, { wch: 30 }, { wch: 15 }, { wch: 15 }, { wch: 20 },
      { wch: 15 }, { wch: 20 }, { wch: 20 }, { wch: 40 },
      { wch: 25 }, { wch: 15 }, { wch: 25 }, { wch: 25 }, { wch: 15 }, { wch: 25 },
      { wch: 20 }, { wch: 30 }, { wch: 20 },
      { wch: 20 }, { wch: 30 }, { wch: 20 },
      { wch: 20 }, { wch: 30 }, { wch: 20 },
      { wch: 20 }, { wch: 30 }, { wch: 20 },
      ...Array.from({ length: branchCount }, () => [{ wch: 20 }, { wch: 30 }, { wch: 20 }]).flat()
    ]

    XLSX.utils.book_append_sheet(wb, ws, 'Base de Datos Clientes')
    XLSX.writeFile(wb, `Clientes_Export_${new Date().toISOString().split('T')[0]}.xlsx`)

  } catch (error) {
    console.error('Error exportando:', error)
    feedback.value = 'No se pudo exportar el directorio.'
  } finally {
    loading.value = false
  }
}

const close = () => {
  if (processing.value || loading.value) return
  feedback.value = ''
  selectedFile.value = null
  importStats.value = null
  importPreview.value = null
  showConfirmation.value = false
  if (fileInput.value) fileInput.value.value = ''
  emit('close')
}
</script>

<template>
  <dialog ref="dialog" class="transfer-dialog" aria-labelledby="client-transfer-title" @cancel.prevent="close">
    <div class="transfer-shell">
      <header class="transfer-header flex items-start gap-3 p-4 sm:p-5">
        <span class="transfer-icon grid size-11 shrink-0 place-items-center rounded-xl" aria-hidden="true">
          <i class="fas fa-file-excel"></i>
        </span>
        <div class="min-w-0 flex-1">
          <h2 id="client-transfer-title" class="text-lg font-extrabold sm:text-xl">Importar y exportar clientes</h2>
          <p class="muted mt-1 text-sm">{{ showConfirmation ? 'Revisa las filas antes de importarlas.' : 'Carga clientes desde Excel o descarga el directorio.' }}</p>
        </div>
        <button type="button" autofocus class="transfer-button shrink-0" aria-label="Cerrar importación y exportación"
          :disabled="processing || loading" @click="close"><i class="fas fa-times" aria-hidden="true"></i></button>
      </header>

      <div class="transfer-body space-y-4 p-4 sm:p-5">
        <p v-if="feedback" role="alert" class="transfer-error rounded-lg p-3 text-sm">{{ feedback }}</p>
        <template v-if="!showConfirmation">
          <div class="grid gap-4 sm:grid-cols-2">
            <section class="transfer-card flex flex-col items-start gap-2">
              <h3 class="font-bold">Plantilla de importación</h3>
              <p class="muted flex-1 text-sm">Descarga el archivo con los campos que debes completar.</p>
              <button type="button" class="transfer-button" :disabled="processing || loading" @click="downloadTemplate">
                <i class="fas fa-download" aria-hidden="true"></i> Descargar plantilla
              </button>
            </section>
            <section class="transfer-card flex flex-col items-start gap-2">
              <h3 class="font-bold">Exportar directorio</h3>
              <p class="muted flex-1 text-sm">Descarga en Excel los clientes disponibles para tu usuario.</p>
              <button type="button" class="transfer-button" :disabled="processing || loading" @click="exportClients">
                <i class="fas fa-file-export" aria-hidden="true"></i> {{ loading ? 'Preparando Excel…' : 'Exportar clientes' }}
              </button>
            </section>
          </div>

          <section class="transfer-card">
            <h3 class="font-bold">Importar desde Excel</h3>
            <label for="client-import-file" class="muted mt-1 block text-sm">Selecciona un archivo .xlsx o .xls</label>
            <input id="client-import-file" ref="fileInput" type="file" accept=".xlsx,.xls"
              class="transfer-file mt-3 block w-full text-sm" :disabled="processing || loading" @change="handleFileChange" />
          </section>

          <section v-if="importStats" class="transfer-card" aria-label="Resultado de importación">
            <h3 class="mb-3 font-bold">Resultado de la importación</h3>
            <dl class="transfer-metrics">
              <div><dt>Filas leídas</dt><dd>{{ importStats.total }}</dd></div>
              <div><dt>Importadas</dt><dd>{{ importStats.success }}</dd></div>
              <div><dt>Con errores</dt><dd>{{ importStats.failed }}</dd></div>
            </dl>
            <ul v-if="importStats.errors.length" class="transfer-error mt-3 max-h-40 space-y-1 overflow-y-auto rounded-lg p-3 text-xs">
              <li v-for="(error, idx) in importStats.errors" :key="idx">{{ error }}</li>
            </ul>
          </section>
        </template>

        <section v-else-if="importPreview" class="transfer-card space-y-3">
          <h3 class="font-bold">Revisión del archivo</h3>
          <p v-if="selectedFile" class="muted break-all text-sm">{{ selectedFile.name }}</p>
          <dl class="transfer-metrics">
            <div><dt>Filas leídas</dt><dd>{{ importPreview.total }}</dd></div>
            <div><dt>Válidas</dt><dd>{{ importPreview.validRows.length }}</dd></div>
            <div><dt>Con errores</dt><dd>{{ importPreview.invalidRows.length }}</dd></div>
          </dl>
          <div v-if="importPreview.invalidRows.length" class="transfer-error rounded-lg p-3">
            <h4 class="text-sm font-bold">Filas que se omitirán</h4>
            <ul class="mt-2 max-h-44 space-y-2 overflow-y-auto text-xs">
              <li v-for="item in importPreview.invalidRows" :key="item.row">
                <strong>Fila {{ item.row }}</strong> · {{ item.errors.join(', ') }}
              </li>
            </ul>
          </div>
          <p v-else class="muted text-sm">Todas las filas están listas para importar.</p>
          <div v-if="processing">
            <label for="client-import-progress" class="text-sm font-semibold">Importando · {{ importProgress }}%</label>
            <progress id="client-import-progress" :value="importProgress" max="100" class="mt-1 block w-full accent-[#e50914]"></progress>
          </div>
        </section>
      </div>

      <footer class="transfer-footer flex shrink-0 flex-wrap justify-end gap-2 p-4 sm:px-5">
        <template v-if="showConfirmation">
          <button type="button" class="transfer-button" :disabled="processing" @click="showConfirmation = false">Volver</button>
          <button type="button" class="transfer-button transfer-primary" :disabled="processing || !importPreview?.validRows.length" @click="confirmImport">
            {{ processing ? 'Importando…' : 'Importar filas válidas' }}
          </button>
        </template>
        <template v-else>
          <button type="button" class="transfer-button" :disabled="processing || loading" @click="close">Cerrar</button>
          <button type="button" class="transfer-button transfer-primary" :disabled="!selectedFile || processing || loading" @click="analyzeFile">
            {{ processing ? 'Analizando…' : 'Analizar archivo' }}
          </button>
        </template>
      </footer>
    </div>
  </dialog>
</template>

<style scoped>
.transfer-dialog {
  width: min(46rem, calc(100vw - 2rem));
  max-height: calc(100dvh - 2rem);
  margin: auto;
  padding: 0;
  overflow: hidden;
  border: 1px solid var(--shell-border);
  border-radius: 1rem;
  background: var(--shell-surface);
  color: var(--shell-text);
  box-shadow: 0 24px 64px #0005;
}
.transfer-dialog::backdrop { background: #0009; }
.transfer-shell { display: flex; flex-direction: column; max-height: calc(100dvh - 2rem - 2px); }
.transfer-header { flex-shrink: 0; border-bottom: 1px solid var(--shell-border); background: linear-gradient(115deg, var(--client-tint, #fff0f1), var(--shell-surface) 72%); }
.transfer-icon, .transfer-error { background: var(--client-tint, #fff0f1); color: var(--client-accent, #b8000b); }
.transfer-body { min-height: 0; overflow-y: auto; scrollbar-color: var(--shell-scroll-thumb) var(--shell-scroll-track); }
.transfer-card { border: 1px solid var(--shell-border); border-radius: 0.75rem; padding: 1rem; }
.muted { color: var(--shell-muted); }
.transfer-footer { border-top: 1px solid var(--shell-border); background: var(--shell-input); }
.transfer-button {
  display: inline-flex; min-height: 2.5rem; align-items: center; justify-content: center; gap: 0.5rem;
  padding: 0.45rem 0.75rem; border: 1px solid var(--shell-border); border-radius: 0.55rem;
  background: var(--shell-surface); color: var(--shell-text); font-size: 0.8rem; font-weight: 650;
}
.transfer-button:hover { background: var(--shell-input); }
.transfer-primary { border-color: #bc000b; background: #c7000c; color: #fff; }
.transfer-primary:hover { background: #a9000a; }
.transfer-button:disabled { opacity: 0.5; cursor: default; }
.transfer-button:focus-visible, .transfer-file:focus-visible { outline: 2px solid #e50914; outline-offset: 2px; }
.transfer-file { border: 1px dashed var(--shell-border); border-radius: 0.65rem; background: var(--shell-input); }
.transfer-file::file-selector-button {
  margin-right: 0.6rem; padding: 0.65rem; border: 0; border-right: 1px solid var(--shell-border);
  background: var(--shell-surface); color: var(--shell-text); font-weight: 650; cursor: pointer;
}
.transfer-metrics { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.5rem; }
.transfer-metrics > div { padding: 0.5rem; border-radius: 0.55rem; background: var(--shell-input); }
.transfer-metrics dt { color: var(--shell-muted); font-size: 0.75rem; }
.transfer-metrics dd { font-size: 1.25rem; font-weight: 750; }
</style>
