/**
 * Validadores del dominio.
 * Son funciones puras: misma entrada -> misma salida, sin efectos secundarios.
 * Por eso son el objetivo natural de las pruebas unitarias.
 *
 * Todas devuelven un resultado con la forma:
 *   { valido: boolean, errores: Array<{ campo: string, mensaje: string }> }
 */

import { ESTADOS, PRIORIDADES, LIMITES } from './constantes.js';
import { limpiarTexto, normalizarCorreo } from './sanitizer.js';

const REGEX_CORREO = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

function error(campo, mensaje) {
  return { campo, mensaje };
}

function resultado(errores) {
  return { valido: errores.length === 0, errores };
}

/**
 * Valida el titulo de una tarea.
 * Reglas: obligatorio, entre 3 y 100 caracteres tras recortar espacios.
 */
export function validarTitulo(titulo) {
  const errores = [];
  if (titulo === null || titulo === undefined || typeof titulo !== 'string') {
    errores.push(error('titulo', 'El titulo es obligatorio'));
    return resultado(errores);
  }
  const limpio = limpiarTexto(titulo);
  if (limpio.length === 0) {
    errores.push(error('titulo', 'El titulo es obligatorio'));
  } else if (limpio.length < LIMITES.TITULO_MIN) {
    errores.push(error('titulo', `El titulo debe tener al menos ${LIMITES.TITULO_MIN} caracteres`));
  } else if (limpio.length > LIMITES.TITULO_MAX) {
    errores.push(error('titulo', `El titulo no puede exceder ${LIMITES.TITULO_MAX} caracteres`));
  }
  return resultado(errores);
}

/**
 * Valida la descripcion de una tarea. Es un campo opcional.
 */
export function validarDescripcion(descripcion) {
  const errores = [];
  if (descripcion === null || descripcion === undefined || descripcion === '') {
    return resultado(errores);
  }
  if (typeof descripcion !== 'string') {
    errores.push(error('descripcion', 'La descripcion debe ser texto'));
    return resultado(errores);
  }
  if (limpiarTexto(descripcion).length > LIMITES.DESCRIPCION_MAX) {
    errores.push(
      error('descripcion', `La descripcion no puede exceder ${LIMITES.DESCRIPCION_MAX} caracteres`)
    );
  }
  return resultado(errores);
}

/**
 * Valida que el estado pertenezca al catalogo permitido.
 */
export function validarEstado(estado) {
  const errores = [];
  if (estado === null || estado === undefined || estado === '') {
    return resultado(errores);
  }
  if (!ESTADOS.includes(estado)) {
    errores.push(error('estado', `El estado debe ser uno de: ${ESTADOS.join(', ')}`));
  }
  return resultado(errores);
}

/**
 * Valida que la prioridad pertenezca al catalogo permitido.
 */
export function validarPrioridad(prioridad) {
  const errores = [];
  if (prioridad === null || prioridad === undefined || prioridad === '') {
    return resultado(errores);
  }
  if (!PRIORIDADES.includes(prioridad)) {
    errores.push(error('prioridad', `La prioridad debe ser una de: ${PRIORIDADES.join(', ')}`));
  }
  return resultado(errores);
}

/**
 * Valida la fecha de vencimiento. Opcional, formato ISO (YYYY-MM-DD).
 */
export function validarFechaVencimiento(fecha) {
  const errores = [];
  if (fecha === null || fecha === undefined || fecha === '') {
    return resultado(errores);
  }
  if (typeof fecha !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    errores.push(error('fechaVencimiento', 'La fecha debe tener el formato YYYY-MM-DD'));
    return resultado(errores);
  }
  const marca = Date.parse(`${fecha}T00:00:00Z`);
  if (Number.isNaN(marca)) {
    errores.push(error('fechaVencimiento', 'La fecha no es una fecha valida'));
    return resultado(errores);
  }
  // Verificacion de desbordamiento: 2024-02-31 se parsea pero no existe.
  const reconstruida = new Date(marca).toISOString().slice(0, 10);
  if (reconstruida !== fecha) {
    errores.push(error('fechaVencimiento', 'La fecha no existe en el calendario'));
  }
  return resultado(errores);
}

/**
 * Valida una tarea completa combinando los validadores de campo.
 */
export function validarTarea(tarea) {
  if (tarea === null || tarea === undefined || typeof tarea !== 'object') {
    return resultado([error('tarea', 'Se requiere un objeto de tarea')]);
  }
  const errores = [
    ...validarTitulo(tarea.titulo).errores,
    ...validarDescripcion(tarea.descripcion).errores,
    ...validarEstado(tarea.estado).errores,
    ...validarPrioridad(tarea.prioridad).errores,
    ...validarFechaVencimiento(tarea.fechaVencimiento).errores,
  ];
  return resultado(errores);
}

/**
 * Valida un correo electronico.
 */
export function validarCorreo(correo) {
  const errores = [];
  if (typeof correo !== 'string' || normalizarCorreo(correo).length === 0) {
    errores.push(error('correo', 'El correo es obligatorio'));
    return resultado(errores);
  }
  if (!REGEX_CORREO.test(normalizarCorreo(correo))) {
    errores.push(error('correo', 'El correo no tiene un formato valido'));
  }
  return resultado(errores);
}

/**
 * Valida una contrasena.
 * Reglas: minimo 8 caracteres, al menos una letra y al menos un numero.
 */
export function validarPassword(password) {
  const errores = [];
  if (typeof password !== 'string' || password.length === 0) {
    errores.push(error('password', 'La contrasena es obligatoria'));
    return resultado(errores);
  }
  if (password.length < LIMITES.PASSWORD_MIN) {
    errores.push(
      error('password', `La contrasena debe tener al menos ${LIMITES.PASSWORD_MIN} caracteres`)
    );
  }
  if (password.length > LIMITES.PASSWORD_MAX) {
    errores.push(
      error('password', `La contrasena no puede exceder ${LIMITES.PASSWORD_MAX} caracteres`)
    );
  }
  if (!/[a-zA-Z]/.test(password)) {
    errores.push(error('password', 'La contrasena debe incluir al menos una letra'));
  }
  if (!/[0-9]/.test(password)) {
    errores.push(error('password', 'La contrasena debe incluir al menos un numero'));
  }
  return resultado(errores);
}

/**
 * Valida el nombre de un usuario.
 */
export function validarNombre(nombre) {
  const errores = [];
  if (typeof nombre !== 'string' || limpiarTexto(nombre).length === 0) {
    errores.push(error('nombre', 'El nombre es obligatorio'));
    return resultado(errores);
  }
  const limpio = limpiarTexto(nombre);
  if (limpio.length < LIMITES.NOMBRE_MIN) {
    errores.push(error('nombre', `El nombre debe tener al menos ${LIMITES.NOMBRE_MIN} caracteres`));
  } else if (limpio.length > LIMITES.NOMBRE_MAX) {
    errores.push(error('nombre', `El nombre no puede exceder ${LIMITES.NOMBRE_MAX} caracteres`));
  }
  return resultado(errores);
}

/**
 * Valida los datos de registro de un usuario.
 */
export function validarRegistro(datos) {
  if (datos === null || datos === undefined || typeof datos !== 'object') {
    return resultado([error('registro', 'Se requieren los datos de registro')]);
  }
  const errores = [
    ...validarNombre(datos.nombre).errores,
    ...validarCorreo(datos.correo).errores,
    ...validarPassword(datos.password).errores,
  ];
  return resultado(errores);
}
