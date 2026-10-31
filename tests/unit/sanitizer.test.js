/**
 * Pruebas unitarias de la normalizacion de entrada (CP-U-019 a CP-U-026).
 *
 * Tras corregir DEF-001 este modulo ya no escapa HTML: solo normaliza. Las
 * pruebas verifican que el texto del usuario se conserva intacto, incluidos
 * los caracteres especiales, y que los caracteres de control se eliminan.
 */

import { describe, it, expect } from 'vitest';
import {
  limpiarTexto,
  normalizarCorreo,
  quitarCaracteresDeControl,
} from '../../src/domain/sanitizer.js';

describe('limpiarTexto', () => {
  it('CP-U-019: recorta los espacios de los extremos', () => {
    expect(limpiarTexto('   hola   ')).toBe('hola');
  });

  it('CP-U-020: colapsa los espacios internos repetidos', () => {
    expect(limpiarTexto('hola     mundo')).toBe('hola mundo');
  });

  it('CP-U-021: normaliza tabuladores y saltos de linea a un solo espacio', () => {
    expect(limpiarTexto('hola\t\n  mundo')).toBe('hola mundo');
  });

  it('CP-U-022: conserva intactos los caracteres especiales de HTML', () => {
    // Regresion de DEF-001: el texto no debe convertirse en entidades HTML.
    expect(limpiarTexto('Revisar modulo <auth> & reportes')).toBe(
      'Revisar modulo <auth> & reportes'
    );
    expect(limpiarTexto("Informe de O'Brien")).toBe("Informe de O'Brien");
    expect(limpiarTexto('src/http/app.js')).toBe('src/http/app.js');
  });

  it('devuelve cadena vacia para valores nulos', () => {
    expect(limpiarTexto(null)).toBe('');
    expect(limpiarTexto(undefined)).toBe('');
  });

  it('convierte a texto los valores no textuales', () => {
    expect(limpiarTexto(42)).toBe('42');
  });
});

describe('normalizarCorreo', () => {
  it('CP-U-023: pasa el correo a minusculas y quita espacios', () => {
    expect(normalizarCorreo('  Oscar@Test.COM ')).toBe('oscar@test.com');
  });

  it('devuelve cadena vacia para valores nulos', () => {
    expect(normalizarCorreo(null)).toBe('');
    expect(normalizarCorreo(undefined)).toBe('');
  });
});

describe('quitarCaracteresDeControl', () => {
  it('CP-U-024: elimina los caracteres de control', () => {
    expect(quitarCaracteresDeControl('a\u0000b\u001Fc')).toBe('abc');
  });

  it('CP-U-025: elimina el caracter DEL', () => {
    expect(quitarCaracteresDeControl('a\u007Fb')).toBe('ab');
  });

  it('CP-U-026: no altera el texto legitimo ni los signos de puntuacion', () => {
    expect(quitarCaracteresDeControl('Revisar <auth> & "reportes"')).toBe(
      'Revisar <auth> & "reportes"'
    );
  });

  it('devuelve cadena vacia para valores nulos', () => {
    expect(quitarCaracteresDeControl(null)).toBe('');
    expect(quitarCaracteresDeControl(undefined)).toBe('');
  });
});
