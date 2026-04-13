<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { updatePassword } from 'firebase/auth'
import { useToast } from '@/composables/useToast'
import { useDialog } from '@/composables/useDialog'
import { httpsCallable } from 'firebase/functions'
import { functions } from '@/firebase/config'

defineOptions({ name: 'UserProfileView' })

const authStore = useAuthStore()
const { showToast } = useToast()
const { showDialog } = useDialog()

const isConnected = ref(false)
const googleEmail = ref<string | null>(null)
const loadingConnectionStatus = ref(true)

// Estado para cambio de contraseña
const showPasswordForm = ref(false)
const newPassword = ref('')
const confirmPassword = ref('')
const passwordError = ref<string | null>(null)
const isChangingPassword = ref(false)

const checkConnection = async () => {
  loadingConnectionStatus.value = true
  try {
    // Usamos la función para verificar el estado de la conexión del coordinador actual
    const checkFn = httpsCallable(functions, 'listCoordinators')
    const result = (await checkFn()) as { data: { isConnected: boolean; googleEmail: string } }
    isConnected.value = result.data.isConnected
    googleEmail.value = result.data.googleEmail
  } catch (error: any) {
    showToast({
      title: 'Error de Sincronización',
      message: `No se pudo verificar el estado de la conexión: ${error.message}`,
      type: 'error',
    })
  } finally {
    loadingConnectionStatus.value = false
  }
}

onMounted(checkConnection)

const handleConnect = async () => {
  try {
    await authStore.connectGoogleAccount(import.meta.env.VITE_GOOGLE_CLIENT_ID, authStore.user!.uid)
    showToast({
      title: '¡Éxito!',
      message: 'Tu cuenta de Google ha sido conectada correctamente.',
      type: 'success',
    })
    await checkConnection() // Refrescar estado local
  } catch (error: any) {
    showToast({
      title: 'Error de Conexión',
      message: `No se pudo conectar la cuenta: ${error.message}`,
      type: 'error',
    })
  }
}

const handleDisconnect = () => {
  showDialog({
    title: 'Confirmar Desconexión',
    message:
      '¿Estás seguro de que quieres desconectar tu cuenta de Google? Se detendrá la sincronización automática de visitas con tu calendario.',
    isConfirmation: true,
    confirmationText: 'Sí, Desconectar',
    async onConfirm() {
      try {
        await authStore.disconnectGoogleAccount()
        showToast({ title: 'Éxito', message: 'La cuenta de Google ha sido desconectada.', type: 'success' })
        await checkConnection()
      } catch (error: any) {
        showToast({
          title: 'Error',
          message: `No se pudo completar la desconexión: ${error.message}`,
          type: 'error',
        })
      }
    },
  })
}

const handleChangePassword = async () => {
  if (newPassword.value.length < 6) {
    passwordError.value = 'La contraseña debe tener al menos 6 caracteres.'
    return
  }
  if (newPassword.value !== confirmPassword.value) {
    passwordError.value = 'Las contraseñas no coinciden.'
    return
  }

  isChangingPassword.value = true
  passwordError.value = null

  try {
    if (authStore.user) {
      await updatePassword(authStore.user, newPassword.value)
      showToast({ title: 'Éxito', message: 'Contraseña actualizada correctamente.', type: 'success' })
      // Limpiar formulario
      newPassword.value = ''
      confirmPassword.value = ''
      showPasswordForm.value = false
    }
  } catch (error: any) {
    if (error.code === 'auth/requires-recent-login') {
      passwordError.value = 'Por seguridad, debes cerrar sesión y volver a entrar para cambiar tu contraseña.'
    } else {
      passwordError.value = error.message || 'Error al actualizar contraseña.'
    }
    showToast({ title: 'Error', message: passwordError.value!, type: 'error' })
  } finally {
    isChangingPassword.value = false
  }
}
</script>

