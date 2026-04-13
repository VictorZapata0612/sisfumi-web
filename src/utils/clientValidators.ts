import {
  ZONAS,
  ALIADOS,
  DEPARTAMENTOS,
  CIUDADES_POR_DEP,
  TIPOS,
  TIPOS_DIRECTO,
  SEDES,
  ESTADOS,
} from '@/data/catalogs'

// --- Normalizadores ---
export const normalizeNit = (nitRaw: string) => {
  if (!nitRaw) return ''
  // Quita espacios y puntos, conserva guiones si los hay, mayúsculas
  return String(nitRaw).replace(/\s|\./g, '').toUpperCase()
}

export const normalizePhone = (raw: string) => {
  if (!raw) return ''
  // Deja dígitos y '+' inicial
  return String(raw).replace(/[^\d+]/g, '')
}

export const isValidEmail = (email?: string) => {
  if (!email) return true // si vacío, lo consideramos opcional
  const e = String(email).trim().toLowerCase()
  if (e === '') return true
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)
}

// --- Validación principal ---
export type RowValidation = {
  ok: boolean
  errors: string[]
  fixed: Record<string, any> // valores corregidos/normalizados
}

export const validateRow = (row: any[]): RowValidation => {
  const errors: string[] = []
  const fixed: Record<string, any> = {}

  // índices según EXCEL_HEADERS exactos:
  // 0: nombreComercial, 1: razonSocial, 2: nit, 3: zona, 4: departamento, 5: ciudad, 6: direccion
  // 7: estado, 8: tipo, 9: aliado, 10: tipoDirecto, 11: sede
  // 12: cpNombre, 13: cpCelular, 14: cpEmail
  // 15: cfNombre, 16: cfCelular, 17: cfEmail
  // 18: s1Nombre, 19: s1Dir ...

  const nombreComercial = row[0]
  const nitRaw = row[2]
  const zona = row[3]
  const departamento = row[4]
  const ciudad = row[5]
  // const direccion = row[6]
  const estado = row[7]
  const tipo = row[8]
  const aliado = row[9]
  const tipoDirecto = row[10]
  const sede = row[11]

  const cpCelular = row[13]
  const cpEmail = row[14]
  const cfCelular = row[16]
  const cfEmail = row[17]

  // nit obligatorio + normalización
  const nit = normalizeNit(String(nitRaw || ''))
  if (!nombreComercial) errors.push('Nombre Comercial es requerido')
  if (!nit) errors.push('NIT es requerido')
  fixed.nit = nit

  // estado
  const estadoVal = estado || 'Activo'
  if (!ESTADOS.includes(String(estadoVal))) errors.push(`Estado inválido: ${estadoVal}`)
  fixed.estado = estadoVal

  // tipo
  const tipoVal = String(tipo || '')
  if (!TIPOS.includes(tipoVal)) errors.push(`Tipo inválido: ${tipoVal}`)

  // aliado / tipoDirecto / sede
  if (tipoVal === 'Aliado') {
    if (!aliado || !ALIADOS.includes(String(aliado))) {
      errors.push(`Aliado inválido o vacío para tipo=Aliado: ${aliado}`)
    }
    fixed.tipoDirecto = '' // limpiar
    fixed.sede = '' // limpiar
  } else if (tipoVal === 'Directo') {
    const td = tipoDirecto || 'Sedes'
    if (!TIPOS_DIRECTO.includes(String(td))) {
      errors.push(`Tipo Directo inválido: ${td}`)
    }
    fixed.tipoDirecto = td

    if (td === 'Nacionales') {
      fixed.sede = 'Nacionales'
    } else {
      // Sedes: use zona si existe y es válida
      let sedeVal = sede
      if (!sedeVal && ZONAS.includes(String(zona))) {
        sedeVal = zona
      }
      if (!sedeVal || !SEDES.includes(String(sedeVal))) {
        errors.push(`Sede inválida o vacía para Tipo Directo 'Sedes': ${sedeVal}`)
      }
      fixed.sede = sedeVal
    }
    // aliado no debe venir, lo ignoramos/limpiamos implícitamente al no usarlo en mapRowToClient
  }

  // zona: Validar o Inferir automáticamente según el Departamento
  let zonaVal = String(zona || '').trim()

  if (!zonaVal && departamento) {
    const dep = String(departamento).trim()
    if (dep === 'Valle del Cauca') zonaVal = 'Valle del Cauca'
    else if (dep === 'Norte de Santander') zonaVal = 'Norte de Santander'
    else if (DEPARTAMENTOS.includes(dep)) zonaVal = 'Nacionales'
  }

  if (zonaVal && !ZONAS.includes(zonaVal)) {
    errors.push(`Zona inválida: ${zonaVal}`)
  }
  fixed.zona = zonaVal

  // departamento y ciudad obligatorios
  if (!departamento || !DEPARTAMENTOS.includes(String(departamento))) {
    errors.push(`Departamento inválido o vacío: ${departamento}`)
  } else {
    const cities = CIUDADES_POR_DEP[String(departamento)] || []
    if (!ciudad || !cities.includes(String(ciudad))) {
      errors.push(`Ciudad inválida o vacía para ${departamento}: ${ciudad}`)
    }
  }

  // contactos
  const cpCel = normalizePhone(String(cpCelular || ''))
  const cfCel = normalizePhone(String(cfCelular || ''))
  fixed.contactoPrincipal_celular = cpCel
  fixed.contactoFinanciero_celular = cfCel

  if (!isValidEmail(cpEmail)) errors.push(`Email Contacto Principal inválido: ${cpEmail}`)
  if (!isValidEmail(cfEmail)) errors.push(`Email Contacto Financiero inválido: ${cfEmail}`)

  // sucursales: paridad nombre/dirección
  // 18,19,20 | 21,22,23 | 24,25,26 | 27,28,29 | 30,31,32
  for (let i = 0; i < 5; i++) {
    const nIdx = 18 + i * 3
    const dIdx = 19 + i * 3
    const n = row[nIdx]
    const d = row[dIdx]
    const hasAny = !!(n || d)
    if (hasAny && (!n || !d)) {
      errors.push(`Sucursal ${i + 1}: Debe tener tanto nombre como dirección`)
    }
  }

  return { ok: errors.length === 0, errors, fixed }
}
