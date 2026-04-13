<script setup lang="ts">
import { ref } from 'vue'
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

// Cabeceras EXACTAS de la hoja "Plantilla Clientes"
const EXCEL_HEADERS = [
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
  'sucursal1_nombre',                // 18
  'sucursal1_direccion',             // 19
  'sucursal1_zona',                  // 20
  'sucursal2_nombre',                // 21
  'sucursal2_direccion',             // 22
  'sucursal2_zona',                  // 23
  'sucursal3_nombre',                // 24
  'sucursal3_direccion',             // 25
  'sucursal3_zona',                  // 26
  'sucursal4_nombre',                // 27
  'sucursal4_direccion',             // 28
  'sucursal4_zona',                  // 29
  'sucursal5_nombre',                // 30
  'sucursal5_direccion',             // 31
  'sucursal5_zona'                   // 32
]


// Mapeo de filas de Excel a Objeto Cliente
const mapRowToClient = (row: any[]) => {
  // Validaciones básicas: Nombre y NIT son obligatorios
  if (!row[0] || !row[2]) return null

  // Procesar sucursales (hasta 5)
  const sucursales = []
  // Sucursal 1
  if (row[18] && row[19]) {
    sucursales.push({ nombre: String(row[18]).trim(), direccion: String(row[19]).trim(), zona: row[20] ? String(row[20]).trim() : String(row[3]).trim() })
  }
  // Sucursal 2
  if (row[21] && row[22]) {
    sucursales.push({ nombre: String(row[21]).trim(), direccion: String(row[22]).trim(), zona: row[23] ? String(row[23]).trim() : String(row[3]).trim() })
  }
  // Sucursal 3
  if (row[24] && row[25]) {
    sucursales.push({ nombre: String(row[24]).trim(), direccion: String(row[25]).trim(), zona: row[26] ? String(row[26]).trim() : String(row[3]).trim() })
  }
  // Sucursal 4
  if (row[27] && row[28]) {
    sucursales.push({ nombre: String(row[27]).trim(), direccion: String(row[28]).trim(), zona: row[29] ? String(row[29]).trim() : String(row[3]).trim() })
  }
  // Sucursal 5
  if (row[30] && row[31]) {
    sucursales.push({ nombre: String(row[30]).trim(), direccion: String(row[31]).trim(), zona: row[32] ? String(row[32]).trim() : String(row[3]).trim() })
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
  // Eliminar espacios y puntos para asegurar compatibilidad total con nombres de rango y evitar errores de columna
  // Ejemplo: "Bogotá D.C." -> "BogotáDC"
  name.trim().replace(/\./g, '').replace(/\s+/g, '')

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
      { width: 26 }, { width: 40 }, { width: 20 }, { width: 26 }, { width: 40 }, { width: 20 },
      { width: 26 }, { width: 40 }, { width: 20 }, { width: 26 }, { width: 40 }, { width: 20 },
      { width: 26 }, { width: 40 }, { width: 20 }
    ]

    const MAX_ROWS = 5000

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

    // Validaciones para Zonas de Sucursales (Columnas 21, 24, 27, 30, 33 - índices 1-based)
    addListDV('Datos_Zonas', ZONAS.length, 21)
    addListDV('Datos_Zonas', ZONAS.length, 24)
    addListDV('Datos_Zonas', ZONAS.length, 27)
    addListDV('Datos_Zonas', ZONAS.length, 30)
    addListDV('Datos_Zonas', ZONAS.length, 33)

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
          wb.definedNames.add(zonaKey, `'${wsDepsByZone.name}'!$${colLetter}$2:$${colLetter}$${lastRow}`)
        } catch (e: any) { console.warn(`Error agregando nombre zona ${zonaKey}:`, e.message) }

        colZ++
      }
    }
    wsDepsByZone.state = 'hidden'

    // --- FÓRMULAS AUTOMÁTICAS ---
    for (let i = 2; i <= 1000; i++) {
      // Uso de INDIRECT para evitar errores de referencia (#REF!) si el usuario mueve filas
      ws.getCell(`D${i}`).value = {
        formula: `IF(INDIRECT("E"&ROW())="Valle del Cauca", "Valle del Cauca", IF(INDIRECT("E"&ROW())="Norte de Santander", "Norte de Santander", IF(INDIRECT("E"&ROW())<>"", "Nacionales", "")))`
      }

      // Zonas de Sucursales (Prellenado automático con la zona principal si existe)
      const zonaRef = `INDIRECT("D"&ROW())`
      ws.getCell(`U${i}`).value = { formula: `IF(${zonaRef}<>"", ${zonaRef}, "")` }   // Sucursal 1 Zona
      ws.getCell(`X${i}`).value = { formula: `IF(${zonaRef}<>"", ${zonaRef}, "")` }   // Sucursal 2 Zona
      ws.getCell(`AA${i}`).value = { formula: `IF(${zonaRef}<>"", ${zonaRef}, "")` }  // Sucursal 3 Zona
      ws.getCell(`AD${i}`).value = { formula: `IF(${zonaRef}<>"", ${zonaRef}, "")` }  // Sucursal 4 Zona
      ws.getCell(`AG${i}`).value = { formula: `IF(${zonaRef}<>"", ${zonaRef}, "")` }  // Sucursal 5 Zona
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
        wb.definedNames.add(depKey, `'${wsCities.name}'!$${colLetter}$2:$${colLetter}$${lastRow}`)
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
      sort: true, autoFilter: true
    })

    const buf = await wb.xlsx.writeBuffer()
    saveAs(new Blob([buf]), 'Plantilla_Importacion_Clientes.xlsx')

  } catch (error: any) {
    console.error('Error generando plantilla:', error)
    alert('Error al generar la plantilla: ' + error.message)
  } finally {
    loading.value = false
  }
}

