import { ref } from 'vue'

export interface DialogOptions {
  title: string
  message: string
  isConfirmation?: boolean
  confirmationText?: string
  confirmationKeyword?: string
  // Soporte para selección de técnicos (usado en Planeación)
  technicianSelection?: {
    available: { id: string; nombreCompleto: string }[]
    selected: string[]
  }
  onConfirm?: () => Promise<void> | void
  onCancel?: () => void
}

// Estado global del diálogo
const isOpen = ref(false)
const options = ref<DialogOptions>({
  title: '',
  message: '',
})

export function useDialog() {
  const showDialog = (opts: DialogOptions) => {
    options.value = opts
    isOpen.value = true
  }

  const closeDialog = () => {
    isOpen.value = false
    // Limpiar opciones después de cerrar para evitar estados residuales
    setTimeout(() => {
      options.value = { title: '', message: '' }
    }, 300)
  }

  return {
    isOpen,
    options,
    showDialog,
    closeDialog,
  }
}
