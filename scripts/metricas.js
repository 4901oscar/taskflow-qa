/**
 * Calcula las metricas de calidad del proyecto a partir de las evidencias ya
 * generadas y las guarda en evidencias/metricas.json.
 *
 * Requiere haber ejecutado antes:
 *   npm run test:coverage
 *   npm run test:e2e
 *   npm run test:rendimiento
 *
 * Uso: npm run metricas
 */

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';
import { tasaDeDefectos, tasaDeExito, densidadPorModulo } from '../src/domain/metricas.js';

/** Defectos registrados en docs/03-bitacora-defectos.md, por modulo afectado. */
const DEFECTOS = [
  { id: 'DEF-001', modulo: 'src/services', severidad: 'alta', tipo: 'funcional' },
  { id: 'DEF-002', modulo: 'tests/e2e', severidad: 'media', tipo: 'prueba' },
  { id: 'DEF-003', modulo: 'public', severidad: 'media', tipo: 'seguridad' },
  { id: 'DEF-004', modulo: 'public', severidad: 'media', tipo: 'usabilidad' },
  { id: 'DEF-005', modulo: 'tests/e2e', severidad: 'baja', tipo: 'prueba' },
  { id: 'DEF-006', modulo: 'tests/e2e', severidad: 'baja', tipo: 'prueba' },
  { id: 'DEF-007', modulo: 'tests/e2e', severidad: 'media', tipo: 'prueba' },
  { id: 'DEF-008', modulo: 'src/domain', severidad: 'alta', tipo: 'rendimiento' },
];

/** Cuenta las lineas de codigo de un directorio, ignorando lineas vacias. */
function contarLineas(directorio, extensiones = ['.js', '.html', '.css']) {
  let total = 0;
  if (!existsSync(directorio)) return 0;

  for (const entrada of readdirSync(directorio)) {
    const ruta = join(directorio, entrada);
    if (statSync(ruta).isDirectory()) {
      total += contarLineas(ruta, extensiones);
    } else if (extensiones.includes(extname(entrada))) {
      const contenido = readFileSync(ruta, 'utf8');
      total += contenido.split('\n').filter((linea) => linea.trim().length > 0).length;
    }
  }
  return total;
}

/** Lee un JSON si existe; devuelve null si no. */
function leerJson(ruta) {
  if (!existsSync(ruta)) return null;
  try {
    return JSON.parse(readFileSync(ruta, 'utf8'));
  } catch {
    return null;
  }
}

/** Extrae el total de pruebas y fallos de un reporte JUnit. */
function leerJunit(ruta) {
  if (!existsSync(ruta)) return null;
  const xml = readFileSync(ruta, 'utf8');
  const sumar = (atributo) =>
    [...xml.matchAll(new RegExp('<testsuites[^>]*\\b' + atributo + '="(\\d+)"', 'g'))].reduce(
      (suma, coincidencia) => suma + Number(coincidencia[1]),
      0
    );

  const total = sumar('tests');
  const fallos = sumar('failures') + sumar('errors');
  return { total, fallos, exitosas: total - fallos };
}

function titulo(texto) {
  console.log('');
  console.log(texto);
  console.log('-'.repeat(texto.length));
}

// ------------------------------- Lineas de codigo -------------------------------

const lineas = {
  aplicacion: contarLineas('src') + contarLineas('public'),
  pruebas: contarLineas('tests'),
};
lineas.total = lineas.aplicacion + lineas.pruebas;

// -------------------------------- Resultados ---------------------------------

const vitest = leerJunit('evidencias/vitest-junit.xml');
const playwright = leerJunit('evidencias/playwright-junit.xml');
const cobertura = leerJson('evidencias/cobertura/coverage-summary.json');

// Se prefiere la ejecucion archivada que cita el informe final. El archivo
// rendimiento.json se sobrescribe en cada prueba de carga, asi que tomarlo
// directamente hacia que las metricas dejaran de coincidir con el informe.
const rendimiento =
  leerJson('evidencias/rendimiento-informe.json') ?? leerJson('evidencias/rendimiento.json');

const totalPruebas = (vitest?.total ?? 0) + (playwright?.total ?? 0);
const totalExitosas = (vitest?.exitosas ?? 0) + (playwright?.exitosas ?? 0);

// --------------------------------- Metricas ----------------------------------

