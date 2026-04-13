<template>
  <div class="bg-gray-900 text-white min-h-screen flex flex-col font-sans">
    <!-- Header: Flexible para móvil, Fila para PC -->
    <header class="p-4 md:p-6 flex flex-col md:flex-row justify-between items-center gap-4 md:gap-0 border-b border-gray-800 md:border-none">
      <div class="flex items-center shrink-0">
        <img src="/logo.png" alt="Logo Sisfumi APP" class="w-24 md:w-40 transition-all duration-300" />
        <span class="text-xl md:text-2xl font-bold ml-3 md:ml-4">Sisfumi APP</span>
      </div>
      <nav class="w-full md:w-auto">
        <router-link
          to="/login"
          class="btn btn-primary bg-red-600 hover:bg-red-700 w-full md:w-auto text-center block md:inline-block py-3 md:py-2"
        >
          Iniciar Sesión
        </router-link>
      </nav>
    </header>

    <!-- Hero Section -->
    <main class="flex-grow flex items-center justify-center text-center p-4 md:p-6">
      <div class="max-w-4xl w-full">
        <!-- Títulos escalables -->
        <h1 class="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4 md:mb-6 leading-tight">
          Gestión Inteligente <br class="md:hidden" /> de Fumigación
        </h1>
        <p class="text-base sm:text-lg md:text-xl text-gray-400 max-w-3xl mx-auto mb-8 md:mb-10 px-2">
          Sisfumi APP es la solución integral para la planeación, ejecución y seguimiento de
          servicios de fumigación. Centraliza la información y sincroniza agendas con Google Calendar.
        </p>
        <div class="flex flex-col sm:flex-row justify-center gap-4 px-4 sm:px-0">
          <router-link
            to="/login"
            class="btn btn-primary bg-red-600 hover:bg-red-700 text-base md:text-lg py-3 md:py-2 w-full sm:w-auto justify-center"
          >
            Acceder a la Plataforma
          </router-link>
        </div>
      </div>
    </main>

    <!-- Footer -->
    <footer class="p-6 text-center text-gray-500 border-t border-gray-800 mt-auto">
      <p>
        <router-link to="/privacy-policy" class="hover:text-white underline transition-colors">Política de Privacidad</router-link>
      </p>
      <p class="mt-2 text-xs md:text-sm">
        &copy; {{ new Date().getFullYear() }} Sisfumi APP. Todos los derechos reservados.
      </p>
    </footer>
  </div>
</template>

<script setup lang="ts">
// Sin lógica compleja
</script>
