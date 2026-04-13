import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import MainLayout from '@/layouts/MainLayout.vue'
<<<<<<< HEAD
import PublicLayout from '@/layouts/PublicLayout.vue'
import HomeView from '@/views/HomeView.vue'
import HomePage from '@/views/public/HomePage.vue'
import LoginView from '@/views/LoginView.vue'
=======
import PublicLayout from '@/layouts/PublicLayout.vue' // Importamos el nuevo layout
import HomeView from '@/views/HomeView.vue'
import HomePage from '@/views/public/HomePage.vue' // Importamos la nueva página de inicio
import LoginView from '@/views/LoginView.vue'
import PrivacyPolicyView from '@/views/PrivacyPolicyView.vue'
>>>>>>> c933029 (Initial commit)

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
<<<<<<< HEAD
      // Layout para las páginas públicas (accesibles por visitantes y usuarios logueados)
      path: '/',
      component: PublicLayout,
=======
      // Layout para las páginas públicas
      path: '/',
      component: PublicLayout,
      meta: { requiresAuth: false },
>>>>>>> c933029 (Initial commit)
      children: [
        {
          path: '',
          name: 'home',
          component: HomePage,
        },
        {
          path: 'servicios',
          name: 'public-services',
<<<<<<< HEAD
          component: () => import('../views/public/ServicesPage.vue'),
        },
        {
          path: 'servicios/manejo-integral-de-plagas',
          name: 'service-detail-mip',
          component: () => import('../views/public/services/ManejoIntegralPage.vue'),
        },
        {
          path: 'servicios/desratizacion',
          name: 'service-detail-desratizacion',
          component: () => import('../views/public/services/DesratizacionPage.vue'),
        },
        {
          path: 'servicios/desinfeccion',
          name: 'service-detail-desinfeccion',
          component: () => import('../views/public/services/DesinfeccionPage.vue'),
        },
        {
          path: 'servicios/lavado-de-tanques',
          name: 'service-detail-lavado-tanques',
          component: () => import('../views/public/services/LavadoDeTanquesPage.vue'),
=======
          // Usamos un componente wrapper para poder anidar las rutas de detalle.
          // Esto simplemente renderiza el componente hijo que coincida con la ruta.
          component: { template: '<RouterView />' },
          children: [
            {
              path: '', // Corresponde a /servicios
              name: 'services-list',
              component: () => import('../views/public/ServicesPage.vue'),
            },
            {
              path: 'manejo-integral-de-plagas',
              name: 'service-detail-mip',
              component: () => import('../views/public/services/ManejoIntegralPage.vue'),
            },
            {
              path: 'desratizacion',
              name: 'service-detail-desratizacion',
              component: () => import('../views/public/services/DesratizacionPage.vue'),
            },
            {
              path: 'desinfeccion',
              name: 'service-detail-desinfeccion',
              component: () => import('../views/public/services/DesinfeccionPage.vue'),
            },
            {
              path: 'lavado-de-tanques',
              name: 'service-detail-lavado-tanques',
              component: () => import('../views/public/services/LavadoDeTanquesPage.vue'),
            },
            // Puedes seguir este patrón para los otros servicios.
          ],
>>>>>>> c933029 (Initial commit)
        },
        {
          path: 'sobre-nosotros',
          name: 'public-about',
          component: () => import('../views/public/AboutPage.vue'),
        },
        {
          path: 'contacto',
          name: 'public-contact',
          component: () => import('../views/public/ContactPage.vue'),
        },
<<<<<<< HEAD
        {
          path: 'politicas-de-privacidad',
          name: 'public-privacy-policy',
          component: () => import('../views/public/PrivacyPolicyPage.vue'),
        },
        {
          path: '/terminos-y-condiciones',
          name: 'terminos',
          component: () => import('../views/public/TermsOfServicePage.vue'),
          meta: { requiresAuth: false } // IMPORTANTE
        }
      ],
    },

    {
      path: '/login',
      name: 'login',
      component: LoginView,
    },

    {
      // Layout principal para rutas autenticadas bajo /dashboard
=======
      ],
    },
    {
      path: '/privacy-policy',
      name: 'privacy-policy',
      component: PrivacyPolicyView,
      meta: { requiresAuth: false },
    },
    {
      path: '/login', // Ruta para el login
      name: 'login',
      component: LoginView,
      meta: { requiresAuth: false },
    },
    {
      // Layout principal para rutas autenticadas, ahora bajo /dashboard
>>>>>>> c933029 (Initial commit)
      path: '/dashboard',
      component: MainLayout,
      meta: { requiresAuth: true },
      children: [
        {
<<<<<<< HEAD
          path: '',
          name: 'dashboard',
          component: HomeView,
        },
        {
          path: 'clientes',
=======
          path: '', // Ruta vacía para /dashboard
          name: 'dashboard', // Nombre único para el panel
          component: HomeView,
        },
        {
          path: 'clientes', // Ruta relativa
>>>>>>> c933029 (Initial commit)
          name: 'clientes',
          component: () => import('../views/ClientsView.vue'),
        },
        {
<<<<<<< HEAD
          path: 'servicios',
=======
          path: 'servicios', // Ruta relativa
>>>>>>> c933029 (Initial commit)
          name: 'servicios',
          component: () => import('../views/ServicesView.vue'),
        },
        {
<<<<<<< HEAD
          path: 'planeacion',
=======
          path: 'planeacion', // Ruta relativa
>>>>>>> c933029 (Initial commit)
          name: 'planeacion',
          component: () => import('../views/PlanningView.vue'),
        },
        {
<<<<<<< HEAD
          path: 'fumigadores',
=======
          path: 'fumigadores', // Ruta relativa
>>>>>>> c933029 (Initial commit)
          name: 'fumigadores',
          component: () => import('../views/TechniciansView.vue'),
        },
        {
<<<<<<< HEAD
          path: 'notificaciones',
=======
          path: 'notificaciones', // Ruta relativa
>>>>>>> c933029 (Initial commit)
          name: 'notificaciones',
          component: () => import('../views/NotificationsView.vue'),
        },
        {
<<<<<<< HEAD
          path: 'facturacion',
          name: 'facturacion',
          component: () => import('../views/BillingView.vue'),
          meta: { roles: ['Administrador', 'Jefe', 'Coordinador Nacionales'] },
        },
        {
          path: 'reportes',
          name: 'reportes',
          component: () => import('../views/ReportsView.vue'),
        },
        {
          path: 'permisos',
          name: 'permisos',
          component: () => import('../views/PermissionsView.vue'),
        },
        {
          path: 'configuracion',
=======
          path: 'facturacion', // Ruta relativa
          name: 'facturacion',
          component: () => import('../views/BillingView.vue'),
          meta: { roles: ['Administrador', 'Jefe'] },
        },
        {
          path: 'pagos', // Ruta relativa
          name: 'pagos',
          component: () => import('../views/PaymentsView.vue'),
          meta: { roles: ['Administrador', 'Jefe'] },
        },
        {
          path: 'reportes', // Ruta relativa
          name: 'reportes',
          component: () => import('../views/ReportsView.vue'),
          meta: { roles: ['Administrador', 'Jefe', 'Coordinador Nacionales'] },
        },
        {
          path: 'permisos', // Ruta relativa
          name: 'permisos',
          component: () => import('../views/PermissionsView.vue'),
          meta: { roles: ['Administrador', 'Jefe', 'Coordinador Nacionales'] },
        },
        {
          path: 'configuracion', // Ruta relativa
>>>>>>> c933029 (Initial commit)
          name: 'configuracion',
          component: () => import('../views/SettingsView.vue'),
        },
      ],
    },
