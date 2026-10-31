/**
 * Casos de uso de tareas: crear, listar, editar, eliminar y reordenar.
 */

import { validarTarea, validarEstado } from '../domain/validadores.js';
import { limpiarTexto, quitarCaracteresDeControl } from '../domain/sanitizer.js';
import { moverTarea, siguientePosicion } from '../domain/ordenamiento.js';
import { ESTADO_INICIAL, PRIORIDAD_POR_DEFECTO, ESTADOS } from '../domain/constantes.js';
import { errorDeValidacion, noEncontrado, ErrorDeAplicacion } from '../errores.js';

/**
 * Normaliza el texto que entra al sistema: recorta espacios y elimina
 * caracteres de control.
 *
 * Deliberadamente NO se escapa el HTML aqui (ver DEF-001 en la bitacora de
 * defectos): el escapado pertenece a la capa de presentacion, no a la de
 * almacenamiento. Guardar el texto ya escapado hacia que el usuario viera
 * entidades como &lt; en pantalla. La proteccion contra XSS la dan el uso de
 * textContent en el cliente y la cabecera Content-Security-Policy.
 */
function sanear(texto) {
  return quitarCaracteresDeControl(limpiarTexto(texto));
}

export function crearTareaServicio(tareaRepositorio) {
  return {
    crear(usuarioId, datos = {}) {
      const validacion = validarTarea(datos);
      if (!validacion.valido) throw errorDeValidacion(validacion.errores);

      const estado = datos.estado || ESTADO_INICIAL;
      const tareas = tareaRepositorio.listarPorUsuario(usuarioId);

      return tareaRepositorio.crear({
        usuarioId,
        titulo: sanear(datos.titulo),
        descripcion: sanear(datos.descripcion),
        estado,
        prioridad: datos.prioridad || PRIORIDAD_POR_DEFECTO,
        fechaVencimiento: datos.fechaVencimiento || null,
        posicion: siguientePosicion(tareas, estado),
      });
    },

    listar(usuarioId, filtros = {}) {
      if (filtros.estado && !validarEstado(filtros.estado).valido) {
        throw errorDeValidacion(validarEstado(filtros.estado).errores);
      }
      return tareaRepositorio.listarPorUsuario(usuarioId, {
        estado: filtros.estado || null,
        prioridad: filtros.prioridad || null,
        busqueda: filtros.busqueda ? limpiarTexto(filtros.busqueda) : null,
      });
    },

    obtener(usuarioId, id) {
      const tarea = tareaRepositorio.buscarPorId(id, usuarioId);
      if (!tarea) throw noEncontrado('Tarea');
      return tarea;
    },

    actualizar(usuarioId, id, datos = {}) {
      const existente = tareaRepositorio.buscarPorId(id, usuarioId);
      if (!existente) throw noEncontrado('Tarea');

      // Se valida la tarea resultante, no solo los campos enviados, para que
      // una edicion parcial no pueda dejar el registro en un estado invalido.
      const propuesta = {
        titulo: datos.titulo ?? existente.titulo,
        descripcion: datos.descripcion ?? existente.descripcion,
        estado: datos.estado ?? existente.estado,
        prioridad: datos.prioridad ?? existente.prioridad,
        fechaVencimiento: datos.fechaVencimiento ?? existente.fechaVencimiento,
      };
      const validacion = validarTarea(propuesta);
      if (!validacion.valido) throw errorDeValidacion(validacion.errores);

      const cambios = {};
      if (datos.titulo !== undefined) cambios.titulo = sanear(datos.titulo);
      if (datos.descripcion !== undefined) cambios.descripcion = sanear(datos.descripcion);
      if (datos.prioridad !== undefined) cambios.prioridad = datos.prioridad;
      if (datos.fechaVencimiento !== undefined) {
        cambios.fechaVencimiento = datos.fechaVencimiento || null;
      }
      // Al cambiar de columna la tarea se coloca al final de la nueva columna.
      if (datos.estado !== undefined && datos.estado !== existente.estado) {
        cambios.estado = datos.estado;
        cambios.posicion = siguientePosicion(
          tareaRepositorio.listarPorUsuario(usuarioId),
          datos.estado
        );
      }

      return tareaRepositorio.actualizar(id, usuarioId, cambios);
    },

    eliminar(usuarioId, id) {
      const eliminada = tareaRepositorio.eliminar(id, usuarioId);
      if (!eliminada) throw noEncontrado('Tarea');
      return true;
    },

    /**
     * Mueve una tarea dentro del tablero (arrastrar y soltar).
     */
    mover(usuarioId, id, estadoDestino, posicionDestino) {
      if (!ESTADOS.includes(estadoDestino)) {
        throw errorDeValidacion([
          { campo: 'estado', mensaje: `El estado debe ser uno de: ${ESTADOS.join(', ')}` },
        ]);
      }
      const tareas = tareaRepositorio.listarPorUsuario(usuarioId);
      if (!tareas.some((t) => t.id === id)) throw noEncontrado('Tarea');

      let nuevoOrden;
      try {
        nuevoOrden = moverTarea(tareas, id, estadoDestino, posicionDestino);
      } catch (causa) {
        throw new ErrorDeAplicacion(causa.message, 400);
      }
      return tareaRepositorio.guardarOrden(usuarioId, nuevoOrden);
    },

    /** Resumen por columna para el tablero y las metricas. */
    resumen(usuarioId) {
      const tareas = tareaRepositorio.listarPorUsuario(usuarioId);
      const conteo = {};
      for (const estado of ESTADOS) {
        conteo[estado] = tareas.filter((t) => t.estado === estado).length;
      }
      return { total: tareas.length, porEstado: conteo };
    },
  };
}
