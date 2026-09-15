<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { RouterLink } from 'vue-router'

const lastUpdated = '8 de Septiembre de 2026'

const companyInfo = {
  name: 'Control Total & P. H.',
  nit: 'NIT 900.000.000-0',
  email: 'gerencia@gerenciatotal.co',
  phone: '+57 320 872 2195',
  address: 'Cra. 80 #11 A-51, Local P-329, Cali, Valle del Cauca, Colombia',
  website: 'https://controltotalyph.com',
}

const showBackToTop = ref(false)

const handleScroll = () => {
  showBackToTop.value = window.scrollY > 300
}

const scrollToTop = () => {
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

onMounted(() => {
  document.title = 'Política de Privacidad | Control Total & P. H.'
  window.scrollTo(0, 0)
  window.addEventListener('scroll', handleScroll)
  return () => window.removeEventListener('scroll', handleScroll)
})
</script>

<template>
  <div class="bg-[#0a0a0a] text-gray-200 min-h-screen font-sans selection:bg-brand-red selection:text-white relative">
    <!-- BOTÓN VOLVER ARRIBA -->
    <transition name="fade">
      <button
        v-if="showBackToTop"
        @click="scrollToTop"
        class="fixed bottom-8 right-6 z-50 w-12 h-12 rounded-full bg-brand-red/80 backdrop-blur-sm text-white flex items-center justify-center shadow-lg hover:bg-brand-red transition-all transform hover:-translate-y-1"
        aria-label="Volver arriba"
      >
        <i class="fas fa-arrow-up"></i>
      </button>
    </transition>

    <!-- HEADER / HERO -->
    <header class="relative py-16 md:py-24 border-b border-white/10 bg-gradient-to-b from-black via-[#111] to-[#0a0a0a] overflow-hidden">
      <div class="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-brand-red/10 rounded-full blur-[120px] pointer-events-none"></div>

      <div class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
        <RouterLink
          to="/"
          class="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-brand-red mb-6 transition-colors"
        >
          <i class="fas fa-arrow-left"></i> Volver al Inicio
        </RouterLink>

        <h1 class="text-4xl md:text-6xl font-extrabold text-white tracking-tight mb-4">
          Política de <span class="text-transparent bg-clip-text bg-gradient-to-r from-[#d60000] to-[#ef4444]">Privacidad</span>
        </h1>
        <p class="text-gray-400 text-sm md:text-base max-w-2xl mx-auto">
          Tratamiento, Protección de Datos Personales y Cumplimiento de la Ley 1581 de 2012 (Habeas Data)
        </p>
        <div class="mt-4 text-xs text-gray-500">
          Última actualización: {{ lastUpdated }}
        </div>
      </div>
    </header>

    <!-- CONTENIDO PRINCIPAL -->
    <main class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-12">
      <!-- 1. IDENTIFICACIÓN -->
      <section class="bg-[#151515] border border-white/10 rounded-2xl p-6 md:p-8 shadow-xl">
        <h2 class="text-2xl font-bold text-white mb-4 flex items-center gap-3">
          <i class="fas fa-building text-brand-red"></i>
          1. Identificación del Responsable del Tratamiento
        </h2>
        <p class="text-gray-300 text-sm md:text-base leading-relaxed mb-6">
          En cumplimiento de la Ley Estatutaria 1581 de 2012 de Colombia, su Decreto Reglamentario 1377 de 2013 y demás normas concordantes, la sociedad <strong class="text-white">{{ companyInfo.name }}</strong> informa a los usuarios, clientes, proveedores y colaboradores la presente política institucional para el tratamiento y protección de sus datos personales.
        </p>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm bg-black/40 p-4 rounded-xl border border-white/5">
          <div>
            <span class="text-gray-500 block text-xs font-semibold uppercase">Razón Social</span>
            <span class="text-white font-medium">{{ companyInfo.name }}</span>
          </div>
          <div>
            <span class="text-gray-500 block text-xs font-semibold uppercase">Dirección Física</span>
            <span class="text-white font-medium">{{ companyInfo.address }}</span>
          </div>
          <div>
            <span class="text-gray-500 block text-xs font-semibold uppercase">Correo Electrónico Oficial</span>
            <a :href="`mailto:${companyInfo.email}`" class="text-brand-red hover:underline font-medium">{{ companyInfo.email }}</a>
          </div>
          <div>
            <span class="text-gray-500 block text-xs font-semibold uppercase">Línea Telefónica</span>
            <span class="text-white font-medium">{{ companyInfo.phone }}</span>
          </div>
        </div>
      </section>

      <!-- 2. MARCO LEGAL -->
      <section class="space-y-4">
        <h2 class="text-2xl font-bold text-white flex items-center gap-3">
          <i class="fas fa-gavel text-brand-red"></i>
          2. Marco Legal y Alcance
        </h2>
        <p class="text-gray-300 text-sm md:text-base leading-relaxed">
          Esta Política se aplica a toda la información personal recopilada a través del sitio web <a :href="companyInfo.website" target="_blank" class="text-brand-red hover:underline">{{ companyInfo.website }}</a>, formularios de contacto, cotizaciones de fumigación y manejo integral de plagas (MIP), aplicaciones cliente, registros de inspección, comunicaciones por WhatsApp o correo electrónico, y contratos de prestación de servicios.
        </p>
      </section>

      <!-- 3. DATOS QUE RECOLECTAMOS -->
      <section class="space-y-4">
        <h2 class="text-2xl font-bold text-white flex items-center gap-3">
          <i class="fas fa-database text-brand-red"></i>
          3. Datos Personales que Recolectamos
        </h2>
        <p class="text-gray-300 text-sm md:text-base leading-relaxed">
          Dependiendo de la interacción del usuario con nuestro portal o servicios, podemos solicitar y almacenar los siguientes datos:
        </p>
        <ul class="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <li class="bg-[#151515] p-3 rounded-lg border border-white/5 flex items-start gap-2">
            <i class="fas fa-check text-green-500 mt-1"></i>
            <span><strong>Datos Identificativos:</strong> Nombre, apellidos, número de identificación (C.C./NIT).</span>
          </li>
          <li class="bg-[#151515] p-3 rounded-lg border border-white/5 flex items-start gap-2">
            <i class="fas fa-check text-green-500 mt-1"></i>
            <span><strong>Datos de Contacto:</strong> Correo electrónico, teléfono móvil, dirección física de la propiedad o sede.</span>
          </li>
          <li class="bg-[#151515] p-3 rounded-lg border border-white/5 flex items-start gap-2">
            <i class="fas fa-check text-green-500 mt-1"></i>
            <span><strong>Datos del Servicio:</strong> Historial de visitas técnicas, tipo de inmueble, plagas a controlar e inspecciones sanitarias.</span>
          </li>
          <li class="bg-[#151515] p-3 rounded-lg border border-white/5 flex items-start gap-2">
            <i class="fas fa-check text-green-500 mt-1"></i>
            <span><strong>Datos Técnicos/Navegación:</strong> Dirección IP, tipo de dispositivo, cookies y estadísticas de uso web.</span>
          </li>
        </ul>
      </section>

      <!-- 4. FINALIDAD -->
      <section class="space-y-4">
        <h2 class="text-2xl font-bold text-white flex items-center gap-3">
          <i class="fas fa-bullseye text-brand-red"></i>
          4. Finalidad del Tratamiento de los Datos
        </h2>
        <div class="space-y-3 text-sm text-gray-300">
          <div class="bg-[#151515] p-4 rounded-xl border border-white/5">
            <strong class="text-white block mb-1">A. Prestación y Programación de Servicios:</strong>
            Agendar inspecciones, visitas técnicas de fumigación, asignación de técnicos fumigadores, emisión de certificados de control de plagas y soporte técnico.
          </div>
          <div class="bg-[#151515] p-4 rounded-xl border border-white/5">
            <strong class="text-white block mb-1">B. Gestión Comercial y Facturación:</strong>
            Envío de cotizaciones, cobranza, facturación electrónica y comunicación de vencimientos o renovaciones de certificados de saneamiento.
          </div>
          <div class="bg-[#151515] p-4 rounded-xl border border-white/5">
            <strong class="text-white block mb-1">C. Cumplimiento Normativo:</strong>
            Reportes exigidos por autoridades sanitarias (Secretaría de Salud de Cali y del Valle del Cauca), auditorías de inocuidad y archivo contable.
          </div>
        </div>
      </section>

      <!-- 5. DERECHOS ARCO -->
      <section class="bg-[#151515] border border-white/10 rounded-2xl p-6 md:p-8 space-y-4">
        <h2 class="text-2xl font-bold text-white flex items-center gap-3">
          <i class="fas fa-user-shield text-brand-red"></i>
          5. Derechos de los Titulares (Derechos ARCO)
        </h2>
        <ul class="list-disc list-inside space-y-2 text-sm text-gray-300 leading-relaxed">
          <li><strong>Conocer, actualizar y rectificar</strong> sus datos personales.</li>
          <li><strong>Solicitar prueba</strong> de la autorización otorgada.</li>
          <li><strong>Presentar quejas</strong> ante la Superintendencia de Industria y Comercio (SIC).</li>
          <li><strong>Revocar la autorización y/o solicitar la supresión</strong> del dato cuando corresponda.</li>
        </ul>
      </section>

      <!-- 6. PQR / CANAL HÁBEAS DATA -->
      <section class="space-y-4">
        <h2 class="text-2xl font-bold text-white flex items-center gap-3">
          <i class="fas fa-paper-plane text-brand-red"></i>
          6. Procedimiento para Consultas y Reclamos
        </h2>
        <div class="bg-black/50 p-6 rounded-xl border border-brand-red/30 text-center space-y-3">
          <div class="text-lg font-bold text-white">Canal Oficial de Hábeas Data</div>
          <a :href="`mailto:${companyInfo.email}`" class="text-brand-red font-bold text-xl hover:underline block">
            {{ companyInfo.email }}
          </a>
          <p class="text-xs text-gray-400">
            Tiempo máximo de respuesta: <strong>10 días hábiles</strong> para consultas y <strong>15 días hábiles</strong> para reclamos.
          </p>
        </div>
      </section>

      <!-- CTA -->
      <div class="bg-gradient-to-r from-gray-900 via-[#151515] to-gray-900 p-8 rounded-2xl border border-white/10 text-center space-y-4">
        <h3 class="text-xl font-bold text-white">¿Tienes dudas sobre cómo protegemos tus datos?</h3>
        <div class="flex flex-wrap justify-center gap-4 pt-2">
          <a :href="`mailto:${companyInfo.email}`" class="bg-brand-red hover:bg-brand-red-dark text-white text-sm px-6 py-3 rounded-xl font-bold transition-all">
            Contactar a Privacidad
          </a>
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
.bg-brand-red {
  background-color: #d60000;
}
.bg-brand-red-dark {
  background-color: #b00000;
}
.text-brand-red {
  color: #d60000;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(20px);
}
</style>
