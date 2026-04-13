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

const deleteButtonText = computed(() => {
  return form.value.estado === 'Inactivo' ? 'Eliminar Permanente' : 'Inactivar Cliente'
})
const deleteButtonClass = computed(() => {
  return form.value.estado === 'Inactivo' ? 'btn-danger' : 'btn-red'
})

const loading = ref(false)
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
  sucursales: [] as { nombre: string; direccion: string; zona: string }[],
  estado: 'Activo',
})

const cities = ref<string[]>([])

const loadInitialData = async () => {
  loading.value = true
  try {
    if (props.clientId) {
      const getClient = httpsCallable(functions, 'getClientById')
      const clientResult = await getClient({ clientId: props.clientId })
      const client = (clientResult.data as { client: typeof form.value }).client
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
  } finally {
    loading.value = false
  }
}

watch(
  () => props.show,
  (newVal) => {
    if (newVal) {
      loadInitialData()
    }
  },
)

const handleSave = async () => {
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

  if (errors.length > 0) {
    errorMessage.value = errors.join('\n')
    loading.value = false
    return
  }

  try {
    const saveClient = httpsCallable(functions, props.clientId ? 'updateClient' : 'addClient')
    const sucursales = form.value.sucursales.filter((s) => s.nombre && s.direccion && s.zona)
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
    loading.value = false
  }
}

const addSucursal = () => {
  // Preseleccionar la zona del cliente principal al agregar sucursal
  form.value.sucursales.push({ nombre: '', direccion: '', zona: form.value.zona || '' })
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
  if (form.value.estado === 'Inactivo') {
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
    aria-modal="true">
    <!-- Backdrop con desenfoque -->
    <div class="fixed inset-0 bg-[#0a0a0a]/80 backdrop-blur-sm transition-opacity" @click="!loading && emit('close')">
    </div>

    <!-- Modal Panel -->
    <div
      class="relative bg-[#151515] rounded-xl border border-white/10 shadow-2xl w-full max-w-6xl transform transition-all flex flex-col max-h-[90vh] overflow-hidden">
      <!-- Header -->
      <div class="flex items-center justify-between p-4 sm:p-6 border-b border-white/10 bg-[#0a0a0a]/30">
        <h3 class="text-xl font-bold text-white flex items-center gap-2">
          <i :class="clientId ? 'fas fa-edit text-yellow-500' : 'fas fa-user-plus text-green-500'"></i>
          {{ clientId ? 'Editar Cliente' : 'Registrar Nuevo Cliente' }}
        </h3>
      </div>
      <button @click="emit('close')"
        class="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors focus:outline-none z-10"
        :disabled="loading">
        <i class="fas fa-times text-xl"></i>
      </button>

      <!-- Loading State -->
      <div v-if="loading" class="flex flex-col items-center justify-center p-12">
        <i class="fas fa-circle-notch fa-spin text-4xl text-cyan-500 mb-4"></i>
        <p class="text-gray-400">Cargando información del cliente...</p>
      </div>

      <!-- Content -->
      <form v-else @submit.prevent="handleSave" class="p-4 sm:p-6 overflow-y-auto custom-scrollbar flex flex-col gap-6">
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <!-- Columna Izquierda: Datos Principales -->
          <div class="space-y-6">
            <!-- Datos Generales -->
            <div class="bg-white/5 rounded-lg p-4 border border-white/10">
              <h4 class="text-sm font-bold text-cyan-400 uppercase tracking-wide border-b border-white/10 pb-2 mb-4">
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
            <div class="bg-white/5 rounded-lg p-4 border border-white/10">
              <h4 class="text-sm font-bold text-cyan-400 uppercase tracking-wide border-b border-white/10 pb-2 mb-4">
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
                    <div class="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none text-gray-400">
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
                    <div class="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none text-gray-400">
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
            <div class="bg-white/5 rounded-lg p-4 border border-white/10">
              <h4 class="text-sm font-bold text-cyan-400 uppercase tracking-wide border-b border-white/10 pb-2 mb-4">
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
            <div class="bg-white/5 rounded-lg p-4 border border-white/10">
              <h4 class="text-sm font-bold text-cyan-400 uppercase tracking-wide border-b border-white/10 pb-2 mb-4">
                <i class="fas fa-address-book mr-2"></i> Contactos
              </h4>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <!-- Contacto Principal -->
                <div class="space-y-3">
                  <p class="text-xs font-bold text-gray-400 uppercase">Principal / Operativo</p>
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
                  <p class="text-xs font-bold text-gray-400 uppercase">Financiero</p>
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
            <div class="bg-white/5 rounded-lg p-4 border border-white/10 flex flex-col h-[320px]">
              <div class="flex justify-between items-center border-b border-white/10 pb-2 mb-4">
                <h4 class="text-sm font-bold text-cyan-400 uppercase tracking-wide">
                  <i class="fas fa-store-alt mr-2"></i> Sucursales
                </h4>
                <button @click="addSucursal" type="button" class="btn btn-secondary text-xs !py-1 !px-2">
                  <i class="fas fa-plus mr-1"></i> Añadir
                </button>
              </div>

              <div class="flex-grow overflow-y-auto custom-scrollbar space-y-3 pr-2">
                <div v-if="form.sucursales.length === 0" class="text-center py-8 text-gray-500">
                  <p>No hay sucursales registradas.</p>
                </div>
                <div v-for="(sucursal, index) in form.sucursales" :key="index"
                  class="bg-[#0a0a0a] p-3 rounded border border-white/10 relative group">
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
            <div class="bg-white/5 rounded-lg p-4 border border-white/10 flex items-center justify-between">
              <label for="clientStatus" class="font-bold text-gray-300">Estado del Cliente</label>
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

        <div v-if="errorMessage"
          class="bg-red-900/30 border border-red-800 text-red-300 p-3 rounded-lg text-sm flex items-start gap-2 whitespace-pre-line">
          <i class="fas fa-exclamation-circle mt-0.5 text-red-400"></i>
          <span>{{ errorMessage }}</span>
        </div>
      </form>

      <!-- Footer Actions -->
      <div class="p-4 sm:p-6 border-t border-white/10 bg-[#0a0a0a]/30 flex flex-col sm:flex-row justify-between gap-4">
        <button v-if="isEditMode" @click="handleDelete" type="button" class="btn" :class="deleteButtonClass">
          <i class="fas fa-trash-alt mr-2"></i> {{ deleteButtonText }}
        </button>
        <div v-else class="hidden sm:block"></div>
        <!-- Spacer -->

        <div class="flex gap-3 justify-end w-full sm:w-auto">
          <button @click="emit('close')" type="button" class="btn btn-secondary">Cancelar</button>
          <button @click="handleSave" type="button" class="btn btn-primary bg-indigo-600 hover:bg-indigo-700">
            <i class="fas fa-save mr-2"></i> Guardar Cliente
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Scoped styles para inputs específicos si no son globales */
.input-field-dark {
  background-color: #202020;
  /* bg-gray-700 -> #202020 */
  border: 1px solid rgba(255, 255, 255, 0.1);
  /* border-gray-600 -> border-white/10 */
  border-radius: 0.5rem;
  color: #fff;
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
