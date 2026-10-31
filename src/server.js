/**
 * Punto de entrada del servidor.
 * La base de datos se elige por variable de entorno para que las pruebas
 * end-to-end puedan arrancar con una base limpia.
 */

import { crearApp } from './http/app.js';
import { crearBaseDeDatos } from './db/esquema.js';

const PUERTO = Number(process.env.PORT ?? 3000);
const RUTA_DB = process.env.DB_PATH ?? 'taskflow.db';

const db = crearBaseDeDatos(RUTA_DB);
const app = crearApp({ db });

app.listen(PUERTO, () => {
  console.log('TaskFlow escuchando en http://localhost:' + PUERTO + ' (base: ' + RUTA_DB + ')');
});
