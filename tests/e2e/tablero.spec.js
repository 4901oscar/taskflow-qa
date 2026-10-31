/**
 * Pruebas funcionales end-to-end del tablero: arrastrar y soltar, movimiento
 * por menu y contadores (CP-E-029 a CP-E-040).
 */

import { test, expect } from '@playwright/test';
import {
  registrarse,
  agregarTarea,
  tarjetaPorTitulo,
  columna,
  esperarTitulosDeColumna,
} from './ayudas.js';

test.beforeEach(async ({ page }) => {
  await registrarse(page);
});

test.describe('Arrastrar y soltar', () => {
  test('CP-E-029: arrastra una tarea de pendientes a en progreso', async ({ page }) => {
    await agregarTarea(page, 'Tarea que se arrastra');

    await tarjetaPorTitulo(page, 'Tarea que se arrastra').dragTo(columna(page, 'en_progreso'));

    await expect(
      columna(page, 'en_progreso').getByText('Tarea que se arrastra', { exact: true })
    ).toBeVisible();
    await expect(page.getByTestId('conteo-pendiente')).toHaveText('0');
    await expect(page.getByTestId('conteo-en_progreso')).toHaveText('1');
  });

  test('CP-E-030: arrastra una tarea hasta la columna de completadas', async ({ page }) => {
    await agregarTarea(page, 'Tarea que se completa');

    await tarjetaPorTitulo(page, 'Tarea que se completa').dragTo(columna(page, 'completada'));

    await expect(
      columna(page, 'completada').getByText('Tarea que se completa', { exact: true })
    ).toBeVisible();
    await expect(page.getByTestId('conteo-completada')).toHaveText('1');
  });

  test('CP-E-031: el movimiento por arrastre persiste tras recargar', async ({ page }) => {
    await agregarTarea(page, 'Tarea movida persistente');

    await tarjetaPorTitulo(page, 'Tarea movida persistente').dragTo(columna(page, 'en_progreso'));
    await expect(page.getByTestId('conteo-en_progreso')).toHaveText('1');

    await page.reload();

    await expect(
      columna(page, 'en_progreso').getByText('Tarea movida persistente', { exact: true })
    ).toBeVisible();
  });

  test('CP-E-032: arrastrar una tarea entre columnas deja la de origen vacia', async ({ page }) => {
    await agregarTarea(page, 'Unica tarea');

    await tarjetaPorTitulo(page, 'Unica tarea').dragTo(columna(page, 'completada'));

    await esperarTitulosDeColumna(page, 'pendiente', []);
    await esperarTitulosDeColumna(page, 'completada', ['Unica tarea']);
  });

  test('CP-E-033: mover una tarea no altera el resto del tablero', async ({ page }) => {
    await agregarTarea(page, 'Tarea A');
    await agregarTarea(page, 'Tarea B');
    await agregarTarea(page, 'Tarea C');

    await tarjetaPorTitulo(page, 'Tarea B').dragTo(columna(page, 'en_progreso'));

    await esperarTitulosDeColumna(page, 'pendiente', ['Tarea A', 'Tarea C']);
    await esperarTitulosDeColumna(page, 'en_progreso', ['Tarea B']);
  });

  test('CP-E-034: reordena una tarea dentro de la misma columna', async ({ page }) => {
    await agregarTarea(page, 'Tarea primera');
    await agregarTarea(page, 'Tarea segunda');
    await agregarTarea(page, 'Tarea tercera');

    // Se suelta la tercera sobre la primera para que quede al inicio.
    await tarjetaPorTitulo(page, 'Tarea tercera').dragTo(
      tarjetaPorTitulo(page, 'Tarea primera'),
      { targetPosition: { x: 10, y: 2 } }
    );

    await esperarTitulosDeColumna(page, 'pendiente', [
      'Tarea tercera',
      'Tarea primera',
      'Tarea segunda',
    ]);
  });

  test('CP-E-035: mueve varias tareas a la misma columna conservando el orden', async ({
    page,
  }) => {
    await agregarTarea(page, 'Tarea uno');
    await agregarTarea(page, 'Tarea dos');

    await tarjetaPorTitulo(page, 'Tarea uno').dragTo(columna(page, 'completada'));
    await expect(page.getByTestId('conteo-completada')).toHaveText('1');

    // DEF-005: al soltar en el centro de la columna el cursor caia justo sobre
    // la mitad superior de la tarjeta existente, por lo que la nueva tarea se
    // insertaba antes. Se suelta explicitamente en la parte baja de la columna
    // para expresar la intencion de agregar al final.
    const destino = columna(page, 'completada');
    const caja = await destino.boundingBox();
    await tarjetaPorTitulo(page, 'Tarea dos').dragTo(destino, {
      targetPosition: { x: caja.width / 2, y: caja.height - 2 },
    });
    await expect(page.getByTestId('conteo-completada')).toHaveText('2');

    await esperarTitulosDeColumna(page, 'completada', ['Tarea uno', 'Tarea dos']);
  });
});

