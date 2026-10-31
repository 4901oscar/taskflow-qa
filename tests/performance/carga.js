/**
 * Prueba de carga de TaskFlow.
 *
 * Simula usuarios concurrentes que ejecutan el flujo completo (registro,
 * creacion de tareas, consulta del tablero y movimiento de tareas) y reporta
 * los tiempos de respuesta por operacion.
 *
 * No requiere dependencias externas: arranca la aplicacion en un puerto libre,
 * usa fetch y reutiliza las funciones de metricas del dominio, las mismas que
 * estan cubiertas por pruebas unitarias.
 *
 * Uso:
 *   node tests/performance/carga.js
 *   USUARIOS=100 TAREAS=10 node tests/performance/carga.js
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { crearApp } from '../../src/http/app.js';
import { crearBaseDeDatos } from '../../src/db/esquema.js';
import { percentil } from '../../src/domain/metricas.js';

const USUARIOS = Number(process.env.USUARIOS ?? 50);
const TAREAS_POR_USUARIO = Number(process.env.TAREAS ?? 5);

/**
 * Operaciones que derivan una clave con scrypt. Su costo es intencional (es la
 * defensa contra fuerza bruta offline), por lo que se evaluan con un umbral
 * propio en lugar de mezclarlas con el resto del CRUD.
 */
const OPERACIONES_DE_AUTENTICACION = new Set(['registro', 'login']);

/**
 * Umbrales aceptados (criterios de salida del plan de pruebas).
 * Se separan por clase de operacion porque medir juntas el alta de usuarios y
 * la lectura del tablero daba un p95 global dominado por scrypt y ocultaba el
 * comportamiento real de la aplicacion.
 */
const UMBRALES = {
  crud: { p95Ms: 500, promedioMs: 200 },
  autenticacion: { p95Ms: 1500, promedioMs: 1000 },
  tasaErrorPorcentaje: 1,
};

/** Acumulador de mediciones por operacion. */
const mediciones = new Map();
let errores = 0;
let operaciones = 0;

/**
 * Ejecuta una peticion midiendo su duracion.
 * @returns {Promise<{ok:boolean, estado:number, cuerpo:any}>}
 */
async function medir(operacion, ejecutar) {
  const inicio = performance.now();
  let ok = false;
  let resultado = { ok: false, estado: 0, cuerpo: null };
  try {
    resultado = await ejecutar();
    ok = resultado.ok;
  } finally {
    const duracion = performance.now() - inicio;
    if (!mediciones.has(operacion)) mediciones.set(operacion, []);
    mediciones.get(operacion).push(duracion);
    operaciones += 1;
    if (!ok) errores += 1;
  }
  return resultado;
}

/** Envuelve fetch devolviendo estado y cuerpo ya interpretados. */
async function peticion(base, ruta, { metodo = 'GET', cuerpo = null, token = null } = {}) {
  const cabeceras = {};
  if (cuerpo) cabeceras['content-type'] = 'application/json';
  if (token) cabeceras.authorization = 'Bearer ' + token;

  const respuesta = await fetch(base + ruta, {
    method: metodo,
    headers: cabeceras,
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });

  const texto = await respuesta.text();
  let datos = null;
  try {
    datos = texto ? JSON.parse(texto) : null;
  } catch {
    datos = null;
  }
  return { ok: respuesta.ok, estado: respuesta.status, cuerpo: datos };
}

