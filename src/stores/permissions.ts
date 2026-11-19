/* eslint-disable @typescript-eslint/no-explicit-any */
import { ref } from 'vue'
import { defineStore } from 'pinia'
import { httpsCallable } from 'firebase/functions'
import { functions } from '@/firebase/config'

export interface PermissionVisit {
  id: string
  nombre_cliente: string
  tipo_visita: string
  fecha_visita: string | null
  zona: string
  fumigadores_asignados?: string[]
  notas_visita?: string
  gestionPermiso: {
    estado?: 'rechazado'
    notificado?: boolean
    aprobado: boolean
    soportes: { name: string; path: string; url?: string }[]
  }
}

export const usePermissionsStore = defineStore('permissions', () => {
  // --- State ---
  const pendingVisits = ref<PermissionVisit[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  // --- Actions ---

  async function fetchPendingVisits() {
    loading.value = true
    error.value = null
    try {
      const getVisitsFn = httpsCallable(functions, 'getPendingPermissionVisits')
      const result = (await getVisitsFn()) as { data: { visits: PermissionVisit[] } }
      pendingVisits.value = result.data.visits
    } catch (err: any) {
      console.error('Error fetching pending visits:', err)
      error.value = `No se pudieron cargar las visitas pendientes: ${err.message}`
    } finally {
      loading.value = false
    }
  }

  async function approvePermission(visitId: string) {
    const approveFn = httpsCallable(functions, 'approveVisitPermission')
    await approveFn({ visitId })

    // Actualizar el estado local en lugar de eliminar
    const visit = pendingVisits.value.find((v) => v.id === visitId)
    if (visit) {
      visit.gestionPermiso.aprobado = true
      visit.gestionPermiso.estado = undefined // Limpiar el estado de 'rechazado' si existía
    }
  }

  async function rejectPermission(visitId: string, reason: string) {
    const rejectFn = httpsCallable(functions, 'rejectVisitPermission')
    await rejectFn({ visitId, reason })
    // Actualizar el estado local en lugar de eliminar
    const visit = pendingVisits.value.find((v) => v.id === visitId)
    if (visit) {
      visit.gestionPermiso.estado = 'rechazado'
    }
  }

  async function uploadSupportFile(
    visitId: string,
    file: File,
    onProgress: (progress: number) => void,
  ) {
    const allowedContentTypes = new Set([
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
    ])
    if (!allowedContentTypes.has(file.type) || file.size > 15 * 1024 * 1024) {
      throw new Error('El archivo debe ser PDF, Word o imagen y pesar máximo 15 MB.')
    }

    const filePath = `soportes_permisos/${visitId}/${crypto.randomUUID()}`

    // 1. Obtener política firmada con límites de ruta, tipo y tamaño.
    const getSignedUrlFn = httpsCallable(functions, 'getSignedSupportUploadUrl')
    const result = (await getSignedUrlFn({ visitId, filePath, contentType: file.type })) as {
      data: { uploadUrl: string; fields: Record<string, string> }
    }
    const { uploadUrl, fields } = result.data

    // 2. Subir con POST multipart; Cloud Storage aplica el límite de tamaño en la política.
    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open('POST', uploadUrl, true)
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          onProgress(Math.round((event.loaded / event.total) * 100))
        }
      }
      xhr.onload = () =>
        xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(`Carga rechazada (${xhr.status}).`)
      xhr.onerror = () => reject('Error de red durante la subida.')
      const form = new FormData()
      Object.entries(fields).forEach(([key, value]) => form.append(key, value))
      form.append('file', file)
      xhr.send(form)
    })

    // 3. Guardar solo la referencia; el acceso se entrega mediante URL firmada temporal.
    const fileData = { name: file.name, path: filePath }
    const addSupportFn = httpsCallable(functions, 'addSupportFileToVisit')
    await addSupportFn({ visitId, fileData })

    // 5. Actualizar estado local
    const visit = pendingVisits.value.find((v) => v.id === visitId)
    if (visit) {
      if (!visit.gestionPermiso) {
        visit.gestionPermiso = { aprobado: false, soportes: [] }
      }
      if (!Array.isArray(visit.gestionPermiso.soportes)) {
        visit.gestionPermiso.soportes = []
      }
      visit.gestionPermiso.soportes.push(fileData)
    }
  }

  async function getSignedSupportReadUrl(visitId: string, filePath: string) {
    const getUrlFn = httpsCallable(functions, 'getPublicFileUrl')
    const result = (await getUrlFn({ visitId, filePath })) as {
      data: { signedUrl: string; expiresInSeconds: number }
    }
    return result.data.signedUrl
  }

  async function deleteSupportFile(
    visitId: string,
    fileData: { name: string; url?: string; path: string },
  ) {
    const deleteFn = httpsCallable(functions, 'deleteSupportFile')
    await deleteFn({ visitId, fileData })

    // Actualizar estado local para reflejar el cambio instantáneamente
    const visit = pendingVisits.value.find((v) => v.id === visitId)
    if (visit && visit.gestionPermiso.soportes) {
      visit.gestionPermiso.soportes = visit.gestionPermiso.soportes.filter(
        (s) => s.path !== fileData.path,
      )
    }
  }

  async function updateSupportFileName(visitId: string, filePath: string, newName: string) {
    const updateFn = httpsCallable(functions, 'updateSupportFileName')
    await updateFn({ visitId, filePath, newName })

    // Actualizar estado local para reflejar el cambio instantáneamente
    const visit = pendingVisits.value.find((v) => v.id === visitId)
    // Ensure gestionPermiso and soportes are defined before accessing
    if (visit && visit.gestionPermiso && Array.isArray(visit.gestionPermiso.soportes)) {
      const supportIndex = visit.gestionPermiso.soportes.findIndex((s) => s.path === filePath)
      if (supportIndex !== -1) {
        // TypeScript knows soportes is defined here
        const support = visit.gestionPermiso.soportes[supportIndex]
        if (support) {
          support.name = newName
        }
      }
    }
  }

  async function updateSupportFileOrder(
    visitId: string,
    newOrder: { name: string; url?: string; path: string }[],
  ) {
    const visit = pendingVisits.value.find((v) => v.id === visitId)
    if (!visit) return

    // Actualizar el estado local inmediatamente para una UI fluida
    visit.gestionPermiso.soportes = newOrder

    // Enviar el nuevo orden de rutas al backend
    const updateOrderFn = httpsCallable(functions, 'updateSupportFileOrder')
    const newOrderPaths = newOrder.map((file) => file.path)
    await updateOrderFn({
      visitId,
      newOrderPaths,
    })
  }

  return {
    pendingVisits,
    loading,
    error,
    fetchPendingVisits,
    approvePermission,
    rejectPermission,
    uploadSupportFile,
    getSignedSupportReadUrl,
    deleteSupportFile,
    updateSupportFileName,
    updateSupportFileOrder,
  }
})
