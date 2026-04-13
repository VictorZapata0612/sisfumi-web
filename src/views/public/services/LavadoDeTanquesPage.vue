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
        class="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-brand-red/5 rounded-full blur-[120px]"
      ></div>
      <div
        class="absolute bottom-[10%] left-[-5%] w-[400px] h-[400px] bg-cyan-900/5 rounded-full blur-[100px]"
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
          Salud Pública
        </span>

        <h1 class="text-5xl md:text-7xl font-extrabold tracking-tight mb-8 leading-tight">
          Lavado de Tanques y <br class="hidden md:block" />
          <span class="text-transparent bg-clip-text bg-gradient-to-r from-white to-cyan-200">
            Control de Larvas
          </span>
        </h1>

        <p
          class="mt-6 text-lg md:text-xl text-gray-400 leading-relaxed max-w-3xl mx-auto font-light"
        >
          Garantizamos la <span class="text-white font-medium">calidad del agua</span> que consumes
          mediante protocolos certificados de limpieza y desinfección profunda.
        </p>
      </div>
    </section>

    <!-- ======================================= -->
    <!-- ¿POR QUÉ ES IMPORTANTE?                 -->
    <!-- ======================================= -->
    <section class="relative z-10 py-16 md:py-24" v-scroll-animation>
      <div
        class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid md:grid-cols-2 gap-12 lg:gap-20 items-center"
      >
        <!-- Contenido de Texto -->
        <div class="space-y-8 order-2 md:order-1">
          <div>
            <h2 class="text-3xl md:text-5xl font-bold text-white mb-6">
              Agua Pura y <span class="text-cyan-400">Segura</span>
            </h2>
            <div class="h-1 w-20 bg-white/10 rounded-full"></div>
          </div>

          <div class="space-y-6 text-gray-400 text-lg leading-relaxed font-light">
            <p>
              Con el tiempo, los tanques de almacenamiento acumulan sedimentos, lodo y biopelículas.
              Estos residuos no solo afectan la calidad del agua, sino que se convierten en el
              ecosistema perfecto para la proliferación de
              <strong class="text-gray-200">bacterias y larvas de mosquitos</strong> transmisores de
              enfermedades como Dengue y Zika.
            </p>
            <p>
              Un lavado profesional periódico es la única barrera efectiva para asegurar que el agua
              que utilizas para beber, cocinar y asearte cumpla con los estándares de salubridad.
            </p>
          </div>

          <div class="flex flex-wrap gap-4 pt-4">
            <div
              class="px-4 py-2 rounded-lg bg-white/5 border border-white/5 text-sm text-gray-300 flex items-center gap-2"
            >
              <span class="w-2 h-2 rounded-full bg-cyan-400"></span> Sin Sedimentos
            </div>
            <div
              class="px-4 py-2 rounded-lg bg-white/5 border border-white/5 text-sm text-gray-300 flex items-center gap-2"
            >
              <span class="w-2 h-2 rounded-full bg-cyan-400"></span> Sin Larvas
            </div>
            <div
              class="px-4 py-2 rounded-lg bg-white/5 border border-white/5 text-sm text-gray-300 flex items-center gap-2"
            >
              <span class="w-2 h-2 rounded-full bg-cyan-400"></span> Agua Potable
            </div>
          </div>
        </div>

        <!-- Imagen -->
        <div class="relative group order-1 md:order-2">
          <div
            class="absolute -inset-1 bg-gradient-to-l from-cyan-500/30 to-blue-600/30 rounded-2xl blur-xl opacity-50 group-hover:opacity-75 transition-opacity duration-500"
          ></div>
          <div
            class="aspect-video bg-[#151515] border border-white/10 rounded-2xl p-2 relative z-10 overflow-hidden shadow-2xl"
          >
            <img
              src="/images/servicio-lavado-tanques.jpg"
              alt="Lavado de Tanques"
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
    <!-- PROCESO CERTIFICADO (Cards)             -->
    <!-- ======================================= -->
    <section class="relative z-10 py-24 bg-white/[0.02]" v-scroll-animation>
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="text-center mb-20">
          <h2 class="text-3xl md:text-4xl font-bold mb-4">Proceso Certificado</h2>
          <p class="text-lg text-gray-400 max-w-2xl mx-auto">
            Seguimos un protocolo estricto para garantizar seguridad y efectividad.
          </p>
        </div>

        <div class="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          <!-- Fase 1 -->
          <div
            class="group bg-[#151515] border border-white/5 rounded-2xl p-8 hover:border-cyan-500/30 hover:-translate-y-2 transition-all duration-300 relative overflow-hidden"
          >
            <div
              class="absolute top-0 right-0 p-4 opacity-10 font-black text-6xl text-cyan-500 group-hover:opacity-20 transition-opacity select-none"
            >
              1
            </div>
            <div
              class="w-12 h-12 rounded-full bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-500 font-bold text-lg mb-6 group-hover:bg-cyan-500 group-hover:text-black transition-colors"
            >
              1
            </div>
            <h3 class="text-xl font-bold text-white mb-3">Inspección</h3>
            <p class="text-gray-400 text-sm leading-relaxed">
              Evaluación del estado estructural del tanque (fisuras, tapas) y nivel de sedimentación
              para planificar la intervención.
            </p>
          </div>

          <!-- Fase 2 -->
          <div
            class="group bg-[#151515] border border-white/5 rounded-2xl p-8 hover:border-cyan-500/30 hover:-translate-y-2 transition-all duration-300 relative overflow-hidden"
          >
            <div
              class="absolute top-0 right-0 p-4 opacity-10 font-black text-6xl text-cyan-500 group-hover:opacity-20 transition-opacity select-none"
            >
              2
            </div>
            <div
              class="w-12 h-12 rounded-full bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-500 font-bold text-lg mb-6 group-hover:bg-cyan-500 group-hover:text-black transition-colors"
            >
              2
            </div>
            <h3 class="text-xl font-bold text-white mb-3">Vaciado y Limpieza</h3>
            <p class="text-gray-400 text-sm leading-relaxed">
              Vaciado controlado (cuidando bombas) y remoción manual exhaustiva de lodo y sedimentos
              adheridos a las paredes.
            </p>
          </div>

          <!-- Fase 3 -->
          <div
            class="group bg-[#151515] border border-white/5 rounded-2xl p-8 hover:border-cyan-500/30 hover:-translate-y-2 transition-all duration-300 relative overflow-hidden"
          >
            <div
              class="absolute top-0 right-0 p-4 opacity-10 font-black text-6xl text-cyan-500 group-hover:opacity-20 transition-opacity select-none"
            >
              3
            </div>
            <div
              class="w-12 h-12 rounded-full bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-500 font-bold text-lg mb-6 group-hover:bg-cyan-500 group-hover:text-black transition-colors"
            >
              3
            </div>
            <h3 class="text-xl font-bold text-white mb-3">Desinfección</h3>
            <p class="text-gray-400 text-sm leading-relaxed">
              Aplicación de desinfectantes de grado alimenticio certificados para eliminar patógenos
              sin dejar residuos tóxicos.
            </p>
          </div>

          <!-- Fase 4 -->
          <div
            class="group bg-[#151515] border border-white/5 rounded-2xl p-8 hover:border-cyan-500/30 hover:-translate-y-2 transition-all duration-300 relative overflow-hidden"
          >
            <div
              class="absolute top-0 right-0 p-4 opacity-10 font-black text-6xl text-cyan-500 group-hover:opacity-20 transition-opacity select-none"
            >
              4
            </div>
            <div
              class="w-12 h-12 rounded-full bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-500 font-bold text-lg mb-6 group-hover:bg-cyan-500 group-hover:text-black transition-colors"
            >
              4
            </div>
            <h3 class="text-xl font-bold text-white mb-3">Control Larvario</h3>
            <p class="text-gray-400 text-sm leading-relaxed">
              Aplicación de larvicidas seguros o barreras biológicas para prevenir el crecimiento
              futuro de mosquitos.
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
          ¿Quieres Garantizar la Calidad de tu Agua?
        </h2>
        <p class="text-gray-400 max-w-2xl mx-auto mb-10 text-lg">
          No pongas en riesgo tu salud. Agenda hoy mismo nuestro servicio profesional.
        </p>
        <div>
          <RouterLink
            to="/contacto"
            class="btn btn-primary shadow-[0_0_20px_rgba(225,29,72,0.4)] hover:shadow-[0_0_30px_rgba(225,29,72,0.6)] !py-4 !px-8 !text-lg"
          >
            Agendar Lavado de Tanque
          </RouterLink>
        </div>
      </div>
    </section>
  </div>
</template>
