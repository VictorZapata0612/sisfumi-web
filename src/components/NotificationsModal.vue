<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useNotificationStore } from '@/stores/notifications'
import { useToast } from '@/composables/useToast'

const route = useRoute()
const router = useRouter()
const store = useNotificationStore()
const { showToast } = useToast()
const dialog = ref<HTMLDialogElement>()
const busy = ref<string | null>(null)
const isOpen = computed(() => route.query.notificaciones === '1')
const formatter = new Intl.DateTimeFormat('es-CO', {
  dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Bogota',
})

const notifications = computed(() => store.notifications
  .map((item) => ({ ...item, link: typeof item.link === 'string' ? item.link : undefined, date: item.timestamp?.toDate?.() }))
  .sort((a, b) => (b.date?.getTime() ?? 0) - (a.date?.getTime() ?? 0)))

watch([isOpen, dialog], ([open, element]) => {
  if (!element || element.open === open) return
  if (open) element.showModal()
  else element.close()
}, { flush: 'post' })

function close() {
  if (isOpen.value) {
    router.replace({ query: { ...route.query, notificaciones: undefined }, hash: route.hash })
  }
}

function closeOnBackdrop(event: MouseEvent) {
  const bounds = dialog.value?.getBoundingClientRect()
  if (event.target === dialog.value && bounds &&
    (event.clientX < bounds.left || event.clientX > bounds.right ||
      event.clientY < bounds.top || event.clientY > bounds.bottom)) close()
}

async function readNotification(item: { id: string; link?: string }, openLink = false) {
  if (busy.value) return
  busy.value = item.id
  try {
    await store.markAsRead(item.id)
    if (openLink && item.link) {
      const target = new URL(item.link, window.location.origin)
      if (target.origin === window.location.origin && target.pathname.startsWith('/dashboard/')) {
        await router.push(target.pathname + target.search + target.hash)
        close()
      }
    }
  } catch {
    showToast({ title: 'Error', message: 'No se pudo procesar la notificación.', type: 'error' })
  } finally {
    busy.value = null
  }
}
</script>

<template>
  <dialog ref="dialog" class="notifications-dialog" aria-labelledby="notification-title"
    @cancel.prevent.stop="close" @click="closeOnBackdrop">
    <div class="flex max-h-[min(44rem,calc(100dvh-2rem))] flex-col">
      <header class="dialog-header flex items-start gap-3 p-5 sm:p-6">
        <span class="notification-icon grid size-11 shrink-0 place-items-center rounded-xl" aria-hidden="true">
          <i class="fas fa-bell"></i>
        </span>
        <div class="min-w-0 flex-1">
          <h2 id="notification-title" class="text-lg font-bold sm:text-xl">Centro de notificaciones</h2>
          <p class="dialog-muted mt-1 text-sm">{{ notifications.length }} pendientes de lectura</p>
        </div>
        <button type="button" autofocus class="dialog-control grid size-9 shrink-0 place-items-center rounded-lg"
          aria-label="Cerrar notificaciones" @click="close">
          <i class="fas fa-times" aria-hidden="true"></i>
        </button>
      </header>

      <div class="notification-list min-h-0 overflow-y-auto px-4 py-4 sm:px-6">
        <p v-if="store.loading && !notifications.length" class="dialog-muted py-10 text-center text-sm" role="status">
          Cargando notificaciones…
        </p>
        <div v-else-if="!notifications.length" class="py-10 text-center">
          <i class="fas fa-check-circle mb-3 text-3xl text-green-600" aria-hidden="true"></i>
          <h3 class="font-bold">Todo al día</h3>
          <p class="dialog-muted mt-1 text-sm">No tienes notificaciones pendientes.</p>
        </div>
        <ul v-else class="space-y-2.5">
          <li v-for="item in notifications" :key="item.id" class="notification-row flex items-start gap-3 rounded-xl p-3 sm:p-4">
            <span class="notification-icon grid size-9 shrink-0 place-items-center rounded-lg" aria-hidden="true">
              <i class="fas" :class="item.type === 'price_request' ? 'fa-dollar-sign' : 'fa-bell'"></i>
            </span>
            <div class="min-w-0 flex-1">
              <p class="break-words text-sm font-semibold">{{ item.message }}</p>
              <time v-if="item.date" :datetime="item.date.toISOString()" class="dialog-muted mt-1 block text-xs">
                {{ formatter.format(item.date) }}
              </time>
              <div class="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold">
                <button v-if="item.link" type="button" class="notification-link hover:underline disabled:opacity-50"
                  :disabled="busy !== null" @click="readNotification(item, true)">Abrir</button>
                <button type="button" class="dialog-muted hover:underline disabled:opacity-50"
                  :disabled="busy !== null" @click="readNotification(item)">Marcar como leída</button>
              </div>
            </div>
          </li>
        </ul>
      </div>
    </div>
  </dialog>
</template>

<style scoped>
.notifications-dialog {
  width: min(40rem, calc(100vw - 2rem));
  padding: 0;
  margin: auto;
  border: 1px solid var(--shell-border);
  border-radius: 1rem;
  background: var(--shell-surface);
  color: var(--shell-text);
  box-shadow: 0 24px 64px #0005;
}
.notifications-dialog::backdrop { background: #0009; }
.dialog-header { border-bottom: 1px solid var(--shell-border); }
.dialog-muted { color: var(--shell-muted); }
.dialog-control:hover, .notification-row { background: var(--shell-input); }
.notification-row { border: 1px solid var(--shell-border); }
.notification-icon { color: #b8000b; background: #e5091414; }
.notification-link { color: #b8000b; }
[data-theme='dark'] .notification-icon,
[data-theme='dark'] .notification-link { color: #ff858b; }
.notification-list { scrollbar-color: var(--shell-scroll-thumb) var(--shell-scroll-track); }
</style>
