<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useSearchStore } from '@/stores/search'
import { RouterLink, useRouter } from 'vue-router'
import { useNotificationStore } from '@/stores/notifications'

defineOptions({ name: 'AppHeader' })

defineProps<{ sidebarOpen: boolean; darkTheme: boolean; showClock?: boolean }>()
defineEmits<{ 'toggle-sidebar': []; 'set-theme': [dark: boolean] }>()

const now = ref(new Date())
const dateFormat = new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeZone: 'America/Bogota' })
const timeFormat = new Intl.DateTimeFormat('es-CO', { timeStyle: 'short', timeZone: 'America/Bogota' })
let clock: number | undefined
let blurTimeout: number | undefined

onMounted(() => {
  clock = window.setInterval(() => { now.value = new Date() }, 1000)
})
onUnmounted(() => {
  window.clearInterval(clock)
  window.clearTimeout(searchTimeout)
  window.clearTimeout(blurTimeout)
})

const searchStore = useSearchStore()
const notificationStore = useNotificationStore()
const router = useRouter()
const searchTerm = ref('')
const showResults = ref(false)
let searchTimeout: number | undefined

const onSearchInput = () => {
  window.clearTimeout(blurTimeout)
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
  blurTimeout = window.setTimeout(() => {
    showResults.value = false
  }, 200)
}
</script>

<template>
  <header
    class="top-navigation relative z-30 flex h-[4.5rem] shrink-0 items-center gap-2 border-b border-[var(--shell-border)] bg-[var(--shell-surface)] px-3 lg:gap-5 lg:pl-16 lg:pr-5">
    <!-- Mobile Menu Button -->
    <button type="button" @click="$emit('toggle-sidebar')" aria-label="Abrir navegación" aria-controls="sidebar" :aria-expanded="sidebarOpen"
      class="text-[var(--shell-text)] lg:hidden p-2 rounded-md hover:bg-[var(--shell-input)] transition-colors">
      <i class="fas fa-bars text-xl"></i>
    </button>

    <!-- Search Bar Container -->
    <div class="min-w-0 flex-1">
      <div class="relative w-full max-w-4xl">
        <!-- Input Wrapper -->
        <div class="relative group">
          <span
            class="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-[var(--shell-muted)] group-focus-within:text-[#d60000] transition-colors">
            <i class="fas fa-search"></i>
          </span>
          <input id="sisfumi-global-search" aria-label="Buscar clientes y técnicos" @keydown.escape="showResults = false" v-model="searchTerm" @input="onSearchInput" @blur="onBlur" type="search"
            class="w-full bg-[var(--shell-input)] text-[var(--shell-text)] border border-[var(--shell-border)] rounded-full py-2 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-[#d60000]/50 focus:border-[#d60000] transition-all placeholder-gray-500 text-sm"
            placeholder="Buscar clientes, técnicos..." autocomplete="off" />
          <!-- Loading Indicator -->
          <span v-if="searchStore.loading"
            class="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-[#d60000]">
            <i class="fas fa-circle-notch fa-spin"></i>
          </span>
        </div>

        <!-- Dropdown Results -->
        <div v-if="showResults"
          class="absolute top-full right-0 mt-2 w-full bg-[var(--shell-surface)] border border-[var(--shell-border)] rounded-lg shadow-xl z-50 overflow-hidden max-h-96 overflow-y-auto custom-scrollbar ring-1 ring-black ring-opacity-5">
          <div v-if="searchStore.loading" class="p-4 text-center text-[var(--shell-muted)] text-sm">
            <p>Buscando...</p>
          </div>

          <div v-else-if="searchStore.hasResults">
            <!-- Clientes Section -->
            <div v-if="searchStore.clients.length > 0">
              <div
                class="px-3 py-2 bg-[var(--shell-input)] border-b border-[var(--shell-border)] flex items-center justify-between sticky top-0">
                <h3 class="text-xs font-bold text-[var(--shell-muted)] uppercase tracking-wider">Clientes</h3>
                <span class="bg-white/10 text-gray-300 text-[10px] px-1.5 py-0.5 rounded-full">{{
                  searchStore.clients.length }}</span>
              </div>
              <ul class="py-1">
                <li v-for="c in searchStore.clients" :key="c.id">
                  <a @click.prevent="navigateTo('clientes', c.id)" href="#"
                    class="block px-4 py-2 text-sm text-[var(--shell-text)] hover:bg-[#d60000]/20 hover:text-[var(--shell-text)] transition-colors border-l-2 border-transparent hover:border-[#d60000]">
                    <div class="font-medium">{{ c.nombreComercial }}</div>
                    <div class="text-xs text-[var(--shell-muted)] truncate mt-0.5">{{ c.direccion || 'Sin dirección' }}</div>
                  </a>
                </li>
              </ul>
            </div>

            <!-- Técnicos Section -->
            <div v-if="searchStore.technicians.length > 0">
              <div
                class="px-3 py-2 bg-[var(--shell-input)] border-b border-[var(--shell-border)] border-t flex items-center justify-between sticky top-0">
                <h3 class="text-xs font-bold text-[var(--shell-muted)] uppercase tracking-wider">Técnicos</h3>
                <span class="bg-white/10 text-gray-300 text-[10px] px-1.5 py-0.5 rounded-full">{{
                  searchStore.technicians.length }}</span>
              </div>
              <ul class="py-1">
                <li v-for="f in searchStore.technicians" :key="f.id">
                  <a @click.prevent="navigateTo('fumigadores', f.id)" href="#"
                    class="block px-4 py-2 text-sm text-[var(--shell-text)] hover:bg-[#d60000]/20 hover:text-[var(--shell-text)] transition-colors border-l-2 border-transparent hover:border-[#d60000]">
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
            <p class="text-sm text-[var(--shell-muted)]">No se encontraron resultados para "{{ searchTerm }}"</p>
          </div>
        </div>
      </div>
    </div>
    <RouterLink :to="{ query: { ...$route.query, notificaciones: '1' }, hash: $route.hash }" aria-haspopup="dialog" aria-label="Notificaciones" title="Notificaciones"
      class="relative flex size-10 shrink-0 items-center justify-center rounded-lg hover:bg-[var(--shell-input)]">
      <i class="fas fa-bell" aria-hidden="true"></i>
      <span v-if="notificationStore.generalNotificationsCount"
        class="absolute right-0 top-0 min-w-4 rounded-full bg-[#E50914] px-1 text-center text-[10px] text-white">
        {{ notificationStore.generalNotificationsCount }}
      </span>
    </RouterLink>
    <div class="shrink-0 border-l border-[var(--shell-border)] pl-2 sm:pl-3">
      <div role="group" aria-label="Tema de SisFumi" class="theme-picker" :class="{ 'is-dark': darkTheme }">
        <span class="theme-indicator" aria-hidden="true"></span>
        <button type="button" class="theme-option theme-night"
          aria-label="Tema oscuro" title="Tema oscuro" :aria-pressed="darkTheme" @click="$emit('set-theme', true)">
          <i class="fas fa-moon" aria-hidden="true"></i>
        </button>
        <button type="button" class="theme-option theme-day"
          aria-label="Tema claro" title="Tema claro" :aria-pressed="!darkTheme" @click="$emit('set-theme', false)">
          <i class="fas fa-sun" aria-hidden="true"></i>
        </button>
      </div>
    </div>
    <time v-if="showClock" :datetime="now.toISOString()" class="hidden shrink-0 border-l border-[var(--shell-border)] pl-4 text-xs leading-5 sm:block">
      <span class="block font-semibold">{{ dateFormat.format(now) }}</span>
      <span class="text-[var(--shell-muted)]">{{ timeFormat.format(now) }}</span>
    </time>
  </header>