test.describe('Mover con el menu desplegable', () => {
  test('CP-E-036: mueve una tarea a en progreso con el selector', async ({ page }) => {
    await agregarTarea(page, 'Tarea movida por menu');

    await tarjetaPorTitulo(page, 'Tarea movida por menu')
      .getByTestId('tarea-mover')
      .selectOption('en_progreso');

    await expect(page.getByTestId('conteo-en_progreso')).toHaveText('1');
    await expect(
      columna(page, 'en_progreso').getByText('Tarea movida por menu', { exact: true })
    ).toBeVisible();
  });

  test('CP-E-037: mueve una tarea a completadas con el selector', async ({ page }) => {
    await agregarTarea(page, 'Tarea completada por menu');

    await tarjetaPorTitulo(page, 'Tarea completada por menu')
      .getByTestId('tarea-mover')
      .selectOption('completada');

    await expect(page.getByTestId('conteo-completada')).toHaveText('1');
  });

  test('CP-E-038: el selector refleja la columna actual de la tarea', async ({ page }) => {
    await agregarTarea(page, 'Tarea con selector');

    const selector = tarjetaPorTitulo(page, 'Tarea con selector').getByTestId('tarea-mover');
    await expect(selector).toHaveValue('pendiente');

    await selector.selectOption('completada');
    await expect(page.getByTestId('conteo-completada')).toHaveText('1');
    await expect(
      tarjetaPorTitulo(page, 'Tarea con selector').getByTestId('tarea-mover')
    ).toHaveValue('completada');
  });

  test('el movimiento por menu persiste tras recargar', async ({ page }) => {
    await agregarTarea(page, 'Tarea persistente por menu');
    await tarjetaPorTitulo(page, 'Tarea persistente por menu')
      .getByTestId('tarea-mover')
      .selectOption('completada');
    await expect(page.getByTestId('conteo-completada')).toHaveText('1');

    await page.reload();
    await expect(page.getByTestId('conteo-completada')).toHaveText('1');
  });
});

test.describe('Contadores de columna', () => {
  test('CP-E-039: los contadores arrancan en cero', async ({ page }) => {
    await expect(page.getByTestId('conteo-pendiente')).toHaveText('0');
    await expect(page.getByTestId('conteo-en_progreso')).toHaveText('0');
    await expect(page.getByTestId('conteo-completada')).toHaveText('0');
  });

  test('CP-E-040: los contadores reflejan la distribucion real del tablero', async ({ page }) => {
    await agregarTarea(page, 'Tarea uno');
    await agregarTarea(page, 'Tarea dos');
    await agregarTarea(page, 'Tarea tres');

    await tarjetaPorTitulo(page, 'Tarea dos').getByTestId('tarea-mover').selectOption('en_progreso');
    await expect(page.getByTestId('conteo-en_progreso')).toHaveText('1');

    await tarjetaPorTitulo(page, 'Tarea tres').getByTestId('tarea-mover').selectOption('completada');

    await expect(page.getByTestId('conteo-pendiente')).toHaveText('1');
    await expect(page.getByTestId('conteo-en_progreso')).toHaveText('1');
    await expect(page.getByTestId('conteo-completada')).toHaveText('1');
  });
});
