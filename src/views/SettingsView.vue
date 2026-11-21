<!-- eslint-disable @typescript-eslint/no-unused-vars -->
<!-- eslint-disable @typescript-eslint/no-explicit-any -->
<script setup lang="ts">
import { onMounted, ref, nextTick, computed, watch } from 'vue'
import { useStorage } from '@vueuse/core'
import {
  useSettingsStore,
  type CalendarIntegration,
  type AuditLog,
  type SystemUser,
  type WorkspacePreferences,
} from '@/stores/settings'
import { useAuthStore } from '@/stores/auth'
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
const { showDialog } = useDialog()
const { showToast } = useToast()
const authStore = useAuthStore()
const theme = useStorage('sisfumi-theme', 'light')
const categories = [
  { id: 'company', label: 'Empresa', icon: 'fa-id-card' },
  { id: 'operations', label: 'Operación', icon: 'fa-calendar-check' },
  { id: 'business', label: 'Datos de negocio', icon: 'fa-building' },
  { id: 'users', label: 'Usuarios y acceso', icon: 'fa-users-cog', admin: true },
  { id: 'integrations', label: 'Integraciones', icon: 'fa-link' },
  { id: 'appearance', label: 'Apariencia', icon: 'fa-adjust' },
  { id: 'audit', label: 'Auditoría', icon: 'fa-clipboard-list', admin: true },
] as const
const section = ref<(typeof categories)[number]['id']>('business')
const preferences = ref<WorkspacePreferences>()
const preferencesBusy = ref(false)
const preferencesError = ref('')
const accessUser = ref('')
const accessDraft = ref<Record<string, Record<string, boolean>>>({})
const accessLoaded = ref(false)
const accessBusy = ref(false)
const accessError = ref('')
const canManageAccess = computed(() => authStore.userRole === 'Administrador')
const accessActions = [
  { id: 'view', label: 'Ver' }, { id: 'create', label: 'Crear' }, { id: 'edit', label: 'Editar' },
  { id: 'delete', label: 'Eliminar' }, { id: 'export', label: 'Exportar' },
]
const accessModules = [
  { id: 'clientes', label: 'Clientes', actions: ['view', 'create', 'edit', 'delete', 'export'] },
  { id: 'servicios', label: 'Servicios', actions: ['view', 'create', 'edit', 'delete'] },
  { id: 'planeacion', label: 'Planeación', actions: ['view', 'create', 'edit', 'delete'] },
  { id: 'fumigadores', label: 'Técnicos', actions: ['view', 'create', 'edit', 'delete'] },
  { id: 'reportes', label: 'Reportes', actions: ['view', 'export'] },
]
const calendarDate = (value?: string | null) => value
  ? new Date(value).toLocaleString('es-CO', { timeZone: 'America/Bogota', dateStyle: 'medium', timeStyle: 'short' })
  : 'Sin registro'

async function loadPreferences() {
  try {
    await settingsStore.fetchWorkspacePreferences()
    preferences.value = JSON.parse(JSON.stringify(settingsStore.workspacePreferences))
  } catch {
    preferencesError.value = 'No se pudieron cargar las preferencias.'
  }
}

async function savePreferences() {
  if (!preferences.value || preferencesBusy.value) return
  preferencesBusy.value = true
  preferencesError.value = ''
  try {
    await settingsStore.saveWorkspacePreferences(preferences.value)
    preferences.value = JSON.parse(JSON.stringify(settingsStore.workspacePreferences))
    showToast({ title: 'Preferencias guardadas', message: 'Se actualizaron los datos del sistema.', type: 'success' })
  } catch (error) {
    preferencesError.value = error instanceof Error ? error.message : 'No se pudieron guardar las preferencias.'
  } finally {
    preferencesBusy.value = false
  }
}

async function selectLogo(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file || !preferences.value) return
  preferencesError.value = ''
  if (file.type !== 'image/png' || file.size > 110000) {
    preferencesError.value = 'Selecciona un PNG de hasta 110 kB.'
    input.value = ''
    return
  }
  const reader = new FileReader()
  reader.onload = () => {
    if (preferences.value && typeof reader.result === 'string') preferences.value.company.logo = reader.result
  }
  reader.onerror = () => { preferencesError.value = 'No se pudo leer el archivo.' }
  reader.readAsDataURL(file)
}

