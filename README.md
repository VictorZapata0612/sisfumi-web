# sisfumi-web

<<<<<<< HEAD
Sisfumi APP es una plataforma web para la gestión integral de servicios de fumigación. Permite centralizar clientes, planeación de visitas, facturación, permisos, técnicos, notificaciones y configuración operativa en una sola interfaz.

## Características principales

- Gestión de clientes y fichas de servicio.
- Planeación de visitas con calendario y sincronización con Google Calendar.
- Control de permisos, soportes y aprobación de visitas.
- Facturación, cobros y seguimiento de pagos.
- Administración de técnicos, usuarios, zonas, aliados y tipos de servicio.
- Panel de estadísticas, reportes y búsqueda global.
- Sitio público informativo con páginas de inicio, servicios, contacto y privacidad.

## Tecnologías

- Vue 3
- Vite
- TypeScript
- Pinia
- Vue Router
- Firebase Authentication, Firestore, Functions y Storage
- Tailwind CSS
- Chart.js

## Configuración de Google Calendar

El frontend necesita el ID de cliente OAuth de Google para conectar calendarios.

1. En Google Cloud Console, abre el proyecto `sisfumi2` y ve a **APIs y servicios > Credenciales**.
2. Crea o selecciona un **ID de cliente OAuth 2.0** de tipo **Aplicación web**.
3. En **Orígenes autorizados de JavaScript**, agrega `https://controltotalyph.com` y el origen local que uses, por ejemplo `http://localhost:5173`.
4. Copia `.env.example` como `.env.local` y reemplaza el valor por el Client ID real:

	```text
	VITE_GOOGLE_CLIENT_ID=tu-client-id.apps.googleusercontent.com
	```

5. Ejecuta nuevamente `npm run build` y publica la carpeta `dist`.

El archivo `.env.local` no debe publicarse ni subirse al repositorio. El Client ID puede aparecer en el frontend; las credenciales secretas deben permanecer únicamente en Cloud Functions.

## Requisitos

- Node.js 20.19+ o 22.12+
- npm

## Instalación
=======
This template should help get you started developing with Vue 3 in Vite.

## Recommended IDE Setup

[VS Code](https://code.visualstudio.com/) + [Vue (Official)](https://marketplace.visualstudio.com/items?itemName=Vue.volar) (and disable Vetur).

## Recommended Browser Setup

- Chromium-based browsers (Chrome, Edge, Brave, etc.):
  - [Vue.js devtools](https://chromewebstore.google.com/detail/vuejs-devtools/nhdogjmejiglipccpnnnanhbledajbpd) 
  - [Turn on Custom Object Formatter in Chrome DevTools](http://bit.ly/object-formatters)
- Firefox:
  - [Vue.js devtools](https://addons.mozilla.org/en-US/firefox/addon/vue-js-devtools/)
  - [Turn on Custom Object Formatter in Firefox DevTools](https://fxdx.dev/firefox-devtools-custom-object-formatters/)

## Type Support for `.vue` Imports in TS

TypeScript cannot handle type information for `.vue` imports by default, so we replace the `tsc` CLI with `vue-tsc` for type checking. In editors, we need [Volar](https://marketplace.visualstudio.com/items?itemName=Vue.volar) to make the TypeScript language service aware of `.vue` types.

## Customize configuration

See [Vite Configuration Reference](https://vite.dev/config/).

## Project Setup
>>>>>>> c933029 (Initial commit)

```sh
npm install
```

<<<<<<< HEAD
## Desarrollo
=======
### Compile and Hot-Reload for Development
>>>>>>> c933029 (Initial commit)

```sh
npm run dev
```

<<<<<<< HEAD
La aplicación se ejecuta normalmente en `http://localhost:5173`.

## Scripts disponibles

- `npm run dev`: inicia el servidor de desarrollo con Vite.
- `npm run build`: compila y valida el proyecto para producción.
- `npm run preview`: previsualiza la versión compilada.
- `npm run lint`: ejecuta ESLint y corrige archivos compatibles.
- `npm run format`: formatea el código fuente con Prettier.

## Configuración de Firebase

La configuración de Firebase está centralizada en [src/firebase/config.ts](src/firebase/config.ts). Si vas a usar otro proyecto de Firebase, actualiza ese archivo con tus credenciales.

## Estructura general

- `src/views`: vistas principales y páginas públicas.
- `src/components`: componentes reutilizables y modales.
- `src/stores`: estado global con Pinia.
- `src/router`: rutas de la aplicación.
- `src/firebase`: inicialización de Firebase.
=======
### Type-Check, Compile and Minify for Production

```sh
npm run build
```

### Lint with [ESLint](https://eslint.org/)

```sh
npm run lint
```
>>>>>>> c933029 (Initial commit)
