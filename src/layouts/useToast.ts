import { ref, readonly } from 'vue'

export interface Toast {
  id: number
  title: string
  message: string
  type: 'success' | 'error' | 'warning' | 'info'
}

const toasts = ref<Toast[]>([])

export function useToast() {
  const showToast = (toastDetails: Omit<Toast, 'id'>) => {
    const newToast: Toast = {
      ...toastDetails,
      id: Date.now() + Math.random(),
    }
    toasts.value.push(newToast)

    // Auto-dismiss after 5 seconds
    setTimeout(() => removeToast(newToast.id), 5000)
  }

  const removeToast = (id: number) => {
    toasts.value = toasts.value.filter((t) => t.id !== id)
  }

  return { toasts: readonly(toasts), showToast, removeToast }
}
