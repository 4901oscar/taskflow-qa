/**
 * Pruebas de seguridad: XSS, cabeceras de proteccion y control de acceso
 * (CP-S-011 a CP-S-025).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { crearApiDePrueba, registrarUsuario, crearTarea } from '../ayudas/servidor.js';

/** Cargas tipicas de XSS. */
const CARGAS_XSS = [
  '<script>alert(1)</script>',
  '<img src=x onerror=alert(1)>',
  '<svg/onload=alert(1)>',
  '"><script>alert(document.cookie)</script>',
  "<iframe src=javascript:alert(1)>",
  '<body onload=alert(1)>',
  '<a href="javascript:alert(1)">clic</a>',
];

let api;
let sesion;

beforeEach(async () => {
  api = crearApiDePrueba();
  sesion = await registrarUsuario(api.agente);
});

/**
 * Estrategia frente a XSS tras corregir DEF-001.
 *
 * El escapado de HTML se movio de la entrada a la salida. Por lo tanto la API
 * almacena y devuelve el texto tal como lo escribio el usuario, y lo que estas
 * pruebas verifican en el servidor es que:
 *   1. el dato viaja intacto (sin doble codificacion),
 *   2. la respuesta se sirve como JSON y nunca como HTML interpretable,
 *   3. la cabecera CSP impide la ejecucion de scripts en linea.
 * Que la carga no se ejecute al renderizarla se comprueba en el navegador:
 * ver CP-E-041 a CP-E-043 en tests/e2e/seguridad.spec.js.
 */
describe('XSS almacenado: integridad del dato', () => {
  it.each(CARGAS_XSS)('CP-S-011: almacena la carga %s sin alterarla', async (carga) => {
    const respuesta = await api.agente
      .post('/api/tareas')
      .set('authorization', sesion.auth)
      .send({ titulo: carga });

    expect(respuesta.status).toBe(201);
    // Regresion de DEF-001: ni se escapa ni se codifica dos veces.
    expect(respuesta.body.tarea.titulo).toBe(carga);
    expect(respuesta.body.tarea.titulo).not.toContain('&lt;');
    expect(respuesta.body.tarea.titulo).not.toContain('&amp;');
  });

  it('CP-S-012: la base de datos guarda exactamente el texto recibido', async () => {
    const carga = '<script>alert(1)</script>';
    await api.agente
      .post('/api/tareas')
      .set('authorization', sesion.auth)
      .send({ titulo: carga })
      .expect(201);

    const fila = api.db.prepare('SELECT titulo FROM tareas LIMIT 1').get();
    expect(fila.titulo).toBe(carga);
  });

  it.each(CARGAS_XSS)('CP-S-013: conserva la carga %s en la descripcion', async (carga) => {
    const respuesta = await api.agente
      .post('/api/tareas')
      .set('authorization', sesion.auth)
      .send({ titulo: 'Tarea con descripcion', descripcion: carga });

    expect(respuesta.body.tarea.descripcion).toBe(carga);
  });

  it('CP-S-014: conserva el texto al editar una tarea existente', async () => {
    const tarea = await crearTarea(api.agente, sesion.auth, { titulo: 'Titulo limpio' });
    const carga = '<script>alert(1)</script>';

    const respuesta = await api.agente
      .put('/api/tareas/' + tarea.id)
      .set('authorization', sesion.auth)
      .send({ titulo: carga });

    expect(respuesta.body.tarea.titulo).toBe(carga);
  });

  it('CP-S-015: conserva el nombre de usuario tal como se escribio', async () => {
    const respuesta = await api.agente.post('/api/auth/registro').send({
      nombre: "Oscar O'Brien & Asociados",
      correo: 'xss@test.com',
      password: 'secreta123',
    });

    expect(respuesta.status).toBe(201);
    expect(respuesta.body.usuario.nombre).toBe("Oscar O'Brien & Asociados");
  });

  it('CP-S-016: elimina los caracteres de control de la entrada', async () => {
    const respuesta = await api.agente
      .post('/api/tareas')
      .set('authorization', sesion.auth)
      .send({ titulo: 'Tarea\u0000con\u001Fcontrol' });

    expect(respuesta.body.tarea.titulo).not.toMatch(/[\u0000-\u001F\u007F]/);
    expect(respuesta.body.tarea.titulo).toBe('Tareaconcontrol');
  });

  it.each(CARGAS_XSS)(
    'CP-S-016b: la respuesta que contiene la carga %s se sirve como JSON, no como HTML',
    async (carga) => {
      const respuesta = await api.agente
        .post('/api/tareas')
        .set('authorization', sesion.auth)
        .send({ titulo: carga });

      // Si se sirviera como text/html, el navegador podria interpretar la carga
      // al abrir la URL de la API directamente.
      expect(respuesta.headers['content-type']).toMatch(/application\/json/);
      expect(respuesta.headers['content-type']).not.toMatch(/text\/html/);
    }
  );
});

