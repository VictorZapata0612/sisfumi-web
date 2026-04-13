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
        class="absolute top-[-10%] left-[-5%] w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[120px]"
      ></div>
      <div
        class="absolute bottom-[20%] right-[-10%] w-[400px] h-[400px] bg-cyan-500/5 rounded-full blur-[100px]"
      ></div>
    </div>

    <!-- ======================================= -->
    <!-- ENCABEZADO DEL SERVICIO (Hero)          -->
    <!-- ======================================= -->
    <section class="relative z-10 py-24 md:py-32 text-center px-4" v-scroll-animation>
      <div class="max-w-5xl mx-auto">
        <span
          class="inline-block py-1 px-3 mb-6 rounded-full bg-white/5 border border-white/10 text-blue-400 text-xs md:text-sm font-bold tracking-[0.2em] backdrop-blur-md uppercase"
        >
          Bioseguridad
        </span>

        <h1 class="text-5xl md:text-7xl font-extrabold tracking-tight mb-8 leading-tight">
          Servicio de <br class="hidden md:block" />
          <span class="text-transparent bg-clip-text bg-gradient-to-r from-white to-blue-300">
            Desinfección de Ambientes
          </span>
        </h1>

        <p
          class="mt-6 text-lg md:text-xl text-gray-400 leading-relaxed max-w-3xl mx-auto font-light"
        >
          Creamos entornos seguros y saludables eliminando
          <span class="text-white font-medium">virus, bacterias y hongos</span> de tus espacios con
          tecnología certificada.
        </p>
      </div>
    </section>

    <!-- ======================================= -->
    <!-- IMPORTANCIA (Riesgos y Soluciones)      -->
    <!-- ======================================= -->
    <section class="relative z-10 py-16 md:py-24" v-scroll-animation>
      <div
        class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid md:grid-cols-2 gap-12 lg:gap-20 items-center"
      >
        <!-- Contenido de Texto -->
        <div class="space-y-8 order-2 md:order-1">
          <div>
            <h2 class="text-3xl md:text-5xl font-bold text-white mb-6">
              Protege tu Salud: <br /><span class="text-blue-400">Libre de Patógenos</span>
            </h2>
            <div class="h-1 w-20 bg-white/10 rounded-full"></div>
          </div>

          <div class="space-y-6 text-gray-400 text-lg leading-relaxed font-light">
            <p>
              La desinfección profesional es crucial para prevenir la propagación de enfermedades y
              mantener la higiene en hogares, oficinas y comercios. Los microorganismos patógenos
              pueden persistir en superficies y en el aire, representando un
              <strong class="text-gray-200">riesgo invisible y constante</strong>.
            </p>
            <p>
              En Control Total, utilizamos técnicas avanzadas y productos de amplio espectro para
              garantizar una eliminación efectiva, creando un ambiente verdaderamente limpio y
              seguro para ti y los tuyos.
            </p>
          </div>

          <div class="flex flex-wrap gap-4 pt-4">
            <div
              class="px-4 py-2 rounded-lg bg-white/5 border border-white/5 text-sm text-gray-300 flex items-center gap-2"
            >
              <i class="fas fa-check-circle text-blue-400"></i>
              <span>Virus y Bacterias</span>
            </div>
            <div
              class="px-4 py-2 rounded-lg bg-white/5 border border-white/5 text-sm text-gray-300 flex items-center gap-2"
            >
              <i class="fas fa-check-circle text-blue-400"></i>
              <span>Hongos y Esporas</span>
            </div>
          </div>
        </div>

        <!-- Imagen -->
        <div class="relative group order-1 md:order-2">
          <div
            class="absolute -inset-1 bg-gradient-to-l from-blue-500/20 to-cyan-400/20 rounded-2xl blur-xl opacity-50 group-hover:opacity-75 transition-opacity duration-500"
          ></div>
          <div
            class="aspect-video bg-[#151515] border border-white/10 rounded-2xl p-2 relative z-10 overflow-hidden shadow-2xl"
          >
            <img
              src="/images/servicio-desinfeccion.jpg"
              alt="Desinfección de Ambientes"
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
    <!-- PROCESO DE DESINFECCIÓN (Cards)         -->
    <!-- ======================================= -->
    <section class="relative z-10 py-24 bg-white/[0.02]" v-scroll-animation>
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="text-center mb-20">
          <h2 class="text-3xl md:text-4xl font-bold mb-4">Nuestro Proceso de Desinfección</h2>
          <p class="text-lg text-gray-400 max-w-2xl mx-auto">
            Un enfoque riguroso para la máxima eficacia y seguridad en cada intervención.
          </p>
        </div>

        <div class="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          <!-- Fase 1 -->
          <div
            class="group bg-[#151515] border border-white/5 rounded-2xl p-8 hover:border-blue-500/30 hover:-translate-y-2 transition-all duration-300 relative overflow-hidden"
          >
            <div
              class="absolute top-0 right-0 p-4 opacity-10 font-black text-6xl text-blue-500 group-hover:opacity-20 transition-opacity select-none"
            >
              1
            </div>
            <div
              class="w-12 h-12 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-500 font-bold text-lg mb-6 group-hover:bg-blue-500 group-hover:text-white transition-colors"
            >
              1
            </div>
            <h3 class="text-xl font-bold text-white mb-3">Evaluación</h3>
            <p class="text-gray-400 text-sm leading-relaxed">
              Identificamos las áreas críticas, superficies de alto contacto y el tipo de patógenos
              a tratar para diseñar un plan a medida.
            </p>
          </div>
          <!-- Fase 2 -->
          <div
            class="group bg-[#151515] border border-white/5 rounded-2xl p-8 hover:border-blue-500/30 hover:-translate-y-2 transition-all duration-300 relative overflow-hidden"
          >
            <div
              class="absolute top-0 right-0 p-4 opacity-10 font-black text-6xl text-blue-500 group-hover:opacity-20 transition-opacity select-none"
            >
              2
            </div>
            <div
              class="w-12 h-12 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-500 font-bold text-lg mb-6 group-hover:bg-blue-500 group-hover:text-white transition-colors"
            >
              2
            </div>
            <h3 class="text-xl font-bold text-white mb-3">Preparación</h3>
            <p class="text-gray-400 text-sm leading-relaxed">
              Acondicionamos el espacio para proteger equipos sensibles y seleccionamos los
              desinfectantes de grado hospitalario más seguros.
            </p>
          </div>
          <!-- Fase 3 -->
          <div
            class="group bg-[#151515] border border-white/5 rounded-2xl p-8 hover:border-blue-500/30 hover:-translate-y-2 transition-all duration-300 relative overflow-hidden"
          >
            <div
              class="absolute top-0 right-0 p-4 opacity-10 font-black text-6xl text-blue-500 group-hover:opacity-20 transition-opacity select-none"
            >
              3
            </div>
            <div
              class="w-12 h-12 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-500 font-bold text-lg mb-6 group-hover:bg-blue-500 group-hover:text-white transition-colors"
            >
              3
            </div>
            <h3 class="text-xl font-bold text-white mb-3">Aplicación</h3>
            <p class="text-gray-400 text-sm leading-relaxed">
              Utilizamos nebulización ULV (Ultra Low Volume) y técnicas de micro-aspersión para una
              cobertura total, alcanzando zonas de difícil acceso.
            </p>
          </div>
          <!-- Fase 4 -->
          <div
            class="group bg-[#151515] border border-white/5 rounded-2xl p-8 hover:border-blue-500/30 hover:-translate-y-2 transition-all duration-300 relative overflow-hidden"
          >
            <div
              class="absolute top-0 right-0 p-4 opacity-10 font-black text-6xl text-blue-500 group-hover:opacity-20 transition-opacity select-none"
            >
              4
            </div>
            <div
              class="w-12 h-12 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-500 font-bold text-lg mb-6 group-hover:bg-blue-500 group-hover:text-white transition-colors"
            >
              4
            </div>
            <h3 class="text-xl font-bold text-white mb-3">Certificación</h3>
            <p class="text-gray-400 text-sm leading-relaxed">
              Verificamos los resultados, aseguramos la eliminación de patógenos y emitimos un
              certificado oficial de ambiente desinfectado.
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
          ¿Necesitas un Ambiente Libre de Patógenos?
        </h2>
        <p class="text-gray-400 max-w-2xl mx-auto mb-10 text-lg">
          Garantiza la salud y seguridad en tu hogar o negocio con nuestro servicio de desinfección
          profesional.
        </p>
        <div>
          <RouterLink
            to="/contacto"
            class="btn btn-primary shadow-[0_0_20px_rgba(59,130,246,0.4)] hover:shadow-[0_0_30px_rgba(59,130,246,0.6)] !py-4 !px-8 !text-lg"
          >
            Solicitar Servicio de Desinfección
          </RouterLink>
        </div>
      </div>
    </section>
  </div>
</template>
