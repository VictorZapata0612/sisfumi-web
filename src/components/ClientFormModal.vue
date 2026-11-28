<!-- eslint-disable @typescript-eslint/no-explicit-any -->
<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { httpsCallable } from 'firebase/functions'
import { functions } from '@/firebase/config'
import { normalizeNit, normalizePhone, isValidEmail } from '@/utils/clientValidators'
import {
  ZONAS,
  ALIADOS,
  DEPARTAMENTOS,
  CIUDADES_POR_DEP,
  TIPOS,
  TIPOS_DIRECTO,
  SEDES,
} from '@/data/catalogs'

const props = defineProps<{
  clientId: string | null
  show: boolean
}>()

const emit = defineEmits(['close', 'save', 'delete-inactive', 'delete-permanent'])

const isEditMode = computed(() => !!props.clientId)

const savedStatus = ref<string | null>(null)
const loadFailed = ref(false)
const canDeletePermanently = computed(() => savedStatus.value === 'Inactivo')
const deleteButtonText = computed(() => canDeletePermanently.value ? 'Eliminar permanentemente' : 'Inactivar cliente')

const loading = ref(false)
const saving = ref(false)
const errorMessage = ref<string | null>(null)

// Form state
const form = ref({
  nombreComercial: '',
  razonSocial: '',
  nit: '' as string | number,
  tipo: 'Directo',
  aliado: '',
  tipoDirecto: '',
  sede: '',
  zona: '',
  departamento: '',
  ciudad: '',
  direccion: '',
  contactoPrincipal: { nombre: '', celular: '', email: '' },
  contactoFinanciero: { nombre: '', celular: '', email: '' },
  sucursales: [] as { id?: string; nombre: string; direccion: string; zona: string }[],
  estado: 'Activo',
})

const cities = ref<string[]>([])

