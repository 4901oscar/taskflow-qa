# Casos de Prueba — TaskFlow

**Documento:** Diseño y catálogo de casos de prueba
**Versión:** 1.0
**Fecha:** 30 de octubre de 2026

---

## 1. Convenciones

### 1.1 Nomenclatura de identificadores

| Prefijo | Tipo de prueba | Herramienta | Ubicación |
|---|---|---|---|
| `CP-U-nnn` | Unitaria | Vitest | `tests/unit/` |
| `CP-I-nnn` | Integración | Vitest + Supertest | `tests/integration/` |
| `CP-S-nnn` | Seguridad | Vitest + Supertest | `tests/seguridad/` |
| `CP-E-nnn` | End-to-end (funcional) | Playwright | `tests/e2e/` |

Cada identificador aparece **literalmente en el nombre de la prueba
automatizada**, de modo que la trazabilidad entre este documento y el código es
directa y verificable con una búsqueda de texto.

### 1.2 Técnicas de diseño aplicadas

| Técnica | Cómo se aplica |
|---|---|
| **Partición de equivalencia** | Entradas válidas frente a inválidas en cada campo |
| **Análisis de valores límite** | Título de 2, 3, 100 y 101 caracteres; posiciones −5, 0, n y n+1 |
| **Tabla de decisión** | Combinaciones de estado y posición en el movimiento de tareas |
| **Transición de estados** | Recorrido pendiente → en progreso → completada y vuelta |
| **Pruebas negativas** | Entradas nulas, no textuales, malformadas y maliciosas |
| **Pruebas basadas en riesgo** | Mayor densidad de casos en ordenamiento y autenticación |

### 1.3 Datos de prueba

| Dato | Valor |
|---|---|
| Usuario válido | `Oscar Rivera` / `oscar@test.com` / `secreta123` |
| Segundo usuario (aislamiento) | `Ana Lopez` / `ana@test.com` / `otraclave456` |
| Usuario de pruebas end-to-end | Correo único generado por ejecución, para permitir paralelismo |
| Cargas de inyección SQL | 8 variantes (`' OR '1'='1`, `'; DROP TABLE tareas; --`, `UNION SELECT`, …) |
| Cargas de XSS | 7 variantes (`<script>`, `onerror`, `<svg/onload>`, `javascript:`, …) |

---

## 2. Casos de prueba unitarios (140 pruebas)

### 2.1 Validación del título — `validadores.js`

| ID | Caso | Entrada | Resultado esperado |
|---|---|---|---|
| CP-U-001 | Título válido | `"Preparar informe de calidad"` | Válido, sin errores |
| CP-U-002 | Título vacío | `""` | Inválido, error en campo `titulo` |
| CP-U-003 | Título solo con espacios | `"      "` | Inválido, mensaje "obligatorio" |
| CP-U-004 | Título por debajo del mínimo | `"ab"` | Inválido, menciona el mínimo (3) |
| CP-U-005 | Límite inferior exacto | 3 caracteres | Válido |
| CP-U-006 | Límite superior exacto | 100 caracteres | Válido |
| CP-U-007 | Por encima del límite superior | 101 caracteres | Inválido, "no puede exceder" |
| CP-U-008 | Tipos no textuales | `null`, `undefined`, `42`, `{}`, `[]` | Inválido en los 5 casos |
| CP-U-009 | Longitud medida sin espacios externos | `"   ab   "` / `"   abc   "` | Inválido / Válido |

### 2.2 Validación de la descripción

| ID | Caso | Entrada | Resultado esperado |
|---|---|---|---|
| CP-U-010 | Campo opcional ausente | `undefined`, `null`, `""` | Válido |
| CP-U-011 | Límite exacto | 500 caracteres | Válido |
| CP-U-012 | Por encima del límite | 501 caracteres | Inválido |

### 2.3 Validación de estado y prioridad

| ID | Caso | Entrada | Resultado esperado |
|---|---|---|---|
| CP-U-013 | Estados válidos | `pendiente`, `en_progreso`, `completada` | Válido |
| CP-U-014 | Estados inválidos | `archivada`, `PENDIENTE`, `en progreso`, `borrada` | Inválido |
| CP-U-015 | Prioridades válidas | `baja`, `media`, `alta` | Válido |

### 2.4 Validación de la fecha de vencimiento

