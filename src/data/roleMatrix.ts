/** Roles autorizados por módulo. Las funciones Firebase aplican sus propios controles. */
export const ROLE_MATRIX = {
  operational: [
    'Administrador',
    'Jefe',
    'Coordinador Nacional',
    'Coordinador Valle',
    'Coordinador Norte de Santander',
  ],
  financial: ['Administrador', 'Jefe', 'Coordinador Nacional'],
  permissions: ['Administrador'],
} as const
