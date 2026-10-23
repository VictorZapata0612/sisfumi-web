# sisfumi-web

Sisfumi APP es una plataforma web para la gestión integral de servicios de fumigación. Permite centralizar clientes, planeación de visitas, facturación, permisos, técnicos, notificaciones y configuración operativa en una sola interfaz.

## Características principales

- Gestión de clientes y fichas de servicio.
- Planeación de visitas con calendario y sincronización con Google Calendar.
- Control de permisos, soportes y aprobación de visitas.
- Facturación, cobros y seguimiento de pagos.
- Administración de técnicos, usuarios, zonas, aliados y tipos de servicio.
- Panel de estadísticas, reportes y búsqueda global.
- Asistente interno local con Ollama para consultas operativas de solo lectura.
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

## Configuración de Firebase y Google Calendar

La aplicación necesita la configuración del proyecto Firebase y el ID de cliente OAuth de Google. La API key de Firebase es un valor de configuración del cliente, no un secreto de backend, pero se mantiene fuera del código fuente para evitar publicar credenciales de configuración y facilitar el uso de distintos proyectos.

1. Copia `.env.example` como `.env.local`.
2. En Firebase Console, abre el proyecto `sisfumi2`, ve a **Configuración del proyecto > Tus aplicaciones** y copia la API key web en `VITE_FIREBASE_API_KEY`.

3. En Google Cloud Console, abre el proyecto `sisfumi2` y ve a **APIs y servicios > Credenciales**.
4. Crea o selecciona un **ID de cliente OAuth 2.0** de tipo **Aplicación web**.
5. En **Orígenes autorizados de JavaScript**, agrega `https://controltotalyph.com` y el origen local que uses, por ejemplo `http://localhost:5173`.
6. En `.env.local`, reemplaza el valor por el Client ID real:

	```text
	VITE_GOOGLE_CLIENT_ID=tu-client-id.apps.googleusercontent.com
	```

7. Ejecuta nuevamente `npm run build` y publica la carpeta `dist`.

El archivo `.env.local` no debe publicarse ni subirse al repositorio. El Client ID puede aparecer en el frontend; las credenciales secretas deben permanecer únicamente en Cloud Functions.

## Seguridad de datos y archivos

Firestore aplica reglas de acceso por usuario, rol y zona en `firestore.rules`. Los archivos de perfil usan `storage.rules`: solo se aceptan imágenes JPEG, PNG, WebP o GIF de hasta 5 MB dentro de la carpeta del usuario. Las URLs firmadas y la publicación de archivos se validan adicionalmente en Cloud Functions.

Después de cambiar reglas, publícalas junto con Firebase:

```sh
npx firebase-tools deploy --only firestore:rules,storage
```

Configura también restricciones de API para la clave `VITE_FIREBASE_API_KEY` en Google Cloud Console: limita los orígenes web de producción/desarrollo y habilita únicamente las APIs necesarias.

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

## Asistente local con Ollama (MVP)

El asistente aparece como un botón flotante dentro del dashboard. En esta primera versión solo consulta
información y no puede crear, editar, borrar ni asignar visitas. El backend valida la autenticación y el
rol antes de consultar una muestra limitada de clientes, visitas, servicios y técnicos.

1. Instala Ollama y descarga el modelo configurado:

	```sh
	ollama pull llama3.1
	ollama serve
	```

2. Inicia el emulador de Functions desde la carpeta `functions`:

	```sh
	npm install
	npm run serve
	```

3. En otra terminal inicia Vite:

	```sh
	npm run dev
	```

En `.env.local`, activa el emulador para que el frontend use la Function local:

```text
VITE_USE_FIREBASE_EMULATORS=true
```

El callable usa `http://127.0.0.1:11434` y el modelo `llama3.1` por defecto. Puedes cambiarlo con
`OLLAMA_BASE_URL` y `OLLAMA_MODEL` en la configuración del emulador de Functions. No expongas Ollama
directamente a internet. Las acciones de escritura requieren una fase posterior con herramientas
explícitas, validación de permisos y confirmación del usuario.

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