| ID | Caso | Entrada | Resultado esperado |
|---|---|---|---|
| CP-U-016 | Fecha ISO válida | `2026-12-31` | Válido |
| CP-U-017 | Formatos inválidos | `31/12/2026`, `2026-13-01`, `ayer`, `2026-1-1` | Inválido |
| CP-U-018 | Fecha inexistente en el calendario | `2026-02-31` | Inválido, "no existe" |

### 2.5 Normalización de entrada — `sanitizer.js`

| ID | Caso | Entrada | Resultado esperado |
|---|---|---|---|
| CP-U-019 | Recorte de extremos | `"   hola   "` | `"hola"` |
| CP-U-020 | Colapso de espacios internos | `"hola     mundo"` | `"hola mundo"` |
| CP-U-021 | Normalización de tabuladores y saltos | `"hola\t\n  mundo"` | `"hola mundo"` |
| CP-U-022 | **Conservación de caracteres especiales** | `"Revisar modulo <auth> & reportes"` | Texto idéntico, sin entidades HTML |
| CP-U-023 | Normalización de correo | `"  Oscar@Test.COM "` | `"oscar@test.com"` |
| CP-U-024 | Eliminación de caracteres de control | `"a\u0000b\u001Fc"` | `"abc"` |
| CP-U-025 | Eliminación del carácter DEL | `"a\u007Fb"` | `"ab"` |
| CP-U-026 | Puntuación legítima intacta | `"Revisar <auth> & \"reportes\""` | Texto idéntico |

> CP-U-022 y CP-U-026 son **pruebas de regresión de DEF-001**.

### 2.6 Lógica del tablero — `ordenamiento.js`

Tablero de referencia: 3 tareas en pendientes (ids 1, 2, 3), 2 en progreso (4, 5), 0 completadas.

| ID | Caso | Acción | Resultado esperado |
|---|---|---|---|
| CP-U-027 | Agrupación por estado | — | Tres columnas con 3, 2 y 0 tareas |
| CP-U-028 | Orden por posición | Posiciones 5, 1, 3 | Orden 7, 8, 9 |
| CP-U-029 | Compactación de posiciones | Posiciones 4 y 9 | Posiciones 0 y 1 |
| CP-U-030 | Mover entre columnas | id 1 → en progreso, posición 1 | `[4, 1, 5]` |
| CP-U-031 | Compactación del origen | id 1 → completada | Pendientes con posiciones 0 y 1 |
| CP-U-032 | Reorden en la misma columna | id 3 → posición 0 | `[3, 1, 2]`, sin duplicados |
| CP-U-033 | Movimiento nulo | id 2 → su misma posición | Tablero sin cambios |
| CP-U-034 | Posición mayor que la columna | id 1 → posición 99 | Se inserta al final |
| CP-U-035 | Posición negativa | id 1 → posición −5 | Se inserta al inicio |
| CP-U-036 | Columna destino vacía | id 4 → completada | `[4]` |
| CP-U-037 | Estado destino inexistente | `archivada` | Lanza error |
| CP-U-038 | Tarea inexistente | id 999 | Lanza error |

Casos adicionales sin identificador propio: conservación del total de tareas,
ausencia de posiciones duplicadas, inmutabilidad de la entrada (función pura) y
tratamiento de una posición no numérica.

### 2.7 Métricas de calidad — `metricas.js`

| ID | Caso | Entrada | Resultado esperado |
|---|---|---|---|
| CP-U-039 | Defectos por KLOC | 8 defectos / 2000 líneas | 4 |
| CP-U-040 | División por cero | 5 defectos / 0 líneas | 0 |
| CP-U-041 | Parámetros negativos | −1 | Lanza error |
| CP-U-042 | Parámetros no numéricos | `"ocho"`, `NaN` | Lanza error |
| CP-U-043 | Tasa de éxito | 47 de 50 | 94 % |
| CP-U-044 | Éxitos mayores que el total | 51 de 50 | Lanza error |
| CP-U-045 | Densidad por módulo | 3 módulos | Ordenados de mayor a menor densidad |
| CP-U-046 | Percentil 95 | Muestra de 10 valores | 100 |

### 2.8 Contraseñas — `password.js`

