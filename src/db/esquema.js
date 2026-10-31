/**
 * Creacion del esquema SQLite.
 *
 * Se usa el modulo nativo node:sqlite para no depender de binarios externos.
 * Se carga con createRequire porque la version de Vite que acompana a Vitest 2.x
 * todavia no lo reconoce como modulo nativo de Node e intenta resolverlo como
 * una dependencia del proyecto, lo que rompe la carga de las pruebas.
 */

import { createRequire } from 'node:module';

const requerir = createRequire(import.meta.url);
const MODULO_SQLITE = 'node:sqlite';
const { DatabaseSync } = requerir(MODULO_SQLITE);

/**
 * Abre una base de datos y crea el esquema si no existe.
 * @param {string} ruta ':memory:' para las pruebas, un archivo en produccion
 * @returns {object} instancia de DatabaseSync
 */
export function crearBaseDeDatos(ruta = ':memory:') {
  const db = new DatabaseSync(ruta);

  db.exec('PRAGMA foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre        TEXT    NOT NULL,
      correo        TEXT    NOT NULL UNIQUE,
      password_hash TEXT    NOT NULL,
      creado_en     TEXT    NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS sesiones (
      token      TEXT    PRIMARY KEY,
      usuario_id INTEGER NOT NULL,
      creada_en  TEXT    NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS tareas (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id        INTEGER NOT NULL,
      titulo            TEXT    NOT NULL,
      descripcion       TEXT    NOT NULL DEFAULT '',
      estado            TEXT    NOT NULL DEFAULT 'pendiente',
      prioridad         TEXT    NOT NULL DEFAULT 'media',
      fecha_vencimiento TEXT,
      posicion          INTEGER NOT NULL DEFAULT 0,
      creada_en         TEXT    NOT NULL DEFAULT (datetime('now')),
      actualizada_en    TEXT    NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
    )
  `);

  db.exec('CREATE INDEX IF NOT EXISTS idx_tareas_usuario ON tareas(usuario_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_sesiones_usuario ON sesiones(usuario_id)');

  return db;
}