/** Recorrido completo de un usuario simulado. */
async function recorridoDeUsuario(base, indice) {
  const correo = 'carga-' + indice + '-' + Date.now() + '@test.com';

  const registro = await medir('registro', () =>
    peticion(base, '/api/auth/registro', {
      metodo: 'POST',
      cuerpo: { nombre: 'Usuario ' + indice, correo, password: 'secreta123' },
    })
  );
  if (!registro.ok) return;
  const token = registro.cuerpo.token;

  const creadas = [];
  for (let n = 0; n < TAREAS_POR_USUARIO; n += 1) {
    const creada = await medir('crear_tarea', () =>
      peticion(base, '/api/tareas', {
        metodo: 'POST',
        cuerpo: { titulo: 'Tarea ' + n + ' del usuario ' + indice, prioridad: 'media' },
        token,
      })
    );
    if (creada.ok) creadas.push(creada.cuerpo.tarea.id);
  }

  await medir('listar_tareas', () => peticion(base, '/api/tareas', { token }));
  await medir('resumen', () => peticion(base, '/api/tareas/resumen', { token }));

  if (creadas.length > 0) {
    await medir('mover_tarea', () =>
      peticion(base, '/api/tareas/' + creadas[0] + '/mover', {
        metodo: 'PATCH',
        cuerpo: { estado: 'en_progreso', posicion: 0 },
        token,
      })
    );
    await medir('editar_tarea', () =>
      peticion(base, '/api/tareas/' + creadas[0], {
        metodo: 'PUT',
        cuerpo: { titulo: 'Tarea editada del usuario ' + indice },
        token,
      })
    );
  }

  await medir('login', () =>
    peticion(base, '/api/auth/login', {
      metodo: 'POST',
      cuerpo: { correo, password: 'secreta123' },
    })
  );
}

/** Estadisticas de una serie de mediciones. */
function estadisticas(muestras) {
  const total = muestras.reduce((suma, valor) => suma + valor, 0);
  return {
    peticiones: muestras.length,
    promedioMs: Number((total / muestras.length).toFixed(2)),
    minMs: Number(Math.min(...muestras).toFixed(2)),
    p50Ms: Number(percentil(muestras, 50).toFixed(2)),
    p95Ms: Number(percentil(muestras, 95).toFixed(2)),
    p99Ms: Number(percentil(muestras, 99).toFixed(2)),
    maxMs: Number(Math.max(...muestras).toFixed(2)),
  };
}

function alinear(texto, ancho) {
  return String(texto).padEnd(ancho);
}

