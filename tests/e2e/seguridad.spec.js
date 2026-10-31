/**
 * Pruebas end-to-end de seguridad en el navegador (CP-E-041 a CP-E-046).
 *
 * Las pruebas de seguridad de la API comprueban que la carga no se almacena de
 * forma peligrosa; estas comprueban el otro extremo: que al renderizarla en el
 * navegador tampoco se ejecuta y que el usuario ve el texto que escribio.
 */

import { test, expect } from '@playwright/test';
import { registrarse, agregarTarea, tarjetaPorTitulo } from './ayudas.js';

test.beforeEach(async ({ page }) => {
  await registrarse(page);
});

test.describe('XSS en el navegador', () => {
  test('CP-E-041: una etiqueta script en el titulo no se ejecuta', async ({ page }) => {
    // DEF-006: antes se usaba addInitScript, que solo se aplica en la siguiente
    // navegacion; como la prueba no vuelve a navegar, el centinela quedaba sin
    // definir y la asercion comparaba undefined con false. Se define el
    // centinela en la pagina ya cargada.
    await page.evaluate(() => {
      window.__xssEjecutado = false;
    });

    // Si la carga se ejecutara, pondria el centinela en true.
    await agregarTarea(page, '<script>window.__xssEjecutado = true</script>');

    expect(await page.evaluate(() => window.__xssEjecutado)).toBe(false);
  });

  test('CP-E-042: un atributo onerror en el titulo no dispara ningun dialogo', async ({ page }) => {
    let dialogos = 0;
    page.on('dialog', async (dialogo) => {
      dialogos += 1;
      await dialogo.dismiss();
    });

    await agregarTarea(page, '<img src=x onerror=alert(1)>');
    await page.waitForTimeout(500);

    expect(dialogos).toBe(0);
  });

  test('CP-E-043: la carga no inserta elementos nuevos en el DOM', async ({ page }) => {
    await agregarTarea(page, '<img src=x onerror=alert(1)>');

    // No debe existir ninguna imagen inyectada dentro del tablero.
    expect(await page.locator('[data-testid="tablero"] img').count()).toBe(0);
    expect(await page.locator('[data-testid="tablero"] script').count()).toBe(0);
  });

  test('CP-E-044: el texto que escribe el usuario se muestra tal cual', async ({ page }) => {
    // El usuario escribe texto con caracteres especiales de forma legitima.
    const titulo = 'Revisar modulo <auth> & reportes';

    await page.getByTestId('nueva-tarea-titulo').fill(titulo);
    await page.getByTestId('boton-agregar').click();

    const mostrado = page.locator('[data-testid="tarea-titulo"]').first();
    await expect(mostrado).toBeVisible();

    // No deben aparecer entidades HTML visibles como &lt; o &amp;.
    await expect(mostrado).toHaveText(titulo);
  });

  test('CP-E-045: una comilla en el titulo se muestra sin codificar', async ({ page }) => {
    const titulo = "Revisar el informe de O'Brien";

    await page.getByTestId('nueva-tarea-titulo').fill(titulo);
    await page.getByTestId('boton-agregar').click();

    await expect(page.locator('[data-testid="tarea-titulo"]').first()).toHaveText(titulo);
  });

  test('CP-E-046: una barra en el titulo se muestra sin codificar', async ({ page }) => {
    const titulo = 'Actualizar src/http/app.js';

    await page.getByTestId('nueva-tarea-titulo').fill(titulo);
    await page.getByTestId('boton-agregar').click();

    await expect(page.locator('[data-testid="tarea-titulo"]').first()).toHaveText(titulo);
  });
});

test.describe('Aislamiento de la sesion en el navegador', () => {
  test('el token se borra del almacenamiento local al cerrar sesion', async ({ page }) => {
    await page.getByTestId('boton-logout').click();

    const token = await page.evaluate(() => localStorage.getItem('taskflow.token'));
    expect(token).toBeNull();
  });

  test('la aplicacion no expone la contrasena en el almacenamiento local', async ({ page }) => {
    const almacenamiento = await page.evaluate(() => JSON.stringify(localStorage));
    expect(almacenamiento).not.toContain('secreta123');
  });
});

test.describe('Robustez de la interfaz', () => {
  test('un titulo muy largo no rompe el diseno del tablero', async ({ page }) => {
    const largo = 'Palabra'.repeat(14);
    await agregarTarea(page, largo);

    const tarjeta = tarjetaPorTitulo(page, largo);
    const caja = await tarjeta.boundingBox();
    const anchoColumna = await page.getByTestId('columna-pendiente').boundingBox();

    expect(caja.width).toBeLessThanOrEqual(anchoColumna.width + 1);
  });

  test('la interfaz sigue siendo usable en viewport movil', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await agregarTarea(page, 'Tarea en movil');

    await expect(tarjetaPorTitulo(page, 'Tarea en movil')).toBeVisible();
    // No debe haber desplazamiento horizontal.
    const desborde = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
    );
    expect(desborde).toBe(false);
  });
});
