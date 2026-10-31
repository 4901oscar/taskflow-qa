/**
 * Pruebas unitarias de los validadores del dominio.
 * Cubre los casos de prueba CP-U-001 a CP-U-018 del documento de casos.
 */

import { describe, it, expect } from 'vitest';
import {
  validarTitulo,
  validarDescripcion,
  validarEstado,
  validarPrioridad,
  validarFechaVencimiento,
  validarTarea,
  validarCorreo,
  validarPassword,
  validarNombre,
  validarRegistro,
} from '../../src/domain/validadores.js';
import { LIMITES } from '../../src/domain/constantes.js';

describe('validarTitulo', () => {
  it('CP-U-001: acepta un titulo valido', () => {
    const resultado = validarTitulo('Preparar informe de calidad');
    expect(resultado.valido).toBe(true);
    expect(resultado.errores).toEqual([]);
  });

  it('CP-U-002: rechaza un titulo vacio', () => {
    const resultado = validarTitulo('');
    expect(resultado.valido).toBe(false);
    expect(resultado.errores[0].campo).toBe('titulo');
  });

  it('CP-U-003: rechaza un titulo que solo tiene espacios', () => {
    const resultado = validarTitulo('      ');
    expect(resultado.valido).toBe(false);
    expect(resultado.errores[0].mensaje).toMatch(/obligatorio/i);
  });

  it('CP-U-004: rechaza un titulo mas corto que el minimo', () => {
    const resultado = validarTitulo('ab');
    expect(resultado.valido).toBe(false);
    expect(resultado.errores[0].mensaje).toContain(String(LIMITES.TITULO_MIN));
  });

  it('CP-U-005: acepta un titulo en el limite inferior (3 caracteres)', () => {
    expect(validarTitulo('abc').valido).toBe(true);
  });

  it('CP-U-006: acepta un titulo en el limite superior (100 caracteres)', () => {
    expect(validarTitulo('a'.repeat(LIMITES.TITULO_MAX)).valido).toBe(true);
  });

  it('CP-U-007: rechaza un titulo que excede el limite superior (101 caracteres)', () => {
    const resultado = validarTitulo('a'.repeat(LIMITES.TITULO_MAX + 1));
    expect(resultado.valido).toBe(false);
    expect(resultado.errores[0].mensaje).toMatch(/no puede exceder/i);
  });

  it.each([null, undefined, 42, {}, []])(
    'CP-U-008: rechaza el valor no textual %s',
    (entrada) => {
      expect(validarTitulo(entrada).valido).toBe(false);
    }
  );

  it('CP-U-009: no cuenta los espacios de los extremos al medir la longitud', () => {
    expect(validarTitulo('   ab   ').valido).toBe(false);
    expect(validarTitulo('   abc   ').valido).toBe(true);
  });
});

describe('validarDescripcion', () => {
  it('CP-U-010: acepta una descripcion ausente porque el campo es opcional', () => {
    expect(validarDescripcion(undefined).valido).toBe(true);
    expect(validarDescripcion(null).valido).toBe(true);
    expect(validarDescripcion('').valido).toBe(true);
  });

  it('CP-U-011: acepta una descripcion en el limite (500 caracteres)', () => {
    expect(validarDescripcion('x'.repeat(LIMITES.DESCRIPCION_MAX)).valido).toBe(true);
  });

  it('CP-U-012: rechaza una descripcion que excede el limite', () => {
    const resultado = validarDescripcion('x'.repeat(LIMITES.DESCRIPCION_MAX + 1));
    expect(resultado.valido).toBe(false);
    expect(resultado.errores[0].campo).toBe('descripcion');
  });

  it('rechaza una descripcion que no es texto', () => {
    expect(validarDescripcion(123).valido).toBe(false);
  });
});

describe('validarEstado', () => {
  it.each(['pendiente', 'en_progreso', 'completada'])(
    'CP-U-013: acepta el estado valido %s',
    (estado) => {
      expect(validarEstado(estado).valido).toBe(true);
    }
  );

  it.each(['archivada', 'PENDIENTE', 'en progreso', 'borrada'])(
    'CP-U-014: rechaza el estado invalido %s',
    (estado) => {
      expect(validarEstado(estado).valido).toBe(false);
    }
  );

  it('trata el estado ausente como valido para permitir el valor por defecto', () => {
    expect(validarEstado(undefined).valido).toBe(true);
  });
});

describe('validarPrioridad', () => {
  it.each(['baja', 'media', 'alta'])('CP-U-015: acepta la prioridad %s', (prioridad) => {
    expect(validarPrioridad(prioridad).valido).toBe(true);
  });

  it('rechaza una prioridad fuera del catalogo', () => {
    const resultado = validarPrioridad('urgentisima');
    expect(resultado.valido).toBe(false);
    expect(resultado.errores[0].campo).toBe('prioridad');
  });
});

