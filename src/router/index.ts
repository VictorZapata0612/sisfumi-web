import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import MainLayout from '@/layouts/MainLayout.vue'
import PublicLayout from '@/layouts/PublicLayout.vue'
import HomeView from '@/views/HomeView.vue'
import HomePage from '@/views/public/HomePage.vue'
import LoginView from '@/views/LoginView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      // Layout para las páginas públicas (accesibles por visitantes y usuarios logueados)
      path: '/',
      component: PublicLayout,
      children: [
        {
          path: '',
          name: 'home',
          component: HomePage,
        },
        {
          path: 'servicios',
          name: 'public-services',
          component: { template: '' },
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
        {
          path: 'politicas-de-privacidad',
          name: 'public-privacy-policy',
          component: () => import('../views/public/PrivacyPolicyPage.vue'),
        },
      ],
    },

    {
      path: '/login',
      name: 'login',
      component: LoginView,
    },

    {
      // Layout principal para rutas autenticadas bajo /dashboard
      path: '/dashboard',
      component: MainLayout,
      meta: { requiresAuth: true },
      children: [
        {
          path: '',
          name: 'dashboard',
          component: HomeView,
        },
        {
          path: 'clientes',
          name: 'clientes',
          component: () => import('../views/ClientsView.vue'),
        },
        {
          path: 'servicios',
          name: 'servicios',
          component: () => import('../views/ServicesView.vue'),
        },
        {
          path: 'planeacion',
          name: 'planeacion',
          component: () => import('../views/PlanningView.vue'),
        },
        {
          path: 'fumigadores',
          name: 'fumigadores',
          component: () => import('../views/TechniciansView.vue'),
        },
        {
          path: 'notificaciones',
          name: 'notificaciones',
          component: () => import('../views/NotificationsView.vue'),
        },
        {
          path: 'facturacion',
          name: 'facturacion',
          component: () => import('../views/BillingView.vue'),
          meta: { roles: ['Administrador', 'Jefe', 'Coordinador Nacionales'] },
        },
        {
          path: 'pagos',
          name: 'pagos',
          component: () => import('../views/PaymentsView.vue'),
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
    next()
  }
})

export default router