<template>
  <main class="p-4 md:p-8 lg:p-12 min-h-screen bg-[#0a0a0a]">
    <!-- Header -->
    <header class="max-w-4xl mx-auto mb-10">
      <div class="flex items-center gap-4 mb-2">
        <div class="bg-red-600/20 p-3 rounded-xl text-red-400">
          <i class="fas fa-user-circle text-3xl"></i>
        </div>
        <div>
          <h1 class="text-3xl font-bold text-white tracking-tight">Mi Perfil</h1>
          <p class="text-gray-400">Configuración de cuenta e integraciones</p>
        </div>
      </div>
    </header>

    <div class="max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">

      <!-- Columna Izquierda: Info de Usuario -->
      <div class="lg:col-span-1 space-y-6">
        <div class="bg-[#151515] rounded-2xl border border-white/10 p-6 shadow-xl text-center">
          <div
            class="w-24 h-24 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full mx-auto mb-4 flex items-center justify-center text-white text-4xl font-bold shadow-lg shadow-indigo-500/20 overflow-hidden">
            <img v-if="authStore.user?.photoURL" :key="authStore.user.photoURL" :src="authStore.user.photoURL"
              alt="Perfil" class="w-full h-full object-cover" />
            <span v-else>{{ authStore.user?.email?.charAt(0).toUpperCase() }}</span>
          </div>
          <h2 class="text-xl font-bold text-white truncate">{{ authStore.user?.displayName || 'Usuario' }}</h2>
          <p class="text-indigo-400 text-sm font-medium mt-1">{{ authStore.userRole }}</p>
          <div class="mt-4 pt-4 border-t border-white/10 flex flex-col gap-2">
            <div class="flex items-center justify-between text-xs">
              <span class="text-gray-500 uppercase font-bold">Email</span>
              <span class="text-gray-300">{{ authStore.user?.email }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Columna Derecha: Integraciones -->
      <div class="lg:col-span-2 space-y-6">
        <div class="bg-[#151515] rounded-2xl border border-white/10 shadow-xl overflow-hidden">
          <div class="p-6 border-b border-white/10 bg-[#0a0a0a]/30">
            <h3 class="text-lg font-bold text-white flex items-center gap-2">
              <i class="fab fa-google text-white"></i>
              Sincronización con Google Calendar
            </h3>
          </div>

          <div class="p-8">
            <div v-if="loadingConnectionStatus" class="flex flex-col items-center py-10">
              <i class="fas fa-circle-notch fa-spin text-4xl text-indigo-500 mb-4"></i>
              <p class="text-gray-400 font-medium animate-pulse">Verificando estado de conexión...</p>
            </div>

            <div v-else-if="isConnected" class="animate-fade-in">
              <div
                class="bg-emerald-900/10 border border-emerald-900/30 rounded-2xl p-6 flex flex-col items-center text-center">
                <div
                  class="w-16 h-16 bg-emerald-500/20 text-emerald-500 rounded-full flex items-center justify-center text-2xl mb-4">
                  <i class="fas fa-link"></i>
                </div>
                <h4 class="text-white font-bold text-lg mb-1">Conexión Activa</h4>
                <p class="text-emerald-400 font-medium mb-6">
                  Sincronizando como: <span class="underline">{{ googleEmail }}</span>
                </p>

                <div
                  class="w-full max-w-sm bg-[#0a0a0a]/50 p-4 rounded-xl text-sm text-gray-400 mb-8 text-left space-y-3">
                  <div class="flex items-center gap-3">
                    <i class="fas fa-check text-emerald-500"></i>
                    <span>Tus visitas se verán reflejadas en tu calendario.</span>
                  </div>
                  <div class="flex items-center gap-3">
                    <i class="fas fa-check text-emerald-500"></i>
                    <span>Actualizaciones automáticas en tiempo real.</span>
                  </div>
                </div>

                <button @click="handleDisconnect"
                  class="btn btn-secondary border-red-500/30 text-red-400 hover:bg-red-500 hover:text-white transition-all px-8">
                  <i class="fas fa-unlink mr-2"></i> Desconectar Cuenta
                </button>
              </div>
            </div>

            <div v-else class="animate-fade-in">
              <div
                class="bg-[#0a0a0a]/40 border border-white/10 rounded-2xl p-6 md:p-10 flex flex-col items-center text-center">
                <div
                  class="w-20 h-20 bg-[#151515] text-gray-600 rounded-full flex items-center justify-center text-3xl mb-6 border border-white/10">
                  <i class="fas fa-calendar-alt"></i>
                </div>
                <h4 class="text-white font-bold text-xl mb-3">Conecta tu Calendario</h4>
                <p class="text-gray-400 max-w-sm mb-8">
                  Vincula tu cuenta de Google para sincronizar tus asignaciones técnicas y recibir recordatorios
                  automáticos en todos tus dispositivos.
                </p>

                <button @click="handleConnect"
                  class="btn btn-primary bg-[#d60000] hover:bg-red-700 shadow-lg shadow-red-500/20 px-8 py-3 text-lg">
                  <i class="fab fa-google mr-3"></i> Conectar con Google
                </button>

                <p class="text-xs text-gray-500 mt-6 max-w-xs">
                  Al conectar, Sisfumi APP tendrá acceso a crear y gestionar eventos en tu Google Calendar principal.
                </p>
              </div>
            </div>
          </div>
        </div>

        <!-- Cambio de Contraseña -->
        <div class="bg-[#151515] rounded-2xl border border-white/10 overflow-hidden shadow-xl">
          <button @click="showPasswordForm = !showPasswordForm"
            class="w-full p-6 flex items-center justify-between hover:bg-white/5 transition-colors group">
            <div class="flex items-center gap-4">
              <div class="bg-red-600/20 p-3 rounded-xl text-red-400 group-hover:text-red-300 transition-colors">
                <i class="fas fa-shield-alt text-2xl"></i>
              </div>
              <div class="text-left">
                <h4 class="text-white font-bold">Cambiar Contraseña</h4>
                <p class="text-xs text-gray-400">Actualiza tu clave de acceso</p>
              </div>
            </div>
            <i class="fas transition-transform duration-300 text-gray-500"
              :class="showPasswordForm ? 'fa-chevron-up' : 'fa-chevron-down'"></i>
          </button>

          <div v-if="showPasswordForm" class="p-6 border-t border-white/10 bg-[#0a0a0a]/30 space-y-4 animate-fade-in">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Nueva Contraseña</label>
                <input v-model="newPassword" type="password"
                  class="w-full bg-[#202020] text-white border border-white/10 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#d60000] transition-all placeholder-gray-500"
                  placeholder="Mínimo 6 caracteres" />
              </div>
              <div>
                <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Confirmar</label>
                <input v-model="confirmPassword" type="password"
                  class="w-full bg-[#202020] text-white border border-white/10 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#d60000] transition-all placeholder-gray-500"
                  placeholder="Repite la contraseña" />
              </div>
            </div>

            <div v-if="passwordError"
              class="text-red-400 text-sm flex items-center gap-2 bg-red-900/20 p-3 rounded-lg border border-red-900/50">
              <i class="fas fa-exclamation-circle"></i> {{ passwordError }}
            </div>

            <div class="flex justify-end">
              <button @click="handleChangePassword"
                class="btn btn-primary bg-[#d60000] hover:bg-red-700 shadow-lg shadow-red-500/20 px-6 py-2"
                :disabled="isChangingPassword || !newPassword">
                <i v-if="isChangingPassword" class="fas fa-circle-notch fa-spin mr-2"></i>
                Actualizar Contraseña
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </main>
</template>

<style scoped>
.animate-fade-in {
  animation: fadeIn 0.4s ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