describe('validarFechaVencimiento', () => {
  it('CP-U-016: acepta una fecha ISO valida', () => {
    expect(validarFechaVencimiento('2026-12-31').valido).toBe(true);
  });

  it('acepta la ausencia de fecha porque el campo es opcional', () => {
    expect(validarFechaVencimiento(null).valido).toBe(true);
    expect(validarFechaVencimiento('').valido).toBe(true);
  });

  it.each(['31/12/2026', '2026-13-01', 'ayer', '2026-1-1'])(
    'CP-U-017: rechaza el formato invalido %s',
    (fecha) => {
      expect(validarFechaVencimiento(fecha).valido).toBe(false);
    }
  );

  it('CP-U-018: rechaza una fecha que no existe en el calendario', () => {
    const resultado = validarFechaVencimiento('2026-02-31');
    expect(resultado.valido).toBe(false);
    expect(resultado.errores[0].mensaje).toMatch(/no existe/i);
  });
});

describe('validarTarea', () => {
  it('acepta una tarea completa y valida', () => {
    const resultado = validarTarea({
      titulo: 'Escribir casos de prueba',
      descripcion: 'Cubrir los flujos principales',
      estado: 'en_progreso',
      prioridad: 'alta',
      fechaVencimiento: '2026-11-15',
    });
    expect(resultado.valido).toBe(true);
  });

  it('acumula todos los errores encontrados, no solo el primero', () => {
    const resultado = validarTarea({
      titulo: '',
      estado: 'inexistente',
      prioridad: 'urgentisima',
      fechaVencimiento: 'mañana',
    });
    expect(resultado.valido).toBe(false);
    expect(resultado.errores).toHaveLength(4);
    expect(resultado.errores.map((e) => e.campo)).toEqual([
      'titulo',
      'estado',
      'prioridad',
      'fechaVencimiento',
    ]);
  });

  it.each([null, undefined, 'texto', 7])('rechaza la entrada no objeto %s', (entrada) => {
    expect(validarTarea(entrada).valido).toBe(false);
  });
});

describe('validarCorreo', () => {
  it.each(['usuario@dominio.com', 'a.b+c@sub.dominio.mx', 'OSCAR@TEST.COM'])(
    'acepta el correo valido %s',
    (correo) => {
      expect(validarCorreo(correo).valido).toBe(true);
    }
  );

  it.each(['sin-arroba', 'dos@@arrobas.com', '@sindominio.com', 'usuario@sintld', 'a@b.c'])(
    'rechaza el correo invalido %s',
    (correo) => {
      expect(validarCorreo(correo).valido).toBe(false);
    }
  );

  it('rechaza un correo vacio o ausente', () => {
    expect(validarCorreo('').valido).toBe(false);
    expect(validarCorreo(undefined).valido).toBe(false);
  });
});

describe('validarPassword', () => {
  it('acepta una contrasena que cumple todas las reglas', () => {
    expect(validarPassword('secreta123').valido).toBe(true);
  });

  it('rechaza una contrasena demasiado corta', () => {
    const resultado = validarPassword('corta1');
    expect(resultado.valido).toBe(false);
    expect(resultado.errores[0].mensaje).toContain(String(LIMITES.PASSWORD_MIN));
  });

  it('rechaza una contrasena sin numeros', () => {
    const resultado = validarPassword('solamenteletras');
    expect(resultado.valido).toBe(false);
    expect(resultado.errores.some((e) => /numero/i.test(e.mensaje))).toBe(true);
  });

  it('rechaza una contrasena sin letras', () => {
    const resultado = validarPassword('12345678');
    expect(resultado.valido).toBe(false);
    expect(resultado.errores.some((e) => /letra/i.test(e.mensaje))).toBe(true);
  });

  it('rechaza una contrasena que excede el maximo', () => {
    expect(validarPassword('a1'.repeat(40)).valido).toBe(false);
  });

  it('rechaza una contrasena vacia o ausente', () => {
    expect(validarPassword('').valido).toBe(false);
    expect(validarPassword(null).valido).toBe(false);
  });
});

describe('validarNombre', () => {
  it('acepta un nombre valido', () => {
    expect(validarNombre('Oscar Rivera').valido).toBe(true);
  });

  it('rechaza un nombre vacio', () => {
    expect(validarNombre('   ').valido).toBe(false);
  });

  it('rechaza un nombre de un solo caracter', () => {
    expect(validarNombre('O').valido).toBe(false);
  });

  it('rechaza un nombre que excede el maximo', () => {
    expect(validarNombre('n'.repeat(LIMITES.NOMBRE_MAX + 1)).valido).toBe(false);
  });
});

describe('validarRegistro', () => {
  it('acepta datos de registro completos', () => {
    const resultado = validarRegistro({
      nombre: 'Oscar',
      correo: 'oscar@test.com',
      password: 'secreta123',
    });
    expect(resultado.valido).toBe(true);
  });

  it('reporta los tres campos cuando todos son invalidos', () => {
    const resultado = validarRegistro({ nombre: '', correo: 'malo', password: '123' });
    expect(resultado.valido).toBe(false);
    const campos = new Set(resultado.errores.map((e) => e.campo));
    expect(campos).toEqual(new Set(['nombre', 'correo', 'password']));
  });

  it.each([null, undefined, 'texto'])('rechaza la entrada no objeto %s', (entrada) => {
    expect(validarRegistro(entrada).valido).toBe(false);
  });
});
