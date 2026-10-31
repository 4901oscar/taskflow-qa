/**
 * Error de aplicacion con codigo HTTP y detalle de validacion.
 * Permite que la capa HTTP traduzca errores sin conocer la logica de negocio.
 */
export class ErrorDeAplicacion extends Error {
  /**
   * @param {string} mensaje
   * @param {number} estado codigo HTTP
   * @param {Array<{campo:string, mensaje:string}>} errores
   */
  constructor(mensaje, estado = 400, errores = []) {
    super(mensaje);
    this.name = 'ErrorDeAplicacion';
    this.estado = estado;
    this.errores = errores;
  }
}

export const errorDeValidacion = (errores) =>
  new ErrorDeAplicacion('Los datos enviados no son validos', 422, errores);

export const noAutenticado = () =>
  new ErrorDeAplicacion('Se requiere autenticacion', 401);

export const noEncontrado = (recurso = 'Recurso') =>
  new ErrorDeAplicacion(`${recurso} no encontrado`, 404);

export const conflicto = (mensaje) => new ErrorDeAplicacion(mensaje, 409);

export const credencialesInvalidas = () =>
  new ErrorDeAplicacion('Correo o contrasena incorrectos', 401);
