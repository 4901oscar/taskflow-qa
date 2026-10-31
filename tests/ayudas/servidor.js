/**
 * Utilidades compartidas por las pruebas de integracion y de seguridad.
 *
 * Cada prueba monta la API sobre una base SQLite en memoria: el aislamiento es
 * total entre casos y no se requiere limpiar datos ni abrir un puerto.
 */

import request from 'supertest';
import { crearApp } from '../../src/http/app.js';
import { crearBaseDeDatos } from '../../src/db/esquema.js';

/**
 * Crea una instancia limpia de la API.
 * @param {{limiteLogin?: number}} opciones
 */
export function crearApiDePrueba(opciones = {}) {
  const db = crearBaseDeDatos(':memory:');
  const app = crearApp({ db, ...opciones });
  return { app, db, agente: request(app) };
}

export const USUARIO_VALIDO = {
  nombre: 'Oscar Rivera',
  correo: 'oscar@test.com',
  password: 'secreta123',
};

export const OTRO_USUARIO = {
  nombre: 'Ana Lopez',
  correo: 'ana@test.com',
  password: 'otraclave456',
};

/**
 * Registra un usuario y devuelve su token y cabecera lista para usar.
 * @returns {Promise<{token:string, usuario:object, auth:string}>}
 */
export async function registrarUsuario(agente, datos = USUARIO_VALIDO) {
  const respuesta = await agente.post('/api/auth/registro').send(datos).expect(201);
  return {
    token: respuesta.body.token,
    usuario: respuesta.body.usuario,
    auth: 'Bearer ' + respuesta.body.token,
  };
}

/**
 * Crea una tarea para el usuario autenticado.
 */
export async function crearTarea(agente, auth, datos = { titulo: 'Tarea de prueba' }) {
  const respuesta = await agente
    .post('/api/tareas')
    .set('authorization', auth)
    .send(datos)
    .expect(201);
  return respuesta.body.tarea;
}

/** Devuelve los ids de una columna, en orden de posicion. */
export function idsDeColumna(tareas, estado) {
  return tareas
    .filter((t) => t.estado === estado)
    .sort((a, b) => a.posicion - b.posicion)
    .map((t) => t.id);
}
