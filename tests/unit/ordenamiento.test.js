/**
 * Pruebas unitarias de la logica de arrastrar y soltar (CP-U-027 a CP-U-038).
 * Es el modulo con mas casos borde, por eso concentra la mayor parte de las
 * pruebas unitarias.
 */

import { describe, it, expect } from 'vitest';
import {
  agruparPorEstado,
  compactarPosiciones,
  moverTarea,
  siguientePosicion,
} from '../../src/domain/ordenamiento.js';

/** Tablero de apoyo: 3 pendientes, 2 en progreso, 0 completadas. */
function tableroBase() {
  return [
    { id: 1, estado: 'pendiente', posicion: 0 },
    { id: 2, estado: 'pendiente', posicion: 1 },
    { id: 3, estado: 'pendiente', posicion: 2 },
    { id: 4, estado: 'en_progreso', posicion: 0 },
    { id: 5, estado: 'en_progreso', posicion: 1 },
  ];
}

/** Devuelve los ids de una columna en su orden actual. */
function idsDe(tareas, estado) {
  return tareas
    .filter((t) => t.estado === estado)
    .sort((a, b) => a.posicion - b.posicion)
    .map((t) => t.id);
}

describe('agruparPorEstado', () => {
  it('CP-U-027: agrupa las tareas en las tres columnas', () => {
    const grupos = agruparPorEstado(tableroBase());
    expect(Object.keys(grupos)).toEqual(['pendiente', 'en_progreso', 'completada']);
    expect(grupos.pendiente).toHaveLength(3);
    expect(grupos.en_progreso).toHaveLength(2);
    expect(grupos.completada).toHaveLength(0);
  });

  it('CP-U-028: ordena cada columna por posicion', () => {
    const grupos = agruparPorEstado([
      { id: 9, estado: 'pendiente', posicion: 5 },
      { id: 7, estado: 'pendiente', posicion: 1 },
      { id: 8, estado: 'pendiente', posicion: 3 },
    ]);
    expect(grupos.pendiente.map((t) => t.id)).toEqual([7, 8, 9]);
  });

  it('desempata por id cuando dos tareas comparten posicion', () => {
    const grupos = agruparPorEstado([
      { id: 20, estado: 'pendiente', posicion: 0 },
      { id: 10, estado: 'pendiente', posicion: 0 },
    ]);
    expect(grupos.pendiente.map((t) => t.id)).toEqual([10, 20]);
  });

  it('devuelve las tres columnas vacias para un tablero sin tareas', () => {
    const grupos = agruparPorEstado([]);
    expect(grupos.pendiente).toEqual([]);
    expect(grupos.completada).toEqual([]);
  });
});

describe('compactarPosiciones', () => {
  it('CP-U-029: renumera las posiciones desde cero y sin huecos', () => {
    const salida = compactarPosiciones([
      { id: 1, estado: 'pendiente', posicion: 4 },
      { id: 2, estado: 'pendiente', posicion: 9 },
    ]);
    expect(salida.map((t) => t.posicion)).toEqual([0, 1]);
  });

  it('no modifica el arreglo original', () => {
    const entrada = [{ id: 1, estado: 'pendiente', posicion: 7 }];
    compactarPosiciones(entrada);
    expect(entrada[0].posicion).toBe(7);
  });
});