async function loadAccess() {
  const uid = accessUser.value
  accessDraft.value = {}
  accessLoaded.value = false
  accessError.value = ''
  if (!uid) return
  accessBusy.value = true
  try {
    const existing = await settingsStore.getUserAccess(uid)
    accessDraft.value = Object.fromEntries(accessModules.map(({ id }) => [id, { ...existing[id] }]))
    accessLoaded.value = true
  } catch {
    accessError.value = 'No se pudieron cargar los permisos del usuario.'
  } finally {
    accessBusy.value = false
  }
}

async function saveAccess() {
  if (!accessLoaded.value || !accessUser.value || accessBusy.value) return
  accessBusy.value = true
  accessError.value = ''
  try {
    await settingsStore.saveUserAccess(accessUser.value, accessDraft.value)
    showToast({ title: 'Acceso actualizado', message: 'Se guardaron las restricciones del usuario.', type: 'success' })
  } catch (error) {
    accessError.value = error instanceof Error ? error.message : 'No se pudieron guardar los permisos.'
  } finally {
    accessBusy.value = false
  }
}


ChartJS.register(Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale)

// Declaramos la variable global de Google para evitar errores de TypeScript
declare const google: any

// Solo Administrador/Jefe pueden consultar integraciones y usuarios globales.
const isAdminOrJefe = computed(() =>
  ['Administrador', 'Jefe'].includes(authStore.userRole || ''),
)

const visibleCategories = computed(() => categories.filter((item) => !('admin' in item) || isAdminOrJefe.value))

const canEditBusinessData = computed(() =>
  [
    'Administrador',
    'Jefe',
    'Coordinador Valle',
    'Coordinador Norte de Santander',
  ].includes(authStore.userRole || ''),
)

