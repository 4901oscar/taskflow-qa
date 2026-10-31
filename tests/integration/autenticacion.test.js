/**
 * Pruebas de integracion del modulo de autenticacion (CP-I-001 a CP-I-016).
 * Recorren la cadena completa: ruta HTTP -> servicio -> repositorio -> SQLite.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { crearApiDePrueba, USUARIO_VALIDO, registrarUsuario } from '../ayudas/servidor.js';

let api;

beforeEach(() => {
  api = crearApiDePrueba();
});

describe('POST /api/auth/registro', () => {
  it('CP-I-001: registra un usuario y devuelve su token de sesion', async () => {
    const respuesta = await api.agente.post('/api/auth/registro').send(USUARIO_VALIDO);

    expect(respuesta.status).toBe(201);
    expect(respuesta.body.usuario).toMatchObject({
      nombre: 'Oscar Rivera',
      correo: 'oscar@test.com',
    });
    expect(respuesta.body.token).toMatch(/^[0-9a-f]{64}$/);
  });

  it('CP-I-002: nunca devuelve la contrasena ni su hash en la respuesta', async () => {
    const respuesta = await api.agente.post('/api/auth/registro').send(USUARIO_VALIDO);
    const texto = JSON.stringify(respuesta.body);
    expect(texto).not.toContain('secreta123');
    expect(texto).not.toContain('password');
  });

  it('CP-I-003: persiste la contrasena unicamente como hash', async () => {
    await api.agente.post('/api/auth/registro').send(USUARIO_VALIDO);
    const fila = api.db.prepare('SELECT password_hash FROM usuarios WHERE correo = ?').get(
      'oscar@test.com'
    );
    expect(fila.password_hash).not.toContain('secreta123');
    expect(fila.password_hash).toMatch(/^[0-9a-f]{32}:[0-9a-f]{128}$/);
  });

  it('CP-I-004: rechaza un correo ya registrado con codigo 409', async () => {
    await api.agente.post('/api/auth/registro').send(USUARIO_VALIDO).expect(201);
    const respuesta = await api.agente.post('/api/auth/registro').send(USUARIO_VALIDO);

    expect(respuesta.status).toBe(409);
    expect(respuesta.body.mensaje).toMatch(/ya existe/i);
  });

  it('CP-I-005: trata el correo sin distinguir mayusculas al detectar duplicados', async () => {
    await api.agente.post('/api/auth/registro').send(USUARIO_VALIDO).expect(201);
    const respuesta = await api.agente
      .post('/api/auth/registro')
      .send({ ...USUARIO_VALIDO, correo: 'OSCAR@TEST.COM' });

    expect(respuesta.status).toBe(409);
  });

  it('CP-I-006: rechaza datos invalidos con codigo 422 y detalle por campo', async () => {
    const respuesta = await api.agente
      .post('/api/auth/registro')
      .send({ nombre: '', correo: 'no-es-correo', password: '123' });

    expect(respuesta.status).toBe(422);
    const campos = new Set(respuesta.body.errores.map((e) => e.campo));
    expect(campos).toEqual(new Set(['nombre', 'correo', 'password']));
  });

  it('CP-I-007: rechaza un cuerpo vacio', async () => {
    const respuesta = await api.agente.post('/api/auth/registro').send({});
    expect(respuesta.status).toBe(422);
  });
});

describe('POST /api/auth/login', () => {
  it('CP-I-008: inicia sesion con credenciales correctas', async () => {
    await registrarUsuario(api.agente);
    const respuesta = await api.agente
      .post('/api/auth/login')
      .send({ correo: USUARIO_VALIDO.correo, password: USUARIO_VALIDO.password });

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.token).toMatch(/^[0-9a-f]{64}$/);
    expect(respuesta.body.usuario.correo).toBe('oscar@test.com');
  });

  it('CP-I-009: acepta el correo escrito en mayusculas', async () => {
    await registrarUsuario(api.agente);
    const respuesta = await api.agente
      .post('/api/auth/login')
      .send({ correo: 'OSCAR@TEST.COM', password: USUARIO_VALIDO.password });

    expect(respuesta.status).toBe(200);
  });

  it('CP-I-010: rechaza una contrasena incorrecta con codigo 401', async () => {
    await registrarUsuario(api.agente);
    const respuesta = await api.agente
      .post('/api/auth/login')
      .send({ correo: USUARIO_VALIDO.correo, password: 'incorrecta999' });

    expect(respuesta.status).toBe(401);
  });

  it('CP-I-011: devuelve el mismo mensaje para usuario inexistente y contrasena mala', async () => {
    await registrarUsuario(api.agente);

    const noExiste = await api.agente
      .post('/api/auth/login')
      .send({ correo: 'nadie@test.com', password: 'cualquiera1' });
    const malaClave = await api.agente
      .post('/api/auth/login')
      .send({ correo: USUARIO_VALIDO.correo, password: 'incorrecta999' });

    // No se debe poder deducir que correos estan registrados.
    expect(noExiste.status).toBe(malaClave.status);
    expect(noExiste.body.mensaje).toBe(malaClave.body.mensaje);
  });

  it('CP-I-012: emite un token distinto en cada inicio de sesion', async () => {
    await registrarUsuario(api.agente);
    const credenciales = { correo: USUARIO_VALIDO.correo, password: USUARIO_VALIDO.password };

    const primera = await api.agente.post('/api/auth/login').send(credenciales).expect(200);
    const segunda = await api.agente.post('/api/auth/login').send(credenciales).expect(200);

    expect(primera.body.token).not.toBe(segunda.body.token);
  });

  it('CP-I-013: bloquea con codigo 429 tras exceder los intentos permitidos', async () => {
    const limitada = crearApiDePrueba({ limiteLogin: 3 });
    await registrarUsuario(limitada.agente);

    const malas = { correo: USUARIO_VALIDO.correo, password: 'incorrecta999' };
    for (let intento = 0; intento < 3; intento += 1) {
      await limitada.agente.post('/api/auth/login').send(malas).expect(401);
    }

    const bloqueada = await limitada.agente.post('/api/auth/login').send(malas);
    expect(bloqueada.status).toBe(429);
    expect(bloqueada.body.mensaje).toMatch(/demasiados intentos/i);
  });
});

describe('GET /api/auth/yo', () => {
  it('CP-I-014: devuelve el usuario de la sesion activa', async () => {
    const sesion = await registrarUsuario(api.agente);
    const respuesta = await api.agente.get('/api/auth/yo').set('authorization', sesion.auth);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.usuario.correo).toBe('oscar@test.com');
  });

  it('CP-I-015: rechaza la peticion sin token con codigo 401', async () => {
    const respuesta = await api.agente.get('/api/auth/yo');
    expect(respuesta.status).toBe(401);
  });

  it.each([
    ['token inexistente', 'Bearer 00000000000000000000000000000000'],
    ['esquema incorrecto', 'Basic abc123'],
    ['cabecera vacia', ''],
    ['solo el esquema', 'Bearer'],
  ])('rechaza la autorizacion con %s', async (_caso, cabecera) => {
    const respuesta = await api.agente.get('/api/auth/yo').set('authorization', cabecera);
    expect(respuesta.status).toBe(401);
  });
});

describe('POST /api/auth/logout', () => {
  it('CP-I-016: invalida el token de forma que deja de servir', async () => {
    const sesion = await registrarUsuario(api.agente);

    await api.agente.post('/api/auth/logout').set('authorization', sesion.auth).expect(204);
    const despues = await api.agente.get('/api/auth/yo').set('authorization', sesion.auth);

    expect(despues.status).toBe(401);
  });

  it('no afecta las demas sesiones del mismo usuario', async () => {
    await registrarUsuario(api.agente);
    const credenciales = { correo: USUARIO_VALIDO.correo, password: USUARIO_VALIDO.password };
    const sesionA = await api.agente.post('/api/auth/login').send(credenciales).expect(200);
    const sesionB = await api.agente.post('/api/auth/login').send(credenciales).expect(200);

    await api.agente
      .post('/api/auth/logout')
      .set('authorization', 'Bearer ' + sesionA.body.token)
      .expect(204);

    await api.agente
      .get('/api/auth/yo')
      .set('authorization', 'Bearer ' + sesionB.body.token)
      .expect(200);
  });
});

describe('Rutas tecnicas', () => {
  it('GET /api/salud responde que el servicio esta operativo', async () => {
    const respuesta = await api.agente.get('/api/salud');
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.estado).toBe('ok');
  });

  it('GET /api/catalogos expone los estados y prioridades validos', async () => {
    const respuesta = await api.agente.get('/api/catalogos');
    expect(respuesta.body.estados).toEqual(['pendiente', 'en_progreso', 'completada']);
    expect(respuesta.body.prioridades).toEqual(['baja', 'media', 'alta']);
  });

  it('una ruta de API inexistente devuelve 404 en formato JSON', async () => {
    const respuesta = await api.agente.get('/api/no-existe');
    expect(respuesta.status).toBe(404);
    expect(respuesta.body.mensaje).toBeDefined();
  });

  it('un cuerpo JSON mal formado devuelve 400 y no 500', async () => {
    const respuesta = await api.agente
      .post('/api/auth/login')
      .set('content-type', 'application/json')
      .send('{"correo": ');

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.mensaje).toMatch(/JSON/i);
  });
});
