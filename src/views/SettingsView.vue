<script setup lang="ts">
import { onMounted, ref, nextTick, computed, watch } from 'vue'
import {
  useSettingsStore,
  type CalendarIntegration,
  type AuditLog,
  type SystemUser,
} from '@/stores/settings'
import { usePlanningStore, type VisitTemplate } from '@/stores/planning'
import { useAuthStore } from '@/stores/auth'
import { useClientsStore } from '@/stores/clients'
import { useDialog } from '@/composables/useDialog'
import { useToast } from '@/composables/useToast'
import * as XLSX from 'xlsx'
import { Bar } from 'vue-chartjs'
import {
  Chart as ChartJS,
  Title,
  Tooltip,
  Legend,
  BarElement,
  CategoryScale,
  LinearScale,
} from 'chart.js'

defineOptions({ name: 'SettingsView' })

const settingsStore = useSettingsStore()
const planningStore = usePlanningStore()
const { showDialog } = useDialog()
const { showToast } = useToast()
const authStore = useAuthStore()

const clientsStore = useClientsStore()
ChartJS.register(Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale)

// Declaramos la variable global de Google para evitar errores de TypeScript
declare const google: any

onMounted(async () => {
  // Asegurar que los datos de negocio se carguen primero.
  await settingsStore.fetchBusinessData()
  settingsStore.fetchIntegrations()
  planningStore.fetchVisitTemplates()
  fetchLogs() // Cargar logs iniciales
  settingsStore.fetchUsers()
})

// Observar cambios en el usuario actual (ej. al subir foto) y actualizar la lista localmente
watch(() => authStore.user?.photoURL, (newPhotoURL) => {
  if (authStore.user?.uid) {
    const userIndex = settingsStore.users.findIndex(u => u.uid === authStore.user?.uid)
    if (userIndex !== -1) {
      (settingsStore.users[userIndex] as any).photoURL = newPhotoURL
    }
  }
})

const newZoneName = ref('')
const newAllyName = ref('')
const newServiceTypeName = ref('')
const allyInput = ref<HTMLInputElement | null>(null)

const editingUser = ref<SystemUser | null>(null)
const selectedRole = ref('')
const selectedZone = ref('')
const selectedColor = ref('#ffffff')

// Estado para el formulario de plantillas
const editingTemplate = ref<
  VisitTemplate | { templateName?: string; tipo_visita?: string; notas_visita?: string }
>({})

const isTemplateEditMode = computed(() => 'id' in editingTemplate.value)

const availableServices = computed(() => settingsStore.businessData.serviceTypes || [])

const roles = [
  'Administrador',
  'Jefe',
  'Coordinador Nacionales',
  'Coordinador Nacional',
  'Gerente',
  'Coordinador Valle',
  'Coordinador Norte de Santander',
  'Técnico',
  'Invitado',
]
const zonas = computed(() => settingsStore.businessData.businessZones?.map((z) => z.name) || [])

const logFilters = ref({
  startDate: new Date(new Date().setDate(new Date().getDate() - 7)).toISOString().split('T')[0],
  endDate: new Date().toISOString().split('T')[0],
  adminEmail: 'Todos',
  keyword: '',
})

// ✅ CORRECCIÓN: Filtrar valores nulos o indefinidos para evitar errores al hacer .split()
const uniqueLogUsers = computed(() => {
  const emails = settingsStore.auditLogs
    .map((log) => log.adminEmail)
    .filter((email): email is string => !!email) // Filtra nulos/undefined/vacíos
  return Array.from(new Set(emails)).sort()
})

const chartData = computed(() => {
  const actionCounts = settingsStore.auditLogs.reduce(
    (acc, log) => {
      acc[log.action] = (acc[log.action] || 0) + 1
      return acc
    },
    {} as Record<string, number>,
  )

  const sortedActions = Object.entries(actionCounts).sort(([, a], [, b]) => b - a)

  return {
    labels: sortedActions.map(([action]) => action),
    datasets: [
      {
        label: 'Cantidad de Acciones',
        backgroundColor: '#6366f1', // Indigo-500
        data: sortedActions.map(([, count]) => count),
        borderRadius: 4,
      },
    ],
  }
})

const chartOptions = ref({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      labels: { color: '#9ca3af' }
    }
  },
  scales: {
    y: {
      ticks: { color: '#9ca3af' },
      grid: { color: 'rgba(75, 85, 99, 0.2)' }
    },
    x: {
      ticks: { color: '#9ca3af' },
      grid: { display: false }
    }
  }
})

const handleDisconnect = (integration: CalendarIntegration) => {
  showDialog({
    title: 'Confirmar Desconexión',
    message: `¿Está seguro de que desea desconectar la cuenta de Google de <strong>${integration.googleUserName}</strong>? El usuario deberá volver a conectar su cuenta para sincronizar con el calendario.`,
    isConfirmation: true,
    confirmationText: 'Sí, Desconectar',
    async onConfirm() {
      try {
        await settingsStore.disconnectAccount(integration.uid)
        showToast({
          title: 'Éxito',
          message: 'La cuenta ha sido desconectada.',
          type: 'success',
        })
      } catch (error: any) {
        showToast({
          title: 'Error',
          message: `No se pudo desconectar: ${error.message}`,
          type: 'error',
        })
      }
    },
  })
}

