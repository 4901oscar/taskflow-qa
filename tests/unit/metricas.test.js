/**
 * Pruebas unitarias del calculo de metricas de calidad (CP-U-039 a CP-U-046).
 */

import { describe, it, expect } from 'vitest';
import {
  tasaDeDefectos,
  tasaDeExito,
  densidadPorModulo,
  percentil,
} from '../../src/domain/metricas.js';

describe('tasaDeDefectos', () => {
  it('CP-U-039: calcula los defectos por cada 1000 lineas', () => {
    expect(tasaDeDefectos(8, 2000)).toBe(4);
  });

  it('CP-U-040: devuelve 0 cuando no hay lineas de codigo', () => {
    expect(tasaDeDefectos(5, 0)).toBe(0);
  });

  it('redondea a dos decimales', () => {
    expect(tasaDeDefectos(1, 3000)).toBe(0.33);
  });

  it('CP-U-041: rechaza parametros negativos', () => {
    expect(() => tasaDeDefectos(-1, 100)).toThrow(/negativos/);
    expect(() => tasaDeDefectos(1, -100)).toThrow(/negativos/);
  });

  it('CP-U-042: rechaza parametros no numericos', () => {
    expect(() => tasaDeDefectos('ocho', 100)).toThrow(/numericos/);
    expect(() => tasaDeDefectos(8, NaN)).toThrow(/numericos/);
  });
});

describe('tasaDeExito', () => {
  it('CP-U-043: calcula el porcentaje de casos exitosos', () => {
    expect(tasaDeExito(47, 50)).toBe(94);
  });

  it('devuelve 0 cuando no se ejecuto ningun caso', () => {
    expect(tasaDeExito(0, 0)).toBe(0);
  });

  it('devuelve 100 cuando todos los casos pasan', () => {
    expect(tasaDeExito(30, 30)).toBe(100);
  });

  it('CP-U-044: rechaza mas exitos que el total ejecutado', () => {
    expect(() => tasaDeExito(51, 50)).toThrow(/no pueden exceder/);
  });
});

describe('densidadPorModulo', () => {
  it('CP-U-045: ordena los modulos de mayor a menor densidad de defectos', () => {
    const salida = densidadPorModulo([
      { modulo: 'tareas', defectos: 1, lineas: 500 },
      { modulo: 'ordenamiento', defectos: 4, lineas: 200 },
      { modulo: 'auth', defectos: 2, lineas: 400 },
    ]);
    expect(salida.map((m) => m.modulo)).toEqual(['ordenamiento', 'auth', 'tareas']);
    expect(salida[0].densidad).toBe(20);
  });

  it('devuelve un arreglo vacio si no hay modulos', () => {
    expect(densidadPorModulo([])).toEqual([]);
  });
});

describe('percentil', () => {
  const muestras = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

  it('CP-U-046: calcula el percentil 95', () => {
    expect(percentil(muestras, 95)).toBe(100);
  });

  it('calcula la mediana (percentil 50)', () => {
    expect(percentil(muestras, 50)).toBe(50);
  });

  it('devuelve el minimo para el percentil 0', () => {
    expect(percentil(muestras, 0)).toBe(10);
  });

  it('no depende del orden de entrada', () => {
    expect(percentil([50, 10, 30, 20, 40], 50)).toBe(30);
  });

  it('rechaza una muestra vacia', () => {
    expect(() => percentil([], 50)).toThrow(/al menos una muestra/);
  });

  it('rechaza un percentil fuera del rango 0-100', () => {
    expect(() => percentil(muestras, 120)).toThrow(/entre 0 y 100/);
    expect(() => percentil(muestras, -1)).toThrow(/entre 0 y 100/);
  });
});
