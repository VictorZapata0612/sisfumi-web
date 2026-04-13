<script setup lang="ts">
import { ref } from 'vue'
import { useSearchStore } from '@/stores/search'
import { useRouter } from 'vue-router'

defineOptions({ name: 'AppHeader' })

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
  <header
    class="bg-[#151515] border-b border-white/5 shadow-sm h-16 flex justify-between items-center px-4 sticky top-0 z-30">
    <!-- Mobile Menu Button -->
    <button @click="$emit('toggle-sidebar')"
      class="text-gray-400 hover:text-white lg:hidden p-2 rounded-md hover:bg-white/10 transition-colors">
      <i class="fas fa-bars text-xl"></i>
    </button>

    <!-- Search Bar Container -->
    <div class="flex-1 flex justify-end">
      <div class="relative w-full max-w-md">
        <!-- Input Wrapper -->
        <div class="relative group">
          <span
            class="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-500 group-focus-within:text-[#d60000] transition-colors">
            <i class="fas fa-search"></i>
          </span>
          <input v-model="searchTerm" @input="onSearchInput" @blur="onBlur" type="search"
            class="w-full bg-[#0a0a0a] text-gray-200 border border-white/10 rounded-lg py-2 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-[#d60000]/50 focus:border-[#d60000] transition-all placeholder-gray-500 text-sm"
            placeholder="Buscar clientes, técnicos..." autocomplete="off" />
          <!-- Loading Indicator -->
          <span v-if="searchStore.loading"
            class="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-[#d60000]">
            <i class="fas fa-circle-notch fa-spin"></i>
          </span>
        </div>

        <!-- Dropdown Results -->
        <div v-if="showResults"
          class="absolute top-full right-0 mt-2 w-full bg-[#151515] border border-white/10 rounded-lg shadow-xl z-50 overflow-hidden max-h-96 overflow-y-auto custom-scrollbar ring-1 ring-black ring-opacity-5">
          <div v-if="searchStore.loading" class="p-4 text-center text-gray-400 text-sm">
            <p>Buscando...</p>
          </div>

          <div v-else-if="searchStore.hasResults">
            <!-- Clientes Section -->
            <div v-if="searchStore.clients.length > 0">
              <div
                class="px-3 py-2 bg-[#0a0a0a] border-b border-white/10 flex items-center justify-between sticky top-0">
                <h3 class="text-xs font-bold text-gray-400 uppercase tracking-wider">Clientes</h3>
                <span class="bg-white/10 text-gray-300 text-[10px] px-1.5 py-0.5 rounded-full">{{
                  searchStore.clients.length }}</span>
              </div>
              <ul class="py-1">
                <li v-for="c in searchStore.clients" :key="c.id">
                  <a @click.prevent="navigateTo('clientes', c.id)" href="#"
                    class="block px-4 py-2 text-sm text-gray-200 hover:bg-[#d60000]/20 hover:text-white transition-colors border-l-2 border-transparent hover:border-[#d60000]">
                    <div class="font-medium">{{ c.nombreComercial }}</div>
                    <div class="text-xs text-gray-500 truncate mt-0.5">{{ c.direccion || 'Sin dirección' }}</div>
                  </a>
                </li>
              </ul>
            </div>

            <!-- Técnicos Section -->
            <div v-if="searchStore.technicians.length > 0">
              <div
                class="px-3 py-2 bg-[#0a0a0a] border-b border-white/10 border-t flex items-center justify-between sticky top-0">
                <h3 class="text-xs font-bold text-gray-400 uppercase tracking-wider">Técnicos</h3>
                <span class="bg-white/10 text-gray-300 text-[10px] px-1.5 py-0.5 rounded-full">{{
                  searchStore.technicians.length }}</span>
              </div>
              <ul class="py-1">
                <li v-for="f in searchStore.technicians" :key="f.id">
                  <a @click.prevent="navigateTo('fumigadores', f.id)" href="#"
                    class="block px-4 py-2 text-sm text-gray-200 hover:bg-[#d60000]/20 hover:text-white transition-colors border-l-2 border-transparent hover:border-[#d60000]">
                    <div class="flex items-center gap-2">
                      <i class="fas fa-user-shield text-[#d60000]"></i>
                      <span class="font-medium">{{ f.nombreCompleto }}</span>
                    </div>
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <!-- No Results -->
          <div v-else class="p-8 text-center">
            <i class="fas fa-search text-gray-600 text-2xl mb-2"></i>
            <p class="text-sm text-gray-400">No se encontraron resultados para "{{ searchTerm }}"</p>
          </div>
        </div>
      </div>
    </div>
  </header>
</template>
