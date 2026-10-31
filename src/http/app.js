/**
 * Fabrica de la aplicacion Express.
 *
 * Recibe la base de datos por parametro para que las pruebas de integracion
 * puedan montar la API completa sobre una base en memoria, sin tocar los datos
 * reales ni abrir un puerto.
 */

import express from 'express';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { crearBaseDeDatos } from '../db/esquema.js';
import { crearUsuarioRepositorio } from '../repositories/usuarioRepositorio.js';
import { crearTareaRepositorio } from '../repositories/tareaRepositorio.js';
import { crearAutenticacionServicio } from '../services/autenticacionServicio.js';
import { crearTareaServicio } from '../services/tareaServicio.js';
import { crearLimitador } from './limitador.js';
import { ErrorDeAplicacion, noAutenticado } from '../errores.js';
import { ESTADOS, PRIORIDADES } from '../domain/constantes.js';

const DIRECTORIO = dirname(fileURLToPath(import.meta.url));
const PUBLICO = join(DIRECTORIO, '..', '..', 'public');

/**
 * @param {{db?: import('node:sqlite').DatabaseSync, limiteLogin?: number}} opciones
 */
export function crearApp({ db = crearBaseDeDatos(':memory:'), limiteLogin = 5 } = {}) {
  const usuarioRepositorio = crearUsuarioRepositorio(db);
  const tareaRepositorio = crearTareaRepositorio(db);
  const autenticacion = crearAutenticacionServicio(usuarioRepositorio);
  const tareas = crearTareaServicio(tareaRepositorio);
  const limitador = crearLimitador({ maximo: limiteLogin });

  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '64kb' }));

  // Cabeceras de seguridad basicas (verificadas en las pruebas de seguridad).
  app.use((peticion, respuesta, siguiente) => {
    respuesta.setHeader('X-Content-Type-Options', 'nosniff');
    respuesta.setHeader('X-Frame-Options', 'DENY');
    respuesta.setHeader('Referrer-Policy', 'no-referrer');
    respuesta.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; style-src 'self'; script-src 'self'; img-src 'self' data:"
    );
    siguiente();
  });

  /** Extrae el token del encabezado Authorization: Bearer <token>. */
  function tokenDePeticion(peticion) {
    const cabecera = peticion.get('authorization') ?? '';
    const [esquema, valor] = cabecera.split(' ');
    if (!esquema || esquema.toLowerCase() !== 'bearer' || !valor) return null;
    return valor.trim();
  }

  /** Middleware que exige sesion valida. */
  function requiereSesion(peticion, respuesta, siguiente) {
    try {
      const token = tokenDePeticion(peticion);
      if (!token) throw noAutenticado();
      peticion.usuario = autenticacion.usuarioDesdeToken(token);
      peticion.token = token;
      siguiente();
    } catch (error) {
      siguiente(error);
    }
  }

  /** Convierte un id de la ruta a entero, o null si no es valido. */
  function idDeRuta(valor) {
    const numero = Number(valor);
    return Number.isInteger(numero) && numero > 0 ? numero : null;
  }

  // ----------------------------- Rutas tecnicas -----------------------------

  app.get('/api/salud', (_peticion, respuesta) => {
    respuesta.json({ estado: 'ok', version: '1.0.0', marca: new Date().toISOString() });
  });

  app.get('/api/catalogos', (_peticion, respuesta) => {
    respuesta.json({ estados: ESTADOS, prioridades: PRIORIDADES });
  });

  // --------------------------- Rutas de autenticacion ---------------------------

  app.post('/api/auth/registro', async (peticion, respuesta, siguiente) => {
    try {
      const { usuario, token } = await autenticacion.registrar(peticion.body ?? {});
      respuesta.status(201).json({ usuario, token });
    } catch (error) {
      siguiente(error);
    }
  });

  app.post('/api/auth/login', async (peticion, respuesta, siguiente) => {
    const clave = String(peticion.ip) + ':' + String((peticion.body ?? {}).correo ?? '');
    try {
      const { bloqueado } = limitador.registrar(clave);
      if (bloqueado) {
        throw new ErrorDeAplicacion('Demasiados intentos. Intente de nuevo en un minuto', 429);
      }
      const { usuario, token } = await autenticacion.iniciarSesion(peticion.body ?? {});
      limitador.reiniciar(clave);
      respuesta.json({ usuario, token });
    } catch (error) {
      siguiente(error);
    }
  });

  app.post('/api/auth/logout', requiereSesion, (peticion, respuesta) => {
    autenticacion.cerrarSesion(peticion.token);
    respuesta.status(204).end();
  });

  app.get('/api/auth/yo', requiereSesion, (peticion, respuesta) => {
    respuesta.json({ usuario: peticion.usuario });
  });

  // ------------------------------ Rutas de tareas ------------------------------

  app.get('/api/tareas', requiereSesion, (peticion, respuesta, siguiente) => {
    try {
      respuesta.json({
        tareas: tareas.listar(peticion.usuario.id, {
          estado: peticion.query.estado,
          prioridad: peticion.query.prioridad,
          busqueda: peticion.query.busqueda,
        }),
      });
    } catch (error) {
      siguiente(error);
    }
  });

  app.get('/api/tareas/resumen', requiereSesion, (peticion, respuesta, siguiente) => {
    try {
      respuesta.json(tareas.resumen(peticion.usuario.id));
    } catch (error) {
      siguiente(error);
    }
  });

  app.post('/api/tareas', requiereSesion, (peticion, respuesta, siguiente) => {
    try {
      respuesta.status(201).json({ tarea: tareas.crear(peticion.usuario.id, peticion.body ?? {}) });
    } catch (error) {
      siguiente(error);
    }
  });

  app.get('/api/tareas/:id', requiereSesion, (peticion, respuesta, siguiente) => {
    try {
      const id = idDeRuta(peticion.params.id);
      if (id === null) throw new ErrorDeAplicacion('El identificador no es valido', 400);
      respuesta.json({ tarea: tareas.obtener(peticion.usuario.id, id) });
    } catch (error) {
      siguiente(error);
    }
  });

  app.put('/api/tareas/:id', requiereSesion, (peticion, respuesta, siguiente) => {
    try {
      const id = idDeRuta(peticion.params.id);
      if (id === null) throw new ErrorDeAplicacion('El identificador no es valido', 400);
      respuesta.json({
        tarea: tareas.actualizar(peticion.usuario.id, id, peticion.body ?? {}),
      });
    } catch (error) {
      siguiente(error);
    }
  });

  app.patch('/api/tareas/:id/mover', requiereSesion, (peticion, respuesta, siguiente) => {
    try {
      const id = idDeRuta(peticion.params.id);
      if (id === null) throw new ErrorDeAplicacion('El identificador no es valido', 400);
      const { estado, posicion } = peticion.body ?? {};
      respuesta.json({
        tareas: tareas.mover(peticion.usuario.id, id, estado, Number(posicion ?? 0)),
      });
    } catch (error) {
      siguiente(error);
    }
  });

  app.delete('/api/tareas/:id', requiereSesion, (peticion, respuesta, siguiente) => {
    try {
      const id = idDeRuta(peticion.params.id);
      if (id === null) throw new ErrorDeAplicacion('El identificador no es valido', 400);
      tareas.eliminar(peticion.usuario.id, id);
      respuesta.status(204).end();
    } catch (error) {
      siguiente(error);
    }
  });

  // --------------------------- Archivos estaticos ---------------------------

  app.use(express.static(PUBLICO));

  app.use('/api', (_peticion, respuesta) => {
    respuesta.status(404).json({ mensaje: 'Recurso no encontrado' });
  });

  // --------------------------- Manejo de errores ---------------------------

  app.use((error, _peticion, respuesta, _siguiente) => {
    if (error instanceof ErrorDeAplicacion) {
      return respuesta.status(error.estado).json({
        mensaje: error.message,
        errores: error.errores,
      });
    }
    if (error?.type === 'entity.parse.failed') {
      return respuesta.status(400).json({ mensaje: 'El cuerpo de la peticion no es JSON valido' });
    }
    if (error?.type === 'entity.too.large') {
      return respuesta.status(413).json({ mensaje: 'El cuerpo de la peticion es demasiado grande' });
    }
    // No se expone el detalle interno al cliente: se registra en el servidor.
    console.error('[error no controlado]', error);
    return respuesta.status(500).json({ mensaje: 'Error interno del servidor' });
  });

  app.locals.db = db;
  app.locals.servicios = { autenticacion, tareas };
  app.locals.limitador = limitador;

  return app;
}
