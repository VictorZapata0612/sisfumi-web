/**
 * ============================================================================
 * SISFUMI - BACKEND CLOUD FUNCTIONS (FIREBASE V2)
 * ============================================================================
 * * Este archivo contiene toda la lógica de negocio del sistema SISFUMI.
 * Se ha estructurado para manejar Clientes, Técnicos, Visitas, Facturación,
 * Calendario, Auditoría y Tareas Programadas.
 * * @version 2.0.0 (Production Ready - Extended)
 * @author SISFUMI Dev Team
 */

/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-unused-vars */

// ==========================================
// 1. CONFIGURACIÓN E IMPORTACIONES
// ==========================================

const {
  onCall,
  HttpsError,
} = require("firebase-functions/v2/https");

const {
  onDocumentWritten,
  onDocumentCreated,
  onDocumentUpdated,
} = require("firebase-functions/v2/firestore");

const { onObjectDeleted } = require("firebase-functions/v2/storage");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { logger } = require("firebase-functions");


// Importaciones de librerías externas
const admin = require("firebase-admin");

// Carga perezosa de dependencias pesadas para acelerar el "discovery" del deploy.
let _google;
const google = new Proxy(
  {},
  {
    get(_target, prop) {
      if (!_google) {
        _google = require("googleapis").google;
      }
      return _google[prop];
    },
  }
);

let _xlsx;
const XLSX = new Proxy(
  {},
  {
    get(_target, prop) {
      if (!_xlsx) {
        _xlsx = require("xlsx");
      }
      return _xlsx[prop];
    },
  }
); // Asegúrate de tener 'xlsx' en package.json

// Inicialización de la App de Firebase
const app = admin.initializeApp();
const db = admin.firestore(app);
const resendApiKey = process.env.RESEND_API_KEY || "";
const storageBucketName =
  process.env.FIREBASE_STORAGE_BUCKET ||
  process.env.STORAGE_BUCKET ||
  (process.env.GCLOUD_PROJECT
    ? `${process.env.GCLOUD_PROJECT}.firebasestorage.app`
    : "sisfumi2.firebasestorage.app");

// Configuración de CORS
// Permitimos localhost para desarrollo y el dominio de producción
const cors = require("cors")({
  origin: ["http://localhost:5173", "https://sisfumictph.com", "https://controltotalyph.com"],
  optionsSuccessStatus: 200,
});

// Importar credenciales de Google desde archivo local o variables de entorno
// Se recomienda usar defineString para producción, pero mantenemos require para compatibilidad
let googleConfig;
try {
  googleConfig = require("./googleConfig");
} catch (e) {
  logger.warn(
    "googleConfig.js no encontrado, usando variables de entorno o valores por defecto."
  );
  googleConfig = {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  };
}

// ==========================================
// 2. UTILIDADES Y MIDDLEWARES (HELPERS)
// ==========================================

/**
 * Escapa caracteres HTML para evitar inyecciones y errores de formato.
 */
function escapeHTML(str) {
  if (!str) return "";
  const map = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  };
  return String(str).replace(/[&<>'"]/g, function (tag) {
    return map[tag];
  });
}

/**
 * Valida que el usuario esté autenticado.
 * @param {Object} request - Objeto request de Firebase.
 * @throws {HttpsError} Si no hay autenticación.
 */
function assertAuth(request) {
  if (!request.auth) {
    logger.warn("Intento de acceso no autenticado detectado.");
    throw new HttpsError(
      "unauthenticated",
      "Debes iniciar sesión para realizar esta acción."
    );
  }
}

/**
 * Valida que el usuario tenga uno de los roles permitidos.
 * @param {Object} request - Objeto request de Firebase.
 * @param {Array<string>} allowedRoles - Lista de roles permitidos (ej: ['Administrador', 'Jefe']).
 * @throws {HttpsError} Si el rol no es suficiente.
 */
function assertRole(request, allowedRoles) {
  assertAuth(request);
  const userRole = request.auth.token.role || "Usuario";
  if (!allowedRoles.includes(userRole)) {
    logger.warn(
      `Acceso denegado. Usuario: ${request.auth.uid}, Rol: ${userRole}, Requerido: ${allowedRoles}`
    );
    throw new HttpsError(
      "permission-denied",
      "No tienes permisos suficientes para realizar esta acción."
    );
  }
}

const GLOBAL_CLIENT_ROLES = [
  "Administrador",
  "Jefe",
  "Coordinador Nacionales",
  "Coordinador Nacional",
  "Gerente",
];

const CLIENT_MANAGER_ROLES = [
  ...GLOBAL_CLIENT_ROLES,
  "Coordinador Valle",
  "Coordinador Norte de Santander",
];

function assertClientManager(request) {
  assertRole(request, CLIENT_MANAGER_ROLES);
}

function hasGlobalClientAccess(request) {
  return GLOBAL_CLIENT_ROLES.includes(request.auth.token.role);
}

function clientBelongsToUserZone(client, request) {
  if (hasGlobalClientAccess(request)) return true;
  const userZone = request.auth.token.zona;
  const clientZones = Array.isArray(client.zonasDeSucursales)
    ? client.zonasDeSucursales
    : [client.zona];
  return Boolean(userZone && clientZones.includes(userZone));
}

async function getAuthorizedClient(request, clientId) {
  assertAuth(request);
  if (!clientId) {
    throw new HttpsError("invalid-argument", "El ID de cliente es obligatorio.");
  }
  const clientDoc = await db.collection("clientes").doc(clientId).get();
  if (!clientDoc.exists) {
    throw new HttpsError("not-found", "El cliente solicitado no existe.");
  }
  const client = clientDoc.data();
  if (!clientBelongsToUserZone(client, request)) {
    throw new HttpsError(
      "permission-denied",
      "No tienes permiso para acceder a este cliente."
    );
  }
  return { ref: clientDoc.ref, data: client, id: clientDoc.id };
}

/**
 * Crea un registro en la colección de auditoría (audit_logs).
 * @param {string} action - Nombre de la acción (ej: 'CREATE_CLIENT').
 * @param {string} details - Descripción detallada.
 * @param {Object} context - Contexto de la solicitud (auth, params).
 * @param {Object|null} target - Datos del objeto afectado.
 */
async function createAuditLog(action, details, context, target = null) {
  try {
    await db.collection("audit_logs").add({
      action: action,
      details: details,
      performedBy: context.auth ? context.auth.uid : "SYSTEM",
      performerEmail: context.auth ? context.auth.token.email : "SYSTEM",
      targetData: target ? JSON.stringify(target) : null,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      userAgent: context.rawRequest
        ? context.rawRequest.headers["user-agent"]
        : "Internal",
    });
  } catch (error) {
    logger.error("Error al crear log de auditoría:", error);
    // No lanzamos error para no interrumpir el flujo principal
  }
}
/**
 * Obtiene una lista paginada de clientes con filtros.
 * Esta función es segura y se basa en los permisos del usuario que la llama.
 */
exports.getClientsPage = onCall({ cors: true }, async (request) => {
  assertAuth(request);

  const {
    status,
    searchTerm,
    typeFilter,
    startAfterDocId,
    direction = "next",
    pageSize = 12,
    zone, // ✅ NUEVO: Recibir filtro de zona desde el frontend
  } = request.data;
  const { role: userRole, zona: userZone } = request.auth.token;

  logger.info("Solicitando página de clientes", {
    userRole,
    userZone,
    searchTerm,
    zone,
  });

  try {
    let query = db.collection("clientes");
    let constraints = [];

    // Filtros Básicos
    if (status && status !== "Todos") {
      constraints.push(admin.firestore.Filter.where("estado", "==", status));
    }
    if (typeFilter && typeFilter !== "Todos") {
      constraints.push(admin.firestore.Filter.where("tipo", "==", typeFilter));
    }

    // Filtros de Seguridad por Zona (Row Level Security manual)
    // ✅ CORRECCIÓN: Incluir Coordinador Nacional (singular y plural) como rol global
    const hasGlobalAccess = [
      "Administrador",
      "Jefe",
      "Coordinador Nacionales",
      "Coordinador Nacional",
      "Gerente"
    ].includes(userRole);

    if (!hasGlobalAccess && userZone) {
      // Si es coordinador regional, solo ve clientes de su zona
      constraints.push(
        admin.firestore.Filter.where(
          "zonasDeSucursales",
          "array-contains",
          userZone
        )
      );
    } else if (hasGlobalAccess && zone && zone !== "Todas") {
      // Si tiene acceso global y seleccionó una zona específica
      constraints.push(
        admin.firestore.Filter.where(
          "zonasDeSucursales",
          "array-contains",
          zone
        )
      );
    }

    // Aplicar filtros acumulados
    if (constraints.length > 0) {
      query = query.where(admin.firestore.Filter.and(...constraints));
    }

    // Búsqueda por texto (Nombre Comercial o NIT)
    if (searchTerm && String(searchTerm).trim()) {
      const rawTerm = String(searchTerm).trim();
      const nameTerm = rawTerm.toLowerCase();
      const nitTerm = rawTerm.replace(/\s+/g, "");
      const isNitSearch = /^[0-9.-]+$/.test(nitTerm);

      // Si el término parece NIT, buscar por prefijo en el campo nit.
      // En otro caso, conservar la búsqueda por nombre comercial.
      if (isNitSearch) {
        const nitEnd = nitTerm.replace(/.$/, (c) =>
          String.fromCharCode(c.charCodeAt(0) + 1)
        );
        query = query.where("nit", ">=", nitTerm).where("nit", "<", nitEnd).orderBy("nit");
      } else {
        // Truco de Firestore para búsqueda de prefijos
        const termEnd = nameTerm.replace(/.$/, (c) =>
          String.fromCharCode(c.charCodeAt(0) + 1)
        );
        query = query
          .where("nombreComercial_lower", ">=", nameTerm)
          .where("nombreComercial_lower", "<", termEnd)
          .orderBy("nombreComercial_lower");
      }
    } else {
      // Orden por defecto
      query = query.orderBy("nombreComercial");
    }

    // Paginación
    let paginatedQuery = query.limit(pageSize);
    if (direction === "next" && startAfterDocId) {
      const startAfterDoc = await db
        .collection("clientes")
        .doc(startAfterDocId)
        .get();
      if (startAfterDoc.exists) {
        paginatedQuery = paginatedQuery.startAfter(startAfterDoc);
      }
    }

    const snapshot = await paginatedQuery.get();
    const clients = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    return { clients: clients || [], count: clients.length };
  } catch (error) {
    logger.error("Error crítico en getClientsPage:", error);
    throw new HttpsError(
      "internal",
      "Error al consultar la base de datos de clientes.",
      error
    );
  }
});

/**
 * Tarea programada para enviar recordatorios de visitas a los técnicos.
 * Se ejecuta cada hora para verificar visitas del día siguiente.
 */
exports.sendVisitReminders = onSchedule(
  {
    schedule: "every 1 hours",
    timeZone: "America/Bogota",
  },
  async (event) => {
    const db = admin.firestore();
    const now = new Date();
    // Buscar visitas para dentro de 24 horas (aprox)
    const startWindow = new Date(now.getTime() + 23 * 60 * 60 * 1000);
    const endWindow = new Date(now.getTime() + 25 * 60 * 60 * 1000);

    logger.info(`[REMINDER] Buscando visitas entre ${startWindow.toISOString()} y ${endWindow.toISOString()}`);

    try {
      const visitsSnapshot = await db.collection("visitas")
        .where("estado_visita", "==", "Programada")
        .where("fecha_visita", ">=", startWindow)
        .where("fecha_visita", "<=", endWindow)
        .get();

      if (visitsSnapshot.empty) {
        logger.info("[REMINDER] No hay visitas próximas para recordar.");
        return;
      }

      const batchPromises = visitsSnapshot.docs.map(async (doc) => {
        const visit = doc.data();
        // Determinar organizador para usar sus credenciales de Gmail
        let organizerUid = null;
        if (visit.zona) {
           const roleMap = {
            "Valle del Cauca": "Coordinador Valle",
            "Norte de Santander": "Coordinador Norte de Santander",
            Nacionales: "Coordinador Nacionales",
          };
          const expectedRole = roleMap[visit.zona];
          if (expectedRole) {
             const users = await admin.auth().listUsers(1000);
             const coordinator = users.users.find(u => u.customClaims?.role === expectedRole);
             if (coordinator) organizerUid = coordinator.uid;
          }
        }
        // Fallback al creador si es coordinador
        if (!organizerUid) organizerUid = visit.createdBy;

        if (organizerUid && organizerUid !== 'SYSTEM') {
           // Reutilizamos la función de envío de correo existente
           await sendVisitNotificationViaGmailAPI(visit, doc.id, organizerUid);
           logger.info(`[REMINDER] Recordatorio enviado para visita ${doc.id}`);
        }
      });

      await Promise.all(batchPromises);
    } catch (error) {
      logger.error("[REMINDER] Error enviando recordatorios:", error);
    }
  }
);

/**
 * Obtiene todos los clientes de la base de datos (sin paginación).
 * Útil para exportaciones y validaciones de duplicados.
 */
exports.getAllClients = onCall({ cors: true }, async (request) => {
  assertAuth(request);

  try {
    let clientsQuery = db.collection("clientes");
    if (!hasGlobalClientAccess(request) && request.auth.token.zona) {
      clientsQuery = clientsQuery.where(
        "zonasDeSucursales",
        "array-contains",
        request.auth.token.zona
      );
    }
    const snapshot = await clientsQuery.get();
    const clients = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : null
      };
    });

    clients.sort((a, b) => String(a.nombreComercial || '').localeCompare(String(b.nombreComercial || '')))
    return { clients };
  } catch (error) {
    logger.error("Error en getAllClients:", error);
    throw new HttpsError("internal", "No se pudieron cargar todos los clientes.");
  }
});

/**
 * OBTENER CLIENTE POR ID (SOLUCIÓN AL ERROR 500)
 * Esta función estaba faltando o tenía un nombre incorrecto.
 */
exports.getClientById = onCall({ cors: true }, async (request) => {
  const { clientId } = request.data;

  try {
    const authorizedClient = await getAuthorizedClient(request, clientId);
    const clientData = { ...authorizedClient.data };

    // Serialización de fechas para evitar errores en el cliente
    const convertTimestampToISO = (key) => {
      if (clientData[key] && typeof clientData[key].toDate === "function") {
        clientData[key] = clientData[key].toDate().toISOString();
      }
    };
    convertTimestampToISO("createdAt");
    convertTimestampToISO("updatedAt");

    return { client: { id: authorizedClient.id, ...clientData } };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    logger.error(`Error obteniendo cliente ${clientId}:`, error);
    throw new HttpsError(
      "internal",
      "Error al recuperar los detalles del cliente."
    );
  }
});

/**
 * Añade un nuevo documento de cliente.
 */
exports.addClient = onCall({ cors: true }, async (request) => {
  assertClientManager(request);
  const { clientData } = request.data;

  // Validación básica de campos requeridos
  if (!clientData.nombreComercial)
    throw new HttpsError(
      "invalid-argument",
      "El Nombre Comercial es obligatorio."
    );
  if (!clientData.nit)
    throw new HttpsError("invalid-argument", "El NIT es obligatorio.");
  if (!hasGlobalClientAccess(request) && !clientBelongsToUserZone(clientData, request)) {
    throw new HttpsError("permission-denied", "No puedes crear clientes fuera de tu zona.");
  }

  try {
    // Verificar duplicados por NIT
    const duplicateCheck = await db
      .collection("clientes")
      .where("nit", "==", clientData.nit)
      .get();
    if (!duplicateCheck.empty) {
      throw new HttpsError(
        "already-exists",
        `Ya existe un cliente con el NIT ${clientData.nit}`
      );
    }

    const dataToSave = {
      ...clientData,
      nombreComercial_lower: clientData.nombreComercial.toLowerCase(),
      estado: clientData.estado || "Activo",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: request.auth.uid,
    };

    const docRef = await db.collection("clientes").add(dataToSave);

    await createAuditLog(
      "CREATE_CLIENT",
      `Cliente creado: ${clientData.nombreComercial}`,
      request,
      { id: docRef.id }
    );

    return { success: true, clientId: docRef.id };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    logger.error("Error en addClient:", error);
    throw new HttpsError("internal", "No se pudo crear el cliente.");
  }
});
/**
 * Actualiza un documento de cliente.
 */
exports.updateClient = onCall({ cors: true }, async (request) => {
  assertClientManager(request);
  const { clientId, clientData } = request.data;

  if (!clientId)
    throw new HttpsError("invalid-argument", "ID de cliente requerido.");

  try {
    const authorizedClient = await getAuthorizedClient(request, clientId);
    if (
      !hasGlobalClientAccess(request) &&
      clientData.zonasDeSucursales &&
      !clientBelongsToUserZone(clientData, request)
    ) {
      throw new HttpsError("permission-denied", "No puedes mover el cliente fuera de tu zona.");
    }
    const updatePayload = {
      ...clientData,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: request.auth.uid,
    };

    // Actualizar campo de búsqueda si cambió el nombre
    if (clientData.nombreComercial) {
      updatePayload.nombreComercial_lower =
        clientData.nombreComercial.toLowerCase();
    }

    await db.collection("clientes").doc(clientId).update(updatePayload);

    await createAuditLog(
      "UPDATE_CLIENT",
      `Cliente actualizado: ${clientId}`,
      request,
      updatePayload
    );

    return { success: true };
  } catch (error) {
    logger.error("Error en updateClient:", error);
    throw new HttpsError("internal", "Error al actualizar el cliente.");
  }
});

/**
 * Obtiene una lista paginada de técnicos (fumigadores).
 */
exports.getFumigadoresPage = onCall({ cors: true }, async (request) => {
  assertAuth(request);
  const { searchTerm, startAfterDocId, zone } = request.data;
  const { role: userRole, zona: userZone } = request.auth.token;
  const PAGE_SIZE = 20;

  try {
    // Validar que el usuario tenga permiso para ver esa zona
    const isAdmin = ["Administrador", "Jefe", "Coordinador Nacionales"].includes(userRole);
    let requestedZone = zone;
    if (!isAdmin && userZone && zone && zone !== userZone) {
      throw new HttpsError("permission-denied", "No tienes permiso para ver técnicos de otra zona.");
    }
    // Coordinadores de zona solo ven su zona
    if (!isAdmin && userZone && !requestedZone) {
      requestedZone = userZone;
    }

    let query = db.collection("fumigadores");

    if (requestedZone && requestedZone !== "Todos") {
      query = query.where("zona", "==", requestedZone);
    }

    if (searchTerm) {
      const termEnd = searchTerm.replace(/.$/, (c) =>
        String.fromCharCode(c.charCodeAt(0) + 1)
      );
      query = query
        .where("nombreCompleto_lower", ">=", searchTerm.toLowerCase())
        .where("nombreCompleto_lower", "<", termEnd)
        .orderBy("nombreCompleto_lower");
    } else {
      query = query.orderBy("nombreCompleto");
    }

    if (startAfterDocId) {
      const doc = await db.collection("fumigadores").doc(startAfterDocId).get();
      if (doc.exists) query = query.startAfter(doc);
    }

    const snapshot = await query.limit(PAGE_SIZE).get();
    return {
      technicians: snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
    };
  } catch (error) {
    logger.error("Error fetching technicians:", error);
    throw new HttpsError("internal", "Error cargando técnicos.");
  }
});

/**
 * Añade un nuevo técnico (fumigador).
 */
exports.addFumigador = onCall({ cors: true }, async (request) => {
  assertRole(request, [
    "Administrador",
    "Jefe",
    "Coordinador Nacionales",
    "Coordinador Valle",
    "Coordinador Norte de Santander",
  ]);

  const { technicianData } = request.data;
  const { zona: userZone, role: userRole } = request.auth.token;

  try {
    // Validar campos obligatorios
    if (!technicianData.nombreCompleto || !technicianData.nombreCompleto.trim()) {
      throw new HttpsError("invalid-argument", "El nombre del técnico es obligatorio.");
    }
    if (!technicianData.email || !technicianData.email.trim()) {
      throw new HttpsError("invalid-argument", "El correo electrónico es obligatorio.");
    }
    if (!technicianData.zona || !["Norte de Santander", "Valle del Cauca", "Nacionales"].includes(technicianData.zona)) {
      throw new HttpsError("invalid-argument", "La zona es obligatoria y debe ser válida.");
    }
    if (!technicianData.googleColorId || !["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11"].includes(String(technicianData.googleColorId))) {
      throw new HttpsError("invalid-argument", "El color de calendario debe ser válido.");
    }
    // Validar formato de email
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(technicianData.email)) {
      throw new HttpsError("invalid-argument", "El formato del correo electrónico es inválido.");
    }
    // Coordinadores de zona solo pueden crear en su zona
    const isAdmin = ["Administrador", "Jefe", "Coordinador Nacionales"].includes(userRole);
    if (!isAdmin && userZone && technicianData.zona !== userZone) {
      throw new HttpsError("permission-denied", "Solo puedes crear técnicos en tu zona.");
    }
    // Verificar que no exista técnico con mismo nombre
    const nameQuery = await db.collection("fumigadores")
      .where("nombreCompleto_lower", "==", technicianData.nombreCompleto.toLowerCase())
      .limit(1)
      .get();
    if (!nameQuery.empty) {
      throw new HttpsError("already-exists", "Ya existe un técnico con ese nombre.");
    }
    // Verificar que no exista técnico con mismo email
    const emailQuery = await db.collection("fumigadores")
      .where("email", "==", technicianData.email)
      .limit(1)
      .get();
    if (!emailQuery.empty) {
      throw new HttpsError("already-exists", "Ya existe un técnico con ese correo electrónico.");
    }

    const data = {
      ...technicianData,
      nombreCompleto_lower: technicianData.nombreCompleto.toLowerCase(),
      email: technicianData.email.toLowerCase(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      status: "Active",
    };
    const res = await db.collection("fumigadores").add(data);
    await createAuditLog(
      "CREATE_TECHNICIAN",
      `Técnico creado: ${technicianData.nombreCompleto}`,
      request
    );
    return { success: true, technicianId: res.id };
  } catch (e) {
    throw new HttpsError("internal", e.message);
  }
});

/**
 * Actualiza un técnico (fumigador).
 */
exports.updateFumigador = onCall({ cors: true }, async (request) => {
  assertRole(request, [
    "Administrador",
    "Jefe",
    "Coordinador Nacionales",
    "Coordinador Valle",
    "Coordinador Norte de Santander",
  ]);
  const { technicianId, technicianData } = request.data;
  const { zona: userZone, role: userRole } = request.auth.token;

  try {
    // Obtener técnico actual para validaciones
    const currentDoc = await db.collection("fumigadores").doc(technicianId).get();
    if (!currentDoc.exists) {
      throw new HttpsError("not-found", "Técnico no encontrado.");
    }
    const currentData = currentDoc.data();
    const isAdmin = ["Administrador", "Jefe", "Coordinador Nacionales"].includes(userRole);
    if (!isAdmin && userZone && currentData.zona !== userZone) {
      throw new HttpsError("permission-denied", "No tienes permiso para actualizar un técnico de otra zona.");
    }
    // Validar campos si se proporcionan
    if (technicianData.nombreCompleto !== undefined) {
      if (!technicianData.nombreCompleto || !technicianData.nombreCompleto.trim()) {
        throw new HttpsError("invalid-argument", "El nombre del técnico no puede estar vacío.");
      }
      if (technicianData.nombreCompleto.toLowerCase() !== currentData.nombreCompleto_lower) {
        const nameQuery = await db.collection("fumigadores")
          .where("nombreCompleto_lower", "==", technicianData.nombreCompleto.toLowerCase())
          .limit(1)
          .get();
        if (!nameQuery.empty) {
          throw new HttpsError("already-exists", "Ya existe un técnico con ese nombre.");
        }
      }
    }
    if (technicianData.email !== undefined) {
      if (!technicianData.email || !technicianData.email.trim()) {
        throw new HttpsError("invalid-argument", "El correo electrónico no puede estar vacío.");
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(technicianData.email)) {
        throw new HttpsError("invalid-argument", "El formato del correo electrónico es inválido.");
      }
      if (technicianData.email !== currentData.email) {
        const emailQuery = await db.collection("fumigadores")
          .where("email", "==", technicianData.email)
          .limit(1)
          .get();
        if (!emailQuery.empty) {
          throw new HttpsError("already-exists", "Ya existe un técnico con ese correo electrónico.");
        }
      }
    }
    if (technicianData.zona !== undefined) {
      if (!["Norte de Santander", "Valle del Cauca", "Nacionales"].includes(technicianData.zona)) {
        throw new HttpsError("invalid-argument", "La zona debe ser válida.");
      }
      if (!isAdmin && userZone && technicianData.zona !== userZone) {
        throw new HttpsError("permission-denied", "Solo puedes asignar técnicos a tu zona.");
      }
    }
    if (technicianData.googleColorId !== undefined) {
      if (!["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11"].includes(String(technicianData.googleColorId))) {
        throw new HttpsError("invalid-argument", "El color de calendario debe ser válido.");
      }
    }

    const updateData = { ...technicianData };
    if (technicianData.nombreCompleto) {
      updateData.nombreCompleto_lower = technicianData.nombreCompleto.toLowerCase();
    }
    if (technicianData.email) {
      updateData.email = technicianData.email.toLowerCase();
    }
    updateData.updatedAt = admin.firestore.FieldValue.serverTimestamp();

    await db
      .collection("fumigadores")
      .doc(technicianId)
      .update(updateData);
    return { success: true };
  } catch (e) {
    throw new HttpsError("internal", e.message);
  }
});

/**
 * Elimina un técnico (fumigador).
 */
exports.deleteFumigador = onCall({ cors: true }, async (request) => {
  assertRole(request, ["Administrador", "Jefe"]);
  const { technicianId } = request.data;
  const { zona: userZone, role: userRole } = request.auth.token;

  try {
    const techDoc = await db.collection("fumigadores").doc(technicianId).get();
    if (!techDoc.exists) {
      throw new HttpsError("not-found", "Técnico no encontrado.");
    }
    const techData = techDoc.data();
    const isAdmin = userRole === "Administrador" || userRole === "Jefe";
    if (!isAdmin && userZone && techData.zona !== userZone) {
      throw new HttpsError("permission-denied", "No tienes permiso para eliminar un técnico de otra zona.");
    }
    // Verificar que el técnico no tenga visitas pendientes
    const technicianName = techData.nombreCompleto;
    const pendingVisits = await db.collection("visitas")
      .where("fumigadores_asignados", "array-contains", technicianName)
      .where("estado_visita", "==", "Programada")
      .limit(1)
      .get();
    if (!pendingVisits.empty) {
      throw new HttpsError("failed-precondition", "No se puede eliminar un técnico con visitas pendientes. Por favor, reasigna o completa sus visitas primero.");
    }

    await db.collection("fumigadores").doc(technicianId).delete();
    await createAuditLog(
      "DELETE_TECHNICIAN",
      `Técnico eliminado ID: ${technicianId}`,
      request
    );
    return { success: true };
  } catch (e) {
    throw new HttpsError("internal", e.message);
  }
});

/**
 * Obtiene los datos de negocio (listas de aliados, zonas, etc.)
 */
exports.getBusinessData = onCall({ cors: true }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Auth requerida.");
  const doc = await db.collection("settings").doc("businessData").get();
  return doc.exists ? doc.data() : {};
});