const addZone = () => {
  const name = newZoneName.value.trim()
  if (name && !settingsStore.businessData.businessZones?.some((z) => z.name === name)) {
    settingsStore.businessData.businessZones?.push({ name })
    newZoneName.value = ''
  }
}

const removeZone = (index: number) => {
  settingsStore.businessData.businessZones?.splice(index, 1)
}

const addAlly = () => {
  const name = newAllyName.value.trim()
  if (name && !settingsStore.businessData.alliesList?.includes(name)) {
    settingsStore.businessData.alliesList?.push(name)
    newAllyName.value = ''
    nextTick(() => allyInput.value?.focus())
  }
}

const removeAlly = (index: number) => {
  settingsStore.businessData.alliesList?.splice(index, 1)
}

const addServiceType = () => {
  const name = newServiceTypeName.value.trim()
  if (name && !settingsStore.businessData.serviceTypes?.some((s) => s.name === name)) {
    settingsStore.businessData.serviceTypes?.push({ name })
    newServiceTypeName.value = ''
  }
}

const removeServiceType = (index: number) => {
  settingsStore.businessData.serviceTypes?.splice(index, 1)
}

const saveBusinessData = async () => {
  // Ordenar alfabéticamente antes de guardar
  settingsStore.businessData.businessZones?.sort((a, b) => a.name.localeCompare(b.name))
  settingsStore.businessData.alliesList?.sort((a, b) => a.localeCompare(b))
  settingsStore.businessData.serviceTypes?.sort((a, b) => a.name.localeCompare(b.name))

  try {
    await settingsStore.updateBusinessData(settingsStore.businessData)
    showToast({
      title: 'Éxito',
      message: 'Los datos de negocio han sido guardados.',
      type: 'success',
    })
  } catch (error: any) {
    showToast({ title: 'Error', message: `No se pudo guardar: ${error.message}`, type: 'error' })
  }
}

const startEditingTemplate = (template: VisitTemplate) => {
  editingTemplate.value = { ...template }
  // Scroll to form for better UX
  document.getElementById('template-form')?.scrollIntoView({ behavior: 'smooth' })
}

const cancelEditingTemplate = () => {
  editingTemplate.value = {}
}

const saveTemplate = async () => {
  if (!editingTemplate.value.templateName || !editingTemplate.value.tipo_visita) {
    showToast({
      title: 'Campos Incompletos',
      message: 'El nombre y el tipo de servicio de la plantilla son obligatorios.',
      type: 'error',
    })
    return
  }

  try {
    await planningStore.saveVisitTemplate(editingTemplate.value as any)
    showToast({
      title: 'Éxito',
      message: `Plantilla "${editingTemplate.value.templateName}" guardada.`,
      type: 'success',
    })
    cancelEditingTemplate()
  } catch (error: any) {
    showToast({
      title: 'Error',
      message: `No se pudo guardar la plantilla: ${error.message}`,
      type: 'error',
    })
  }
}

const deleteTemplate = (template: VisitTemplate) => {
  showDialog({
    title: 'Confirmar Eliminación',
    message: `¿Está seguro de que desea eliminar la plantilla "<strong>${template.templateName}</strong>"? Esta acción no se puede deshacer.`,
    isConfirmation: true,
    confirmationText: 'Sí, Eliminar',
    async onConfirm() {
      try {
        await planningStore.deleteVisitTemplate(template.id)
        showToast({ title: 'Éxito', message: 'Plantilla eliminada.', type: 'success' })
      } catch (error: any) {
        showToast({
          title: 'Error',
          message: `No se pudo eliminar la plantilla: ${error.message}`,
          type: 'error',
        })
      }
    },
  })
}

const fetchLogs = () => {
  settingsStore.fetchAuditLogs({
    startDate: logFilters.value.startDate,
    endDate: logFilters.value.endDate,
    adminEmail: logFilters.value.adminEmail,
    keyword: logFilters.value.keyword,
    limit: 100, // Limitar a los 100 más recientes por defecto
  })
}

const formatLogTimestamp = (timestamp: { toDate: () => Date }) => {
  if (!timestamp) return 'Fecha no disponible'

  // Caso 1: Es un objeto Timestamp de Firestore con el método toDate().
  if (typeof timestamp.toDate === 'function') {
    return timestamp.toDate().toLocaleString('es-CO', { timeZone: 'America/Bogota' })
  }
  // Caso 2: Es un objeto serializado con _seconds y _nanoseconds.
  if (typeof (timestamp as any)._seconds === 'number') {
    return new Date((timestamp as any)._seconds * 1000).toLocaleString('es-CO', {
      timeZone: 'America/Bogota',
    })
  }
  return 'Fecha inválida'
}

const startEditingUser = (user: SystemUser) => {
  editingUser.value = { ...user } // Clonar para no modificar el original directamente
  selectedRole.value = user.role
  selectedZone.value = user.zona || ''
  selectedColor.value = user.color || '#ffffff'
}

const cancelEditingUser = () => {
  editingUser.value = null
}

