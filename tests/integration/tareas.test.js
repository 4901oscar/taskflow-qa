/**
 * Pruebas de integracion del modulo de tareas (CP-I-017 a CP-I-045).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  crearApiDePrueba,
  registrarUsuario,
  crearTarea,
  idsDeColumna,
  OTRO_USUARIO,
} from '../ayudas/servidor.js';

let api;
let sesion;

beforeEach(async () => {
  api = crearApiDePrueba();
  sesion = await registrarUsuario(api.agente);
});

describe('POST /api/tareas', () => {
  it('CP-I-017: crea una tarea con los valores por defecto', async () => {
    const respuesta = await api.agente
      .post('/api/tareas')
      .set('authorization', sesion.auth)
      .send({ titulo: 'Redactar el plan de pruebas' });

    expect(respuesta.status).toBe(201);
    expect(respuesta.body.tarea).toMatchObject({
      titulo: 'Redactar el plan de pruebas',
      estado: 'pendiente',
      prioridad: 'media',
      descripcion: '',
      posicion: 0,
    });
    expect(respuesta.body.tarea.id).toBeGreaterThan(0);
  });

  it('CP-I-018: crea una tarea con todos los campos', async () => {
    const respuesta = await api.agente
      .post('/api/tareas')
      .set('authorization', sesion.auth)
      .send({
        titulo: 'Ejecutar pruebas de carga',
        descripcion: 'Simular 50 usuarios concurrentes',
        estado: 'en_progreso',
        prioridad: 'alta',
        fechaVencimiento: '2026-12-01',
      });

    expect(respuesta.status).toBe(201);
    expect(respuesta.body.tarea).toMatchObject({
      estado: 'en_progreso',
      prioridad: 'alta',
      fechaVencimiento: '2026-12-01',
    });
  });

  it('CP-I-019: rechaza una tarea con titulo vacio y devuelve 422', async () => {
    const respuesta = await api.agente
      .post('/api/tareas')
      .set('authorization', sesion.auth)
      .send({ titulo: '' });

    expect(respuesta.status).toBe(422);
    expect(respuesta.body.errores[0].campo).toBe('titulo');
  });

  it('CP-I-020: rechaza un titulo que solo contiene espacios', async () => {
    const respuesta = await api.agente
      .post('/api/tareas')
      .set('authorization', sesion.auth)
      .send({ titulo: '        ' });

    expect(respuesta.status).toBe(422);
  });

  it('CP-I-021: rechaza un estado fuera del catalogo', async () => {
    const respuesta = await api.agente
      .post('/api/tareas')
      .set('authorization', sesion.auth)
      .send({ titulo: 'Tarea valida', estado: 'archivada' });

    expect(respuesta.status).toBe(422);
    expect(respuesta.body.errores[0].campo).toBe('estado');
  });

  it('CP-I-022: rechaza una fecha de vencimiento mal formada', async () => {
    const respuesta = await api.agente
      .post('/api/tareas')
      .set('authorization', sesion.auth)
      .send({ titulo: 'Tarea valida', fechaVencimiento: '01/12/2026' });

    expect(respuesta.status).toBe(422);
    expect(respuesta.body.errores[0].campo).toBe('fechaVencimiento');
  });

  it('CP-I-023: normaliza los espacios sobrantes del titulo', async () => {
    const respuesta = await api.agente
      .post('/api/tareas')
      .set('authorization', sesion.auth)
      .send({ titulo: '   Revisar    el   informe   ' });

    expect(respuesta.body.tarea.titulo).toBe('Revisar el informe');
  });

  it('CP-I-024: asigna posiciones consecutivas dentro de la misma columna', async () => {
    const primera = await crearTarea(api.agente, sesion.auth, { titulo: 'Primera tarea' });
    const segunda = await crearTarea(api.agente, sesion.auth, { titulo: 'Segunda tarea' });
    const tercera = await crearTarea(api.agente, sesion.auth, { titulo: 'Tercera tarea' });

    expect([primera.posicion, segunda.posicion, tercera.posicion]).toEqual([0, 1, 2]);
  });

  it('CP-I-025: exige autenticacion', async () => {
    const respuesta = await api.agente.post('/api/tareas').send({ titulo: 'Sin sesion' });
    expect(respuesta.status).toBe(401);
  });
});

describe('GET /api/tareas', () => {
  it('CP-I-026: devuelve una lista vacia para un usuario nuevo', async () => {
    const respuesta = await api.agente.get('/api/tareas').set('authorization', sesion.auth);
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.tareas).toEqual([]);
  });

  it('CP-I-027: devuelve todas las tareas del usuario', async () => {
    await crearTarea(api.agente, sesion.auth, { titulo: 'Tarea uno' });
    await crearTarea(api.agente, sesion.auth, { titulo: 'Tarea dos' });

    const respuesta = await api.agente.get('/api/tareas').set('authorization', sesion.auth);
    expect(respuesta.body.tareas).toHaveLength(2);
  });

  it('CP-I-028: filtra por estado', async () => {
    await crearTarea(api.agente, sesion.auth, { titulo: 'Pendiente uno' });
    await crearTarea(api.agente, sesion.auth, {
      titulo: 'En curso uno',
      estado: 'en_progreso',
    });

    const respuesta = await api.agente
      .get('/api/tareas?estado=en_progreso')
      .set('authorization', sesion.auth);

    expect(respuesta.body.tareas).toHaveLength(1);
    expect(respuesta.body.tareas[0].titulo).toBe('En curso uno');
  });

  it('CP-I-029: filtra por prioridad', async () => {
    await crearTarea(api.agente, sesion.auth, { titulo: 'Urgente', prioridad: 'alta' });
    await crearTarea(api.agente, sesion.auth, { titulo: 'Tranquila', prioridad: 'baja' });

    const respuesta = await api.agente
      .get('/api/tareas?prioridad=alta')
      .set('authorization', sesion.auth);

    expect(respuesta.body.tareas).toHaveLength(1);
    expect(respuesta.body.tareas[0].titulo).toBe('Urgente');
  });

  it('CP-I-030: busca por texto en titulo y descripcion', async () => {
    await crearTarea(api.agente, sesion.auth, { titulo: 'Preparar informe mensual' });
    await crearTarea(api.agente, sesion.auth, {
      titulo: 'Reunion de equipo',
      descripcion: 'Revisar el informe con el equipo',
    });
    await crearTarea(api.agente, sesion.auth, { titulo: 'Comprar cafe' });

    const respuesta = await api.agente
      .get('/api/tareas?busqueda=informe')
      .set('authorization', sesion.auth);

    expect(respuesta.body.tareas).toHaveLength(2);
  });

  it('CP-I-031: rechaza un filtro de estado invalido', async () => {
    const respuesta = await api.agente
      .get('/api/tareas?estado=inventado')
      .set('authorization', sesion.auth);

    expect(respuesta.status).toBe(422);
  });

  it('GET /api/tareas/resumen devuelve el conteo por columna', async () => {
    await crearTarea(api.agente, sesion.auth, { titulo: 'Pendiente uno' });
    await crearTarea(api.agente, sesion.auth, { titulo: 'Curso uno', estado: 'en_progreso' });
    await crearTarea(api.agente, sesion.auth, { titulo: 'Curso dos', estado: 'en_progreso' });

    const respuesta = await api.agente
      .get('/api/tareas/resumen')
      .set('authorization', sesion.auth);

    expect(respuesta.body).toEqual({
      total: 3,
      porEstado: { pendiente: 1, en_progreso: 2, completada: 0 },
    });
  });
});

describe('GET /api/tareas/:id', () => {
  it('CP-I-032: devuelve una tarea existente', async () => {
    const tarea = await crearTarea(api.agente, sesion.auth, { titulo: 'Tarea buscada' });
    const respuesta = await api.agente
      .get('/api/tareas/' + tarea.id)
      .set('authorization', sesion.auth);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.tarea.titulo).toBe('Tarea buscada');
  });

  it('CP-I-033: devuelve 404 para una tarea inexistente', async () => {
    const respuesta = await api.agente.get('/api/tareas/9999').set('authorization', sesion.auth);
    expect(respuesta.status).toBe(404);
  });

  it.each(['abc', '0', '-1', '1.5'])(
    'CP-I-034: devuelve 400 para el identificador invalido %s',
    async (id) => {
      const respuesta = await api.agente
        .get('/api/tareas/' + id)
        .set('authorization', sesion.auth);
      expect(respuesta.status).toBe(400);
    }
  );
});

describe('PUT /api/tareas/:id', () => {
  it('CP-I-035: edita el titulo de una tarea', async () => {
    const tarea = await crearTarea(api.agente, sesion.auth, { titulo: 'Titulo original' });
    const respuesta = await api.agente
      .put('/api/tareas/' + tarea.id)
      .set('authorization', sesion.auth)
      .send({ titulo: 'Titulo corregido' });

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.tarea.titulo).toBe('Titulo corregido');
  });

  it('CP-I-036: permite una edicion parcial sin perder los demas campos', async () => {
    const tarea = await crearTarea(api.agente, sesion.auth, {
      titulo: 'Tarea completa',
      descripcion: 'Descripcion que debe sobrevivir',
      prioridad: 'alta',
    });

    const respuesta = await api.agente
      .put('/api/tareas/' + tarea.id)
      .set('authorization', sesion.auth)
      .send({ estado: 'completada' });

    expect(respuesta.body.tarea).toMatchObject({
      titulo: 'Tarea completa',
      descripcion: 'Descripcion que debe sobrevivir',
      prioridad: 'alta',
      estado: 'completada',
    });
  });

  it('CP-I-037: rechaza una edicion que dejaria el titulo vacio', async () => {
    const tarea = await crearTarea(api.agente, sesion.auth, { titulo: 'Titulo valido' });
    const respuesta = await api.agente
      .put('/api/tareas/' + tarea.id)
      .set('authorization', sesion.auth)
      .send({ titulo: '   ' });

    expect(respuesta.status).toBe(422);
  });

  it('CP-I-038: al cambiar de columna coloca la tarea al final de la nueva', async () => {
    await crearTarea(api.agente, sesion.auth, { titulo: 'Curso uno', estado: 'en_progreso' });
    await crearTarea(api.agente, sesion.auth, { titulo: 'Curso dos', estado: 'en_progreso' });
    const movida = await crearTarea(api.agente, sesion.auth, { titulo: 'Pendiente que se mueve' });

    const respuesta = await api.agente
      .put('/api/tareas/' + movida.id)
      .set('authorization', sesion.auth)
      .send({ estado: 'en_progreso' });

    expect(respuesta.body.tarea.posicion).toBe(2);
  });

  it('CP-I-039: devuelve 404 al editar una tarea inexistente', async () => {
    const respuesta = await api.agente
      .put('/api/tareas/9999')
      .set('authorization', sesion.auth)
      .send({ titulo: 'Nuevo titulo' });

    expect(respuesta.status).toBe(404);
  });

  it('actualiza la marca de tiempo de modificacion', async () => {
    const tarea = await crearTarea(api.agente, sesion.auth, { titulo: 'Tarea con marca' });
    const respuesta = await api.agente
      .put('/api/tareas/' + tarea.id)
      .set('authorization', sesion.auth)
      .send({ titulo: 'Tarea con marca nueva' });

    expect(respuesta.body.tarea.actualizadaEn).toBeDefined();
  });

  it('permite limpiar la fecha de vencimiento enviando cadena vacia', async () => {
    const tarea = await crearTarea(api.agente, sesion.auth, {
      titulo: 'Tarea con fecha',
      fechaVencimiento: '2026-12-01',
    });

    const respuesta = await api.agente
      .put('/api/tareas/' + tarea.id)
      .set('authorization', sesion.auth)
      .send({ fechaVencimiento: '' });

    expect(respuesta.body.tarea.fechaVencimiento).toBeNull();
  });
});

describe('PATCH /api/tareas/:id/mover', () => {
  it('CP-I-040: mueve una tarea a otra columna y devuelve el tablero completo', async () => {
    const tarea = await crearTarea(api.agente, sesion.auth, { titulo: 'Tarea que se mueve' });

    const respuesta = await api.agente
      .patch('/api/tareas/' + tarea.id + '/mover')
      .set('authorization', sesion.auth)
      .send({ estado: 'completada', posicion: 0 });

    expect(respuesta.status).toBe(200);
    expect(idsDeColumna(respuesta.body.tareas, 'completada')).toEqual([tarea.id]);
    expect(idsDeColumna(respuesta.body.tareas, 'pendiente')).toEqual([]);
  });

  it('CP-I-041: reordena las tareas dentro de la misma columna', async () => {
    const a = await crearTarea(api.agente, sesion.auth, { titulo: 'Tarea A' });
    const b = await crearTarea(api.agente, sesion.auth, { titulo: 'Tarea B' });
    const c = await crearTarea(api.agente, sesion.auth, { titulo: 'Tarea C' });

    const respuesta = await api.agente
      .patch('/api/tareas/' + c.id + '/mover')
      .set('authorization', sesion.auth)
      .send({ estado: 'pendiente', posicion: 0 });

    expect(idsDeColumna(respuesta.body.tareas, 'pendiente')).toEqual([c.id, a.id, b.id]);
  });

  it('CP-I-042: compacta la columna de origen sin dejar huecos', async () => {
    const a = await crearTarea(api.agente, sesion.auth, { titulo: 'Tarea A' });
    const b = await crearTarea(api.agente, sesion.auth, { titulo: 'Tarea B' });
    const c = await crearTarea(api.agente, sesion.auth, { titulo: 'Tarea C' });

    const respuesta = await api.agente
      .patch('/api/tareas/' + a.id + '/mover')
      .set('authorization', sesion.auth)
      .send({ estado: 'en_progreso', posicion: 0 });

    const pendientes = respuesta.body.tareas
      .filter((t) => t.estado === 'pendiente')
      .sort((x, y) => x.posicion - y.posicion);

    expect(pendientes.map((t) => t.id)).toEqual([b.id, c.id]);
    expect(pendientes.map((t) => t.posicion)).toEqual([0, 1]);
  });

  it('CP-I-043: rechaza un estado destino invalido', async () => {
    const tarea = await crearTarea(api.agente, sesion.auth, { titulo: 'Tarea valida' });
    const respuesta = await api.agente
      .patch('/api/tareas/' + tarea.id + '/mover')
      .set('authorization', sesion.auth)
      .send({ estado: 'archivada', posicion: 0 });

    expect(respuesta.status).toBe(422);
  });

  it('CP-I-044: devuelve 404 al mover una tarea inexistente', async () => {
    const respuesta = await api.agente
      .patch('/api/tareas/9999/mover')
      .set('authorization', sesion.auth)
      .send({ estado: 'completada', posicion: 0 });

    expect(respuesta.status).toBe(404);
  });

  it('acota una posicion mayor que el tamano de la columna destino', async () => {
    const tarea = await crearTarea(api.agente, sesion.auth, { titulo: 'Tarea unica' });
    const respuesta = await api.agente
      .patch('/api/tareas/' + tarea.id + '/mover')
      .set('authorization', sesion.auth)
      .send({ estado: 'completada', posicion: 99 });

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.tareas[0].posicion).toBe(0);
  });
});

describe('DELETE /api/tareas/:id', () => {
  it('CP-I-045: elimina una tarea existente', async () => {
    const tarea = await crearTarea(api.agente, sesion.auth, { titulo: 'Tarea a eliminar' });

    await api.agente
      .delete('/api/tareas/' + tarea.id)
      .set('authorization', sesion.auth)
      .expect(204);

    const listado = await api.agente.get('/api/tareas').set('authorization', sesion.auth);
    expect(listado.body.tareas).toHaveLength(0);
  });

  it('devuelve 404 al eliminar una tarea inexistente', async () => {
    const respuesta = await api.agente
      .delete('/api/tareas/9999')
      .set('authorization', sesion.auth);
    expect(respuesta.status).toBe(404);
  });

  it('eliminar dos veces la misma tarea devuelve 404 la segunda vez', async () => {
    const tarea = await crearTarea(api.agente, sesion.auth, { titulo: 'Tarea a eliminar' });
    await api.agente
      .delete('/api/tareas/' + tarea.id)
      .set('authorization', sesion.auth)
      .expect(204);
    await api.agente
      .delete('/api/tareas/' + tarea.id)
      .set('authorization', sesion.auth)
      .expect(404);
  });
});

describe('Aislamiento entre usuarios', () => {
  it('CP-I-046: un usuario no ve las tareas de otro', async () => {
    await crearTarea(api.agente, sesion.auth, { titulo: 'Tarea privada de Oscar' });
    const otra = await registrarUsuario(api.agente, OTRO_USUARIO);

    const respuesta = await api.agente.get('/api/tareas').set('authorization', otra.auth);
    expect(respuesta.body.tareas).toEqual([]);
  });

  it('CP-I-047: un usuario no puede leer una tarea ajena por su id', async () => {
    const tarea = await crearTarea(api.agente, sesion.auth, { titulo: 'Tarea privada' });
    const otra = await registrarUsuario(api.agente, OTRO_USUARIO);

    const respuesta = await api.agente
      .get('/api/tareas/' + tarea.id)
      .set('authorization', otra.auth);

    expect(respuesta.status).toBe(404);
  });

  it('CP-I-048: un usuario no puede editar una tarea ajena', async () => {
    const tarea = await crearTarea(api.agente, sesion.auth, { titulo: 'Tarea privada' });
    const otra = await registrarUsuario(api.agente, OTRO_USUARIO);

    const respuesta = await api.agente
      .put('/api/tareas/' + tarea.id)
      .set('authorization', otra.auth)
      .send({ titulo: 'Titulo secuestrado' });

    expect(respuesta.status).toBe(404);

    // La tarea original debe permanecer intacta.
    const original = await api.agente
      .get('/api/tareas/' + tarea.id)
      .set('authorization', sesion.auth);
    expect(original.body.tarea.titulo).toBe('Tarea privada');
  });

  it('CP-I-049: un usuario no puede eliminar una tarea ajena', async () => {
    const tarea = await crearTarea(api.agente, sesion.auth, { titulo: 'Tarea privada' });
    const otra = await registrarUsuario(api.agente, OTRO_USUARIO);

    await api.agente
      .delete('/api/tareas/' + tarea.id)
      .set('authorization', otra.auth)
      .expect(404);

    await api.agente
      .get('/api/tareas/' + tarea.id)
      .set('authorization', sesion.auth)
      .expect(200);
  });

  it('CP-I-050: un usuario no puede mover una tarea ajena', async () => {
    const tarea = await crearTarea(api.agente, sesion.auth, { titulo: 'Tarea privada' });
    const otra = await registrarUsuario(api.agente, OTRO_USUARIO);

    const respuesta = await api.agente
      .patch('/api/tareas/' + tarea.id + '/mover')
      .set('authorization', otra.auth)
      .send({ estado: 'completada', posicion: 0 });

    expect(respuesta.status).toBe(404);
  });

  it('las posiciones se cuentan por usuario, no de forma global', async () => {
    await crearTarea(api.agente, sesion.auth, { titulo: 'Tarea de Oscar' });
    const otra = await registrarUsuario(api.agente, OTRO_USUARIO);
    const tareaDeAna = await crearTarea(api.agente, otra.auth, { titulo: 'Tarea de Ana' });

    expect(tareaDeAna.posicion).toBe(0);
  });
});
