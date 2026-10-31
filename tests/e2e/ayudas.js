/**
 * Utilidades compartidas por las pruebas end-to-end.
 *
 * Cada prueba crea su propio usuario con un correo unico, de modo que todas
 * son independientes y pueden ejecutarse en paralelo sobre la misma base.
 */

import { expect } from '@playwright/test';

let contador = 0;

/** Genera un correo distinto en cada llamada. */
export function correoUnico() {
  contador += 1;
  return 'e2e-' + Date.now() + '-' + contador + '-' + Math.random().toString(36).slice(2, 8) + '@test.com';
}

export const PASSWORD_VALIDA = 'secreta123';

/**
 * Registra un usuario nuevo desde la interfaz y espera a ver el tablero.
 * @returns {Promise<{correo:string, password:string, nombre:string}>}
 */
export async function registrarse(page, { nombre = 'Usuario E2E' } = {}) {
  const correo = correoUnico();

  await page.goto('/');
  await page.getByTestId('pestana-registro').click();
  await page.getByTestId('registro-nombre').fill(nombre);
  await page.getByTestId('registro-correo').fill(correo);
  await page.getByTestId('registro-password').fill(PASSWORD_VALIDA);
  await page.getByTestId('boton-registro').click();

  await expect(page.getByTestId('pantalla-app')).toBeVisible();
  return { correo, password: PASSWORD_VALIDA, nombre };
}

/**
 * Inicia sesion con credenciales existentes.
 */
export async function iniciarSesion(page, correo, password = PASSWORD_VALIDA) {
  await page.goto('/');
  await page.getByTestId('login-correo').fill(correo);
  await page.getByTestId('login-password').fill(password);
  await page.getByTestId('boton-login').click();
}

/**
 * Agrega una tarea desde la barra superior y espera a que aparezca.
 */
export async function agregarTarea(page, titulo, { prioridad = null, fecha = null } = {}) {
  await page.getByTestId('nueva-tarea-titulo').fill(titulo);
  if (prioridad) await page.getByTestId('nueva-tarea-prioridad').selectOption(prioridad);
  if (fecha) await page.getByTestId('nueva-tarea-fecha').fill(fecha);
  await page.getByTestId('boton-agregar').click();
  await expect(tarjetaPorTitulo(page, titulo)).toBeVisible();
}

/** Localiza la tarjeta de una tarea por su titulo exacto. */
export function tarjetaPorTitulo(page, titulo) {
  return page.locator('.tarea').filter({ has: page.getByText(titulo, { exact: true }) });
}

/** Localiza la lista de una columna. */
export function columna(page, estado) {
  return page.getByTestId('lista-' + estado);
}

/** Devuelve los titulos de las tareas de una columna, en orden visual. */
export async function titulosDeColumna(page, estado) {
  return columna(page, estado).locator('[data-testid="tarea-titulo"]').allTextContents();
}

/**
 * Espera a que una columna contenga exactamente los titulos indicados.
 *
 * DEF-007: leer los titulos con allTextContents() es una lectura instantanea
 * sin espera automatica, por lo que al comparar el resultado justo despues de
 * un arrastre la asercion podia ejecutarse antes de que el tablero se
 * repintara con la respuesta del servidor. expect.poll reintenta la lectura
 * hasta que coincide o se agota el tiempo.
 */
export async function esperarTitulosDeColumna(page, estado, esperados) {
  await expect
    .poll(() => titulosDeColumna(page, estado), { timeout: 5000 })
    .toEqual(esperados);
}