const saveUserChanges = async () => {
  if (!editingUser.value || !selectedRole.value) return

  try {
    await settingsStore.updateUserConfiguration(
      editingUser.value.uid,
      selectedRole.value,
      selectedZone.value,
      selectedColor.value,
    )
    showToast({ title: 'Éxito', message: 'Permisos actualizados.', type: 'success' })
    editingUser.value = null
  } catch (error: any) {
    showToast({ title: 'Error', message: `No se pudo actualizar: ${error.message}`, type: 'error' })
  }
}

const toggleUserStatus = async (user: SystemUser) => {
  const action = user.disabled ? 'habilitar' : 'deshabilitar'
  showDialog({
    title: `Confirmar ${action}`,
    message: `¿Está seguro de que desea ${action} la cuenta de <strong>${user.displayName}</strong>?`,
    isConfirmation: true,
    confirmationText: `Sí, ${action}`,
    async onConfirm() {
      try {
        await settingsStore.updateUserStatus(user.uid, !user.disabled)
        showToast({ title: 'Éxito', message: `Usuario ${action}do.`, type: 'success' })
      } catch (error: any) {
        showToast({
          title: 'Error',
          message: `No se pudo ${action}: ${error.message}`,
          type: 'error',
        })
      }
    },
  })
}

const isCurrentUser = (uid: string) => {
  return authStore.user?.uid === uid
}

const handleConnectGoogle = (targetUid: string) => {
  if (typeof google === 'undefined') {
    showToast({
      title: 'Error de Carga',
      message: 'Los servicios de Google no están listos. Por favor recarga la página.',
      type: 'error',
    })
    return
  }

  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID

  if (!clientId) {
    showToast({
      title: 'Error de Configuración',
      message: 'No se encontró el ID de Cliente de Google (VITE_GOOGLE_CLIENT_ID).',
      type: 'error',
    })
    return
  }

  const client = google.accounts.oauth2.initCodeClient({
    client_id: clientId,
    scope: 'https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/gmail.send',
    ux_mode: 'popup',
    callback: async (response: any) => {
      if (response.code) {
        try {
          await authStore.connectGoogleAccount(response.code, targetUid)
          showToast({
            title: '¡Éxito!',
            message: 'La cuenta de Google ha sido conectada correctamente.',
            type: 'success',
          })
          settingsStore.fetchUsers()
          settingsStore.fetchIntegrations()
        } catch (error: any) {
          showToast({
            title: 'Error de Conexión',
            message: error.message || 'No se pudo conectar la cuenta.',
            type: 'error',
          })
        }
      }
    },
  })

  client.requestCode()
}

const handleUndoRoleChange = (log: AuditLog) => {
  showDialog({
    title: 'Confirmar Acción',
    message: `¿Está seguro de que desea deshacer este cambio de rol y restaurar el rol anterior para <strong>${log.targetUser?.email || 'el usuario'}</strong>?`,
    isConfirmation: true,
    confirmationText: 'Sí, Deshacer',
    async onConfirm() {
      try {
        await settingsStore.undoRoleChange(log)
        showToast({
          title: 'Éxito',
          message: 'El cambio de rol ha sido revertido.',
          type: 'success',
        })
        fetchLogs()
      } catch (error: any) {
        showToast({
          title: 'Error',
          message: `No se pudo deshacer: ${error.message}`,
          type: 'error',
        })
      }
    },
  })
}

const exportLogsToExcel = () => {
  if (settingsStore.auditLogs.length === 0) {
    showToast({ title: 'Sin Datos', message: 'No hay registros para exportar.', type: 'info' })
    return
  }

  const dataToExport = settingsStore.auditLogs.map((log) => ({
    'Fecha y Hora': formatLogTimestamp(log.timestamp),
    Usuario: log.adminEmail,
    Acción: log.action,
    Detalles: log.details,
  }))

  const worksheet = XLSX.utils.json_to_sheet(dataToExport)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Registros de Auditoría')

  worksheet['!cols'] = [{ wch: 25 }, { wch: 30 }, { wch: 25 }, { wch: 100 }]

  const fileName = `Auditoria_${new Date().toISOString().split('T')[0]}.xlsx`
  XLSX.writeFile(workbook, fileName)
}

const handleExportTemplateClick = async () => {
  const exportBtn = document.getElementById('exportTemplateBtn') as HTMLButtonElement | null
  if (!exportBtn) return

  const originalContent = exportBtn.innerHTML
  exportBtn.disabled = true
  exportBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Generando...'

  try {
    const fileData = await (clientsStore as any).generateImportTemplate()
    const byteCharacters = atob(fileData)
    const byteNumbers = new Array(byteCharacters.length)
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i)
    }
    const byteArray = new Uint8Array(byteNumbers)
    const blob = new Blob([byteArray], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })

    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = 'Plantilla_Importacion_Clientes.xlsx'
    link.click()
    URL.revokeObjectURL(link.href)
  } catch (error: any) {
    showToast({
      title: 'Error',
      message: `No se pudo generar la plantilla: ${error.message}`,
      type: 'error',
    })
  } finally {
    exportBtn.disabled = false
    exportBtn.innerHTML = originalContent
  }
}

