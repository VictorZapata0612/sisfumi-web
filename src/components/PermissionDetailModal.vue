<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { usePermissionsStore, type PermissionVisit } from '@/stores/permissions'
import { useDialog } from '@/composables/useDialog'
import { useToast } from '@/composables/useToast'
import draggable from 'vuedraggable'

const props = defineProps<{
  show: boolean
  visit: PermissionVisit | null
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'approve', visitId: string, notes: string): void
  (e: 'reject', visitId: string, reason: string): void
}>()

const permissionsStore = usePermissionsStore()
const { showDialog } = useDialog()
const { showToast } = useToast()

const rejectionReason = ref('')
const showRejectionInput = ref(false)
const approvalNotes = ref('')
const fileInput = ref<HTMLInputElement | null>(null)
const editingFile = ref<{ path: string; name: string } | null>(null)
const newFileName = ref('')
const isUploading = ref(false)
const uploadProgress = ref(0)
const previewFile = ref<{ url: string; type: string } | null>(null)

const draggableSoportes = computed({
  get() {
    return props.visit?.gestionPermiso?.soportes || []
  },
  set(newOrder) {
    if (props.visit) {
      permissionsStore.updateSupportFileOrder(props.visit.id, newOrder)
    }
  },
})

watch(
  () => props.show,
  (newVal) => {
    if (newVal) {
      rejectionReason.value = ''
      approvalNotes.value = ''
      showRejectionInput.value = false
      editingFile.value = null
    }
  },
)

const handleApprove = () => {
  if (props.visit) {
    emit('approve', props.visit.id, approvalNotes.value)
  }
}

const handleReject = () => {
  if (props.visit && rejectionReason.value.trim()) {
    emit('reject', props.visit.id, rejectionReason.value.trim())
  }
}

const handleFileChange = async (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file || !props.visit) return

  isUploading.value = true
  try {
    await permissionsStore.uploadSupportFile(props.visit.id, file, (progress) => {
      uploadProgress.value = progress
    })
    showToast({ title: 'Éxito', message: 'Soporte adjuntado correctamente.', type: 'success' })
  } catch (error: any) {
    showToast({ title: 'Error de Subida', message: error.message, type: 'error' })
  } finally {
    isUploading.value = false
    if (fileInput.value) fileInput.value.value = ''
  }
}

const handleDeleteFile = (file: { name: string; url: string; path: string }) => {
  if (!props.visit) return

  showDialog({
    title: 'Confirmar Eliminación',
    message: `¿Está seguro de que desea eliminar el soporte <strong>${file.name}</strong>? Esta acción es permanente.`,
    isConfirmation: true,
    confirmationText: 'Sí, Eliminar',
    async onConfirm() {
      if (props.visit) {
        try {
          await permissionsStore.deleteSupportFile(props.visit.id, file)
          showToast({ title: 'Éxito', message: 'Soporte eliminado.', type: 'success' })
        } catch (error: any) {
          showToast({
            title: 'Error',
            message: `No se pudo eliminar: ${error.message}`,
            type: 'error',
          })
        }
      }
    },
  })
}

const startEditingFileName = (file: { name: string; path: string }) => {
  editingFile.value = file
  newFileName.value = file.name
}

const cancelEditingFileName = () => {
  editingFile.value = null
}

const saveFileName = async () => {
  if (!editingFile.value || !props.visit || !newFileName.value.trim()) return

  try {
    await permissionsStore.updateSupportFileName(
      props.visit.id,
      editingFile.value.path,
      newFileName.value.trim(),
    )
    showToast({ title: 'Éxito', message: 'Nombre del archivo actualizado.', type: 'success' })
    editingFile.value = null
  } catch (error: any) {
    showToast({ title: 'Error', message: `No se pudo actualizar: ${error.message}`, type: 'error' })
  }
}

const handleDragEnd = () => {
  showToast({
    title: 'Orden Actualizado',
    message: 'El orden de los soportes ha sido guardado.',
    type: 'info',
  })
}

const formatDate = (dateString: string | null) => {
  if (!dateString) return 'N/A'
  return new Date(dateString).toLocaleString('es-CO', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
  })
}

const openPreview = (file: { url: string; name: string }) => {
  const ext = file.name.split('.').pop()?.toLowerCase()
  if (['jpg', 'jpeg', 'png', 'webp', 'pdf'].includes(ext || '')) {
    previewFile.value = { url: file.url, type: ext === 'pdf' ? 'pdf' : 'image' }
  } else {
    window.open(file.url, '_blank')
  }
}
</script>

