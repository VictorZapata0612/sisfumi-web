<script setup lang="ts">
import { ref } from 'vue'
import { useRouter, RouterLink } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'
import { httpsCallable } from 'firebase/functions'
import { functions } from '@/firebase/config'
import ToastContainer from '@/components/ToastContainer.vue'

const email = ref('')
const password = ref('')
const loading = ref(false)
const router = useRouter()
const authStore = useAuthStore()
const { showToast } = useToast()

const handleLogin = async () => {
  if (!email.value || !password.value) {
    showToast({ title: 'Campos incompletos', message: 'Por favor ingresa tu correo y contraseña.', type: 'warning' })
    return
  }

  loading.value = true
  try {
    await authStore.login(email.value, password.value)
    showToast({ title: '¡Bienvenido!', message: 'Has iniciado sesión correctamente.', type: 'success' })
    router.push('/dashboard')
  } catch (error: any) {
    console.error(error)
    let msg = 'Credenciales incorrectas o error de conexión.'
    if (error.code === 'auth/invalid-credential') msg = 'Correo o contraseña incorrectos.'
    if (error.code === 'auth/too-many-requests') msg = 'Demasiados intentos fallidos. Intenta más tarde.'
    showToast({ title: 'Error de Acceso', message: msg, type: 'error' })
  } finally {
    loading.value = false
  }
}

const handleForgotPassword = async () => {
  if (!email.value) {
    showToast({ title: 'Correo requerido', message: 'Por favor ingresa tu correo electrónico para recuperar la contraseña.', type: 'warning' })
    return
  }

  try {
    const sendCustomReset = httpsCallable(functions, 'sendCustomPasswordReset')
    await sendCustomReset({ email: email.value })
    showToast({ title: 'Correo enviado', message: 'Se ha enviado un enlace de recuperación personalizado a tu correo.', type: 'success' })
  } catch (error: any) {
    console.error(error)
    let msg = 'No se pudo enviar el correo de recuperación.'
    if (error.message.includes('No existe')) msg = 'No existe una cuenta con este correo.'
    showToast({ title: 'Error', message: msg, type: 'error' })
  }
}
</script>

<template>
  <div
    class="min-h-screen bg-[#0a0a0a] text-white font-sans flex items-center justify-center relative overflow-hidden selection:bg-brand-red selection:text-white">
    <ToastContainer />

    <!-- Fondo Decorativo (Coherente con Landing Page) -->
    <div class="absolute inset-0 pointer-events-none z-0">
      <div class="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-brand-red/10 rounded-full blur-[120px]"></div>
      <div class="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-blue-900/10 rounded-full blur-[120px]">
      </div>
    </div>

    <!-- Contenedor Principal -->
    <div class="relative z-10 w-full max-w-md px-6">

      <!-- Tarjeta de Login -->
      <div class="bg-[#151515] border border-white/10 rounded-3xl p-8 md:p-10 shadow-2xl backdrop-blur-sm">

        <!-- Header del Formulario -->
        <div class="text-center mb-10">
          <RouterLink to="/"
            class="inline-flex items-center justify-center p-4 rounded-full bg-white/5 mb-6 group hover:bg-white/10 transition-colors">
            <img src="/logo.png" alt="Control Total Logo"
              class="h-12 w-auto transition-transform duration-500 group-hover:scale-110" />
          </RouterLink>
          <h1 class="text-3xl font-bold text-white mb-2">Zona Administrativa</h1>
          <p class="text-gray-400 text-sm">Ingresa tus credenciales para continuar</p>
        </div>

        <!-- Formulario -->
        <form @submit.prevent="handleLogin" class="space-y-6">

          <!-- Email -->
          <div class="space-y-2">
            <label for="email" class="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Correo
              Electrónico</label>
            <div class="relative group">
              <span
                class="absolute inset-y-0 left-0 flex items-center pl-4 text-gray-500 group-focus-within:text-brand-red transition-colors">
                <i class="fas fa-envelope"></i>
              </span>
              <input v-model="email" type="email" id="email"
                class="w-full bg-[#0a0a0a] border border-gray-800 text-white rounded-xl py-3.5 pl-11 pr-4 focus:outline-none focus:border-brand-red focus:ring-1 focus:ring-brand-red transition-all placeholder-gray-600 text-sm"
                placeholder="usuario@controltotal.com" required />
            </div>
          </div>

          <!-- Contraseña -->
          <div class="space-y-2">
            <label for="password"
              class="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Contraseña</label>
            <div class="relative group">
              <span
                class="absolute inset-y-0 left-0 flex items-center pl-4 text-gray-500 group-focus-within:text-brand-red transition-colors">
                <i class="fas fa-lock"></i>
              </span>
              <input v-model="password" type="password" id="password"
                class="w-full bg-[#0a0a0a] border border-gray-800 text-white rounded-xl py-3.5 pl-11 pr-4 focus:outline-none focus:border-brand-red focus:ring-1 focus:ring-brand-red transition-all placeholder-gray-600 text-sm"
                placeholder="••••••••" required />
            </div>
            <div class="flex justify-end">
              <button type="button" @click="handleForgotPassword"
                class="text-xs text-gray-400 hover:text-brand-red transition-colors focus:outline-none">
                ¿Olvidaste tu contraseña?
              </button>
            </div>
          </div>

          <!-- Botón de Acción -->
          <div class="pt-4">
            <button type="submit"
              class="w-full bg-brand-red hover:bg-[#b91c1c] text-white font-bold py-4 rounded-xl shadow-lg shadow-brand-red/20 hover:shadow-brand-red/40 transition-all duration-300 transform hover:-translate-y-0.5 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              :disabled="loading">
              <i v-if="loading" class="fas fa-circle-notch fa-spin"></i>
              <span v-else>Iniciar Sesión</span>
            </button>
          </div>
        </form>

        <!-- Footer del Formulario -->
        <div class="mt-8 text-center border-t border-white/5 pt-6">
          <RouterLink to="/"
            class="text-sm text-gray-500 hover:text-white transition-colors flex items-center justify-center gap-2 group">
            <i class="fas fa-arrow-left text-xs group-hover:-translate-x-1 transition-transform"></i>
            Volver al sitio web
          </RouterLink>
        </div>

      </div>

      <!-- Copyright -->
      <p class="text-center text-gray-600 text-xs mt-8">
        &copy; {{ new Date().getFullYear() }} Control Total & P.H. - Acceso Restringido
      </p>
    </div>
  </div>
</template>