const metricas = {
  generadoEn: new Date().toISOString(),

  lineasDeCodigo: lineas,

  pruebas: {
    unitariasEIntegracion: vitest,
    endToEnd: playwright,
    total: totalPruebas,
    exitosas: totalExitosas,
    tasaDeExitoPorcentaje: tasaDeExito(totalExitosas, totalPruebas),
    relacionPruebasPorCodigo:
      lineas.aplicacion > 0 ? Number((lineas.pruebas / lineas.aplicacion).toFixed(2)) : 0,
  },

  cobertura: cobertura
    ? {
        lineas: cobertura.total.lines.pct,
        sentencias: cobertura.total.statements.pct,
        ramas: cobertura.total.branches.pct,
        funciones: cobertura.total.functions.pct,
      }
    : null,

  defectos: {
    total: DEFECTOS.length,
    porSeveridad: DEFECTOS.reduce((conteo, defecto) => {
      conteo[defecto.severidad] = (conteo[defecto.severidad] ?? 0) + 1;
      return conteo;
    }, {}),
    porTipo: DEFECTOS.reduce((conteo, defecto) => {
      conteo[defecto.tipo] = (conteo[defecto.tipo] ?? 0) + 1;
      return conteo;
    }, {}),
    // La densidad se calcula sobre el codigo de aplicacion, no sobre las pruebas.
    densidadPorKloc: tasaDeDefectos(
      DEFECTOS.filter((d) => !d.modulo.startsWith('tests')).length,
      lineas.aplicacion
    ),
    densidadPorModulo: densidadPorModulo(
      [...new Set(DEFECTOS.map((d) => d.modulo))].map((modulo) => ({
        modulo,
        defectos: DEFECTOS.filter((d) => d.modulo === modulo).length,
        lineas: contarLineas(modulo),
      }))
    ),
  },

  rendimiento: rendimiento
    ? {
        usuariosConcurrentes: rendimiento.configuracion.usuarios,
        rendimientoPeticionesPorSegundo: rendimiento.rendimientoPeticionesPorSegundo,
        crud: rendimiento.porClase?.crud ?? null,
        autenticacion: rendimiento.porClase?.autenticacion ?? null,
        tasaErrorPorcentaje: rendimiento.tasaErrorPorcentaje,
        resultado: rendimiento.resultado,
      }
    : null,
};

// --------------------------------- Reporte ---------------------------------

console.log('Metricas de calidad - TaskFlow');

titulo('Tamano del codigo');
console.log('Codigo de aplicacion : ' + lineas.aplicacion + ' lineas');
console.log('Codigo de pruebas    : ' + lineas.pruebas + ' lineas');
console.log('Relacion pruebas/app : ' + metricas.pruebas.relacionPruebasPorCodigo + ' a 1');

titulo('Ejecucion de pruebas');
if (vitest) {
  console.log(
    'Unitarias e integracion : ' + vitest.exitosas + '/' + vitest.total + ' exitosas'
  );
}
if (playwright) {
  console.log(
    'End-to-end (Playwright) : ' + playwright.exitosas + '/' + playwright.total + ' exitosas'
  );
}
console.log('Total                   : ' + totalExitosas + '/' + totalPruebas + ' exitosas');
console.log('Tasa de exito           : ' + metricas.pruebas.tasaDeExitoPorcentaje + '%');

if (metricas.cobertura) {
  titulo('Cobertura de codigo');
  console.log('Lineas     : ' + metricas.cobertura.lineas + '%');
  console.log('Sentencias : ' + metricas.cobertura.sentencias + '%');
  console.log('Ramas      : ' + metricas.cobertura.ramas + '%');
  console.log('Funciones  : ' + metricas.cobertura.funciones + '%');
} else {
  titulo('Cobertura de codigo');
  console.log('Sin datos. Ejecute: npm run test:coverage');
}

titulo('Defectos');
console.log('Total encontrados : ' + metricas.defectos.total);
console.log('Por severidad     : ' + JSON.stringify(metricas.defectos.porSeveridad));
console.log('Por tipo          : ' + JSON.stringify(metricas.defectos.porTipo));
console.log('Densidad          : ' + metricas.defectos.densidadPorKloc + ' defectos por KLOC');
console.log('Modulos con mayor densidad:');
for (const { modulo, densidad } of metricas.defectos.densidadPorModulo) {
  console.log('  ' + modulo.padEnd(16) + densidad + ' por KLOC');
}

if (metricas.rendimiento) {
  titulo('Rendimiento');
  console.log('Usuarios concurrentes : ' + metricas.rendimiento.usuariosConcurrentes);
  console.log(
    'Rendimiento           : ' + metricas.rendimiento.rendimientoPeticionesPorSegundo + ' pet/s'
  );
  if (metricas.rendimiento.crud) {
    console.log(
      'CRUD de tareas        : promedio ' +
        metricas.rendimiento.crud.promedioMs +
        'ms, p95 ' +
        metricas.rendimiento.crud.p95Ms +
        'ms'
    );
  }
  if (metricas.rendimiento.autenticacion) {
    console.log(
      'Autenticacion         : promedio ' +
        metricas.rendimiento.autenticacion.promedioMs +
        'ms, p95 ' +
        metricas.rendimiento.autenticacion.p95Ms +
        'ms'
    );
  }
  console.log('Tasa de error         : ' + metricas.rendimiento.tasaErrorPorcentaje + '%');
  console.log('Resultado             : ' + metricas.rendimiento.resultado);
} else {
  titulo('Rendimiento');
  console.log('Sin datos. Ejecute: npm run test:rendimiento');
}

writeFileSync('evidencias/metricas.json', JSON.stringify(metricas, null, 2));
console.log('');
console.log('Metricas guardadas en evidencias/metricas.json');