describe('moverTarea', () => {
  it('CP-U-030: mueve una tarea a otra columna en la posicion indicada', () => {
    const salida = moverTarea(tableroBase(), 1, 'en_progreso', 1);
    expect(idsDe(salida, 'en_progreso')).toEqual([4, 1, 5]);
    expect(idsDe(salida, 'pendiente')).toEqual([2, 3]);
  });

  it('CP-U-031: compacta la columna de origen al retirar la tarea', () => {
    const salida = moverTarea(tableroBase(), 1, 'completada', 0);
    const pendientes = salida.filter((t) => t.estado === 'pendiente');
    expect(pendientes.map((t) => t.posicion)).toEqual([0, 1]);
  });

  it('CP-U-032: reordena dentro de la misma columna sin duplicar la tarea', () => {
    const salida = moverTarea(tableroBase(), 3, 'pendiente', 0);
    expect(idsDe(salida, 'pendiente')).toEqual([3, 1, 2]);
    expect(salida.filter((t) => t.id === 3)).toHaveLength(1);
  });

  it('CP-U-033: mover una tarea a su misma posicion deja el tablero igual', () => {
    const antes = tableroBase();
    const salida = moverTarea(antes, 2, 'pendiente', 1);
    expect(idsDe(salida, 'pendiente')).toEqual([1, 2, 3]);
  });

  it('CP-U-034: acota una posicion destino mayor que el tamano de la columna', () => {
    const salida = moverTarea(tableroBase(), 1, 'en_progreso', 99);
    expect(idsDe(salida, 'en_progreso')).toEqual([4, 5, 1]);
  });

  it('CP-U-035: acota una posicion destino negativa a la primera posicion', () => {
    const salida = moverTarea(tableroBase(), 1, 'en_progreso', -5);
    expect(idsDe(salida, 'en_progreso')).toEqual([1, 4, 5]);
  });

  it('CP-U-036: mueve a una columna vacia', () => {
    const salida = moverTarea(tableroBase(), 4, 'completada', 0);
    expect(idsDe(salida, 'completada')).toEqual([4]);
    expect(idsDe(salida, 'en_progreso')).toEqual([5]);
  });

  it('CP-U-037: lanza error si el estado destino no existe', () => {
    expect(() => moverTarea(tableroBase(), 1, 'archivada', 0)).toThrow(/Estado destino invalido/);
  });

  it('CP-U-038: lanza error si la tarea no esta en el tablero', () => {
    expect(() => moverTarea(tableroBase(), 999, 'pendiente', 0)).toThrow(/no existe/);
  });

  it('conserva todas las tareas tras el movimiento', () => {
    const salida = moverTarea(tableroBase(), 2, 'completada', 0);
    expect(salida).toHaveLength(5);
    expect(new Set(salida.map((t) => t.id))).toEqual(new Set([1, 2, 3, 4, 5]));
  });

  it('no deja posiciones duplicadas en ninguna columna', () => {
    const salida = moverTarea(tableroBase(), 5, 'pendiente', 1);
    for (const estado of ['pendiente', 'en_progreso', 'completada']) {
      const posiciones = salida.filter((t) => t.estado === estado).map((t) => t.posicion);
      expect(new Set(posiciones).size).toBe(posiciones.length);
    }
  });

  it('no modifica el tablero recibido (funcion pura)', () => {
    const entrada = tableroBase();
    const copia = JSON.parse(JSON.stringify(entrada));
    moverTarea(entrada, 1, 'completada', 0);
    expect(entrada).toEqual(copia);
  });

  it('trata una posicion no numerica como la primera posicion', () => {
    const salida = moverTarea(tableroBase(), 1, 'en_progreso', 'abc');
    expect(idsDe(salida, 'en_progreso')).toEqual([1, 4, 5]);
  });
});

describe('siguientePosicion', () => {
  it('devuelve 0 para una columna vacia', () => {
    expect(siguientePosicion(tableroBase(), 'completada')).toBe(0);
  });

  it('devuelve la posicion siguiente a la ultima ocupada', () => {
    expect(siguientePosicion(tableroBase(), 'pendiente')).toBe(3);
    expect(siguientePosicion(tableroBase(), 'en_progreso')).toBe(2);
  });

  it('tolera huecos en las posiciones existentes', () => {
    const tareas = [
      { id: 1, estado: 'pendiente', posicion: 0 },
      { id: 2, estado: 'pendiente', posicion: 7 },
    ];
    expect(siguientePosicion(tareas, 'pendiente')).toBe(8);
  });
});