const handleImportClick = () => {
  const fileInput = document.createElement('input')
  fileInput.type = 'file'
  fileInput.accept = '.xlsx, .xls'
  fileInput.onchange = (e) => {
    const target = e.target as HTMLInputElement
    const file = target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = async (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: 'array' })
        const firstSheetName = workbook.SheetNames[0]
        if (!firstSheetName) throw new Error('El archivo Excel no contiene hojas.')

        const worksheet = workbook.Sheets[firstSheetName]
        const clientsJson = XLSX.utils.sheet_to_json(worksheet as XLSX.WorkSheet)

        if (clientsJson.length === 0) {
          showToast({
            title: 'Archivo Vacío',
            message: 'El archivo no contiene datos.',
            type: 'warning',
          })
          return
        }

        showDialog({
          title: 'Confirmar Importación',
          message: `Se encontraron <strong>${clientsJson.length}</strong> clientes. ¿Desea continuar con la importación?`,
          isConfirmation: true,
          confirmationText: 'Sí, Importar',
          async onConfirm() {
            const { totalImported, errors } = await (clientsStore as any).importClients(
              clientsJson,
              (progress: any) => {
                console.log(`Import progress: ${progress.percentage}% - ${progress.message}`)
              },
            )
            let summaryMessage = `¡Éxito! Se importaron ${totalImported} clientes.`
            if (errors && errors.length > 0) {
              const errorRows = errors
                .map((e: { row: number; error: string }) => `<li>Fila ${e.row}: ${e.error}</li>`)
                .join('')
              summaryMessage = `<p>Importación completada con <strong>${errors.length} errores</strong>.</p><p>Importados: ${totalImported}</p><div class="max-h-48 overflow-y-auto bg-gray-900 p-2 mt-2 rounded custom-scrollbar"><ul>${errorRows}</ul></div>`
            }
            showDialog({
              title: 'Resultados de Importación',
              message: summaryMessage,
              onConfirm: () => { },
            })
          },
        })
      } catch (error: any) {
        showToast({
          title: 'Error de Lectura',
          message: `No se pudo procesar el archivo: ${error.message}`,
          type: 'error',
        })
      }
    }
    reader.readAsArrayBuffer(file)
  }
  fileInput.click()
}
</script>

