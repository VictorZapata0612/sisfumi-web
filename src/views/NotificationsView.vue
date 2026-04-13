<script setup lang="ts">
import { onMounted } from 'vue'
import { useNotificationStore } from '@/stores/notifications'
import { storeToRefs } from 'pinia'
import { useToast } from '@/composables/useToast'

defineOptions({ name: 'NotificationsView' })

const notificationStore = useNotificationStore()
const { showToast } = useToast()

// Usamos storeToRefs para mantener la reactividad
const { notifications, loading } = storeToRefs(notificationStore)

onMounted(() => {
  // El listener ya está activo desde el Sidebar,
  // pero nos aseguramos de que se inicie si el usuario navega aquí directamente.
  notificationStore.listenForGeneralNotifications()
})

const handleMarkAsRead = async (notificationId: string) => {
  try {
    await notificationStore.markAsRead(notificationId)
    showToast({
      title: 'Notificación Leída',
      message: 'La notificación ha sido archivada.',
      type: 'info',
    })
  } catch (error: any) {
    showToast({
      title: 'Error',
      message: `No se pudo marcar como leída: ${error.message}`,
      type: 'error',
    })
  }
}

const formatDate = (timestamp: any) => {
  if (!timestamp?.toDate) return 'Fecha inválida'
  return timestamp.toDate().toLocaleString('es-CO', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}
</script>

<template>
  <div
    class="h-full bg-gray-900 text-gray-100 flex flex-col p-4 md:p-6 overflow-y-auto custom-scrollbar"
  >
    <!-- Header -->
    <header class="flex-shrink-0 mb-8">
      <h2 class="text-2xl md:text-3xl font-bold text-white flex items-center gap-3">
        <i class="fas fa-bell text-indigo-400"></i>
        Centro de Notificaciones
      </h2>
      <p class="text-sm text-gray-400 mt-1">
        Aquí verás las actualizaciones importantes que requieren tu atención.
      </p>
    </header>

    <!-- Loading State -->
    <div
      v-if="loading && notifications.length === 0"
      class="flex-grow flex items-center justify-center"
    >
      <div class="text-center text-gray-500">
        <i class="fas fa-circle-notch fa-spin text-4xl mb-3"></i>
        <p>Buscando notificaciones...</p>
      </div>
    </div>

    <!-- Empty State -->
    <div
      v-else-if="notifications.length === 0"
      class="flex-grow flex flex-col items-center justify-center text-gray-500 opacity-60"
    >
      <i class="fas fa-check-circle text-6xl mb-4 text-green-500"></i>
      <h3 class="text-xl font-bold">¡Todo al día!</h3>
      <p>No tienes notificaciones pendientes.</p>
    </div>

    <!-- Notifications List -->
    <div v-else class="space-y-4 max-w-3xl mx-auto w-full">
      <transition-group name="list">
        <div
          v-for="notification in notifications"
          :key="notification.id"
          class="bg-gray-800/50 border border-gray-700 rounded-xl shadow-lg p-5 flex flex-col sm:flex-row items-start gap-4 transition-all"
        >
          <div
            class="bg-blue-500/10 text-blue-400 rounded-full w-10 h-10 flex items-center justify-center flex-shrink-0 mt-1"
          >
            <i class="fas fa-dollar-sign"></i>
          </div>
          <div class="flex-grow">
            <p class="text-white font-medium leading-relaxed">{{ notification.message }}</p>
            <p class="text-xs text-gray-500 mt-2">{{ formatDate(notification.timestamp) }}</p>
          </div>
          <button
            @click="handleMarkAsRead(notification.id)"
            class="btn btn-secondary !py-1 !px-3 text-xs w-full sm:w-auto"
            title="Marcar como leído"
          >
            <i class="fas fa-check mr-1.5"></i> Entendido
          </button>
        </div>
      </transition-group>
    </div>
  </div>
</template>

<style scoped>
.list-enter-active,
.list-leave-active {
  transition: all 0.5s ease;
}
.list-enter-from,
.list-leave-to {
  opacity: 0;
  transform: translateX(30px);
}
</style>
