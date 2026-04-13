import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import {
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth'
import { httpsCallable } from 'firebase/functions'
import { auth, functions } from '@/firebase/config'
import router from '@/router'

// Declaración para el SDK de Google Identity Services
declare const google: any

export const useAuthStore = defineStore('auth', () => {
  // --- State ---
  const user = ref<User | null>(null)
  const loading = ref(true)
  const authReady = ref(false)
  const userRole = ref<string | null>(null)
  const userZone = ref<string | null>(null)

  // --- Getters ---
  const isLoggedIn = computed(() => user.value !== null)

  // --- Actions ---

  /**
   * Inicia sesión con email y contraseña.
   */
  async function login(email: string, password: string) {
    loading.value = true
    try {
      const result = await signInWithEmailAndPassword(auth, email, password)
      // ✅ CORRECCIÓN: Después del login, no dependemos del router guard.
      // Esperamos a que el listener 'onAuthStateChanged' (en init) termine su trabajo
      // y luego redirigimos explícitamente.
      await init() // Espera a que el estado del usuario (rol, zona) se cargue.
      if (user.value) {
        router.push('/') // Redirige al dashboard.
      }
      // La redirección se maneja usualmente en el componente LoginView o en el router
    } catch (error: any) {
      console.error('Error en login:', error)
      throw error
    } finally {
      loading.value = false
    }
  }

  /**
   * Conecta la cuenta de Google (OAuth2 Flow)
   * Se solicitan permisos para Calendar y para leer el perfil del usuario (email/nombre/foto)
   */
  async function connectGoogleAccount(clientId: string, targetUid: string): Promise<any> {
    return new Promise((resolve, reject) => {
      try {
        if (!user.value) return reject(new Error('No hay usuario autenticado'))

        // Verificación robusta de que el SDK de Google está listo
        if (typeof google === 'undefined' || !google.accounts || !google.accounts.oauth2) {
          return reject(
            new Error(
              'El sistema de Google no cargó. Si usas bloqueadores de publicidad (AdBlock/uBlock), desactívalos.',
            ),
          )
        }

        const rawClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
        if (!rawClientId) return reject(new Error('Falta VITE_GOOGLE_CLIENT_ID en el archivo .env'))

        // 1. Limpieza crítica
        const clientId = rawClientId.trim()

        console.log(
          '🔐 Inicializando Google Auth con Client ID:',
          clientId.substring(0, 15) + '...',
        )

        // 2. Configuración PURA (Sin alias cortos, todo URL completa)
        // Esto suele resolver conflictos de scope en navegadores estrictos
        const client = google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          // ✅ CORRECCIÓN: Añadir el scope de Gmail para poder enviar correos.
          // 'gmail.send' es el permiso mínimo necesario para enviar correos sin leerlos.
          scope:
            'https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile openid https://www.googleapis.com/auth/gmail.send',
          callback: async (response: any) => {
            try {
              const saveTokensFn = httpsCallable(functions, 'saveGoogleTokens')
              await saveTokensFn({ tokens: response, targetUid: targetUid })
              resolve('OK')
            } catch (error: any) {
              console.error('Error guardando tokens:', error)
              reject(error)
            }
          },
        })

        // Iniciar el flujo para el cliente de tokens
        client.requestAccessToken()
      } catch (error) {
        console.error('Error inicializando cliente Google:', error)
        reject(error)
      }
    })
  }

  async function logout() {
    try {
      await signOut(auth)
      // Limpieza completa del estado
      user.value = null
      userRole.value = null
      userZone.value = null
      // Redirigir explícitamente al login
      router.push('/login')
    } catch (error: any) {
      console.error('Error en logout:', error)
    }
  }

  /**
   * Inicializa el estado de autenticación (Listener)
   */
  const init = () => {
    return new Promise<void>((resolve) => {
      onAuthStateChanged(auth, async (firebaseUser) => {
        if (firebaseUser) {
          user.value = firebaseUser
          try {
            // Forzar actualización del token para asegurar claims frescos
            const idTokenResult = await firebaseUser.getIdTokenResult(true)
            userRole.value =
              typeof idTokenResult.claims.role === 'string' ? idTokenResult.claims.role : null
            userZone.value =
              typeof idTokenResult.claims.zona === 'string' ? idTokenResult.claims.zona : null
          } catch (e) {
            console.error('Error obteniendo claims:', e)
            // En caso de error crítico obteniendo claims, podríamos considerar desloguear
            // pero mejor dejamos que la UI maneje la falta de rol.
          }
        } else {
          // Si no hay usuario (ej. cookies borradas), limpiar todo
          user.value = null
          userRole.value = null
          userZone.value = null
        }

        authReady.value = true
        loading.value = false
        resolve()
      })
    })
  }

  /**
   * Actualiza el perfil del usuario (nombre/foto)
   */
  async function updateUserProfile(data: { displayName?: string; photoURL?: string | null }) {
    if (!user.value) throw new Error('No hay usuario autenticado.')

    const profileData: { displayName?: string; photoURL?: string | null } = {}
    if (data.displayName) profileData.displayName = data.displayName
    if (data.photoURL !== undefined) profileData.photoURL = data.photoURL

    await updateProfile(user.value, profileData)
    await user.value.reload()
    // Refrescar el objeto user localmente
    user.value = auth.currentUser
  }

  /**
   * Sube una nueva foto de perfil
   */
  async function changeProfilePicture(
    file: File,
    onProgress: (percentage: number) => void,
  ): Promise<void> {
    if (!user.value) throw new Error('No hay usuario autenticado.')

    const filePath = `profile_pictures/${user.value.uid}/${Date.now()}-${file.name}`
    const getSignedUrlFn = httpsCallable(functions, 'getSignedUploadUrl')

    // Obtener URL firmada
    const result = (await getSignedUrlFn({ filePath, contentType: file.type })) as {
      data: { signedUrl: string }
    }
    const { signedUrl } = result.data

    // Subir archivo
    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open('PUT', signedUrl, true)
      xhr.setRequestHeader('Content-Type', file.type)

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percentage = Math.round((event.loaded / event.total) * 100)
          onProgress(percentage)
        }
      }

      xhr.onload = () =>
        xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(xhr.statusText))
      xhr.onerror = () => reject(new Error('Error de red durante la subida.'))
      xhr.send(file)
    })

    // Hacer público y actualizar perfil
    const makePublicFn = httpsCallable(functions, 'makeSupportFilePublic')
    await makePublicFn({ filePath })

    const publicUrl = `https://storage.googleapis.com/${
      (functions as any).app.options.storageBucket
    }/${filePath}`
    await updateUserProfile({ photoURL: publicUrl })
  }

  /**
   * Elimina la foto de perfil
   */
  async function deleteProfilePicture() {
    if (!user.value?.photoURL) return
    const deletePictureFn = httpsCallable(functions, 'deleteProfilePicture')
    await deletePictureFn()
    await updateUserProfile({ photoURL: null })
  }

  /**
   * Desconecta la cuenta de Google Calendar.
   */
  async function disconnectGoogleAccount(targetUid?: string) {
    if (!user.value) throw new Error('Debes estar autenticado.')
    const uid = targetUid || user.value.uid

    try {
      const disconnectFn = httpsCallable(functions, 'disconnectGoogleAccount')
      await disconnectFn({ uid })

      // Actualizar token para refrescar claims
      await auth.currentUser?.getIdToken(true)
    } catch (error: any) {
      console.error('Error al desconectar:', error)
      throw new Error(`No se pudo desconectar la cuenta: ${error.message}`)
    }
  }

  return {
    user,
    loading,
    authReady,
    isLoggedIn,
    userRole,
    userZone,
    login,
    logout,
    init,
    updateUserProfile,
    changeProfilePicture,
    deleteProfilePicture,
    connectGoogleAccount,
    disconnectGoogleAccount,
  }
})
