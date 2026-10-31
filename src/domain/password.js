/**
 * Hash y verificacion de contrasenas con scrypt (modulo nativo node:crypto).
 * Nunca se almacena la contrasena en texto plano: ese es uno de los controles
 * verificados en las pruebas de seguridad.
 *
 * Nota de rendimiento (DEF-008): las funciones son asincronas a proposito.
 * La version sincrona (scryptSync) bloqueaba el bucle de eventos durante todo
 * el calculo, de modo que con usuarios concurrentes los registros e inicios de
 * sesion se serializaban y, peor aun, retrasaban tambien a las peticiones de
 * tareas que no tenian nada que ver. Con la variante asincrona el calculo se
 * delega al grupo de hilos de libuv y el bucle de eventos queda libre.
 */

import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);

const LONGITUD_SAL = 16;
const LONGITUD_HASH = 64;

/**
 * Parametros de costo de scrypt.
 * N = 2^14 es el valor por defecto de Node y un punto de equilibrio razonable
 * entre resistencia a fuerza bruta y tiempo de respuesta. Se declara de forma
 * explicita para que el costo sea una decision consciente y documentada.
 */
const COSTO = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

/**
 * Genera el hash de una contrasena. Cada llamada usa una sal distinta, por lo
 * que dos usuarios con la misma contrasena no comparten hash.
 * @param {string} password
 * @returns {Promise<string>} cadena con el formato "sal:hash" en hexadecimal
 */
export async function hashPassword(password) {
  if (typeof password !== 'string' || password.length === 0) {
    throw new Error('La contrasena es obligatoria para generar el hash');
  }
  const sal = randomBytes(LONGITUD_SAL).toString('hex');
  const derivada = await scryptAsync(password, sal, LONGITUD_HASH, COSTO);
  return sal + ':' + derivada.toString('hex');
}

/**
 * Verifica una contrasena contra su hash almacenado.
 * Usa comparacion de tiempo constante para no filtrar informacion por el
 * tiempo de respuesta.
 * @param {string} password
 * @param {string} almacenado cadena "sal:hash"
 * @returns {Promise<boolean>}
 */
export async function verificarPassword(password, almacenado) {
  if (typeof password !== 'string' || typeof almacenado !== 'string') return false;

  const partes = almacenado.split(':');
  if (partes.length !== 2) return false;

  const [sal, hashEsperado] = partes;
  if (!sal || !hashEsperado) return false;

  let candidato;
  try {
    candidato = await scryptAsync(password, sal, LONGITUD_HASH, COSTO);
  } catch {
    return false;
  }

  const esperado = Buffer.from(hashEsperado, 'hex');
  if (esperado.length !== candidato.length) return false;
  return timingSafeEqual(candidato, esperado);
}

/**
 * Genera un token de sesion aleatorio criptograficamente seguro.
 * @returns {string}
 */
export function generarToken() {
  return randomBytes(32).toString('hex');
}