async function sendVisitNotificationViaGmailAPI(
  visitData,
  visitId,
  organizerUid
) {
  logger.info(
    `[ESPÍA/sendMail] Iniciando para visita ${visitId} con organizador ${organizerUid}.`
  );

  const fumigadoresAsignados = visitData.fumigadores_asignados || [];
  if (fumigadoresAsignados.length === 0) return;

  try {
    const fumigadoresSnapshot = await admin
      .firestore()
      .collection("fumigadores")
      .where("nombreCompleto", "in", fumigadoresAsignados)
      .get();

    logger.info(
      `[ESPÍA/sendMail] Se encontraron ${fumigadoresSnapshot.size} técnicos en la BD para la visita ${visitId}.`
    );

    const emailsToSend = [];
    const attendees = [];
    fumigadoresSnapshot.forEach((doc) => {
      if (doc.data().email) {
        emailsToSend.push(doc.data().email);
        attendees.push(
          `ATTENDEE;CN="${doc.data().nombreCompleto}";RSVP=TRUE:mailto:${
            doc.data().email
          }`
        );
      }
    });

    if (emailsToSend.length === 0) {
      logger.warn(
        `[ESPÍA/sendMail] ADVERTENCIA: No se encontraron correos para los técnicos.`
      );
      return;
    }

    const organizerAccountDoc = await admin
      .firestore()
      .collection("calendar_integrations")
      .doc(organizerUid)
      .get();
    if (!organizerAccountDoc.exists)
      throw new Error(`Integración no encontrada para ${organizerUid}`);

    const tokens = organizerAccountDoc.data();
    const oAuth2Client = new google.auth.OAuth2(
      googleConfig.clientId,
      googleConfig.clientSecret
    );
    oAuth2Client.setCredentials(tokens);
    const gmail = google.gmail({ version: "v1", auth: oAuth2Client });

    const visitDate = visitData.fecha_visita.toDate();
    const endDate = new Date(visitDate.getTime() + 60 * 60 * 1000);
    const formatDateForICS = (date) =>
      date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    const organizerName = tokens.googleUserName;
    const organizerEmail = tokens.googleEmail;

    // --- CONSTRUCCIÓN DEL HTML ENRIQUECIDO ---
    const encodedAddress = encodeURIComponent(visitData.ubicacion);
    const mapsLink = `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;

    const htmlBody = `
      <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px;">
        <h2 style="color: #2563eb;">Nueva Visita Asignada</h2>
        <p>Hola, se te ha asignado una nueva visita técnica.</p>
        <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">

        <p><strong>Cliente:</strong> ${escapeHTML(visitData.nombre_cliente)}</p>
        <p><strong>Servicio:</strong> ${escapeHTML(visitData.tipo_visita)}</p>
        <p><strong>Fecha:</strong> ${visitDate.toLocaleString("es-CO", {
          timeZone: "America/Bogota",
        })}</p>
        <p><strong>Ubicación:</strong> <a href="${mapsLink}" style="color: #2563eb;">${escapeHTML(
      visitData.ubicacion
    )}</a></p>

        ${
          visitData.fumigadores_asignados?.length
            ? `<p><strong>Equipo:</strong> ${escapeHTML(
                visitData.fumigadores_asignados.join(", ")
              )}</p>`
            : ""
        }
        ${
          visitData.notas_visita
            ? `<div style="background: #f3f4f6; padding: 10px; border-radius: 5px; margin-top: 10px;"><strong>Notas:</strong><br>${escapeHTML(
                visitData.notas_visita
              )}</div>`
            : ""
        }

        <p style="margin-top: 20px; font-size: 0.9em; color: #666;">
          Por favor, acepta la invitación adjunta para añadir este evento a tu calendario.
        </p>
      </div>
    `;

    const icsContent = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "METHOD:REQUEST",
      "BEGIN:VEVENT",
      `UID:${visitId}@sisfumi.com`,
      `ORGANIZER;CN="${organizerName}":mailto:${organizerEmail}`,
      ...attendees,
      `DTSTART:${formatDateForICS(visitDate)}`,
      `DTEND:${formatDateForICS(endDate)}`,
      `SUMMARY:Visita: ${visitData.nombre_cliente}`,
      `DESCRIPTION:${visitData.tipo_visita} - ${visitData.ubicacion}`,
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");

    const subject = `Visita Asignada: ${visitData.nombre_cliente}`;

    const uniqueBoundary = `boundary_${Date.now().toString(16)}`;

    // CAMBIO IMPORTANTE: Usamos multipart/mixed para que el HTML sea el cuerpo y el ICS un adjunto
    const mailParts = [
      `From: =?utf-8?B?${Buffer.from(organizerName).toString(
        "base64"
      )}?= <${organizerEmail}>`,
      `To: ${emailsToSend.join(", ")}`,
      `Subject: =?utf-8?B?${Buffer.from(subject).toString("base64")}?=`,
      "MIME-Version: 1.0",
      `Content-Type: multipart/mixed; boundary="${uniqueBoundary}"`,
      "",
      `--${uniqueBoundary}`,
      "Content-Type: text/html; charset=UTF-8",
      "",
      htmlBody,
      "",
      `--${uniqueBoundary}`,
      'Content-Type: text/calendar; charset=UTF-8; method=REQUEST; name="invitacion.ics"',
      'Content-Disposition: attachment; filename="invitacion.ics"',
      "",
      icsContent,
      "",
      `--${uniqueBoundary}--`,
    ];

    const rawMail = Buffer.from(mailParts.join("\r\n"))
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    await gmail.users.messages.send({
      userId: "me",
      requestBody: { raw: rawMail },
    });
    logger.info(`[ESPÍA/sendMail] ¡ÉXITO! Correo único enviado.`);
  } catch (error) {
    logger.error(`Error sendVisitNotificationViaGmailAPI:`, error);
  }
}

/**
 * Construye el objeto de recurso para un evento de Google Calendar.
 * @param {object} visitData - Los datos de la visita.
 * @param {Array<string>} attendeeEmails - Un array de correos de los técnicos a invitar.
 * @param {string} [colorId="8"] - El ID de color para el evento.
 * @returns {object} El recurso del evento listo para la API de Google.
 */
function buildEventResource(visitData, attendeeEmails = [], colorId = "8") {
  const visitDate = visitData.fecha_visita.toDate();
  const endTime = new Date(visitDate.getTime() + 60 * 60 * 1000);

  const attendees = attendeeEmails.map((email) => ({ email }));

  const encodedAddress = encodeURIComponent(visitData.ubicacion);
  const mapsLink = `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;
  const descriptionParts = [
    `<b>-- DETALLES DE LA VISITA --</b>`,
    `\n`,
    `<b>Cliente:</b>`,
    escapeHTML(visitData.nombre_cliente),
    `\n`,
    `<b>Tipo de Servicio:</b>`,
    escapeHTML(visitData.tipo_visita),
    `\n`,
    `<b>Ubicación:</b>`,
    `${escapeHTML(visitData.ubicacion)}`,
    `(<a href="${mapsLink}">Ver en Google Maps</a>)`,
  ];

  if (
    visitData.fumigadores_asignados &&
    visitData.fumigadores_asignados.length > 0
  ) {
    descriptionParts.push(
      `\n`,
      `<b>Técnicos Asignados:</b>`,
      escapeHTML(visitData.fumigadores_asignados.join(", "))
    );
  }

  if (visitData.notas_visita) {
    descriptionParts.push(
      `\n`,
      `<b>Notas Adicionales:</b>`,
      escapeHTML(visitData.notas_visita)
    );
  }

  descriptionParts.push(
    `\n\n----------------------------------------------------`,
    `\n<i>Este es un evento automático de SISFUMI.</i>`
  );

  return {
    summary: `Visita: ${visitData.nombre_cliente}`,
    description: descriptionParts.join("\n"),
    start: { dateTime: visitDate.toISOString(), timeZone: "America/Bogota" },
    end: { dateTime: endTime.toISOString(), timeZone: "America/Bogota" },
    attendees: attendees,
    colorId: colorId,
    extendedProperties: {
      private: { useHtml: "true" },
    },
    reminders: {
      useDefault: false,
      overrides: [{ method: "popup", minutes: 30 }],
    },
  };
}

async function createOrUpdateCalendarEvent(visitData, visitId, uid) {
  try {
    logger.info(
      `[ESPÍA/calendar] Iniciando evento para visita ${visitId} en calendario de ${uid}.`
    );

    const integrationDoc = await admin
      .firestore()
      .collection("calendar_integrations")
      .doc(uid)
      .get();
    if (!integrationDoc.exists) {
      throw new Error(
        `La integración de calendario para el organizador con UID '${uid}' no fue encontrada.`
      );
    }

    const tokens = integrationDoc.data();
    const oAuth2Client = new google.auth.OAuth2(
      googleConfig.clientId,
      googleConfig.clientSecret
    );
    oAuth2Client.setCredentials(tokens);
    const calendar = google.calendar({ version: "v3", auth: oAuth2Client });

    let eventColorId = "8";
    let attendeeEmails = [];
    if (
      visitData.fumigadores_asignados &&
      visitData.fumigadores_asignados.length > 0
    ) {
      const fumigadoresSnapshot = await db
        .collection("fumigadores")
        .where("nombreCompleto", "in", visitData.fumigadores_asignados)
        .get();

      const primaryTechnicianName = visitData.fumigadores_asignados[0];
      let primaryTechnicianFound = false;

      fumigadoresSnapshot.forEach((doc) => {
        const techData = doc.data();
        if (techData.email) {
          attendeeEmails.push(techData.email);
        }
        if (
          !primaryTechnicianFound &&
          techData.nombreCompleto === primaryTechnicianName &&
          techData.googleColorId
        ) {
          eventColorId = techData.googleColorId;
          primaryTechnicianFound = true;
        }
      });
    }

    const eventResource = buildEventResource(
      visitData,
      attendeeEmails,
      eventColorId
    );
    logger.info(`[ESPÍA/calendar] Recurso del evento construido:`, {
      summary: eventResource.summary,
    });

    if (visitData.googleEventId) {
      logger.info(
        `[ESPÍA/calendar] Actualizando evento ${visitData.googleEventId}.`
      );
      await calendar.events.update({
        calendarId: "primary",
        eventId: visitData.googleEventId,
        sendUpdates: "none", // API v3 Moderno
        sendNotifications: false, // API Legacy (Redundancia)
        resource: eventResource,
      });
      return visitData.googleEventId;
    } else {
      logger.info(`[ESPÍA/calendar] Creando nuevo evento.`);

      // ✅ SOLUCIÓN: Generar un ID determinista para Google Calendar basado en el ID de la visita.
      // Esto evita duplicados si la función se ejecuta varias veces.
      // Google requiere caracteres [a-v0-9], así que usamos hex.
      const deterministicId = `v${Buffer.from(visitId).toString('hex')}`;
      eventResource.id = deterministicId;

      try {
        const createdEvent = await calendar.events.insert({
          calendarId: "primary",
          resource: eventResource,
          sendUpdates: "none",
          sendNotifications: false,
        });

        await admin.firestore().collection("visitas").doc(visitId).update({ googleEventId: createdEvent.data.id });
        logger.info(`[ESPÍA/calendar] Evento creado con ID: ${createdEvent.data.id}.`);
        return createdEvent.data.id;
      } catch (insertError) {
        // Si el evento ya existe (error 409), recuperamos el control y actualizamos Firestore si hace falta.
        if (insertError.code === 409) {
          logger.warn(`[ESPÍA/calendar] El evento ${deterministicId} ya existía (Idempotencia). Vinculando en Firestore.`);
          await admin.firestore().collection("visitas").doc(visitId).update({ googleEventId: deterministicId });
          return deterministicId;
        }
        throw insertError;
      }
    }
  } catch (error) {
    logger.error(`Error createOrUpdateCalendarEvent:`, error);
    if (error.code === 401 || error.code === 400) {
      logger.warn(
        `[AUTH_FIX] Token de Google inválido para UID ${uid}. Eliminando integración.`
      );
      await admin
        .firestore()
        .collection("calendar_integrations")
        .doc(uid)
        .delete();
    }
  }
}
async function deleteCalendarEvent(visitData, uid) {
  try {
    const integrationDoc = await admin
      .firestore()
      .collection("calendar_integrations")
      .doc(uid)
      .get();
    if (!integrationDoc.exists || !visitData.googleEventId) return;

    // CORRECCIÓN: Usar googleConfig
    const oAuth2Client = new google.auth.OAuth2(
      googleConfig.clientId,
      googleConfig.clientSecret
    );
    oAuth2Client.setCredentials(integrationDoc.data());
    const calendar = google.calendar({ version: "v3", auth: oAuth2Client });

    await calendar.events.delete({
      calendarId: "primary",
      eventId: visitData.googleEventId,
      sendNotifications: true,
    });
  } catch (error) {
    if (error.code !== 410) logger.error("Error deleteCalendarEvent", error);
  }
}
// --- El resto de las funciones (Triggers, Callables, etc.) sigue aquí sin cambios ---
// ... (pegar el resto de las funciones desde tu archivo actual) ...
/**
 * Elimina un cliente y todos sus datos asociados (visitas, servicios).
 * Esta es una operación destructiva y debe ser llamada con precaución.
 */
exports.deleteClientAndRelatedData = onCall({ cors: true }, async (request) => {
  assertRole(request, ["Administrador", "Jefe"]);
  const { clientId } = request.data;

  try {
    await getAuthorizedClient(request, clientId);

    // 1. Eliminar Visitas
    const visitsSnap = await db
      .collection("visitas")
      .where("id_cliente", "==", clientId)
      .get();
    const documentsToDelete = [
      ...visitsSnap.docs,
    ];

    // 2. Eliminar Fichas de Servicio
    const servicesSnap = await db
      .collection("servicios")
      .where("clientId", "==", clientId)
      .get();
    documentsToDelete.push(...servicesSnap.docs);

    // 3. Eliminar Facturas (Opcional, a veces se prefiere mantener por histórico contable)
    // En este caso, NO eliminamos facturas para mantener integridad fiscal.

    // 4. Eliminar Cliente
    documentsToDelete.push(db.collection("clientes").doc(clientId));

    // Firestore limita cada batch a 500 operaciones.
    for (let index = 0; index < documentsToDelete.length; index += 450) {
      const batch = db.batch();
      documentsToDelete.slice(index, index + 450).forEach((docRef) => batch.delete(docRef));
      await batch.commit();
    }

    await createAuditLog(
      "DELETE_CLIENT",
      `Cliente eliminado permanentemente: ${clientId}`,
      request
    );

    return {
      success: true,
      message: "Cliente y datos relacionados eliminados.",
    };
  } catch (error) {
    logger.error("Error en deleteClientAndRelatedData:", error);
    throw new HttpsError("internal", error.message);
  }
});

exports.listAllUsers = onCall({ cors: true }, async (request) => {
  assertAuth(request);
  try {
    const listUsersResult = await admin.auth().listUsers(1000);

    // Mapear info extra de integraciones
    const integrationsSnapshot = await db
      .collection("calendar_integrations")
      .get();
    const integrationsMap = new Map();
    integrationsSnapshot.forEach((d) => integrationsMap.set(d.id, d.data()));

    const users = listUsersResult.users.map((u) => ({
      uid: u.uid,
      email: u.email,
      displayName: u.displayName || "Sin nombre",
      photoURL: u.photoURL,
      role: u.customClaims?.role || "Usuario",
      zona: u.customClaims?.zona || "N/A",
      disabled: u.disabled,
      lastSignInTime: u.metadata.lastSignInTime,
      creationTime: u.metadata.creationTime,
      isConnected: integrationsMap.has(u.uid),
    }));
    return { users };
  } catch (e) {
    throw new HttpsError("internal", e.message);
  }
});

exports.listCalendarIntegrations = onCall({ cors: true }, async (request) => {
  const { auth } = request;
  if (!auth) {
    throw new HttpsError("unauthenticated", "No estás autenticado.");
  }
  const requestingUserRole = auth.token.role;
  const allowedRoles = [
    "Administrador",
    "Jefe",
    "Coordinador Nacionales",
    "Coordinador Nacional",
    "Gerente",
  ];
  if (!allowedRoles.includes(requestingUserRole)) {
    throw new HttpsError(
      "permission-denied",
      "No tienes permiso para realizar esta acción."
    );
  }

  try {
    const integrationsSnapshot = await admin
      .firestore()
      .collection("calendar_integrations")
      .get();

    // Obtener los UIDs de las integraciones para buscar sus datos de usuario
    const uids = integrationsSnapshot.docs.map((doc) => doc.id);
    if (uids.length === 0) {
      return { integrations: [] };
    }

    const userRecords = await admin
      .auth()
      .getUsers(uids.map((uid) => ({ uid })));
    const usersByUid = new Map(
      userRecords.users.map((user) => [user.uid, user])
    );

    const integrations = integrationsSnapshot.docs.map((doc) => {
      const integrationData = doc.data();
      const user = usersByUid.get(doc.id);
      return {
        uid: doc.id,
        ...integrationData,
        zona: user?.customClaims?.zona || null, // Añadir la zona del usuario
      };
    });
    return { integrations };
  } catch (error) {
    console.error("Error al listar integraciones de calendario:", error);
    throw new HttpsError(
      "internal",
      "No se pudieron listar las integraciones."
    );
  }
});

/**
 * =================================================================================
 * FUNCIÓN PARA OBTENER EL HISTORIAL DE UNA VISITA
 * Esta es la función que faltaba y que causaba el error de CORS e 'internal'.
 * =================================================================================
 */
exports.getVisitHistory = onCall({ cors: true }, async (request) => {
  // 1. Validar que el usuario está autenticado.
  if (!request.auth) {
    throw new HttpsError(
      "unauthenticated",
      "La función debe ser llamada por un usuario autenticado."
    );
  }

  const { visitId } = request.data;
  if (!visitId) {
    throw new HttpsError(
      "invalid-argument",
      "Se requiere un 'visitId' para obtener el historial."
    );
  }

  try {
    // 2. Consultar la subcolección 'history' de la visita.
    const historySnapshot = await db
      .collection("visitas") // <-- CORRECCIÓN: La colección es 'visitas', no 'sisfumi-visits'
      .doc(visitId)
      .collection("history")
      .orderBy("timestamp", "desc") // Ordenar del más reciente al más antiguo
      .get();

    // 3. Mapear los documentos a un formato JSON limpio.
    const history = historySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    // 4. Devolver el historial.
    return { history };
  } catch (error) {
    logger.error(
      `Error al obtener el historial para la visita ${visitId}:`,
      error
    );
    throw new HttpsError(
      "internal",
      "No se pudo recuperar el historial de la visita."
    );
  }
});

/**
 * =================================================================================
 * FUNCIÓN PARA ACTUALIZAR LA CONFIGURACIÓN DE UN USUARIO (ROL, ZONA, COLOR)
 * Reemplaza a setUserRole para manejar también el color.
 * =================================================================================
 */
exports.updateUserConfiguration = onCall({ cors: true }, async (request) => {
  assertRole(request, ["Administrador", "Jefe"]);
  const { uid, role, zona, color } = request.data;

  if (!uid || !role) {
    throw new HttpsError("invalid-argument", "Se requieren UID y rol.");
  }

  try {
    const user = await admin.auth().getUser(uid);

    // 1. Actualizar Custom Claims (Rol y Zona)
    const claims = { role };
    if (zona) {
      claims.zona = zona;
    }
    await admin.auth().setCustomUserClaims(uid, claims);

    // 2. Actualizar el color en la colección de fumigadores
    // Buscamos al fumigador por su email para encontrar el documento correcto.
    const fumigadoresRef = db.collection("fumigadores");
    const userEmail = user.email;
    if (userEmail) {
      const fumigadorQuery = await fumigadoresRef
        .where("email", "==", userEmail)
        .limit(1)
        .get();
      if (!fumigadorQuery.empty) {
        const fumigadorDoc = fumigadorQuery.docs[0];
        await fumigadorDoc.ref.update({ color: color || null });
      }
    }

    await createAuditLog(
      "UPDATE_USER_CONFIG",
      `Configuración de usuario actualizada para ${user.email}`,
      request,
      { uid, role, zona, color }
    );
    return { success: true, message: "Configuración de usuario actualizada." };
  } catch (error) {
    logger.error(`Error actualizando configuración para UID ${uid}:`, error);
    throw new HttpsError(
      "internal",
      "No se pudo actualizar la configuración del usuario."
    );
  }
});

/**
 * =================================================================================
 * GESTIÓN DE PLANTILLAS DE VISITA
 * Funciones para crear, leer, actualizar y eliminar plantillas de visita.
 * =================================================================================
 */

/**
 * Obtiene todas las plantillas de visita disponibles.
 */
exports.getVisitTemplates = onCall({ cors: true }, async (request) => {
  assertAuth(request);
  try {
    const snapshot = await db
      .collection("visit_templates")
      .orderBy("templateName")
      .get();
    const templates = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    return { templates };
  } catch (error) {
    logger.error("Error al obtener las plantillas de visita:", error);
    throw new HttpsError("internal", "No se pudieron obtener las plantillas.");
  }
});

/**
 * Guarda (crea o actualiza) una plantilla de visita.
 */
exports.saveVisitTemplate = onCall({ cors: true }, async (request) => {
  assertRole(request, ["Administrador", "Jefe"]);
  const { templateData } = request.data;

  if (!templateData || !templateData.templateName) {
    throw new HttpsError(
      "invalid-argument",
      "El nombre de la plantilla es obligatorio."
    );
  }

  try {
    const { id, ...data } = templateData;
    const collectionRef = db.collection("visit_templates");

    if (id) {
      // Actualizar plantilla existente
      await collectionRef.doc(id).update({
        ...data,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      await createAuditLog(
        "UPDATE_VISIT_TEMPLATE",
        `Plantilla actualizada: ${data.templateName}`,
        request
      );
      return { success: true, templateId: id };
    } else {
      // Crear nueva plantilla
      const docRef = await collectionRef.add({
        ...data,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      await createAuditLog(
        "CREATE_VISIT_TEMPLATE",
        `Plantilla creada: ${data.templateName}`,
        request
      );
      return { success: true, templateId: docRef.id };
    }
  } catch (error) {
    logger.error("Error al guardar la plantilla de visita:", error);
    throw new HttpsError("internal", "No se pudo guardar la plantilla.");
  }
});

/**
 * Elimina una plantilla de visita.
 */
exports.deleteVisitTemplate = onCall({ cors: true }, async (request) => {
  assertRole(request, ["Administrador", "Jefe"]);
  const { templateId } = request.data;

  if (!templateId) {
    throw new HttpsError(
      "invalid-argument",
      "Se requiere el ID de la plantilla."
    );
  }

  try {
    const docRef = db.collection("visit_templates").doc(templateId);
    const doc = await docRef.get();
    if (!doc.exists) {
      throw new HttpsError("not-found", "La plantilla no fue encontrada.");
    }
    const templateName = doc.data().templateName;

    await docRef.delete();
    await createAuditLog(
      "DELETE_VISIT_TEMPLATE",
      `Plantilla eliminada: ${templateName}`,
      request
    );

    return { success: true };
  } catch (error) {
    logger.error(`Error al eliminar la plantilla ${templateId}:`, error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", "No se pudo eliminar la plantilla.");
  }
});

exports.deleteVisitAndCalendarEvent = onCall(
  { cors: true },
  async (request) => {
    assertAuth(request);
    const { visitId } = request.data;

    const visitRef = db.collection("visitas").doc(visitId);
    try {
      const visitDoc = await visitRef.get();
      if (!visitDoc.exists) return { message: "La visita no existía." };

      const visitData = visitDoc.data();

      // Lógica para determinar quién es el dueño del calendario
      let organizerUid = null;
      if (visitData.zona) {
        const roleMap = {
          "Valle del Cauca": "Coordinador Valle",
          "Norte de Santander": "Coordinador Norte de Santander",
          Nacionales: "Coordinador Nacionales",
        };
        const expectedRole = roleMap[visitData.zona];
        if (expectedRole) {
          // Buscar usuario con ese rol (Costoso, optimizar en v3)
          const userRecords = await admin.auth().listUsers(1000);
          const coordinator = userRecords.users.find(
            (u) => u.customClaims?.role === expectedRole
          );
          if (coordinator) organizerUid = coordinator.uid;
        }
      }

      // Fallback si no hay zona
      if (!organizerUid)
        organizerUid = visitData.calendarOwnerUid || visitData.createdBy;

      // Intentar borrar evento de calendario
      if (
        visitData.googleEventId &&
        organizerUid &&
        organizerUid !== "SYSTEM"
      ) {
        await deleteCalendarEvent(visitData, organizerUid);
      }

      await visitRef.delete();
      await createAuditLog(
        "DELETE_VISIT_CALENDAR",
        `Visita y evento eliminados: ${visitId}`,
        request
      );

      return { message: "Visita eliminada correctamente." };
    } catch (e) {
      throw new HttpsError("internal", e.message);
    }
  }
);

/**
 * Genera una URL firmada para que el cliente pueda subir un archivo directamente a Storage.
 */
exports.getSignedUploadUrl = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError(
      "unauthenticated",
      "La solicitud debe estar autenticada."
    );
  }

  const { filePath, contentType } = request.data;
  if (!filePath || !contentType) {
    throw new HttpsError(
      "invalid-argument",
      "Se requieren filePath y contentType."
    );
  }

  try {
    const bucketName = admin.instanceId().app.options.storageBucket;
    const bucket = admin.storage().bucket(bucketName);
    const file = bucket.file(filePath);

    const [signedUrl] = await file.getSignedUrl({
      action: "write",
      expires: Date.now() + 15 * 60 * 1000, // 15 minutos de validez
      contentType: contentType,
    });

    return { signedUrl };
  } catch (error) {
    logger.error(`Error al generar URL firmada para ${filePath}:`, error);
    throw new HttpsError("internal", "No se pudo generar la URL de carga.");
  }
});

/**
 * Hace público un archivo subido a Firebase Storage.
 */
exports.makeSupportFilePublic = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError(
      "unauthenticated",
      "La solicitud debe estar autenticada."
    );
  }

  const { filePath } = request.data;
  if (!filePath) {
    throw new HttpsError(
      "invalid-argument",
      "Se requiere la ruta del archivo (filePath)."
    );
  }

  try {
    const bucket = admin
      .storage()
      .bucket(admin.instanceId().app.options.storageBucket);
    await bucket.file(filePath).makePublic();
    return { success: true, message: "Archivo hecho público." };
  } catch (error) {
    logger.error(`Error al hacer público el archivo ${filePath}:`, error);
    throw new HttpsError("internal", "No se pudo hacer público el archivo.");
  }
});

/**
 * Elimina la foto de perfil del usuario autenticado.
 */
exports.deleteProfilePicture = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError(
      "unauthenticated",
      "La solicitud debe estar autenticada."
    );
  }

  const uid = request.auth.uid;

  try {
    const user = await admin.auth().getUser(uid);
    const currentPhotoURL = user.photoURL;

    if (!currentPhotoURL) {
      return { message: "No hay foto de perfil para eliminar." };
    }

    const url = new URL(currentPhotoURL);
    const filePath = decodeURIComponent(
      url.pathname.split("/").slice(2).join("/")
    );

    const bucket = admin
      .storage()
      .bucket(admin.instanceId().app.options.storageBucket);
    await bucket.file(filePath).delete();

    await admin.auth().updateUser(uid, { photoURL: null });

    return { success: true, message: "Foto de perfil eliminada." };
  } catch (error) {
    logger.error(`Error al eliminar la foto para UID ${uid}:`, error);
    throw new HttpsError(
      "internal",
      `No se pudo eliminar la foto de perfil: ${error.message}`
    );
  }
});

