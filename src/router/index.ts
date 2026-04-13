import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import MainLayout from '@/layouts/MainLayout.vue'
import PublicLayout from '@/layouts/PublicLayout.vue' // Importamos el nuevo layout
import HomeView from '@/views/HomeView.vue'
import HomePage from '@/views/public/HomePage.vue' // Importamos la nueva página de inicio
import LoginView from '@/views/LoginView.vue'
import PrivacyPolicyView from '@/views/PrivacyPolicyView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      // Layout para las páginas públicas
      path: '/',
      component: PublicLayout,
      meta: { requiresAuth: false },
      children: [
        {
          path: '',
          name: 'home',
          component: HomePage,
        },
        {
          path: 'servicios',
          name: 'public-services',
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
      path: '/dashboard',
      component: MainLayout,
      meta: { requiresAuth: true },
      children: [
        {
          path: '', // Ruta vacía para /dashboard
          name: 'dashboard', // Nombre único para el panel
          component: HomeView,
        },
        {
          path: 'clientes', // Ruta relativa
          name: 'clientes',
          component: () => import('../views/ClientsView.vue'),
        },
        {
          path: 'servicios', // Ruta relativa
          name: 'servicios',
          component: () => import('../views/ServicesView.vue'),
        },
        {
          path: 'planeacion', // Ruta relativa
          name: 'planeacion',
          component: () => import('../views/PlanningView.vue'),
        },
        {
          path: 'fumigadores', // Ruta relativa
          name: 'fumigadores',
          component: () => import('../views/TechniciansView.vue'),
        },
        {
          path: 'notificaciones', // Ruta relativa
          name: 'notificaciones',
          component: () => import('../views/NotificationsView.vue'),
        },
        {
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
          name: 'configuracion',
          component: () => import('../views/SettingsView.vue'),
        },
      ],
    },
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
    next()
  }
})

export default router
