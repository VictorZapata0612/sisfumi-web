<script setup lang="ts">
import { ref, computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { updatePassword } from 'firebase/auth'
import { useDialog } from '@/composables/useDialog'
import { useToast } from '@/composables/useToast'
import { auth } from '@/firebase/config'

defineProps<{
  show: boolean
}>()

const emit = defineEmits<{ (e: 'close'): void }>()

const authStore = useAuthStore()
const { showDialog } = useDialog()
const { showToast } = useToast()

const newPassword = ref('')
const confirmPassword = ref('')
const errorMessage = ref<string | null>(null)
const successMessage = ref<string | null>(null)
const isLoading = ref(false)
const isNameEditing = ref(false)
const newName = ref('')
const showPasswordSection = ref(false)

// Estado para la subida de la foto
const isUploading = ref(false)
const uploadProgress = ref(0)
const fileInput = ref<HTMLInputElement | null>(null)
const avatarKey = ref(0) // Clave para forzar el repintado de la imagen

const handleChangePassword = async () => {
  if (newPassword.value.length < 6) {
    errorMessage.value = 'La contraseña debe tener al menos 6 caracteres.'
    return
  }
  if (newPassword.value !== confirmPassword.value) {
    errorMessage.value = 'Las contraseñas no coinciden.'
    return
  }

  isLoading.value = true
  errorMessage.value = null
  successMessage.value = null

  try {
    // Usamos auth.currentUser directamente para evitar problemas con proxies de Pinia
    if (auth.currentUser) {
      await updatePassword(auth.currentUser, newPassword.value)
      showToast({ title: 'Éxito', message: 'Contraseña actualizada con éxito.', type: 'success' })
      successMessage.value = '¡Contraseña actualizada!'
      newPassword.value = ''
      confirmPassword.value = ''
      showPasswordSection.value = false
    }
  } catch (error: any) {
    console.error('Error al cambiar contraseña:', error.code, error.message)
    switch (error?.code) {
      case 'auth/requires-recent-login':
        errorMessage.value = 'Operación sensible. Por favor, re-autentícate para continuar.'
        break
      default:
        errorMessage.value = error?.message || 'Error al actualizar contraseña.'
    }
  } finally {
    isLoading.value = false
  }
}

const toggleNameEditMode = (editing: boolean) => {
  isNameEditing.value = editing
  if (editing) {
    newName.value = authStore.user?.displayName || ''
  }
}

const handleSaveName = async () => {
  if (!newName.value.trim()) return
  try {
    await authStore.updateUserProfile({ displayName: newName.value.trim() })
    showToast({ title: 'Perfil Actualizado', message: 'Tu nombre ha sido cambiado.', type: 'success' })
    toggleNameEditMode(false)
  } catch (error: any) {
    errorMessage.value = error.message
  }
}

const handlePictureChange = async (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  isUploading.value = true
  errorMessage.value = null
  try {
    await authStore.changeProfilePicture(file, (progress) => {
      uploadProgress.value = progress
    })

    // Forzar la actualización de los datos del usuario desde Firebase
    if (authStore.user) {
      await authStore.user.reload()
      avatarKey.value++ // Forzar a Vue a volver a renderizar la imagen
      // CRÍTICO: Reinicializar el store para que detecte el cambio en el objeto usuario
      await authStore.init()
    }
    showToast({ title: 'Foto Actualizada', message: 'Tu imagen de perfil ha sido cambiada.', type: 'success' })
  } catch (error: any) {
    errorMessage.value = `Error al subir la foto: ${error.message}`
  } finally {
    isUploading.value = false
    uploadProgress.value = 0
    if (fileInput.value) fileInput.value.value = ''
  }
}

const handleDeletePicture = async () => {
  showDialog({
    title: 'Confirmar Eliminación',
    message: '¿Está seguro de que desea eliminar su foto de perfil? Esta acción es permanente.',
    isConfirmation: true,
    confirmationText: 'Sí, Eliminar',
    async onConfirm() {
      try {
        await authStore.deleteProfilePicture()
        if (authStore.user) {
          await authStore.user.reload()
          avatarKey.value++
          await authStore.init()
        }
        showToast({ title: 'Foto Eliminada', message: 'Has vuelto al avatar por defecto.', type: 'info' })
      } catch (error: any) {
        errorMessage.value = `Error al eliminar la foto: ${error.message}`
      }
    },
  })
}

const userInitials = computed(() => {
  const email = authStore.user?.email || '?'
  return (authStore.user?.displayName || email).charAt(0).toUpperCase()
})

const roleColorClass = computed(() => {
  switch (authStore.userRole) {
    case 'Administrador': return 'bg-red-600 shadow-red-500/20'
    case 'Jefe': return 'bg-yellow-500 shadow-yellow-500/20'
    case 'Coordinador Valle': return 'bg-green-500 shadow-green-500/20'
    case 'Coordinador Nacionales': return 'bg-blue-500 shadow-blue-500/20'
    default: return 'bg-indigo-500 shadow-indigo-500/20'
  }
})
</script>

<template>
  <div v-if="show" class="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6" role="dialog"
    aria-modal="true">
    <!-- Backdrop con desenfoque -->
    <div class="fixed inset-0 bg-[#0a0a0a]/80 backdrop-blur-sm transition-opacity" @click="emit('close')"></div>

    <!-- Modal Panel -->
    <div
      class="relative bg-[#151515] rounded-2xl border border-white/10 shadow-2xl w-full max-w-md transform transition-all overflow-hidden animate-fade-in">

      <!-- Header -->
      <div class="p-6 bg-[#0a0a0a]/50 border-b border-white/10 flex justify-between items-center">
        <h2 class="text-xl font-bold text-white flex items-center gap-2">
          <i class="fas fa-id-card text-[#d60000]"></i>
          Mi Perfil
        </h2>
        <button @click="emit('close')" class="text-gray-400 hover:text-white transition-colors p-1">
          <i class="fas fa-times text-xl"></i>
        </button>
      </div>

      <div class="p-6 space-y-8 overflow-y-auto max-h-[70vh] custom-scrollbar">

        <!-- Avatar y Controles -->
        <div class="flex flex-col items-center">
          <div class="relative group">
            <div
              class="w-32 h-32 rounded-full flex items-center justify-center text-5xl font-bold border-4 border-[#151515] shadow-xl relative overflow-hidden transition-transform duration-300 group-hover:scale-105"
              :class="roleColorClass">
              <img :key="avatarKey" v-if="authStore.user?.photoURL" :src="authStore.user.photoURL" alt="Avatar"
                class="w-full h-full object-cover" />
              <span v-else class="text-white">{{ userInitials }}</span>

              <!-- Upload Overlay -->
              <div v-if="isUploading"
                class="absolute inset-0 bg-[#0a0a0a]/80 flex flex-col items-center justify-center p-4">
                <span class="text-white text-xs font-bold mb-1">{{ uploadProgress }}%</span>
                <div class="w-full bg-[#151515] rounded-full h-1.5">
                  <div class="bg-[#d60000] h-1.5 rounded-full transition-all" :style="{ width: `${uploadProgress}%` }">
                  </div>
                </div>
              </div>

              <!-- Hover Actions -->
              <div v-else
                class="absolute inset-0 bg-black/60 flex items-center justify-center gap-4 opacity-0 group-hover:opacity-100 transition-opacity">
                <button @click="fileInput?.click()"
                  class="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors shadow-lg"
                  title="Cambiar foto">
                  <i class="fas fa-camera text-sm"></i>
                </button>
                <button v-if="authStore.user?.photoURL" @click.stop="handleDeletePicture"
                  class="w-10 h-10 rounded-full bg-red-500/20 hover:bg-red-500/40 text-red-400 flex items-center justify-center transition-colors shadow-lg"
                  title="Eliminar foto">
                  <i class="fas fa-trash-alt text-sm"></i>
                </button>
              </div>
            </div>

            <input ref="fileInput" type="file" @change="handlePictureChange" class="hidden"
              accept="image/png, image/jpeg" />
          </div>

          <div class="mt-4 text-center">
            <span
              class="px-3 py-1 bg-white/5 rounded-full text-[10px] font-bold text-gray-400 uppercase tracking-widest border border-white/10">
              Nivel de Acceso: {{ authStore.userRole }}
            </span>
          </div>
        </div>

        <!-- Campos de Información -->
        <div class="space-y-5 bg-[#0a0a0a]/30 p-5 rounded-xl border border-white/10">

          <!-- Nombre -->
          <div class="space-y-1">
            <label class="text-xs font-bold text-gray-500 uppercase tracking-wider">Nombre del Usuario</label>
            <div v-if="!isNameEditing" class="flex items-center justify-between group">
              <p class="text-white font-semibold text-lg">
                {{ authStore.user?.displayName || 'Sin nombre definido' }}
              </p>
              <button @click="toggleNameEditMode(true)"
                class="text-gray-500 hover:text-indigo-400 p-2 transition-colors">
                <i class="fas fa-pen text-xs"></i>
              </button>
            </div>
            <div v-else class="flex items-center gap-2 mt-2 animate-fade-in">
              <input v-model="newName" type="text"
                class="bg-[#202020] text-white border border-white/10 rounded-lg px-3 py-2 text-sm flex-grow focus:outline-none focus:ring-2 focus:ring-[#d60000]"
                placeholder="Ingresa tu nombre..." />
              <button @click="handleSaveName"
                class="p-2 bg-[#d60000] text-white rounded-lg hover:bg-red-700 transition-colors">
                <i class="fas fa-check"></i>
              </button>
              <button @click="toggleNameEditMode(false)"
                class="p-2 bg-gray-600 text-white rounded-lg hover:bg-gray-500 transition-colors">
                <i class="fas fa-times"></i>
              </button>
            </div>
          </div>

          <!-- Email -->
          <div class="space-y-1">
            <label class="text-xs font-bold text-gray-500 uppercase tracking-wider">Correo Electrónico</label>
            <p class="text-gray-300 font-medium flex items-center gap-2">
              <i class="fas fa-envelope text-gray-600"></i>
              {{ authStore.user?.email }}
            </p>
          </div>
        </div>

        <!-- Acción: Cambio de Contraseña -->
        <div class="space-y-4">
          <button @click="showPasswordSection = !showPasswordSection" type="button"
            class="w-full flex items-center justify-between px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all group">
            <span class="flex items-center gap-3 text-sm font-bold text-gray-300">
              <i class="fas fa-shield-alt" :class="showPasswordSection ? 'text-[#d60000]' : 'text-gray-500'"></i>
              Seguridad de la Cuenta
            </span>
            <i class="fas text-gray-500 text-xs transition-transform"
              :class="showPasswordSection ? 'fa-chevron-up text-[#d60000]' : 'fa-chevron-down'"></i>
          </button>

          <transition name="expand">
            <div v-if="showPasswordSection" class="bg-[#0a0a0a]/50 p-5 rounded-xl border border-white/10 space-y-4">
              <h3 class="text-sm font-bold text-white mb-2 italic">Actualizar Contraseña</h3>

              <div class="space-y-4">
                <div>
                  <label for="newPassword" class="text-xs text-gray-400 mb-1 block">Nueva Contraseña</label>
                  <input type="password" v-model="newPassword"
                    class="w-full bg-[#202020] border border-white/10 rounded-lg px-4 py-2 text-white text-sm focus:ring-2 focus:ring-[#d60000] focus:outline-none"
                    placeholder="Mínimo 6 caracteres" />
                </div>
                <div>
                  <label for="confirmPassword" class="text-xs text-gray-400 mb-1 block">Confirmar Contraseña</label>
                  <input type="password" v-model="confirmPassword"
                    class="w-full bg-[#202020] border border-white/10 rounded-lg px-4 py-2 text-white text-sm focus:ring-2 focus:ring-[#d60000] focus:outline-none"
                    placeholder="Repite la contraseña" />
                </div>

                <div v-if="errorMessage"
                  class="bg-red-900/30 border border-red-800 text-red-300 p-3 rounded-lg text-xs flex items-center gap-2">
                  <i class="fas fa-exclamation-circle"></i> {{ errorMessage }}
                </div>

                <button @click="handleChangePassword"
                  class="w-full btn btn-primary bg-[#d60000] hover:bg-red-700 text-sm py-2.5 shadow-lg shadow-red-500/20"
                  :disabled="isLoading">
                  <i v-if="isLoading" class="fas fa-circle-notch fa-spin mr-2"></i>
                  Actualizar Contraseña
                </button>
              </div>
            </div>
          </transition>
        </div>
      </div>

      <!-- Footer -->
      <div class="p-6 bg-[#0a0a0a]/50 border-t border-white/10 flex justify-end">
        <button @click="emit('close')" class="btn btn-secondary px-6">Cerrar</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.animate-fade-in {
  animation: fadeIn 0.3s ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: scale(0.95);
  }

  to {
    opacity: 1;
    transform: scale(1);
  }
}

.expand-enter-active,
.expand-leave-active {
  transition: all 0.3s ease-in-out;
  max-height: 400px;
}

.expand-enter-from,
.expand-leave-to {
  max-height: 0;
  opacity: 0;
  overflow: hidden;
}

.custom-scrollbar::-webkit-scrollbar {
  width: 5px;
}

.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
  background-color: #4b5563;
  border-radius: 10px;
}
</style>