describe('Cabeceras de seguridad', () => {
  it('CP-S-017: envia X-Content-Type-Options para evitar el sniffing de MIME', async () => {
    const respuesta = await api.agente.get('/api/salud');
    expect(respuesta.headers['x-content-type-options']).toBe('nosniff');
  });

  it('CP-S-018: envia X-Frame-Options para evitar el clickjacking', async () => {
    const respuesta = await api.agente.get('/api/salud');
    expect(respuesta.headers['x-frame-options']).toBe('DENY');
  });

  it('CP-S-019: envia una politica de seguridad de contenido restrictiva', async () => {
    const respuesta = await api.agente.get('/api/salud');
    const csp = respuesta.headers['content-security-policy'];
    expect(csp).toContain("default-src 'self'");
    expect(csp).not.toContain('unsafe-inline');
    expect(csp).not.toContain('unsafe-eval');
  });

  it('CP-S-020: no revela la tecnologia del servidor en X-Powered-By', async () => {
    const respuesta = await api.agente.get('/api/salud');
    expect(respuesta.headers['x-powered-by']).toBeUndefined();
  });

  it('envia Referrer-Policy', async () => {
    const respuesta = await api.agente.get('/api/salud');
    expect(respuesta.headers['referrer-policy']).toBe('no-referrer');
  });
});

describe('Control de acceso', () => {
  it.each([
    ['GET', '/api/tareas'],
    ['POST', '/api/tareas'],
    ['GET', '/api/tareas/1'],
    ['PUT', '/api/tareas/1'],
    ['PATCH', '/api/tareas/1/mover'],
    ['DELETE', '/api/tareas/1'],
    ['GET', '/api/tareas/resumen'],
    ['GET', '/api/auth/yo'],
    ['POST', '/api/auth/logout'],
  ])('CP-S-021: %s %s exige autenticacion', async (metodo, ruta) => {
    const respuesta = await api.agente[metodo.toLowerCase()](ruta).send({});
    expect(respuesta.status).toBe(401);
  });

  it('CP-S-022: un token manipulado no concede acceso', async () => {
    const manipulado = sesion.token.slice(0, -1) + (sesion.token.endsWith('a') ? 'b' : 'a');
    const respuesta = await api.agente
      .get('/api/tareas')
      .set('authorization', 'Bearer ' + manipulado);

    expect(respuesta.status).toBe(401);
  });

  it('CP-S-023: un token revocado deja de funcionar de inmediato', async () => {
    await api.agente.post('/api/auth/logout').set('authorization', sesion.auth).expect(204);
    const respuesta = await api.agente.get('/api/tareas').set('authorization', sesion.auth);
    expect(respuesta.status).toBe(401);
  });

  it('CP-S-024: no se puede escalar privilegios enviando un id de usuario propio', async () => {
    const otra = await registrarUsuario(api.agente, {
      nombre: 'Ana Lopez',
      correo: 'ana@test.com',
      password: 'otraclave456',
    });
    const ajena = await crearTarea(api.agente, otra.auth, { titulo: 'Tarea de Ana' });

    // Se intenta forzar la propiedad usuarioId en el cuerpo de la peticion.
    const respuesta = await api.agente
      .put('/api/tareas/' + ajena.id)
      .set('authorization', sesion.auth)
      .send({ titulo: 'Secuestrada', usuarioId: otra.usuario.id });

    expect(respuesta.status).toBe(404);

    const sigueIgual = await api.agente
      .get('/api/tareas/' + ajena.id)
      .set('authorization', otra.auth);
    expect(sigueIgual.body.tarea.titulo).toBe('Tarea de Ana');
  });

  it('CP-S-025: rechaza un cuerpo de peticion excesivamente grande', async () => {
    const respuesta = await api.agente
      .post('/api/tareas')
      .set('authorization', sesion.auth)
      .set('content-type', 'application/json')
      .send(JSON.stringify({ titulo: 'x'.repeat(200_000) }));

    expect([413, 422]).toContain(respuesta.status);
  });

  it('no permite sobrescribir el id de la tarea desde el cuerpo', async () => {
    const tarea = await crearTarea(api.agente, sesion.auth, { titulo: 'Tarea original' });

    const respuesta = await api.agente
      .put('/api/tareas/' + tarea.id)
      .set('authorization', sesion.auth)
      .send({ titulo: 'Tarea editada', id: 9999 });

    expect(respuesta.body.tarea.id).toBe(tarea.id);
  });
});
