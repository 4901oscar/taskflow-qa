/**
 * Logica pura de ordenamiento del tablero (arrastrar y soltar).
 * Se mantiene separada de la base de datos para poder probarla de forma unitaria,
 * ya que es la parte con mas casos borde de toda la aplicacion.
 */

import { ESTADOS } from './constantes.js';

/**
 * Agrupa las tareas por estado respetando su posicion.
 * @param {Array<{id:number, estado:string, posicion:number}>} tareas
 * @returns {Record<string, Array<object>>}
 */
export function agruparPorEstado(tareas) {
  const grupos = {};
  for (const estado of ESTADOS) grupos[estado] = [];
  for (const tarea of tareas) {
    if (!grupos[tarea.estado]) grupos[tarea.estado] = [];
    grupos[tarea.estado].push(tarea);
  }
  for (const estado of Object.keys(grupos)) {
    grupos[estado].sort((a, b) => a.posicion - b.posicion || a.id - b.id);
  }
  return grupos;
}

/**
 * Recalcula las posiciones de una columna como 0,1,2,... sin huecos.
 * @param {Array<object>} columna
 * @returns {Array<{id:number, estado:string, posicion:number}>}
 */
export function compactarPosiciones(columna) {
  return columna.map((tarea, indice) => ({ ...tarea, posicion: indice }));
}

/**
 * Calcula el nuevo estado del tablero al mover una tarea.
 *
 * Devuelve la lista completa de tareas con sus estados y posiciones ya
 * normalizados, de modo que el repositorio solo tenga que persistir el
 * resultado.
 *
 * @param {Array<{id:number, estado:string, posicion:number}>} tareas
 * @param {number} idTarea tarea que se arrastra
 * @param {string} estadoDestino columna de destino
 * @param {number} posicionDestino indice dentro de la columna de destino
 * @returns {Array<{id:number, estado:string, posicion:number}>}
 * @throws {Error} si la tarea no existe o el estado destino es invalido
 */
export function moverTarea(tareas, idTarea, estadoDestino, posicionDestino) {
  if (!ESTADOS.includes(estadoDestino)) {
    throw new Error(`Estado destino invalido: ${estadoDestino}`);
  }
  const tarea = tareas.find((t) => t.id === idTarea);
  if (!tarea) {
    throw new Error(`La tarea ${idTarea} no existe en el tablero`);
  }

  const grupos = agruparPorEstado(tareas);

  // 1. Quitar la tarea de su columna de origen.
  grupos[tarea.estado] = grupos[tarea.estado].filter((t) => t.id !== idTarea);

  // 2. Insertarla en el destino, acotando la posicion al rango valido.
  const destino = grupos[estadoDestino];
  const indice = Math.max(0, Math.min(Number(posicionDestino) || 0, destino.length));
  destino.splice(indice, 0, { ...tarea, estado: estadoDestino });

  // 3. Compactar todas las columnas para que no queden huecos.
  const salida = [];
  for (const estado of ESTADOS) {
    salida.push(...compactarPosiciones(grupos[estado]));
  }
  return salida;
}

/**
 * Posicion que ocuparia una tarea nueva al final de su columna.
 * @param {Array<{estado:string, posicion:number}>} tareas
 * @param {string} estado
 * @returns {number}
 */
export function siguientePosicion(tareas, estado) {
  const columna = tareas.filter((t) => t.estado === estado);
  if (columna.length === 0) return 0;
  return Math.max(...columna.map((t) => t.posicion)) + 1;
}