/**
 * Obtiene la cantidad de servicios pendientes de asignación de precio.
 * Solo para Administradores y Jefes.
 */
exports.getPendingPriceRequestsCount = onCall(
  { cors: true },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "La solicitud debe estar autenticada."
      );
    }

    const { role: userRole } = request.auth.token;
    const isAdminOrJefe = userRole === "Administrador" || userRole === "Jefe";

    if (!isAdminOrJefe) {
      // Para otros roles, simplemente devolvemos 0 sin lanzar un error.
      return { count: 0 };
    }

    try {
      const servicesSnapshot = await db.collection("servicios").get();
      let pendingCount = 0;

      servicesSnapshot.forEach((doc) => {
        const sheet = doc.data();
        if (sheet.services && Array.isArray(sheet.services)) {
          pendingCount += sheet.services.filter((s) => s.valor === 0).length;
        }
      });

      return { count: pendingCount };
    } catch (error) {
      logger.error("Error en getPendingPriceRequestsCount:", error);
      throw new HttpsError(
        "internal",
        "No se pudo obtener el conteo de solicitudes de precio."
      );
    }
  }
);

/**
 * Obtiene la lista de servicios pendientes de asignación de precio.
 * Al ser una función "onCall", Firebase maneja CORS automáticamente.
 */
exports.getPendingPriceRequests = onCall({ cors: true }, async (request) => {
  // 1. Verificación de Autenticación y Permisos
  const allowedRoles = ["Administrador", "Jefe", "Coordinador Nacionales", "Coordinador Nacional", "Gerente"];
  if (!request.auth || !allowedRoles.includes(request.auth.token.role)) {
    // Si el usuario no tiene permiso, lanzamos un error específico.
    throw new HttpsError(
      "permission-denied",
      "No tienes permiso para realizar esta acción."
    );
  }

  try {
    const sheetsSnapshot = await db.collection("servicios").get();
    const requests = [];
    sheetsSnapshot.forEach((sheetDoc) => {
      const sheet = sheetDoc.data();
      (Array.isArray(sheet.services) ? sheet.services : []).forEach((service, index) => {
        if (service.needsPriceApproval === true && Number(service.valor) === 0) {
          requests.push({
            clientId: sheet.clientId,
            clientName: sheet.clientName,
            serviceSheetId: sheetDoc.id,
            serviceIndex: index,
            service,
          });
        }
      });
    });
    requests.sort((a, b) => String(a.service.tipo_servicio).localeCompare(String(b.service.tipo_servicio)));

    return { requests };
  } catch (error) {
    console.error("Error al obtener solicitudes de precio pendientes:", error);
    // Lanzamos un error genérico si algo falla en el servidor.
    throw new HttpsError(
      "internal",
      "Ocurrió un error al consultar las solicitudes."
    );
  }
});

/**
 * Crea una nueva visita en Firestore.
 */
exports.createVisit = onCall({ cors: true }, async (request) => {
  assertAuth(request);
  const { visitData } = request.data;

  // Validaciones
  if (!visitData.id_cliente)
    throw new HttpsError("invalid-argument", "Cliente es requerido");
  if (!visitData.fecha_visita)
    throw new HttpsError("invalid-argument", "Fecha es requerida");

  // ✅ CORRECCIÓN: Obtener el nombre del cliente desde la base de datos para asegurar consistencia.
  // Esto soluciona el problema del nombre 'null' en correos y en la UI.
  const clientDoc = await db
    .collection("clientes")
    .doc(visitData.id_cliente)
    .get();
  if (!clientDoc.exists) {
    throw new HttpsError(
      "not-found",
      `El cliente con ID ${visitData.id_cliente} no fue encontrado.`
    );
  }
  const clientName = clientDoc.data().nombreComercial;

  try {
    const dataToSave = {
      ...visitData,
      fecha_visita: admin.firestore.Timestamp.fromDate(
        new Date(visitData.fecha_visita)
      ),
      estado_visita: visitData.estado_visita || "Programada",
      estado_facturacion: "Pendiente",
      nombre_cliente: clientName, // <-- Asegurar que el nombre del cliente se guarde correctamente.
      gestionPermiso: { aprobado: false, estado: "pendiente" }, // Inicializar permisos
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: request.auth.uid,
    };

    const docRef = await db.collection("visitas").add(dataToSave);

    // Integración opcional: Notificar técnicos (podría ir aquí)

    return { success: true, visitId: docRef.id };
  } catch (e) {
    throw new HttpsError("internal", e.message);
  }
});

/**
 * Actualiza una visita existente en Firestore.
 */
exports.updateVisit = onCall({ cors: true }, async (request) => {
  assertAuth(request);
  const { visitId, visitData } = request.data;

  try {
    const updatePayload = { ...visitData };
    if (visitData.fecha_visita) {
      updatePayload.fecha_visita = admin.firestore.Timestamp.fromDate(
        new Date(visitData.fecha_visita)
      );
    }
    updatePayload.updatedAt = admin.firestore.FieldValue.serverTimestamp();
    updatePayload.updatedBy = request.auth.uid;

    await db.collection("visitas").doc(visitId).update(updatePayload);
    return { success: true };
  } catch (e) {
    throw new HttpsError("internal", e.message);
  }
});

/**
 * Obtiene todas las visitas que están pendientes de aprobación de permiso.
 * Solo para Administradores y Jefes.
 */
exports.getPendingPermissionVisits = onCall({ cors: true }, async (request) => {
  assertRole(request, [
    "Administrador",
    "Jefe",
    "Coordinador Nacionales",
    "Coordinador Nacional",
    "Gerente",
  ]);

  try {
    // Buscar visitas pendientes y aprobadas para mostrar en tablero
    const [pendingSnap, approvedSnap] = await Promise.all([
      db
        .collection("visitas")
        .where("gestionPermiso.aprobado", "==", false)
        .get(),
      db
        .collection("visitas")
        .where("gestionPermiso.aprobado", "==", true)
        .get(),
    ]);

    // Unificar y ordenar
    const visits = [...pendingSnap.docs, ...approvedSnap.docs]
      .map((doc) => {
        const d = doc.data();
        return {
          id: doc.id,
          ...d,
          fecha_visita: d.fecha_visita?.toDate
            ? d.fecha_visita.toDate().toISOString()
            : null,
        };
      })
      .sort((a, b) => new Date(b.fecha_visita) - new Date(a.fecha_visita));

    return { visits };
  } catch (e) {
    throw new HttpsError("internal", e.message);
  }
});

/**
 * Aprueba el permiso para una visita específica.
 * Solo para Administradores y Jefes.
 */
exports.approveVisitPermission = onCall({ cors: true }, async (request) => {
  assertRole(request, [
    "Administrador",
    "Jefe",
    "Coordinador Nacionales",
    "Coordinador Nacional",
    "Gerente",
  ]);
  const { visitId, notes } = request.data

  try {
    const visitRef = db.collection('visitas').doc(visitId)
    const visitDoc = await visitRef.get()
    if (!visitDoc.exists) {
      throw new HttpsError('not-found', 'La visita no existe.')
    }
    const visitData = visitDoc.data()

    await visitRef.update({
      "gestionPermiso.aprobado": true,
      "gestionPermiso.estado": "aprobado",
      "gestionPermiso.fechaAprobacion":
        admin.firestore.FieldValue.serverTimestamp(),
      "gestionPermiso.aprobadoPor": request.auth.uid,
      'gestionPermiso.notasAprobacion': notes || null,
      // Limpiar rechazos previos
      "gestionPermiso.notasRechazo": admin.firestore.FieldValue.delete(),
    })

    // --- Lógica de Notificación ---
    const requesterUid = visitData.createdBy
    if (requesterUid && requesterUid !== request.auth.uid) {
      const notificationPayload = {
        title: 'Permiso Aprobado',
        message: `Tu solicitud para la visita a "${visitData.nombre_cliente}" ha sido aprobada.`,
        type: 'success',
        link: `/planeacion?visitIdToOpen=${visitId}`,
        read: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      }
      await db.collection('users').doc(requesterUid).collection('direct_notifications').add(notificationPayload)
    }

    return { success: true }
  } catch (e) {
    if (e instanceof HttpsError) throw e
    throw new HttpsError('internal', e.message)
  }
});

/**
 * Rechaza el permiso para una visita específica.
 * En lugar de borrarla, la marca como 'rechazada' para mantener un historial.
 */
exports.rejectVisitPermission = onCall({ cors: true }, async (request) => {
  assertRole(request, [
    "Administrador",
    "Jefe",
    "Coordinador Nacionales",
    "Coordinador Nacional",
    "Gerente",
  ]);
  const { visitId, reason } = request.data

  try {
    const visitRef = db.collection('visitas').doc(visitId)
    const visitDoc = await visitRef.get()
    if (!visitDoc.exists) {
      throw new HttpsError('not-found', 'La visita no existe.')
    }
    const visitData = visitDoc.data()

    await visitRef.update({
      "gestionPermiso.aprobado": false,
      "gestionPermiso.estado": "rechazado",
      "gestionPermiso.notasRechazo": reason,
      "gestionPermiso.fechaRechazo":
        admin.firestore.FieldValue.serverTimestamp(),
    })

    // --- Lógica de Notificación ---
    const requesterUid = visitData.createdBy
    if (requesterUid && requesterUid !== request.auth.uid) {
      const notificationPayload = {
        title: 'Permiso Rechazado',
        message: `Tu solicitud para "${visitData.nombre_cliente}" fue rechazada. Motivo: ${reason}`,
        type: 'error',
        link: `/planeacion?visitIdToOpen=${visitId}`,
        read: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      }
      await db.collection('users').doc(requesterUid).collection('direct_notifications').add(notificationPayload)
    }

    return { success: true }
  } catch (e) {
    if (e instanceof HttpsError) throw e
    throw new HttpsError('internal', e.message)
  }
});

/**
 * Añade una referencia de un archivo de soporte a una visita existente.
 */
exports.addSupportFileToVisit = onCall({ cors: true }, async (request) => {
  const { auth, data } = request;
  if (!auth) {
    throw new HttpsError(
      "unauthenticated",
      "El usuario debe estar autenticado."
    );
  }

  const { visitId, fileData } = data;
  if (
    !visitId ||
    !fileData ||
    !fileData.name ||
    !fileData.url ||
    !fileData.path
  ) {
    throw new HttpsError(
      "invalid-argument",
      "Faltan datos del archivo o de la visita."
    );
  }

  const visitRef = db.collection("visitas").doc(visitId);

  try {
    await visitRef.update({
      "gestionPermiso.soportes":
        admin.firestore.FieldValue.arrayUnion(fileData),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return { success: true, message: "Soporte añadido correctamente." };
  } catch (error) {
    logger.error(`Error al añadir soporte a la visita ${visitId}:`, error);
    throw new HttpsError(
      "internal",
      "No se pudo añadir el archivo de soporte."
    );
  }
});

/**
 * Actualiza las notas de aprobación/rechazo en una visita.
 */
exports.updatePermissionNotes = onCall({ cors: true }, async (request) => {
  const { auth, data } = request;
  if (!auth) {
    throw new HttpsError(
      "unauthenticated",
      "El usuario debe estar autenticado."
    );
  }

  const { visitId, notes, isApproval } = data;
  if (!visitId) {
    throw new HttpsError("invalid-argument", "Se requiere el ID de la visita.");
  }

  const visitRef = db.collection("visitas").doc(visitId);

  try {
    const updateData = {};
    if (isApproval) {
      updateData["gestionPermiso.notasAprobacion"] = notes || "";
    } else {
      updateData["gestionPermiso.notasRechazo"] = notes || "";
    }

    await visitRef.update(updateData);

    // Registrar en auditoría
    const adminEmail = auth.token.email || "Desconocido";
    const logEntry = {
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      adminEmail,
      action: "UPDATE_PERMISSION_NOTES",
      details: `El usuario ${adminEmail} añadió notas al permiso de la visita ${visitId}.`,
      targetUser: { uid: visitId, email: `Visita ID: ${visitId}` },
      adminUser: { uid: auth.uid, email: adminEmail },
    };
    await db.collection("audit_logs").add(logEntry);

    return { success: true, message: "Notas actualizadas." };
  } catch (error) {
    logger.error(`Error al actualizar notas para visita ${visitId}:`, error);
    throw new HttpsError("internal", "No se pudieron guardar las notas.");
  }
});

/**
 * Obtiene la URL pública de un archivo en Storage.
 */
exports.getPublicFileUrl = onCall({ cors: true }, async (request) => {
  const { auth, data } = request;
  if (!auth) {
    throw new HttpsError(
      "unauthenticated",
      "El usuario debe estar autenticado."
    );
  }

  const { filePath } = data;
  if (!filePath) {
    throw new HttpsError(
      "invalid-argument",
      "Se requiere la ruta del archivo (filePath)."
    );
  }

  try {
    const bucketName = admin.instanceId().app.options.storageBucket;
    if (!bucketName) {
      throw new HttpsError(
        "failed-precondition",
        "El bucket de almacenamiento no está configurado en el servidor."
      );
    }
    const publicUrl = `https://storage.googleapis.com/${bucketName}/${filePath}`;
    return { publicUrl };
  } catch (error) {
    logger.error(`Error al obtener la URL pública para ${filePath}:`, error);
    throw new HttpsError("internal", "No se pudo obtener la URL del archivo.");
  }
});

/**
 * Actualiza los datos maestros del negocio (zonas, aliados, etc.).
 * Solo para Administradores y Jefes.
 */
exports.updateBusinessData = onCall({ cors: true }, async (request) => {
  const { auth, data } = request;
  if (
    !auth ||
    (auth.token.role !== "Administrador" && auth.token.role !== "Jefe")
  ) {
    throw new HttpsError(
      "permission-denied",
      "No tienes permiso para actualizar los datos de negocio."
    );
  }

  const { businessData } = data;
  if (!businessData) {
    throw new HttpsError(
      "invalid-argument",
      "Se requieren los datos de negocio."
    );
  }

  try {
    const docRef = db.collection("settings").doc("businessData");
    // Usamos 'set' con 'merge: true' para actualizar o crear el documento de forma segura.
    await docRef.set(businessData, { merge: true });

    // Registrar en auditoría
    const adminEmail = auth.token.email || "Desconocido";
    const logEntry = {
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      adminEmail,
      action: "UPDATE_BUSINESS_DATA",
      details: `El usuario ${adminEmail} actualizó los datos de negocio (zonas, aliados, etc.).`,
      adminUser: { uid: auth.uid, email: adminEmail },
    };
    await db.collection("audit_logs").add(logEntry);

    return {
      success: true,
      message: "Datos de negocio actualizados correctamente.",
    };
  } catch (error) {
    logger.error("Error en updateBusinessData:", error);
    throw new HttpsError(
      "internal",
      "No se pudieron actualizar los datos de negocio."
    );
  }
});

/**
 * Elimina un archivo de soporte tanto de Storage como de la referencia en Firestore.
 */
exports.deleteSupportFile = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError(
      "unauthenticated",
      "La solicitud debe estar autenticada."
    );
  }

  const { visitId, fileData } = request.data;
  const filePath = fileData?.path;

  if (!visitId || !filePath) {
    throw new HttpsError(
      "invalid-argument",
      "Los parámetros visitId y fileData.path son obligatorios."
    );
  }

  try {
    // 1. Eliminar el archivo de Firebase Storage
    const bucketName = admin.instanceId().app.options.storageBucket;
    const bucket = admin.storage().bucket(bucketName);
    await bucket.file(filePath).delete();
    logger.log(`[deleteSupportFile] Archivo eliminado de Storage: ${filePath}`);

    // 2. Obtener el documento de la visita para encontrar el objeto de soporte completo
    const visitRef = db.collection("visitas").doc(visitId);
    const visitDoc = await visitRef.get();
    if (!visitDoc.exists) {
      throw new HttpsError("not-found", "La visita no fue encontrada.");
    }

    const currentSoportes = visitDoc.data().gestionPermiso?.soportes || [];
    const supportObjectToRemove = currentSoportes.find(
      (s) => s.path === filePath
    );

    if (!supportObjectToRemove) {
      logger.warn(
        `[deleteSupportFile] No se encontró el objeto de soporte con path ${filePath} en la visita ${visitId}. La referencia podría haber sido eliminada previamente.`
      );
      return {
        success: true,
        message:
          "El archivo ya no existía en la base de datos, pero fue eliminado de Storage.",
      };
    }

    // 2. Eliminar la referencia del documento de Firestore usando arrayRemove
    await visitRef.update({
      "gestionPermiso.soportes": admin.firestore.FieldValue.arrayRemove(
        supportObjectToRemove
      ),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    logger.log(
      `[deleteSupportFile] Referencia eliminada de Firestore para visita: ${visitId}`
    );

    // 3. (Opcional) Registrar en auditoría
    const adminEmail = request.auth.token.email || "Desconocido";
    const logEntry = {
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      adminEmail,
      action: "DELETE_SUPPORT_FILE",
      details: `El usuario ${adminEmail} eliminó el soporte "${supportObjectToRemove.name}" de la visita ${visitId}.`,
      targetUser: { uid: visitId, email: `Visita ID: ${visitId}` },
      adminUser: { uid: request.auth.uid, email: adminEmail },
    };
    await db.collection("audit_logs").add(logEntry);

    return { success: true, message: "Soporte eliminado con éxito." };
  } catch (error) {
    logger.error(`[deleteSupportFile] Error al eliminar soporte:`, error);
    throw new HttpsError(
      "internal",
      `Error al eliminar el soporte: ${error.message}`
    );
  }
});

/**
 * Elimina una visita de Firestore.
 */
exports.deleteVisit = onCall({ cors: true }, async (request) => {
  assertRole(request, [
    "Administrador",
    "Jefe",
    "Coordinador Nacionales",
    "Coordinador Valle",
    "Coordinador Norte de Santander",
  ]);
  try {
    await db.collection("visitas").doc(request.data.visitId).delete();
    await createAuditLog(
      "DELETE_VISIT",
      `Visita eliminada ID: ${request.data.visitId}`,
      request
    );
    return { success: true };
  } catch (e) {
    throw new HttpsError("internal", e.message);
  }
});

/**
 * Marca una visita como 'Realizada' rápidamente.
 */
exports.completeVisit = onCall(async (request) => {
  assertAuth(request);
  const { visitId } = request.data;
  await db.collection("visitas").doc(visitId).update({
    estado_visita: "Realizada",
    completedAt: admin.firestore.FieldValue.serverTimestamp(),
    completedBy: request.auth.uid,
  });
  return { message: "Visita marcada como realizada" };
});

exports.quickCompleteVisit = onCall({ cors: true }, async (request) => {
  assertAuth(request);
  try {
    await db.collection("visitas").doc(request.data.visitId).update({
      estado_visita: "Realizada",
      estado_facturacion: "Pendiente",
      completedAt: admin.firestore.FieldValue.serverTimestamp(),
      completedBy: request.auth.uid,
    });
    return { success: true };
  } catch (e) {
    throw new HttpsError("internal", e.message);
  }
});

/**
 * Verifica si hay conflictos de horario para un grupo de técnicos en un momento dado.
 */
exports.checkForConflicts = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError(
      "unauthenticated",
      "La solicitud debe estar autenticada."
    );
  }

  const {
    technicians,
    startTimeISO,
    visitIdToIgnore,
    durationMinutes = 60,
  } = request.data;
  if (!technicians || !Array.isArray(technicians) || !startTimeISO) {
    throw new HttpsError(
      "invalid-argument",
      "Faltan parámetros para la verificación."
    );
  }

  if (technicians.length === 0) {
    return { hasConflict: false }; // No hay técnicos, no hay conflicto.
  }

  const newVisitStart = new Date(startTimeISO);
  if (Number.isNaN(newVisitStart.getTime())) {
    throw new HttpsError("invalid-argument", "La fecha de la visita no es válida.");
  }

  const normalizedDurationMinutes = Number(durationMinutes);
  if (!Number.isFinite(normalizedDurationMinutes) || normalizedDurationMinutes <= 0) {
    throw new HttpsError("invalid-argument", "La duración de la visita no es válida.");
  }
  const visitDurationMs = normalizedDurationMinutes * 60 * 1000;
  const conflictWindowStart = new Date(
    newVisitStart.getTime() - visitDurationMs
  );
  const conflictWindowEnd = new Date(
    newVisitStart.getTime() + visitDurationMs
  );
  const newVisitEnd = conflictWindowEnd;

  try {
    const visitsRef = db.collection("visitas");
    const snapshot = await visitsRef
      .where("fumigadores_asignados", "array-contains-any", technicians)
      .where("fecha_visita", ">=", conflictWindowStart)
      .where("fecha_visita", "<=", conflictWindowEnd)
      .get();

    if (snapshot.empty) {
      return { hasConflict: false };
    }

    for (const doc of snapshot.docs) {
      if (doc.id !== visitIdToIgnore) {
        const existingVisit = doc.data();
        if (existingVisit.estado_visita === "Cancelada") continue;

        const existingStart = existingVisit.fecha_visita?.toDate?.();
        if (!existingStart) continue;
        const existingDurationMinutes = Number(existingVisit.duracion_minutos) || 60;
        const existingEnd = new Date(
          existingStart.getTime() + existingDurationMinutes * 60 * 1000
        );
        if (existingStart >= newVisitEnd || existingEnd <= newVisitStart) {
          continue;
        }

        const conflictingTechnician = technicians.find((tech) =>
          existingVisit.fumigadores_asignados.includes(tech)
        );
        return {
          hasConflict: true,
          conflictingClient: existingVisit.nombre_cliente,
          conflictingTechnician,
        };
      }
    }

    return { hasConflict: false };
  } catch (error) {
    logger.error("Error al verificar conflictos de horario:", error);
    throw new HttpsError(
      "internal",
      "No se pudo verificar el conflicto de agendamiento."
    );
  }
});

exports.globalSearch = onCall({ cors: true }, async (request) => {
  const { auth, data } = request;
  if (!auth) {
    throw new HttpsError("unauthenticated", "El usuario no está autenticado.");
  }
  const { term } = data;
  if (!term || term.length < 2) {
    return { clients: [], fumigadores: [] };
  }

  const lowerTerm = term.toLowerCase();
  const termEnd = lowerTerm.replace(/.$/, (c) =>
    String.fromCharCode(c.charCodeAt(0) + 1)
  );

  try {
    const db = admin.firestore();
    const userZone = auth.token.zona;
    const isAdminOrJefe =
      auth.token.role === "Administrador" || auth.token.role === "Jefe";

    let clientQuery = db.collection("clientes");
    let fumigadorQuery = db.collection("fumigadores");

    if (userZone && !isAdminOrJefe) {
      clientQuery = clientQuery.where("zona", "==", userZone);
      fumigadorQuery = fumigadorQuery.where("zona", "==", userZone);
    }

    const finalClientQuery = clientQuery
      .where("nombreComercial_lower", ">=", lowerTerm)
      .where("nombreComercial_lower", "<", termEnd)
      .limit(5)
      .get();

    const finalFumigadorQuery = fumigadorQuery
      .where("nombreCompleto_lower", ">=", lowerTerm)
      .where("nombreCompleto_lower", "<", termEnd)
      .limit(5)
      .get();

    const [clientSnapshot, fumigadorSnapshot] = await Promise.all([
      finalClientQuery,
      finalFumigadorQuery,
    ]);

    const clients = clientSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    const fumigadores = fumigadorSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return { clients, fumigadores };
  } catch (error) {
    console.error("Error en la búsqueda global:", error);
    throw new HttpsError(
      "internal",
      "Ocurrió un error al realizar la búsqueda."
    );
  }
});

exports.setUserRole = onCall({ cors: true }, async (request) => {
  assertRole(request, ["Administrador", "Jefe"]);
  const { uid, role, zona } = request.data;

  const user = await admin.auth().getUser(uid);

  // Custom Claims
  const claims = { role };
  if (zona) claims.zona = zona;

  await admin.auth().setCustomUserClaims(uid, claims);

  await createAuditLog(
    "UPDATE_ROLE",
    `Rol cambiado a ${role} (${zona})`,
    request,
    { uid, email: user.email }
  );

  return { message: "Rol asignado correctamente." };
});

/**
 * Solo los Jefes o Administradores pueden llamar a esta función.
 */
exports.setUserStatus = onCall({ cors: true }, async (request) => {
  // 1. Verificar permisos
  if (
    !auth ||
    (auth.token.role !== "Administrador" && auth.token.role !== "Jefe")
  ) {
    throw new HttpsError(
      "permission-denied",
      "Solo los administradores o jefes pueden cambiar el estado de un usuario."
    );
  }

  const { auth, data } = request;
  const { uid, disabled } = data;
  if (!uid || typeof disabled !== "boolean") {
    throw new HttpsError(
      "invalid-argument",
      "Se requiere el UID del usuario y el estado (disabled: true/false)."
    );
  }

  // 2. Evitar que un usuario se deshabilite a sí mismo.
  if (auth.uid === uid) {
    throw new HttpsError(
      "permission-denied",
      "No puedes deshabilitar tu propia cuenta."
    );
  }

  try {
    // 3. Actualizar el estado del usuario en Firebase Auth.
    await admin.auth().updateUser(uid, { disabled: disabled });

    // 4. Registrar en auditoría (opcional pero recomendado).
    const adminEmail = auth.token.email || "Desconocido";
    const targetUser = await admin.auth().getUser(uid);
    const action = disabled ? "DISABLE_USER" : "ENABLE_USER";
    const details = `El administrador ${adminEmail} ${
      disabled ? "deshabilitó" : "habilitó"
    } la cuenta de ${targetUser.email}.`;

    const logEntry = {
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      adminEmail,
      action,
      details,
      targetUser: { uid, email: targetUser.email },
      adminUser: { uid: auth.uid, email: adminEmail },
    };
    await admin.firestore().collection("audit_logs").add(logEntry);

    return {
      success: true,
      message: `Usuario ${
        disabled ? "deshabilitado" : "habilitado"
      } correctamente.`,
    };
  } catch (error) {
    console.error("Error al cambiar el estado del usuario:", error);
    throw new HttpsError(
      "internal",
      "Ocurrió un error al actualizar el estado del usuario."
    );
  }
});