<<<<<<< HEAD

=======
>>>>>>> c933029 (Initial commit)
    // Redirección para cualquier ruta no encontrada a la página de inicio
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})

router.beforeEach(async (to, from, next) => {
  const authStore = useAuthStore()

  // Espera a que el estado de autenticación esté listo
  if (!authStore.authReady) {
    await authStore.init()
  }

<<<<<<< HEAD
  // 1. Si la ruta requiere autenticación y no hay sesión activa -> Va al Login
  if (to.meta.requiresAuth && !authStore.isLoggedIn) {
    next({ name: 'login' })
  }
  // 2. Si el usuario ya tiene sesión e intenta ir al /login -> Lo redirige al Dashboard
  else if (to.name === 'login' && authStore.isLoggedIn) {
    next({ name: 'dashboard' })
  }
  // 3. Verificación de roles permitidos para la ruta
  else if (Array.isArray(to.meta.roles) && !to.meta.roles.includes(authStore.userRole || '')) {
    next({ name: 'dashboard' })
  }
  // 4. En cualquier otro caso (rutas públicas como políticas, servicios, contacto), permite la navegación libre
  else {
=======
  if (to.meta.requiresAuth && !authStore.isLoggedIn) {
    // Si la ruta requiere autenticación y no hay sesión, va al login.
    next({ name: 'login' })
  } else if (to.meta.requiresAuth === false && authStore.isLoggedIn) {
    // Si el usuario ya está logueado e intenta ir a una página pública (como landing o login),
    // lo redirigimos a la página de inicio de la aplicación.
    next({ name: 'dashboard' })
  } else if (Array.isArray(to.meta.roles) && !to.meta.roles.includes(authStore.userRole || '')) {
    // Si la ruta requiere un rol y el usuario no lo tiene, lo redirigimos a la página de inicio.
    next({ name: 'dashboard' })
  } else {
    // En cualquier otro caso, permite la navegación.
>>>>>>> c933029 (Initial commit)
    next()
  }
})

export default router