<template>
  <div class="h-full bg-[#0a0a0a] text-gray-100 flex flex-col p-4 md:p-6 overflow-y-auto custom-scrollbar">
    <!-- Header -->
    <header class="flex-shrink-0 mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
      <div>
        <h2 class="text-2xl md:text-3xl font-bold text-white flex items-center gap-2">
          <i class="fas fa-cogs text-indigo-500"></i>
          Configuración del Sistema
        </h2>
        <p class="text-sm text-gray-400 mt-1">Administración de datos maestros, usuarios e integraciones</p>
      </div>
    </header>

    <div class="space-y-8">

      <!-- Herramientas Administrativas -->
      <section>
        <div class="flex items-center gap-3 mb-4 text-gray-300">
          <div class="h-px bg-white/10 flex-grow"></div>
          <span class="text-sm font-bold uppercase tracking-wider"><i
              class="fas fa-toolbox mr-2"></i>Herramientas</span>
          <div class="h-px bg-white/10 flex-grow"></div>
        </div>

        <div
          class="bg-[#151515] rounded-xl border border-white/10 shadow-lg p-6 flex flex-col md:flex-row justify-between items-center gap-6">
          <div class="flex items-center gap-4">
            <div class="bg-indigo-900/30 p-4 rounded-full text-indigo-400">
              <i class="fas fa-file-import text-2xl"></i>
            </div>
            <div>
              <h3 class="font-bold text-white text-lg">Importación Masiva de Clientes</h3>
              <p class="text-gray-400 text-sm">Carga clientes rápidamente usando una plantilla de Excel estándar.</p>
            </div>
          </div>
          <div class="flex gap-3 w-full md:w-auto">
            <button id="exportTemplateBtn" @click="handleExportTemplateClick"
              class="btn btn-secondary flex-1 justify-center">
              <i class="fas fa-download mr-2"></i> Plantilla
            </button>
            <button @click="handleImportClick"
              class="btn btn-primary bg-indigo-600 hover:bg-indigo-700 flex-1 justify-center shadow-lg shadow-indigo-500/30">
              <i class="fas fa-upload mr-2"></i> Importar
            </button>
          </div>
        </div>
      </section>

      <!-- Datos de Negocio (Grid) -->
      <section>
        <div class="flex justify-between items-center mb-4">
          <div class="flex items-center gap-3 text-gray-300 w-full">
            <div class="h-px bg-white/10 w-8"></div>
            <span class="text-sm font-bold uppercase tracking-wider"><i class="fas fa-database mr-2"></i>Datos
              Maestros</span>
            <div class="h-px bg-white/10 flex-grow"></div>
          </div>
          <button @click="saveBusinessData"
            class="btn btn-primary bg-green-600 hover:bg-green-700 shrink-0 ml-4 shadow-lg shadow-green-500/20">
            <i class="fas fa-save mr-2"></i> Guardar Todo
          </button>
        </div>

        <div v-if="settingsStore.loadingBusinessData"
          class="bg-[#151515] rounded-xl p-12 text-center border border-white/10 border-dashed">
          <i class="fas fa-spinner fa-spin text-3xl text-indigo-500"></i>
          <p class="mt-4 text-gray-400">Cargando configuración...</p>
        </div>

        <div v-else class="grid grid-cols-1 md:grid-cols-3 gap-6">
          <!-- Zonas -->
          <div class="bg-[#151515] rounded-xl border border-white/10 shadow-md flex flex-col overflow-hidden h-80">
            <div class="bg-[#0a0a0a]/50 p-4 border-b border-white/10 flex justify-between items-center">
              <h3 class="font-bold text-gray-200">Zonas de Negocio</h3>
              <span class="bg-white/10 text-xs px-2 py-0.5 rounded-full text-gray-300">{{
                settingsStore.businessData.businessZones?.length || 0 }}</span>
            </div>
            <div class="p-4 bg-[#151515]/50 border-b border-white/10">
              <div class="flex gap-2">
                <input v-model="newZoneName" @keyup.enter="addZone" type="text" placeholder="Nueva Zona..."
                  class="input-field-dark flex-grow py-1.5 text-sm">
                <button @click="addZone" class="btn btn-primary bg-indigo-600 !py-1.5 !px-3"><i
                    class="fas fa-plus"></i></button>
              </div>
            </div>
            <div class="flex-grow overflow-y-auto custom-scrollbar p-2 space-y-1">
              <div v-for="(zone, index) in settingsStore.businessData.businessZones" :key="zone.name"
                class="flex justify-between items-center p-2 rounded hover:bg-white/5 group transition-colors">
                <span class="text-sm text-gray-300">{{ zone.name }}</span>
                <button @click="removeZone(index)" class="text-gray-600 group-hover:text-red-400 transition-colors"><i
                    class="fas fa-trash-alt"></i></button>
              </div>
            </div>
          </div>

          <!-- Aliados -->
          <div class="bg-[#151515] rounded-xl border border-white/10 shadow-md flex flex-col overflow-hidden h-80">
            <div class="bg-[#0a0a0a]/50 p-4 border-b border-white/10 flex justify-between items-center">
              <h3 class="font-bold text-gray-200">Aliados</h3>
              <span class="bg-white/10 text-xs px-2 py-0.5 rounded-full text-gray-300">{{
                settingsStore.businessData.alliesList?.length || 0 }}</span>
            </div>
            <div class="p-4 bg-[#151515]/50 border-b border-white/10">
              <div class="flex gap-2">
                <input ref="allyInput" v-model="newAllyName" @keyup.enter="addAlly" type="text"
                  placeholder="Nuevo Aliado..." class="input-field-dark flex-grow py-1.5 text-sm">
                <button @click="addAlly" class="btn btn-primary bg-indigo-600 !py-1.5 !px-3"><i
                    class="fas fa-plus"></i></button>
              </div>
            </div>
            <div class="flex-grow overflow-y-auto custom-scrollbar p-2 space-y-1">
              <div v-for="(ally, index) in settingsStore.businessData.alliesList" :key="ally"
                class="flex justify-between items-center p-2 rounded hover:bg-white/5 group transition-colors">
                <span class="text-sm text-gray-300">{{ ally }}</span>
                <button @click="removeAlly(index)" class="text-gray-600 group-hover:text-red-400 transition-colors"><i
                    class="fas fa-trash-alt"></i></button>
              </div>
            </div>
          </div>

          <!-- Servicios -->
          <div class="bg-[#151515] rounded-xl border border-white/10 shadow-md flex flex-col overflow-hidden h-80">
            <div class="bg-[#0a0a0a]/50 p-4 border-b border-white/10 flex justify-between items-center">
              <h3 class="font-bold text-gray-200">Tipos de Servicio</h3>
              <span class="bg-white/10 text-xs px-2 py-0.5 rounded-full text-gray-300">{{
                settingsStore.businessData.serviceTypes?.length || 0 }}</span>
            </div>
            <div class="p-4 bg-[#151515]/50 border-b border-white/10">
              <div class="flex gap-2">
                <input v-model="newServiceTypeName" @keyup.enter="addServiceType" type="text"
                  placeholder="Nuevo Servicio..." class="input-field-dark flex-grow py-1.5 text-sm">
                <button @click="addServiceType" class="btn btn-primary bg-indigo-600 !py-1.5 !px-3"><i
                    class="fas fa-plus"></i></button>
              </div>
            </div>
            <div class="flex-grow overflow-y-auto custom-scrollbar p-2 space-y-1">
              <div v-for="(service, index) in settingsStore.businessData.serviceTypes" :key="service.name"
                class="flex justify-between items-center p-2 rounded hover:bg-white/5 group transition-colors">
                <span class="text-sm text-gray-300">{{ service.name }}</span>
                <button @click="removeServiceType(index)"
                  class="text-gray-600 group-hover:text-red-400 transition-colors"><i
                    class="fas fa-trash-alt"></i></button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Plantillas de Visita -->
      <section v-if="!settingsStore.loadingBusinessData && availableServices.length > 0" id="template-form">
        <div class="flex items-center gap-3 mb-4 text-gray-300">
          <div class="h-px bg-white/10 flex-grow"></div>
          <span class="text-sm font-bold uppercase tracking-wider"><i class="fas fa-clipboard-list mr-2"></i>Plantillas
            de Visita</span>
          <div class="h-px bg-white/10 flex-grow"></div>
        </div>

        <div
          class="bg-[#151515] rounded-xl border border-white/10 shadow-lg overflow-hidden grid grid-cols-1 lg:grid-cols-2">
          <!-- Formulario -->
          <div class="p-6 border-b lg:border-b-0 lg:border-r border-white/10 bg-[#151515]">
            <h3 class="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <i :class="isTemplateEditMode ? 'fas fa-edit text-yellow-500' : 'fas fa-plus-circle text-green-500'"></i>
              {{ isTemplateEditMode ? 'Editar Plantilla' : 'Nueva Plantilla' }}
            </h3>
            <div class="space-y-4">
              <div>
                <label class="form-label">Nombre</label>
                <input v-model="editingTemplate.templateName" type="text" class="input-field-dark w-full"
                  placeholder="Ej: Mantenimiento Mensual">
              </div>
              <div>
                <label class="form-label">Tipo de Servicio</label>
                <select v-model="editingTemplate.tipo_visita" class="input-field-dark w-full">
                  <option disabled value="">Seleccione...</option>
                  <option v-for="s in availableServices" :key="s.name" :value="s.name">{{ s.name }}</option>
                </select>
              </div>
              <div>
                <label class="form-label">Notas Predefinidas</label>
                <textarea v-model="editingTemplate.notas_visita" rows="3" class="input-field-dark w-full resize-none"
                  placeholder="Instrucciones para el técnico..."></textarea>
              </div>
              <div class="flex gap-3 pt-2">
                <button @click="saveTemplate"
                  class="btn btn-primary bg-indigo-600 hover:bg-indigo-700 flex-1 justify-center">
                  <i class="fas fa-save mr-2"></i> Guardar
                </button>
                <button v-if="isTemplateEditMode" @click="cancelEditingTemplate"
                  class="btn btn-secondary flex-1 justify-center">
                  Cancelar
                </button>
              </div>
            </div>
          </div>

          <!-- Lista -->
          <div class="p-6 bg-[#0a0a0a]/30 max-h-96 overflow-y-auto custom-scrollbar">
            <h3 class="text-lg font-bold text-white mb-4">Plantillas Guardadas</h3>
            <div v-if="planningStore.visitTemplates.length === 0" class="text-gray-500 text-center py-8">
              <i class="fas fa-folder-open text-3xl mb-2 opacity-50"></i>
              <p>No hay plantillas.</p>
            </div>
            <div v-else class="space-y-3">
              <div v-for="t in planningStore.visitTemplates" :key="t.id"
                class="bg-white/5 border border-white/10 p-3 rounded-lg flex justify-between items-start hover:bg-white/10 transition-colors">
                <div>
                  <p class="font-bold text-white text-sm">{{ t.templateName }}</p>
                  <span class="text-xs text-indigo-300 bg-indigo-900/30 px-2 py-0.5 rounded mt-1 inline-block">{{
                    t.tipo_visita }}</span>
                </div>
                <div class="flex gap-1">
                  <button @click="startEditingTemplate(t)"
                    class="p-1.5 text-gray-400 hover:text-white rounded hover:bg-white/10"><i
                      class="fas fa-pencil-alt"></i></button>
                  <button @click="deleteTemplate(t)"
                    class="p-1.5 text-gray-400 hover:text-red-400 rounded hover:bg-white/10"><i
                      class="fas fa-trash-alt"></i></button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Auditoría -->
      <section v-if="settingsStore.auditLogs.length > 0">
        <div class="flex items-center gap-3 mb-4 text-gray-300">
          <div class="h-px bg-white/10 flex-grow"></div>
          <span class="text-sm font-bold uppercase tracking-wider"><i
              class="fas fa-shield-alt mr-2"></i>Auditoría</span>
          <div class="h-px bg-white/10 flex-grow"></div>
        </div>

        <!-- Gráfico -->
        <div class="bg-[#151515] rounded-xl border border-white/10 shadow-lg p-4 mb-6 h-72">
          <Bar :data="chartData" :options="chartOptions" />
        </div>

        <!-- Tabla de Logs -->
        <div class="bg-[#151515] rounded-xl border border-white/10 shadow-lg overflow-hidden">
          <!-- Filtros -->
          <div class="p-4 border-b border-white/10 bg-[#0a0a0a]/30 flex flex-col md:flex-row gap-4 items-end">
            <div class="w-full md:w-auto">
              <label class="text-xs font-bold text-gray-500 uppercase mb-1 block">Rango</label>
              <div class="flex gap-2">
                <input type="date" v-model="logFilters.startDate" class="input-field-dark text-sm py-1.5">
                <input type="date" v-model="logFilters.endDate" class="input-field-dark text-sm py-1.5">
              </div>
            </div>
            <div class="flex-grow w-full md:w-auto">
              <label class="text-xs font-bold text-gray-500 uppercase mb-1 block">Búsqueda</label>
              <div class="flex gap-2 w-full">
                <input type="text" v-model="logFilters.keyword" placeholder="Buscar acción, detalle..."
                  class="input-field-dark w-full py-1.5 text-sm">
                <select v-model="logFilters.adminEmail" class="input-field-dark py-1.5 text-sm w-40">
                  <option value="Todos">Todos</option>
                  <option v-for="user in uniqueLogUsers" :key="user" :value="user">{{ user.split('@')[0] }}</option>
                </select>
              </div>
            </div>
            <div class="flex gap-2 w-full md:w-auto">
              <button @click="fetchLogs" class="btn btn-secondary py-1.5 text-sm flex-1"><i
                  class="fas fa-filter mr-2"></i>Filtrar</button>
              <button @click="exportLogsToExcel" class="btn btn-secondary py-1.5 text-sm flex-1"><i
                  class="fas fa-file-excel mr-2"></i>Exportar</button>
            </div>
          </div>

          <!-- Tabla -->
          <div class="overflow-x-auto max-h-[500px] custom-scrollbar">
            <table class="min-w-full divide-y divide-gray-700">
              <thead class="bg-[#0a0a0a]/80 sticky top-0 z-10 backdrop-blur-sm">
                <tr>
                  <th class="px-6 py-3 text-left text-xs font-bold text-gray-400 uppercase">Fecha</th>
                  <th class="px-6 py-3 text-left text-xs font-bold text-gray-400 uppercase">Usuario</th>
                  <th class="px-6 py-3 text-left text-xs font-bold text-gray-400 uppercase">Acción</th>
                  <th class="px-6 py-3 text-left text-xs font-bold text-gray-400 uppercase">Detalles</th>
                  <th class="px-6 py-3 text-center text-xs font-bold text-gray-400 uppercase"></th>
                </tr>
              </thead>
              <tbody class="divide-y divide-white/5 bg-[#151515]">
                <tr v-for="log in settingsStore.auditLogs" :key="log.id" class="hover:bg-white/5">
                  <td class="px-6 py-3 text-xs text-gray-400 whitespace-nowrap">{{ formatLogTimestamp(log.timestamp) }}
                  </td>
                  <td class="px-6 py-3 text-sm text-white font-medium">{{ log.adminEmail }}</td>
                  <td class="px-6 py-3"><span
                      class="bg-white/10 text-gray-300 text-xs px-2 py-0.5 rounded border border-white/10">{{ log.action
                      }}</span></td>
                  <td class="px-6 py-3 text-sm text-gray-300 truncate max-w-xs" :title="log.details">{{ log.details }}
                  </td>
                  <td class="px-6 py-3 text-center">
                    <button v-if="log.action === 'UPDATE_USER_CONFIG' && log.previousState && !log.undone"
                      @click="handleUndoRoleChange(log)" class="text-blue-400 hover:text-blue-300 text-xs"
                      title="Deshacer Cambio">
                      <i class="fas fa-undo"></i>
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <!-- Gestión de Usuarios -->
      <section>
        <div class="flex items-center gap-3 mb-4 text-gray-300">
          <div class="h-px bg-white/10 flex-grow"></div>
          <span class="text-sm font-bold uppercase tracking-wider"><i class="fas fa-users-cog mr-2"></i>Usuarios del
            Sistema</span>
          <div class="h-px bg-white/10 flex-grow"></div>
        </div>

        <div class="bg-[#151515] rounded-xl border border-white/10 shadow-lg overflow-hidden">
          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-white/5">
              <thead class="bg-[#0a0a0a]/50">
                <tr>
                  <th class="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase">Usuario</th>
                  <th class="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase">Rol</th>
                  <th class="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase">Zona Asignada</th>
                  <th class="px-6 py-4 text-center text-xs font-bold text-gray-400 uppercase">Color</th>
                  <th class="px-6 py-4 text-center text-xs font-bold text-gray-400 uppercase">Estado</th>
                  <th class="px-6 py-4 text-center text-xs font-bold text-gray-400 uppercase">Acciones</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-white/5 bg-[#151515]">
                <tr v-for="user in settingsStore.users" :key="user.uid" class="hover:bg-white/5 transition-colors">
                  <td class="px-6 py-4 whitespace-nowrap">
                    <div class="flex items-center">
                      <div
                        class="h-8 w-8 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold text-gray-300 mr-3 overflow-hidden">
                        <img v-if="(user as any).photoURL" :key="(user as any).photoURL" :src="(user as any).photoURL"
                          alt="Avatar" class="w-full h-full object-cover" />
                        <span v-else>{{ user.displayName?.charAt(0).toUpperCase() || 'U' }}</span>
                      </div>
                      <div>
                        <div class="text-sm font-bold text-white">{{ user.displayName }}</div>
                        <div class="text-xs text-gray-400">{{ user.email }}</div>
                      </div>
                    </div>
                  </td>

                  <!-- Columna Rol Editable -->
                  <td class="px-6 py-4 whitespace-nowrap">
                    <div v-if="editingUser?.uid === user.uid">
                      <select v-model="selectedRole" class="input-field-dark py-1 text-sm">
                        <option v-for="role in roles" :key="role" :value="role">{{ role }}</option>
                      </select>
                    </div>
                    <span v-else
                      class="px-2 py-1 text-xs font-semibold rounded bg-indigo-900/30 text-indigo-300 border border-indigo-800">
                      {{ user.role }}
                    </span>
                  </td>

                  <!-- Columna Zona Editable -->
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                    <div v-if="editingUser?.uid === user.uid">
                      <select v-model="selectedZone" class="input-field-dark py-1 text-sm">
                        <option value="">Sin Zona</option>
                        <option v-for="z in zonas" :key="z" :value="z">{{ z }}</option>
                      </select>
                    </div>
                    <span v-else>{{ user.zona || '-' }}</span>
                  </td>

                  <!-- Columna Color Editable -->
                  <td class="px-6 py-4 whitespace-nowrap text-center">
                    <div v-if="editingUser?.uid === user.uid" class="flex justify-center">
                      <input type="color" v-model="selectedColor"
                        class="h-8 w-8 p-0 border-0 rounded bg-transparent cursor-pointer">
                    </div>
                    <div v-else class="flex justify-center">
                      <div class="h-6 w-6 rounded-full border border-white/20 shadow-sm"
                        :style="{ backgroundColor: user.color || 'transparent' }"></div>
                    </div>
                  </td>

                  <!-- Estado -->
                  <td class="px-6 py-4 whitespace-nowrap text-center">
                    <div class="flex items-center justify-center gap-1.5">
                      <div class="w-2 h-2 rounded-full" :class="user.disabled ? 'bg-red-500' : 'bg-green-500'"></div>
                      <span class="text-xs text-gray-400">{{ user.disabled ? 'Inactivo' : 'Activo' }}</span>
                    </div>
                  </td>

                  <!-- Acciones -->
                  <td class="px-6 py-4 whitespace-nowrap text-center text-sm">
                    <div class="flex justify-center gap-2">
                      <template v-if="editingUser?.uid === user.uid">
                        <button @click="saveUserChanges"
                          class="p-1.5 bg-green-600 text-white rounded hover:bg-green-700 shadow-sm"><i
                            class="fas fa-check"></i></button>
                        <button @click="cancelEditingUser"
                          class="p-1.5 bg-gray-600 text-white rounded hover:bg-gray-500 shadow-sm"><i
                            class="fas fa-times"></i></button>
                      </template>
                      <template v-else>
                        <button @click="startEditingUser(user)" :disabled="isCurrentUser(user.uid)"
                          class="text-gray-400 hover:text-white p-1.5 disabled:opacity-30"><i
                            class="fas fa-pencil-alt"></i></button>
                        <button @click="toggleUserStatus(user)" :disabled="isCurrentUser(user.uid)"
                          class="text-gray-400 hover:text-red-400 p-1.5 disabled:opacity-30"><i
                            :class="user.disabled ? 'fas fa-toggle-off' : 'fas fa-toggle-on'"></i></button>
                        <button v-if="!user.isConnected" @click="handleConnectGoogle(user.uid)"
                          class="text-blue-400 hover:text-blue-300 p-1.5" title="Conectar Google Calendar"><i
                            class="fab fa-google"></i></button>
                      </template>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <!-- Integraciones -->
      <section v-if="settingsStore.integrations.length > 0">
        <div class="flex items-center gap-3 mb-4 text-gray-300">
          <div class="h-px bg-white/10 flex-grow"></div>
          <span class="text-sm font-bold uppercase tracking-wider"><i class="fas fa-link mr-2"></i>Cuentas
            Vinculadas</span>
          <div class="h-px bg-white/10 flex-grow"></div>
        </div>

        <div class="bg-[#151515] rounded-xl border border-white/10 shadow-lg overflow-hidden">
          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-white/5">
              <thead class="bg-[#0a0a0a]/50">
                <tr>
                  <th class="px-6 py-3 text-left text-xs font-bold text-gray-400 uppercase">Cuenta Google</th>
                  <th class="px-6 py-3 text-left text-xs font-bold text-gray-400 uppercase">Zona</th>
                  <th class="px-6 py-3 text-center text-xs font-bold text-gray-400 uppercase">Acciones</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-white/5 bg-[#151515]">
                <tr v-for="integration in settingsStore.integrations" :key="integration.uid" class="hover:bg-white/5">
                  <td class="px-6 py-4 whitespace-nowrap">
                    <div class="flex items-center gap-3">
                      <i class="fab fa-google text-lg text-gray-400"></i>
                      <div>
                        <div class="text-sm font-bold text-white">{{ integration.googleUserName }}</div>
                        <div class="text-xs text-gray-500">{{ integration.googleEmail }}</div>
                      </div>
                    </div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{{ integration.zona || '-' }}</td>
                  <td class="px-6 py-4 whitespace-nowrap text-center">
                    <button @click="handleDisconnect(integration)"
                      class="text-red-400 hover:text-red-300 text-xs font-bold uppercase tracking-wide border border-red-900/50 bg-red-900/20 px-3 py-1 rounded hover:bg-red-900/40 transition-colors">
                      Desconectar
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

    </div>
  </div>
</template>