</template>

<style scoped>
@media (prefers-reduced-motion: no-preference) {
  .top-navigation { transition: background-color 240ms, border-color 240ms, color 240ms; }
}

.theme-picker {
  position: relative;
  display: flex;
  border-radius: 0.7rem;
  background: #fafafa;
  box-shadow: 0 1px 3px #0002;
}

.theme-option {
  position: relative;
  display: grid;
  width: 2.4rem;
  height: 2rem;
  place-items: center;
  border-radius: inherit;
  font-size: 0.9rem;
  transition: background-color 150ms, color 150ms;
}

.theme-indicator {
  position: absolute;
  inset: 0 auto 0 0;
  width: 50%;
  border-radius: inherit;
  background: #fff;
  box-shadow: 0 1px 4px #0003;
  transform: translateX(100%);
  transition: transform 240ms cubic-bezier(.22,.8,.25,1), background-color 240ms;
}
.theme-picker.is-dark .theme-indicator { transform: translateX(0); background: #181818; }
.theme-option { color: #67676d; }
.theme-option:hover { color: #b8000b; }
.theme-day[aria-pressed='true'] { color: #111; }
.theme-night[aria-pressed='true'] { color: #fff; }
@media (prefers-reduced-motion: reduce) {
  .theme-indicator, .theme-option { transition: none; }
}
.theme-option:focus-visible { outline: 2px solid #e50914; outline-offset: 2px; }


@media (min-width: 1024px) {
  .top-navigation::before {
    position: absolute;
    inset: 0 auto 0 0;
    width: 3.5rem;
    background: linear-gradient(125deg, #750009 0 19%, #e50914 19% 37%, #111 37% 43%, #b8000b 43% 54%, transparent 54% 57%, #e50914 57% 65%, transparent 65%);
    pointer-events: none;
    content: '';
  }
}
</style>
