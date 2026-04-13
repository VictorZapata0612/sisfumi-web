import { ref } from 'vue'
import { defineStore } from 'pinia'
import {
  collection,
  onSnapshot,
  query,
  where,
  doc,
  updateDoc,
  collectionGroup,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from '@/firebase/config'
import { useAuthStore } from './auth'

let priceRequestUnsubscribe: Unsubscribe | undefined
let generalNotificationUnsubscribe: Unsubscribe | undefined

export const useNotificationStore = defineStore('notifications', () => {
  interface Notification {
    id: string
    message: string
    type: string
    timestamp: { toDate: () => Date }
    [key: string]: any
  }

  // --- State ---
  const priceRequestsCount = ref(0)
  const generalNotificationsCount = ref(0)
  const notifications = ref<Notification[]>([])
  const loading = ref(false)

  // --- Actions ---

  /**
   * Limpia todos los listeners al cerrar sesión.
   */
  function cleanupListeners() {
    priceRequestsCount.value = 0
    generalNotificationsCount.value = 0
    notifications.value = []
    if (priceRequestUnsubscribe) priceRequestUnsubscribe()
    if (generalNotificationUnsubscribe) generalNotificationUnsubscribe()
  }

  /**
   * Escucha en tiempo real las solicitudes de precio pendientes.
   */
  function listenForPriceRequests() {
    const authStore = useAuthStore()

    // ✅ CORRECCIÓN: Añadir una guarda para asegurar que el usuario existe antes de continuar.
    if (!authStore.user) {
      priceRequestsCount.value = 0
      return
    }

    const canView =
      authStore.userRole === 'Administrador' ||
      authStore.userRole === 'Jefe' ||
      authStore.userRole === 'Coordinador Nacionales'

    if (!canView) {
      priceRequestsCount.value = 0
      return
    }

    // Si ya hay una suscripción, la cancelamos para evitar duplicados
    if (priceRequestUnsubscribe) priceRequestUnsubscribe()

    // ✅ CORRECCIÓN: Escuchar las notificaciones directas de tipo 'price_request'
    // en lugar de un collectionGroup que no funciona con la estructura actual.
    const notificationsPath = `users/${authStore.user.uid}/direct_notifications`
    const q = query(
      collection(db, notificationsPath),
      where('type', '==', 'price_request'),
      where('read', '==', false),
    )

    priceRequestUnsubscribe = onSnapshot(
      q,
      (snapshot) => {
        priceRequestsCount.value = snapshot.size
      },
      (error) => {
        priceRequestsCount.value = 0
      },
    )
  }

  /**
   * Escucha notificaciones generales dirigidas al usuario actual.
   */
  function listenForGeneralNotifications() {
    const authStore = useAuthStore()
    if (!authStore.user) {
      return
    }

    if (generalNotificationUnsubscribe) generalNotificationUnsubscribe()

    const notificationsPath = `users/${authStore.user.uid}/direct_notifications`
    const q = query(collection(db, notificationsPath), where('read', '==', false))

    loading.value = true
    generalNotificationUnsubscribe = onSnapshot(
      q,
      (snapshot) => {
        generalNotificationsCount.value = snapshot.size
        notifications.value = snapshot.docs.map(
          (doc) => ({ id: doc.id, ...doc.data() }) as Notification,
        )
        loading.value = false
      },
      (error) => {
        generalNotificationsCount.value = 0
        loading.value = false
      },
    )
  }

  /**
   * Marca una notificación como leída.
   */
  async function markAsRead(notificationId: string) {
    const authStore = useAuthStore()
    if (!authStore.user?.uid) return

    const notificationsPath = `users/${authStore.user.uid}/direct_notifications`
    const notifRef = doc(db, notificationsPath, notificationId)
    await updateDoc(notifRef, {
      read: true,
    })
    // El listener onSnapshot se encargará de actualizar la lista localmente.
  }

  return {
    priceRequestsCount,
    generalNotificationsCount,
    notifications,
    loading,
    listenForPriceRequests,
    listenForGeneralNotifications,
    cleanupListeners,
    markAsRead,
  }
})