exports.saveGoogleTokens = onCall(
  { cors: true, enforceAppCheck: false, region: "us-central1" },
  async (request) => {
    if (!request.auth)
      throw new HttpsError("unauthenticated", "Auth requerida");
    const { tokens, targetUid } = request.data;

    // ✅ MEJORA: Añadir validación de entrada para robustecer la función.
    if (!tokens || !targetUid) {
      throw new HttpsError(
        "invalid-argument",
        "La solicitud debe incluir 'tokens' y 'targetUid'."
      );
    }

    if (!tokens.refresh_token) {
      logger.warn(`[saveGoogleTokens] ADVERTENCIA: Se están guardando tokens para ${targetUid} SIN refresh_token. La integración dejará de funcionar cuando expire el access_token.`);
    }

    try {
      // CORRECCIÓN: Usar googleConfig
      const oAuth2Client = new google.auth.OAuth2(
        googleConfig.clientId,
        googleConfig.clientSecret
      );
      oAuth2Client.setCredentials(tokens);

      const oauth2 = google.oauth2({ version: "v2", auth: oAuth2Client });
      const { data: userInfo } = await oauth2.userinfo.get();

      await admin
        .firestore()
        .collection("calendar_integrations")
        .doc(targetUid)
        .set(
          {
            ...tokens,
            googleEmail: userInfo.email,
            googleUserName: userInfo.name,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

      return { message: "Guardado." };
    } catch (e) {
      throw new HttpsError("internal", e.message);
    }
  }
);

/**
 * Solo los Jefes o Administradores pueden llamar a esta función.
 */
exports.disconnectGoogleAccount = onCall({ cors: true }, async (request) => {
  const { auth, data } = request;
  // 1. Verificar permisos
  const isOwner = auth && auth.uid === data.uid;
  if (
    !auth ||
    (!isOwner &&
      auth.token.role !== "Administrador" &&
      auth.token.role !== "Jefe")
  ) {
    throw new HttpsError(
      "permission-denied",
      "Solo los administradores o jefes pueden desconectar una cuenta."
    );
  }

  const { uid } = data;
  if (!uid) {
    throw new HttpsError(
      "invalid-argument",
      "Se requiere el UID del usuario a desconectar."
    );
  }

  try {
    const integrationRef = admin
      .firestore()
      .collection("calendar_integrations")
      .doc(uid);
    const doc = await integrationRef.get();

    if (!doc.exists) {
      throw new HttpsError(
        "not-found",
        "No se encontró una integración para este usuario."
      );
    }

    // 2. Eliminar el documento que contiene los tokens.
    await integrationRef.delete();

    // 3. Registrar en auditoría (opcional pero recomendado).
    const adminEmail = auth.token.email || "Desconocido";
    const targetEmail = doc.data().googleEmail || `UID: ${uid}`;
    const details = `El administrador ${adminEmail} desconectó la integración de Google Calendar para ${targetEmail}.`;
    const logEntry = {
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      adminEmail,
      action: "DISCONNECT_INTEGRATION",
      details,
      targetUser: { uid, email: targetEmail },
      adminUser: { uid: auth.uid, email: adminEmail },
    };
    await admin.firestore().collection("audit_logs").add(logEntry);

    return {
      success: true,
      message: "Integración desconectada correctamente.",
    };
  } catch (error) {
    console.error("Error al desconectar la cuenta de Google:", error);
    throw new HttpsError(
      "internal",
      "Ocurrió un error al eliminar la integración."
    );
  }
});

/**
 * Solo los Jefes o Administradores pueden llamar a esta función.
 */
exports.undoRoleChange = onCall({ cors: true }, async (request) => {
  const { auth, data } = request;
  // 1. Verificar permisos
  if (
    !auth ||
    (auth.token.role !== "Administrador" && auth.token.role !== "Jefe")
  ) {
    throw new HttpsError(
      "permission-denied",
      "Solo los administradores o jefes pueden deshacer un cambio de rol."
    );
  }

  const { logId, uid, previousState } = data;
  if (!logId || !uid || !previousState) {
    throw new HttpsError(
      "invalid-argument",
      "Faltan datos para deshacer el cambio (logId, uid, previousState)."
    );
  }

  try {
    // 2. Revertir los claims del usuario al estado anterior.
    const claimsToSet = {
      role: previousState.role || null,
      zona: previousState.zona || null,
    };
    await admin.auth().setCustomUserClaims(uid, claimsToSet);

    // 3. Registrar la acción de "deshacer" en la auditoría.
    const adminEmail = auth.token.email || "Desconocido";
    const targetUser = await admin.auth().getUser(uid);
    const details = `El administrador ${adminEmail} deshizo un cambio de rol para ${
      targetUser.email
    }, restaurando el rol a "${previousState.role || "Sin Rol"}".`;

    const logEntry = {
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      adminEmail,
      action: "UPDATE_ROLE", // Se mantiene la misma acción para agrupar
      details,
      targetUser: { uid, email: targetUser.email },
      adminUser: { uid: auth.uid, email: adminEmail },
      undoneLogId: logId, // Referencia al log original que se deshizo
    };
    await admin.firestore().collection("audit_logs").add(logEntry);

    return { success: true, message: "El cambio de rol ha sido revertido." };
  } catch (error) {
    console.error("Error al deshacer el cambio de rol:", error);
    throw new HttpsError(
      "internal",
      "Ocurrió un error al revertir el cambio de rol."
    );
  }
});

/**
 * ✅ MEJORA: Intercambia un código de autorización de Google por tokens de acceso y refresco.
 * Este es el flujo de servidor seguro recomendado por Google.
 */
exports.exchangeAuthCodeForTokens = onCall(async (request) => {
  logger.info("--> Iniciando exchangeAuthCodeForTokens (V3 ROBUST MODE)");

  const { clientId, clientSecret } = googleConfig;
  const { code, targetUid, redirect_uri } = request.data;

  if (!code || !targetUid)
    throw new HttpsError(
      "invalid-argument",
      "Faltan parámetros code o targetUid"
    );

  const rUri = redirect_uri || "postmessage";

  try {
    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, rUri);

    // 1. Obtener Tokens (Intercambio de código)
    logger.info("Intercambiando código...", { rUri });
    const tokenResponse = await oauth2Client.getToken({
      code,
      redirect_uri: rUri,
    });
    const tokens = tokenResponse.tokens;

    const accessToken = tokens.access_token || tokens.accessToken;

    // Log de diagnóstico completo
    logger.info("Tokens recibidos:", {
      keys: Object.keys(tokens),
      scope: tokens.scope,
      hasIdToken: !!tokens.id_token,
      accessTokenPreview: accessToken
        ? `${accessToken.substring(0, 6)}...`
        : "MISSING",
      tokenType: tokens.token_type,
    });

    if (!accessToken) {
      throw new Error("Google no devolvió un access_token válido.");
    }

    // Establecer credenciales en el cliente
    oauth2Client.setCredentials(tokens);

    let email, name, picture;

    // 2. ESTRATEGIA 1: Verify ID Token (La más robusta si el scope openid está presente)
    if (tokens.id_token) {
      try {
        logger.info("Intentando verificar ID Token...");
        const ticket = await oauth2Client.verifyIdToken({
          idToken: tokens.id_token,
          audience: clientId,
        });
        const payload = ticket.getPayload();
        if (payload) {
          email = payload.email;
          name = payload.name;
          picture = payload.picture;
          logger.info("Datos obtenidos exitosamente vía verifyIdToken.");
        }
      } catch (verifyError) {
        logger.warn(
          "Falló verifyIdToken, intentando decodificación manual...",
          verifyError
        );

        // Fallback: Decodificación manual
        try {
          const parts = tokens.id_token.split(".");
          if (parts.length === 3) {
            const payload = JSON.parse(
              Buffer.from(parts[1], "base64").toString()
            );
            email = payload.email;
            name = payload.name;
            picture = payload.picture;
            logger.info("Datos obtenidos vía decodificación manual.");
          }
        } catch (manualError) {
          logger.error(
            "Error decodificando ID Token manualmente:",
            manualError
          );
        }
      }
    }

    // 3. ESTRATEGIA 2: UserInfo API (Si ID Token falló o no vino)
    if (!email) {
      logger.info("Email no obtenido por ID Token. Verificando scopes...");

      // Advertencia de Scope
      const scopes = tokens.scope || "";
      if (
        !scopes.includes("email") &&
        !scopes.includes("profile") &&
        !scopes.includes("openid")
      ) {
        logger.warn(
          "ALERTA: El scope recibido no incluye 'email', 'profile' ni 'openid'. UserInfo fallará."
        );
      }

      logger.info("Intentando UserInfo API (v3)...");

      try {
        // Opción A: Fetch Manual a v3 (Suele ser más permisivo con formatos de token)
        // Usamos Fetch primero esta vez para tener control total de headers
        const fetchResponse = await fetch(
          "https://www.googleapis.com/oauth2/v3/userinfo",
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              Accept: "application/json",
            },
          }
        );

        if (fetchResponse.ok) {
          const userData = await fetchResponse.json();
          email = userData.email;
          name = userData.name;
          picture = userData.picture;
          logger.info("Datos obtenidos vía Fetch manual (v3).");
        } else {
          const errText = await fetchResponse.text();
          logger.warn(
            `Fetch v3 falló con status ${fetchResponse.status}: ${errText}. Intentando SDK...`
          );
          throw new Error(`Fetch failed: ${fetchResponse.status}`);
        }
      } catch (fetchError) {
        // Opción B: SDK de Google como último recurso
        try {
          const oauth2 = google.oauth2("v2");
          const userInfoResponse = await oauth2.userinfo.get({
            auth: oauth2Client,
          });

          if (userInfoResponse.data) {
            email = userInfoResponse.data.email;
            name = userInfoResponse.data.name;
            picture = userInfoResponse.data.picture;
            logger.info("Datos obtenidos vía Google SDK UserInfo (v2).");
          }
        } catch (sdkError) {
          logger.error("Fallaron todos los métodos de UserInfo.", {
            fetchError,
            sdkError,
          });
          throw new Error(
            `No se pudo obtener el perfil. Verifica que el frontend solicite los scopes 'email' y 'profile'. Error: ${sdkError.message}`
          );
        }
      }
    }

    if (!email)
      throw new Error(
        "No se pudo obtener el email. Es posible que el usuario no haya otorgado permiso de email."
      );

    // 4. Guardar en Firestore
    const integrationData = {
      ...tokens,
      googleEmail: email,
      googleUserName: name || "Usuario Google",
      picture: picture || "",
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    // Guardar en la colección principal
    await db
      .collection("calendar_integrations")
      .doc(targetUid)
      .set(integrationData, { merge: true });

    return { success: true, email: email };
  } catch (error) {
    logger.error("Error FATAL en exchangeAuthCodeForTokens:", error);
    throw new HttpsError(
      "internal",
      error.message || "Error desconocido durante la vinculación."
    );
  }
});
exports.listCoordinators = onCall({ cors: true }, async (request) => {
  const { auth } = request;
  if (!auth) {
    throw new HttpsError("unauthenticated", "El usuario no está autenticado.");
  }
  const uid = auth.uid;
  const docRef = admin.firestore().collection("calendar_integrations").doc(uid);
  const docSnap = await docRef.get();
  // ✅ MEJORA: Devolver también el email para mostrarlo en el perfil.
  const isConnected = docSnap.exists;
  const googleEmail = isConnected ? docSnap.data().googleEmail : null;
  return { isConnected, googleEmail };
});

exports.getGoogleCalendarEvents = onCall({ cors: true }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Auth requerida");
  const { targetUid, startDate, endDate } = request.data;

  const doc = await admin
    .firestore()
    .collection("calendar_integrations")
    .doc(targetUid)
    .get();
  if (!doc.exists) throw new HttpsError("not-found", "No conectado.");

  const tokens = doc.data();
  // CORRECCIÓN: Usar googleConfig
  const oAuth2Client = new google.auth.OAuth2(
    googleConfig.clientId,
    googleConfig.clientSecret
  );
  oAuth2Client.setCredentials(tokens);

  // Listener para refrescar tokens
  oAuth2Client.on("tokens", (newTokens) => {
    admin
      .firestore()
      .collection("calendar_integrations")
      .doc(targetUid)
      .set(newTokens, { merge: true });
  });

  const calendar = google.calendar({ version: "v3", auth: oAuth2Client });
  try {
    const response = await calendar.events.list({
      calendarId: "primary",
      timeMin: startDate,
      timeMax: endDate,
      singleEvents: true,
      orderBy: "startTime",
    });
    return { events: response.data.items || [] };
  } catch (e) {
    if (e.code === 401)
      throw new HttpsError("unauthenticated", "Token expirado.");
    throw new HttpsError("internal", e.message);
  }
});

exports.getConsolidatedPlanningData = onCall(
  { cors: true },
  async (request) => {
    const { auth, data } = request;
    if (!auth) {
      // ✅ MEJORA: Lanzar error si no hay autenticación.
      // Esto es crucial para la seguridad y para que el frontend pueda reaccionar adecuadamente.
      throw new HttpsError(
        "unauthenticated",
        "El usuario no está autenticado."
      );
    }

    const userZone = auth.token.zona;
    const requestedZone = data.zone;
    // ✅ NUEVO: Se añade el UID del calendario de Google a consultar.
    const calendarTargetUid = data.calendarTargetUid;

    const hasGlobalAccess = [
      "Administrador",
      "Jefe",
      "Coordinador Nacionales",
      "Coordinador Nacional",
      "Gerente"
    ].includes(auth.token.role);

    if (calendarTargetUid && calendarTargetUid !== "internal" && !hasGlobalAccess) {
      throw new HttpsError(
        "permission-denied",
        "No tienes permiso para consultar ese calendario."
      );
    }

    let zoneToFilter = null;
    if (hasGlobalAccess) {
      if (requestedZone && requestedZone !== "Todos") {
        zoneToFilter = requestedZone;
      }
    } else if (userZone) {
      zoneToFilter = userZone;
    } else {
      throw new HttpsError(
        "permission-denied",
        "El usuario no tiene una zona asignada."
      );
    }

    const { year, month, startDateISO, endDateISO } = data;
    if (
      (typeof year !== "number" || typeof month !== "number") &&
      (!startDateISO || !endDateISO)
    ) {
      throw new HttpsError("invalid-argument", "Se requieren el año y el mes.");
    }

    try {
      const db = admin.firestore();
      const startDate = startDateISO
        ? new Date(startDateISO)
        : new Date(Date.UTC(year, month, 1));
      const endDate = endDateISO
        ? new Date(endDateISO)
        : new Date(Date.UTC(year, month + 1, 1));
      if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
        throw new HttpsError("invalid-argument", "El rango de fechas no es válido.");
      }
      const sixMonthsAgo = new Date(
        new Date().setMonth(new Date().getMonth() - 6)
      );

      let visitsQuery = db.collection("visitas");
      let techniciansQuery = db.collection("fumigadores");
      let pendingVisitsQuery = db.collection("visitas");

      if (zoneToFilter) {
        visitsQuery = visitsQuery.where("zona", "==", zoneToFilter);
        pendingVisitsQuery = pendingVisitsQuery.where(
          "zona",
          "==",
          zoneToFilter
        );
        techniciansQuery = techniciansQuery.where("zona", "==", zoneToFilter);
      }

      const monthlyVisitsPromise = visitsQuery
        .where("fecha_visita", ">=", startDate)
        .where("fecha_visita", "<", endDate)
        .get();

      const techniciansPromise = techniciansQuery.get();
      // ✅ MEJORA: Obtener solo los clientes activos para poblar los modales.
      let clientsQuery = db
        .collection("clientes")
        .where("estado", "==", "Activo");
      if (zoneToFilter) {
        clientsQuery = clientsQuery.where(
          "zonasDeSucursales",
          "array-contains",
          zoneToFilter
        );
      }
      const clientsQueryPromise = clientsQuery.get();
      // ✅ MEJORA: Obtener visitas pendientes de forma más eficiente.
      const pendingVisitsPromise = pendingVisitsQuery
        .where("isUrgent", "==", true)
        .where("estado_visita", "==", "Programada")
        .orderBy("fecha_visita", "asc")
        .limit(20)
        .get();

      // ✅ NUEVO: Obtener eventos de Google Calendar si se solicita.
      let googleEventsPromise = Promise.resolve([]);
      if (calendarTargetUid && calendarTargetUid !== "internal") {
        const integrationDoc = await db
          .collection("calendar_integrations")
          .doc(calendarTargetUid)
          .get();
        if (integrationDoc.exists) {
          const tokens = integrationDoc.data();
          const oAuth2Client = new google.auth.OAuth2(
            googleConfig.clientId,
            googleConfig.clientSecret
          );
          oAuth2Client.setCredentials(tokens);

          oAuth2Client.on("tokens", (newTokens) => {
            logger.info(`Refrescando tokens para ${calendarTargetUid}`);
            db.collection("calendar_integrations")
              .doc(calendarTargetUid)
              .set(newTokens, { merge: true });
          });

          const calendar = google.calendar({
            version: "v3",
            auth: oAuth2Client,
          });
          googleEventsPromise = calendar.events
            .list({
              calendarId: "primary",
              timeMin: startDate.toISOString(),
              timeMax: endDate.toISOString(),
              singleEvents: true,
              orderBy: "startTime",
            })
            .then((res) =>
              (res.data.items || []).map((e) => ({
                summary: e.summary,
                start: e.start?.dateTime || e.start?.date,
                end: e.end?.dateTime || e.end?.date,
                source: "google",
                htmlLink: e.htmlLink, // <-- AÑADIDO: Incluir el enlace al evento
              }))
            )
            .catch((err) => {
              logger.error(
                `Error obteniendo eventos de Google para ${calendarTargetUid}:`,
                err.message
              );
              if (err.code === 401 || err.code === 400)
                return { error: "needs-auth-refresh" };
              return [];
            });
        }
      }

      const [
        monthlySnapshot,
        pendingSnapshot,
        techniciansSnapshot,
        clientsSnapshot,
        googleEventsResult,
      ] = await Promise.all([
        monthlyVisitsPromise,
        pendingVisitsPromise,
        techniciansPromise,
        clientsQueryPromise,
        googleEventsPromise,
      ]);

      // Cargar solo las fichas de los clientes visibles en esta zona.
      const clientIds = clientsSnapshot.docs.map((doc) => doc.id);
      const serviceSheetSnapshots = await Promise.all(
        Array.from({ length: Math.ceil(clientIds.length / 30) }, (_, index) =>
          db
            .collection("servicios")
            .where("clientId", "in", clientIds.slice(index * 30, index * 30 + 30))
            .get()
        )
      );
      const serviceSheetsSnapshot = {
        docs: serviceSheetSnapshots.flatMap((snapshot) => snapshot.docs),
      };

      // Si la obtención de eventos de Google resultó en un error de autenticación, lo notificamos.
      if (googleEventsResult?.error === "needs-auth-refresh") {
        return { needsAuthRefresh: true };
      }
      const googleEvents = googleEventsResult;

      const monthlyVisits = monthlySnapshot.docs.map((doc) => {
        const visitData = doc.data();
        return {
          id: doc.id,
          ...visitData,
          fecha_visita: visitData.fecha_visita.toDate().toISOString(),
        };
      });

      const pendingVisits = pendingSnapshot.docs.map((doc) => {
        const visitData = doc.data();
        // Filtrar en el backend para asegurar que realmente están pendientes.
        if (
          !visitData.fumigadores_asignados ||
          visitData.fumigadores_asignados.length === 0
        ) {
          return {
            id: doc.id,
            ...visitData,
            fecha_visita: visitData.fecha_visita.toDate().toISOString(),
          };
        }
        return null;
      });

      const technicians = techniciansSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      const clients = clientsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // ✅ CORRECCIÓN: Adjuntar la ficha de servicio a cada cliente.
      // Se crea un mapa para una búsqueda eficiente y se adjunta la ficha correspondiente.
      const serviceSheetsMap = new Map();
      serviceSheetsSnapshot.docs.forEach((doc) => {
        const sheet = doc.data();
        serviceSheetsMap.set(sheet.clientId, sheet);
      });

      const clientsWithServices = clients.map((client) => ({
        ...client,
        serviceSheet: serviceSheetsMap.get(client.id) || null,
      }));

      return {
        monthlyVisits,
        pendingVisits: pendingVisits.filter(Boolean), // Eliminar nulos
        technicians,
        clients: clientsWithServices, // Enviar los clientes con sus servicios adjuntos.
        googleEvents: googleEvents || [], // ✅ CORRECCIÓN: Asegurar que googleEvents siempre se incluya en la respuesta.
      };
    } catch (error) {
      console.error("Error en la Cloud Function getPlanningData:", error);
      throw new HttpsError(
        "internal",
        "No se pudieron obtener los datos de planeación."
      );
    }
  }
);

exports.getBillingDataForMonth = onCall({ cors: true }, async (request) => {
  if (!request.auth)
    throw new HttpsError("unauthenticated", "Debe estar autenticado.");

  const { month, year } = request.data;
  const { zona: userZone, role: userRole } = request.auth.token;
  if (month === undefined || !year)
    throw new HttpsError("invalid-argument", "Faltan mes o año.");

  try {
    // Validar que usuario tenga permiso para ver datos de billing
    const isAdmin = ["Administrador", "Jefe", "Coordinador Nacionales"].includes(userRole);
    if (!isAdmin && !userZone) {
      throw new HttpsError("permission-denied", "No tienes zona asignada para acceder a facturación.");
    }

    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0, 23, 59, 59);

    let visitasRef = db.collection("visitas");
    if (!isAdmin && userZone) {
      visitasRef = visitasRef.where("zona", "==", userZone);
    }

    const snapshot = await visitasRef
      .where("fecha_visita", ">=", startDate)
      .where("fecha_visita", "<=", endDate)
      .where("estado_visita", "==", "Realizada")
      .where("estado_facturacion", "==", "Pendiente")
      .where("gestionPermiso.aprobado", "==", true)
      .get();

    // ✅ MEJORA: Obtener todas las fichas de servicio de una vez para evitar múltiples lecturas.
    let serviceSheetQuery = db.collection("servicios");
    if (!isAdmin && userZone) {
      serviceSheetQuery = serviceSheetQuery.where("zona", "==", userZone);
    }
    const serviceSheetsSnapshot = await serviceSheetQuery.get();
    const serviceSheetsMap = new Map();
    serviceSheetsSnapshot.forEach((doc) => {
      const sheet = doc.data();
      if (sheet.clientId && sheet.services) {
        const servicesMap = new Map();
        sheet.services.forEach((service) => {
          servicesMap.set(service.tipo_servicio, service.valor || 0);
        });
        serviceSheetsMap.set(sheet.clientId, servicesMap);
      }
    });

    // ✅ CORRECCIÓN: Obtener los IDs de cliente directamente del snapshot antes de procesar.
    // La variable 'pendingVisitas' ya no existe, lo que causaba el ReferenceError.
    const uniqueClientIds = [
      ...new Set(snapshot.docs.map((doc) => doc.data().id_cliente)),
    ].filter(Boolean);
    const clientMap = new Map();

    if (uniqueClientIds.length > 0) {
      const CHUNK_SIZE = 30;
      const clientChunks = [];
      for (let i = 0; i < uniqueClientIds.length; i += CHUNK_SIZE) {
        clientChunks.push(uniqueClientIds.slice(i, i + CHUNK_SIZE));
      }

      const clientQueries = clientChunks.map((chunk) =>
        db
          .collection("clientes")
          .where(admin.firestore.FieldPath.documentId(), "in", chunk)
          .get()
      );

      const clientSnapshots = await Promise.all(clientQueries);
      clientSnapshots.forEach((snap) => {
        snap.forEach((doc) => {
          const data = doc.data();
          clientMap.set(doc.id, {
            name:
              data.nombreComercial ||
              `${data.nombres || ""} ${data.apellidos || ""}`.trim() ||
              "Cliente",
            address: data.direccion || "",
            nit: data.nit || "",
            baseRate: parseFloat(data.valor_servicio_base || 0),
          });
        });
      });
    }

    const groupedPending = {};

    // ✅ CORRECCIÓN: Procesar cada visita individualmente para garantizar la integridad de los datos.
    for (const doc of snapshot.docs) {
      const visita = doc.data();
      visita.id = doc.id; // ✅ CORRECCIÓN: Asegurar que el ID de la visita se propague.

      // 1. Limpieza de Fecha: Asegurar que `fecha_visita` sea un objeto Date válido.
      let safeDate = new Date();
      if (
        visita.fecha_visita &&
        typeof visita.fecha_visita.toDate === "function"
      ) {
        safeDate = visita.fecha_visita.toDate();
      } else if (
        visita.createdAt &&
        typeof visita.createdAt.toDate === "function"
      ) {
        safeDate = visita.createdAt.toDate();
      }
      // Si la fecha sigue siendo inválida, se usará la fecha actual como fallback seguro.
      if (isNaN(safeDate.getTime())) {
        safeDate = new Date();
      }
      visita.fecha_visita = safeDate;

      // 2. Agrupación
      const clientId = visita.id_cliente;
      if (!groupedPending[clientId]) {
        const clientInfo = clientMap.get(clientId) || {
          name: "Desconocido",
          address: "",
          nit: "",
          baseRate: 0,
        };
        groupedPending[clientId] = {
          clientId: clientId,
          groupName: clientInfo.name,
          clientNit: clientInfo.nit,
          clientAddress: clientInfo.address,
          services: [],
          totalValue: 0,
          status: "pending",
          month: month,
          year: year,
        };
      }

      // 3. Limpieza de Valor: Asegurar que `valor_servicio` sea un número válido.
      // ✅ CORRECCIÓN: Buscar el precio en el mapa de fichas de servicio que creamos.
      let finalPrice = 0;
      if (visita.valor_servicio && !isNaN(parseFloat(visita.valor_servicio))) {
        finalPrice = parseFloat(visita.valor_servicio);
      } else if (serviceSheetsMap.has(clientId)) {
        const clientServices = serviceSheetsMap.get(clientId);
        if (clientServices.has(visita.tipo_visita)) {
          finalPrice = clientServices.get(visita.tipo_visita);
        }
      }
      // Fallback al valor base del cliente si todo lo demás falla.
      if (finalPrice === 0) {
        finalPrice = clientMap.get(clientId)?.baseRate || 0;
      }

      visita.valor_servicio = finalPrice;
      groupedPending[clientId].services.push(visita);
      groupedPending[clientId].totalValue += finalPrice;
    }

    const pendingGroups = Object.values(groupedPending);

    let invoicedQuery = db
      .collection("grupos_facturacion")
      .where("month", "==", month)
      .where("year", "==", year);
    if (!isAdmin && userZone) {
      invoicedQuery = invoicedQuery.where("zona", "==", userZone);
    }
    const invoicedSnapshot = await invoicedQuery.get();

    const invoicedGroups = invoicedSnapshot.docs.map((doc) => {
      const d = doc.data();
      return {
        id: doc.id,
        ...d,
        createdAt:
          d.createdAt && typeof d.createdAt.toDate === "function"
            ? d.createdAt.toDate()
            : null,
        dueDate:
          d.dueDate && typeof d.dueDate.toDate === "function"
            ? d.dueDate.toDate()
            : null,
      };
    });

    return { pendingGroups, invoicedGroups };
  } catch (error) {
    logger.error("Error:", error);
    throw new HttpsError("internal", error.message);
  }
});

/**
 * ✅ MEJORA: Renombrada para evitar colisión. Lista todos los coordinadores para un admin/jefe.
 */
exports.listAllCoordinatorsForAdmin = onCall(
  { cors: true },
  async (request) => {
    const { auth } = request;
    if (!auth) {
      throw new HttpsError(
        "unauthenticated",
        "El usuario no está autenticado."
      );
    }
    const userRole = auth.token.role;
    if (userRole !== "Administrador" && userRole !== "Jefe") {
      throw new HttpsError(
        "permission-denied",
        "No tienes permiso para listar usuarios."
      );
    }

    try {
      const usersResult = await admin.auth().listUsers(1000);
      const coordinators = usersResult.users
        .filter((user) => user.customClaims?.role?.startsWith("Coordinador"))
        .map((user) => ({
          uid: user.uid,
          displayName: user.displayName || user.email,
          email: user.email,
          role: user.customClaims.role,
          zona: user.customClaims.zona,
        }));

      const integrationsSnapshot = await admin
        .firestore()
        .collection("calendar_integrations")
        .get();
      const integrations = {};
      integrationsSnapshot.forEach((doc) => {
        integrations[doc.id] = { connected: true, ...doc.data() };
      });

      const result = coordinators.map((coordinator) => ({
        ...coordinator,
        isConnected: !!integrations[coordinator.uid],
        googleUserName: integrations[coordinator.uid]?.googleUserName || null,
      }));

      return { coordinators: result };
    } catch (error) {
      console.error("Error al listar coordinadores:", error);
      throw new HttpsError(
        "internal",
        "No se pudieron listar los coordinadores."
      );
    }
  }
);

