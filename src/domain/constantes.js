/**
 * Constantes del dominio de TaskFlow.
 * Centralizadas para que las pruebas y la API compartan una sola fuente de verdad.
 */

export const ESTADOS = ['pendiente', 'en_progreso', 'completada'];

export const PRIORIDADES = ['baja', 'media', 'alta'];

export const LIMITES = {
  TITULO_MIN: 3,
  TITULO_MAX: 100,
  DESCRIPCION_MAX: 500,
  PASSWORD_MIN: 8,
  PASSWORD_MAX: 72,
  NOMBRE_MIN: 2,
  NOMBRE_MAX: 60,
};

export const ESTADO_INICIAL = 'pendiente';
export const PRIORIDAD_POR_DEFECTO = 'media';