| ID | Caso | Resultado esperado |
|---|---|---|
| CP-U-047 | La contraseña no aparece en el hash | El hash no contiene el texto plano |
| CP-U-048 | Formato del hash | `sal:hash` en hexadecimal (32:128) |
| CP-U-049 | Sal aleatoria | Dos hashes de la misma contraseña son distintos |
| CP-U-050 | Verificación correcta | `true` |
| CP-U-051 | Verificación incorrecta | `false` |
| CP-U-052 | Hash corrupto | `false`, sin lanzar excepción (5 variantes) |
| CP-U-053 | Unicidad de tokens | 200 tokens distintos de 64 hexadecimales |
| CP-U-054 | **El cálculo no bloquea el bucle de eventos** | Un temporizador de 0 ms se dispara antes de terminar 8 hashes |

> CP-U-054 es **prueba de regresión de DEF-008**.

### 2.9 Limitador de intentos — `limitador.js`

| ID | Caso | Resultado esperado |
|---|---|---|
| CP-U-055 | Intentos dentro del límite | Permitidos |
| CP-U-056 | Superar el límite | Bloqueado |
| CP-U-057 | Independencia entre claves | Bloquear `ip-1` no afecta a `ip-2` |
| CP-U-058 | Expiración de la ventana | Tras 61 s se vuelve a permitir |
| CP-U-059 | Reinicio manual | Libera la clave de inmediato |

---

## 3. Casos de prueba de integración (69 pruebas)

### 3.1 Registro — `POST /api/auth/registro`

| ID | Caso | Resultado esperado |
|---|---|---|
| CP-I-001 | Registro exitoso | 201 con usuario y token de 64 hexadecimales |
| CP-I-002 | La respuesta no filtra la contraseña | Sin `secreta123` ni la clave `password` |
| CP-I-003 | Persistencia solo como hash | La columna cumple `sal:hash` y no contiene el texto plano |
| CP-I-004 | Correo duplicado | 409 "ya existe" |
| CP-I-005 | Duplicado sin distinguir mayúsculas | `OSCAR@TEST.COM` también da 409 |
| CP-I-006 | Datos inválidos | 422 con error por cada uno de los tres campos |
| CP-I-007 | Cuerpo vacío | 422 |

### 3.2 Inicio de sesión — `POST /api/auth/login`

| ID | Caso | Resultado esperado |
|---|---|---|
| CP-I-008 | Credenciales correctas | 200 con token |
| CP-I-009 | Correo en mayúsculas | 200 |
| CP-I-010 | Contraseña incorrecta | 401 |
| CP-I-011 | **No revela si el correo existe** | Mismo estado y mismo mensaje para usuario inexistente y contraseña errónea |
| CP-I-012 | Token distinto por sesión | Dos inicios generan tokens diferentes |
| CP-I-013 | Protección contra fuerza bruta | El 4.º intento con límite de 3 devuelve 429 |

### 3.3 Sesión — `GET /api/auth/yo`, `POST /api/auth/logout`

| ID | Caso | Resultado esperado |
|---|---|---|
| CP-I-014 | Sesión activa | 200 con el usuario |
| CP-I-015 | Sin token | 401 |
| CP-I-016 | Cierre de sesión | 204 y el token deja de servir (401) |

Casos adicionales: cabecera de autorización inválida (4 variantes), cierre de
una sesión sin afectar a otras del mismo usuario, `/api/salud`,
`/api/catalogos`, ruta de API inexistente (404 en JSON) y cuerpo JSON
malformado (400, no 500).

### 3.4 Creación de tareas — `POST /api/tareas`

| ID | Caso | Resultado esperado |
|---|---|---|
| CP-I-017 | Valores por defecto | 201, estado `pendiente`, prioridad `media`, posición 0 |
| CP-I-018 | Todos los campos | 201 con los valores enviados |
| CP-I-019 | Título vacío | 422, error en `titulo` |
| CP-I-020 | Título solo con espacios | 422 |
| CP-I-021 | Estado fuera del catálogo | 422, error en `estado` |
| CP-I-022 | Fecha mal formada | 422, error en `fechaVencimiento` |
| CP-I-023 | Normalización de espacios | `"   Revisar    el   informe   "` → `"Revisar el informe"` |
| CP-I-024 | Posiciones consecutivas | 0, 1, 2 |
| CP-I-025 | Sin autenticación | 401 |

