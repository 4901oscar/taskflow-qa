/**
 * Acceso a datos de tareas.
 * Toda consulta esta filtrada por usuario_id para que un usuario no pueda
 * leer ni modificar tareas de otro (control verificado en las pruebas de
 * seguridad: referencia directa insegura a objetos).
 */

function aDominio(fila) {
  if (!fila) return null;
  return {
    id: fila.id,
    usuarioId: fila.usuario_id,
    titulo: fila.titulo,
    descripcion: fila.descripcion,
    estado: fila.estado,
    prioridad: fila.prioridad,
    fechaVencimiento: fila.fecha_vencimiento,
    posicion: fila.posicion,
    creadaEn: fila.creada_en,
    actualizadaEn: fila.actualizada_en,
  };
}

export function crearTareaRepositorio(db) {
  return {
    crear({ usuarioId, titulo, descripcion, estado, prioridad, fechaVencimiento, posicion }) {
      const resultado = db
        .prepare(
          `INSERT INTO tareas
             (usuario_id, titulo, descripcion, estado, prioridad, fecha_vencimiento, posicion)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          usuarioId,
          titulo,
          descripcion ?? '',
          estado,
          prioridad,
          fechaVencimiento ?? null,
          posicion
        );
      return this.buscarPorId(Number(resultado.lastInsertRowid), usuarioId);
    },

    listarPorUsuario(usuarioId, { estado = null, prioridad = null, busqueda = null } = {}) {
      let sql = 'SELECT * FROM tareas WHERE usuario_id = ?';
      const parametros = [usuarioId];

      if (estado) {
        sql += ' AND estado = ?';
        parametros.push(estado);
      }
      if (prioridad) {
        sql += ' AND prioridad = ?';
        parametros.push(prioridad);
      }
      if (busqueda) {
        sql += ' AND (titulo LIKE ? OR descripcion LIKE ?)';
        const patron = `%${busqueda}%`;
        parametros.push(patron, patron);
      }
      sql += ' ORDER BY estado, posicion, id';

      return db
        .prepare(sql)
        .all(...parametros)
        .map(aDominio);
    },

    buscarPorId(id, usuarioId) {
      return aDominio(
        db.prepare('SELECT * FROM tareas WHERE id = ? AND usuario_id = ?').get(id, usuarioId)
      );
    },

    actualizar(id, usuarioId, cambios) {
      const columnas = {
        titulo: 'titulo',
        descripcion: 'descripcion',
        estado: 'estado',
        prioridad: 'prioridad',
        fechaVencimiento: 'fecha_vencimiento',
        posicion: 'posicion',
      };
      const asignaciones = [];
      const parametros = [];
      for (const [clave, columna] of Object.entries(columnas)) {
        if (Object.prototype.hasOwnProperty.call(cambios, clave)) {
          asignaciones.push(`${columna} = ?`);
          parametros.push(cambios[clave]);
        }
      }
      if (asignaciones.length === 0) return this.buscarPorId(id, usuarioId);

      asignaciones.push("actualizada_en = datetime('now')");
      parametros.push(id, usuarioId);

      db.prepare(
        `UPDATE tareas SET ${asignaciones.join(', ')} WHERE id = ? AND usuario_id = ?`
      ).run(...parametros);

      return this.buscarPorId(id, usuarioId);
    },

    eliminar(id, usuarioId) {
      const resultado = db
        .prepare('DELETE FROM tareas WHERE id = ? AND usuario_id = ?')
        .run(id, usuarioId);
      return resultado.changes > 0;
    },

    /**
     * Persiste el nuevo orden del tablero en una sola transaccion:
     * si una fila falla, ninguna queda a medias.
     */
    guardarOrden(usuarioId, posiciones) {
      const actualizar = db.prepare(
        `UPDATE tareas SET estado = ?, posicion = ?, actualizada_en = datetime('now')
         WHERE id = ? AND usuario_id = ?`
      );
      db.exec('BEGIN');
      try {
        for (const { id, estado, posicion } of posiciones) {
          actualizar.run(estado, posicion, id, usuarioId);
        }
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
      return this.listarPorUsuario(usuarioId);
    },

    contarPorUsuario(usuarioId) {
      return db
        .prepare('SELECT COUNT(*) AS total FROM tareas WHERE usuario_id = ?')
        .get(usuarioId).total;
    },
  };
}
