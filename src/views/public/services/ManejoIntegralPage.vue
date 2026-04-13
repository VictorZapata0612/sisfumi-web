<script setup lang="ts">
import { RouterLink } from 'vue-router'
</script>

<template>
  <div
    class="bg-[#0a0a0a] text-white min-h-screen font-sans relative selection:bg-brand-red selection:text-white overflow-hidden"
  >
    <!-- FONDO DECORATIVO GLOBAL -->
    <div class="fixed inset-0 pointer-events-none z-0">
      <div
        class="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-brand-red/5 rounded-full blur-[120px]"
      ></div>
      <div
        class="absolute bottom-[20%] right-[-5%] w-[400px] h-[400px] bg-blue-900/5 rounded-full blur-[100px]"
      ></div>
    </div>

    <!-- ======================================= -->
    <!-- ENCABEZADO DEL SERVICIO (Hero)          -->
    <!-- ======================================= -->
    <section class="relative z-10 py-24 md:py-32 text-center px-4" v-scroll-animation>
      <div class="max-w-5xl mx-auto">
        <span
          class="inline-block py-1 px-3 mb-6 rounded-full bg-white/5 border border-white/10 text-brand-red text-xs md:text-sm font-bold tracking-[0.2em] backdrop-blur-md uppercase"
        >
          Servicio Especializado
        </span>

        <h1 class="text-5xl md:text-7xl font-extrabold tracking-tight mb-8 leading-tight">
          Manejo Integral <br class="hidden md:block" />
          <span class="text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-500">
            de Plagas (MIP)
          </span>
        </h1>

        <p
          class="mt-6 text-lg md:text-xl text-gray-400 leading-relaxed max-w-3xl mx-auto font-light"
        >
          Una estrategia <span class="text-white font-medium">proactiva y ecológica</span> para un
          control sostenible, minimizando riesgos para la salud y el medio ambiente.
        </p>
      </div>
    </section>

    <!-- ======================================= -->
    <!-- ¿QUÉ ES EL MIP?                         -->
    <!-- ======================================= -->
    <section class="relative z-10 py-16 md:py-24" v-scroll-animation>
      <div
        class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid md:grid-cols-2 gap-12 lg:gap-20 items-center"
      >
        <!-- Contenido de Texto -->
        <div class="space-y-8">
          <div>
            <h2 class="text-3xl md:text-5xl font-bold text-white mb-6">
              ¿En qué consiste el <span class="text-brand-red">MIP</span>?
            </h2>
            <div class="h-1 w-20 bg-white/10 rounded-full"></div>
          </div>

          <div class="space-y-6 text-gray-400 text-lg leading-relaxed font-light">
            <p>
              El Manejo Integral de Plagas (MIP) es un enfoque
              <strong class="text-gray-200">ecológico y multifacético</strong>. En lugar de
              simplemente reaccionar a las infestaciones con químicos indiscriminados, el MIP se
              centra en la prevención inteligente a largo plazo.
            </p>
            <p>
              Combinamos un profundo conocimiento del ciclo de vida de las plagas con un control
              ambiental estratégico. Esto nos permite gestionar las amenazas de la forma más
              <strong class="text-gray-200">eficaz y segura</strong> para las personas, la propiedad
              y el entorno.
            </p>
          </div>

          <div class="flex gap-4 pt-4">
            <div class="flex items-center gap-2 text-sm text-gray-500">
              <i class="fas fa-check-circle text-brand-red"></i>
              <span>Ecológico</span>
            </div>
            <div class="flex items-center gap-2 text-sm text-gray-500">
              <i class="fas fa-check-circle text-brand-red"></i>
              <span>Preventivo</span>
            </div>
            <div class="flex items-center gap-2 text-sm text-gray-500">
              <i class="fas fa-check-circle text-brand-red"></i>
              <span>Seguro</span>
            </div>
          </div>
        </div>

        <!-- Imagen / Placeholder Decorativo -->
        <div class="relative group">
          <!-- Efecto Glow detrás -->
          <div
            class="absolute -inset-1 bg-gradient-to-r from-brand-red/30 to-blue-600/30 rounded-2xl blur-xl opacity-50 group-hover:opacity-75 transition-opacity duration-500"
          ></div>

          <div
            class="aspect-video bg-[#151515] border border-white/10 rounded-2xl p-2 relative z-10 overflow-hidden shadow-2xl"
          >
            <img
              src="/images/servicio-manejo-plagas.jpg"
              alt="Manejo Integral de Plagas"
              class="w-full h-full object-cover rounded-xl transition-transform duration-700 group-hover:scale-105"
            />
            <div
              class="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-60 rounded-xl pointer-events-none"
            ></div>
          </div>
        </div>
      </div>
    </section>

    <!-- ======================================= -->
    <!-- FASES DEL SERVICIO (Cards Numeradas)    -->
    <!-- ======================================= -->
    <section class="relative z-10 py-24 bg-white/[0.02]" v-scroll-animation>
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="text-center mb-20">
          <h2 class="text-3xl md:text-4xl font-bold mb-4">Metodología Estructurada</h2>
          <p class="text-lg text-gray-400 max-w-2xl mx-auto">
            Nuestro proceso de 4 fases garantiza la máxima eficacia y seguridad en cada
            intervención.
          </p>
        </div>

        <div class="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          <!-- Fase 1 -->
          <div
            class="group bg-[#151515] border border-white/5 rounded-2xl p-8 hover:border-brand-red/30 hover:-translate-y-2 transition-all duration-300 relative overflow-hidden"
          >
            <div
              class="absolute top-0 right-0 p-4 opacity-10 font-black text-6xl text-brand-red group-hover:opacity-20 transition-opacity select-none"
            >
              1
            </div>
            <div
              class="w-12 h-12 rounded-full bg-brand-red/10 border border-brand-red/20 flex items-center justify-center text-brand-red font-bold text-lg mb-6 group-hover:bg-brand-red group-hover:text-white transition-colors"
            >
              1
            </div>
            <h3 class="text-xl font-bold text-white mb-3">Diagnóstico</h3>
            <p class="text-gray-400 text-sm leading-relaxed">
              Inspección detallada para identificar las plagas, su origen, puntos de acceso y la
              magnitud real del problema.
            </p>
          </div>

          <!-- Fase 2 -->
          <div
            class="group bg-[#151515] border border-white/5 rounded-2xl p-8 hover:border-brand-red/30 hover:-translate-y-2 transition-all duration-300 relative overflow-hidden"
          >
            <div
              class="absolute top-0 right-0 p-4 opacity-10 font-black text-6xl text-brand-red group-hover:opacity-20 transition-opacity select-none"
            >
              2
            </div>
            <div
              class="w-12 h-12 rounded-full bg-brand-red/10 border border-brand-red/20 flex items-center justify-center text-brand-red font-bold text-lg mb-6 group-hover:bg-brand-red group-hover:text-white transition-colors"
            >
              2
            </div>
            <h3 class="text-xl font-bold text-white mb-3">Planificación</h3>
            <p class="text-gray-400 text-sm leading-relaxed">
              Diseño de una estrategia a medida, seleccionando la combinación óptima de métodos
              físicos, químicos y culturales.
            </p>
          </div>

          <!-- Fase 3 -->
          <div
            class="group bg-[#151515] border border-white/5 rounded-2xl p-8 hover:border-brand-red/30 hover:-translate-y-2 transition-all duration-300 relative overflow-hidden"
          >
            <div
              class="absolute top-0 right-0 p-4 opacity-10 font-black text-6xl text-brand-red group-hover:opacity-20 transition-opacity select-none"
            >
              3
            </div>
            <div
              class="w-12 h-12 rounded-full bg-brand-red/10 border border-brand-red/20 flex items-center justify-center text-brand-red font-bold text-lg mb-6 group-hover:bg-brand-red group-hover:text-white transition-colors"
            >
              3
            </div>
            <h3 class="text-xl font-bold text-white mb-3">Implementación</h3>
            <p class="text-gray-400 text-sm leading-relaxed">
              Aplicación precisa de tratamientos y colocación de barreras físicas, priorizando la
              seguridad de los ocupantes.
            </p>
          </div>

          <!-- Fase 4 -->
          <div
            class="group bg-[#151515] border border-white/5 rounded-2xl p-8 hover:border-brand-red/30 hover:-translate-y-2 transition-all duration-300 relative overflow-hidden"
          >
            <div
              class="absolute top-0 right-0 p-4 opacity-10 font-black text-6xl text-brand-red group-hover:opacity-20 transition-opacity select-none"
            >
              4
            </div>
            <div
              class="w-12 h-12 rounded-full bg-brand-red/10 border border-brand-red/20 flex items-center justify-center text-brand-red font-bold text-lg mb-6 group-hover:bg-brand-red group-hover:text-white transition-colors"
            >
              4
            </div>
            <h3 class="text-xl font-bold text-white mb-3">Monitoreo</h3>
            <p class="text-gray-400 text-sm leading-relaxed">
              Seguimiento continuo y documentación de hallazgos para evaluar efectividad y prevenir
              reincidencias.
            </p>
          </div>
        </div>
      </div>
    </section>

    <!-- ======================================= -->
    <!-- CTA FINAL                               -->
    <!-- ======================================= -->
    <section class="relative z-10 py-24 border-t border-white/5 bg-[#0a0a0a]">
      <div class="max-w-4xl mx-auto px-4 text-center">
        <h2 class="text-3xl md:text-4xl font-bold text-white mb-6">
          ¿Necesitas una solución integral?
        </h2>
        <p class="text-gray-400 max-w-2xl mx-auto mb-10 text-lg">
          Nuestro equipo de expertos está listo para realizar un diagnóstico sin costo y ofrecerte
          un plan de Manejo Integral adaptado a tus necesidades.
        </p>
        <div>
          <RouterLink
            to="/contacto"
            class="btn btn-primary shadow-[0_0_20px_rgba(225,29,72,0.4)] hover:shadow-[0_0_30px_rgba(225,29,72,0.6)] !py-4 !px-8 !text-lg"
          >
            Solicitar Diagnóstico Gratis
          </RouterLink>
        </div>
      </div>
    </section>
  </div>
</template>
