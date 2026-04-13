<script setup lang="ts">
import { RouterLink } from 'vue-router'
</script>

<template>
  <div
    class="bg-[#0a0a0a] text-white min-h-screen font-sans relative selection:bg-brand-red selection:text-white overflow-hidden"
  >
    <!-- FONDO DECORATIVO GLOBAL (Coherente con el Home) -->
    <div class="fixed inset-0 pointer-events-none z-0">
      <div
        class="absolute top-[10%] right-[0%] w-[600px] h-[600px] bg-brand-red/5 rounded-full blur-[120px]"
      ></div>
      <div
        class="absolute bottom-[0%] left-[-10%] w-[500px] h-[500px] bg-blue-900/5 rounded-full blur-[100px]"
      ></div>
    </div>

    <!-- ======================================= -->
    <!-- ENCABEZADO DE PÁGINA                    -->
    <!-- ======================================= -->
    <section class="relative z-10 py-24 md:py-32 text-center px-4" v-scroll-animation>
      <div class="max-w-4xl mx-auto">
        <span
          class="inline-block py-1 px-3 mb-6 rounded-full bg-white/5 border border-white/10 text-brand-red text-xs md:text-sm font-bold tracking-[0.2em] backdrop-blur-md"
        >
          SOLUCIONES INTEGRALES
        </span>
        <h1 class="text-5xl md:text-7xl font-extrabold tracking-tight mb-6">
          Nuestros
          <span class="text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400"
            >Servicios</span
          >
        </h1>
        <p class="text-lg md:text-xl text-gray-400 leading-relaxed max-w-2xl mx-auto font-light">
          Ofrecemos soluciones especializadas y
          <span class="text-white font-medium">certificadas</span> para garantizar la seguridad y el
          bienestar en tus espacios.
        </p>
      </div>
    </section>

    <!-- ======================================= -->
    <!-- CONTENEDOR PRINCIPAL DE SERVICIOS       -->
    <!-- ======================================= -->
    <div
      class="relative z-10 py-10 md:py-20 space-y-24 md:space-y-32 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto"
    >
      <!-- SERVICIO 1: Manejo Integral de Plagas -->
      <section class="grid md:grid-cols-2 gap-12 lg:gap-16 items-center group" v-scroll-animation>
        <div class="relative md:order-2">
          <div
            class="absolute -inset-4 bg-gradient-to-r from-brand-red/20 to-purple-500/20 rounded-2xl blur-2xl opacity-40 group-hover:opacity-60 transition-opacity duration-500 -z-10"
          ></div>
          <div
            class="aspect-video bg-[#151515] border border-white/10 rounded-2xl p-2 shadow-2xl overflow-hidden relative"
          >
            <img
              src="/images/servicio-manejo-plagas.jpg"
              alt="Manejo de plagas"
              class="w-full h-full object-cover rounded-xl transition-transform duration-700 group-hover:scale-105"
            />
            <div
              class="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-60 rounded-xl pointer-events-none"
            ></div>
          </div>
        </div>
        <div class="space-y-6 md:order-1">
          <div class="flex items-center gap-4 mb-2">
            <div class="h-px w-12 bg-brand-red"></div>
            <span class="text-brand-red font-bold tracking-widest text-sm uppercase"
              >Control Preventivo</span
            >
          </div>
          <h2 class="text-3xl md:text-5xl font-bold text-white leading-tight">
            Manejo Integral <br />
            de Plagas
          </h2>
          <p class="text-gray-400 leading-relaxed text-lg font-light">
            Estrategia sostenible que combina métodos preventivos, culturales, químicos y
            biológicos. Minimizamos riesgos para la salud humana y el medio ambiente mientras
            controlamos eficazmente cualquier amenaza.
          </p>
          <div class="pt-4">
            <RouterLink
              to="/servicios/manejo-integral-de-plagas"
              class="btn-public-secondary hover:border-brand-red !px-6 !py-2.5 !text-sm"
            >
              Ver más detalles
            </RouterLink>
          </div>
        </div>
      </section>

      <!-- SERVICIO 2: Desratización -->
      <section class="grid md:grid-cols-2 gap-12 lg:gap-16 items-center group" v-scroll-animation>
        <div class="relative md:order-1">
          <div
            class="absolute -inset-4 bg-gradient-to-l from-brand-red/20 to-blue-500/20 rounded-2xl blur-2xl opacity-40 group-hover:opacity-60 transition-opacity duration-500 -z-10"
          ></div>
          <div
            class="aspect-video bg-[#151515] border border-white/10 rounded-2xl p-2 shadow-2xl overflow-hidden relative"
          >
            <img
              src="/images/servicio-desratizacion.jpg"
              alt="Desratización"
              class="w-full h-full object-cover rounded-xl transition-transform duration-700 group-hover:scale-105"
            />
            <div
              class="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-60 rounded-xl pointer-events-none"
            ></div>
          </div>
        </div>
        <div class="space-y-6 md:order-2">
          <div class="flex items-center gap-4 mb-2">
            <div class="h-px w-12 bg-brand-red"></div>
            <span class="text-brand-red font-bold tracking-widest text-sm uppercase"
              >Saneamiento</span
            >
          </div>
          <h2 class="text-3xl md:text-5xl font-bold text-white leading-tight">
            Desratización <br />
            Profesional
          </h2>
          <p class="text-gray-400 leading-relaxed text-lg font-light">
            Técnicas avanzadas para eliminar roedores en ambientes urbanos e industriales.
            Garantizamos un entorno limpio y seguro, protegiendo tus instalaciones de daños y
            enfermedades.
          </p>
          <div class="pt-4">
            <RouterLink
              to="/servicios/desratizacion"
              class="btn-public-secondary hover:border-brand-red !px-6 !py-2.5 !text-sm"
            >
              Ver más detalles
            </RouterLink>
          </div>
        </div>
      </section>

      <!-- SERVICIO 3: Desinfección de Ambientes -->
      <section class="grid md:grid-cols-2 gap-12 lg:gap-16 items-center group" v-scroll-animation>
        <div class="relative md:order-2">
          <div
            class="absolute -inset-4 bg-gradient-to-r from-blue-500/20 to-brand-red/20 rounded-2xl blur-2xl opacity-40 group-hover:opacity-60 transition-opacity duration-500 -z-10"
          ></div>
          <div
            class="aspect-video bg-[#151515] border border-white/10 rounded-2xl p-2 shadow-2xl overflow-hidden relative"
          >
            <img
              src="/images/servicio-desinfeccion.jpg"
              alt="Desinfección"
              class="w-full h-full object-cover rounded-xl transition-transform duration-700 group-hover:scale-105"
            />
            <div
              class="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-60 rounded-xl pointer-events-none"
            ></div>
          </div>
        </div>
        <div class="space-y-6 md:order-1">
          <div class="flex items-center gap-4 mb-2">
            <div class="h-px w-12 bg-brand-red"></div>
            <span class="text-brand-red font-bold tracking-widest text-sm uppercase"
              >Bioseguridad</span
            >
          </div>
          <h2 class="text-3xl md:text-5xl font-bold text-white leading-tight">
            Desinfección de <br />
            Ambientes
          </h2>
          <p class="text-gray-400 leading-relaxed text-lg font-light">
            Eliminación certificada de virus, bacterias y hongos. Creamos espacios bioseguros
            utilizando tecnología de nebulización ULV que no daña superficies ni equipos.
          </p>
          <div class="pt-4">
            <RouterLink
              to="/servicios/desinfeccion"
              class="btn-public-secondary hover:border-brand-red !px-6 !py-2.5 !text-sm"
            >
              Ver más detalles
            </RouterLink>
          </div>
        </div>
      </section>

      <!-- SERVICIO 4: Lavado de Tanques -->
      <section class="grid md:grid-cols-2 gap-12 lg:gap-16 items-center group" v-scroll-animation>
        <div class="relative md:order-1">
          <div
            class="absolute -inset-4 bg-gradient-to-l from-brand-red/20 to-teal-500/20 rounded-2xl blur-2xl opacity-40 group-hover:opacity-60 transition-opacity duration-500 -z-10"
          ></div>
          <div
            class="aspect-video bg-[#151515] border border-white/10 rounded-2xl p-2 shadow-2xl overflow-hidden relative"
          >
            <img
              src="/images/servicio-lavado-tanques.jpg"
              alt="Lavado de tanques"
              class="w-full h-full object-cover rounded-xl transition-transform duration-700 group-hover:scale-105"
            />
            <div
              class="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-60 rounded-xl pointer-events-none"
            ></div>
          </div>
        </div>
        <div class="space-y-6 md:order-2">
          <div class="flex items-center gap-4 mb-2">
            <div class="h-px w-12 bg-brand-red"></div>
            <span class="text-brand-red font-bold tracking-widest text-sm uppercase"
              >Agua Potable</span
            >
          </div>
          <h2 class="text-3xl md:text-5xl font-bold text-white leading-tight">
            Lavado de Tanques y <br />
            Control de Larvas
          </h2>
          <p class="text-gray-400 leading-relaxed text-lg font-light">
            Garantizamos la calidad de tu agua potable. Realizamos limpieza profunda y desinfección
            para prevenir la proliferación de larvas y microorganismos dañinos.
          </p>
          <div class="pt-4">
            <RouterLink
              to="/servicios/lavado-de-tanques"
              class="btn-public-secondary hover:border-brand-red !px-6 !py-2.5 !text-sm"
            >
              Ver más detalles
            </RouterLink>
          </div>
        </div>
      </section>
    </div>

    <!-- ======================================= -->
    <!-- CTA FINAL                               -->
    <!-- ======================================= -->
    <section class="relative z-10 py-24 border-t border-white/5 bg-[#0a0a0a]">
      <div class="max-w-4xl mx-auto px-4 text-center">
        <h2 class="text-3xl md:text-4xl font-bold text-white mb-6">
          ¿Listo para un ambiente más seguro?
        </h2>
        <p class="text-gray-400 max-w-2xl mx-auto mb-10 text-lg">
          Contáctanos hoy mismo. Nuestro equipo de expertos está listo para brindarte una asesoría
          personalizada.
        </p>
        <div>
          <a
            href="https://wa.me/573208722195?text=Hola,%20quisiera%20una%20cotizaci%C3%B3n%20para%20sus%20servicios."
            target="_blank"
            class="btn btn-primary shadow-[0_0_20px_rgba(225,29,72,0.4)] hover:shadow-[0_0_30px_rgba(225,29,72,0.6)] !py-4 !px-8 !text-lg"
          >
            Solicitar Cotización
          </a>
        </div>
      </div>
    </section>
  </div>
</template>
