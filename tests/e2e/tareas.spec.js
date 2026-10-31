/**
 * Pruebas funcionales end-to-end de la gestion de tareas (CP-E-013 a CP-E-028).
 */

import { test, expect } from '@playwright/test';
import {
  registrarse,
  agregarTarea,
  tarjetaPorTitulo,
  esperarTitulosDeColumna,
} from './ayudas.js';

test.beforeEach(async ({ page }) => {
  await registrarse(page);
});

test.describe('Crear tareas', () => {
  test('CP-E-013: crea una tarea y aparece en la columna de pendientes', async ({ page }) => {
    await agregarTarea(page, 'Redactar el plan de pruebas');

    await expect(tarjetaPorTitulo(page, 'Redactar el plan de pruebas')).toBeVisible();
    await expect(page.getByTestId('conteo-pendiente')).toHaveText('1');
  });

  test('CP-E-014: crea una tarea con prioridad alta y fecha de vencimiento', async ({ page }) => {
    await agregarTarea(page, 'Ejecutar pruebas de carga', {
      prioridad: 'alta',
      fecha: '2026-12-15',
    });

    const tarjeta = tarjetaPorTitulo(page, 'Ejecutar pruebas de carga');
    await expect(tarjeta.locator('.tarea__prioridad')).toHaveText('alta');
    await expect(tarjeta.getByTestId('tarea-fecha')).toContainText('15/12/2026');
  });

  test('CP-E-015: no crea una tarea con titulo vacio y muestra el error', async ({ page }) => {
    await page.getByTestId('nueva-tarea-titulo').fill('');
    await page.getByTestId('boton-agregar').click();

    await expect(page.getByTestId('error-tarea')).toBeVisible();
    await expect(page.getByTestId('conteo-pendiente')).toHaveText('0');
  });

  test('CP-E-016: no crea una tarea cuyo titulo solo tiene espacios', async ({ page }) => {
    await page.getByTestId('nueva-tarea-titulo').fill('        ');
    await page.getByTestId('boton-agregar').click();

    await expect(page.getByTestId('error-tarea')).toContainText(/titulo/i);
    await expect(page.getByTestId('conteo-pendiente')).toHaveText('0');
  });

  test('CP-E-017: no crea una tarea con titulo de menos de 3 caracteres', async ({ page }) => {
    await page.getByTestId('nueva-tarea-titulo').fill('ab');
    await page.getByTestId('boton-agregar').click();

    await expect(page.getByTestId('error-tarea')).toBeVisible();
  });

  test('CP-E-018: limpia el formulario despues de crear la tarea', async ({ page }) => {
    await agregarTarea(page, 'Tarea que limpia el formulario');
    await expect(page.getByTestId('nueva-tarea-titulo')).toHaveValue('');
  });

  test('CP-E-019: crea varias tareas y las muestra en orden de creacion', async ({ page }) => {
    await agregarTarea(page, 'Primera tarea');
    await agregarTarea(page, 'Segunda tarea');
    await agregarTarea(page, 'Tercera tarea');

    await esperarTitulosDeColumna(page, 'pendiente', [
      'Primera tarea',
      'Segunda tarea',
      'Tercera tarea',
    ]);
    await expect(page.getByTestId('conteo-pendiente')).toHaveText('3');
  });
});

test.describe('Editar tareas', () => {
  test('CP-E-020: edita el titulo de una tarea existente', async ({ page }) => {
    await agregarTarea(page, 'Titulo con error');

    await tarjetaPorTitulo(page, 'Titulo con error')
      .locator('[data-accion="editar"]')
      .click();
    await expect(page.getByTestId('dialogo-editar')).toBeVisible();
    await page.getByTestId('editar-titulo').fill('Titulo corregido');
    await page.getByTestId('boton-guardar').click();

    await expect(tarjetaPorTitulo(page, 'Titulo corregido')).toBeVisible();
    await expect(tarjetaPorTitulo(page, 'Titulo con error')).toHaveCount(0);
  });

  test('CP-E-021: agrega una descripcion desde el dialogo de edicion', async ({ page }) => {
    await agregarTarea(page, 'Tarea sin descripcion');

    await tarjetaPorTitulo(page, 'Tarea sin descripcion')
      .locator('[data-accion="editar"]')
      .click();
    await page.getByTestId('editar-descripcion').fill('Detalle agregado en la edicion');
    await page.getByTestId('boton-guardar').click();

    await expect(
      tarjetaPorTitulo(page, 'Tarea sin descripcion').getByTestId('tarea-descripcion')
    ).toHaveText('Detalle agregado en la edicion');
  });

  test('CP-E-022: cambia la prioridad desde el dialogo de edicion', async ({ page }) => {
    await agregarTarea(page, 'Tarea de prioridad media');

    await tarjetaPorTitulo(page, 'Tarea de prioridad media')
      .locator('[data-accion="editar"]')
      .click();
    await page.getByTestId('editar-prioridad').selectOption('alta');
    await page.getByTestId('boton-guardar').click();

    await expect(
      tarjetaPorTitulo(page, 'Tarea de prioridad media').locator('.tarea__prioridad')
    ).toHaveText('alta');
  });

  test('CP-E-023: rechaza la edicion que deja el titulo vacio', async ({ page }) => {
    await agregarTarea(page, 'Titulo que debe sobrevivir');

    await tarjetaPorTitulo(page, 'Titulo que debe sobrevivir')
      .locator('[data-accion="editar"]')
      .click();
    await page.getByTestId('editar-titulo').fill('');
    await page.getByTestId('boton-guardar').click();

    await expect(page.getByTestId('error-editar')).toBeVisible();
    await expect(page.getByTestId('dialogo-editar')).toBeVisible();

    await page.getByTestId('boton-cancelar').click();
    await expect(tarjetaPorTitulo(page, 'Titulo que debe sobrevivir')).toBeVisible();
  });

  test('CP-E-024: cancelar la edicion descarta los cambios', async ({ page }) => {
    await agregarTarea(page, 'Titulo original');

    await tarjetaPorTitulo(page, 'Titulo original').locator('[data-accion="editar"]').click();
    await page.getByTestId('editar-titulo').fill('Titulo descartado');
    await page.getByTestId('boton-cancelar').click();

    await expect(tarjetaPorTitulo(page, 'Titulo original')).toBeVisible();
    await expect(tarjetaPorTitulo(page, 'Titulo descartado')).toHaveCount(0);
  });

  test('el dialogo precarga los valores actuales de la tarea', async ({ page }) => {
    await agregarTarea(page, 'Tarea con datos', { prioridad: 'baja', fecha: '2026-11-20' });

    await tarjetaPorTitulo(page, 'Tarea con datos').locator('[data-accion="editar"]').click();

    await expect(page.getByTestId('editar-titulo')).toHaveValue('Tarea con datos');
    await expect(page.getByTestId('editar-prioridad')).toHaveValue('baja');
    await expect(page.getByTestId('editar-fecha')).toHaveValue('2026-11-20');
  });
});