### 3.5 Consulta de tareas — `GET /api/tareas`

| ID | Caso | Resultado esperado |
|---|---|---|
| CP-I-026 | Usuario nuevo | Lista vacía |
| CP-I-027 | Listado completo | Todas las tareas del usuario |
| CP-I-028 | Filtro por estado | Solo las del estado pedido |
| CP-I-029 | Filtro por prioridad | Solo las de la prioridad pedida |
| CP-I-030 | Búsqueda por texto | Coincidencias en título **y** descripción |
| CP-I-031 | Filtro de estado inválido | 422 |
| CP-I-032 | Obtener una tarea por id | 200 |
| CP-I-033 | Tarea inexistente | 404 |
| CP-I-034 | Identificador inválido | 400 para `abc`, `0`, `-1`, `1.5` |

### 3.6 Edición de tareas — `PUT /api/tareas/:id`

| ID | Caso | Resultado esperado |
|---|---|---|
| CP-I-035 | Editar el título | 200 con el nuevo título |
| CP-I-036 | Edición parcial | Los campos no enviados se conservan |
| CP-I-037 | Edición que vaciaría el título | 422 |
| CP-I-038 | Cambio de columna | La tarea queda al final de la columna destino |
| CP-I-039 | Tarea inexistente | 404 |

### 3.7 Movimiento de tareas — `PATCH /api/tareas/:id/mover`

| ID | Caso | Resultado esperado |
|---|---|---|
| CP-I-040 | Mover entre columnas | 200 con el tablero completo actualizado |
| CP-I-041 | Reordenar en la misma columna | Nuevo orden `[C, A, B]` |
| CP-I-042 | Compactación del origen | Posiciones 0 y 1, sin huecos |
| CP-I-043 | Estado destino inválido | 422 |
| CP-I-044 | Tarea inexistente | 404 |

### 3.8 Eliminación y aislamiento

| ID | Caso | Resultado esperado |
|---|---|---|
| CP-I-045 | Eliminar una tarea | 204 y desaparece del listado |
| CP-I-046 | Un usuario no ve tareas de otro | Lista vacía |
| CP-I-047 | Leer una tarea ajena por id | 404 |
| CP-I-048 | Editar una tarea ajena | 404 y la original intacta |
| CP-I-049 | Eliminar una tarea ajena | 404 y la original sigue existiendo |
| CP-I-050 | Mover una tarea ajena | 404 |

> CP-I-046 a CP-I-050 cubren **referencia directa insegura a objetos (IDOR)**.
> Se devuelve 404 en lugar de 403 para no confirmar la existencia del recurso.

---

## 4. Casos de prueba de seguridad (87 pruebas)

### 4.1 Inyección SQL

| ID | Caso | Resultado esperado |
|---|---|---|
| CP-S-001 | 8 cargas en el campo de correo del login | 401 en todas, sin token |
| CP-S-002 | 8 cargas en el campo de contraseña | 401 en todas, sin token |
| CP-S-003 | `DROP TABLE usuarios` en el login | La tabla conserva su registro |
| CP-S-004 | 8 cargas en el título de una tarea | Se guardan como texto literal |
| CP-S-005 | `DROP TABLE tareas` al crear | La tabla sigue existiendo |
| CP-S-006 | `UPDATE` masivo al crear | Las demás tareas no se alteran |
| CP-S-007 | 8 cargas en el filtro de búsqueda | 0 resultados; ninguna actúa como comodín |
| CP-S-008 | Carga en el filtro de estado | 422 por validación |
| CP-S-009 | Búsqueda inyectada entre usuarios | No revela tareas ajenas |
| CP-S-010 | 4 cargas en el identificador de ruta | 400 y la tabla intacta |

Casos adicionales: los mensajes de error no mencionan `sqlite`, `select` ni
rutas internas; la API nunca devuelve el token de otro usuario.

### 4.2 XSS almacenado: integridad del dato

| ID | Caso | Resultado esperado |
|---|---|---|
| CP-S-011 | 7 cargas en el título | Se almacenan sin alterar, sin `&lt;` ni `&amp;` |
| CP-S-012 | Carga en la base de datos | La columna contiene exactamente el texto recibido |
| CP-S-013 | 7 cargas en la descripción | Texto conservado |
| CP-S-014 | Carga al editar | Texto conservado |
| CP-S-015 | Caracteres especiales en el nombre | `"Oscar O'Brien & Asociados"` se conserva |
| CP-S-016 | Caracteres de control | Eliminados |
| CP-S-016b | Tipo de contenido de la respuesta | `application/json`, nunca `text/html` |

