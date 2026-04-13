<script setup lang="ts">
defineOptions({ name: 'AppHeader' })
import { ref } from 'vue'
import { useSearchStore } from '@/stores/search'
import { useRouter } from 'vue-router'

const searchStore = useSearchStore()
const router = useRouter()
const searchTerm = ref('')
const showResults = ref(false)
let searchTimeout: number | undefined

const onSearchInput = () => {
  clearTimeout(searchTimeout)
  if (searchTerm.value.length > 1) {
    showResults.value = true
    searchTimeout = setTimeout(() => {
      searchStore.performSearch(searchTerm.value)
    }, 300)
  } else {
    showResults.value = false
    searchStore.clearSearch()
  }
}

const navigateTo = (type: 'clientes' | 'fumigadores', id: string) => {
  router.push({ name: type, query: { itemIdToOpen: id } })
  showResults.value = false
  searchTerm.value = ''
  searchStore.clearSearch()
}

const onBlur = () => {
  // Pequeño retraso para permitir el clic en los resultados
  setTimeout(() => {
    showResults.value = false
  }, 200)
}
</script>

<template>
  <header class="bg-gray-800 shadow-sm p-4 flex justify-end items-center sticky top-0 z-30">
    <div class="relative w-1/3">
      <i class="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
      <input
        v-model="searchTerm"
        @input="onSearchInput"
        @blur="onBlur"
        type="search"
        class="input-field-dark w-full pl-10 py-2 pr-3"
        placeholder="Buscar cliente o técnico..."
      />
      <div
        v-if="showResults"
        class="absolute top-full mt-2 w-full bg-gray-700 rounded-md shadow-lg z-50 max-h-80 overflow-y-auto custom-scrollbar"
      >
        <div v-if="searchStore.loading" class="p-3 text-sm text-gray-400 text-center">
          <i class="fas fa-spinner fa-spin"></i> Buscando...
        </div>
        <div v-else-if="searchStore.hasResults">
          <div v-if="searchStore.clients.length > 0">
            <h3 class="px-3 pt-2 text-xs font-bold text-gray-500 uppercase">Clientes</h3>
            <a
              v-for="c in searchStore.clients"
              :key="c.id"
              @click.prevent="navigateTo('clientes', c.id)"
              href="#"
              class="block px-3 py-2 text-sm text-white hover:bg-gray-600"
              ><i class="fas fa-user mr-2 text-cyan-400"></i> {{ c.nombreComercial }}</a
            >
          </div>
          <div v-if="searchStore.technicians.length > 0">
            <h3 class="px-3 pt-2 text-xs font-bold text-gray-500 uppercase">Técnicos</h3>
            <a
              v-for="f in searchStore.technicians"
              :key="f.id"
              @click.prevent="navigateTo('fumigadores', f.id)"
              href="#"
              class="block px-3 py-2 text-sm text-white hover:bg-gray-600"
              ><i class="fas fa-user-shield mr-2 text-teal-400"></i> {{ f.nombreCompleto }}</a
            >
          </div>
        </div>
        <div v-else class="p-3 text-sm text-gray-400">No se encontraron resultados.</div>
      </div>
    </div>
  </header>
</template>
