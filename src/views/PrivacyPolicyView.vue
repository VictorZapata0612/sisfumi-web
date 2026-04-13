<template>
  <div class="min-h-screen bg-gray-900 text-gray-300 font-sans flex flex-col">
    <!-- Header para Móvil (Sticky) -->
    <div class="sticky top-0 z-20 bg-gray-900/95 backdrop-blur border-b border-gray-800 p-4 md:hidden flex justify-between items-center shadow-md">
       <span class="font-bold text-white text-lg">Sisfumi APP</span>
       <router-link
         to="/"
         class="btn btn-secondary text-xs px-3 py-2 flex items-center"
       >
         <i class="fas fa-arrow-left mr-2"></i>Volver
       </router-link>
    </div>

    <!-- Contenido Principal -->
    <div class="flex-grow p-4 md:p-8 lg:p-12">
      <div class="max-w-5xl mx-auto bg-gray-800 rounded-xl shadow-2xl border border-gray-700 overflow-hidden">

        <!-- Header del Documento (Diseño Desktop completo) -->
        <div class="p-6 md:p-10 border-b border-gray-700 bg-gray-800/50 relative">
          <!-- Botón Volver (Visible solo en Desktop) -->
          <div class="hidden md:flex justify-between items-start mb-6">
            <router-link to="/" class="text-cyan-400 hover:text-white transition-colors flex items-center group">
              <div class="bg-gray-700 p-2 rounded-full mr-3 group-hover:bg-gray-600 transition-colors">
                 <i class="fas fa-arrow-left text-sm"></i>
              </div>
              <span class="font-medium">Volver al Inicio</span>
            </router-link>
            <!-- Logo o Icono decorativo -->
            <div class="text-3xl text-gray-600 opacity-50"><i class="fas fa-file-shield"></i></div>
          </div>

          <h1 class="text-2xl md:text-4xl lg:text-5xl font-bold text-white mb-4">Política de Privacidad</h1>

          <div class="flex flex-col sm:flex-row sm:items-center gap-2 text-sm text-gray-400 border-l-4 border-cyan-500 pl-4">
            <p>Última actualización: <span class="text-cyan-400 font-medium font-mono">{{ new Date().toLocaleDateString() }}</span></p>
            <span class="hidden sm:inline text-gray-600">•</span>
            <p>Sisfumi APP - Gestión Integral</p>
          </div>
        </div>

        <!-- Cuerpo del Texto con Tipografía Optimizada -->
        <div class="p-6 md:p-10 lg:p-12 space-y-8 prose prose-invert max-w-none">

          <!-- Introducción -->
          <section>
            <p class="text-lg md:text-xl text-gray-200 leading-relaxed">
              Bienvenido a Sisfumi APP. Su privacidad es de suma importancia para nosotros. Esta
              Política de Privacidad explica de manera transparente qué datos recopilamos, por qué los recopilamos y cómo los
              utilizamos para potenciar su experiencia en la gestión de servicios de fumigación.
            </p>
          </section>

          <div class="h-px bg-gray-700 w-full my-8"></div>

          <!-- Sección 1 -->
          <section class="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-10">
            <div class="lg:col-span-4">
              <h2 class="text-xl md:text-2xl font-bold text-white flex items-center mb-2">
                <span class="bg-blue-600 text-white w-8 h-8 rounded-lg flex items-center justify-center text-sm mr-3 shadow-lg">1</span>
                Recopilación de Datos
              </h2>
              <p class="text-sm text-gray-500">Información esencial para la operación.</p>
            </div>
            <div class="lg:col-span-8 bg-gray-900/30 p-6 rounded-lg border border-gray-700/50">
              <ul class="space-y-4">
                <li class="flex items-start">
                  <i class="fas fa-user-circle text-blue-400 mt-1 mr-3 text-lg"></i>
                  <span>
                    <strong class="text-white block mb-1">Información de la Cuenta</strong>
                    Nombre, correo electrónico corporativo, número telefónico y rol de usuario
                    para garantizar una autenticación segura y gestión de permisos jerárquicos.
                  </span>
                </li>
                <li class="flex items-start">
                  <i class="fas fa-clipboard-list text-blue-400 mt-1 mr-3 text-lg"></i>
                  <span>
                    <strong class="text-white block mb-1">Datos Operativos</strong>
                    Base de datos de clientes, cronograma de visitas técnicas, historial de servicios,
                    evidencia fotográfica y reportes generados dentro de la plataforma.
                  </span>
                </li>
              </ul>
            </div>
          </section>

          <!-- Sección 2 -->
          <section class="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-10">
            <div class="lg:col-span-4">
              <h2 class="text-xl md:text-2xl font-bold text-white flex items-center mb-2">
                <span class="bg-green-600 text-white w-8 h-8 rounded-lg flex items-center justify-center text-sm mr-3 shadow-lg">2</span>
                Integraciones Externas
              </h2>
              <p class="text-sm text-gray-500">Conexión con servicios de terceros.</p>
            </div>
            <div class="lg:col-span-8 bg-gray-900/30 p-6 rounded-lg border border-gray-700/50">
              <p class="mb-4 text-gray-300">
                Sisfumi APP integra servicios de Google para optimizar la logística de su equipo:
              </p>
              <div class="flex items-start bg-gray-800 p-4 rounded-md border border-gray-600 mb-4">
                <i class="fab fa-google text-2xl text-white mr-4 mt-1"></i>
                <div>
                  <h4 class="font-bold text-white">Google Calendar API</h4>
                  <p class="text-sm text-gray-400 mt-1">
                    Sincronizamos automáticamente las visitas programadas con los calendarios de sus técnicos
                    para evitar conflictos de horario y mejorar la puntualidad.
                  </p>
                </div>
              </div>
              <p class="text-xs text-gray-500">
                El uso de la información recibida de las APIs de Google se adhiere a la
                <a href="#" class="text-cyan-400 hover:text-cyan-300 underline">Política de Datos de Usuario de los Servicios de API de Google</a>,
                incluyendo los requisitos de Uso Limitado.
              </p>
            </div>
          </section>

          <!-- Sección 3 -->
          <section class="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-10">
            <div class="lg:col-span-4">
              <h2 class="text-xl md:text-2xl font-bold text-white flex items-center mb-2">
                <span class="bg-purple-600 text-white w-8 h-8 rounded-lg flex items-center justify-center text-sm mr-3 shadow-lg">3</span>
                Seguridad
              </h2>
            </div>
            <div class="lg:col-span-8">
              <p class="text-gray-300 mb-4">
                Utilizamos estándares industriales de encriptación (SSL/TLS) para proteger sus datos en tránsito
                y reposo. Realizamos copias de seguridad automáticas para prevenir la pérdida de información crítica.
              </p>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div class="flex items-center p-3 bg-gray-800 rounded border border-gray-700">
                  <i class="fas fa-lock text-green-400 mr-3"></i> <span>Encriptación SSL</span>
                </div>
                <div class="flex items-center p-3 bg-gray-800 rounded border border-gray-700">
                  <i class="fas fa-database text-blue-400 mr-3"></i> <span>Backups Diarios</span>
                </div>
              </div>
            </div>
          </section>

          <div class="h-px bg-gray-700 w-full my-8"></div>

          <!-- Contacto -->
          <section class="text-center md:text-left">
            <h2 class="text-xl md:text-2xl font-bold text-white mb-4">¿Tiene dudas adicionales?</h2>
            <div class="flex flex-col md:flex-row gap-4 items-center">
              <a href="mailto:soporte@sisfumi.com" class="btn btn-primary w-full md:w-auto flex items-center justify-center px-6 py-3">
                <i class="fas fa-envelope mr-2"></i> Contactar Soporte
              </a>
              <p class="text-gray-400 text-sm">Nuestro equipo responde habitualmente en menos de 24 horas.</p>
            </div>
          </section>

        </div>

        <!-- Footer del Documento -->
        <div class="bg-gray-900/50 p-6 md:p-8 border-t border-gray-700 text-center">
          <router-link
            to="/"
            class="inline-block text-sm text-gray-500 hover:text-cyan-400 transition-colors mb-2 font-medium"
          >
            Volver a la página principal
          </router-link>
          <p class="text-xs text-gray-600">
            &copy; {{ new Date().getFullYear() }} Sisfumi APP. Todos los derechos reservados.
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// Vista estática, no requiere lógica compleja
</script>

<style scoped>
/* Tipografía base ajustada */
</style>