/**
 * ✅ NUEVA FUNCIÓN: Obtiene el nombre del coordinador para una zona específica.
 * Resuelve el error de CORS y el error 'internal' en VisitFormModal.
 */
exports.getCoordinatorForZone = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "El usuario no está autenticado.");
  }

  const { zone } = request.data;
  if (!zone) {
    throw new HttpsError("invalid-argument", "Se requiere una zona.");
  }

  // Mapeo de zonas a roles de coordinador
  const roleMap = {
    "Valle del Cauca": "Coordinador Valle",
    "Norte de Santander": "Coordinador Norte de Santander",
    Nacionales: "Coordinador Nacionales",
  };

  const expectedRole = roleMap[zone];
  if (!expectedRole) {
    return { name: "No hay coordinador para esta zona" };
  }

  try {
    const userRecords = await admin.auth().listUsers(1000);
    const coordinator = userRecords.users.find(
      (user) => user.customClaims && user.customClaims.role === expectedRole
    );

    if (coordinator) {
      return { name: coordinator.displayName || coordinator.email };
    } else {
      return { name: "Coordinador no encontrado" };
    }
  } catch (error) {
    logger.error(`Error buscando coordinador para la zona ${zone}:`, error);
    throw new HttpsError("internal", "Error al buscar el coordinador.");
  }
});

exports.batchAssignVisits = onCall({ cors: true }, async (request) => {
  assertAuth(request);
  const { visitIds, technicians } = request.data;

  if (!visitIds || !visitIds.length)
    throw new HttpsError("invalid-argument", "No hay visitas seleccionadas");

  const batch = db.batch();

  // Obtener zona del primer cliente para consistencia (opcional)
  const firstVisit = await db.collection("visitas").doc(visitIds[0]).get();
  let zoneToSet = "Sin Zona";
  if (firstVisit.exists) {
    const client = await db
      .collection("clientes")
      .doc(firstVisit.data().id_cliente)
      .get();
    if (client.exists) zoneToSet = client.data().zona || "Sin Zona";
  }

  visitIds.forEach((id) => {
    const ref = db.collection("visitas").doc(id);
    batch.update(ref, {
      fumigadores_asignados: technicians,
      zona: zoneToSet,
      updatedBy: request.auth.uid,
      estado_visita: "Programada", // Cambiar estado automáticamente
    });
  });

  await batch.commit();
  return { message: `${visitIds.length} visitas asignadas correctamente.` };
});

exports.getConsolidatedDashboardStats = onCall(
  {
    cors: true,
    timeoutSeconds: 120,
    memory: "512MB",
  },
  async (request) => {
    const { auth, data } = request;

    if (!auth) {
      throw new HttpsError(
        "unauthenticated",
        "El usuario debe estar autenticado para ver las estadísticas."
      );
    }
    const userZone = auth.token.zona;
    const userRole = auth.token.role;
    const isAdminOrJefe = userRole === "Administrador" || userRole === "Jefe";

    if (!userZone && !isAdminOrJefe) {
      throw new HttpsError(
        "permission-denied",
        "No tienes los permisos o la zona asignada para ver estas estadísticas."
              );
    }

    const hasGlobalAccess = [
      "Administrador",
      "Jefe",
      "Coordinador Nacionales",
      "Coordinador Nacional",
      "Gerente"
    ].includes(userRole);

    if (!userZone && !hasGlobalAccess) {    }

    const { clientDate, zone: requestedZone, range = "month" } = data; // Formato YYYY-MM-DD
    if (!clientDate) {
      throw new HttpsError(
        "invalid-argument",
        "Se requiere la fecha del cliente (clientDate)."
      );
    }

    try {
      const db = admin.firestore();

      const now = new Date(`${clientDate}T05:00:00.000Z`); // 00:00 en Colombia (UTC-5)
      let startOfRange, endOfRange;

      if (range === "today") {
        startOfRange = new Date(now);
        endOfRange = new Date(now);
        endOfRange.setHours(23, 59, 59, 999);
      } else if (range === "week") {
        const dayOfWeek = now.getDay(); // 0 (Sun) - 6 (Sat)
        startOfRange = new Date(now);
        startOfRange.setDate(
          now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1)
        ); // Lunes de esta semana
        endOfRange = new Date(startOfRange);
        endOfRange.setDate(startOfRange.getDate() + 6);
        endOfRange.setHours(23, 59, 59, 999);
      } else {
        // 'month' por defecto
        startOfRange = new Date(now.getFullYear(), now.getMonth(), 1);
        endOfRange = new Date(
          now.getFullYear(),
          now.getMonth() + 1,
          0,
          23,
          59,
          59
        );
      }

      // Para la agenda del día, siempre usamos el día actual.
      const startOfDay = new Date(`${clientDate}T05:00:00.000Z`);
      const startOfNextDay = new Date(startOfDay);
      startOfNextDay.setDate(startOfDay.getDate() + 1);

      // --- OPTIMIZACIÓN: Se definen las consultas base ---
      let servicesQuery = db.collection("servicios");
      let visitsQuery = db.collection("visitas");
      let clientsQuery = db.collection("clientes");
      let fumigadoresQuery = db.collection("fumigadores");

      let zoneToFilter = null;
      if (hasGlobalAccess) {
        if (requestedZone && requestedZone !== "Todos") {
          zoneToFilter = requestedZone;
        }
      } else {
        zoneToFilter = userZone;
      }

      if (zoneToFilter) {
        servicesQuery = servicesQuery.where("zona", "==", zoneToFilter);
        visitsQuery = visitsQuery.where("zona", "==", zoneToFilter);
        clientsQuery = clientsQuery.where("zona", "==", zoneToFilter);
        fumigadoresQuery = fumigadoresQuery.where("zona", "==", zoneToFilter);
      }

      // --- OPTIMIZACIÓN: Se definen las promesas para ejecutar en paralelo ---
      const servicesPromise = servicesQuery.get();
      const clientsPromise = clientsQuery.where("estado", "==", "Activo").get();

      // Consulta de visitas para el rango seleccionado (mes, semana, día)
      const visitsInRangePromise = visitsQuery
        .where("fecha_visita", ">=", startOfRange)
        .where("fecha_visita", "<=", endOfRange)
        .get();

      // Consulta de visitas para los últimos 6 meses para el gráfico de tendencia
      const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
      let baseVisitsQuery = db.collection("visitas");
      if (zoneToFilter)
        baseVisitsQuery = baseVisitsQuery.where("zona", "==", zoneToFilter);
      const visitsForChartPromise = baseVisitsQuery
        .where("fecha_visita", ">=", sixMonthsAgo)
        .where("estado_visita", "==", "Realizada")
        .get();

      let pendingVisitsQuery = db
        .collection("visitas")
        .where("createdBy", "==", "SYSTEM")
        .orderBy("fecha_visita", "asc")
        .limit(10);
      if (zoneToFilter) {
        pendingVisitsQuery = pendingVisitsQuery.where(
          "zona",
          "==",
          zoneToFilter
        );
      }
      const pendingVisitsPromise = pendingVisitsQuery.get();

      const fumigadoresPromise = fumigadoresQuery.get();

      // --- Ejecutar todas las promesas ---
      const [
        servicesSnapshot,
        clientsSnapshot,
        visitsInRangeSnapshot,
        visitsForChartSnapshot,
        pendingVisitsSnapshot,
        fumigadoresSnapshot,
      ] = await Promise.all([
        servicesPromise,
        clientsPromise,
        visitsInRangePromise,
        visitsForChartPromise,
        pendingVisitsPromise,
        fumigadoresPromise,
      ]);

      // --- Procesamiento de los resultados ---
      const allServices = servicesSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      const visitsInRange = (visitsInRangeSnapshot.docs || []).map((doc) => {
        const data = doc.data();
        const fechaVisita = data.fecha_visita
          ? data.fecha_visita.toDate()
          : null;
        return { id: doc.id, ...data, fecha_visita: fechaVisita };
      });
      const activeClients = clientsSnapshot.docs.map((doc) => doc.data());
      const totalClients = activeClients.length;
      const totalBranches = activeClients.reduce(
        (total, client) =>
          total + (Array.isArray(client.sucursales) ? client.sucursales.length : 0),
        0
      );
      const visitsThisMonthCount = visitsInRange.length;
      const validVisitsInRange = visitsInRange.filter((v) => v.fecha_visita);

      const completedThisMonth = visitsInRange.filter(
        (v) => v.estado_visita === "Realizada"
      ).length;
      const completionRateThisMonth =
        visitsThisMonthCount > 0
          ? Math.round((completedThisMonth / visitsThisMonthCount) * 100)
          : 0;

      let activeServices = 0;
      let revenueThisMonth = 0;
      const serviceTypeDistribution = {};
      const servicesByFrequency = {};

      // KPI: Servicios Activos y Distribuciones
      allServices.forEach((sheet) => {
        (sheet.services || []).forEach((service) => {
          if (service.estado_servicio === "Activo") activeServices++;
          if (service.tipo_servicio)
            serviceTypeDistribution[service.tipo_servicio] =
              (serviceTypeDistribution[service.tipo_servicio] || 0) + 1;
          if (service.frecuencia)
            servicesByFrequency[service.frecuencia] =
              (servicesByFrequency[service.frecuencia] || 0) + 1;
        });
      });

      // KPI: Ingresos del Mes
      const canViewBilling = hasGlobalAccess;
      if (canViewBilling) {
        validVisitsInRange.forEach((v) => {
          if (v.estado_visita === "Realizada") {
            const serviceSheet = allServices.find(
              (s) => s.clientId === v.id_cliente
            );
            if (serviceSheet && serviceSheet.services) {
              const service = serviceSheet.services.find(
                (s) => s.tipo_servicio === v.tipo_visita
              );
              if (service?.valor) revenueThisMonth += service.valor;
            }
          }
        });
      }

      // Gráfico: Visitas por Mes
      const allFumigadores = fumigadoresSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      const visitsPerMonth = {};
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthKey = `${d.getFullYear()}-${String(
          d.getMonth() + 1
        ).padStart(2, "0")}`;
        visitsPerMonth[monthKey] = 0;
      }
      const visitsForChart = visitsForChartSnapshot.docs.map((d) => {
        const data = d.data();
        return {
          ...data,
          fecha_visita: data.fecha_visita ? data.fecha_visita.toDate() : null,
        };
      });

      visitsForChart.forEach((v) => {
        if (v.estado_visita === "Realizada" && v.fecha_visita) {
          const d = v.fecha_visita; // Ahora estamos seguros de que 'd' no es nulo.
          const monthKey = `${d.getFullYear()}-${String(
            d.getMonth() + 1
          ).padStart(2, "0")}`;
          if (visitsPerMonth.hasOwnProperty(monthKey))
            visitsPerMonth[monthKey]++;
        }
      });

      // Gráfico: Productividad de Técnicos
      const technicianStats = {};
      allFumigadores.forEach((fumigador) => {
        technicianStats[fumigador.nombreCompleto] = {
          id: fumigador.id,
          realizadas: 0,
          programadas: 0,
          canceladas: 0,
        };
      });
      validVisitsInRange.forEach((v) => {
        (v.fumigadores_asignados || []).forEach((techName) => {
          if (technicianStats[techName]) {
            if (v.estado_visita === "Realizada")
              technicianStats[techName].realizadas++;
            else if (v.estado_visita === "Programada")
              technicianStats[techName].programadas++;
            else if (v.estado_visita === "Cancelada")
              technicianStats[techName].canceladas++;
          }
        });
      });

      // Gráfico: Clientes por Ciudad (se calcula a partir de las fichas de servicio)
      const clientsByCity = allServices.reduce((acc, sheet) => {
        if (sheet.clientCity) {
          acc[sheet.clientCity] = (acc[sheet.clientCity] || 0) + 1;
        }
        return acc;
      }, {});

      // Lista: Agenda del Día
      const todaysAgenda = validVisitsInRange
        .filter(
          (v) => v.fecha_visita >= startOfDay && v.fecha_visita < startOfNextDay
        )
        .map((visit) => {
          return {
            id: visit.id,
            id_cliente: visit.id_cliente,
            nombre_cliente: visit.nombre_cliente,
            tipo_visita: visit.tipo_visita,
            fecha_visita: visit.fecha_visita.toISOString(),
            fumigadores_asignados: visit.fumigadores_asignados || [],
          };
        });

      // Lista: Visitas Pendientes
      const pendingVisits = pendingVisitsSnapshot.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .filter(
          (visit) =>
            !visit.fumigadores_asignados ||
            visit.fumigadores_asignados.length === 0
        )
        .map((visit) => ({
          id: visit.id,
          nombre_cliente: visit.nombre_cliente,
          tipo_visita: visit.tipo_visita,
          fecha_visita: visit.fecha_visita.toDate().toISOString(),
        }));

      return {
        kpis: {
          totalClients,
          totalBranches,
          activeServices,
          visitsThisMonth: visitsThisMonthCount,
          revenueThisMonth,
          completionRateThisMonth,
        },
        charts: {
          serviceTypeDistribution,
          visitsPerMonth,
          servicesByFrequency,
          clientsByCity,
          technicianStats,
        },
        todaysAgenda,
        pendingVisits,
      };
    } catch (error) {
      console.error("Error al generar estadísticas consolidadas:", error);
      throw new HttpsError(
        "internal",
        "Ocurrió un error inesperado al procesar los datos del dashboard."
      );
    }
  }
);

/**
 * Se activa cuando un coordinador guarda un servicio con valor 0.
 */
exports.requestPriceForService = onCall({ cors: true }, async (request) => {
  const { auth, data } = request;
  if (!auth) {
    throw new HttpsError(
      "unauthenticated",
      "El usuario debe estar autenticado."
    );
  }

  const { clientId, clientName, serviceName } = data;
  if (!clientId || !clientName || !serviceName) {
    throw new HttpsError(
      "invalid-argument",
      "Faltan datos para crear la notificación de precio."
    );
  }

  const clientDoc = await admin
    .firestore()
    .collection("clientes")
    .doc(clientId)
    .get();
  if (!clientDoc.exists) {
    throw new HttpsError(
      "not-found",
      `No se encontró el cliente con ID: ${clientId}`
    );
  }
  const clientData = clientDoc.data();
  const finalClientName = clientData.nombreComercial || clientName; // Usar el nombre de la BD, con fallback.

  const requesterName = auth.token.name || auth.token.email;

  const notificationPayload = {
    title: "Solicitud de Precio",
    body: `El coordinador ${requesterName} ha creado el servicio "${serviceName}" para el cliente "${finalClientName}" y necesita que se le asigne un precio.`,
    relatedTo: { clientId, serviceName },
  };

  // No necesitamos esperar (await) a que se envíen las notificaciones.
  // Lo hacemos en segundo plano para dar una respuesta rápida al coordinador.
  sendNotificationToAdmins(notificationPayload);

  return {
    success: true,
    message: "Notificación de solicitud de precio creada.",
  };
});

/**
 * @param {object} payload - El contenido de la notificación.
 */
async function sendNotificationToAdmins(payload) {
  const targetRoles = ["Administrador", "Jefe", "Coordinador Nacionales", "Coordinador Nacional", "Gerente"];
  const users = await admin.auth().listUsers(1000);
  const adminUids = users.users
    .filter(
      (user) =>
        user.customClaims && targetRoles.includes(user.customClaims.role)
    )
    .map((user) => user.uid);

  if (adminUids.length > 0) {
    const db = admin.firestore();
    const batch = db.batch();
    adminUids.forEach((uid) => {
      const ref = db
        .collection("users")
        .doc(uid)
        .collection("direct_notifications")
        .doc();
      batch.set(ref, {
        ...payload,
        received: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });
    await batch.commit();
  }
}

/**
 * Si un servicio que antes tenía valor 0 ahora tiene un precio,
 * busca y elimina las notificaciones directas pendientes para ese servicio.
 */
exports.onServicePriceAssigned = onDocumentUpdated(
  "servicios/{serviceSheetId}",
  async (event) => {
    const beforeData = event.data.before.data();
    const afterData = event.data.after.data();
    const clientId = afterData.clientId;

    const servicesBefore = beforeData.services || [];
    const servicesAfter = afterData.services || [];

    const pricedServices = [];

    // Comparar los servicios para encontrar los que acaban de recibir un precio.
    servicesAfter.forEach((serviceAfter) => {
      const serviceBefore = servicesBefore.find(
        (s) => s.tipo_servicio === serviceAfter.tipo_servicio
      );
      if (
        serviceBefore &&
        serviceBefore.valor === 0 &&
        serviceAfter.valor > 0
      ) {
        pricedServices.push(serviceAfter.tipo_servicio);
      }
    });

    if (pricedServices.length === 0) {
      return null; // No hay nada que hacer.
    }

    // Buscar a todos los usuarios que podrían tener la notificación.
    const targetRoles = ["Administrador", "Jefe", "Coordinador Nacionales", "Coordinador Nacional", "Gerente"];
    const usersSnapshot = await admin
      .firestore()
      .collection("users")
      .where("role", "in", targetRoles)
      .get();

    const deletionPromises = [];

    usersSnapshot.forEach((userDoc) => {
      const notificationsRef = userDoc.ref.collection("direct_notifications");
      const q = notificationsRef
        .where("relatedTo.clientId", "==", clientId)
        .where("relatedTo.serviceName", "in", pricedServices);

      // Añadir la promesa de borrar los documentos encontrados a la lista.
      deletionPromises.push(
        q.get().then((snapshot) => snapshot.forEach((doc) => doc.ref.delete()))
      );
    });

    return Promise.all(deletionPromises);
  }
);

exports.getTechnicianProfileData = onCall({ cors: true }, async (request) => {
  const { auth, data } = request;
  if (!auth) {
    throw new HttpsError("unauthenticated", "El usuario no está autenticado.");
  }

  const { technicianId, month, year } = data;
  const { zona: userZone, role: userRole } = auth.token;
  if (!technicianId || typeof month !== "number" || typeof year !== "number") {
    throw new HttpsError("invalid-argument", "Se requieren el ID del técnico, mes y año.");
  }

  try {
    const db = admin.firestore();
    const techDoc = await db.collection("fumigadores").doc(technicianId).get();
    if (!techDoc.exists) {
      throw new HttpsError("not-found", "Técnico no encontrado.");
    }
    const technicianData = techDoc.data();
    const technicianName = technicianData.nombreCompleto;
    const zone = technicianData.zona;

    // Validar que el usuario tiene permiso para ver este técnico
    const isAdmin = ["Administrador", "Jefe", "Coordinador Nacionales"].includes(userRole);
    if (!isAdmin && userZone && zone !== userZone) {
      throw new HttpsError("permission-denied", "No tienes permiso para ver el perfil de este técnico.");
    }

    const startOfMonth = new Date(year, month, 1);
    const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59);
    const today = new Date();

    const visitsRef = db
      .collection("visitas")
      .where("fumigadores_asignados", "array-contains", technicianName)
      .where("zona", "==", zone);

    const allVisitsSnapshot = await visitsRef.get();

    const allVisits = allVisitsSnapshot.docs.map((doc) => {
      const data = doc.data();
      const date = data.fecha_visita;
      return {
        ...data,
        fecha_visita: date && typeof date.toDate === 'function' ? date.toDate() : new Date(date),
      };
    });

    const visitsInMonth = allVisits.filter(
      (v) => v.fecha_visita >= startOfMonth && v.fecha_visita <= endOfMonth
    );

    const assigned = visitsInMonth.length;
    const completed = visitsInMonth.filter(
      (v) => v.estado_visita === "Realizada"
    ).length;
    const rate = assigned > 0 ? Math.round((completed / assigned) * 100) : 0;

    const firstDayOfMonth = startOfMonth.getDay();
    const daysInMonth = endOfMonth.getDate();
    const weeklyWorkload = [0, 0, 0, 0, 0];
    visitsInMonth.forEach((visit) => {
      const dayOfMonth = visit.fecha_visita.getDate();
      const weekIndex = Math.floor((dayOfMonth - 1 + firstDayOfMonth) / 7);
      if (weekIndex >= 0 && weekIndex < 5) {
        weeklyWorkload[weekIndex]++;
      }
    });

    const upcomingVisits = allVisits
      .filter((v) => v.fecha_visita >= today)
      .sort((a, b) => a.fecha_visita - b.fecha_visita)
      .slice(0, 10);
    const recentHistory = allVisits
      .filter((v) => v.fecha_visita < today)
      .sort((a, b) => b.fecha_visita - a.fecha_visita)
      .slice(0, 10);

    const formatVisits = (visits) => visits.map((v) => ({
      ...v,
      fecha_visita: v.fecha_visita instanceof Date ? v.fecha_visita.toISOString() : new Date(v.fecha_visita).toISOString(),
    }));

    return {
      kpis: { assigned, completed, rate },
      workload: weeklyWorkload,
      upcomingVisits: formatVisits(upcomingVisits),
      recentHistory: formatVisits(recentHistory),
      technician: { id: techDoc.id, ...technicianData },
    };
  } catch (error) {
    console.error("Error al calcular estadísticas del técnico:", error);
    throw new HttpsError(
      "internal",
      "No se pudieron calcular las estadísticas."
    );
  }
});

exports.markVisitsAsBilled = onCall({ cors: true }, async (request) => {
  if (!request.auth)
    throw new HttpsError("unauthenticated", "Autenticación requerida");
  const { visitIds } = request.data;
  const db = admin.firestore();
  const batch = db.batch();

  try {
    visitIds.forEach((id) => {
      const ref = db.collection("visitas").doc(id);
      batch.update(ref, {
        estado_facturacion: "Facturada",
        billingData: {
          invoicedAt: admin.firestore.FieldValue.serverTimestamp(),
          manualMark: true,
        },
      });
    });

    await batch.commit();
    return { success: true };
  } catch (error) {
    throw new HttpsError("internal", error.message);
  }
});

exports.registerPartialPayment = onCall({ cors: true }, async (request) => {
  assertAuth(request);
  const { invoiceNumber, paymentDetails } = request.data;
  const { zona: userZone, role: userRole } = request.auth.token;

  // Validar datos
  if (!invoiceNumber || !paymentDetails) {
    throw new HttpsError("invalid-argument", "Faltan datos de pago.");
  }
  const amount = parseFloat(paymentDetails.amount);
  if (isNaN(amount) || amount <= 0) {
    throw new HttpsError("invalid-argument", "El monto debe ser un número positivo.");
  }
  if (!paymentDetails.date) {
    throw new HttpsError("invalid-argument", "Debe proporcionar la fecha del pago.");
  }

  // Usamos transacción para garantizar consistencia en el saldo
  await db.runTransaction(async (t) => {
    const q = await t.get(
      db
        .collection("grupos_facturacion")
        .where("invoiceNumber", "==", invoiceNumber)
    );
    if (q.empty) throw new HttpsError("not-found", "Factura no encontrada");

    const doc = q.docs[0];
    const data = doc.data();

    // Validar zona del usuario
    const isAdmin = ["Administrador", "Jefe"].includes(userRole);
    if (!isAdmin && userZone && data.zona && data.zona !== userZone) {
      throw new HttpsError("permission-denied", "No tienes permiso para registrar pagos en esta factura.");
    }

    // Validar que monto no exceda saldo
    const currentBalance = data.currentBalance || data.totalValue || 0;
    if (amount > currentBalance) {
      throw new HttpsError("failed-precondition", `El monto no puede exceder el saldo pendiente: ${currentBalance}`);
    }

    // Crear subcolección de pagos
    const newRef = doc.ref.collection("payments").doc();

    const paymentDataWithTimestamp = {
      ...paymentDetails,
      paymentDate: admin.firestore.Timestamp.fromDate(
        new Date(paymentDetails.date)
      ),
    };

    t.set(newRef, {
      ...paymentDataWithTimestamp,
      registeredAt: admin.firestore.FieldValue.serverTimestamp(),
      registeredBy: request.auth.uid,
    });

    // Actualizar saldo
    const newBalance = currentBalance - amount;

    // Determinar nuevo estado
    let newStatus = "partially_paid";
    if (newBalance <= 100) newStatus = "paid"; // Margen de error de 100 pesos

    t.update(doc.ref, {
      currentBalance: newBalance,
      status: newStatus,
      lastPaymentDate: admin.firestore.FieldValue.serverTimestamp(),
    });
  });
  return { success: true };
});

exports.getPaymentDataForMonth = onCall({ cors: true }, async (request) => {
  const { auth, data } = request;
  if (!auth) {
    throw new HttpsError("unauthenticated", "El usuario no está autenticado.");
  }

  const userRole = auth.token.role;
  const userZone = auth.token.zona;
  const allowedRoles = ["Jefe", "Administrador", "Coordinador Nacionales"];
  if (!allowedRoles.includes(userRole)) {
    throw new HttpsError(
      "permission-denied",
      "No tienes permiso para acceder a esta información."
    );
  }

  // Validar que usuario tenga zona si no es admin/jefe
  const isAdmin = ["Administrador", "Jefe"].includes(userRole);
  if (!isAdmin && !userZone) {
    throw new HttpsError("permission-denied", "No tienes zona asignada para ver pagos.");
  }

  // ✅ CORRECCIÓN: Se usan 'month' y 'year' para consistencia con 'getBillingDataForMonth'.
  const { month, year } = data;
  if (month === undefined || year === undefined) {
    throw new HttpsError("invalid-argument", "Se requieren el mes y el año.");
  }

  try {
    // 1. Obtener todos los grupos de facturación para el mes/año.
    let groupsQuery = db
      .collection("grupos_facturacion")
      .where("month", "==", month)
      .where("year", "==", year);
    if (!isAdmin && userZone) {
      groupsQuery = groupsQuery.where("zona", "==", userZone);
    }
    const groupsSnapshot = await groupsQuery.get();

    const allGroupsPromises = groupsSnapshot.docs.map(async (doc) => {
      const groupData = doc.data();

      // 2. Para cada grupo, obtener su historial de pagos de la subcolección.
      const paymentsSnapshot = await doc.ref
        .collection("payments")
        .orderBy("registeredAt", "desc")
        .get();
      const paymentHistory = paymentsSnapshot.docs.map((paymentDoc) => {
        const paymentData = paymentDoc.data();
        return {
          ...paymentData,
          // ✅ CORRECCIÓN: Manejar ambos casos, si la fecha es un Timestamp de Firestore o un string.
          // Esto asegura que tanto los pagos antiguos como los nuevos se muestren correctamente.
          paymentDate: paymentData.paymentDate
            ? paymentData.paymentDate.toDate
              ? paymentData.paymentDate.toDate().toISOString()
              : new Date(paymentData.paymentDate).toISOString()
            : null,
          registeredAt: paymentData.registeredAt?.toDate
            ? paymentData.registeredAt.toDate().toISOString()
            : null,
        };
      });

      const totalPaid = paymentHistory.reduce(
        (sum, p) => sum + (p.amount || 0),
        0
      );
      const totalBilled = groupData.totalValue || 0;
      const currentBalance = totalBilled - totalPaid;

      // 3. Devolver el objeto de grupo enriquecido.
      return {
        id: doc.id,
        ...groupData,
        createdAt: groupData.createdAt?.toDate
          ? groupData.createdAt.toDate().toISOString()
          : null,
        dueDate: groupData.dueDate?.toDate
          ? groupData.dueDate.toDate().toISOString()
          : null,
        totalBilled: totalBilled,
        totalPaid: totalPaid,
        currentBalance: currentBalance,
        paymentHistory: paymentHistory,
        // Asegurar que los servicios también tengan fechas serializadas
        services: (groupData.services || []).map((s) => ({
          ...s,
          date: s.date ? new Date(s.date).toISOString() : null,
        })),
      };
    });

    const allGroups = await Promise.all(allGroupsPromises);

    return { allGroups };
  } catch (error) {
    logger.error("Error FATAL en getPaymentDataForMonth:", error);
    throw new HttpsError(
      "internal",
      "No se pudieron obtener los datos de pagos."
    );
  }
});

/**
 * Script de ejecución única para rellenar el campo 'fumigadores_asignados'
 * en los servicios anidados dentro de las facturas antiguas.
 */
exports.backfillInvoiceTechnicians = onCall(
  {
    cors: true,
    timeoutSeconds: 540,
    memory: "1GiB",
  },
  async (request) => {
    // 1. Verificación de seguridad: solo para administradores.
    if (!request.auth || request.auth.token.role !== "Administrador") {
      throw new HttpsError(
        "permission-denied",
        "Solo los administradores pueden ejecutar este script."
      );
    }

    const db = admin.firestore();
    const invoicesRef = db.collection("grupos_facturacion");
    let updatedInvoicesCount = 0;
    const batchSize = 50; // Procesar en lotes más pequeños por la complejidad
    let lastDoc = null;

    logger.log("Iniciando script de backfill para técnicos en facturas...");

    try {
      while (true) {
        const query = lastDoc
          ? invoicesRef
              .orderBy(admin.firestore.FieldPath.documentId())
              .startAfter(lastDoc)
              .limit(batchSize)
          : invoicesRef
              .orderBy(admin.firestore.FieldPath.documentId())
              .limit(batchSize);

        const snapshot = await query.get();
        if (snapshot.empty) break;

        const batch = db.batch();

        for (const invoiceDoc of snapshot.docs) {
          const invoiceData = invoiceDoc.data();
          let needsUpdate = false;

          if (invoiceData.services && Array.isArray(invoiceData.services)) {
            const updatedServices = [...invoiceData.services]; // Copia para modificar

            // ✅ CORRECCIÓN DEFINITIVA: Reconstruir la búsqueda de la visita original
            // usando una combinación de cliente, tipo y fecha, ya que visitId puede no existir.
            const servicePromises = updatedServices.map(async (service) => {
              // Si ya tiene el campo, lo saltamos para ser eficientes.
              if (Array.isArray(service.fumigadores_asignados)) {
                return service;
              }

              // 1. Reconstruir la fecha del servicio, manejando ambos casos (Timestamp y String).
              let serviceDate;
              if (service.date && typeof service.date.toDate === "function") {
                // Es un Timestamp de Firestore
                serviceDate = service.date.toDate();
              } else if (typeof service.date === "string") {
                // Es un string ISO
                serviceDate = new Date(service.date);
              } else {
                // No se puede determinar la fecha, saltar este servicio.
                return service;
              }

              const startOfDay = new Date(serviceDate);
              startOfDay.setUTCHours(0, 0, 0, 0);
              const endOfDay = new Date(serviceDate);
              endOfDay.setUTCHours(23, 59, 59, 999);

              // 2. Crear una consulta precisa para encontrar la visita original.
              const visitQuery = db
                .collection("visitas")
                .where("id_cliente", "==", invoiceData.clientId)
                .where("tipo_visita", "==", service.tipo_visita)
                .where("fecha_visita", ">=", startOfDay)
                .where("fecha_visita", "<=", endOfDay)
                .limit(1);

              const visitSnapshot = await visitQuery.get();

              if (!visitSnapshot.empty) {
                const originalVisitData = visitSnapshot.docs[0].data();
                // 3. Devolver el servicio actualizado con los técnicos.
                return {
                  ...service,
                  fumigadores_asignados:
                    originalVisitData.fumigadores_asignados || [],
                };
              }

              // Si no se encuentra la visita, devolver el servicio sin cambios.
              return service;
            });

            const rebuiltServices = await Promise.all(servicePromises);

            // Comparamos el array original con el reconstruido para ver si hubo cambios.
            if (
              JSON.stringify(invoiceData.services) !==
              JSON.stringify(rebuiltServices)
            ) {
              batch.update(invoiceDoc.ref, { services: rebuiltServices });
              updatedInvoicesCount++;
            }
          }
        }

        await batch.commit();
        lastDoc = snapshot.docs[snapshot.docs.length - 1];
      }

      const message = `¡Éxito! Se actualizaron los datos de técnicos en ${updatedInvoicesCount} facturas.`;
      logger.log(message);
      return { success: true, message };
    } catch (error) {
      logger.error("Error durante el backfill de técnicos en facturas:", error);
      throw new HttpsError(
        "internal",
        "Ocurrió un error al actualizar las facturas."
      );
    }
  }
);

/**
 * Script de ejecución única para rellenar el campo 'zona' en facturas antiguas.
 * Recorre las facturas, busca la zona del cliente asociado y actualiza la factura.
 */
exports.backfillInvoiceZones = onCall(
  {
    cors: true,
    timeoutSeconds: 540, // Timeout largo para un script de migración
    memory: "1GiB",
  },
  async (request) => {
    // 1. Verificación de seguridad: solo para administradores.
    if (!request.auth || request.auth.token.role !== "Administrador") {
      throw new HttpsError(
        "permission-denied",
        "Solo los administradores pueden ejecutar este script."
      );
    }

    const db = admin.firestore();
    const invoicesRef = db.collection("grupos_facturacion");
    const clientsRef = db.collection("clientes");
    let updatedCount = 0;
    const batchSize = 100; // Procesar 100 facturas a la vez para no exceder la memoria.
    let lastDoc = null;

    logger.log("Iniciando script de backfill para zonas de facturas...");

    try {
      while (true) {
        // 2. Obtener un lote de facturas.
        const query = lastDoc
          ? invoicesRef
              .orderBy(admin.firestore.FieldPath.documentId())
              .startAfter(lastDoc)
              .limit(batchSize)
          : invoicesRef
              .orderBy(admin.firestore.FieldPath.documentId())
              .limit(batchSize);

        const snapshot = await query.get();
        if (snapshot.empty) {
          break; // No hay más facturas, terminamos el bucle.
        }

        const batch = db.batch();
        const invoicesToUpdate = [];

        // 3. Filtrar las que no tienen zona.
        snapshot.forEach((doc) => {
          const data = doc.data();
          if (!data.zona && data.clientId) {
            invoicesToUpdate.push({ id: doc.id, clientId: data.clientId });
          }
        });

        // 4. Obtener los datos de los clientes necesarios.
        if (invoicesToUpdate.length > 0) {
          const clientIds = [
            ...new Set(invoicesToUpdate.map((inv) => inv.clientId)),
          ];
          const clientDocs = await clientsRef
            .where(admin.firestore.FieldPath.documentId(), "in", clientIds)
            .get();
          const clientZoneMap = new Map();
          clientDocs.forEach((doc) =>
            clientZoneMap.set(doc.id, doc.data().zona || "Sin Zona")
          );

          // 5. Preparar las actualizaciones en un lote.
          invoicesToUpdate.forEach((invoice) => {
            const zone = clientZoneMap.get(invoice.clientId);
            if (zone) {
              const invoiceRef = invoicesRef.doc(invoice.id);
              batch.update(invoiceRef, { zona: zone });
              updatedCount++;
            }
          });
          await batch.commit(); // Ejecutar el lote de actualizaciones.
        }

        lastDoc = snapshot.docs[snapshot.docs.length - 1];
      }

      const message = `¡Éxito! Se actualizaron ${updatedCount} facturas con su zona correspondiente.`;
      logger.log(message);
      return { success: true, message };
    } catch (error) {
      logger.error("Error durante el backfill de zonas de facturas:", error);
      throw new HttpsError(
        "internal",
        "Ocurrió un error al actualizar las facturas."
      );
    }
  }
);

exports.generateInvoiceReport = onCall({ cors: true }, async (request) => {
  assertRole(request, ["Administrador", "Jefe", "Coordinador Nacionales", "Coordinador Valle", "Coordinador Norte de Santander"]);
  const {
    servicesToInvoice,
    groupName,
    clientId: clientFromFrontend,
    dueDays,
    observations,
  } = request.data;
  const { zona: userZone, role: userRole } = request.auth.token;

  if (!servicesToInvoice || servicesToInvoice.length === 0)
    throw new HttpsError(
      "invalid-argument",
      "Debe seleccionar servicios para facturar."
    );
  if (typeof dueDays !== 'number' || dueDays < 0) {
    throw new HttpsError("invalid-argument", "El vencimiento debe ser un número válido.");
  }

  const isAdmin = ["Administrador", "Jefe"].includes(userRole);
  if (!isAdmin && !userZone) {
    throw new HttpsError("permission-denied", "No tienes zona asignada para facturar.");
  }

  return await db.runTransaction(async (t) => {
    let total = 0;
    const services = [];
    let clientId = null;
    let clientName = groupName;
    let clientZone = "Sin Zona";
    let servicePrices = new Map();
    let clientBaseRate = 0;
    const visitUpdates = [];

    for (const serviceData of servicesToInvoice) {
      const visitRef = db.collection("visitas").doc(serviceData.id);
      const visitDoc = await t.get(visitRef);

      if (!visitDoc.exists) {
        throw new HttpsError("not-found", `Visita ${serviceData.id} no encontrada.`);
      }

      const d = visitDoc.data();

      if (d.estado_facturacion === "Facturada") {
        throw new HttpsError("failed-precondition", `La visita ${serviceData.id} ya fue facturada.`);
      }

      if (!clientId) {
        clientId = d.id_cliente || clientFromFrontend;
        if (!clientId) {
          throw new HttpsError("invalid-argument", "No se pudo determinar el cliente.");
        }
        const cDoc = await t.get(db.collection("clientes").doc(clientId));
        if (!cDoc.exists) {
          throw new HttpsError("not-found", `Cliente ${clientId} no encontrado.`);
        }
        const clientData = cDoc.data();
        const clientZones = Array.isArray(clientData.zonasDeSucursales)
          ? clientData.zonasDeSucursales
          : [clientData.zona].filter(Boolean);
        clientZone = d.zona || clientData.zona || clientZones[0] || "Sin Zona";
        clientName = clientData.nombreComercial || groupName;

        if (!isAdmin && userZone && !clientZones.includes(userZone) && d.zona !== userZone) {
          throw new HttpsError("permission-denied", `No puedes facturar clientes de la zona ${clientZone}.`);
        }

        clientBaseRate = Number(clientData.valor_servicio_base) || 0;
        const serviceSheetDoc = await t.get(
          db.collection("servicios").doc(clientId)
        );
        const serviceSheet = serviceSheetDoc.exists ? serviceSheetDoc.data() : null;
        if (Array.isArray(serviceSheet?.services)) {
          serviceSheet.services.forEach((service) => {
            const price = Number(service.valor);
            if (service.tipo_servicio && Number.isFinite(price) && price > 0) {
              servicePrices.set(service.tipo_servicio, price);
            }
          });
        }
      }

      if (d.id_cliente !== clientId) {
        throw new HttpsError("failed-precondition", "Todas las visitas deben pertenecer al mismo cliente.");
      }

      const storedValue = Number(d.valor_servicio);
      const val = storedValue > 0
        ? storedValue
        : servicePrices.get(d.tipo_visita) || clientBaseRate;
      if (val <= 0) {
        throw new HttpsError("failed-precondition", `La visita ${serviceData.id} no tiene un precio configurado para el servicio ${d.tipo_visita || "seleccionado"}.`);
      }
      total += val;

      const serviceItem = {
        ...d,
        value: val,
        valor_servicio: val,
        date: d.fecha_visita,
      };
      services.push(serviceItem);

      visitUpdates.push({ ref: visitRef, data: {
        estado_facturacion: "Facturada",
        billingData: { invoicedAt: admin.firestore.FieldValue.serverTimestamp() },
      }});
    }

    visitUpdates.forEach(({ ref, data }) => t.update(ref, data));

    const invoiceRef = db.collection("grupos_facturacion").doc();
    const invoiceNumber = `F-${Date.now().toString().slice(-6)}`;
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + dueDays);

    t.set(invoiceRef, {
      groupName,
      clientName,
      clientId,
      zona: clientZone,
      totalValue: total,
      currentBalance: total,
      status: "billed",
      services,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      invoiceNumber,
      dueDate: admin.firestore.Timestamp.fromDate(dueDate),
      observations: observations || "",
      month: new Date().getMonth(),
      year: new Date().getFullYear(),
    });

    return { invoiceNumber };
  });
});

