import { ref } from 'vue'
import { defineStore } from 'pinia'
import { httpsCallable } from 'firebase/functions'
import { functions } from '@/firebase/config'

export interface CalendarIntegration {
  uid: string
  googleEmail: string
  googleUserName: string
  zona: string | null
}
export interface BusinessZone {
  name: string
}

export interface ServiceType {
  name: string
}

export interface BusinessData {
  businessZones?: BusinessZone[]
  alliesList?: string[]
  serviceTypes?: ServiceType[]
  colombiaData?: Record<string, string[]>
}

export interface AuditLog {
  id: string
  timestamp: { toDate: () => Date }
  adminEmail: string
  action: string
  details: string
  targetUser?: { uid: string; email: string }
  previousState?: any
  undone?: boolean
}

export interface SystemUser {
  uid: string
  email: string
  displayName: string
  role: string
  zona: string
  disabled: boolean
  creationTime: string
  color?: string
  lastSignInTime: string
  isConnected: boolean
}

export const useSettingsStore = defineStore('settings', () => {
  // --- State ---
  const integrations = ref<CalendarIntegration[]>([])
  const businessData = ref<BusinessData>({ businessZones: [], alliesList: [], serviceTypes: [] })
  const loading = ref(false)
  const error = ref<string | null>(null)
  const loadingBusinessData = ref(false)
  const auditLogs = ref<AuditLog[]>([])
  const loadingLogs = ref(false)
  const users = ref<SystemUser[]>([])
  const loadingUsers = ref(false)

  // --- Actions ---

  async function fetchIntegrations() {
    loading.value = true
    error.value = null
    try {
      const listIntegrationsFn = httpsCallable(functions, 'listCalendarIntegrations')
      const result = (await listIntegrationsFn()) as {
        data: { integrations: CalendarIntegration[] }
      }
      integrations.value = result.data.integrations
    } catch (err: any) {
      console.error('Error fetching integrations:', err)
      error.value = `No se pudieron cargar las integraciones: ${err.message}`
    } finally {
      loading.value = false
    }
  }

  async function disconnectAccount(uid: string) {
    const disconnectFn = httpsCallable(functions, 'disconnectGoogleAccount')
    await disconnectFn({ uid })

    // Actualizar el estado local para reflejar el cambio instantáneamente
    const index = integrations.value.findIndex((i) => i.uid === uid)
    if (index !== -1) {
      integrations.value.splice(index, 1)
    }
  }

  async function fetchBusinessData() {
    loadingBusinessData.value = true
    try {
      const getBusinessDataFn = httpsCallable(functions, 'getBusinessData')
      const result = (await getBusinessDataFn()) as { data: BusinessData }
      // Asegurarse de que los arrays existan para evitar errores en la UI
      businessData.value = {
        businessZones: result.data.businessZones || [],
        alliesList: result.data.alliesList || [],
        serviceTypes: result.data.serviceTypes || [],
        colombiaData: result.data.colombiaData || {},
      }
    } catch (err: any) {
      console.error('Error fetching business data:', err)
      error.value = `No se pudieron cargar los datos de negocio: ${err.message}`
    } finally {
      loadingBusinessData.value = false
    }
  }

  async function updateBusinessData(newData: BusinessData) {
    const updateFn = httpsCallable(functions, 'updateBusinessData')
    await updateFn({ businessData: newData })
    // Actualizar el estado local para reflejar el cambio
    businessData.value = newData
  }

  async function fetchAuditLogs(filters: {
    startDate?: string
    endDate?: string
    limit?: number
    adminEmail?: string
    keyword?: string
  }) {
    loadingLogs.value = true
    try {
      const getLogsFn = httpsCallable(functions, 'getAuditLogs')
      const result = (await getLogsFn(filters)) as { data: { logs: AuditLog[] } }
      auditLogs.value = result.data.logs
    } catch (err: any) {
      console.error('Error fetching audit logs:', err)
      error.value = `No se pudieron cargar los registros de auditoría: ${err.message}`
    } finally {
      loadingLogs.value = false
    }
  }

  async function undoRoleChange(log: AuditLog) {
    if (!log.targetUser?.uid || !log.previousState) {
      throw new Error(
        'El registro de auditoría no contiene la información necesaria para deshacer el cambio.',
      )
    }

    const undoFn = httpsCallable(functions, 'undoRoleChange')
    await undoFn({
      logId: log.id,
      uid: log.targetUser.uid,
      previousState: log.previousState,
    })

    // Marcar el log original como "deshecho" en el estado local para ocultar el botón
    const originalLog = auditLogs.value.find((l) => l.id === log.id)
    if (originalLog) {
      originalLog.undone = true
    }
  }

  async function fetchUsers() {
    loadingUsers.value = true
    try {
      const listUsersFn = httpsCallable(functions, 'listAllUsers')
      const result = (await listUsersFn()) as { data: { users: SystemUser[] } }
      users.value = result.data.users.sort((a, b) => a.displayName.localeCompare(b.displayName))
    } catch (err: any) {
      console.error('Error fetching users:', err)
      error.value = `No se pudieron cargar los usuarios: ${err.message}`
    } finally {
      loadingUsers.value = false
    }
  }

  async function updateUserConfiguration(uid: string, role: string, zona: string, color: string) {
    const updateUserConfigFn = httpsCallable(functions, 'updateUserConfiguration')
    await updateUserConfigFn({ uid, role, zona, color })
    // Después de actualizar, volvemos a cargar los usuarios para reflejar los cambios de color, rol y zona.
    await fetchUsers()
  }

  async function updateUserStatus(uid: string, disabled: boolean) {
    const setUserStatusFn = httpsCallable(functions, 'setUserStatus')
    await setUserStatusFn({ uid, disabled })

    // Actualizar el estado local
    const userToUpdate = users.value.find((u) => u.uid === uid)
    if (userToUpdate) {
      // @ts-ignore
      userToUpdate.disabled = disabled
    }
  }

  return {
    integrations,
    businessData,
    loading,
    loadingBusinessData,
    auditLogs,
    loadingLogs,
    users,
    loadingUsers,
    error,
    fetchIntegrations,
    disconnectAccount,
    fetchBusinessData,
    updateBusinessData,
    fetchAuditLogs,
    undoRoleChange,
    fetchUsers,
    updateUserConfiguration,
    updateUserStatus,
  }
})
