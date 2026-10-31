/**
 * Casos de uso de autenticacion.
 * Orquesta validacion, saneamiento, hash de contrasena y persistencia.
 */

import { validarRegistro, validarCorreo } from '../domain/validadores.js';
import { limpiarTexto, normalizarCorreo, quitarCaracteresDeControl } from '../domain/sanitizer.js';
import { hashPassword, verificarPassword, generarToken } from '../domain/password.js';
import { errorDeValidacion, conflicto, credencialesInvalidas, noAutenticado } from '../errores.js';

export function crearAutenticacionServicio(usuarioRepositorio) {
  return {
    /**
     * Registra un usuario nuevo y abre su sesion.
     * Es asincrono porque el hash de la contrasena se calcula fuera del bucle
     * de eventos (ver DEF-008).
     */
    async registrar(datos) {
      const validacion = validarRegistro(datos);
      if (!validacion.valido) throw errorDeValidacion(validacion.errores);

      const correo = normalizarCorreo(datos.correo);
      if (usuarioRepositorio.existeCorreo(correo)) {
        throw conflicto('Ya existe una cuenta con ese correo');
      }

      const usuario = usuarioRepositorio.crear({
        // El nombre se normaliza pero no se escapa: ver DEF-001.
        nombre: quitarCaracteresDeControl(limpiarTexto(datos.nombre)),
        correo,
        passwordHash: await hashPassword(datos.password),
      });

      const token = generarToken();
      usuarioRepositorio.crearSesion(token, usuario.id);
      return { usuario, token };
    },

    /**
     * Inicia sesion. Devuelve el mismo error para correo inexistente y
     * contrasena incorrecta, para no revelar que correos estan registrados.
     */
    async iniciarSesion({ correo, password } = {}) {
      if (!validarCorreo(correo).valido || typeof password !== 'string' || password.length === 0) {
        throw credencialesInvalidas();
      }

      const fila = usuarioRepositorio.buscarPorCorreo(normalizarCorreo(correo));
      if (!fila || !(await verificarPassword(password, fila.password_hash))) {
        throw credencialesInvalidas();
      }

      const token = generarToken();
      usuarioRepositorio.crearSesion(token, fila.id);
      return {
        usuario: { id: fila.id, nombre: fila.nombre, correo: fila.correo },
        token,
      };
    },

    cerrarSesion(token) {
      return usuarioRepositorio.eliminarSesion(token);
    },

    /**
     * Resuelve el usuario a partir de un token; lanza 401 si no es valido.
     */
    usuarioDesdeToken(token) {
      const usuario = usuarioRepositorio.buscarPorToken(token);
      if (!usuario) throw noAutenticado();
      return usuario;
    },
  };
}