exports.getInvoiceExcel = onCall({ cors: true }, async (request) => {
  if (!request.auth)
    throw new HttpsError("unauthenticated", "Autenticación requerida");
  const { invoiceNumber } = request.data;
  const XLSX = require("xlsx");

  const snap = await db
    .collection("grupos_facturacion")
    .where("invoiceNumber", "==", invoiceNumber)
    .limit(1)
    .get();
  if (snap.empty) throw new HttpsError("not-found", "Factura no encontrada");

  const data = snap.docs[0].data();

  // Reconstruir Excel
  const wb = XLSX.utils.book_new();
  const wsData = [
    ["RE-IMPRESIÓN FACTURA"],
    [
      "Fecha Emisión",
      data.createdAt?.toDate
        ? data.createdAt.toDate().toLocaleDateString()
        : "",
    ],
    ["Cliente", data.clientName],
    ["Factura #", data.invoiceNumber],
    ["Total", data.totalValue],
    [],
    ["Fecha Servicio", "Servicio", "Sede", "Valor"],
  ];

  if (data.services) {
    data.services.forEach((s) => {
      wsData.push([
        s.date ? new Date(s.date).toLocaleDateString() : "",
        s.tipo_visita || "Servicio",
        s.ubicacion || "",
        s.value,
      ]);
    });
  }

  const ws = XLSX.utils.aoa_to_sheet(wsData);
  XLSX.utils.book_append_sheet(wb, ws, "Factura");
  const wbOut = XLSX.write(wb, { bookType: "xlsx", type: "base64" });

  return { fileData: wbOut };
});

exports.exportPaymentDataToExcel = onCall(
  { cors: true },
  { timeoutSeconds: 60, memory: "512MiB" },
  async (request) => {
    const XLSX = require("xlsx");

    const { auth, data } = request;
    if (!auth) {
      throw new HttpsError(
        "unauthenticated",
        "El usuario no está autenticado."
      );
    }

    const { paymentGroups } = data;
    if (!paymentGroups || paymentGroups.length === 0) {
      throw new HttpsError(
        "invalid-argument",
        "No hay datos de grupos de pagos para exportar."
      );
    }

    const wb = XLSX.utils.book_new();

    // --- HOJA 1: RESUMEN DE FACTURAS ---
    const summaryData = paymentGroups.map((group) => {
      const currency = group.paymentHistory[0]?.currency || "COP";
      return {
        "N° Factura/Grupo": group.groupName,
        "Cliente Principal": group.clientName,
        Estado:
          group.status === "billed"
            ? "Pendiente"
            : group.status === "partially_paid"
            ? "Abonado"
            : "Pagado",
        "Fecha Vencimiento": group.dueDate
          ? new Date(group.dueDate).toISOString().split("T")[0]
          : "N/A",
        "Total Facturado": group.totalBilled,
        "Total Abonado": group.totalPaid,
        "Saldo Pendiente": group.currentBalance,
        Moneda: currency,
        Observaciones: group.observations || "",
      };
    });

    const wsSummary = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, wsSummary, "Resumen Facturas");

    const detailedPayments = [];
    paymentGroups.forEach((group) => {
      group.paymentHistory.forEach((p) => {
        detailedPayments.push({
          "N° Factura/Grupo": group.groupName,
          Cliente: group.clientName,
          "Monto Abono": p.amount,
          Moneda: p.currency || "COP",
          "Método Pago": p.method,
          "Fecha Pago": p.paymentDate
            ? new Date(p.paymentDate).toISOString().split("T")[0]
            : "N/A",
          Referencia: p.reference || "N/A",
          "Registrado Por (UID)": p.registeredByUid || "Sistema",
          "Fecha Registro Sistema": p.registeredAt
            ? new Date(p.registeredAt).toLocaleString("es-CO")
            : "N/A",
        });
      });
    });

    const wsDetail = XLSX.utils.json_to_sheet(detailedPayments);
    XLSX.utils.book_append_sheet(wb, wsDetail, "Historial Abonos");

    // --- GENERACIÓN Y CODIFICACIÓN DEL ARCHIVO ---
    const wbout = XLSX.write(wb, { bookType: "xlsx", type: "base64" });

    return { data: { fileData: wbout } };
  }
);

// --- Funciones de Disparo (Triggers) ---

exports.handleVisitWrite = onDocumentWritten(
  { document: "visitas/{visitId}" },
  async (event) => {
    // 1. EXTRAER VISITID DE MANERA SEGURA AL INICIO
    const visitId = event.params.visitId;

    if (!visitId) {
      logger.error(
        "Visit ID is undefined in handleVisitWrite event params. Aborting."
      );
      return;
    }

    const after = event.data.after.exists ? event.data.after.data() : null;
    const before = event.data.before.exists ? event.data.before.data() : null;

    // --- LOGICA ANTI-BUCLE ---
    // Si la función se dispara solo porque nosotros mismos acabamos de guardar el googleEventId,
    // y no ha cambiado nada más importante, DEBEMOS DETENERNOS.
    if (before && !before.googleEventId && after.googleEventId) {
      // Asumimos que este cambio lo hizo 'createOrUpdateCalendarEvent' en la ejecución anterior.
      // Si no paramos aquí, se volverá a enviar el correo.
      return;
    }

    if (
      before &&
      after &&
      before.googleEventId !== after.googleEventId &&
      Object.keys(before).length + 1 === Object.keys(after).length
    ) {
      return;
    }
    if (!after) return;

    let isNewOrUpdatedVisit = false;
    if (after.estado_visita === "Programada") {
      const visitDate = after.fecha_visita.toDate();
      const now = new Date();
      visitDate.setHours(0, 0, 0, 0);
      now.setHours(0, 0, 0, 0);
      isNewOrUpdatedVisit = visitDate >= now;
    }

    if (isNewOrUpdatedVisit) {
      let organizerUid = null;
      const requesterUid = after.createdBy;
      const visitZone = after.zona;
      const calendarOwnerUid = after.calendarOwnerUid || null;

      // Lógica simplificada de asignación de organizador
      if (visitZone) {
        const roleMap = {
          "Valle del Cauca": "Coordinador Valle",
          "Norte de Santander": "Coordinador Norte de Santander",
          Nacionales: "Coordinador Nacionales",
        };
        const expectedRole = roleMap[visitZone];
        if (expectedRole) {
          const users = await admin.auth().listUsers(1000);
          const coordinator = users.users.find(
            (u) => u.customClaims?.role === expectedRole
          );
          if (coordinator) organizerUid = coordinator.uid;
        }
      }

      // Fallback explícito al calendario elegido en el formulario.
      if (!organizerUid && calendarOwnerUid) {
        organizerUid = calendarOwnerUid;
      }

      // Fallback: Si quien creó la visita es coordinador, usar su calendario
      if (!organizerUid && requesterUid) {
        try {
          const creator = await admin.auth().getUser(requesterUid);
          if (creator.customClaims?.role?.startsWith("Coordinador")) {
            organizerUid = requesterUid;
          }
        } catch (e) {}
      }

      if (organizerUid) {
        const googleEventId = await createOrUpdateCalendarEvent(
          after,
          visitId,
          organizerUid
        );
        // ✅ CORRECCIÓN: Eliminada la actualización redundante. 'createOrUpdateCalendarEvent' ya se encarga de guardar el ID.

        // Enviamos el correo explícitamente ya que Calendar a veces no envía el HTML completo
        await sendVisitNotificationViaGmailAPI(after, visitId, organizerUid);
      } else {
        logger.warn(
          `[VISITA/email] No se pudo resolver una cuenta de Google para la visita ${visitId}. ` +
            `zona=${visitZone || "N/A"}, calendarOwnerUid=${calendarOwnerUid || "N/A"}, createdBy=${requesterUid || "N/A"}`
        );
      }
    }
  }
);

exports.onClientWrite = onDocumentWritten("clientes/{clientId}", (event) => {
  if (!event.data.after.exists) return null;
  const data = event.data.after.data();
  const lowerCaseField = (data.nombreComercial || "").toLowerCase();
  if (data.nombreComercial_lower === lowerCaseField) return null;
  return event.data.after.ref.update({
    nombreComercial_lower: lowerCaseField,
  });
});

exports.onFumigadorWrite = onDocumentWritten(
  "fumigadores/{fumigadorId}",
  (event) => {
    if (!event.data.after.exists) return null;
    const data = event.data.after.data();
    const lowerCaseField = (data.nombreCompleto || "").toLowerCase();
    if (data.nombreCompleto_lower === lowerCaseField) return null;
    return event.data.after.ref.update({
      nombreCompleto_lower: lowerCaseField,
    });
  }
);

// --- Función Programada (Cron) ---
exports.scheduleRecurringVisits = onSchedule(
  {
    schedule: "every day 03:00", // 3 AM Hora Colombia
    timeZone: "America/Bogota",
  },
  async (event) => {
    logger.info("🤖 [BOT] Iniciando generación de visitas recurrentes...");

    const servicesSnapshot = await db.collection("servicios").get();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let createdCount = 0;

    for (const doc of servicesSnapshot.docs) {
      const sheet = doc.data();
      if (!sheet.services) continue;

      for (const s of sheet.services) {
        // Ignorar servicios inactivos o únicos
        if (
          s.estado_servicio !== "Activo" ||
          !s.frecuencia ||
          s.frecuencia === "UNICA"
        )
          continue;

        // Buscar última visita de este tipo
        const lastSnap = await db
          .collection("visitas")
          .where("id_cliente", "==", sheet.clientId)
          .where("tipo_visita", "==", s.tipo_servicio)
          .orderBy("fecha_visita", "desc")
          .limit(1)
          .get();

        // Calcular próxima fecha
        let nextDate;
        if (lastSnap.empty) {
          // Si nunca se ha hecho, ¿deberíamos crearla ya?
          // Asumimos fecha de inicio de contrato si existiera, o today + frecuencia
          nextDate = new Date();
        } else {
          const lastDate = lastSnap.docs[0].data().fecha_visita.toDate();
          nextDate = calculateNextVisitDate(lastDate, s.frecuencia);
        }

        // Si la fecha ya llegó o pasó, y no existe visita agendada para ese día
        if (nextDate <= today || nextDate - today < 7 * 86400000) {
          // Crear con 7 días de antelación
          const checkExists = await db
            .collection("visitas")
            .where("id_cliente", "==", sheet.clientId)
            .where("tipo_visita", "==", s.tipo_servicio)
            .where(
              "fecha_visita",
              "==",
              admin.firestore.Timestamp.fromDate(nextDate)
            )
            .get();

          if (checkExists.empty) {
            await db.collection("visitas").add({
              id_cliente: sheet.clientId,
              nombre_cliente: sheet.clientName || "Cliente Sistema",
              fecha_visita: admin.firestore.Timestamp.fromDate(nextDate),
              tipo_visita: s.tipo_servicio,
              estado_visita: "Agendada", // Estado inicial
              estado_facturacion: "Pendiente",
              createdBy: "SYSTEM",
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
              fumigadores_asignados: [],
              zona: sheet.zona || "Sin Zona",
              ubicacion: sheet.direccion || "Sede Principal",
            });
            createdCount++;
          }
        }
      }
    }
    logger.info(`🤖 [BOT] Finalizado. Visitas creadas: ${createdCount}`);
  }
);

/**
 * Tarea programada para realizar backup de Firestore.
 * Se ejecuta cada día a las 02:00 AM.
 * NOTA: Requiere habilitar la API de Cloud Firestore y permisos de IAM para la cuenta de servicio.
 */
exports.scheduledFirestoreBackup = onSchedule(
  {
    schedule: "every day 02:00",
    timeZone: "America/Bogota",
  },
  async (event) => {
    const client = new admin.firestore.v1.FirestoreAdminClient();
    const projectId = process.env.GCLOUD_PROJECT;
    const databaseName = client.databasePath(projectId, "(default)");
    const bucket = `gs://${projectId}-backups`; // Asegúrate de crear este bucket

    try {
      const [response] = await client.exportDocuments({
        name: databaseName,
        outputUriPrefix: bucket,
        collectionIds: [], // Exportar todas las colecciones
      });
      logger.info(`Backup iniciado: ${response.name}`);
    } catch (err) {
      logger.error("Error iniciando backup:", err);
    }
  }
);

function calculateNextVisitDate(date, freq) {
  const d = new Date(date);
  switch (freq) {
    case "MENSUAL":
      d.setMonth(d.getMonth() + 1);
      break;
    case "BIMENSUAL":
      d.setMonth(d.getMonth() + 2);
      break;
    case "TRIMESTRAL":
      d.setMonth(d.getMonth() + 3);
      break;
    case "SEMESTRAL":
      d.setMonth(d.getMonth() + 6);
      break;
    case "SEMANAL":
      d.setDate(d.getDate() + 7);
      break;
    case "QUINCENAL":
      d.setDate(d.getDate() + 15);
      break;
    default:
      d.setMonth(d.getMonth() + 1);
  }
  return d;
}

