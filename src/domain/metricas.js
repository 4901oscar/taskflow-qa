/**
 * Calculo de las metricas de calidad que exige el plan de aseguramiento.
 * Funciones puras para poder verificarlas con pruebas unitarias.
 */

/**
 * Tasa de defectos por cada 1000 lineas de codigo (KLOC).
 * @param {number} defectos
 * @param {number} lineasDeCodigo
 * @returns {number} defectos por KLOC, redondeado a 2 decimales
 */
export function tasaDeDefectos(defectos, lineasDeCodigo) {
  if (!Number.isFinite(defectos) || !Number.isFinite(lineasDeCodigo)) {
    throw new Error('Los parametros deben ser numericos');
  }
  if (defectos < 0 || lineasDeCodigo < 0) {
    throw new Error('Los parametros no pueden ser negativos');
  }
  if (lineasDeCodigo === 0) return 0;
  return Math.round((defectos / lineasDeCodigo) * 1000 * 100) / 100;
}

/**
 * Porcentaje de casos de prueba que pasaron.
 * @param {number} pasaron
 * @param {number} total
 * @returns {number} porcentaje redondeado a 2 decimales
 */
export function tasaDeExito(pasaron, total) {
  if (total === 0) return 0;
  if (pasaron > total) throw new Error('Los casos exitosos no pueden exceder el total');
  return Math.round((pasaron / total) * 100 * 100) / 100;
}

/**
 * Densidad de defectos por modulo, ordenada de mayor a menor riesgo.
 * @param {Array<{modulo:string, defectos:number, lineas:number}>} modulos
 * @returns {Array<{modulo:string, densidad:number}>}
 */
export function densidadPorModulo(modulos) {
  return modulos
    .map(({ modulo, defectos, lineas }) => ({
      modulo,
      densidad: tasaDeDefectos(defectos, lineas),
    }))
    .sort((a, b) => b.densidad - a.densidad);
}

/**
 * Percentil de una muestra de tiempos de respuesta (metodo del vecino mas cercano).
 * @param {number[]} muestras en milisegundos
 * @param {number} percentil entre 0 y 100
 * @returns {number}
 */
export function percentil(muestras, percentil) {
  if (!Array.isArray(muestras) || muestras.length === 0) {
    throw new Error('Se requiere al menos una muestra');
  }
  if (percentil < 0 || percentil > 100) {
    throw new Error('El percentil debe estar entre 0 y 100');
  }
  const ordenadas = [...muestras].sort((a, b) => a - b);
  const indice = Math.ceil((percentil / 100) * ordenadas.length) - 1;
  return ordenadas[Math.max(0, indice)];
}
