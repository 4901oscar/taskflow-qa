/**
 * Pruebas unitarias del limitador de intentos (CP-U-055 a CP-U-059).
 * Se usan temporizadores falsos para no depender del reloj real.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { crearLimitador } from '../../src/http/limitador.js';

afterEach(() => {
  vi.useRealTimers();
});

describe('crearLimitador', () => {
  it('CP-U-055: permite los intentos dentro del limite', () => {
    const limitador = crearLimitador({ maximo: 3 });
    expect(limitador.registrar('ip-1').bloqueado).toBe(false);
    expect(limitador.registrar('ip-1').bloqueado).toBe(false);
    expect(limitador.registrar('ip-1').bloqueado).toBe(false);
  });

  it('CP-U-056: bloquea al superar el limite', () => {
    const limitador = crearLimitador({ maximo: 3 });
    limitador.registrar('ip-1');
    limitador.registrar('ip-1');
    limitador.registrar('ip-1');
    expect(limitador.registrar('ip-1').bloqueado).toBe(true);
  });

  it('CP-U-057: cuenta cada clave de forma independiente', () => {
    const limitador = crearLimitador({ maximo: 1 });
    limitador.registrar('ip-1');
    expect(limitador.registrar('ip-1').bloqueado).toBe(true);
    expect(limitador.registrar('ip-2').bloqueado).toBe(false);
  });

  it('CP-U-058: olvida los intentos al expirar la ventana de tiempo', () => {
    vi.useFakeTimers();
    const limitador = crearLimitador({ maximo: 2, ventanaMs: 60_000 });
    limitador.registrar('ip-1');
    limitador.registrar('ip-1');
    expect(limitador.registrar('ip-1').bloqueado).toBe(true);

    vi.advanceTimersByTime(61_000);
    expect(limitador.registrar('ip-1').bloqueado).toBe(false);
  });

  it('CP-U-059: reiniciar libera la clave de inmediato', () => {
    const limitador = crearLimitador({ maximo: 1 });
    limitador.registrar('ip-1');
    expect(limitador.registrar('ip-1').bloqueado).toBe(true);
    limitador.reiniciar('ip-1');
    expect(limitador.registrar('ip-1').bloqueado).toBe(false);
  });

  it('informa cuantos intentos quedan disponibles', () => {
    const limitador = crearLimitador({ maximo: 3 });
    expect(limitador.registrar('ip-1').restantes).toBe(2);
    expect(limitador.registrar('ip-1').restantes).toBe(1);
    expect(limitador.registrar('ip-1').restantes).toBe(0);
  });

  it('limpiar vacia todas las claves registradas', () => {
    const limitador = crearLimitador({ maximo: 1 });
    limitador.registrar('ip-1');
    limitador.registrar('ip-2');
    limitador.limpiar();
    expect(limitador.registrar('ip-1').bloqueado).toBe(false);
    expect(limitador.registrar('ip-2').bloqueado).toBe(false);
  });
});