const handleFileChange = (event: Event) => {
  const target = event.target as HTMLInputElement
  if (target.files && target.files[0]) {
    selectedFile.value = target.files[0]
    importStats.value = null
  }
}

const analyzeFile = async () => {
  if (!selectedFile.value) return

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
      alert(`Error crítico de lectura: ${error.message}`)
    } finally {
      processing.value = false
    }
  }

  reader.readAsArrayBuffer(selectedFile.value)
}

const confirmImport = async () => {
  if (!importPreview.value) return

  processing.value = true
  importProgress.value = 0
  // Inicializar estadísticas con los errores ya detectados
  importStats.value = {
    total: importPreview.value.total,
    success: 0,
    failed: importPreview.value.invalidRows.length,
    errors: importPreview.value.invalidRows.map((r) => `Fila ${r.row}: ${r.errors.join('; ')}`),
  }

  const addClient = httpsCallable(functions, 'addClient')
  const totalToProcess = importPreview.value.validRows.length
  let processedCount = 0

  for (const clientData of importPreview.value.validRows) {
    try {
      await addClient({ clientData })
      importStats.value.success++
    } catch (error: any) {
      importStats.value.failed++
      importStats.value.errors.push(
        `Error al guardar ${clientData.nombreComercial}: ${error.message}`,
      )
    }
    processedCount++
    importProgress.value = Math.round((processedCount / totalToProcess) * 100)
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
    const result = await getClients()
    const clients = (result.data as any).clients || []

    if (clients.length === 0) {
      alert('No hay clientes para exportar.')
      return
    }

    // Mapear clientes al formato de filas
    const rows = clients.map((c: any) => {
      const s1 = c.sucursales?.[0] || {}
      const s2 = c.sucursales?.[1] || {}
      const s3 = c.sucursales?.[2] || {}
      const s4 = c.sucursales?.[3] || {}
      const s5 = c.sucursales?.[4] || {}

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
        // Sucursales
        s1.nombre || '', s1.direccion || '', s1.zona || '',
        s2.nombre || '', s2.direccion || '', s2.zona || '',
        s3.nombre || '', s3.direccion || '', s3.zona || '',
        s4.nombre || '', s4.direccion || '', s4.zona || '',
        s5.nombre || '', s5.direccion || '', s5.zona || ''
      ]
    })

    // Crear libro y hoja
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.aoa_to_sheet([EXCEL_HEADERS, ...rows])

    // Ajustar anchos (mismos que en la plantilla)
    ws['!cols'] = [
      { wch: 30 }, { wch: 30 }, { wch: 15 }, { wch: 15 }, { wch: 20 },
      { wch: 15 }, { wch: 20 }, { wch: 20 }, { wch: 40 },
      { wch: 25 }, { wch: 15 }, { wch: 25 }, { wch: 25 }, { wch: 15 }, { wch: 25 },
      { wch: 20 }, { wch: 30 }, { wch: 20 },
      { wch: 20 }, { wch: 30 }, { wch: 20 },
      { wch: 20 }, { wch: 30 }, { wch: 20 },
      { wch: 20 }, { wch: 30 }, { wch: 20 },
      { wch: 20 }, { wch: 30 }, { wch: 20 }
    ]

    XLSX.utils.book_append_sheet(wb, ws, 'Base de Datos Clientes')
    XLSX.writeFile(wb, `Clientes_Export_${new Date().toISOString().split('T')[0]}.xlsx`)

  } catch (error) {
    console.error('Error exportando:', error)
    alert('Error al exportar clientes.')
  } finally {
    loading.value = false
  }
}

