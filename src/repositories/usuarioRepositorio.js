/**
 * Acceso a datos de usuarios y sesiones.
 * TODAS las consultas usan sentencias preparadas con parametros enlazados:
 * es el control que neutraliza la inyeccion SQL y se verifica en
 * tests/seguridad/inyeccion.test.js.
 */

export function crearUsuarioRepositorio(db) {
  return {
    /**
     * Inserta un usuario y devuelve su registro publico.
     * @returns {{id:number, nombre:string, correo:string}}
     */
    crear({ nombre, correo, passwordHash }) {
      const resultado = db
        .prepare('INSERT INTO usuarios (nombre, correo, password_hash) VALUES (?, ?, ?)')
        .run(nombre, correo, passwordHash);
      return {
        id: Number(resultado.lastInsertRowid),
        nombre,
        correo,
      };
    },

    buscarPorCorreo(correo) {
      return db.prepare('SELECT * FROM usuarios WHERE correo = ?').get(correo) ?? null;
    },

    buscarPorId(id) {
      return db.prepare('SELECT * FROM usuarios WHERE id = ?').get(id) ?? null;
    },

    existeCorreo(correo) {
      const fila = db.prepare('SELECT 1 AS existe FROM usuarios WHERE correo = ?').get(correo);
      return Boolean(fila);
    },

    crearSesion(token, usuarioId) {
      db.prepare('INSERT INTO sesiones (token, usuario_id) VALUES (?, ?)').run(token, usuarioId);
      return token;
    },

    /**
     * Devuelve el usuario dueno de un token de sesion, o null.
     */
    buscarPorToken(token) {
      if (typeof token !== 'string' || token.length === 0) return null;
      return (
        db
          .prepare(
            `SELECT u.id, u.nombre, u.correo
             FROM sesiones s
             JOIN usuarios u ON u.id = s.usuario_id
             WHERE s.token = ?`
          )
          .get(token) ?? null
      );
    },

    eliminarSesion(token) {
      const resultado = db.prepare('DELETE FROM sesiones WHERE token = ?').run(token);
      return resultado.changes > 0;
    },

    contar() {
      return db.prepare('SELECT COUNT(*) AS total FROM usuarios').get().total;
    },
  };
}
