# sisfumi-web

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

## Requisitos

- Node.js 20.19+ o 22.12+
- npm

## Instalación

```sh
npm install
```

## Desarrollo

```sh
npm run dev
```

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

## Nota

Si quieres, puedo agregar también una sección de capturas, instrucciones de despliegue o un bloque de variables de entorno si decides mover la configuración de Firebase fuera del código.