> La prevención de **ejecución** se verifica en el navegador (CP-E-041 a
> CP-E-043). Esta sección verifica que el servidor no corrompe el dato.

### 4.3 Cabeceras de seguridad

| ID | Cabecera | Valor esperado |
|---|---|---|
| CP-S-017 | `X-Content-Type-Options` | `nosniff` |
| CP-S-018 | `X-Frame-Options` | `DENY` |
| CP-S-019 | `Content-Security-Policy` | `default-src 'self'`, sin `unsafe-inline` ni `unsafe-eval` |
| CP-S-020 | `X-Powered-By` | Ausente |
| — | `Referrer-Policy` | `no-referrer` |

### 4.4 Control de acceso

| ID | Caso | Resultado esperado |
|---|---|---|
| CP-S-021 | 9 endpoints sin autenticación | 401 en todos |
| CP-S-022 | Token manipulado en un carácter | 401 |
| CP-S-023 | Token revocado | 401 inmediato |
| CP-S-024 | Escalada enviando `usuarioId` en el cuerpo | 404 y la tarea ajena intacta |
| CP-S-025 | Cuerpo de 200 000 caracteres | 413 o 422 |

Caso adicional: enviar `id` en el cuerpo no sobrescribe el identificador real.

---

## 5. Casos de prueba end-to-end (60 pruebas)

### 5.1 Registro e inicio de sesión

| ID | Caso | Resultado esperado |
|---|---|---|
| CP-E-001 | Registro y entrada al tablero | Se ve el tablero y el nombre del usuario |
| CP-E-002 | Contraseña débil | Mensaje de error; no entra |
| CP-E-003 | Correo mal formado | Mensaje que menciona el correo |
| CP-E-004 | Correo duplicado | Mensaje "ya existe" |
| CP-E-005 | Inicio de sesión correcto | Entra y muestra su nombre |
| CP-E-006 | Contraseña incorrecta | Error visible; no entra |
| CP-E-007 | Usuario inexistente | Error visible |
| CP-E-008 | Mensajes indistinguibles | Idéntico texto en ambos casos |

### 5.2 Sesión

| ID | Caso | Resultado esperado |
|---|---|---|
| CP-E-009 | Recarga de página | La sesión se mantiene |
| CP-E-010 | Cierre de sesión | Vuelve a la pantalla de acceso |
| CP-E-011 | Recarga tras cerrar sesión | No recupera el acceso |
| CP-E-012 | Token falso en el navegador | No da acceso |

Casos adicionales: alternancia entre pestañas de acceso y registro, y limpieza
del mensaje de error al cambiar de pestaña.

### 5.3 Crear, editar y eliminar tareas

| ID | Caso | Resultado esperado |
|---|---|---|
| CP-E-013 | Crear una tarea | Aparece en pendientes; contador en 1 |
| CP-E-014 | Prioridad alta y fecha | Etiqueta "alta" y fecha `15/12/2026` |
| CP-E-015 | Título vacío | Error visible; contador en 0 |
| CP-E-016 | Título solo con espacios | Error que menciona el título |
| CP-E-017 | Título de 2 caracteres | Error visible |
| CP-E-018 | Limpieza del formulario | El campo queda vacío tras crear |
| CP-E-019 | Varias tareas | Orden de creación respetado |
| CP-E-020 | Editar el título | Se refleja en la tarjeta |
| CP-E-021 | Agregar descripción | Se muestra en la tarjeta |
| CP-E-022 | Cambiar prioridad | La etiqueta pasa a "alta" |
| CP-E-023 | Edición que vacía el título | Error y el diálogo permanece abierto |
| CP-E-024 | Cancelar la edición | Se descartan los cambios |
| CP-E-025 | Eliminar una tarea | Desaparece; contador en 0 |
| CP-E-026 | Eliminar una de tres | Quedan las otras dos en orden |

### 5.4 Arrastrar y soltar

