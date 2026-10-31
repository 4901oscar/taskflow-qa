/**
 * Limitador de intentos en memoria (ventana deslizante).
 * Mitiga ataques de fuerza bruta sobre el inicio de sesion.
 */

export function crearLimitador({ maximo = 5, ventanaMs = 60_000 } = {}) {
  const intentos = new Map();

  return {
    /**
     * Registra un intento y dice si la clave excedio el limite.
     * @param {string} clave normalmente la IP o el correo
     * @returns {{bloqueado:boolean, restantes:number}}
     */
    registrar(clave) {
      const ahora = Date.now();
      const previos = (intentos.get(clave) ?? []).filter((t) => ahora - t < ventanaMs);
      previos.push(ahora);
      intentos.set(clave, previos);
      return {
        bloqueado: previos.length > maximo,
        restantes: Math.max(0, maximo - previos.length),
      };
    },

    reiniciar(clave) {
      intentos.delete(clave);
    },

    limpiar() {
      intentos.clear();
    },
  };
}