test.describe('Eliminar tareas', () => {
  test('CP-E-025: elimina una tarea del tablero', async ({ page }) => {
    await agregarTarea(page, 'Tarea que se elimina');

    await tarjetaPorTitulo(page, 'Tarea que se elimina')
      .locator('[data-accion="eliminar"]')
      .click();

    await expect(tarjetaPorTitulo(page, 'Tarea que se elimina')).toHaveCount(0);
    await expect(page.getByTestId('conteo-pendiente')).toHaveText('0');
  });

  test('CP-E-026: eliminar una tarea no afecta a las demas', async ({ page }) => {
    await agregarTarea(page, 'Tarea A');
    await agregarTarea(page, 'Tarea B');
    await agregarTarea(page, 'Tarea C');

    await tarjetaPorTitulo(page, 'Tarea B').locator('[data-accion="eliminar"]').click();

    await expect(page.getByTestId('conteo-pendiente')).toHaveText('2');
    await esperarTitulosDeColumna(page, 'pendiente', ['Tarea A', 'Tarea C']);
  });

  test('la eliminacion persiste tras recargar la pagina', async ({ page }) => {
    await agregarTarea(page, 'Tarea eliminada permanente');
    await tarjetaPorTitulo(page, 'Tarea eliminada permanente')
      .locator('[data-accion="eliminar"]')
      .click();
    await expect(tarjetaPorTitulo(page, 'Tarea eliminada permanente')).toHaveCount(0);

    await page.reload();
    await expect(tarjetaPorTitulo(page, 'Tarea eliminada permanente')).toHaveCount(0);
  });
});

test.describe('Filtros y busqueda', () => {
  test.beforeEach(async ({ page }) => {
    await agregarTarea(page, 'Preparar informe mensual', { prioridad: 'alta' });
    await agregarTarea(page, 'Reunion de equipo', { prioridad: 'baja' });
    await agregarTarea(page, 'Comprar material de oficina', { prioridad: 'media' });
  });

  test('CP-E-027: filtra las tareas por texto de busqueda', async ({ page }) => {
    await page.getByTestId('filtro-busqueda').fill('informe');

    await expect(page.locator('.tarea')).toHaveCount(1);
    await expect(tarjetaPorTitulo(page, 'Preparar informe mensual')).toBeVisible();
  });

  test('CP-E-028: filtra las tareas por prioridad', async ({ page }) => {
    await page.getByTestId('filtro-prioridad').selectOption('alta');

    await expect(page.locator('.tarea')).toHaveCount(1);
    await expect(tarjetaPorTitulo(page, 'Preparar informe mensual')).toBeVisible();
  });

  test('la busqueda no distingue mayusculas de minusculas', async ({ page }) => {
    await page.getByTestId('filtro-busqueda').fill('INFORME');
    await expect(page.locator('.tarea')).toHaveCount(1);
  });

  test('limpiar el filtro restaura todas las tareas', async ({ page }) => {
    await page.getByTestId('filtro-busqueda').fill('informe');
    await expect(page.locator('.tarea')).toHaveCount(1);

    await page.getByTestId('filtro-busqueda').fill('');
    await expect(page.locator('.tarea')).toHaveCount(3);
  });

  test('una busqueda sin resultados deja el tablero vacio', async ({ page }) => {
    await page.getByTestId('filtro-busqueda').fill('texto-que-no-existe');
    await expect(page.locator('.tarea')).toHaveCount(0);
    await expect(page.getByTestId('conteo-pendiente')).toHaveText('0');
  });
});

test.describe('Persistencia', () => {
  test('las tareas creadas siguen ahi despues de recargar', async ({ page }) => {
    await agregarTarea(page, 'Tarea persistente');
    await page.reload();

    await expect(tarjetaPorTitulo(page, 'Tarea persistente')).toBeVisible();
  });

  test('las tareas no se comparten entre usuarios distintos', async ({ page }) => {
    await agregarTarea(page, 'Tarea privada del primer usuario');
    await page.getByTestId('boton-logout').click();

    await registrarse(page, { nombre: 'Segundo Usuario' });

    await expect(tarjetaPorTitulo(page, 'Tarea privada del primer usuario')).toHaveCount(0);
    await expect(page.getByTestId('conteo-pendiente')).toHaveText('0');
  });
});
