import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { httpsCallable } from 'firebase/functions'
import { functions } from '@/firebase/config'

interface SearchResult {
  id: string
  [key: string]: unknown
}

export const useSearchStore = defineStore('search', () => {
  // --- State ---
  const clients = ref<SearchResult[]>([])
  const technicians = ref<SearchResult[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  // --- Getters ---
  const hasResults = computed(() => clients.value.length > 0 || technicians.value.length > 0)

  // --- Actions ---
  async function performSearch(term: string) {
    if (term.length < 2) return

    loading.value = true
    error.value = null
    try {
      const searchFn = httpsCallable(functions, 'globalSearch')
      const result = await searchFn({ term })
      const data = result.data as { clients: SearchResult[]; fumigadores: SearchResult[] }

      clients.value = data.clients || []
      technicians.value = data.fumigadores || []
    } catch (err: unknown) {
      console.error('Error en la búsqueda global:', err)
      error.value = 'No se pudo realizar la búsqueda.'
    } finally {
      loading.value = false
    }
  }

  function clearSearch() {
    clients.value = []
    technicians.value = []
    error.value = null
  }

  return { clients, technicians, loading, error, hasResults, performSearch, clearSearch }
})