exports.getAnnualBillingReport = onCall(
  { timeoutSeconds: 180, memory: "512MB" },
  async (request) => {
    const { auth, data } = request;
    if (!auth)
      throw new HttpsError(
        "unauthenticated",
        "El usuario no está autenticado."
      );

    const userZone = auth.token.zona;
    const userRole = auth.token.role;
    const hasGlobalAccess = [
      "Administrador",
      "Jefe",
      "Coordinador Nacionales",
      "Coordinador Nacional",
      "Gerente"
    ].includes(userRole);

    const { year, zone: requestedZone } = data;
    if (typeof year !== "number")
      throw new HttpsError("invalid-argument", "Se requiere el año.");

    if (!userZone && !hasGlobalAccess) {
      throw new HttpsError(
        "permission-denied",
        "No tienes los permisos o la zona asignada para ver reportes."
      );
    }

    try {
      const db = admin.firestore();

      // Determinar la zona a filtrar
      let zoneToFilter = null;
      if (hasGlobalAccess && requestedZone && requestedZone !== "Todos") {
        zoneToFilter = requestedZone;
      } else if (!hasGlobalAccess) {
        zoneToFilter = userZone;
      }

      // 1. Obtener todas las facturas del año, filtrando por zona si es necesario.
      let invoicesQuery = db
        .collection("grupos_facturacion")
        .where("year", "==", year);
      if (zoneToFilter) {
        // Asumimos que las facturas tienen un campo 'zona' o similar.
        // Si no, necesitaríamos obtener los clientes de la zona y luego filtrar facturas por clientId.
        // Por simplicidad, asumimos que la factura tiene la zona.
        invoicesQuery = invoicesQuery.where("zona", "==", zoneToFilter);
      }
      const invoicesSnapshot = await invoicesQuery.get();

      // 2. Obtener todos los pagos de esas facturas en paralelo.
      const paymentPromises = invoicesSnapshot.docs.map((doc) =>
        doc.ref.collection("payments").get()
      );
      const paymentsByInvoice = await Promise.all(paymentPromises);

      // Inicializar estructuras de datos
      const monthlyTrend = new Array(12).fill(0); // Ingresos pagados por mes
      const clientRevenue = {}; // { clientId: { totalPaid, clientName } }
      const serviceDistributionByZone = {};
      let totalPaid = 0;
      let totalBilledUnpaid = 0;

      // 3. Procesar cada factura y sus pagos.
      invoicesSnapshot.docs.forEach((invoiceDoc, index) => {
        const invoiceData = invoiceDoc.data();
        const paymentsSnapshot = paymentsByInvoice[index];

        const invoiceTotal = invoiceData.totalValue || 0;
        let invoicePaidAmount = 0;

        paymentsSnapshot.forEach((paymentDoc) => {
          const paymentData = paymentDoc.data();
          const paymentAmount = paymentData.amount || 0;
          invoicePaidAmount += paymentAmount;

          // Acumular en la tendencia mensual
          const paymentDate = paymentData.paymentDate?.toDate();
          if (paymentDate && !isNaN(paymentDate.getTime())) {
            const month = paymentDate.getMonth(); // 0-11
            monthlyTrend[month] += paymentAmount;
          }
        });

        totalPaid += invoicePaidAmount;
        totalBilledUnpaid += invoiceTotal - invoicePaidAmount;

        // Acumular para Top Clientes
        const clientId = invoiceData.clientId;
        if (clientId) {
          if (!clientRevenue[clientId]) {
            clientRevenue[clientId] = {
              totalPaid: 0,
              clientName: invoiceData.clientName,
            };
          }
          clientRevenue[clientId].totalPaid += invoicePaidAmount;
        }

        // Acumular para distribución por zona
        const zoneKey = invoiceData.zona || "Sin Zona";
        serviceDistributionByZone[zoneKey] =
          (serviceDistributionByZone[zoneKey] || 0) +
          (invoiceData.servicesCount || 0);
      });

      // 4. Obtener visitas pendientes de facturar para el KPI "Pendiente de Facturar".
      let pendingVisitsQuery = db
        .collection("visitas")
        .where("estado_visita", "==", "Realizada")
        .where("estado_facturacion", "==", "Pendiente");
      if (zoneToFilter) {
        pendingVisitsQuery = pendingVisitsQuery.where(
          "zona",
          "==",
          zoneToFilter
        );
      }
      const pendingVisitsSnapshot = await pendingVisitsQuery.get();
      let totalPendingBilling = 0;
      pendingVisitsSnapshot.forEach((doc) => {
        totalPendingBilling += doc.data().valor_servicio || 0;
      });

      // 5. Procesar datos para los rankings.
      const topClients = Object.entries(clientRevenue)
        .sort(([, a], [, b]) => b.totalPaid - a.totalPaid)
        .slice(0, 10)
        .map(([clientId, data]) => ({
          clientId,
          clientName: data.clientName,
          totalPaid: data.totalPaid,
        }));

      return {
        kpis: {
          totalPaid: totalPaid,
          totalBilledUnpaid: totalBilledUnpaid,
          totalPendingBilling: totalPendingBilling,
          totalVisits: 0, // Este KPI ya no es relevante con la nueva lógica
          billedVisits: 0, // Este KPI ya no es relevante
        },
        monthlyTrend,
        quarterlyComparison: {}, // Omitido por ahora
        topClients: topClients,
        technicianRates: [], // Devolver siempre un array vacío por ahora.
        serviceDistributionByZone,
      };
    } catch (error) {
      console.error("Error en getAnnualBillingReport:", error);
      throw new HttpsError(
        "internal",
        "Ocurrió un error al generar el reporte anual."
      );
    }
  }
);

exports.getAuditLogs = onCall(async (request) => {
  const { auth, data } = request;
  // 1. Verificar permisos: Solo Jefes y Administradores pueden ver los logs.
  const allowedRoles = [
    "Administrador",
    "Jefe",
    "Coordinador Nacionales",
    "Coordinador Nacional",
    "Gerente",
  ];
  if (!auth || !allowedRoles.includes(auth.token.role)) {
    throw new HttpsError(
      "permission-denied",
      "No tienes permiso para ver los registros de auditoría."
    );
  }

  const { limit = 25, adminEmail, startDate, endDate, keyword } = data;

  try {
    const db = admin.firestore();
    let query = db.collection("audit_logs").orderBy("timestamp", "desc");

    if (adminEmail && adminEmail !== "Todos") {
      query = query.where("adminEmail", "==", adminEmail);
    }
    if (startDate) {
      query = query.where("timestamp", ">=", new Date(startDate));
    }
    if (endDate) {
      // Para incluir el día completo, ajustamos la fecha de fin al final del día.
      const endOfDay = new Date(endDate);
      endOfDay.setUTCHours(23, 59, 59, 999);
      query = query.where("timestamp", "<=", endOfDay);
    }

    let logsSnapshot = await query.limit(limit).get();

    let logs = logsSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Si se proporciona una palabra clave, filtramos los resultados en memoria.
    if (keyword && typeof keyword === "string" && keyword.trim() !== "") {
      const lowerKeyword = keyword.toLowerCase().trim();
      logs = logs.filter(
        (log) =>
          (log.details && log.details.toLowerCase().includes(lowerKeyword)) ||
          (log.action && log.action.toLowerCase().includes(lowerKeyword))
      );
    }

    return { logs };
  } catch (error) {
    console.error("Error en getAuditLogs:", error);
    throw new HttpsError(
      "internal",
      "Ocurrió un error al obtener los registros de auditoría."
    );
  }
});

exports.completeVisit = onCall(async (request) => {
  const { auth, data } = request;
  // 1. Verificar autenticación
  if (!auth) {
    throw new HttpsError("unauthenticated", "El usuario no está autenticado.");
  }

  const { visitId, completionNotes } = data;
  if (!visitId) {
    throw new HttpsError("invalid-argument", "Se requiere el ID de la visita.");
  }

  const db = admin.firestore();
  const visitRef = db.collection("visitas").doc(visitId);

  try {
    const visitDoc = await visitRef.get();
    if (!visitDoc.exists) {
      throw new HttpsError("not-found", "La visita no fue encontrada.");
    }

    const existingData = visitDoc.data();

    // 2. Actualizar el documento de la visita
    const dataToUpdate = {
      estado_visita: "Realizada",
      notas_realizacion: completionNotes || "Sin notas de realización.",
      completedBy: auth.uid,
      estado_facturacion: "Pendiente",
      completedAt: admin.firestore.FieldValue.serverTimestamp(),
      gestionPermiso: existingData.gestionPermiso || {},
    };

    await visitRef.update(dataToUpdate);

    // 3. Registrar la acción en la auditoría
    const adminEmail = auth.token.email || "Desconocido";
    const logEntry = {
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      adminEmail: adminEmail,
      action: "COMPLETE_VISIT",
      details: `El usuario ${adminEmail} marcó como 'Realizada' la visita a "${existingData.nombre_cliente}".`,
      targetUser: {
        uid: visitId,
        email: `Cliente: ${existingData.nombre_cliente}`,
      },
      adminUser: { uid: auth.uid, email: adminEmail },
    };
    await db.collection("audit_logs").add(logEntry);

    return { message: "Visita completada exitosamente." };
  } catch (error) {
    console.error(`Error al completar la visita ${visitId}:`, error);
    throw new HttpsError(
      "internal",
      "Ocurrió un error al completar la visita."
    );
  }
});

exports.logVisitCreation = onDocumentCreated(
  "visitas/{visitId}",
  async (event) => {
    const visitData = event.data.data();
    const { visitId } = event.params;
    const clientName = visitData.nombre_cliente || "Nombre no disponible";
    const visitType = visitData.tipo_visita || "Tipo no disponible";
    let adminEmail = "Sistema";
    let adminUid = "SYSTEM";

    // Intentar obtener el email del usuario que creó la visita
    if (visitData.createdBy && visitData.createdBy !== "SYSTEM") {
      try {
        const user = await admin.auth().getUser(visitData.createdBy);
        adminEmail = user.email || "Desconocido";
        adminUid = user.uid;
      } catch (error) {
        console.warn(
          `No se pudo obtener el usuario para createdBy: ${visitData.createdBy}`,
          error
        );
      }
    }

    const logEntry = {
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      adminEmail: adminEmail,
      action: "CREATE_VISIT",
      details: `Se creó una nueva visita de tipo "${visitType}" para el cliente "${clientName}".`,
      targetUser: {
        uid: visitId,
        email: `Cliente: ${clientName}`,
      },
      adminUser: { uid: adminUid, email: adminEmail },
    };

    return admin.firestore().collection("audit_logs").add(logEntry);
  }
);

exports.logClientCreation = onDocumentCreated(
  "clientes/{clientId}",
  async (event) => {
    const clientData = event.data.data();
    const clientName =
      clientData.nombreComercial ||
      clientData.razonSocial ||
      "Nombre no disponible";

    // No podemos saber quién lo creó desde un trigger de forma fiable sin pasar el UID.
    // Por ahora, lo registramos como una acción del sistema.
    const logEntry = {
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      adminEmail: "Sistema",
      action: "CREATE_CLIENT",
      details: `Se creó un nuevo cliente: "${clientName}".`,
      targetUser: {
        uid: null,
        email: `Cliente: ${clientName}`,
      },
      adminUser: {
        uid: "SYSTEM",
        email: "Sistema",
      },
    };

    return admin.firestore().collection("audit_logs").add(logEntry);
  }
);

exports.logClientUpdate = onDocumentUpdated(
  "clientes/{clientId}",
  async (event) => {
    const beforeData = event.data.before.data();
    const afterData = event.data.after.data();

    // No podemos saber quién lo actualizó desde un trigger de forma fiable.
    // Lo registramos como una acción del sistema.
    const adminEmail = "Sistema";
    const clientName = afterData.nombreComercial || "Nombre no disponible";

    const changedFields = [];
    for (const key in afterData) {
      // Ignorar campos de timestamp o campos internos
      if (
        key === "updatedAt" ||
        key === "createdAt" ||
        key === "nombreComercial_lower"
      )
        continue;

      const beforeValue = JSON.stringify(beforeData[key]);
      const afterValue = JSON.stringify(afterData[key]);

      if (beforeValue !== afterValue) {
        changedFields.push(key);
      }
    }

    if (changedFields.length > 0) {
      const logEntry = {
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        adminEmail: adminEmail,
        action: "UPDATE_CLIENT",
        details: `Se actualizó la información del cliente "${clientName}". Campos modificados: ${changedFields.join(
          ", "
        )}.`,
        targetUser: {
          uid: event.params.clientId,
          email: `Cliente: ${clientName}`,
        },
        adminUser: {
          uid: "SYSTEM",
          email: "Sistema",
        },
      };
      return admin.firestore().collection("audit_logs").add(logEntry);
    }

    return null; // No hay cambios relevantes que registrar
  }
);

exports.getClientVisitHistoryPage = onCall({ cors: true }, async (request) => {
  const { auth: context, data } = request;
  if (!context.auth) {
    throw new HttpsError("unauthenticated", "El usuario no está autenticado.");
  }

  const { clientId, limit = 20, startAfterTimestamp } = data;
  if (!clientId) {
    throw new HttpsError("invalid-argument", "Se requiere el ID del cliente.");
  }

  const db = admin.firestore();
  let query = db
    .collection("visitas")
    .where("id_cliente", "==", clientId)
    .orderBy("fecha_visita", "desc")
    .limit(limit);

  // Si se proporciona un timestamp, empezamos la consulta después de ese punto.
  if (startAfterTimestamp) {
    const startAfterDate = new Date(startAfterTimestamp);
    query = query.startAfter(
      admin.firestore.Timestamp.fromDate(startAfterDate)
    );
  }

  try {
    const snapshot = await query.get();
    const visits = snapshot.docs.map((doc) => {
      const visitData = doc.data();
      let visitDate;
      if (
        visitData.fecha_visita &&
        typeof visitData.fecha_visita.toDate === "function"
      ) {
        visitDate = visitData.fecha_visita.toDate(); // Es un Timestamp de Firestore
      } else if (
        visitData.fecha_visita &&
        typeof visitData.fecha_visita._seconds === "number"
      ) {
        visitDate = new Date(visitData.fecha_visita._seconds * 1000); // Es un objeto {_seconds, _nanoseconds}
      }
      return {
        id: doc.id,
        ...visitData,
        fecha_visita: visitDate ? visitDate.toISOString() : null, // Convertir a ISO string para el cliente
      };
    });
    return { visits };
  } catch (error) {
    logger.error(
      `ERROR FATAL en getClientVisitHistoryPage para cliente ${clientId}:`,
      error
    );
    throw new HttpsError(
      "internal",
      "Ocurrió un error al obtener el historial de visitas."
    );
  }
});

exports.getClientServicesPage = onCall({ cors: true }, async (request) => {
  const { auth: context, data } = request;
  if (!context.auth) {
    throw new HttpsError("unauthenticated", "El usuario no está autenticado.");
  }

  const { clientId, limit = 10, startAfterTimestamp } = data;
  if (!clientId) {
    throw new HttpsError("invalid-argument", "Se requiere el ID del cliente.");
  }

  const db = admin.firestore();
  let query = db
    .collection("servicios")
    .where("clientId", "==", clientId)
    .orderBy("createdAt", "desc")
    .limit(limit);

  if (startAfterTimestamp) {
    const startAfterDate = new Date(startAfterTimestamp);
    query = query.startAfter(
      admin.firestore.Timestamp.fromDate(startAfterDate)
    );
  }

  try {
    const snapshot = await query.get();
    const services = snapshot.docs.flatMap((doc) => {
      const sheetData = doc.data();
      return (sheetData.services || []).map((service) => ({
        ...service,
        createdAt: sheetData.createdAt.toDate().toISOString(),
      }));
    });
    return { services };
  } catch (error) {
    logger.error(
      `Error al obtener servicios para el cliente ${clientId}:`,
      error
    );
    throw new HttpsError(
      "internal",
      "Ocurrió un error al obtener los servicios."
    );
  }
});

exports.getTechnicianVisitHistoryPage = onCall(
  { cors: true },
  async (request) => {
    const { auth: context, data } = request;
    if (!context.auth) {
      throw new HttpsError(
        "unauthenticated",
        "El usuario no está autenticado."
      );
    }

    const { technicianName, limit = 20, startAfterTimestamp } = data;
    if (!technicianName) {
      throw new HttpsError(
        "invalid-argument",
        "Se requiere el nombre del técnico."
      );
    }

    const db = admin.firestore();
    let query = db
      .collection("visitas")
      .where("fumigadores_asignados", "array-contains", technicianName)
      .orderBy("fecha_visita", "desc")
      .limit(limit);

    if (startAfterTimestamp) {
      const startAfterDate = new Date(startAfterTimestamp);
      query = query.where("fecha_visita", "<", startAfterDate);
    }

    try {
      const snapshot = await query.get();
      const visits = snapshot.docs.map((doc) => {
        const visitData = doc.data();
        let visitDate;
        if (
          visitData.fecha_visita &&
          typeof visitData.fecha_visita.toDate === "function"
        ) {
          visitDate = visitData.fecha_visita.toDate();
        } else if (
          visitData.fecha_visita &&
          typeof visitData.fecha_visita._seconds === "number"
        ) {
          visitDate = new Date(visitData.fecha_visita._seconds * 1000);
        }
        return {
          id: doc.id,
          ...visitData,
          fecha_visita: visitDate ? visitDate.toISOString() : null,
        };
      });
      return { visits };
    } catch (error) {
      logger.error(
        `ERROR FATAL en getTechnicianVisitHistoryPage para técnico ${technicianName}:`,
        error
      );
      throw new HttpsError(
        "internal",
        "Ocurrió un error al obtener el historial del técnico."
      );
    }
  }
);

exports.batchImportClients = onCall({ cors: true }, async (request) => {
  assertClientManager(request);
  const { clients } = request.data;

  if (!Array.isArray(clients) || clients.length === 0) {
    throw new HttpsError("invalid-argument", "Se requiere un lote de clientes.");
  }

  const batch = db.batch();
  let count = 0;
  const BATCH_LIMIT = 450; // Firestore limit is 500

  // Procesar en chunks si es muy grande (aquí simplificado)
  if (clients.length > BATCH_LIMIT)
    throw new HttpsError(
      "invalid-argument",
      `Máximo ${BATCH_LIMIT} clientes por lote.`
    );

  const nits = clients.map((client) => String(client.nit || "").trim()).filter(Boolean);
  if (new Set(nits).size !== nits.length) {
    throw new HttpsError("already-exists", "El lote contiene NIT duplicados.");
  }
  const existingNits = new Set();
  for (let index = 0; index < nits.length; index += 30) {
    const snapshot = await db
      .collection("clientes")
      .where("nit", "in", nits.slice(index, index + 30))
      .get();
    snapshot.forEach((doc) => existingNits.add(String(doc.data().nit || "").trim()));
  }
  const duplicateNit = nits.find((nit) => existingNits.has(nit));
  if (duplicateNit) {
    throw new HttpsError("already-exists", `Ya existe un cliente con el NIT ${duplicateNit}.`);
  }

  clients.forEach((c) => {
    if (!hasGlobalClientAccess(request) && !clientBelongsToUserZone(c, request)) {
      throw new HttpsError("permission-denied", "El lote contiene clientes fuera de tu zona.");
    }
    const ref = db.collection("clientes").doc();
    batch.set(ref, {
      ...c,
      nombreComercial_lower: (c.nombreComercial || "").toLowerCase(),
      zonasDeSucursales: c.zonasDeSucursales || Array.from(
        new Set([c.zona, ...(c.sucursales || []).map((s) => s.zona)])
      ).filter(Boolean),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: "IMPORT_SCRIPT",
    });
    count++;
  });

  await batch.commit();
  return { success: true, imported: count };
});

// La plantilla se genera exclusivamente en el frontend para mantener un único formato.
// Este bloque se conserva temporalmente como referencia histórica y no se exporta.
const legacyGenerateClientImportTemplate = onCall(
  { cors: true },
  async (request) => {
    const { auth } = request;
    // Helper para añadir validación de datos a un rango de celdas
    const addDataValidation = (ws, column, formula, rowCount = 1000) => {
      for (let i = 2; i <= rowCount; i++) {
        // Empezar desde la fila 2 para saltar la cabecera
        const cellAddress = `${column}${i}`;
        if (!ws[cellAddress]) ws[cellAddress] = { t: "s", v: "" }; // Asegurarse de que la celda exista
        ws[cellAddress].v = undefined; // Limpiar valor por defecto
        ws[cellAddress].z = "@"; // Formato de texto
        ws[cellAddress].s = {
          dataValidation: {
            type: "list",
            allowBlank: true,
            formula1: formula,
            showDropDown: true,
            errorStyle: "stop",
            errorTitle: "Valor no válido",
            error: "Por favor, seleccione un valor de la lista.",
          },
        };
      }
    };

    // 1. Verificar permisos
    if (
      !auth ||
      (auth.token.role !== "Administrador" && auth.token.role !== "Jefe")
    ) {
      throw new HttpsError(
        "permission-denied",
        "No tienes permiso para realizar esta acción."
      );
    }

    functions.logger.log("[ESPÍA] Iniciando generateClientImportTemplate...");

    try {
      let headers = [
        "nombreComercial",
        "razonSocial",
        "nit",
        "zona",
        "departamento",
        "ciudad",
        "direccion",
        "estado",
        "tipo",
        "aliado",
        "tipoDirecto",
        "sede",
        "contactoPrincipal_nombre",
        "contactoPrincipal_celular",
        "contactoPrincipal_email",
        "contactoFinanciero_nombre",
        "contactoFinanciero_celular",
        "contactoFinanciero_email",
      ];

      const defaultSucursalesCount = 50;
      for (let i = 1; i <= defaultSucursalesCount; i++) {
        headers.push(`sucursal${i}_nombre`);
        headers.push(`sucursal${i}_direccion`);
        headers.push(`sucursal${i}_zona`);
      }

      // Obtener datos de configuración para las listas
      logger.log(
        '[ESPÍA] Intentando leer "settings/businessData" de Firestore...'
      );
      const businessDataDoc = await admin
        .firestore()
        .collection("settings")
        .doc("businessData")
        .get();
      const settingsData = businessDataDoc.exists ? businessDataDoc.data() : {};
      logger.log(
        `[ESPÍA] ¿Documento businessData existe?: ${businessDataDoc.exists}`
      );

      const alliesList = settingsData.alliesList || [];
      const businessZones = (settingsData.businessZones || []).map(
        (z) => z.name
      );
      const colombiaData = settingsData.colombiaData || {};

      // Crear la hoja principal
      const mainWs = XLSX.utils.aoa_to_sheet([headers]);
      mainWs["!cols"] = headers.map((h) => ({
        wch: h.length > 15 ? h.length + 2 : 15,
      }));

      // Crear el libro de trabajo y añadir la hoja principal
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, mainWs, "Plantilla Clientes");

      const addDataSheet = (sheetName, dataArray) => {
        if (dataArray && dataArray.length > 0) {
          const sheetData = dataArray.map((item) => [item]);
          const dataWs = XLSX.utils.aoa_to_sheet(sheetData);
          XLSX.utils.book_append_sheet(wb, dataWs, sheetName);
          // Ocultar la hoja de datos
          wb.Sheets[sheetName].Hidden = 1;
          return `'${sheetName}'!$A$1:$A$${dataArray.length}`;
        }
        return null;
      };

      const zonasFormula = addDataSheet("Datos_Zonas", businessZones);
      const tiposFormula = addDataSheet("Datos_Tipos", ["Aliado", "Directo"]);
      const aliadosFormula = addDataSheet("Datos_Aliados", alliesList.sort());
      const tiposDirectoFormula = addDataSheet("Datos_TiposDirecto", [
        "Sedes",
        "Otros",
      ]);
      const sedesFormula = addDataSheet("Datos_Sedes", businessZones);
      const estadosFormula = addDataSheet("Datos_Estados", [
        "Activo",
        "Inactivo",
      ]);
      const departamentosFormula = addDataSheet(
        "Datos_Departamentos",
        Object.keys(colombiaData).sort()
      );

      wb.Names = [];
      Object.keys(colombiaData).forEach((dep) => {
        const citiesSheetName = `Ciudades_${dep
          .replace(/\s/g, "_")
          .substring(0, 21)}`;
        const citiesFormula = addDataSheet(
          citiesSheetName,
          colombiaData[dep].sort()
        );
        if (citiesFormula) {
          wb.Names.push({
            Name: dep.replace(/\s/g, "_"), // Nombre del rango (sin espacios)
            Ref: citiesFormula,
          });
        }
      });

      if (zonasFormula) addDataValidation(mainWs, "D", zonasFormula);
      if (departamentosFormula)
        addDataValidation(mainWs, "E", departamentosFormula);
      // Para la ciudad, usamos la función INDIRECT para crear una lista dependiente del departamento
      addDataValidation(mainWs, "F", '=INDIRECT(SUBSTITUTE(E2," ","_"))');
      if (estadosFormula) addDataValidation(mainWs, "H", estadosFormula);
      if (tiposFormula) addDataValidation(mainWs, "I", tiposFormula);
      if (aliadosFormula) addDataValidation(mainWs, "J", aliadosFormula);
      if (tiposDirectoFormula)
        addDataValidation(mainWs, "K", tiposDirectoFormula);
      if (sedesFormula) addDataValidation(mainWs, "L", sedesFormula);

      if (zonasFormula) {
        for (let i = 1; i <= defaultSucursalesCount; i++) {
            const colIndex = headers.indexOf(`sucursal${i}_zona`);
          if (colIndex !== -1) {
            const colLetter = XLSX.utils.encode_col(colIndex);
            addDataValidation(mainWs, colLetter, zonasFormula);
          }
        }
      }

      const instructions = [
        ["Instrucciones para la Plantilla de Importación de Clientes"],
        [],
        [
          "1. Llenado de Datos:",
          "Complete la información de cada cliente en una fila separada en la hoja 'Plantilla Clientes'.",
        ],
        [
          "2. Campos Obligatorios:",
          "Asegúrese de llenar como mínimo: nombreComercial, nit, zona y tipo.",
        ],
        [
          "3. Listas Desplegables:",
          "Para columnas como 'zona', 'tipo', 'departamento', etc., use la flecha que aparece al seleccionar la celda para elegir un valor válido.",
        ],
        [
          "4. Ciudades:",
          "Primero seleccione un 'departamento'. Luego, la columna 'ciudad' mostrará automáticamente la lista de ciudades para ese departamento.",
        ],
        [
          "5. Tipo de Cliente:",
          "Si el 'tipo' es 'Aliado', llene la columna 'aliado'. Si es 'Directo' y aplica, llene 'tipoDirecto' y 'sede'.",
        ],
        [
          "6. Sucursales:",
          "La plantilla incluye columnas para 50 sucursales. Si un cliente tiene más, puede añadir columnas manualmente siguiendo el patrón: sucursal51_nombre, sucursal51_direccion, sucursal51_zona, etc. El sistema las importará todas.",
        ],
        [
          "7. Zona de Sucursal:",
          "Cada sucursal ahora tiene su propia columna de 'zona'. Es importante llenarla para una correcta asignación de visitas.",
        ],
        ["8. Ejemplo:", ""],
        [
          "nombreComercial",
          "razonSocial",
          "nit",
          "zona",
          "departamento",
          "ciudad",
          "direccion",
          "estado",
          "tipo",
          "aliado",
          "tipoDirecto",
          "sede",
          "sucursal1_nombre",
          "sucursal1_direccion",
          "sucursal1_zona",
        ],
        [
          "Cliente de Prueba S.A.S",
          "Cliente de Prueba S.A.S",
          "900123456",
          "Valle del Cauca",
          "Valle del Cauca",
          "Cali",
          "Calle Falsa 123",
          "Activo",
          "Directo",
          "",
          "Sedes",
          "Valle del Cauca",
          "Sucursal Norte",
          "Av. Siempre Viva 742",
          "Norte de Santander",
        ],
      ];
      const instructionsWs = XLSX.utils.aoa_to_sheet(instructions);
      instructionsWs["!cols"] = [{ wch: 30 }, { wch: 100 }];
      XLSX.utils.book_append_sheet(wb, instructionsWs, "Instrucciones");

      // Mover la hoja de instrucciones para que sea la primera
      wb.SheetNames.unshift(wb.SheetNames.pop());

      logger.log(
        "[ESPÍA] Hojas de datos y validaciones preparadas. Procediendo a crear el archivo Excel..."
      );

      const wbout = XLSX.write(wb, { bookType: "xlsx", type: "buffer" });

      logger.log(
        `[ESPÍA] Archivo Excel generado con éxito. Tamaño del buffer: ${wbout.length} bytes.`
      );

      return {
        success: true,
        file: Buffer.from(wbout).toString("base64"),
      };
    } catch (error) {
      logger.error("Error al generar la plantilla de Excel:", error);
      throw new HttpsError(
        "internal",
        "No se pudo generar el archivo de plantilla."
      );
    }
  }
);

exports.makeSupportFilePublic = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError(
      "unauthenticated",
      "La solicitud debe estar autenticada."
    );
  }

  const { filePath } = request.data;
  if (!filePath || typeof filePath !== "string") {
    throw new HttpsError(
      "invalid-argument",
      "El parámetro filePath es obligatorio."
    );
  }

  try {
    const bucketName = admin.instanceId().app.options.storageBucket;
    const bucket = admin.storage().bucket(bucketName);
    const file = bucket.file(filePath);

    await file.makePublic();
    logger.log(
      `[makeSupportFilePublic] Objeto ${filePath} marcado como público.`
    );

    return { success: true };
  } catch (error) {
    logger.error(
      `[makeSupportFilePublic] Error al hacer público el archivo ${filePath}:`,
      error
    );
    throw new HttpsError(
      "internal",
      `No se pudo establecer el permiso de lectura pública: ${error.message}`
    );
  }
});