const close = () => {
  selectedFile.value = null
  importStats.value = null
  importPreview.value = null
  showConfirmation.value = false
  if (fileInput.value) fileInput.value.value = ''
  emit('close')
}
</script>

<template>
  <div v-if="show" class="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6" role="dialog"
    aria-modal="true">
    <!-- Backdrop -->
    <div class="fixed inset-0 bg-[#0a0a0a]/80 backdrop-blur-sm transition-opacity" @click="!processing && close()">
    </div>

    <!-- Modal Panel -->
    <div
      class="relative bg-[#151515] rounded-xl border border-white/10 shadow-2xl w-full max-w-2xl transform transition-all flex flex-col overflow-hidden">
      <!-- Header -->
      <div class="flex items-center justify-between p-6 border-b border-white/10 bg-[#0a0a0a]/30">
        <h3 class="text-xl font-bold text-white flex items-center gap-2">
          <i class="fas fa-file-excel text-green-500"></i>
          Importar / Exportar Clientes
        </h3>
        <button @click="close" class="text-gray-400 hover:text-white transition-colors focus:outline-none"
          :disabled="processing">
          <i class="fas fa-times text-xl"></i>
        </button>
      </div>

      <!-- Content -->
      <div v-if="!showConfirmation" class="p-6 space-y-8">
        <!-- Sección 1: Descargar Plantilla -->
        <div class="flex items-center justify-between bg-white/5 p-4 rounded-lg border border-white/10">
          <div>
            <h4 class="text-sm font-bold text-white mb-1">1. Descargar Plantilla Excel</h4>
            <p class="text-xs text-gray-400">Obtén el formato .xlsx correcto para importar.</p>
          </div>
          <button @click="downloadTemplate" class="btn btn-secondary text-sm">
            <i class="fas fa-download mr-2"></i> Plantilla
          </button>
        </div>

        <!-- Sección 2: Importar Archivo -->
        <div class="space-y-4">
          <h4 class="text-sm font-bold text-white">2. Subir Archivo Excel</h4>

          <div class="flex gap-4">
            <input ref="fileInput" type="file" accept=".xlsx, .xls" @change="handleFileChange" class="block w-full text-sm text-gray-400
                file:mr-4 file:py-2 file:px-4
                file:rounded-lg file:border-0
                file:text-sm file:font-semibold
                file:bg-indigo-600 file:text-white
                hover:file:bg-indigo-700
                cursor-pointer bg-[#0a0a0a]/50 rounded-lg border border-white/10" :disabled="processing" />
          </div>

          <div v-if="selectedFile" class="flex justify-end">
            <button @click="analyzeFile" class="btn btn-primary bg-blue-600 hover:bg-blue-700 w-full sm:w-auto"
              :disabled="processing">
              <i v-if="processing" class="fas fa-circle-notch fa-spin mr-2"></i>
              <i v-else class="fas fa-search mr-2"></i>
              {{ processing ? 'Procesando...' : 'Iniciar Importación' }}
            </button>
          </div>

          <!-- Resultados de Importación -->
          <div v-if="importStats" class="mt-4 p-4 rounded-lg bg-[#0a0a0a]/50 border border-white/10">
            <h5 class="text-sm font-bold text-gray-300 mb-2">Resultados:</h5>
            <div class="grid grid-cols-3 gap-4 text-center mb-3">
              <div class="bg-[#151515] p-2 rounded">
                <span class="block text-xs text-gray-500">Total Filas</span>
                <span class="font-bold text-white">{{ importStats.total }}</span>
              </div>
              <div class="bg-green-900/20 p-2 rounded border border-green-900/50">
                <span class="block text-xs text-green-400">Exitosos</span>
                <span class="font-bold text-green-400">{{ importStats.success }}</span>
              </div>
              <div class="bg-red-900/20 p-2 rounded border border-red-900/50">
                <span class="block text-xs text-red-400">Fallidos</span>
                <span class="font-bold text-red-400">{{ importStats.failed }}</span>
              </div>
            </div>

            <div v-if="importStats.errors.length > 0" class="mt-2">
              <p class="text-xs text-red-400 font-bold mb-1">Errores:</p>
              <ul class="text-xs text-red-300 max-h-32 overflow-y-auto custom-scrollbar space-y-1 pl-2">
                <li v-for="(err, idx) in importStats.errors" :key="idx">- {{ err }}</li>
              </ul>
            </div>
          </div>
        </div>

        <!-- Sección 3: Exportar (Opcional) -->
        <div class="border-t border-white/10 pt-6 mt-6">
          <div class="flex items-center justify-between">
            <div>
              <h4 class="text-sm font-bold text-white mb-1">Exportar Base de Datos</h4>
              <p class="text-xs text-gray-400">Descarga todos los clientes actuales en Excel.</p>
            </div>
            <button @click="exportClients" class="btn btn-secondary text-sm" :disabled="loading || processing">
              <i class="fas fa-file-export mr-2"></i>
              {{ loading ? 'Exportando...' : 'Exportar Todo' }}
            </button>
          </div>
        </div>
      </div>

      <!-- VISTA DE CONFIRMACIÓN -->
      <div v-else class="p-6 space-y-6">
        <div class="text-center">
          <h4 class="text-xl font-bold text-white mb-2">Resumen de Análisis</h4>
          <p class="text-gray-400 text-sm">Revisa los datos antes de confirmar la importación.</p>
        </div>

        <!-- Tarjetas de Resumen -->
        <div class="grid grid-cols-3 gap-4 text-center" v-if="importPreview">
          <div class="bg-white/5 p-4 rounded-xl border border-white/10">
            <span class="block text-xs text-gray-400 uppercase font-bold">Total Filas</span>
            <span class="text-2xl font-bold text-white">{{ importPreview.total }}</span>
          </div>
          <div class="bg-green-900/20 p-4 rounded-xl border border-green-500/30">
            <span class="block text-xs text-green-400 uppercase font-bold">Válidos</span>
            <span class="text-2xl font-bold text-green-400">{{ importPreview.validRows.length }}</span>
          </div>
          <div class="bg-red-900/20 p-4 rounded-xl border border-red-500/30">
            <span class="block text-xs text-red-400 uppercase font-bold">Con Errores</span>
            <span class="text-2xl font-bold text-red-400">{{ importPreview.invalidRows.length }}</span>
          </div>
        </div>

        <!-- Lista de Errores -->
        <div v-if="importPreview && importPreview.invalidRows.length > 0"
          class="bg-red-900/10 border border-red-900/50 rounded-lg p-4">
          <h5 class="text-red-400 font-bold text-sm mb-2 flex items-center gap-2">
            <i class="fas fa-exclamation-triangle"></i>
            Detalle de Errores (No se importarán)
          </h5>
          <ul class="text-xs text-red-300 space-y-2 max-h-48 overflow-y-auto custom-scrollbar pr-2">
            <li v-for="item in importPreview.invalidRows" :key="item.row"
              class="border-b border-red-900/30 pb-1 last:border-0">
              <span class="font-bold">Fila {{ item.row }}:</span> {{ item.errors.join(', ') }}
            </li>
          </ul>
        </div>

        <div v-else class="bg-green-900/10 border border-green-900/50 rounded-lg p-4 text-center">
          <p class="text-green-400 text-sm font-medium">
            <i class="fas fa-check-circle mr-2"></i>
            ¡Todo se ve perfecto! No se encontraron errores.
          </p>
        </div>

        <!-- Barra de Progreso -->
        <div v-if="processing" class="space-y-2 animate-pulse">
          <div class="flex justify-between text-xs text-gray-400 font-bold uppercase">
            <span>Procesando...</span>
            <span>{{ importProgress }}%</span>
          </div>
          <div class="w-full bg-[#0a0a0a] rounded-full h-3 overflow-hidden border border-white/10">
            <div
              class="bg-green-500 h-full rounded-full transition-all duration-300 ease-out shadow-[0_0_10px_rgba(34,197,94,0.5)]"
              :style="{ width: `${importProgress}%` }"></div>
          </div>
        </div>

        <!-- Botones de Acción -->
        <div class="flex gap-3 justify-end pt-4 border-t border-white/10">
          <button @click="showConfirmation = false" class="btn btn-secondary" :disabled="processing">
            <i class="fas fa-arrow-left mr-2"></i> Volver
          </button>
          <button @click="confirmImport"
            class="btn btn-primary bg-green-600 hover:bg-green-700 shadow-lg shadow-green-500/20"
            :disabled="processing || importPreview?.validRows.length === 0">
            <i v-if="processing" class="fas fa-circle-notch fa-spin mr-2"></i>
            <i v-else class="fas fa-file-import mr-2"></i>
            {{ processing ? 'Importando...' : `Confirmar Importación (${importPreview?.validRows.length})` }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
