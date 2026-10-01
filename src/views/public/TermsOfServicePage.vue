<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { RouterLink } from 'vue-router'

const lastUpdated = '29 de Septiembre de 2026'

const companyInfo = {
  name: 'Control Total & P. H. S.A.S.',
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
  document.title = 'Términos y Condiciones | Control Total & P. H.'
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
      <div class="absolute top-0 right-1/2 translate-x-1/2 w-[600px] h-[300px] bg-brand-red/10 rounded-full blur-[120px] pointer-events-none"></div>

      <div class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
        <RouterLink
          to="/"
          class="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-brand-red mb-6 transition-colors"
        >
          <i class="fas fa-arrow-left"></i> Volver al Inicio
        </RouterLink>

        <h1 class="text-4xl md:text-6xl font-extrabold text-white tracking-tight mb-4">
          Términos y <span class="text-transparent bg-clip-text bg-gradient-to-r from-[#d60000] to-[#ef4444]">Condiciones</span>
        </h1>
        <p class="text-gray-400 text-sm md:text-base max-w-2xl mx-auto">
          Condiciones de Uso del Servicio y la Plataforma Digital
        </p>
        <div class="mt-4 text-xs text-gray-500">
          Última actualización: {{ lastUpdated }}
        </div>
      </div>
    </header>

    <!-- CONTENIDO PRINCIPAL -->
    <main class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-12">

      <!-- 1. ACEPTACIÓN -->
      <section class="bg-[#151515] border border-white/10 rounded-2xl p-6 md:p-8 shadow-xl">
        <h2 class="text-2xl font-bold text-white mb-4 flex items-center gap-3">
          <i class="fas fa-handshake text-brand-red"></i>
          1. Aceptación de los Términos
        </h2>
        <p class="text-gray-300 text-sm md:text-base leading-relaxed mb-4">
          Al acceder y utilizar el sitio web <a :href="companyInfo.website" target="_blank" class="text-brand-red hover:underline">{{ companyInfo.website }}</a> y los servicios de <strong class="text-white">{{ companyInfo.name }}</strong>, usted acepta estar legalmente vinculado a estos Términos y Condiciones. Si no está de acuerdo con alguno de estos términos, le rogamos que no utilice nuestro sitio web ni nuestros servicios digitales.
        </p>
      </section>

      <!-- 2. DESCRIPCIÓN DEL SERVICIO -->
      <section class="space-y-4">
        <h2 class="text-2xl font-bold text-white flex items-center gap-3">
          <i class="fas fa-info-circle text-brand-red"></i>
          2. Descripción del Servicio
        </h2>
        <p class="text-gray-300 text-sm md:text-base leading-relaxed">
          Control Total & P. H. proporciona información sobre sus servicios de manejo integral de plagas, desratización, desinfección y lavado de tanques. Asimismo, cuenta con un sistema administrativo interno denominado <strong>SISFUMI</strong>, diseñado para la gestión de clientes, técnicos, facturación, certificados y programación de agendas exclusivas para el personal autorizado.
        </p>
      </section>

      <!-- 3. USO DE APIS DE GOOGLE (CRUCIAL PARA LA APROBACIÓN) -->
      <section class="space-y-4">
        <h2 class="text-2xl font-bold text-white flex items-center gap-3">
          <i class="fab fa-google text-brand-red"></i>
          3. Uso de Servicios y API de Terceros (Google)
        </h2>
        <div class="bg-blue-900/10 border border-blue-500/20 p-5 rounded-xl space-y-3">
          <p class="text-gray-300 text-sm md:text-base leading-relaxed">
            Nuestro panel administrativo (SISFUMI) permite a los usuarios autorizados vincular sus cuentas de Google para optimizar la logística de los servicios. Si usted es usuario de esta plataforma interna:
          </p>
          <ul class="list-disc list-inside space-y-2 text-sm text-gray-300 leading-relaxed ml-2">
            <li>La plataforma utiliza los permisos de <strong>Google Calendar</strong> para agendar y organizar las visitas técnicas de nuestros fumigadores.</li>
            <li>La plataforma utiliza los permisos de <strong>Gmail</strong> exclusivamente para el envío automatizado de notificaciones de agendamiento, certificados y reportes hacia nuestros clientes.</li>
          </ul>
          <p class="text-gray-300 text-sm font-medium mt-3">
            <strong>Divulgación de Uso Limitado:</strong> El uso y la transferencia a cualquier otra aplicación de la información recibida de las API de Google por parte de nuestra aplicación se ajustarán a la <a href="https://developers.google.com/terms/api-services-user-data-policy#additional_requirements_for_specific_api_scopes" target="_blank" class="text-blue-400 hover:underline">Política de Datos del Usuario de los Servicios de API de Google</a>, incluidos los requisitos de uso limitado. Nunca venderemos, compartiremos ni utilizaremos estos datos con fines publicitarios.
          </p>
        </div>
      </section>

      <!-- 4. USO ADECUADO -->
      <section class="space-y-4">
        <h2 class="text-2xl font-bold text-white flex items-center gap-3">
          <i class="fas fa-shield-alt text-brand-red"></i>
          4. Uso Adecuado de la Plataforma
        </h2>
        <p class="text-gray-300 text-sm md:text-base leading-relaxed">
          El usuario se compromete a hacer un uso lícito y adecuado del sitio web y de sus formularios. Queda estrictamente prohibido:
        </p>
        <ul class="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm mt-4">
          <li class="bg-[#151515] p-3 rounded-lg border border-white/5 flex items-start gap-2">
            <i class="fas fa-times text-brand-red mt-1"></i>
            <span>Intentar accesos no autorizados al panel administrativo (SISFUMI) o vulnerar los sistemas de seguridad.</span>
          </li>
          <li class="bg-[#151515] p-3 rounded-lg border border-white/5 flex items-start gap-2">
            <i class="fas fa-times text-brand-red mt-1"></i>
            <span>Introducir código malicioso, virus o utilizar el sitio web para actividades fraudulentas o ilícitas.</span>
          </li>
        </ul>
      </section>

      <!-- 5. PROPIEDAD INTELECTUAL -->
      <section class="space-y-4">
        <h2 class="text-2xl font-bold text-white flex items-center gap-3">
          <i class="fas fa-copyright text-brand-red"></i>
          5. Propiedad Intelectual
        </h2>
        <p class="text-gray-300 text-sm md:text-base leading-relaxed">
          Todo el contenido de este sitio, incluyendo pero no limitado a textos, gráficos, logotipos, iconos, imágenes y software, es propiedad exclusiva de <strong class="text-white">{{ companyInfo.name }}</strong> o de sus proveedores de contenido, y está protegido por las leyes de derechos de autor de la República de Colombia y tratados internacionales.
        </p>
      </section>

      <!-- 6. LIMITACIÓN DE RESPONSABILIDAD -->
      <section class="space-y-4">
        <h2 class="text-2xl font-bold text-white flex items-center gap-3">
          <i class="fas fa-exclamation-triangle text-brand-red"></i>
          6. Limitación de Responsabilidad
        </h2>
        <p class="text-gray-300 text-sm md:text-base leading-relaxed">
          La información proporcionada en el sitio web es de carácter general. Aunque nos esforzamos por mantenerla actualizada y correcta, no ofrecemos representaciones ni garantías de ningún tipo sobre la integridad, exactitud o disponibilidad del sitio web. La garantía sobre los servicios físicos de fumigación y control de plagas se rige de forma independiente a través del contrato comercial con el cliente.
        </p>
      </section>

      <!-- 7. MODIFICACIONES -->
      <section class="space-y-4">
        <h2 class="text-2xl font-bold text-white flex items-center gap-3">
          <i class="fas fa-sync-alt text-brand-red"></i>
          7. Modificaciones a los Términos
        </h2>
        <p class="text-gray-300 text-sm md:text-base leading-relaxed">
          Nos reservamos el derecho de modificar estos términos y condiciones en cualquier momento. Los cambios entrarán en vigor inmediatamente después de su publicación en esta página. Recomendamos revisar esta página periódicamente.
        </p>
      </section>

      <!-- 8. LEY APLICABLE -->
      <section class="space-y-4">
        <h2 class="text-2xl font-bold text-white flex items-center gap-3">
          <i class="fas fa-balance-scale text-brand-red"></i>
          8. Ley Aplicable y Jurisdicción
        </h2>
        <p class="text-gray-300 text-sm md:text-base leading-relaxed">
          Estos términos se regirán e interpretarán de acuerdo con las leyes de la República de Colombia. Cualquier disputa relacionada con estos términos estará sujeta a la jurisdicción exclusiva de los tribunales de la ciudad de Cali, Valle del Cauca.
        </p>
      </section>

      <!-- CTA DE CONTACTO -->
      <div class="bg-gradient-to-r from-gray-900 via-[#151515] to-gray-900 p-8 rounded-2xl border border-white/10 text-center space-y-4">
        <h3 class="text-xl font-bold text-white">¿Tienes alguna pregunta sobre nuestros términos?</h3>
        <p class="text-gray-400 text-sm">Puedes comunicarte con nosotros directamente.</p>
        <div class="flex flex-wrap justify-center gap-4 pt-2">
          <a :href="`mailto:${companyInfo.email}`" class="bg-brand-red hover:bg-brand-red-dark text-white text-sm px-6 py-3 rounded-xl font-bold transition-all">
            Contactar a Gerencia
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
