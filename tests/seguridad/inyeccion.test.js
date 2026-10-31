/**
 * Pruebas de seguridad: inyeccion SQL (CP-S-001 a CP-S-010).
 *
 * Objetivo: comprobar que las cargas de inyeccion se tratan como datos y nunca
 * como sentencias SQL. El control implementado son las sentencias preparadas
 * con parametros enlazados en la capa de repositorios.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  crearApiDePrueba,
  registrarUsuario,
  crearTarea,
  USUARIO_VALIDO,
} from '../ayudas/servidor.js';

/** Cargas tipicas de inyeccion SQL. */
const CARGAS_SQL = [
  "' OR '1'='1",
  "'; DROP TABLE tareas; --",
  "admin'--",
  "' UNION SELECT token, usuario_id FROM sesiones --",
  "1' OR 1=1 --",
  "'; UPDATE tareas SET titulo='hackeado'; --",
  "' OR ''='",
  "\\'; DELETE FROM usuarios; --",
];

let api;
let sesion;

beforeEach(async () => {
  api = crearApiDePrueba();
  sesion = await registrarUsuario(api.agente);
});

describe('Inyeccion SQL en el inicio de sesion', () => {
  it.each(CARGAS_SQL)('CP-S-001: no permite entrar con la carga %s en el correo', async (carga) => {
    const respuesta = await api.agente
      .post('/api/auth/login')
      .send({ correo: carga, password: 'cualquiera1' });

    expect(respuesta.status).toBe(401);
    expect(respuesta.body.token).toBeUndefined();
  });

  it.each(CARGAS_SQL)(
    'CP-S-002: no permite entrar con la carga %s en la contrasena',
    async (carga) => {
      const respuesta = await api.agente
        .post('/api/auth/login')
        .send({ correo: USUARIO_VALIDO.correo, password: carga });

      expect(respuesta.status).toBe(401);
      expect(respuesta.body.token).toBeUndefined();
    }
  );

  it('CP-S-003: la tabla de usuarios sigue intacta tras intentar eliminarla', async () => {
    await api.agente
      .post('/api/auth/login')
      .send({ correo: "'; DROP TABLE usuarios; --", password: "'; DROP TABLE usuarios; --" });

    const total = api.db.prepare('SELECT COUNT(*) AS total FROM usuarios').get().total;
    expect(total).toBe(1);
  });
});

describe('Inyeccion SQL en la creacion de tareas', () => {
  it.each(CARGAS_SQL)('CP-S-004: guarda la carga %s como texto literal', async (carga) => {
    const titulo = 'Tarea ' + carga;
    const respuesta = await api.agente
      .post('/api/tareas')
      .set('authorization', sesion.auth)
      .send({ titulo });

    expect(respuesta.status).toBe(201);
    // La tabla debe seguir existiendo y contener exactamente la tarea creada.
    const total = api.db.prepare('SELECT COUNT(*) AS total FROM tareas').get().total;
    expect(total).toBe(1);
  });

  it('CP-S-005: la tabla de tareas sobrevive a un intento de DROP TABLE', async () => {
    await api.agente
      .post('/api/tareas')
      .set('authorization', sesion.auth)
      .send({ titulo: "x'; DROP TABLE tareas; --" })
      .expect(201);

    const listado = await api.agente.get('/api/tareas').set('authorization', sesion.auth);
    expect(listado.status).toBe(200);
    expect(listado.body.tareas).toHaveLength(1);
  });

  it('CP-S-006: un intento de UPDATE masivo no altera otras tareas', async () => {
    const intacta = await crearTarea(api.agente, sesion.auth, { titulo: 'Tarea legitima' });

    await api.agente
      .post('/api/tareas')
      .set('authorization', sesion.auth)
      .send({ titulo: "x'; UPDATE tareas SET titulo='hackeado'; --" })
      .expect(201);

    const original = await api.agente
      .get('/api/tareas/' + intacta.id)
      .set('authorization', sesion.auth);

    expect(original.body.tarea.titulo).toBe('Tarea legitima');
  });
});

describe('Inyeccion SQL en los filtros de busqueda', () => {
  it.each(CARGAS_SQL)('CP-S-007: el filtro de busqueda %s no expone datos', async (carga) => {
    await crearTarea(api.agente, sesion.auth, { titulo: 'Tarea normal' });

    const respuesta = await api.agente
      .get('/api/tareas')
      .query({ busqueda: carga })
      .set('authorization', sesion.auth);

    expect(respuesta.status).toBe(200);
    // Ninguna carga debe actuar como comodin que devuelva todo.
    expect(respuesta.body.tareas).toHaveLength(0);
  });

  it('CP-S-008: un filtro de estado inyectado se rechaza por validacion', async () => {
    const respuesta = await api.agente
      .get('/api/tareas')
      .query({ estado: "pendiente' OR '1'='1" })
      .set('authorization', sesion.auth);

    expect(respuesta.status).toBe(422);
  });

  it('CP-S-009: una busqueda inyectada no revela tareas de otros usuarios', async () => {
    const otra = await registrarUsuario(api.agente, {
      nombre: 'Ana Lopez',
      correo: 'ana@test.com',
      password: 'otraclave456',
    });
    await crearTarea(api.agente, otra.auth, { titulo: 'Secreto de Ana' });

    const respuesta = await api.agente
      .get('/api/tareas')
      .query({ busqueda: "' OR 1=1 --" })
      .set('authorization', sesion.auth);

    expect(respuesta.body.tareas).toHaveLength(0);
  });
});

describe('Inyeccion SQL en los identificadores de ruta', () => {
  it.each(["1 OR 1=1", "1; DROP TABLE tareas", "1'--", "1 UNION SELECT 1"])(
    'CP-S-010: el identificador %s se rechaza con 400 y no se ejecuta',
    async (id) => {
      await crearTarea(api.agente, sesion.auth, { titulo: 'Tarea protegida' });

      const respuesta = await api.agente
        .get('/api/tareas/' + encodeURIComponent(id))
        .set('authorization', sesion.auth);

      expect(respuesta.status).toBe(400);

      const total = api.db.prepare('SELECT COUNT(*) AS total FROM tareas').get().total;
      expect(total).toBe(1);
    }
  );
});

describe('Exposicion de informacion sensible', () => {
  it('los mensajes de error no revelan detalles de SQL ni rutas internas', async () => {
    const respuesta = await api.agente
      .post('/api/tareas')
      .set('authorization', sesion.auth)
      .send({ titulo: "'; SELECT * FROM sesiones; --", estado: 'invalido' });

    const texto = JSON.stringify(respuesta.body).toLowerCase();
    expect(texto).not.toContain('sqlite');
    expect(texto).not.toContain('select');
    expect(texto).not.toContain('node_modules');
  });

  it('la API nunca devuelve el token de sesion de otro usuario', async () => {
    const otra = await registrarUsuario(api.agente, {
      nombre: 'Ana Lopez',
      correo: 'ana@test.com',
      password: 'otraclave456',
    });

    const respuesta = await api.agente.get('/api/tareas').set('authorization', sesion.auth);
    expect(JSON.stringify(respuesta.body)).not.toContain(otra.token);
  });
});
