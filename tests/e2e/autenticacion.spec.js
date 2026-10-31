/**
 * Pruebas funcionales end-to-end del flujo de acceso (CP-E-001 a CP-E-012).
 * Se ejecutan contra la aplicacion real en un navegador Chromium.
 */

import { test, expect } from '@playwright/test';
import { registrarse, iniciarSesion, correoUnico, PASSWORD_VALIDA } from './ayudas.js';

test.describe('Registro de usuario', () => {
  test('CP-E-001: un usuario nuevo se registra y entra al tablero', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('pantalla-auth')).toBeVisible();

    await page.getByTestId('pestana-registro').click();
    await page.getByTestId('registro-nombre').fill('Oscar Rivera');
    await page.getByTestId('registro-correo').fill(correoUnico());
    await page.getByTestId('registro-password').fill(PASSWORD_VALIDA);
    await page.getByTestId('boton-registro').click();

    await expect(page.getByTestId('pantalla-app')).toBeVisible();
    await expect(page.getByTestId('usuario-actual')).toHaveText('Oscar Rivera');
    await expect(page.getByTestId('tablero')).toBeVisible();
  });

  test('CP-E-002: muestra un error al registrarse con una contrasena debil', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('pestana-registro').click();
    await page.getByTestId('registro-nombre').fill('Usuario Debil');
    await page.getByTestId('registro-correo').fill(correoUnico());
    await page.getByTestId('registro-password').fill('123');
    await page.getByTestId('boton-registro').click();

    await expect(page.getByTestId('error-registro')).toBeVisible();
    await expect(page.getByTestId('pantalla-app')).toBeHidden();
  });

  test('CP-E-003: muestra un error al registrarse con un correo mal formado', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('pestana-registro').click();
    await page.getByTestId('registro-nombre').fill('Usuario Invalido');
    await page.getByTestId('registro-correo').fill('no-es-un-correo');
    await page.getByTestId('registro-password').fill(PASSWORD_VALIDA);
    await page.getByTestId('boton-registro').click();

    await expect(page.getByTestId('error-registro')).toContainText(/correo/i);
  });

  test('CP-E-004: no permite registrar dos veces el mismo correo', async ({ page }) => {
    const usuario = await registrarse(page);
    await page.getByTestId('boton-logout').click();

    await page.getByTestId('pestana-registro').click();
    await page.getByTestId('registro-nombre').fill('Impostor');
    await page.getByTestId('registro-correo').fill(usuario.correo);
    await page.getByTestId('registro-password').fill(PASSWORD_VALIDA);
    await page.getByTestId('boton-registro').click();

    await expect(page.getByTestId('error-registro')).toContainText(/ya existe/i);
  });
});

test.describe('Inicio de sesion', () => {
  test('CP-E-005: un usuario registrado inicia sesion correctamente', async ({ page }) => {
    const usuario = await registrarse(page, { nombre: 'Ana Lopez' });
    await page.getByTestId('boton-logout').click();
    await expect(page.getByTestId('pantalla-auth')).toBeVisible();

    await iniciarSesion(page, usuario.correo);

    await expect(page.getByTestId('pantalla-app')).toBeVisible();
    await expect(page.getByTestId('usuario-actual')).toHaveText('Ana Lopez');
  });

  test('CP-E-006: muestra un error con la contrasena incorrecta', async ({ page }) => {
    const usuario = await registrarse(page);
    await page.getByTestId('boton-logout').click();

    await iniciarSesion(page, usuario.correo, 'incorrecta999');

    await expect(page.getByTestId('error-login')).toBeVisible();
    await expect(page.getByTestId('pantalla-app')).toBeHidden();
  });

  test('CP-E-007: muestra un error con un usuario inexistente', async ({ page }) => {
    await iniciarSesion(page, 'nadie-existe@test.com', PASSWORD_VALIDA);
    await expect(page.getByTestId('error-login')).toBeVisible();
  });

  test('CP-E-008: el mensaje de error no revela si el correo existe', async ({ page }) => {
    const usuario = await registrarse(page);
    await page.getByTestId('boton-logout').click();

    // DEF-002: hay que esperar a que el mensaje sea visible antes de leerlo;
    // leerlo de inmediato devolvia una cadena vacia porque la peticion de
    // inicio de sesion todavia estaba en curso.
    await iniciarSesion(page, usuario.correo, 'incorrecta999');
    await expect(page.getByTestId('error-login')).toBeVisible();
    const mensajeExiste = await page.getByTestId('error-login').textContent();

    await page.goto('/');
    await iniciarSesion(page, 'nadie-existe@test.com', PASSWORD_VALIDA);
    await expect(page.getByTestId('error-login')).toBeVisible();
    const mensajeNoExiste = await page.getByTestId('error-login').textContent();

    expect(mensajeExiste).toBe(mensajeNoExiste);
  });
});

test.describe('Sesion', () => {
  test('CP-E-009: la sesion sobrevive a recargar la pagina', async ({ page }) => {
    await registrarse(page, { nombre: 'Usuario Persistente' });

    await page.reload();

    await expect(page.getByTestId('pantalla-app')).toBeVisible();
    await expect(page.getByTestId('usuario-actual')).toHaveText('Usuario Persistente');
  });

  test('CP-E-010: al cerrar sesion vuelve a la pantalla de acceso', async ({ page }) => {
    await registrarse(page);
    await page.getByTestId('boton-logout').click();

    await expect(page.getByTestId('pantalla-auth')).toBeVisible();
    await expect(page.getByTestId('pantalla-app')).toBeHidden();
  });

  test('CP-E-011: tras cerrar sesion la recarga no devuelve el acceso', async ({ page }) => {
    await registrarse(page);
    await page.getByTestId('boton-logout').click();
    await page.reload();

    await expect(page.getByTestId('pantalla-auth')).toBeVisible();
  });

  test('CP-E-012: un token invalido en el navegador no da acceso', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.setItem('taskflow.token', 'token-falso-123'));
    await page.reload();

    await expect(page.getByTestId('pantalla-auth')).toBeVisible();
  });
});

test.describe('Navegacion entre pestanas', () => {
  test('alterna entre los formularios de acceso y registro', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('form-login')).toBeVisible();

    await page.getByTestId('pestana-registro').click();
    await expect(page.getByTestId('form-registro')).toBeVisible();
    await expect(page.getByTestId('form-login')).toBeHidden();

    await page.getByTestId('pestana-login').click();
    await expect(page.getByTestId('form-login')).toBeVisible();
    await expect(page.getByTestId('form-registro')).toBeHidden();
  });

  test('cambiar de pestana limpia el mensaje de error anterior', async ({ page }) => {
    await iniciarSesion(page, 'nadie-existe@test.com', PASSWORD_VALIDA);
    await expect(page.getByTestId('error-login')).toBeVisible();

    await page.getByTestId('pestana-registro').click();
    await expect(page.getByTestId('error-login')).toBeHidden();
  });
});