| ID | Caso | Resultado esperado |
|---|---|---|
| CP-E-029 | Pendientes → en progreso | Contadores 0 y 1 |
| CP-E-030 | Arrastrar a completadas | Contador de completadas en 1 |
| CP-E-031 | Persistencia tras recargar | La tarea sigue en su nueva columna |
| CP-E-032 | Columna de origen vacía | Origen sin tareas, destino con una |
| CP-E-033 | El resto del tablero no cambia | `[A, C]` en origen, `[B]` en destino |
| CP-E-034 | Reordenar en la misma columna | `[tercera, primera, segunda]` |
| CP-E-035 | Dos tareas a la misma columna | Orden `[uno, dos]` al soltar al final |

### 5.5 Movimiento por menú y contadores

| ID | Caso | Resultado esperado |
|---|---|---|
| CP-E-036 | Mover a en progreso con el selector | Contador en 1 |
| CP-E-037 | Mover a completadas con el selector | Contador en 1 |
| CP-E-038 | El selector refleja la columna actual | Valor sincronizado |
| CP-E-039 | Contadores iniciales | 0, 0, 0 |
| CP-E-040 | Distribución real | 1, 1, 1 |

### 5.6 Filtros, seguridad en el navegador y robustez

| ID | Caso | Resultado esperado |
|---|---|---|
| CP-E-027 | Filtro por texto | Solo la tarea coincidente |
| CP-E-028 | Filtro por prioridad | Solo la de prioridad alta |
| CP-E-041 | `<script>` en el título | No se ejecuta (centinela en `false`) |
| CP-E-042 | `onerror` en el título | Ningún diálogo se dispara |
| CP-E-043 | Carga en el DOM | 0 etiquetas `img` o `script` inyectadas |
| CP-E-044 | **Texto con `<`, `>` y `&`** | Se muestra tal cual, sin entidades visibles |
| CP-E-045 | **Apóstrofo en el título** | `O'Brien` se muestra sin codificar |
| CP-E-046 | **Barra en el título** | `src/http/app.js` se muestra sin codificar |

Casos adicionales: búsqueda sin distinguir mayúsculas, limpieza del filtro,
búsqueda sin resultados, persistencia tras recarga, aislamiento entre usuarios,
borrado del token al cerrar sesión, ausencia de la contraseña en el
almacenamiento local, título largo que no rompe el diseño y ausencia de
desplazamiento horizontal en viewport móvil.

> CP-E-044 a CP-E-046 son **pruebas de regresión de DEF-001**.

---

## 6. Trazabilidad entre requerimientos y casos de prueba

| Requerimiento | Casos de prueba | Cobertura |
|---|---|---|
| HU-01 Crear cuenta | CP-U-001…009, CP-I-001…007, CP-E-001…004 | Completa |
| HU-02 Iniciar sesión | CP-U-047…054, CP-I-008…013, CP-E-005…008 | Completa |
| HU-03 Cerrar sesión | CP-I-016, CP-E-010…012 | Completa |
| HU-04 Crear tareas | CP-U-001…018, CP-I-017…025, CP-E-013…019 | Completa |
| HU-05 Editar tareas | CP-I-035…039, CP-E-020…024 | Completa |
| HU-06 Eliminar tareas | CP-I-045, CP-E-025…026 | Completa |
| HU-07 Mover entre columnas | CP-U-027…038, CP-I-040…044, CP-E-029…033, CP-E-036…038 | Completa |
| HU-08 Reordenar | CP-U-032…035, CP-I-041…042, CP-E-034…035 | Completa |
| HU-09 Buscar y filtrar | CP-I-028…031, CP-E-027…028 | Completa |
| HU-10 Privacidad | CP-I-046…050, CP-S-009, CP-S-024 | Completa |
| RNF-01/02/03 Rendimiento | Prueba de carga (`tests/performance/carga.js`) | Completa |
| RNF-04 Contraseñas | CP-U-047…053, CP-I-002…003 | Completa |
| RNF-05 Inyección SQL | CP-S-001…010 | Completa |
| RNF-06 XSS | CP-S-011…016b, CP-E-041…046 | Completa |
| RNF-07 Fuerza bruta | CP-U-055…059, CP-I-013 | Completa |
| RNF-08 Responsividad | CP-E (viewport móvil, título largo) | Completa |

**Conclusión:** los 10 requerimientos funcionales y los 8 no funcionales tienen
al menos un caso de prueba automatizado asociado.
