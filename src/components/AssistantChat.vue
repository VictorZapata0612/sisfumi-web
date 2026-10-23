<script setup lang="ts">
import { nextTick, ref } from 'vue'
import { httpsCallable, type HttpsCallableResult } from 'firebase/functions'
import { functions } from '@/firebase/config'

type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
}

const isOpen = ref(false)
const input = ref('')
const loading = ref(false)
const error = ref('')
const messages = ref<ChatMessage[]>([
  {
    role: 'assistant',
    content:
      'Hola. Puedo consultar la información operativa disponible para tu rol y preparar resúmenes. En esta primera versión no modifico datos.',
  },
])
const messagesContainer = ref<HTMLElement | null>(null)

const scrollToBottom = async () => {
  await nextTick()
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
  }
}

const sendMessage = async () => {
  const message = input.value.trim()
  if (!message || loading.value) return

  messages.value.push({ role: 'user', content: message })
  input.value = ''
  error.value = ''
  loading.value = true
  await scrollToBottom()

  try {
    const assistantChat = httpsCallable<{ message: string }, { answer: string; model: string }>(
      functions,
      'assistantChat',
    )
    const result: HttpsCallableResult<{ answer: string; model: string }> = await assistantChat({
      message,
    })
    messages.value.push({ role: 'assistant', content: result.data.answer })
  } catch (err) {
    console.error('Error consultando el asistente:', err)
    error.value =
      'No fue posible consultar el asistente. Verifica que Ollama y el emulador de Functions estén ejecutándose.'
  } finally {
    loading.value = false
    await scrollToBottom()
  }
}
</script>

<template>
  <div class="fixed bottom-5 right-5 z-40">
    <section
      v-if="isOpen"
      class="mb-3 flex h-[min(70vh,560px)] w-[min(92vw,390px)] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#151515] shadow-2xl"
      aria-label="Asistente de SISFUMI"
    >
      <header class="flex items-center justify-between border-b border-white/10 bg-[#1d1d1d] px-4 py-3">
        <div>
          <h2 class="font-semibold text-white">Asistente SISFUMI</h2>
          <p class="text-xs text-gray-400">Consultas de solo lectura</p>
        </div>
        <button
          type="button"
          class="text-gray-400 transition-colors hover:text-white"
          aria-label="Cerrar asistente"
          @click="isOpen = false"
        >
          <i class="fas fa-times"></i>
        </button>
      </header>

      <div ref="messagesContainer" class="flex-1 space-y-3 overflow-y-auto p-4">
        <div
          v-for="(message, index) in messages"
          :key="`${message.role}-${index}`"
          class="flex"
          :class="message.role === 'user' ? 'justify-end' : 'justify-start'"
        >
          <p
            class="max-w-[85%] whitespace-pre-wrap rounded-xl px-3 py-2 text-sm"
            :class="
              message.role === 'user'
                ? 'bg-red-700 text-white'
                : 'border border-white/10 bg-[#242424] text-gray-200'
            "
          >
            {{ message.content }}
          </p>
        </div>
        <p v-if="loading" class="text-sm text-gray-400">Analizando la información...</p>
      </div>

      <p v-if="error" class="border-t border-red-900/50 bg-red-950/40 px-4 py-2 text-xs text-red-200">
        {{ error }}
      </p>

      <form class="flex gap-2 border-t border-white/10 p-3" @submit.prevent="sendMessage">
        <input
          v-model="input"
          type="text"
          maxlength="4000"
          placeholder="Pregunta sobre la operación..."
          class="min-w-0 flex-1 rounded-lg border border-white/10 bg-[#0a0a0a] px-3 py-2 text-sm text-white outline-none focus:border-red-600"
          :disabled="loading"
        />
        <button
          type="submit"
          class="rounded-lg bg-red-700 px-3 text-white transition-colors hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-50"
          :disabled="loading || !input.trim()"
          aria-label="Enviar pregunta"
        >
          <i class="fas fa-paper-plane"></i>
        </button>
      </form>
    </section>

    <button
      type="button"
      class="flex h-14 w-14 items-center justify-center rounded-full bg-red-700 text-xl text-white shadow-lg transition-all hover:scale-105 hover:bg-red-600"
      :aria-label="isOpen ? 'Cerrar asistente' : 'Abrir asistente'"
      @click="isOpen = !isOpen"
    >
      <i class="fas" :class="isOpen ? 'fa-times' : 'fa-robot'"></i>
    </button>
  </div>
</template>
