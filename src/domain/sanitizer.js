/**
 * Utilidades de normalizacion de entrada.
 *
 * Nota de diseno (DEF-001): aqui NO se escapa el HTML. El texto se guarda tal
 * como lo escribio el usuario y la proteccion contra XSS se aplica al
 * renderizar (textContent en el cliente) y mediante Content-Security-Policy.
 * Escapar al entrar provocaba que el usuario viera entidades HTML en pantalla.
 */

/**
 * Normaliza un texto libre: recorta extremos y colapsa espacios internos.
 * @param {unknown} texto
 * @returns {string}
 */
export function limpiarTexto(texto) {
  if (texto === null || texto === undefined) return '';
  return String(texto).replace(/\s+/g, ' ').trim();
}

/**
 * Normaliza un correo: minusculas y sin espacios.
 * @param {unknown} correo
 * @returns {string}
 */
export function normalizarCorreo(correo) {
  if (correo === null || correo === undefined) return '';
  return String(correo).trim().toLowerCase();
}

/**
 * Elimina caracteres de control que podrian romper los reportes o los logs.
 * @param {unknown} texto
 * @returns {string}
 */
export function quitarCaracteresDeControl(texto) {
  if (texto === null || texto === undefined) return '';
  // eslint-disable-next-line no-control-regex
  return String(texto).replace(/[\u0000-\u001F\u007F]/g, '');
}