<template>
  <div v-if="show" class="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
    <!-- Backdrop -->
    <div class="fixed inset-0 bg-[#0a0a0a]/80 backdrop-blur-sm transition-opacity z-40" @click="$emit('close')"></div>

    <div v-if="visit"
      class="relative bg-[#151515] rounded-xl border border-white/10 shadow-2xl w-full max-w-3xl flex flex-col max-h-[90vh] overflow-hidden z-50">
      <!-- Header -->
      <div class="p-6 bg-[#0a0a0a]/50 border-b border-white/10 flex justify-between items-start">
        <div>
          <h2 class="text-xl font-bold text-white flex items-center gap-2">
            <i class="fas fa-file-contract text-cyan-400"></i>
            Revisión de Permiso
          </h2>
          <p class="text-sm text-gray-400 mt-1">
            <i class="fas fa-building mr-1"></i> {{ visit.nombre_cliente }}
          </p>
        </div>
        <button @click="$emit('close')" class="text-gray-400 hover:text-white transition-colors p-1">
          <i class="fas fa-times text-xl"></i>
        </button>
      </div>

      <div class="flex-grow overflow-y-auto custom-scrollbar p-6 space-y-6">

        <!-- Info Grid -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 bg-white/5 p-4 rounded-lg border border-white/10">
          <div>
            <p class="text-xs font-bold text-gray-500 uppercase">Tipo de Servicio</p>
            <p class="text-white font-medium">{{ visit.tipo_visita }}</p>
          </div>
          <div>
            <p class="text-xs font-bold text-gray-500 uppercase">Fecha y Hora</p>
            <p class="text-white font-medium">{{ formatDate(visit.fecha_visita) }}</p>
          </div>
          <div>
            <p class="text-xs font-bold text-gray-500 uppercase">Zona</p>
            <p class="text-white font-medium">{{ visit.zona }}</p>
          </div>
          <div>
            <p class="text-xs font-bold text-gray-500 uppercase">Técnicos</p>
            <p class="text-white font-medium truncate">{{ visit.fumigadores_asignados?.join(', ') || 'Sin asignar' }}
            </p>
          </div>
        </div>

        <!-- Notas -->
        <div v-if="visit.notas_visita">
          <p class="text-sm font-bold text-gray-400 mb-2">Notas de la Solicitud</p>
          <div class="bg-yellow-900/20 border border-yellow-700/30 p-3 rounded-lg text-yellow-200 text-sm">
            {{ visit.notas_visita }}
          </div>
        </div>

        <!-- Soportes -->
        <div>
          <div class="flex justify-between items-center mb-3">
            <p class="text-sm font-bold text-gray-400">Documentación / Soportes</p>
            <button @click="fileInput?.click()"
              class="btn btn-secondary !py-1 !px-3 text-xs bg-white/5 hover:bg-white/10" :disabled="isUploading">
              <i class="fas fa-cloud-upload-alt mr-2"></i>Añadir
            </button>
            <input type="file" ref="fileInput" @change="handleFileChange" class="hidden"
              accept="image/*,.pdf,.doc,.docx" />
          </div>

          <!-- Progress Bar -->
          <div v-if="isUploading" class="mb-3">
            <div class="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
              <div class="bg-cyan-500 h-1.5 rounded-full transition-all duration-300"
                :style="{ width: `${uploadProgress}%` }"></div>
            </div>
            <p class="text-xs text-cyan-400 mt-1 text-right">Subiendo {{ uploadProgress }}%</p>
          </div>

          <!-- File List -->
          <div class="bg-[#0a0a0a]/30 rounded-lg p-3 min-h-[100px] border border-white/10">
            <draggable v-if="draggableSoportes.length > 0" v-model="draggableSoportes" item-key="path" class="space-y-2"
              handle=".handle" @end="handleDragEnd">
              <template #item="{ element: file }">
                <div
                  class="flex items-center justify-between bg-[#151515] p-2 rounded border border-white/10 group hover:border-white/20 transition-colors">
                  <div class="flex items-center gap-3 flex-grow min-w-0">
                    <div class="handle cursor-move text-gray-500 hover:text-gray-300 px-1">
                      <i class="fas fa-grip-vertical"></i>
                    </div>

                    <!-- File Icon -->
                    <div
                      class="w-8 h-8 rounded bg-white/5 flex items-center justify-center text-gray-400 flex-shrink-0">
                      <i class="fas fa-file"></i>
                    </div>

                    <!-- File Name / Edit Mode -->
                    <div class="flex-grow min-w-0">
                      <div v-if="editingFile?.path === file.path" class="flex items-center gap-2">
                        <input v-model="newFileName" @keyup.enter="saveFileName" @keyup.esc="cancelEditingFileName"
                          class="bg-[#0a0a0a] text-white text-sm px-2 py-1 rounded border border-cyan-500 focus:outline-none w-full"
                          autoFocus />
                        <button @click="saveFileName" class="text-green-400 hover:text-green-300"><i
                            class="fas fa-check"></i></button>
                        <button @click="cancelEditingFileName" class="text-red-400 hover:text-red-300"><i
                            class="fas fa-times"></i></button>
                      </div>
                      <div v-else class="flex flex-col">
                        <a href="#" @click.prevent="openPreview(file)"
                          class="text-sm font-medium text-cyan-400 hover:underline truncate cursor-pointer"
                          :title="file.name">
                          {{ file.name }}
                        </a>
                      </div>
                    </div>
                  </div>

                  <!-- Actions -->
                  <div class="flex items-center gap-1 ml-2">
                    <button @click="startEditingFileName(file)"
                      class="p-1.5 text-gray-500 hover:text-white rounded hover:bg-white/10 transition-colors"
                      title="Renombrar">
                      <i class="fas fa-pen text-xs"></i>
                    </button>
                    <button @click="handleDeleteFile(file)"
                      class="p-1.5 text-gray-500 hover:text-red-400 rounded hover:bg-white/10 transition-colors"
                      title="Eliminar">
                      <i class="fas fa-trash text-xs"></i>
                    </button>
                  </div>
                </div>
              </template>
            </draggable>
            <div v-else class="flex flex-col items-center justify-center py-6 text-gray-500">
              <i class="fas fa-folder-open text-2xl mb-2 opacity-30"></i>
              <p class="text-sm">No hay soportes adjuntos.</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Footer / Actions -->
      <div class="p-6 bg-[#0a0a0a]/50 border-t border-white/10 space-y-4">

        <!-- Aprobar: Notas -->
        <div v-if="!showRejectionInput">
          <label class="form-label">Notas de Aprobación <span class="text-gray-500 text-xs">(Opcional)</span></label>
          <textarea v-model="approvalNotes" rows="2" class="input-field-dark w-full resize-none"
            placeholder="Instrucciones para la recepción o técnicos..."></textarea>
        </div>

        <!-- Rechazar: Motivo -->
        <div v-if="showRejectionInput" class="animate-fade-in-up">
          <div class="bg-red-900/20 border border-red-900/50 p-4 rounded-lg">
            <label class="form-label text-red-400">Motivo del Rechazo <span class="text-red-400">*</span></label>
            <textarea v-model="rejectionReason" rows="3"
              class="input-field-dark w-full border-red-800 focus:border-red-500 placeholder-red-900/50"
              placeholder="Indique claramente por qué se rechaza el permiso..."></textarea>
            <div class="flex justify-end gap-3 mt-3">
              <button @click="showRejectionInput = false" class="btn btn-secondary text-sm">Cancelar</button>
              <button @click="handleReject" :disabled="!rejectionReason.trim()"
                class="btn btn-primary bg-red-600 hover:bg-red-700 text-sm">
                Confirmar Rechazo
              </button>
            </div>
          </div>
        </div>

        <!-- Botones Principales -->
        <div v-else class="flex justify-between items-center pt-2">
          <button @click="showRejectionInput = true"
            class="text-red-400 hover:text-red-300 text-sm font-medium px-2 py-1 hover:bg-red-900/20 rounded transition-colors">
            <i class="fas fa-ban mr-1"></i> Rechazar Permiso
          </button>
          <div class="flex gap-3">
            <button @click="$emit('close')" class="btn btn-secondary">Cerrar</button>
            <button @click="handleApprove"
              class="btn btn-primary bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-500/20">
              <i class="fas fa-check-circle mr-2"></i> Aprobar Permiso
            </button>
          </div>
        </div>
      </div>

    </div>

    <!-- File Preview Modal -->
    <div v-if="previewFile"
      class="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md"
      @click="previewFile = null">
      <div class="relative max-w-5xl max-h-[90vh] w-full h-full flex flex-col">
        <button @click="previewFile = null" class="absolute -top-10 right-0 text-white hover:text-gray-300 text-2xl">
          <i class="fas fa-times"></i>
        </button>
        <img v-if="previewFile.type === 'image'" :src="previewFile.url"
          class="object-contain w-full h-full rounded-lg" />
        <iframe v-else-if="previewFile.type === 'pdf'" :src="previewFile.url"
          class="w-full h-full rounded-lg bg-white"></iframe>
      </div>
    </div>
  </div>
</template>

<style scoped>
.animate-fade-in-up {
  animation: fadeInUp 0.3s ease-out;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(10px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.input-field-dark {
  background-color: #202020;
  /* bg-gray-700 -> #202020 */
  border: 1px solid rgba(255, 255, 255, 0.1);
  /* border-gray-600 -> border-white/10 */
  border-radius: 0.5rem;
  color: #fff;
  padding: 0.5rem 0.75rem;
  transition: all 0.2s;
}

.input-field-dark:focus {
  outline: none;
  border-color: #d60000;
  /* indigo-500 -> brand-red */
  box-shadow: 0 0 0 2px rgba(214, 0, 0, 0.2);
}
</style>
