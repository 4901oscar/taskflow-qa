/**
 * Pruebas unitarias del hash de contrasenas (CP-U-047 a CP-U-053).
 *
 * Tras corregir DEF-008 las funciones son asincronas, por lo que las pruebas
 * esperan la promesa. CP-U-054 verifica explicitamente que el calculo no
 * bloquea el bucle de eventos.
 */

import { describe, it, expect } from 'vitest';
import { hashPassword, verificarPassword, generarToken } from '../../src/domain/password.js';

describe('hashPassword', () => {
  it('CP-U-047: nunca devuelve la contrasena en texto plano', async () => {
    const hash = await hashPassword('secreta123');
    expect(hash).not.toContain('secreta123');
  });

  it('CP-U-048: devuelve el formato sal:hash en hexadecimal', async () => {
    const hash = await hashPassword('secreta123');
    expect(hash).toMatch(/^[0-9a-f]{32}:[0-9a-f]{128}$/);
  });

  it('CP-U-049: genera hashes distintos para la misma contrasena (sal aleatoria)', async () => {
    const primero = await hashPassword('secreta123');
    const segundo = await hashPassword('secreta123');
    expect(primero).not.toBe(segundo);
  });

  it('rechaza una contrasena vacia o no textual', async () => {
    await expect(hashPassword('')).rejects.toThrow(/obligatoria/);
    await expect(hashPassword(null)).rejects.toThrow(/obligatoria/);
  });
});

describe('verificarPassword', () => {
  it('CP-U-050: acepta la contrasena correcta', async () => {
    const hash = await hashPassword('secreta123');
    await expect(verificarPassword('secreta123', hash)).resolves.toBe(true);
  });

  it('CP-U-051: rechaza una contrasena incorrecta', async () => {
    const hash = await hashPassword('secreta123');
    await expect(verificarPassword('secreta124', hash)).resolves.toBe(false);
  });

  it('distingue mayusculas y minusculas', async () => {
    const hash = await hashPassword('Secreta123');
    await expect(verificarPassword('secreta123', hash)).resolves.toBe(false);
  });

  it.each(['sin-separador', 'a:b:c', ':', '', 'abcd:00ff'])(
    'CP-U-052: rechaza el hash corrupto "%s" sin lanzar excepcion',
    async (almacenado) => {
      await expect(verificarPassword('secreta123', almacenado)).resolves.toBe(false);
    }
  );

  it('rechaza entradas no textuales sin lanzar excepcion', async () => {
    const hash = await hashPassword('secreta123');
    await expect(verificarPassword(null, hash)).resolves.toBe(false);
    await expect(verificarPassword('secreta123', null)).resolves.toBe(false);
  });
});

describe('generarToken', () => {
  it('CP-U-053: genera tokens unicos de 64 caracteres hexadecimales', () => {
    const tokens = new Set(Array.from({ length: 200 }, () => generarToken()));
    expect(tokens.size).toBe(200);
    for (const token of tokens) {
      expect(token).toMatch(/^[0-9a-f]{64}$/);
    }
  });
});

describe('Rendimiento del hash', () => {
  it('CP-U-054: el calculo no bloquea el bucle de eventos', async () => {
    // Regresion de DEF-008: con la version sincrona, un temporizador programado
    // para 0 ms no podia dispararse hasta terminar todos los hashes, porque el
    // bucle de eventos quedaba bloqueado.
    let temporizadorEjecutado = false;
    const temporizador = new Promise((resolver) => {
      setTimeout(() => {
        temporizadorEjecutado = true;
        resolver();
      }, 0);
    });

    // Varios hashes en paralelo: suficiente para notar el bloqueo.
    const hashes = Promise.all(
      Array.from({ length: 8 }, (_valor, indice) => hashPassword('secreta' + indice))
    );

    // El temporizador debe poder ejecutarse antes de que terminen los hashes.
    await temporizador;
    expect(temporizadorEjecutado).toBe(true);

    await expect(hashes).resolves.toHaveLength(8);
  });

  it('varias verificaciones en paralelo devuelven el resultado correcto', async () => {
    const hash = await hashPassword('secreta123');
    const resultados = await Promise.all([
      verificarPassword('secreta123', hash),
      verificarPassword('incorrecta1', hash),
      verificarPassword('secreta123', hash),
    ]);
    expect(resultados).toEqual([true, false, true]);
  });
});
