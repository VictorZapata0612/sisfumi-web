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
        class="absolute top-[-10%] left-[-5%] w-[500px] h-[500px] bg-brand-red/5 rounded-full blur-[120px]"
      ></div>
      <div
        class="absolute bottom-[20%] right-[-10%] w-[400px] h-[400px] bg-yellow-900/5 rounded-full blur-[100px]"
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
          Control de Plagas
        </span>

        <h1 class="text-5xl md:text-7xl font-extrabold tracking-tight mb-8 leading-tight">
          Servicio de <br class="hidden md:block" />
          <span class="text-transparent bg-clip-text bg-gradient-to-r from-white to-orange-200">
            Desratización Profesional
          </span>
        </h1>

        <p
          class="mt-6 text-lg md:text-xl text-gray-400 leading-relaxed max-w-3xl mx-auto font-light"
        >
          Protegemos tus espacios de los riesgos sanitarios y daños estructurales causados por
          <span class="text-white font-medium">ratas y ratones</span>, garantizando un ambiente
          seguro.
        </p>
      </div>
    </section>

    <!-- ======================================= -->
    <!-- RIESGOS Y SOLUCIONES                    -->
    <!-- ======================================= -->
    <section class="relative z-10 py-16 md:py-24" v-scroll-animation>
      <div
        class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid md:grid-cols-2 gap-12 lg:gap-20 items-center"
      >
        <!-- Contenido de Texto -->
        <div class="space-y-8">
          <div>
            <h2 class="text-3xl md:text-5xl font-bold text-white mb-6">
              Soluciones <span class="text-brand-red">Efectivas</span>
            </h2>
            <div class="h-1 w-20 bg-white/10 rounded-full"></div>
          </div>

          <div class="space-y-6 text-gray-400 text-lg leading-relaxed font-light">
            <p>
              Los roedores no solo son una molestia, sino que representan un grave riesgo para la
              salud al ser portadores de enfermedades. Además, pueden causar
              <strong class="text-gray-200">daños significativos a la infraestructura</strong> al
              roer cables, tuberías y estructuras.
            </p>
            <p>
              Nuestro servicio de desratización se enfoca en eliminar la plaga de forma segura y
              efectiva, utilizando métodos de exclusión y control que protegen a las personas,
              mascotas y al entorno.
            </p>
          </div>

          <div class="flex flex-wrap gap-4 pt-4">
            <div
              class="px-4 py-2 rounded-lg bg-white/5 border border-white/5 text-sm text-gray-300 flex items-center gap-2"
            >
              <i class="fas fa-biohazard text-brand-red"></i>
              <span>Sin Riesgos Sanitarios</span>
            </div>
            <div
              class="px-4 py-2 rounded-lg bg-white/5 border border-white/5 text-sm text-gray-300 flex items-center gap-2"
            >
              <i class="fas fa-hard-hat text-brand-red"></i>
              <span>Protección Estructural</span>
            </div>
          </div>
        </div>

        <!-- Imagen -->
        <div class="relative group">
          <div
            class="absolute -inset-1 bg-gradient-to-br from-orange-500/20 to-brand-red/20 rounded-2xl blur-xl opacity-50 group-hover:opacity-75 transition-opacity duration-500"
          ></div>
          <div
            class="aspect-video bg-[#151515] border border-white/10 rounded-2xl p-2 relative z-10 overflow-hidden shadow-2xl"
          >
            <img
              src="/images/servicio-desratizacion.jpg"
              alt="Desratización Profesional"
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
    <!-- PROCESO DE DESRATIZACIÓN (Cards)        -->
    <!-- ======================================= -->
    <section class="relative z-10 py-24 bg-white/[0.02]" v-scroll-animation>
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="text-center mb-20">
          <h2 class="text-3xl md:text-4xl font-bold mb-4">Proceso de Intervención</h2>
          <p class="text-lg text-gray-400 max-w-2xl mx-auto">
            Un enfoque metódico para garantizar la erradicación total y la prevención futura.
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
            <h3 class="text-xl font-bold text-white mb-3">Inspección</h3>
            <p class="text-gray-400 text-sm leading-relaxed">
              Identificamos la especie (ratas o ratones), puntos de ingreso, zonas de anidación y la
              magnitud real de la infestación.
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
            <h3 class="text-xl font-bold text-white mb-3">Diseño del Plan</h3>
            <p class="text-gray-400 text-sm leading-relaxed">
              Creamos una estrategia personalizada combinando trampas mecánicas, estaciones de cebo
              seguras y métodos de exclusión.
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
            <h3 class="text-xl font-bold text-white mb-3">Ejecución</h3>
            <p class="text-gray-400 text-sm leading-relaxed">
              Implementamos el plan de control de forma segura en zonas estratégicas, minimizando
              riesgos para niños y mascotas.
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
            <h3 class="text-xl font-bold text-white mb-3">Prevención</h3>
            <p class="text-gray-400 text-sm leading-relaxed">
              Sellamos puntos de acceso críticos y te damos recomendaciones estructurales para
              evitar futuras reinfestaciones.
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
          ¿Necesitas un Espacio Libre de Roedores?
        </h2>
        <p class="text-gray-400 max-w-2xl mx-auto mb-10 text-lg">
          No esperes a que el problema crezca. Contáctanos para una inspección y recibe un plan de
          acción profesional.
        </p>
        <div>
          <RouterLink
            to="/contacto"
            class="btn btn-primary shadow-[0_0_20px_rgba(225,29,72,0.4)] hover:shadow-[0_0_30px_rgba(225,29,72,0.6)] !py-4 !px-8 !text-lg"
          >
            Solicitar Inspección Profesional
          </RouterLink>
        </div>
      </div>
    </section>
  </div>
</template>