exports.getSignedUploadUrl = onCall({ cors: true }, async (request) => {
  assertAuth(request);
  const { filePath, contentType } = request.data;

  if (!filePath || typeof filePath !== "string" || !contentType || typeof contentType !== "string") {
    throw new HttpsError(
      "invalid-argument",
      "Se requieren filePath y contentType válidos."
    );
  }

  try {
    const bucket = admin.storage().bucket();
    const file = bucket.file(filePath);
    const [signedUrl] = await file.getSignedUrl({
      action: "write",
      expires: Date.now() + 15 * 60 * 1000, // 15 minutos
      contentType: contentType,
    });
    return { signedUrl };
  } catch (e) {
    throw new HttpsError("internal", "Error generando URL de subida.");
  }
});

exports.deleteProfilePicture = onCall({ cors: true }, async (request) => {
  // 1. Verificar autenticación
  if (!request.auth) {
    throw new HttpsError(
      "unauthenticated",
      "La solicitud debe estar autenticada."
    );
  }

  const uid = request.auth.uid;

  try {
    const user = await admin.auth().getUser(uid);
    const currentPhotoURL = user.photoURL;

    if (!currentPhotoURL) {
      return { message: "No hay foto de perfil para eliminar." };
    }

    // 2. Extraer la ruta del archivo desde la URL de Storage
    const url = new URL(currentPhotoURL);
    // La ruta del archivo es todo lo que viene después del nombre del bucket en el path.
    // Ejemplo: /sisfumi2.appspot.com/profile_pictures/uid/file.jpg -> profile_pictures/uid/file.jpg
    const filePath = decodeURIComponent(
      url.pathname.split("/").slice(2).join("/")
    );

    // 3. Eliminar el archivo de Firebase Storage
    const bucket = admin
      .storage()
      .bucket(admin.instanceId().app.options.storageBucket);
    await bucket.file(filePath).delete();
    logger.log(
      `[deleteProfilePicture] Archivo eliminado de Storage: ${filePath}`
    );

    // 4. Actualizar el perfil del usuario en Auth para quitar la URL
    await admin.auth().updateUser(uid, { photoURL: null });
    logger.log(
      `[deleteProfilePicture] photoURL eliminada del perfil de Auth para UID: ${uid}`
    );

    return { success: true, message: "Foto de perfil eliminada con éxito." };
  } catch (error) {
    logger.error(
      `[deleteProfilePicture] Error al eliminar la foto para UID ${uid}:`,
      error
    );
    throw new HttpsError(
      "internal",
      `No se pudo eliminar la foto de perfil: ${error.message}`
    );
  }
});

exports.deleteSupportFile = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError(
      "unauthenticated",
      "La solicitud debe estar autenticada."
    );
  }

  const { visitId, filePath } = request.data;

  if (!visitId || !filePath) {
    throw new HttpsError(
      "invalid-argument",
      "Los parámetros visitId y filePath son obligatorios."
    );
  }

  try {
    // 1. Eliminar el archivo de Firebase Storage
    const bucketName = admin.instanceId().app.options.storageBucket;
    const bucket = admin.storage().bucket(bucketName);
    await bucket.file(filePath).delete();
    logger.log(`[deleteSupportFile] Archivo eliminado de Storage: ${filePath}`);

    // 2. Eliminar la referencia del documento de Firestore
    const visitRef = db.collection("visitas").doc(visitId);
    const visitDoc = await visitRef.get();

    if (visitDoc.exists) {
      const visitData = visitDoc.data();
      const currentSoportes = visitData.gestionPermiso?.soportes || [];

      // Filtrar el array para remover el elemento con el path coincidente
      const updatedSoportes = currentSoportes.filter(
        (s) => s.path !== filePath
      );

      await visitRef.update({
        "gestionPermiso.soportes": updatedSoportes,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      logger.log(
        `[deleteSupportFile] Referencia eliminada de Firestore para visita: ${visitId}`
      );
    }

    return { message: "Soporte eliminado con éxito." };
  } catch (error) {
    logger.error(
      `[deleteSupportFile] Error al eliminar soporte para visita ${visitId} y path ${filePath}:`,
      error
    );
    throw new HttpsError(
      "internal",
      `Error al eliminar el soporte: ${error.message}`
    );
  }
});

if (storageBucketName) {
  exports.onSupportFileDelete = onObjectDeleted(
    { bucket: storageBucketName },
    async (event) => {
      const { name: filePath } = event.data;

      // 1. Verificar si el archivo eliminado está en la carpeta correcta.
      if (!filePath.startsWith("soportes_permisos/")) {
        logger.log(
          `Archivo eliminado fuera de la carpeta de soportes: ${filePath}. No se hace nada.`
        );
        return null;
      }

      // 2. Extraer el ID de la visita de la ruta del archivo.
      const parts = filePath.split("/");
      if (parts.length < 3) {
        logger.warn(
          `La ruta del archivo eliminado no tiene el formato esperado: ${filePath}`
        );
        return null;
      }
      const visitId = parts[1];
      logger.log(`Archivo de soporte eliminado para la visita ID: ${visitId}`);

      // 3. Actualizar el documento de la visita en Firestore.
      try {
        const visitRef = admin.firestore().collection("visitas").doc(visitId);
        const visitDoc = await visitRef.get();
        if (visitDoc.exists) {
          const visitData = visitDoc.data();
          const updatedSoportes = (visitData.gestionPermiso?.soportes || []).filter(
            (s) => s.path !== filePath
          );
          await visitRef.update({ "gestionPermiso.soportes": updatedSoportes });
          logger.log(
            `Éxito: Se ha actualizado el array de soportes para la visita ${visitId}.`
          );
        }
        return null;
      } catch (error) {
        logger.error(
          `Error al actualizar la visita ${visitId} después de eliminar el archivo:`,
          error
        );
        // No relanzar el error para evitar reintentos innecesarios si el documento de visita ya no existe.
        return null;
      }
    }
  );
} else {
  logger.warn(
    "onSupportFileDelete no se registró porque no se pudo resolver el bucket de Storage."
  );
}


/**
 * Envía un correo electrónico desde el formulario de contacto del sitio web público.
 * Utiliza Resend para el envío.
 */
exports.sendContactEmail = onCall({ cors: true }, async (request) => {
  const { name, email, phone, message } = request.data;

  if (!name || !email || !message) {
    throw new HttpsError(
      "invalid-argument",
      "Nombre, email y mensaje son obligatorios."
    );
  }

  const { Resend } = require("resend");
  if (!resendApiKey) {
    throw new HttpsError(
      "failed-precondition",
      "RESEND_API_KEY no está configurada en el entorno de Functions."
    );
  }
  const resend = new Resend(resendApiKey);

  // Construcción y envío del correo
  try {
    // NOTA: Cambia 'trolero304@gmail.com' por tu correo de destino.
    // NOTA: Cambia la URL del logo por la de tu dominio de producción.
    await resend.emails.send({
      from: "Web Control Total <onboarding@resend.dev>", // Debe ser un dominio verificado en Resend
      to: ["trolero304@gmail.com"],
      subject: `🔔 Nueva consulta de ${name}`,
      html: `
        <div style="font-family: 'Helvetica', 'Arial', sans-serif; background-color: #0a0a0a; color: #ffffff; padding: 40px 20px; border-radius: 10px;">
            <div style="max-width: 600px; margin: 0 auto; background-color: #151515; padding: 40px; border-radius: 16px; border: 1px solid #333;">
                <div style="text-align: center; margin-bottom: 30px; border-bottom: 1px solid #333; padding-bottom: 20px;">
                    <img src="https://sisfumictph.com/logo.png" alt="Control Total" style="max-width: 120px; height: auto; display: inline-block;">
                </div>
                <h2 style="color: #e11d48; margin-top: 0; text-align: center; font-size: 24px; letter-spacing: -0.5px;">Nuevo Mensaje Web</h2>
                <p style="text-align: center; color: #888; margin-bottom: 30px;">Has recibido una nueva solicitud de contacto desde tu sitio web.</p>
                <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0a0a0a; border-radius: 8px; overflow: hidden; margin-bottom: 30px;">
                    <tr><td style="padding: 15px; border-bottom: 1px solid #222; color: #888; font-size: 14px; width: 30%;">Nombre</td><td style="padding: 15px; border-bottom: 1px solid #222; color: #fff; font-weight: bold;">${escapeHTML(name)}</td></tr>
                    <tr><td style="padding: 15px; border-bottom: 1px solid #222; color: #888; font-size: 14px;">Email</td><td style="padding: 15px; border-bottom: 1px solid #222; color: #fff;"><a href="mailto:${email}" style="color: #e11d48; text-decoration: none;">${escapeHTML(email)}</a></td></tr>
                    <tr><td style="padding: 15px; color: #888; font-size: 14px;">Teléfono</td><td style="padding: 15px; color: #fff;">${escapeHTML(phone) || 'No especificado'}</td></tr>
                </table>
                <div style="margin-bottom: 10px; color: #888; font-size: 14px; font-weight: bold; text-transform: uppercase;">Mensaje del cliente:</div>
                <div style="background-color: #222; padding: 20px; border-radius: 8px; color: #ddd; line-height: 1.6; font-style: italic;">"${escapeHTML(message)}"</div>
                <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #333; text-align: center; color: #555; font-size: 12px;"><p>Este mensaje fue enviado automáticamente por el sistema de Control Total & P.H.</p></div>
            </div>
        </div>
      `,
    });

    return { success: true, message: "Mensaje enviado con éxito." };
  } catch (error) {
    logger.error("Error al enviar correo con Resend:", error);
    throw new HttpsError("internal", "No se pudo enviar el mensaje.");
  }
});

exports.updateSupportFileName = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError(
      "unauthenticated",
      "La solicitud debe estar autenticada."
    );
  }

  const { visitId, filePath, newName } = request.data;

  if (!visitId || !filePath || !newName || typeof newName !== "string") {
    throw new HttpsError(
      "invalid-argument",
      "Los parámetros visitId, filePath y newName son obligatorios."
    );
  }

  try {
    const visitRef = db.collection("visitas").doc(visitId);
    const visitDoc = await visitRef.get();

    if (visitDoc.exists) {
      const visitData = visitDoc.data();
      const currentSoportes = visitData.gestionPermiso?.soportes || [];

      let found = false;
      // Mapear y actualizar el nombre
      const updatedSoportes = currentSoportes.map((s) => {
        if (s.path === filePath) {
          s.name = newName;
          found = true;
        }
        return s;
      });

      if (found) {
        await visitRef.update({
          "gestionPermiso.soportes": updatedSoportes,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        logger.log(
          `[updateSupportFileName] Nombre actualizado para soporte en visita: ${visitId}`
        );
        return { message: "Nombre del archivo actualizado con éxito." };
      } else {
        throw new HttpsError(
          "not-found",
          "Referencia del soporte no encontrada en la visita."
        );
      }
    } else {
      throw new HttpsError("not-found", "Visita no encontrada.");
    }
  } catch (error) {
    logger.error(
      `[updateSupportFileName] Error al actualizar nombre para visita ${visitId} y path ${filePath}:`,
      error
    );
    throw new HttpsError(
      "internal",
      `Error al actualizar el nombre del soporte: ${error.message}`
    );
  }
});

exports.updateSupportFileOrder = onCall({ cors: true }, async (request) => {
  // 1. Verificar autenticación.
  const { auth, data } = request;
  if (!auth) {
    throw new HttpsError(
      "unauthenticated",
      "El usuario debe estar autenticado."
    );
  }

  const { visitId, newOrderPaths } = data;
  if (!visitId || !Array.isArray(newOrderPaths)) {
    throw new HttpsError(
      "invalid-argument",
      "Se requiere visitId y un array con el nuevo orden de rutas (newOrderPaths)."
    );
  }

  const db = admin.firestore();
  const visitRef = db.collection("visitas").doc(visitId);

  try {
    const visitDoc = await visitRef.get();
    if (!visitDoc.exists) {
      throw new HttpsError("not-found", "La visita no fue encontrada.");
    }

    const visitData = visitDoc.data();
    const currentSoportes = visitData.gestionPermiso?.soportes || [];

    // Reordenar el array 'currentSoportes' basándose en el orden de 'newOrderPaths'.
    const reorderedSoportes = newOrderPaths
      .map((path) => currentSoportes.find((s) => s.path === path))
      .filter(Boolean);

    await visitRef.update({ "gestionPermiso.soportes": reorderedSoportes });

    return { success: true, message: "Orden de archivos actualizado." };
  } catch (error) {
    logger.error(
      `Error al reordenar los soportes para la visita ${visitId}:`,
      error
    );
    if (error.code) throw error;
    throw new HttpsError(
      "internal",
      "Ocurrió un error al reordenar los archivos."
    );
  }
});

exports.getClientProfileData = onCall({ cors: true }, async (request) => {
  const { clientId } = request.data;

  try {
    const authorizedClient = await getAuthorizedClient(request, clientId);
    // Ejecutar consultas en paralelo para mayor velocidad
    const [serviceSheetSnap, upcomingSnap, historySnap] =
      await Promise.all([
        db
          .collection("servicios")
          .where("clientId", "==", clientId)
          .limit(1)
          .get(),
        db
          .collection("visitas")
          .where("id_cliente", "==", clientId)
          .where("fecha_visita", ">=", new Date())
          .orderBy("fecha_visita", "asc")
          .limit(5)
          .get(),
        db
          .collection("visitas")
          .where("id_cliente", "==", clientId)
          .where("fecha_visita", "<", new Date())
          .orderBy("fecha_visita", "desc")
          .limit(20)
          .get(),
      ]);

    return {
      client: { id: authorizedClient.id, ...authorizedClient.data },
      serviceSheet: serviceSheetSnap.empty
        ? null
        : {
            id: serviceSheetSnap.docs[0].id,
            ...serviceSheetSnap.docs[0].data(),
          },
      upcomingVisits: upcomingSnap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
        fecha_visita: d.data().fecha_visita.toDate().toISOString(),
      })),
      visitHistory: historySnap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
        fecha_visita: d.data().fecha_visita.toDate().toISOString(),
      })),
    };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    logger.error("Error en getClientProfileData:", error);
    throw new HttpsError("internal", "Error cargando perfil del cliente.");
  }
});

/**
 * Obtiene la ficha de servicio para un cliente específico.
 */
exports.getServiceSheetByClientId = onCall(
  {
    // ✅ CORRECCIÓN: Especificar los orígenes permitidos para CORS.
    cors: ["http://localhost:5173", "https://sisfumictph.com", "https://controltotalyph.com"],
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "La solicitud debe estar autenticada."
      );
    }

    const { clientId } = request.data;
    if (!clientId) {
      throw new HttpsError(
        "invalid-argument",
        "Se requiere el ID del cliente."
      );
    }

    const { role: userRole, zona: userZone } = request.auth.token;
    const canManageAllServices = [
      "Administrador",
      "Jefe",
      "Coordinador Nacionales",
      "Coordinador Nacional",
      "Gerente",
    ].includes(userRole);

    try {
      const authorizedClient = await getAuthorizedClient(request, clientId);
      if (!canManageAllServices && !userZone) {
        throw new HttpsError("permission-denied", "No tienes una zona asignada.");
      }

      const canonicalRef = db.collection("servicios").doc(clientId);
      const canonicalDoc = await canonicalRef.get();
      const snapshot = canonicalDoc.exists
        ? { empty: false, docs: [canonicalDoc] }
        : await db
          .collection("servicios")
          .where("clientId", "==", clientId)
          .limit(10)
          .get();

      if (snapshot.empty) {
        return null; // No se encontró la ficha, lo cual es un caso válido.
      }

      const doc = snapshot.docs[0];
      const sheet = doc.data();
      if (!canManageAllServices && sheet.zona !== userZone) {
        throw new HttpsError("permission-denied", "No tienes permiso para ver esta ficha.");
      }
      return {
        id: doc.id,
        ...sheet,
        clientId: authorizedClient.id,
        clientName: authorizedClient.data.nombreComercial,
      };
    } catch (error) {
      logger.error(
        `Error en getServiceSheetByClientId para cliente ${clientId}:`,
        error
      );
      throw new HttpsError(
        "internal",
        "No se pudo obtener la ficha de servicio."
      );
    }
  }
);

/**
 * Guarda (crea o actualiza) una ficha de servicio.
 */
exports.saveServiceSheet = onCall(
  {
    // ✅ CORRECCIÓN: Especificar los orígenes permitidos para CORS.
    cors: ["http://localhost:5173", "https://sisfumictph.com", "https://controltotalyph.com"],
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "La solicitud debe estar autenticada."
      );
    }

    const { sheetData } = request.data;
    if (!sheetData || !sheetData.clientId) {
      throw new HttpsError(
        "invalid-argument",
        "Faltan datos de la ficha de servicio."
      );
    }

    const { role: userRole, zona: userZone } = request.auth.token;
    const globalServiceRoles = [
      "Administrador",
      "Jefe",
      "Coordinador Nacionales",
      "Coordinador Nacional",
      "Gerente",
    ];
    const canManageAllServices = globalServiceRoles.includes(userRole);
    const canSetPrice = ["Administrador", "Jefe", "Coordinador Nacionales", "Coordinador Nacional", "Gerente"].includes(userRole);
    const authorizedClient = await getAuthorizedClient(request, sheetData.clientId);
    const clientZones = Array.isArray(authorizedClient.data.zonasDeSucursales)
      ? authorizedClient.data.zonasDeSucursales
      : [authorizedClient.data.zona];

    if (!canManageAllServices && (!userZone || !clientZones.includes(userZone))) {
      throw new HttpsError("permission-denied", "No puedes gestionar servicios fuera de tu zona.");
    }

    if (!Array.isArray(sheetData.services)) {
      throw new HttpsError("invalid-argument", "La ficha debe contener una lista de servicios.");
    }

    const existingSnapshot = await db.collection("servicios")
      .where("clientId", "==", sheetData.clientId)
      .limit(10)
      .get();
    const existingSheet = existingSnapshot.docs[0]?.data();
    const existingServices = Array.isArray(existingSheet?.services) ? existingSheet.services : [];
    const allowedBranchNames = new Set([
      "Principal",
      ...(Array.isArray(authorizedClient.data.sucursales)
        ? authorizedClient.data.sucursales.flatMap((branch, index) => [
          branch.nombre,
          branch.id || `${authorizedClient.id}-branch-${index + 1}`,
        ])
        : []),
    ]);
    const seenServiceIds = new Set();
    const normalizedServices = sheetData.services.map((service, index) => {
      if (!service.tipo_servicio || !service.frecuencia) {
        throw new HttpsError("invalid-argument", "Cada servicio requiere tipo y frecuencia.");
      }
      const value = Number(service.valor);
      if (!Number.isFinite(value) || value < 0) {
        throw new HttpsError("invalid-argument", "El valor de cada servicio debe ser válido.");
      }
      const serviceId = service.id || `${sheetData.clientId}-service-${index + 1}`;
      if (seenServiceIds.has(serviceId)) {
        throw new HttpsError("invalid-argument", "Hay servicios duplicados en la ficha.");
      }
      seenServiceIds.add(serviceId);
      const assignedBranches = Array.isArray(service.sucursales_asignadas)
        ? service.sucursales_asignadas
        : [];
      if (assignedBranches.some((branch) => !allowedBranchNames.has(branch))) {
        throw new HttpsError("invalid-argument", "Una sucursal asignada no pertenece al cliente.");
      }
      const previous = existingServices.find((item) =>
        (item.id && item.id === serviceId) || item.tipo_servicio === service.tipo_servicio
      );
      if (!canSetPrice && value > 0 && Number(previous?.valor || 0) !== value) {
        throw new HttpsError("permission-denied", "No tienes permiso para asignar ese precio.");
      }
      return {
        ...service,
        id: serviceId,
        valor: canSetPrice ? value : Number(previous?.valor || 0),
        sucursales_asignadas: assignedBranches,
      };
    });

    const canonicalSheetData = {
      ...sheetData,
      clientId: authorizedClient.id,
      clientName: authorizedClient.data.nombreComercial,
      zona: authorizedClient.data.zona,
      services: normalizedServices,
    };

    try {
      const sheetRef = db.collection("servicios").doc(sheetData.clientId);
      await db.runTransaction(async (transaction) => {
        const canonicalDoc = await transaction.get(sheetRef);
        const dataToSave = {
          ...canonicalSheetData,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };
        if (canonicalDoc.exists) transaction.update(sheetRef, { ...dataToSave, createdAt: canonicalDoc.data().createdAt || dataToSave.createdAt });
        else transaction.set(sheetRef, dataToSave);
      });

      return {
        success: true,
        message: "Ficha de servicio guardada correctamente.",
        sheetId: sheetData.clientId,
      };
    } catch (error) {
      logger.error(
        `Error en saveServiceSheet para cliente ${sheetData.clientId}:`,
        error
      );
      throw new HttpsError(
        "internal",
        "No se pudo guardar la ficha de servicio."
      );
    }
  }
);

exports.getInvoicePaymentHistory = onCall(async (request) => {
  const { auth, data } = request;
  if (!auth) {
    throw new HttpsError(
      "unauthenticated",
      "El usuario debe estar autenticado."
    );
  }

  const { invoiceId } = data;
  if (!invoiceId) {
    throw new HttpsError(
      "invalid-argument",
      "Se requiere el ID de la factura (invoiceId)."
    );
  }

  try {
    const paymentsRef = db
      .collection("grupos_facturacion")
      .doc(invoiceId)
      .collection("payments");
    const snapshot = await paymentsRef.orderBy("registeredAt", "desc").get();

    if (snapshot.empty) {
      return { payments: [] };
    }

    const payments = snapshot.docs.map((doc) => {
      const paymentData = doc.data();
      // Asegurarse de que las fechas se envíen en un formato consistente (ISO string)
      return {
        id: doc.id,
        ...paymentData,
        paymentDate: paymentData.paymentDate?.toDate
          ? paymentData.paymentDate.toDate().toISOString()
          : null,
        registeredAt: paymentData.registeredAt?.toDate
          ? paymentData.registeredAt.toDate().toISOString()
          : null,
      };
    });

    return { payments };
  } catch (error) {
    logger.error(
      `Error al obtener el historial de pagos para la factura ${invoiceId}:`,
      error
    );
    throw new HttpsError(
      "internal",
      "No se pudo obtener el historial de pagos."
    );
  }
});

/**
 * Envía un correo de recuperación de contraseña totalmente personalizado usando Resend.
 */
exports.sendCustomPasswordReset = onCall({ cors: true }, async (request) => {
  const { email } = request.data;
  if (!email) {
    throw new HttpsError("invalid-argument", "El email es obligatorio.");
  }

  const { Resend } = require("resend");
  if (!resendApiKey) {
    throw new HttpsError(
      "failed-precondition",
      "RESEND_API_KEY no está configurada en el entorno de Functions."
    );
  }
  const resend = new Resend(resendApiKey);

  try {
    // 1. Generar el enlace de recuperación usando Admin SDK
    const link = await admin.auth().generatePasswordResetLink(email);

    // 2. Enviar el correo con Resend
    await resend.emails.send({
      from: "Soporte Control Total <onboarding@resend.dev>", // Usa tu dominio verificado si lo tienes
      to: [email],
      subject: "Recuperación de Contraseña - Control Total & P.H.",
      html: `
        <div style="font-family: 'Helvetica', 'Arial', sans-serif; background-color: #f3f4f6; padding: 40px 20px;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 40px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <div style="text-align: center; margin-bottom: 30px;">
              <img src="https://sisfumictph.com/logo.png" alt="Control Total" style="height: 60px;">
            </div>
            <h2 style="color: #111827; text-align: center; margin-bottom: 20px;">Restablecer Contraseña</h2>
            <p style="color: #4b5563; font-size: 16px; line-height: 1.5; margin-bottom: 30px;">Hemos recibido una solicitud para restablecer la contraseña de tu cuenta en <strong>Control Total & P.H.</strong>. Si fuiste tú, haz clic en el botón de abajo:</p>
            <div style="text-align: center; margin-bottom: 30px;">
              <a href="${link}" style="background-color: #e11d48; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px; display: inline-block;">Restablecer mi Contraseña</a>
            </div>
            <p style="color: #6b7280; font-size: 14px; text-align: center;">Si no solicitaste este cambio, puedes ignorar este correo de forma segura.</p>
            <div style="border-top: 1px solid #e5e7eb; margin-top: 30px; padding-top: 20px; text-align: center; color: #9ca3af; font-size: 12px;">
              &copy; ${new Date().getFullYear()} Control Total & P.H. Todos los derechos reservados.
            </div>
          </div>
        </div>
      `
    });

    return { success: true };
  } catch (error) {
    logger.error("Error enviando correo de recuperación:", error);
    if (error.code === 'auth/user-not-found') {
       throw new HttpsError("not-found", "No existe una cuenta con este correo.");
    }
    throw new HttpsError("internal", "Error al enviar el correo de recuperación.");
  }
});

/**
 * Trigger que se activa cuando se escribe (crea o actualiza) una ficha de servicio.
 * Su propósito es detectar nuevas solicitudes de precio y notificar a los administradores.
 */
exports.onServiceSheetUpdateForPriceRequest = onDocumentWritten("servicios/{serviceSheetId}", async (event) => {
  // Si el documento fue eliminado, no hacemos nada.
  if (!event.data.after.exists) {
    return null;
  }

  const afterData = event.data.after.data();
  const beforeData = event.data.before ? event.data.before.data() : { services: [] };

  const servicesBefore = beforeData.services || [];
  const servicesAfter = afterData.services || [];

  // Encontrar servicios que son nuevos y tienen valor 0.
  const newPriceRequests = servicesAfter.filter(serviceAfter => {
    const isNew = !servicesBefore.some(s => s.tipo_servicio === serviceAfter.tipo_servicio);
    return isNew && serviceAfter.valor === 0;
  });

  if (newPriceRequests.length === 0) {
    return null; // No hay nuevas solicitudes de precio, terminamos.
  }

  logger.info(`Detectadas ${newPriceRequests.length} nuevas solicitudes de precio para el cliente ${afterData.clientName}.`);

  // Obtener la lista de UIDs de los administradores y jefes.
  const targetRoles = ["Administrador", "Jefe", "Coordinador Nacionales"];
  const usersSnapshot = await admin.auth().listUsers(1000);
  const adminUids = usersSnapshot.users
    .filter(user => user.customClaims && targetRoles.includes(user.customClaims.role))
    .map(user => user.uid);

  if (adminUids.length === 0) {
    logger.warn("No se encontraron administradores para notificar sobre la solicitud de precio.");
    return null;
  }

  // Crear una notificación para cada administrador en un lote.
  const batch = db.batch();
  const requester = await admin.auth().getUser(afterData.updatedBy || afterData.createdBy);

  newPriceRequests.forEach(service => {
    const notificationPayload = {
      title: "Solicitud de Precio",
      message: `El usuario ${requester.displayName} solicita precio para el servicio "${service.tipo_servicio}" del cliente "${afterData.clientName}".`,
      type: "price_request", // Tipo específico para el contador del menú.
      link: `/servicios?clientId=${afterData.clientId}`, // Enlace directo al cliente.
      read: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    adminUids.forEach(uid => {
      const notifRef = db.collection("users").doc(uid).collection("direct_notifications").doc();
      batch.set(notifRef, notificationPayload);
    });
  });

  await batch.commit();
  logger.info(`Notificaciones de solicitud de precio enviadas a ${adminUids.length} administradores.`);
  return null;
});
