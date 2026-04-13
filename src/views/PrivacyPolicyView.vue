<<<<<<< HEAD
<!-- HEADER / HERO DE LA PÁGINA -->
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

  <!-- INTRODUCCIÓN Y DATOS DEL RESPONSABLE -->
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

  <!-- MARCO LEGAL Y ALCANCE -->
  <section class="space-y-4">
    <h2 class="text-2xl font-bold text-white flex items-center gap-3">
      <i class="fas fa-gavel text-brand-red"></i>
      2. Marco Legal y Alcance
    </h2>
    <p class="text-gray-300 text-sm md:text-base leading-relaxed">
      Esta Política se aplica a toda la información personal recopilada a través del sitio web <a :href="companyInfo.website" target="_blank" class="text-brand-red hover:underline">{{ companyInfo.website }}</a>, formularios de contacto, cotizaciones de fumigación y manejo integral de plagas (MIP), aplicaciones cliente, registros de inspección, comunicaciones por WhatsApp o correo electrónico, y contratos de prestación de servicios.
    </p>
  </section>

  <!-- DATOS QUE RECOLECTAMOS -->
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

  <!-- FINALIDAD DEL TRATAMIENTO -->
  <section class="space-y-4">
    <h2 class="text-2xl font-bold text-white flex items-center gap-3">
      <i class="fas fa-bullseye text-brand-red"></i>
      4. Finalidad del Tratamiento de los Datos
    </h2>
    <p class="text-gray-300 text-sm md:text-base leading-relaxed">
      Los datos personales provistos por el Titular serán utilizados con las siguientes finalidades comerciales, operativas y legales:
    </p>
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
        <strong class="text-white block mb-1">C. Comunicaciones y Fidelización:</strong>
        Envío de recordatorios de mantenimiento, guías preventivas de higiene, boletines de ofertas e información relevante del sector.
      </div>
      <div class="bg-[#151515] p-4 rounded-xl border border-white/5">
        <strong class="text-white block mb-1">D. Cumplimiento Normativo:</strong>
        Reportes exigidos por autoridades sanitarias (Secretaría de Salud de Cali y del Valle del Cauca), auditorías de inocuidad y archivo contable.
      </div>
    </div>
  </section>

  <!-- DERECHOS DEL TITULAR (DERECHOS ARCO) -->
  <section class="bg-[#151515] border border-white/10 rounded-2xl p-6 md:p-8 space-y-4">
    <h2 class="text-2xl font-bold text-white flex items-center gap-3">
      <i class="fas fa-user-shield text-brand-red"></i>
      5. Derechos de los Titulares (Derechos ARCO)
    </h2>
    <p class="text-gray-300 text-sm md:text-base leading-relaxed">
      De conformidad con el Artículo 8 de la Ley 1581 de 2012, el Titular de los datos personales tiene los siguientes derechos:
    </p>
    <ul class="list-disc list-inside space-y-2 text-sm text-gray-300 leading-relaxed">
      <li><strong>Conocer, actualizar y rectificar</strong> sus datos personales frente a los Responsables o Encargados del Tratamiento.</li>
      <li><strong>Solicitar prueba de la autorización</strong> otorgada para el tratamiento de sus datos.</li>
      <li><strong>Ser informado</strong> previa solicitud, respecto del uso que se le ha dado a sus datos personales.</li>
      <li><strong>Presentar quejas</strong> ante la Superintendencia de Industria y Comercio (SIC) por infracciones a lo dispuesto en la ley.</li>
      <li><strong>Revocar la autorización y/o solicitar la supresión</strong> del dato cuando no se respeten los principios, derechos y garantías constitucionales.</li>
      <li><strong>Acceder en forma gratuita</strong> a sus datos personales que hayan sido objeto de tratamiento.</li>
    </ul>
  </section>

  <!-- PROCEDIMIENTO PARA EJERCER DERECHOS (PQR) -->
  <section class="space-y-4">
    <h2 class="text-2xl font-bold text-white flex items-center gap-3">
      <i class="fas fa-paper-plane text-brand-red"></i>
      6. Procedimiento para Consultas, Rectificaciones y Reclamos
    </h2>
    <p class="text-gray-300 text-sm md:text-base leading-relaxed">
      Para ejercer sus derechos de consulta, actualización, rectificación o supresión de datos, el Titular debe enviar una solicitud formal dirigida al área de Administración de <strong>{{ companyInfo.name }}</strong> a través de:
    </p>
    <div class="bg-black/50 p-6 rounded-xl border border-brand-red/30 text-center space-y-3">
      <div class="text-lg font-bold text-white">Canal Oficial de Hábeas Data</div>
      <a :href="`mailto:${companyInfo.email}`" class="text-brand-red font-bold text-xl hover:underline block">
        {{ companyInfo.email }}
      </a>
      <p class="text-xs text-gray-400">
        La solicitud debe incluir: Nombre completo, número de cédula o NIT, correo de contacto, descripción de los hechos o rectificación deseada y documentos de soporte si aplica.
      </p>
      <div class="text-xs text-gray-500 pt-2 border-t border-white/10">
        Tiempo máximo de respuesta: <strong>10 días hábiles</strong> para consultas y <strong>15 días hábiles</strong> para reclamos o solicitudes de supresión.
      </div>
    </div>
  </section>

  <!-- COOKIES Y TECNOLOGÍAS DE SEGUIMIENTO -->
  <section class="space-y-4">
    <h2 class="text-2xl font-bold text-white flex items-center gap-3">
      <i class="fas fa-cookie-bite text-brand-red"></i>
      7. Uso de Cookies y Tecnologías de Monitoreo
    </h2>
    <p class="text-gray-300 text-sm md:text-base leading-relaxed">
      Nuestro sitio web utiliza <em>cookies</em> y tecnologías analíticas de Google para mejorar la experiencia del usuario, medir tráfico de la plataforma y personalizar contenido. El usuario puede deshabilitar el uso de cookies en cualquier momento ajustando la configuración de su navegador web.
    </p>
  </section>

  <!-- SEGURIDAD Y TRANSFERENCIA DE DATOS -->
  <section class="space-y-4">
    <h2 class="text-2xl font-bold text-white flex items-center gap-3">
      <i class="fas fa-lock text-brand-red"></i>
      8. Seguridad de la Información y Transferencia Internacional
    </h2>
    <p class="text-gray-300 text-sm md:text-base leading-relaxed">
      Adoptamos medidas técnicas, administrativas y físicas de seguridad (incluyendo encriptación SSL, control de accesos por roles y servidores de Google Cloud Platform / Firebase) para evitar la alteración, pérdida, consulta, uso o acceso no autorizado de su información.
    </p>
    <p class="text-gray-300 text-sm md:text-base leading-relaxed">
      Sus datos personales no se venderán, alquilarán ni cederán a terceros no vinculados sin su autorización expresa, salvo orden judicial o imperativo legal.
    </p>
  </section>

  <!-- MODIFICACIONES A LA POLÍTICA -->
  <section class="border-t border-white/10 pt-8 space-y-4">
    <h2 class="text-2xl font-bold text-white flex items-center gap-3">
      <i class="fas fa-sync text-brand-red"></i>
      9. Modificaciones a esta Política
    </h2>
    <p class="text-gray-300 text-sm md:text-base leading-relaxed">
      <strong>{{ companyInfo.name }}</strong> se reserva el derecho de modificar esta Política de Privacidad en cualquier momento. Toda modificación sustancial será comunicada a través de nuestra página web con al menos cinco (5) días hábiles de anticipación a su puesta en marcha.
    </p>
  </section>

  <!-- CTA DE CONTACTO -->
  <div class="bg-gradient-to-r from-gray-900 via-[#151515] to-gray-900 p-8 rounded-2xl border border-white/10 text-center space-y-4">
    <h3 class="text-xl font-bold text-white">¿Tienes dudas sobre cómo protegemos tus datos?</h3>
    <p class="text-sm text-gray-400">Estamos a tu disposición para atender cualquier requerimiento de privacidad o contratación.</p>
    <div class="flex flex-wrap justify-center gap-4 pt-2">
      <a :href="`mailto:${companyInfo.email}`" class="btn bg-brand-red hover:bg-brand-red-dark text-white text-sm px-6 py-3 rounded-xl font-bold shadow-lg transition-all">
        <i class="fas fa-envelope mr-2"></i> Contactar a Privacidad
      </a>
      <RouterLink to="/contacto" class="btn border border-white/20 hover:border-white text-white text-sm px-6 py-3 rounded-xl font-bold transition-all">
        Ir a Contacto
      </RouterLink>
    </div>
  </div>

</main>
=======
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
>>>>>>> c933029 (Initial commit)