const loadInitialData = async () => {
  loading.value = true
  errorMessage.value = null
  loadFailed.value = false
  savedStatus.value = null
  try {
    if (props.clientId) {
      const getClient = httpsCallable(functions, 'getClientById')
      const clientResult = await getClient({ clientId: props.clientId })
      const client = (clientResult.data as { client: typeof form.value }).client
      savedStatus.value = client.estado
      // Mapear datos del cliente al formulario, asegurando compatibilidad
      form.value = {
        ...form.value,
        ...client,
        nit: client.nit || (client as any).numeroIdentificacion || ''
      }
      handleDepartmentChange()
    } else {
      // Reset form for new client
      form.value = {
        nombreComercial: '',
        razonSocial: '',
        nit: '',
        tipo: 'Directo',
        aliado: '',
        tipoDirecto: '',
        sede: '',
        zona: '',
        departamento: '',
        ciudad: '',
        direccion: '',
        contactoPrincipal: { nombre: '', celular: '', email: '' },
        contactoFinanciero: { nombre: '', celular: '', email: '' },
        sucursales: [],
        estado: 'Activo',
      }
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    errorMessage.value = 'Error al cargar datos: ' + message
    loadFailed.value = true
  } finally {
    loading.value = false
  }
}

const steps = ['Identidad', 'Ubicación y clasificación', 'Contactos', 'Sucursales']
const step = ref(0)

function advance() {
  if (step.value === 0 && (!form.value.nombreComercial.trim() || !normalizeNit(String(form.value.nit)))) {
    errorMessage.value = 'Completa el nombre comercial y el documento.'
    return
  }
  if (step.value === 1 && (!form.value.departamento || !form.value.ciudad || !form.value.direccion.trim())) {
    errorMessage.value = 'Completa el departamento, la ciudad y la dirección.'
    return
  }
  if (step.value === 2 && (emailPrincipalError.value || emailFinancieroError.value)) {
    errorMessage.value = 'Revisa los correos de contacto.'
    return
  }
  errorMessage.value = null
  step.value++
}

watch(
  () => props.show,
  (newVal) => {
    if (newVal) {
      step.value = 0
      loadInitialData()
    }
  },
  { immediate: true },
)

const handleSave = async () => {
  if (loading.value || loadFailed.value) return
  if (step.value < steps.length - 1) {
    advance()
    return
  }
  saving.value = true
  loading.value = true
  errorMessage.value = null

  // --- VALIDACIÓN Y NORMALIZACIÓN ---
  const errors: string[] = []

  // Normalizar
  form.value.nit = normalizeNit(String(form.value.nit))
  form.value.contactoPrincipal.celular = normalizePhone(form.value.contactoPrincipal.celular)
  form.value.contactoFinanciero.celular = normalizePhone(form.value.contactoFinanciero.celular)
  form.value.contactoPrincipal.email = form.value.contactoPrincipal.email.trim()
  form.value.contactoFinanciero.email = form.value.contactoFinanciero.email.trim()

  // Validar Requeridos
  if (!form.value.nombreComercial) errors.push('El Nombre Comercial es obligatorio.')
  if (!form.value.nit) errors.push('El NIT es obligatorio.')
  if (!form.value.departamento) errors.push('El Departamento es obligatorio.')
  if (!form.value.ciudad) errors.push('La Ciudad es obligatoria.')
  if (!form.value.direccion) errors.push('La Dirección es obligatoria.')

  // Validar Emails
  if (form.value.contactoPrincipal.email && !isValidEmail(form.value.contactoPrincipal.email)) errors.push('Email de contacto principal inválido.')
  if (form.value.contactoFinanciero.email && !isValidEmail(form.value.contactoFinanciero.email)) errors.push('Email de contacto financiero inválido.')

  // Validar nombres de sucursales duplicados
  const sucursalNames = form.value.sucursales.map(s => s.nombre.trim().toLowerCase()).filter(n => n)
  const uniqueNames = new Set(sucursalNames)
  if (uniqueNames.size !== sucursalNames.length) {
    errors.push('No puede haber sucursales con el mismo nombre.')
  }

  form.value.sucursales.forEach((sucursal, index) => {
    const hasAnyValue = Boolean(sucursal.nombre.trim() || sucursal.direccion.trim() || sucursal.zona.trim())
    const isComplete = Boolean(sucursal.nombre.trim() && sucursal.direccion.trim() && sucursal.zona.trim())
    if (hasAnyValue && !isComplete) {
      errors.push(`Sucursal ${index + 1}: complete nombre, dirección y zona.`)
    }
  })

  if (errors.length > 0) {
    errorMessage.value = errors.join('\n')
    saving.value = false
    loading.value = false
    return
  }

  try {
    const saveClient = httpsCallable(functions, props.clientId ? 'updateClient' : 'addClient')
    const sucursales = form.value.sucursales
      .filter((s) => s.nombre && s.direccion && s.zona)
      .map((s, index) => ({
        ...s,
        id: s.id || `${props.clientId || 'new-client'}-branch-${index + 1}`,
      }))
    const zonasDeSucursales = Array.from(
      new Set([form.value.zona, ...sucursales.map((s) => s.zona)]),
    ).filter(Boolean)

    const originalClient = props.clientId
      ? (
        (await httpsCallable(functions, 'getClientById')({ clientId: props.clientId })) as {
          data: { client: typeof form.value & { createdAt?: Date | string | number } }
        }
      ).data.client
      : null

    const clientData = {
      ...form.value,
      sucursales,
      zonasDeSucursales,
      createdAt: (originalClient as any)?.createdAt ?? new Date(),
    }

    await saveClient({ clientId: props.clientId, clientData })
    emit('save')
    emit('close')
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    errorMessage.value = 'Error al guardar: ' + message
  } finally {
    saving.value = false
    loading.value = false
  }
}

const addSucursal = () => {
  // Preseleccionar la zona del cliente principal al agregar sucursal
  form.value.sucursales.push({
    id: `new-branch-${Date.now()}-${form.value.sucursales.length + 1}`,
    nombre: '',
    direccion: '',
    zona: form.value.zona || '',
  })
}

const removeSucursal = (index: number) => {
  form.value.sucursales.splice(index, 1)
}

const handleSedeChange = () => {
  form.value.departamento = form.value.sede
  handleDepartmentChange()
}

const handleDepartmentChange = () => {
  const selectedDepartment = form.value.departamento
  if (selectedDepartment && CIUDADES_POR_DEP[selectedDepartment]) {
    cities.value = CIUDADES_POR_DEP[selectedDepartment].sort()

    // Auto-selección de Zona (Solo si no estamos cargando datos iniciales para no sobrescribir)
    if (!loading.value) {
      if (selectedDepartment === 'Valle del Cauca') {
        form.value.zona = 'Valle del Cauca'
      } else if (selectedDepartment === 'Norte de Santander') {
        form.value.zona = 'Norte de Santander'
      } else {
        form.value.zona = 'Nacionales'
      }
    }
  } else {
    cities.value = []
  }
}

const handleDelete = async () => {
  if (loading.value || loadFailed.value || !props.clientId) return
  if (canDeletePermanently.value) {
    emit('delete-permanent', props.clientId)
  } else {
    emit('delete-inactive', props.clientId)
  }
}

// --- Propiedades Computadas para visibilidad ---
const showAliadoField = computed(() => form.value.tipo === 'Aliado')
const showTipoDirectoField = computed(() => form.value.tipo === 'Directo')
const showSedeField = computed(
  () => form.value.tipo === 'Directo' && form.value.tipoDirecto === 'Sedes',
)
const isDepartamentoDisabled = computed(() => showSedeField.value)

watch(
  () => form.value.tipo,
  () => {
    if (form.value.tipo === 'Directo' && form.value.tipoDirecto === 'Sedes') {
      handleSedeChange()
    }
  },
)
watch(
  () => form.value.tipoDirecto,
  () => {
    if (form.value.tipo === 'Directo' && form.value.tipoDirecto === 'Sedes') {
      handleSedeChange()
    }
  },
)
watch(() => form.value.sede, handleSedeChange)
watch(() => form.value.departamento, handleDepartmentChange, { immediate: true })

// Observar cambios en la zona principal para actualizar sucursales
watch(() => form.value.zona, (newZona, oldZona) => {
  if (newZona && !loading.value) {
    form.value.sucursales.forEach(s => {
      // Si la sucursal no tiene zona o tenía la zona anterior, actualizarla
      if (!s.zona || s.zona === oldZona) s.zona = newZona
    })
  }
})

const departments = computed(() => {
  return DEPARTAMENTOS
})

// Validaciones en tiempo real
const emailPrincipalError = computed(() => {
  return form.value.contactoPrincipal.email && !isValidEmail(form.value.contactoPrincipal.email) ? 'Formato de correo inválido' : null
})
const emailFinancieroError = computed(() => {
  return form.value.contactoFinanciero.email && !isValidEmail(form.value.contactoFinanciero.email) ? 'Formato de correo inválido' : null
})
</script>

<template>
  <div v-if="show" class="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6" role="dialog"
    aria-modal="true" aria-labelledby="client-form-title" @keydown.esc.stop="!loading && emit('close')">
    <!-- Backdrop con desenfoque -->
    <div class="fixed inset-0 bg-[#0a0a0a]/80 backdrop-blur-sm transition-opacity" @click="!loading && emit('close')">
    </div>

    <!-- Modal Panel -->
    <div
      class="relative bg-[var(--shell-surface)] rounded-xl border border-[var(--shell-border)] shadow-2xl w-full max-w-6xl transform transition-all flex flex-col max-h-[90vh] overflow-hidden">
      <header class="form-heading flex shrink-0 items-start gap-3 border-b border-[var(--shell-border)] p-4 sm:p-5">
        <span class="form-icon grid size-11 shrink-0 place-items-center rounded-xl" aria-hidden="true">
          <i class="fas" :class="isEditMode ? 'fa-edit' : 'fa-user-plus'"></i>
        </span>
        <div class="min-w-0 flex-1">
          <h2 id="client-form-title" class="text-xl font-extrabold">{{ isEditMode ? 'Editar cliente' : 'Nuevo cliente' }}</h2>
          <p class="mt-1 text-sm text-[var(--shell-muted)]">
            {{ isEditMode ? (form.nombreComercial || 'Actualiza los datos del cliente.') : 'Registra los datos, contactos y sucursales del cliente.' }}
          </p>
        </div>
        <button type="button" class="form-button shrink-0" aria-label="Cerrar formulario"
          :disabled="loading" @click="emit('close')">
          <i class="fas fa-times" aria-hidden="true"></i>
        </button>
      </header>

      <p v-if="loading" role="status" class="px-5 py-3 text-sm text-[var(--shell-muted)]">
        <i class="fas fa-circle-notch fa-spin mr-2" aria-hidden="true"></i>
        {{ saving ? 'Guardando cliente…' : 'Cargando datos del cliente…' }}
      </p>

      <!-- Content -->
      <div class="grid min-h-0 flex-1 md:grid-cols-[15rem_minmax(0,1fr)]">
        <ol class="flex gap-2 overflow-x-auto border-b border-[var(--shell-border)] bg-[var(--shell-input)] p-4 md:flex-col md:border-b-0 md:border-r" aria-label="Pasos del registro">
          <li v-for="(label, index) in steps" :key="label" :aria-current="index === step ? 'step' : undefined">
            <button type="button" class="flex items-center gap-2 rounded-lg p-2 text-left text-sm" :class="index === step ? 'font-bold' : 'text-[var(--shell-muted)]'" :disabled="loading || index >= step" @click="step = index; errorMessage = null">
              <span class="grid size-7 shrink-0 place-items-center rounded-full" :class="index === step ? 'bg-[#E50914] text-white' : 'border border-[var(--shell-border)]'">{{ index + 1 }}</span>
              {{ label }}
            </button>
          </li>
        </ol>
      <form v-if="(!loading || saving) && !loadFailed" id="client-editor" novalidate @submit.prevent="handleSave" class="form-body min-h-0 overflow-y-auto p-4 sm:p-5">
        <fieldset :disabled="loading">
        <h3 class="mb-5 text-2xl font-extrabold">{{ step === 0 ? 'Identidad del cliente' : steps[step] }}</h3>
        <div class="space-y-4">
          <!-- Columna Izquierda: Datos Principales -->
          <div class="space-y-6">
            <!-- Datos Generales -->
            <div v-show="step === 0" class="bg-[var(--shell-input)] rounded-lg p-4 border border-[var(--shell-border)]">
              <h4 class="text-sm font-bold form-section-title border-b border-[var(--shell-border)] pb-2 mb-4">
                <i class="fas fa-id-card mr-2"></i> Datos Generales
              </h4>
              <div class="space-y-4">
                <div>
                  <label for="clientNombreComercial" class="form-label">Nombre Comercial <span
                      class="text-red-400">*</span></label>
                  <input v-model="form.nombreComercial" type="text" id="clientNombreComercial"
                    class="input-field-dark w-full" required />
                </div>
                <div>
                  <label for="clientRazonSocial" class="form-label">Razón Social</label>
                  <input v-model="form.razonSocial" type="text" id="clientRazonSocial"
                    class="input-field-dark w-full" />
                </div>
                <div>
                  <label for="clientNumeroIdentificacion" class="form-label">NIT / Documento <span
                      class="text-red-400">*</span></label>
                  <input v-model="form.nit" type="text" id="clientNumeroIdentificacion" class="input-field-dark w-full"
                    required />
                </div>
              </div>
            </div>

            <!-- Ubicación -->
            <div v-show="step === 1" class="bg-[var(--shell-input)] rounded-lg p-4 border border-[var(--shell-border)]">
              <h4 class="text-sm font-bold form-section-title uppercase tracking-wide border-b border-[var(--shell-border)] pb-2 mb-4">
                <i class="fas fa-map-marker-alt mr-2"></i> Ubicación Principal
              </h4>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label for="clientDepartamento" class="form-label">Departamento <span
                      class="text-red-400">*</span></label>
                  <div class="relative">
                    <select v-model="form.departamento" id="clientDepartamento"
                      class="input-field-dark w-full appearance-none" required :disabled="isDepartamentoDisabled">
                      <option value="">Seleccione...</option>
                      <option v-for="dep in departments" :key="dep" :value="dep">{{ dep }}</option>
                    </select>
                    <div class="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none text-[var(--shell-muted)]">
                      <i class="fas fa-chevron-down text-xs"></i>
                    </div>
                  </div>
                </div>
                <div>
                  <label for="clientCiudad" class="form-label">Ciudad <span class="text-red-400">*</span></label>
                  <div class="relative">
                    <select v-model="form.ciudad" id="clientCiudad" class="input-field-dark w-full appearance-none"
                      required>
                      <option value="">Seleccione...</option>
                      <option v-for="city in cities" :key="city" :value="city">{{ city }}</option>
                    </select>
                    <div class="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none text-[var(--shell-muted)]">
                      <i class="fas fa-chevron-down text-xs"></i>
                    </div>
                  </div>
                </div>
              </div>
              <div class="mt-4">
                <label for="clientDireccion" class="form-label">Dirección <span class="text-red-400">*</span></label>
                <input v-model="form.direccion" type="text" id="clientDireccion" class="input-field-dark w-full"
                  required />
              </div>
            </div>

            <!-- Clasificación -->
            <div v-show="step === 1" class="bg-[var(--shell-input)] rounded-lg p-4 border border-[var(--shell-border)]">
              <h4 class="text-sm font-bold form-section-title uppercase tracking-wide border-b border-[var(--shell-border)] pb-2 mb-4">
                <i class="fas fa-tags mr-2"></i> Clasificación
              </h4>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label for="clientType" class="form-label">Tipo de Cliente</label>
                  <select v-model="form.tipo" id="clientType" class="input-field-dark w-full" required>
                    <option v-for="t in TIPOS" :key="t" :value="t">{{ t }}</option>
                  </select>
                </div>
                <div>
                  <label for="clientZone" class="form-label">Zona Asignada</label>
                  <select v-model="form.zona" id="clientZone" class="input-field-dark w-full" required>
                    <option v-for="zone in ZONAS" :key="zone" :value="zone">
                      {{ zone }}
                    </option>
                  </select>
                </div>
              </div>

              <!-- Condicionales -->
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div v-if="showAliadoField">
                  <label for="clientAliado" class="form-label">Aliado Asociado</label>
                  <select v-model="form.aliado" id="clientAliado" class="input-field-dark w-full">
                    <option value="">Seleccione...</option>
                    <option v-for="ally in ALIADOS" :key="ally" :value="ally">
                      {{ ally }}
                    </option>
                  </select>
                </div>
                <div v-if="showTipoDirectoField">
                  <label for="clientTipoDirecto" class="form-label">Tipo Directo</label>
                  <select v-model="form.tipoDirecto" id="clientTipoDirecto" class="input-field-dark w-full">
                    <option value="">Seleccione...</option>
                    <option v-for="td in TIPOS_DIRECTO" :key="td" :value="td">{{ td }}</option>
                  </select>
                </div>
                <div v-if="showSedeField">
                  <label for="clientSede" class="form-label">Sede</label>
                  <select v-model="form.sede" id="clientSede" class="input-field-dark w-full">
                    <option value="">Seleccione...</option>
                    <option v-for="s in SEDES" :key="s" :value="s">{{ s }}</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          <!-- Columna Derecha: Contactos y Sucursales -->
          <div class="space-y-6">
            <!-- Contactos -->
            <div v-show="step === 2" class="bg-[var(--shell-input)] rounded-lg p-4 border border-[var(--shell-border)]">
              <h4 class="text-sm font-bold form-section-title uppercase tracking-wide border-b border-[var(--shell-border)] pb-2 mb-4">
                <i class="fas fa-address-book mr-2"></i> Contactos
              </h4>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <!-- Contacto Principal -->
                <div class="space-y-3">
                  <p class="text-xs font-bold text-[var(--shell-muted)] uppercase">Principal / Operativo</p>
                  <div>
                    <label class="form-label">Nombre</label>
                    <input v-model="form.contactoPrincipal.nombre" type="text" class="input-field-dark w-full py-1.5" />
                  </div>
                  <div>
                    <label class="form-label">Celular</label>
                    <input v-model="form.contactoPrincipal.celular" type="tel" class="input-field-dark w-full py-1.5" />
                  </div>
                  <div>
                    <label class="form-label">Email</label>
                    <input v-model="form.contactoPrincipal.email" type="email" class="input-field-dark w-full py-1.5"
                      :class="{ 'border-red-500 focus:border-red-500 focus:ring-red-500/50': emailPrincipalError }" />
                    <p v-if="emailPrincipalError" class="text-xs text-red-400 mt-1">{{ emailPrincipalError }}</p>
                  </div>
                </div>

                <!-- Contacto Financiero -->
                <div class="space-y-3">
                  <p class="text-xs font-bold text-[var(--shell-muted)] uppercase">Financiero</p>
                  <div>
                    <label class="form-label">Nombre</label>
                    <input v-model="form.contactoFinanciero.nombre" type="text"
                      class="input-field-dark w-full py-1.5" />
                  </div>
                  <div>
                    <label class="form-label">Celular</label>
                    <input v-model="form.contactoFinanciero.celular" type="tel"
                      class="input-field-dark w-full py-1.5" />
                  </div>
                  <div>
                    <label class="form-label">Email</label>
                    <input v-model="form.contactoFinanciero.email" type="email" class="input-field-dark w-full py-1.5"
                      :class="{ 'border-red-500 focus:border-red-500 focus:ring-red-500/50': emailFinancieroError }" />
                    <p v-if="emailFinancieroError" class="text-xs text-red-400 mt-1">{{ emailFinancieroError }}</p>
                  </div>
                </div>
              </div>
            </div>

            <!-- Sucursales -->
            <div v-show="step === 3" class="bg-[var(--shell-input)] rounded-lg p-4 border border-[var(--shell-border)] flex flex-col h-[320px]">
              <div class="flex justify-between items-center border-b border-[var(--shell-border)] pb-2 mb-4">
                <h4 class="text-sm font-bold form-section-title uppercase tracking-wide">
                  <i class="fas fa-store-alt mr-2"></i> Sucursales
                </h4>
                <button @click="addSucursal" type="button" class="btn btn-secondary text-xs !py-1 !px-2">
                  <i class="fas fa-plus mr-1"></i> Añadir
                </button>
              </div>

              <div class="flex-grow overflow-y-auto custom-scrollbar space-y-3 pr-2">
                <div v-if="form.sucursales.length === 0" class="text-center py-8 text-[var(--shell-muted)]">
                  <p>No hay sucursales registradas.</p>
                </div>
                <div v-for="(sucursal, index) in form.sucursales" :key="index"
                  class="bg-[var(--shell-input)] p-3 rounded border border-[var(--shell-border)] relative group">
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mb-2">
                    <input v-model="sucursal.nombre" type="text" placeholder="Nombre Sucursal"
                      class="input-field-dark w-full py-1.5 text-sm" />
                    <input v-model="sucursal.direccion" type="text" placeholder="Dirección"
                      class="input-field-dark w-full py-1.5 text-sm" />
                  </div>
                  <div class="flex gap-2">
                    <select v-model="sucursal.zona" class="input-field-dark w-full py-1.5 text-sm">
                      <option value="">Zona...</option>
                      <option v-for="zone in ZONAS" :key="zone" :value="zone">
                        {{ zone }}
                      </option>
                    </select>
                    <button @click="removeSucursal(index)" type="button" class="text-red-400 hover:text-red-300 p-2">
                      <i class="fas fa-trash-alt"></i>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <!-- Estado -->
            <div v-show="step === 0" class="bg-[var(--shell-input)] rounded-lg p-4 border border-[var(--shell-border)] flex items-center justify-between">
              <label for="clientStatus" class="font-bold text-[var(--shell-muted)]">Estado del Cliente</label>
              <select v-model="form.estado" id="clientStatus" class="input-field-dark px-3 py-1.5 w-40" :class="form.estado === 'Activo'
                ? 'border-green-500 text-green-400'
                : 'border-red-500 text-red-400'
                " required>
                <option value="Activo">Activo</option>
                <option value="Inactivo">Inactivo</option>
              </select>
            </div>
          </div>
        </div>

        </fieldset>
      </form>
      </div>

      <p v-if="errorMessage" role="alert" class="form-error mx-4 my-2 max-h-24 shrink-0 overflow-y-auto whitespace-pre-line rounded-lg px-3 py-2 text-sm">
        {{ errorMessage }}
      </p>

      <footer class="form-footer flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-[var(--shell-border)] p-4 sm:px-5">
        <button v-if="isEditMode && !loadFailed" type="button" class="form-button form-danger" :disabled="loading" @click="handleDelete">
          <i class="fas" :class="canDeletePermanently ? 'fa-trash-alt' : 'fa-user-slash'" aria-hidden="true"></i>
          {{ deleteButtonText }}
        </button>
        <div class="ml-auto flex flex-wrap justify-end gap-2">
          <button type="button" class="form-button" :disabled="loading" @click="emit('close')">Cancelar</button>
          <button v-if="step > 0 && !loadFailed" type="button" class="form-button" :disabled="loading" @click="step--; errorMessage = null">Atrás</button>
          <button v-if="loadFailed" type="button" class="form-button form-primary" @click="loadInitialData">Reintentar</button>
          <button v-else type="submit" form="client-editor" class="form-button form-primary" :disabled="loading">
            {{ step < steps.length - 1 ? 'Continuar a ' + steps[step + 1]?.toLowerCase() : isEditMode ? 'Guardar cambios' : 'Crear cliente' }}
          </button>
        </div>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.form-heading { background: linear-gradient(115deg, var(--client-tint, #fff0f1), var(--shell-surface) 72%); }
.form-icon { color: var(--client-accent, #b8000b); background: var(--client-tint, #fff0f1); }
.form-section-title { color: var(--shell-text); }
.form-label { display: block; margin-bottom: 0.25rem; color: var(--shell-muted); font-size: 0.8rem; font-weight: 650; }
.form-body { scrollbar-color: var(--shell-scroll-thumb) var(--shell-scroll-track); }
.form-footer { background: var(--shell-surface); }
.form-button {
  display: inline-flex; min-height: 2.5rem; align-items: center; justify-content: center; gap: 0.5rem;
  padding: 0.45rem 0.75rem; border: 1px solid var(--shell-border); border-radius: 0.55rem;
  background: var(--shell-surface); color: var(--shell-text); font-size: 0.8rem; font-weight: 650;
}
.form-button:hover { background: var(--shell-input); }
.form-button:focus-visible { outline: 2px solid #e50914; outline-offset: 2px; }
.form-button:disabled { opacity: 0.55; cursor: default; }
.form-primary { border-color: #bc000b; background: #c7000c; color: #fff; }
.form-primary:hover { background: #a9000a; }
.form-danger, .form-error { color: var(--client-accent, #b8000b); }
.form-error { background: var(--client-tint, #fff0f1); }

/* Scoped styles para inputs específicos si no son globales */
.input-field-dark {
  background-color: var(--shell-input);
  border: 1px solid var(--shell-border);
  border-radius: 0.5rem;
  color: var(--shell-text);
  padding: 0.5rem 0.75rem;
  transition: all 0.2s;
}

.input-field-dark:focus {
  outline: none;
  border-color: #d60000;
  /* indigo-500 -> brand-red */
  box-shadow: 0 0 0 2px rgba(214, 0, 0, 0.2);
}
</style>
