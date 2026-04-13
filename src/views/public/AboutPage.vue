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
        class="absolute top-[-10%] left-[20%] w-[500px] h-[500px] bg-brand-red/5 rounded-full blur-[120px]"
      ></div>
      <div
        class="absolute bottom-[10%] left-[-10%] w-[600px] h-[600px] bg-gray-800/20 rounded-full blur-[100px]"
      ></div>
    </div>

    <!-- ======================================= -->
    <!-- ENCABEZADO (Hero)                       -->
    <!-- ======================================= -->
    <section class="relative z-10 py-24 md:py-32 text-center px-4" v-scroll-animation>
      <div class="max-w-4xl mx-auto">
        <span
          class="inline-block py-1 px-3 mb-6 rounded-full bg-white/5 border border-white/10 text-gray-300 text-xs md:text-sm font-bold tracking-[0.2em] backdrop-blur-md uppercase"
        >
          Nuestra Esencia
        </span>

        <h1 class="text-5xl md:text-7xl font-extrabold tracking-tight mb-8 leading-tight">
          Más que Control de Plagas, <br class="hidden md:block" />
          <span
            class="text-transparent bg-clip-text bg-gradient-to-r from-white via-gray-200 to-gray-500"
          >
            Somos Aliados
          </span>
        </h1>

        <p
          class="mt-6 text-lg md:text-xl text-gray-400 leading-relaxed max-w-2xl mx-auto font-light"
        >
          Conoce la historia, el compromiso y la visión que nos han convertido en líderes del sector
          en el Valle del Cauca y más allá.
        </p>
      </div>
    </section>

    <!-- ======================================= -->
    <!-- NUESTRA HISTORIA                        -->
    <!-- ======================================= -->
    <section class="relative z-10 py-16 md:py-24" v-scroll-animation>
      <div
        class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid md:grid-cols-2 gap-16 lg:gap-24 items-center"
      >
        <div class="space-y-8 order-2 md:order-1">
          <div>
            <h2 class="text-3xl md:text-5xl font-bold text-white mb-6">
              Nuestra <span class="text-brand-red">Historia</span>
            </h2>
            <div class="h-1 w-20 bg-white/10 rounded-full"></div>
          </div>

          <div class="space-y-6 text-gray-400 text-lg leading-relaxed font-light">
            <p>
              Fundada en Cali con la visión de crear entornos más seguros y saludables,
              <strong class="text-white">Control Total & P.H. S.A.S</strong> nació de la pasión por
              la excelencia y el servicio. Desde nuestros inicios, nos hemos dedicado a innovar en
              el manejo integral de plagas, combinando tecnología de punta con un profundo respeto
              por el medio ambiente.
            </p>
            <p>
              A lo largo de los años, hemos crecido hasta convertirnos en un referente, protegiendo
              hogares, empresas e industrias con soluciones efectivas y personalizadas, siempre
              manteniendo nuestro compromiso ético y profesional.
            </p>
          </div>

          <div class="grid grid-cols-3 gap-8 pt-6 border-t border-white/10">
            <div>
              <div class="text-3xl font-bold text-white">+10</div>
              <div class="text-xs text-brand-red uppercase tracking-wider">Años Exp.</div>
            </div>
            <div>
              <div class="text-3xl font-bold text-white">+500</div>
              <div class="text-xs text-brand-red uppercase tracking-wider">Clientes</div>
            </div>
            <div>
              <div class="text-3xl font-bold text-white">100%</div>
              <div class="text-xs text-brand-red uppercase tracking-wider">Certificado</div>
            </div>
          </div>
        </div>

        <div class="relative group order-1 md:order-2">
          <div
            class="absolute -inset-1 bg-gradient-to-tr from-brand-red/20 to-gray-500/20 rounded-2xl blur-xl opacity-50 group-hover:opacity-75 transition-opacity duration-500"
          ></div>
          <div
            class="aspect-[4/5] md:aspect-square bg-[#151515] border border-white/10 rounded-2xl p-2 relative z-10 overflow-hidden shadow-2xl rotate-1 group-hover:rotate-0 transition-transform duration-500"
          >
            <div
              class="w-full h-full bg-brand-black/50 rounded-xl flex flex-col items-center justify-center border border-white/5 relative overflow-hidden group-hover:bg-brand-black/30 transition-colors"
            >
              <div
                class="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"
              ></div>
              <div class="text-center p-8 relative z-10">
                <div
                  class="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6 backdrop-blur-sm border border-white/10"
                >
                  <i class="fas fa-building text-4xl text-brand-red"></i>
                </div>
                <h3 class="text-xl font-bold text-white mb-2">Presencia Regional</h3>
                <p class="text-gray-500 text-sm">Cali - Yumbo - Cúcuta</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ======================================= -->
    <!-- NUESTRAS SEDES                          -->
    <!-- ======================================= -->
    <section class="relative z-10 py-16 md:py-24 bg-white/[0.02]" v-scroll-animation>
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="text-center mb-16">
          <h2 class="text-3xl md:text-5xl font-bold text-white mb-6">
            Nuestra <span class="text-brand-red">Cobertura</span>
          </h2>
          <p class="text-gray-400 max-w-2xl mx-auto text-lg font-light">
            Expandimos nuestra excelencia operativa a puntos estratégicos para estar más cerca de ti
            y brindarte el mejor servicio.
          </p>
        </div>

        <div class="grid md:grid-cols-3 gap-8">
          <div
            class="group bg-[#151515] border border-white/5 rounded-2xl p-8 hover:border-brand-red/30 transition-all duration-300 relative overflow-hidden text-center hover:-translate-y-2 shadow-lg"
          >
            <div
              class="w-16 h-16 mx-auto bg-brand-red/10 rounded-full flex items-center justify-center text-brand-red mb-6 group-hover:bg-brand-red group-hover:text-white transition-colors duration-300"
            >
              <i class="fas fa-map-marker-alt text-2xl"></i>
            </div>
            <h3 class="text-2xl font-bold text-white mb-2">Cali</h3>
            <p class="text-brand-red text-xs font-bold tracking-widest uppercase mb-4">
              Sede Principal
            </p>
            <p class="text-gray-400 text-sm leading-relaxed">
              Nuestro centro de operaciones principal, atendiendo toda el área metropolitana con
              respuesta inmediata.
            </p>
          </div>
          <div
            class="group bg-[#151515] border border-white/5 rounded-2xl p-8 hover:border-brand-red/30 transition-all duration-300 relative overflow-hidden text-center hover:-translate-y-2 shadow-lg"
          >
            <div
              class="w-16 h-16 mx-auto bg-brand-red/10 rounded-full flex items-center justify-center text-brand-red mb-6 group-hover:bg-brand-red group-hover:text-white transition-colors duration-300"
            >
              <i class="fas fa-industry text-2xl"></i>
            </div>
            <h3 class="text-2xl font-bold text-white mb-2">Yumbo</h3>
            <p class="text-brand-red text-xs font-bold tracking-widest uppercase mb-4">
              Zona Industrial
            </p>
            <p class="text-gray-400 text-sm leading-relaxed">
              Especializados en el sector industrial y empresarial, garantizando cumplimiento
              normativo y seguridad.
            </p>
          </div>
          <div
            class="group bg-[#151515] border border-white/5 rounded-2xl p-8 hover:border-brand-red/30 transition-all duration-300 relative overflow-hidden text-center hover:-translate-y-2 shadow-lg"
          >
            <div
              class="w-16 h-16 mx-auto bg-brand-red/10 rounded-full flex items-center justify-center text-brand-red mb-6 group-hover:bg-brand-red group-hover:text-white transition-colors duration-300"
            >
              <i class="fas fa-globe-americas text-2xl"></i>
            </div>
            <h3 class="text-2xl font-bold text-white mb-2">Cúcuta</h3>
            <p class="text-brand-red text-xs font-bold tracking-widest uppercase mb-4">
              Norte de Santander
            </p>
            <p class="text-gray-400 text-sm leading-relaxed">
              Nuestra sede estratégica en la frontera, llevando calidad y control certificado a
              nuevos territorios.
            </p>
          </div>
        </div>
      </div>
    </section>

    <!-- ======================================= -->
    <!-- MISIÓN Y VISIÓN                         -->
    <!-- ======================================= -->
    <section class="relative z-10 py-24" v-scroll-animation>
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="grid md:grid-cols-2 gap-8 lg:gap-12">
          <div
            class="group bg-[#151515] border border-white/5 rounded-3xl p-10 hover:border-brand-red/30 transition-all duration-500 hover:-translate-y-2 relative overflow-hidden"
          >
            <div
              class="absolute -right-10 -bottom-10 text-white/5 opacity-50 group-hover:opacity-100 transition-opacity duration-500"
            >
              <i class="fas fa-bolt text-[12rem]"></i>
            </div>
            <div class="relative z-10">
              <div
                class="w-14 h-14 rounded-xl bg-brand-red/10 flex items-center justify-center text-brand-red mb-6"
              >
                <i class="fas fa-bolt text-2xl"></i>
              </div>
              <h3 class="text-3xl font-bold text-white mb-4">Misión</h3>
              <p class="text-gray-400 leading-relaxed text-lg">
                Garantizar entornos saludables y seguros para nuestros clientes, empleando métodos
                innovadores y sostenibles que cumplan con los más altos estándares de calidad y
                responsabilidad ambiental.
              </p>
            </div>
          </div>
          <div
            class="group bg-[#151515] border border-white/5 rounded-3xl p-10 hover:border-brand-red/30 transition-all duration-500 hover:-translate-y-2 relative overflow-hidden"
          >
            <div
              class="absolute -right-10 -bottom-10 text-white/5 opacity-50 group-hover:opacity-100 transition-opacity duration-500"
            >
              <i class="fas fa-eye text-[12rem]"></i>
            </div>
            <div class="relative z-10">
              <div
                class="w-14 h-14 rounded-xl bg-brand-red/10 flex items-center justify-center text-brand-red mb-6"
              >
                <i class="fas fa-eye text-2xl"></i>
              </div>
              <h3 class="text-3xl font-bold text-white mb-4">Visión</h3>
              <p class="text-gray-400 leading-relaxed text-lg">
                Ser la empresa líder y de mayor confianza en el manejo integral de plagas y
                saneamiento ambiental en Colombia, reconocida por nuestra excelencia, innovación y
                compromiso con el bienestar.
              </p>
            </div>
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
          ¿Listo para proteger tu espacio?
        </h2>
        <p class="text-gray-400 max-w-2xl mx-auto mb-10 text-lg">
          Nuestro equipo de expertos está listo para brindarte una asesoría personalizada.
        </p>
        <div>
          <RouterLink
            to="/contacto"
            class="btn btn-primary shadow-[0_0_20px_rgba(225,29,72,0.4)] hover:shadow-[0_0_30px_rgba(225,29,72,0.6)] !py-4 !px-8 !text-lg"
          >
            Contáctanos Ahora
          </RouterLink>
        </div>
      </div>
    </section>
  </div>
</template>