onMounted(async () => {
  void loadPreferences()
  // Asegurar que los datos de negocio se carguen primero.
  await settingsStore.fetchBusinessData()

  if (isAdminOrJefe.value) {
    settingsStore.fetchUsers()
    settingsStore.fetchIntegrations()
    fetchLogs() // Cargar logs iniciales
  } else if (authStore.user?.uid) {
    settingsStore.fetchOwnIntegrationStatus(authStore.user.uid)
  }
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

const roles = [
  'Administrador',
  'Jefe',
  'Coordinador Nacional',
  'Coordinador Valle',
  'Coordinador Norte de Santander',
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

const myIntegrationConnected = computed(() => {
  if (!isAdminOrJefe.value) return settingsStore.ownIntegrationConnected
  return (
    settingsStore.users.find((u) => u.uid === authStore.user?.uid)?.isConnected ?? false
  )
})

const handleConnectGoogle = (targetUid: string) => {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID

  if (!clientId) {
    showToast({
      title: 'Error de Configuración',
      message: 'No se encontró el ID de Cliente de Google (VITE_GOOGLE_CLIENT_ID).',
      type: 'error',
    })
    return
  }

  authStore
    .connectGoogleAccount(clientId, targetUid)
    .then(() => {
      showToast({
        title: '¡Éxito!',
        message: 'La cuenta de Google ha sido conectada correctamente.',
        type: 'success',
      })
      if (isAdminOrJefe.value && authStore.user?.uid) {
        settingsStore.fetchUsers()
      } else if (authStore.user?.uid) {
        settingsStore.fetchOwnIntegrationStatus(authStore.user.uid)
      }
      // ✅ FIX: solo refrescar la tabla de integraciones (admin-only) si el
      // usuario actual tiene permiso; si no, dispararía otro 403.
      if (isAdminOrJefe.value) settingsStore.fetchIntegrations()
    })
    .catch((error: any) => {
      showToast({
        title: 'Error de Conexión',
        message: error.message || 'No se pudo conectar la cuenta.',
        type: 'error',
      })
    })
}

// ✅ NUEVO: desconectar la propia cuenta. El backend ya permite que el
// dueño (isOwner) se desconecte a sí mismo, sin necesitar rol de admin.
const handleDisconnectMyAccount = () => {
  const uid = authStore.user?.uid
  if (!uid) return

  showDialog({
    title: 'Confirmar Desconexión',
    message:
      '¿Estás seguro de que deseas desconectar tu cuenta de Google? Dejarás de recibir eventos y notificaciones automáticas hasta que vuelvas a conectarla.',
    isConfirmation: true,
    confirmationText: 'Sí, Desconectar',
    async onConfirm() {
      try {
        await settingsStore.disconnectAccount(uid)
        await settingsStore.fetchOwnIntegrationStatus(uid)
        showToast({
          title: 'Listo',
          message: 'Tu cuenta de Google ha sido desconectada.',
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

</script>

<template>
  <section class="settings-page space-y-4">
    <header class="flex items-center gap-3 py-2">
      <span class="settings-icon grid size-12 shrink-0 place-items-center rounded-xl text-xl"><i class="fas fa-gear" aria-hidden="true"></i></span>
      <div>
        <h1 class="text-2xl font-extrabold tracking-tight sm:text-3xl">Configuración</h1>
        <p class="settings-muted mt-1 text-sm">Administra catálogos, cuentas y preferencias de SisFumi.</p>
      </div>
    </header>

    <nav class="settings-nav flex flex-wrap gap-2 p-3" aria-label="Secciones de configuración">
      <button v-for="item in visibleCategories" :key="item.id" type="button" class="settings-tab"
        :aria-pressed="section === item.id" @click="section = item.id">
        <i class="fas" :class="item.icon" aria-hidden="true"></i>{{ item.label }}
      </button>
    </nav>

    <div class="space-y-4">
      <section v-show="section === 'company' || section === 'operations'" class="settings-card p-5">
        <p v-if="preferencesError" role="alert" class="mb-3 text-sm text-[var(--settings-accent)]">{{ preferencesError }}</p>
        <p v-if="!preferences && !preferencesError" class="settings-muted text-sm" role="status">Cargando preferencias…</p>
        <form v-if="preferences" @submit.prevent="savePreferences">
          <fieldset :disabled="preferencesBusy || !isAdminOrJefe" class="grid gap-3">
            <template v-if="section === 'company'">
              <h2 class="text-lg font-bold">Perfil de empresa</h2>
              <div class="grid gap-3 sm:grid-cols-2">
                <label class="grid gap-1 text-sm">Razón social<input v-model.trim="preferences.company.name" class="input-field-dark p-2" maxlength="120" required /></label>
                <label class="grid gap-1 text-sm">NIT<input v-model.trim="preferences.company.nit" class="input-field-dark p-2" maxlength="40" /></label>
                <label class="grid gap-1 text-sm">Correo corporativo<input v-model.trim="preferences.company.email" type="email" class="input-field-dark p-2" maxlength="120" /></label>
                <label class="grid gap-1 text-sm">Teléfono<input v-model.trim="preferences.company.phone" type="tel" class="input-field-dark p-2" maxlength="40" /></label>
              </div>
              <div class="flex flex-wrap items-center gap-3">
                <img :src="preferences.company.logo || '/logo.png'" alt="Logo de la empresa" class="h-16 w-24 rounded-lg bg-[#111] object-contain" />
                <label class="grid gap-1 text-sm">Logo PNG · máximo 110 kB<input type="file" accept="image/png" class="max-w-full text-xs" @change="selectLogo" /></label>
                <button v-if="preferences.company.logo" type="button" class="btn btn-secondary" @click="preferences.company.logo = ''">Restaurar logo original</button>
              </div>
            </template>
            <template v-else>
              <h2 class="text-lg font-bold">Preferencias operativas</h2>
              <div class="grid gap-3 sm:grid-cols-2">
                <label class="grid gap-1 text-sm">Duración predeterminada · minutos<input v-model.number="preferences.operations.durationMinutes" type="number" min="1" max="1440" class="input-field-dark p-2" required /></label>
                <label class="grid gap-1 text-sm">Anticipación del recordatorio · horas<input v-model.number="preferences.operations.reminderHours" type="number" min="1" max="168" class="input-field-dark p-2" required /></label>
                <label class="grid gap-1 text-sm">Inicio de atención<input v-model="preferences.operations.opensAt" type="time" class="input-field-dark p-2" required /></label>
                <label class="grid gap-1 text-sm">Fin de atención<input v-model="preferences.operations.closesAt" type="time" class="input-field-dark p-2" required /></label>
              </div>
              <p class="settings-muted text-sm">Las visitas nuevas usan el inicio de atención y la duración predeterminada. El horario se puede ajustar en cada visita.</p>
            </template>
            <button v-if="isAdminOrJefe" type="submit" class="btn btn-primary justify-self-start">
              {{ preferencesBusy ? 'Guardando…' : 'Guardar preferencias' }}
            </button>
          </fieldset>
        </form>
      </section>

      <!-- Datos de Negocio -->
      <section v-show="section === 'business'">
        <div class="flex justify-between items-center mb-4">
          <div class="flex items-center gap-3 text-[var(--shell-muted)] w-full">
            <div class="h-px bg-[var(--shell-input)] w-8"></div>
            <span class="text-sm font-bold uppercase tracking-wider"><i class="fas fa-database mr-2"></i>Datos
              Maestros</span>
            <div class="h-px bg-[var(--shell-input)] flex-grow"></div>
          </div>
          <button @click="saveBusinessData" :disabled="!canEditBusinessData"
            class="btn btn-primary bg-green-600 hover:bg-green-700 shrink-0 ml-4 shadow-lg shadow-green-500/20">
            <i class="fas fa-save mr-2"></i> Guardar Todo
          </button>
        </div>

        <fieldset :disabled="!canEditBusinessData">
          <div v-if="settingsStore.loadingBusinessData"
            class="bg-[var(--shell-surface)] rounded-xl p-12 text-center border border-[var(--shell-border)] border-dashed">
            <i class="fas fa-spinner fa-spin text-3xl text-[var(--settings-accent)]"></i>
            <p class="mt-4 text-[var(--shell-muted)]">Cargando configuración...</p>
          </div>

          <div v-else class="grid grid-cols-1 md:grid-cols-3 gap-6">
          <!-- Zonas -->
          <div class="bg-[var(--shell-surface)] rounded-xl border border-[var(--shell-border)] shadow-md flex flex-col overflow-hidden h-80">
            <div class="bg-[var(--shell-input)] p-4 border-b border-[var(--shell-border)] flex justify-between items-center">
              <h3 class="font-bold text-[var(--shell-muted)]">Zonas de Negocio</h3>
              <span class="bg-[var(--shell-input)] text-xs px-2 py-0.5 rounded-full text-[var(--shell-muted)]">{{
                settingsStore.businessData.businessZones?.length || 0 }}</span>
            </div>
            <div class="p-4 bg-[var(--shell-surface)] border-b border-[var(--shell-border)]">
              <div class="flex gap-2">
                <input v-model="newZoneName" @keyup.enter="addZone" type="text" placeholder="Nueva Zona..."
                  class="input-field-dark flex-grow py-1.5 text-sm">
                <button @click="addZone" class="btn btn-primary bg-indigo-600 !py-1.5 !px-3"><i
                    class="fas fa-plus"></i></button>
              </div>
            </div>
            <div class="flex-grow overflow-y-auto custom-scrollbar p-2 space-y-1">
              <div v-for="(zone, index) in settingsStore.businessData.businessZones" :key="zone.name"
                class="flex justify-between items-center p-2 rounded hover:bg-[var(--shell-input)] group transition-colors">
                <span class="text-sm text-[var(--shell-muted)]">{{ zone.name }}</span>
                <button @click="removeZone(index)" class="text-[var(--shell-muted)] group-hover:text-red-400 transition-colors"><i
                    class="fas fa-trash-alt"></i></button>
              </div>
            </div>
          </div>

          <!-- Aliados -->
          <div class="bg-[var(--shell-surface)] rounded-xl border border-[var(--shell-border)] shadow-md flex flex-col overflow-hidden h-80">
            <div class="bg-[var(--shell-input)] p-4 border-b border-[var(--shell-border)] flex justify-between items-center">
              <h3 class="font-bold text-[var(--shell-muted)]">Aliados</h3>
              <span class="bg-[var(--shell-input)] text-xs px-2 py-0.5 rounded-full text-[var(--shell-muted)]">{{
                settingsStore.businessData.alliesList?.length || 0 }}</span>
            </div>
            <div class="p-4 bg-[var(--shell-surface)] border-b border-[var(--shell-border)]">
              <div class="flex gap-2">
                <input ref="allyInput" v-model="newAllyName" @keyup.enter="addAlly" type="text"
                  placeholder="Nuevo Aliado..." class="input-field-dark flex-grow py-1.5 text-sm">
                <button @click="addAlly" class="btn btn-primary bg-indigo-600 !py-1.5 !px-3"><i
                    class="fas fa-plus"></i></button>
              </div>
            </div>
            <div class="flex-grow overflow-y-auto custom-scrollbar p-2 space-y-1">
              <div v-for="(ally, index) in settingsStore.businessData.alliesList" :key="ally"
                class="flex justify-between items-center p-2 rounded hover:bg-[var(--shell-input)] group transition-colors">
                <span class="text-sm text-[var(--shell-muted)]">{{ ally }}</span>
                <button @click="removeAlly(index)" class="text-[var(--shell-muted)] group-hover:text-red-400 transition-colors"><i
                    class="fas fa-trash-alt"></i></button>
              </div>
            </div>
          </div>

          <!-- Servicios -->
          <div class="bg-[var(--shell-surface)] rounded-xl border border-[var(--shell-border)] shadow-md flex flex-col overflow-hidden h-80">
            <div class="bg-[var(--shell-input)] p-4 border-b border-[var(--shell-border)] flex justify-between items-center">
              <h3 class="font-bold text-[var(--shell-muted)]">Tipos de Servicio</h3>
              <span class="bg-[var(--shell-input)] text-xs px-2 py-0.5 rounded-full text-[var(--shell-muted)]">{{
                settingsStore.businessData.serviceTypes?.length || 0 }}</span>
            </div>
            <div class="p-4 bg-[var(--shell-surface)] border-b border-[var(--shell-border)]">
              <div class="flex gap-2">
                <input v-model="newServiceTypeName" @keyup.enter="addServiceType" type="text"
                  placeholder="Nuevo Servicio..." class="input-field-dark flex-grow py-1.5 text-sm">
                <button @click="addServiceType" class="btn btn-primary bg-indigo-600 !py-1.5 !px-3"><i
                    class="fas fa-plus"></i></button>
              </div>
            </div>
            <div class="flex-grow overflow-y-auto custom-scrollbar p-2 space-y-1">
              <div v-for="(service, index) in settingsStore.businessData.serviceTypes" :key="service.name"
                class="flex justify-between items-center p-2 rounded hover:bg-[var(--shell-input)] group transition-colors">
                <span class="text-sm text-[var(--shell-muted)]">{{ service.name }}</span>
                <button @click="removeServiceType(index)"
                  class="text-[var(--shell-muted)] group-hover:text-red-400 transition-colors"><i
                    class="fas fa-trash-alt"></i></button>
              </div>
            </div>
          </div>
          </div>
        </fieldset>
      </section>

      <!-- Auditoría -->
      <section v-if="isAdminOrJefe" v-show="section === 'audit'">
        <div class="flex items-center gap-3 mb-4 text-[var(--shell-muted)]">
          <div class="h-px bg-[var(--shell-input)] flex-grow"></div>
          <span class="text-sm font-bold uppercase tracking-wider"><i
              class="fas fa-shield-alt mr-2"></i>Auditoría</span>
          <div class="h-px bg-[var(--shell-input)] flex-grow"></div>
        </div>

        <!-- Gráfico -->
        <div class="bg-[var(--shell-surface)] rounded-xl border border-[var(--shell-border)] shadow-lg p-4 mb-6 h-72">
          <Bar :data="chartData" :options="chartOptions" />
        </div>

        <!-- Tabla de Logs -->
        <div class="bg-[var(--shell-surface)] rounded-xl border border-[var(--shell-border)] shadow-lg overflow-hidden">
          <!-- Filtros -->
          <div class="p-4 border-b border-[var(--shell-border)] bg-[var(--shell-input)] flex flex-col md:flex-row gap-4 items-end">
            <div class="w-full md:w-auto">
              <label class="text-xs font-bold text-[var(--shell-muted)] uppercase mb-1 block">Rango</label>
              <div class="flex gap-2">
                <input type="date" v-model="logFilters.startDate" class="input-field-dark text-sm py-1.5">
                <input type="date" v-model="logFilters.endDate" class="input-field-dark text-sm py-1.5">
              </div>
            </div>
            <div class="flex-grow w-full md:w-auto">
              <label class="text-xs font-bold text-[var(--shell-muted)] uppercase mb-1 block">Búsqueda</label>
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
              <thead class="bg-[var(--shell-input)] sticky top-0 z-10 backdrop-blur-sm">
                <tr>
                  <th class="px-6 py-3 text-left text-xs font-bold text-[var(--shell-muted)] uppercase">Fecha</th>
                  <th class="px-6 py-3 text-left text-xs font-bold text-[var(--shell-muted)] uppercase">Usuario</th>
                  <th class="px-6 py-3 text-left text-xs font-bold text-[var(--shell-muted)] uppercase">Acción</th>
                  <th class="px-6 py-3 text-left text-xs font-bold text-[var(--shell-muted)] uppercase">Detalles</th>
                  <th class="px-6 py-3 text-center text-xs font-bold text-[var(--shell-muted)] uppercase"></th>
                </tr>
              </thead>
              <tbody class="divide-y divide-[var(--shell-border)] bg-[var(--shell-surface)]">
                <tr v-if="!settingsStore.auditLogs.length"><td colspan="5" class="settings-muted px-6 py-4 text-sm">Sin registros para los filtros seleccionados.</td></tr>
                <tr v-for="log in settingsStore.auditLogs" :key="log.id" class="hover:bg-[var(--shell-input)]">
                  <td class="px-6 py-3 text-xs text-[var(--shell-muted)] whitespace-nowrap">{{ formatLogTimestamp(log.timestamp) }}
                  </td>
                  <td class="px-6 py-3 text-sm text-white font-medium">{{ log.adminEmail }}</td>
                  <td class="px-6 py-3"><span
                      class="bg-[var(--shell-input)] text-[var(--shell-muted)] text-xs px-2 py-0.5 rounded border border-[var(--shell-border)]">{{ log.action
                      }}</span></td>
                  <td class="px-6 py-3 text-sm text-[var(--shell-muted)] truncate max-w-xs" :title="log.details">{{ log.details }}
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
      <section v-if="isAdminOrJefe" v-show="section === 'users'">
        <div class="flex items-center gap-3 mb-4 text-[var(--shell-muted)]">
          <div class="h-px bg-[var(--shell-input)] flex-grow"></div>
          <span class="text-sm font-bold uppercase tracking-wider"><i class="fas fa-users-cog mr-2"></i>Usuarios del
            Sistema</span>
          <div class="h-px bg-[var(--shell-input)] flex-grow"></div>
        </div>

        <form v-if="canManageAccess" class="settings-card mb-4 space-y-3 p-4" @submit.prevent="saveAccess">
          <h2 class="font-bold">Permisos por usuario</h2>
          <p class="settings-muted text-sm">Marca las acciones que deseas restringir. El rol y la zona siguen determinando el acceso base.</p>
          <label class="grid max-w-md gap-1 text-sm">Usuario
            <select v-model="accessUser" :disabled="accessBusy" class="input-field-dark p-2" @change="loadAccess">
              <option value="">Selecciona un usuario</option>
              <option v-for="user in settingsStore.users.filter(item => item.role !== 'Administrador' && item.uid !== authStore.user?.uid)"
                :key="user.uid" :value="user.uid">{{ user.displayName || user.email }} · {{ user.zona || 'Sin zona' }}</option>
            </select>
          </label>
          <p v-if="accessError" class="text-sm text-[var(--settings-accent)]" role="alert">{{ accessError }}</p>
          <div v-if="accessLoaded" class="overflow-x-auto">
            <table class="min-w-full text-left text-sm">
              <thead><tr><th scope="col" class="p-2">Módulo</th><th v-for="action in accessActions" :key="action.id" scope="col" class="p-2">{{ action.label }}</th></tr></thead>
              <tbody>
                <tr v-for="item in accessModules" :key="item.id" class="border-t border-[var(--shell-border)]">
                  <th scope="row" class="p-2">{{ item.label }}</th>
                  <td v-for="action in accessActions" :key="action.id" class="p-2">
                    <input v-if="item.actions.includes(action.id) && accessDraft[item.id]" v-model="accessDraft[item.id]![action.id]" type="checkbox"
                      :aria-label="'Restringir ' + action.label.toLowerCase() + ' en ' + item.label" :disabled="accessBusy" class="accent-[#b8000b]" />
                    <span v-else class="settings-muted">—</span>
                  </td>
                </tr>
              </tbody>
            </table>
            <button type="submit" class="btn btn-primary mt-3" :disabled="accessBusy">Guardar restricciones</button>
          </div>
        </form>

        <div class="bg-[var(--shell-surface)] rounded-xl border border-[var(--shell-border)] shadow-lg overflow-hidden">
          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-[var(--shell-border)]">
              <thead class="bg-[var(--shell-input)]">
                <tr>
                  <th class="px-6 py-4 text-left text-xs font-bold text-[var(--shell-muted)] uppercase">Usuario</th>
                  <th class="px-6 py-4 text-left text-xs font-bold text-[var(--shell-muted)] uppercase">Rol</th>
                  <th class="px-6 py-4 text-left text-xs font-bold text-[var(--shell-muted)] uppercase">Zona Asignada</th>
                  <th class="px-6 py-4 text-center text-xs font-bold text-[var(--shell-muted)] uppercase">Color</th>
                  <th class="px-6 py-4 text-center text-xs font-bold text-[var(--shell-muted)] uppercase">Estado</th>
                  <th class="px-6 py-4 text-center text-xs font-bold text-[var(--shell-muted)] uppercase">Acciones</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-[var(--shell-border)] bg-[var(--shell-surface)]">
                <tr v-for="user in settingsStore.users" :key="user.uid" class="hover:bg-[var(--shell-input)] transition-colors">
                  <td class="px-6 py-4 whitespace-nowrap">
                    <div class="flex items-center">
                      <div
                        class="h-8 w-8 rounded-full bg-[var(--shell-input)] flex items-center justify-center text-xs font-bold text-[var(--shell-muted)] mr-3 overflow-hidden">
                        <img v-if="(user as any).photoURL" :key="(user as any).photoURL" :src="(user as any).photoURL"
                          alt="Avatar" class="w-full h-full object-cover" />
                        <span v-else>{{ user.displayName?.charAt(0).toUpperCase() || 'U' }}</span>
                      </div>
                      <div>
                        <div class="text-sm font-bold text-[var(--shell-text)]">{{ user.displayName }}</div>
                        <div class="text-xs text-[var(--shell-muted)]">{{ user.email }}</div>
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
                      class="px-2 py-1 text-xs font-semibold rounded bg-[var(--settings-tint)] text-[var(--settings-accent)] border border-[var(--shell-border)]">
                      {{ user.role }}
                    </span>
                  </td>

                  <!-- Columna Zona Editable -->
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-[var(--shell-muted)]">
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
                      <span class="text-xs text-[var(--shell-muted)]">{{ user.disabled ? 'Inactivo' : 'Activo' }}</span>
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
                          class="text-[var(--shell-muted)] hover:text-[var(--shell-text)] p-1.5 disabled:opacity-30"><i
                            class="fas fa-pencil-alt"></i></button>
                        <button @click="toggleUserStatus(user)" :disabled="isCurrentUser(user.uid)"
                          class="text-[var(--shell-muted)] hover:text-red-400 p-1.5 disabled:opacity-30"><i
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

      <!-- Mi Cuenta de Google (Coordinadores y demás roles no-admin) -->
      <section v-if="!isAdminOrJefe" v-show="section === 'integrations'">
        <div class="flex items-center gap-3 mb-4 text-[var(--shell-muted)]">
          <div class="h-px bg-[var(--shell-input)] flex-grow"></div>
          <span class="text-sm font-bold uppercase tracking-wider"><i class="fab fa-google mr-2"></i>Mi Cuenta de
            Google</span>
          <div class="h-px bg-[var(--shell-input)] flex-grow"></div>
        </div>

        <div class="bg-[var(--shell-surface)] rounded-xl border border-[var(--shell-border)] shadow-lg p-6 flex items-center justify-between gap-4 flex-wrap">
          <div class="flex items-center gap-3">
            <div class="w-2.5 h-2.5 rounded-full flex-shrink-0"
              :class="myIntegrationConnected ? 'bg-green-500' : 'bg-red-500'"></div>
            <div>
              <p class="settings-muted text-xs">Última sincronización: {{ calendarDate(settingsStore.ownCalendar?.lastSyncAt) }}</p>
              <p class="text-sm font-bold text-[var(--shell-text)]">
                {{ settingsStore.ownCalendar?.needsReconnect ? 'Requiere reconexión' : myIntegrationConnected ? 'Cuenta conectada' : 'Cuenta no conectada' }}
              </p>
              <p class="text-xs text-[var(--shell-muted)]">
                {{ myIntegrationConnected
                  ? 'Tu calendario y correo están sincronizados con SISFUMI.'
                  : 'Conecta tu cuenta de Google para recibir tus visitas en el calendario y las notificaciones por correo.' }}
              </p>
            </div>
          </div>
          <button
            @click="myIntegrationConnected ? handleDisconnectMyAccount() : handleConnectGoogle(authStore.user!.uid)"
            :class="myIntegrationConnected
              ? 'border-red-900/50 bg-red-900/20 text-red-400 hover:bg-red-900/40'
              : 'border-blue-900/50 bg-blue-900/20 text-blue-400 hover:bg-blue-900/40'"
            class="text-xs font-bold uppercase tracking-wide border px-3 py-1.5 rounded transition-colors flex-shrink-0">
            <i class="fab fa-google mr-1.5"></i>
            {{ myIntegrationConnected ? 'Desconectar' : 'Conectar / Reintegrar' }}
          </button>
        </div>
      </section>

      <!-- Integraciones -->
      <section v-if="isAdminOrJefe" v-show="section === 'integrations'">
        <div class="flex items-center gap-3 mb-4 text-[var(--shell-muted)]">
          <div class="h-px bg-[var(--shell-input)] flex-grow"></div>
          <span class="text-sm font-bold uppercase tracking-wider"><i class="fas fa-link mr-2"></i>Cuentas
            Vinculadas</span>
          <div class="h-px bg-[var(--shell-input)] flex-grow"></div>
        </div>

        <div class="bg-[var(--shell-surface)] rounded-xl border border-[var(--shell-border)] shadow-lg overflow-hidden">
          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-[var(--shell-border)]">
              <thead class="bg-[var(--shell-input)]">
                <tr>
                  <th class="px-6 py-3 text-left text-xs font-bold text-[var(--shell-muted)] uppercase">Cuenta Google</th>
                  <th class="px-6 py-3 text-left text-xs font-bold text-[var(--shell-muted)] uppercase">Zona</th>
                  <th class="px-6 py-3 text-center text-xs font-bold text-[var(--shell-muted)] uppercase">Acciones</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-[var(--shell-border)] bg-[var(--shell-surface)]">
                <tr v-if="!settingsStore.integrations.length"><td colspan="4" class="settings-muted px-6 py-4 text-sm">Sin cuentas vinculadas.</td></tr>
                <tr v-for="integration in settingsStore.integrations" :key="integration.uid" class="hover:bg-[var(--shell-input)]">
                  <td class="px-6 py-4 whitespace-nowrap">
                    <div class="flex items-center gap-3">
                      <i class="fab fa-google text-lg text-[var(--shell-muted)]"></i>
                      <div>
                        <div class="text-sm font-bold text-[var(--shell-text)]">{{ integration.googleUserName }}</div>
                        <div class="text-xs text-[var(--shell-muted)]">{{ integration.googleEmail }}</div>
                      </div>
                    </div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-[var(--shell-muted)]">{{ integration.zona || '-' }}</td>
                  <td class="px-6 py-4 text-xs"><strong>{{ integration.needsReconnect ? 'Requiere reconexión' : 'Conectada' }}</strong><p class="settings-muted">{{ calendarDate(integration.lastSyncAt) }}</p></td>
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

      <section v-show="section === 'appearance'" class="settings-card p-5">
        <h2 class="text-lg font-bold">Tema de la aplicación</h2>
        <p class="settings-muted mt-1 text-sm">Elige cómo se ve SisFumi en este navegador.</p>
        <div class="mt-4 grid max-w-lg gap-3 sm:grid-cols-2" role="group" aria-label="Tema de la aplicación">
          <button v-for="option in [{ id: 'light', label: 'Claro', icon: 'fa-sun' }, { id: 'dark', label: 'Oscuro', icon: 'fa-moon' }]"
            :key="option.id" type="button" class="settings-tab theme-choice" :aria-pressed="theme === option.id"
            @click="theme = option.id"><i class="fas" :class="option.icon" aria-hidden="true"></i>{{ option.label }}</button>
        </div>
      </section>
    </div>
  </section>
</template>

<style scoped>
.settings-page { color: var(--shell-text); --settings-accent: #b8000b; --settings-tint: #fff0f1; }
[data-theme='dark'] .settings-page { color-scheme: dark; --settings-accent: #ff858b; --settings-tint: #412328; }
.settings-icon { color: var(--settings-accent); background: var(--settings-tint); }
.settings-muted { color: var(--shell-muted); }
.settings-nav, .settings-card { border: 1px solid var(--shell-border); border-radius: 0.9rem; background: var(--shell-surface); }
.settings-tab { display: inline-flex; align-items: center; gap: 0.5rem; border: 1px solid transparent; border-radius: 0.55rem; padding: 0.55rem 0.75rem; color: var(--shell-muted); font-size: 0.85rem; font-weight: 650; }
.settings-tab:hover { background: var(--shell-input); color: var(--shell-text); }
.settings-tab[aria-pressed='true'] { color: var(--settings-accent); background: var(--settings-tint); border-color: var(--settings-accent); }
.settings-tab:focus-visible { outline: 2px solid #e50914; outline-offset: 2px; }
.theme-choice { padding: 0.8rem; border-color: var(--shell-border); }
.settings-page :deep(.input-field-dark) { background: var(--shell-input); border: 1px solid var(--shell-border); border-radius: 0.55rem; color: var(--shell-text); }
.settings-page :deep(.btn-secondary) { background: var(--shell-input); border: 1px solid var(--shell-border); color: var(--shell-text); }
.settings-page :deep(.btn-primary) { background: #b8000b; color: #fff; }
.settings-page :deep(.btn-primary:hover) { background: #950009; }
</style>