async function principal() {
  const db = crearBaseDeDatos(':memory:');
  // El limitador se eleva porque la prueba de carga no simula fuerza bruta.
  const app = crearApp({ db, limiteLogin: 10_000 });
  const servidor = app.listen(0);
  const base = 'http://127.0.0.1:' + servidor.address().port;

  console.log('Prueba de carga de TaskFlow');
  console.log('  usuarios concurrentes : ' + USUARIOS);
  console.log('  tareas por usuario    : ' + TAREAS_POR_USUARIO);
  console.log('');

  const inicio = performance.now();
  // Todos los usuarios arrancan a la vez: es el escenario de concurrencia.
  await Promise.all(
    Array.from({ length: USUARIOS }, (_valor, indice) => recorridoDeUsuario(base, indice))
  );
  const duracionTotal = performance.now() - inicio;

  servidor.close();

  // ------------------------------- Reporte -------------------------------

  const todas = [...mediciones.values()].flat();
  const global = estadisticas(todas);
  const tasaError = Number(((errores / operaciones) * 100).toFixed(2));
  const rendimiento = Number((operaciones / (duracionTotal / 1000)).toFixed(2));

  // Agrupacion por clase de operacion para evaluar los criterios de salida.
  const muestrasCrud = [];
  const muestrasAuth = [];
  for (const [operacion, muestras] of mediciones) {
    if (OPERACIONES_DE_AUTENTICACION.has(operacion)) muestrasAuth.push(...muestras);
    else muestrasCrud.push(...muestras);
  }
  const crud = estadisticas(muestrasCrud);
  const autenticacion = estadisticas(muestrasAuth);

  console.log(
    alinear('OPERACION', 16) +
      alinear('PETIC.', 8) +
      alinear('PROM', 10) +
      alinear('P50', 10) +
      alinear('P95', 10) +
      alinear('P99', 10) +
      alinear('MAX', 10)
  );
  console.log('-'.repeat(74));

  const porOperacion = {};
  for (const [operacion, muestras] of mediciones) {
    const stats = estadisticas(muestras);
    porOperacion[operacion] = stats;
    console.log(
      alinear(operacion, 16) +
        alinear(stats.peticiones, 8) +
        alinear(stats.promedioMs + 'ms', 10) +
        alinear(stats.p50Ms + 'ms', 10) +
        alinear(stats.p95Ms + 'ms', 10) +
        alinear(stats.p99Ms + 'ms', 10) +
        alinear(stats.maxMs + 'ms', 10)
    );
  }

  console.log('-'.repeat(74));
  console.log(
    alinear('TOTAL', 16) +
      alinear(global.peticiones, 8) +
      alinear(global.promedioMs + 'ms', 10) +
      alinear(global.p50Ms + 'ms', 10) +
      alinear(global.p95Ms + 'ms', 10) +
      alinear(global.p99Ms + 'ms', 10) +
      alinear(global.maxMs + 'ms', 10)
  );

  console.log('');
  console.log('Por clase de operacion:');
  console.log(
    '  CRUD de tareas : promedio ' + crud.promedioMs + 'ms, p95 ' + crud.p95Ms + 'ms'
  );
  console.log(
    '  Autenticacion  : promedio ' +
      autenticacion.promedioMs +
      'ms, p95 ' +
      autenticacion.p95Ms +
      'ms (incluye la derivacion scrypt)'
  );
  console.log('');
  console.log('Duracion total      : ' + (duracionTotal / 1000).toFixed(2) + ' s');
  console.log('Rendimiento         : ' + rendimiento + ' peticiones/s');
  console.log('Peticiones con error: ' + errores + ' de ' + operaciones + ' (' + tasaError + '%)');
  console.log('');

  // --------------------------- Criterios de salida ---------------------------

  const verificaciones = [
    {
      nombre: 'p95 del CRUD de tareas <= ' + UMBRALES.crud.p95Ms + 'ms',
      valor: crud.p95Ms,
      cumple: crud.p95Ms <= UMBRALES.crud.p95Ms,
    },
    {
      nombre: 'promedio del CRUD de tareas <= ' + UMBRALES.crud.promedioMs + 'ms',
      valor: crud.promedioMs,
      cumple: crud.promedioMs <= UMBRALES.crud.promedioMs,
    },
    {
      nombre: 'p95 de autenticacion <= ' + UMBRALES.autenticacion.p95Ms + 'ms',
      valor: autenticacion.p95Ms,
      cumple: autenticacion.p95Ms <= UMBRALES.autenticacion.p95Ms,
    },
    {
      nombre: 'promedio de autenticacion <= ' + UMBRALES.autenticacion.promedioMs + 'ms',
      valor: autenticacion.promedioMs,
      cumple: autenticacion.promedioMs <= UMBRALES.autenticacion.promedioMs,
    },
    {
      nombre: 'tasa de error <= ' + UMBRALES.tasaErrorPorcentaje + '%',
      valor: tasaError,
      cumple: tasaError <= UMBRALES.tasaErrorPorcentaje,
    },
  ];

  console.log('Criterios de salida:');
  for (const verificacion of verificaciones) {
    const marca = verificacion.cumple ? 'CUMPLE  ' : 'NO CUMPLE';
    console.log('  [' + marca + '] ' + verificacion.nombre + ' (medido: ' + verificacion.valor + ')');
  }

  // Se guarda el resultado como evidencia para el informe final.
  mkdirSync('evidencias', { recursive: true });
  const reporte = {
    ejecutadaEn: new Date().toISOString(),
    configuracion: { usuarios: USUARIOS, tareasPorUsuario: TAREAS_POR_USUARIO },
    umbrales: UMBRALES,
    global,
    porClase: { crud, autenticacion },
    porOperacion,
    duracionTotalSegundos: Number((duracionTotal / 1000).toFixed(2)),
    rendimientoPeticionesPorSegundo: rendimiento,
    peticionesTotales: operaciones,
    peticionesConError: errores,
    tasaErrorPorcentaje: tasaError,
    criterios: verificaciones,
    resultado: verificaciones.every((v) => v.cumple) ? 'APROBADA' : 'FALLIDA',
  };
  writeFileSync('evidencias/rendimiento.json', JSON.stringify(reporte, null, 2));
  console.log('');
  console.log('Reporte guardado en evidencias/rendimiento.json');

  if (!verificaciones.every((v) => v.cumple)) {
    process.exitCode = 1;
  }
}

principal().catch((error) => {
  console.error('La prueba de carga fallo:', error);
  process.exitCode = 1;
});
