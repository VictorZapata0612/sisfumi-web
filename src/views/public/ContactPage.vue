<script setup lang="ts">
import { ref } from 'vue'
import { httpsCallable } from 'firebase/functions'
import { functions } from '@/firebase/config'
import { useToast } from '@/composables/useToast'

const form = ref({
  name: '',
  email: '',
  phone: '',
  message: '',
})

const submitting = ref(false)
const formState = ref<{ success: boolean; message: string } | null>(null)
const { showToast } = useToast()

const handleSubmit = async () => {
  if (!form.value.name || !form.value.email || !form.value.message) {
    showToast({
      title: 'Campos Incompletos',
      message: 'Por favor, completa los campos obligatorios.',
      type: 'warning',
    })
    return
  }

  submitting.value = true
  formState.value = null

  try {
    const sendContactEmail = httpsCallable(functions, 'sendContactEmail')
    await sendContactEmail({ ...form.value })

    formState.value = {
      success: true,
      message: '¡Mensaje enviado con éxito! Nos pondremos en contacto contigo pronto.',
    }
    showToast({ title: '¡Enviado!', message: formState.value.message, type: 'success' })
    // Resetear el formulario
    form.value = { name: '', email: '', phone: '', message: '' }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    const message =
      error.message || 'Hubo un problema técnico al enviar el correo. Por favor, intenta de nuevo.'
    formState.value = { success: false, message }
    showToast({ title: 'Error de Envío', message, type: 'error' })
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div
    class="bg-[#0a0a0a] text-white min-h-screen font-sans relative selection:bg-brand-red selection:text-white overflow-hidden"
  >
    <!-- FONDO DECORATIVO GLOBAL -->
    <div class="fixed inset-0 pointer-events-none z-0">
      <div
        class="absolute top-[-10%] right-[20%] w-[500px] h-[500px] bg-brand-red/5 rounded-full blur-[120px]"
      ></div>
      <div
        class="absolute bottom-[10%] left-[-10%] w-[600px] h-[600px] bg-gray-800/20 rounded-full blur-[100px]"
      ></div>
    </div>

    <!-- ENCABEZADO (Hero) -->
    <section class="relative z-10 py-24 md:py-32 text-center px-4" v-scroll-animation>
      <div class="max-w-4xl mx-auto">
        <span
          class="inline-block py-1 px-3 mb-6 rounded-full bg-white/5 border border-white/10 text-gray-300 text-xs md:text-sm font-bold tracking-[0.2em] backdrop-blur-md uppercase"
        >
          Estamos para servirte
        </span>

        <h1 class="text-5xl md:text-7xl font-extrabold tracking-tight mb-8 leading-tight">
          Contáctanos
        </h1>

        <p
          class="mt-6 text-lg md:text-xl text-gray-400 leading-relaxed max-w-2xl mx-auto font-light"
        >
          Completa el formulario o utiliza nuestros canales directos para recibir una
          <span class="text-white font-medium">asesoría personalizada</span>.
        </p>
      </div>
    </section>

    <!-- CONTENIDO PRINCIPAL: INFO + FORM -->
    <section class="relative z-10 py-16 md:py-24" v-scroll-animation>
      <div
        class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid md:grid-cols-2 gap-16 lg:gap-24 items-start"
      >
        <!-- COLUMNA IZQUIERDA: INFORMACIÓN Y MAPA -->
        <div class="space-y-12">
          <!-- Info Blocks -->
          <div class="space-y-8">
            <h2 class="text-3xl font-bold mb-8 flex items-center gap-3">
              <span class="w-10 h-1 bg-brand-red rounded-full"></span>
              Información Directa
            </h2>

            <div class="space-y-6">
              <!-- Dirección -->
              <div
                class="flex items-start gap-4 p-4 rounded-xl hover:bg-white/5 transition-colors border border-transparent hover:border-white/5"
              >
                <div
                  class="w-10 h-10 rounded-full bg-brand-red/10 flex items-center justify-center text-brand-red shrink-0"
                >
                  <i class="fas fa-map-marker-alt"></i>
                </div>
                <div>
                  <h3 class="font-bold text-white text-sm uppercase tracking-wider mb-1">
                    Ubicación
                  </h3>
                  <p class="text-gray-400">Cra. 80 #11 A-51, Cali, Valle del Cauca</p>
                  <p class="text-gray-500 text-sm">Local P-329</p>
                </div>
              </div>

              <!-- Teléfonos -->
              <div
                class="flex items-start gap-4 p-4 rounded-xl hover:bg-white/5 transition-colors border border-transparent hover:border-white/5"
              >
                <div
                  class="w-10 h-10 rounded-full bg-brand-red/10 flex items-center justify-center text-brand-red shrink-0"
                >
                  <i class="fas fa-phone-alt"></i>
                </div>
                <div>
                  <h3 class="font-bold text-white text-sm uppercase tracking-wider mb-1">
                    Llámanos
                  </h3>
                  <div class="flex flex-col sm:flex-row gap-2 sm:gap-4">
                    <a
                      href="tel:+573208722195"
                      class="text-gray-400 hover:text-brand-red transition-colors"
                      >320 872 2195</a
                    >
                    <span class="hidden sm:inline text-gray-600">|</span>
                    <a
                      href="tel:+573205624177"
                      class="text-gray-400 hover:text-brand-red transition-colors"
                      >320 562 4177</a
                    >
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Mapa de Ubicación -->
          <div class="relative group rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
            <div class="aspect-video w-full">
              <iframe
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3982.723835388069!2d-76.5468238!3d3.4174953!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x8e30a71a91421c07%3A0x33643c3335fd793c!2sCra.%2080%20%2311a-51%2C%20Cali%2C%20Valle%20del%20Cauca!5e0!3m2!1ses!2sco!4v1733276852380!5m2!1ses!2sco"
                class="w-full h-full filter grayscale-[0.8] invert-[0.9] contrast-[1.1] hover:grayscale-0 hover:invert-0 hover:contrast-100 transition-all duration-700"
                style="border: 0"
                allowfullscreen="true"
                loading="lazy"
                referrerpolicy="no-referrer-when-downgrade"
                title="Ubicación de Control Total & P.H."
              ></iframe>
            </div>
            <div
              class="absolute inset-0 pointer-events-none border-2 border-white/5 rounded-2xl"
            ></div>
          </div>
        </div>

        <!-- COLUMNA DERECHA: FORMULARIO -->
        <div
          class="bg-[#151515] border border-white/5 rounded-3xl p-8 md:p-12 shadow-2xl relative overflow-hidden"
        >
          <div
            class="absolute top-0 right-0 w-64 h-64 bg-brand-red/5 rounded-full blur-[80px] -z-10 pointer-events-none"
          ></div>

          <h2 class="text-3xl font-bold mb-2">Envíanos un Mensaje</h2>
          <p class="text-gray-400 mb-8 text-sm">Te responderemos a la mayor brevedad posible.</p>

          <!-- Mensajes de estado -->
          <div
            v-if="formState"
            :class="
              formState.success
                ? 'bg-green-500/10 border-green-500/30 text-green-400'
                : 'bg-red-500/10 border-red-500/30 text-red-400'
            "
            class="p-4 rounded-xl mb-6 text-sm flex items-center gap-3"
          >
            <i
              class="fas"
              :class="formState.success ? 'fa-check-circle' : 'fa-exclamation-circle'"
            ></i>
            {{ formState.message }}
          </div>

          <form @submit.prevent="handleSubmit" class="space-y-6">
            <div class="space-y-5" :class="{ 'opacity-50': submitting }">
              <div>
                <label
                  for="name"
                  class="block text-sm font-medium text-gray-400 mb-2 uppercase tracking-wider"
                  >Nombre Completo</label
                >
                <input
                  v-model="form.name"
                  type="text"
                  name="name"
                  id="name"
                  autocomplete="name"
                  placeholder="Ej. Juan Pérez"
                  class="input-public"
                  :disabled="submitting"
                />
              </div>
              <div>
                <label
                  for="email"
                  class="block text-sm font-medium text-gray-400 mb-2 uppercase tracking-wider"
                  >Correo Electrónico</label
                >
                <input
                  v-model="form.email"
                  type="email"
                  name="email"
                  id="email"
                  autocomplete="email"
                  placeholder="tu@correo.com"
                  class="input-public"
                  :disabled="submitting"
                />
              </div>
              <div>
                <label
                  for="phone"
                  class="block text-sm font-medium text-gray-400 mb-2 uppercase tracking-wider"
                  >Teléfono</label
                >
                <input
                  v-model="form.phone"
                  type="tel"
                  name="phone"
                  id="phone"
                  autocomplete="tel"
                  placeholder="Ej. 300 123 4567"
                  class="input-public"
                  :disabled="submitting"
                />
              </div>
              <div>
                <label
                  for="message"
                  class="block text-sm font-medium text-gray-400 mb-2 uppercase tracking-wider"
                  >Mensaje</label
                >
                <textarea
                  v-model="form.message"
                  name="message"
                  id="message"
                  rows="4"
                  placeholder="¿En qué podemos ayudarte?"
                  class="input-public resize-none"
                  :disabled="submitting"
                ></textarea>
              </div>
            </div>
            <div class="pt-4">
              <button
                type="submit"
                class="btn w-full justify-center shadow-lg !py-4 !text-lg"
                :class="submitting ? 'btn-secondary' : 'btn-primary'"
                :disabled="submitting"
              >
                <i v-if="submitting" class="fas fa-spinner fa-spin mr-2"></i>
                {{ submitting ? 'Enviando...' : 'Enviar Mensaje' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </section>
  </div>
</template>
