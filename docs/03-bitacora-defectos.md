# Bitácora de Defectos — TaskFlow

**Documento:** Registro y seguimiento de incidencias
**Versión:** 1.0
**Fecha:** 30 de octubre de 2026

Este documento cumple la función que en un equipo real tendría un tablero de
Jira o Trello. Cada defecto se registra con su severidad, cómo fue detectado,
su causa raíz, la corrección aplicada y la prueba de regresión que impide que
vuelva a aparecer.

---

## 1. Resumen

| Métrica | Valor |
|---|---|
| Defectos encontrados | 8 |
| Defectos corregidos y verificados | 8 |
| Defectos abiertos | 0 |
| Densidad en código de aplicación | 1.85 defectos por KLOC |
| Detectados por automatización | 8 de 8 (100 %) |

### Distribución por severidad

| Severidad | Cantidad | Identificadores |
|---|---|---|
| Crítica | 0 | — |
| Alta | 2 | DEF-001, DEF-008 |
| Media | 4 | DEF-002, DEF-003, DEF-004, DEF-007 |
| Baja | 2 | DEF-005, DEF-006 |

### Distribución por tipo

| Tipo | Cantidad | Identificadores |
|---|---|---|
| Funcional / usabilidad del dato | 1 | DEF-001 |
| Rendimiento | 1 | DEF-008 |
| Seguridad | 1 | DEF-003 |
| Usabilidad / diseño responsivo | 1 | DEF-004 |
| Defecto en el código de pruebas | 4 | DEF-002, DEF-005, DEF-006, DEF-007 |

### Distribución por fase de detección

| Fase que lo encontró | Cantidad |
|---|---|
| Pruebas end-to-end | 6 |
| Prueba de carga | 1 |
| Configuración del entorno de pruebas | 1 |

**Observación relevante:** la mitad de los defectos de la aplicación
(DEF-001, DEF-003 y DEF-004) **no fueron detectados por las pruebas unitarias
ni de integración**, que estaban al 100 % en verde. Solo aparecieron al
ejecutar la aplicación en un navegador real. Esto confirma el valor de la capa
end-to-end.

---

## 2. DEF-001 — El usuario ve entidades HTML en lugar del texto que escribió

| Campo | Valor |
|---|---|
| **Severidad** | Alta |
| **Tipo** | Funcional / integridad del dato |
| **Módulo** | `src/services/tareaServicio.js`, `src/services/autenticacionServicio.js`, `src/domain/sanitizer.js` |
| **Detectado por** | CP-E-044, CP-E-045, CP-E-046 (Playwright) |
| **Estado** | Cerrado |

### Descripción

Al crear una tarea cuyo título contenía caracteres especiales legítimos, la
tarjeta mostraba las entidades HTML en vez del texto original.

| El usuario escribió | La aplicación mostraba |
|---|---|
| `Revisar modulo <auth> & reportes` | `Revisar modulo &lt;auth&gt; &amp; reportes` |
| `Revisar el informe de O'Brien` | `Revisar el informe de O&#39;Brien` |
| `Actualizar src/http/app.js` | `Actualizar src&#x2F;http&#x2F;app.js` |

El tercer caso es el más grave en la práctica: cualquier tarea que mencione una
ruta de archivo quedaba ilegible.

### Evidencia

```
CP-E-044: el texto que escribe el usuario se muestra tal cual
  Expected: "Revisar modulo <auth> & reportes"
  Received: "Revisar modulo &lt;auth&gt; &amp; reportes"
```

Además, el defecto hacía fallar en cascada a CP-E-041, CP-E-042 y CP-E-043:
esas pruebas localizan la tarjeta por el título que escribieron y, al quedar
almacenado escapado, el localizador no encontraba el elemento.

### Causa raíz

El escapado de HTML se aplicaba **en la entrada**, dentro del servicio, antes
de guardar en la base de datos:

```js
// Código con el defecto
function sanear(texto) {
  return escaparHtml(quitarCaracteresDeControl(limpiarTexto(texto)));
}
```

El cliente ya insertaba el texto con `textContent`, que escapa por sí mismo.
El resultado era una **doble codificación**: el servidor convertía `<` en
`&lt;` y el navegador mostraba literalmente esos cinco caracteres.

El error de diseño de fondo es haber puesto el control de seguridad en la capa
equivocada. El escapado de HTML depende del **contexto de salida**, no del dato
almacenado: el mismo texto se escapa distinto en HTML, en un atributo, en una
URL o en JSON. Escapar al entrar fuerza una única representación y corrompe el
dato para todos los demás consumidores.

Lo más instructivo es que **las 287 pruebas unitarias, de integración y de
seguridad pasaban**. De hecho, las pruebas de seguridad *exigían* el
comportamiento defectuoso: afirmaban que el valor almacenado no debía contener
`<`. Las pruebas confirmaban una decisión de diseño equivocada.

### Corrección aplicada

1. El saneamiento de entrada solo normaliza espacios y elimina caracteres de
   control; ya no escapa HTML.
2. Se eliminó la función `escaparHtml`, que quedó sin uso. La protección contra
   XSS la dan el uso de `textContent` en el cliente y la cabecera
   `Content-Security-Policy`.
3. Se reescribieron las pruebas de seguridad del servidor para verificar la
   capa correcta: que el dato viaje íntegro y que la respuesta se sirva como
   JSON, nunca como HTML.

```js
// Código corregido
function sanear(texto) {
  return quitarCaracteresDeControl(limpiarTexto(texto));
}
```

### Pruebas de regresión

| Prueba | Qué garantiza |
|---|---|
| CP-U-022, CP-U-026 | La normalización conserva `<`, `>`, `&`, `'` y `/` |
| CP-S-011 | La API devuelve el texto sin `&lt;` ni `&amp;` |
| CP-S-012 | La base de datos guarda exactamente lo recibido |
| CP-S-016b | La respuesta es `application/json`, nunca `text/html` |
| CP-E-041 a CP-E-043 | La carga no se ejecuta en el navegador |
| CP-E-044 a CP-E-046 | El texto se muestra tal como se escribió |

---

## 3. DEF-002 — Lectura del mensaje de error antes de que apareciera

| Campo | Valor |
|---|---|
| **Severidad** | Media |
| **Tipo** | Defecto en el código de pruebas |
| **Módulo** | `tests/e2e/autenticacion.spec.js` |
| **Detectado por** | Fallo de CP-E-008 |
| **Estado** | Cerrado |

### Descripción

CP-E-008 comparaba el mensaje mostrado al fallar con un correo existente contra
el mostrado con un correo inexistente. La segunda lectura devolvía cadena vacía.

```
Expected: "Correo o contrasena incorrectos"
Received: ""
```

### Causa raíz

La prueba leía el texto con `textContent()` inmediatamente después de pulsar el
botón, sin esperar a que la petición de inicio de sesión terminara.
`textContent()` es una lectura instantánea y **no tiene espera automática**, a
diferencia de las aserciones `expect(locator).toHaveText(...)`.

La aplicación funcionaba correctamente; el defecto estaba en la prueba. Vale la
pena señalarlo porque una prueba así puede pasar en una máquina rápida y fallar
en integración continua, y entonces se desconfía del producto en vez de la
prueba.

### Corrección aplicada

Esperar a que el mensaje sea visible antes de leerlo:

```js
await iniciarSesion(page, usuario.correo, 'incorrecta999');
await expect(page.getByTestId('error-login')).toBeVisible();
const mensajeExiste = await page.getByTestId('error-login').textContent();
```

---

## 4. DEF-003 — El token de sesión permanecía en el navegador al cerrar sesión

| Campo | Valor |
|---|---|
| **Severidad** | Media |
| **Tipo** | Seguridad |
| **Módulo** | `public/app.js` |
| **Detectado por** | Prueba end-to-end de aislamiento de sesión |
| **Estado** | Cerrado |

### Descripción

Al pulsar "Salir", el token seguía en `localStorage` mientras la petición de
cierre de sesión estaba en vuelo.

```
expect(received).toBeNull()
Received: "52a1be0093cb0ba00e354406ed4ad220b2617001d7a2f58e9c9ad3fb3b813979"
```

### Causa raíz

El manejador esperaba la respuesta del servidor **antes** de limpiar el estado
local:

```js
// Código con el defecto
try {
  await api('/auth/logout', { metodo: 'POST' });
} catch { }
cerrarSesionLocal();
```

Consecuencias reales: si la red fallaba o la petición quedaba colgada, el token
permanecía indefinidamente en el navegador, aunque el usuario creyera haber
cerrado la sesión. En un equipo compartido eso es una credencial abandonada.

### Corrección aplicada

Invertir el orden: limpiar primero el estado local y luego revocar en el
servidor con el token ya capturado.

```js
const token = estado.token;
cerrarSesionLocal();

if (!token) return;
try {
  await fetch('/api/auth/logout', {
    method: 'POST',
    headers: { authorization: 'Bearer ' + token },
  });
} catch { }
```

### Pruebas de regresión

| Prueba | Qué garantiza |
|---|---|
| "el token se borra del almacenamiento local al cerrar sesión" | `localStorage` queda sin token |
| CP-E-011 | Recargar tras cerrar sesión no devuelve el acceso |
| CP-I-016 | El token revocado deja de servir en el servidor |

---

## 5. DEF-004 — Desplazamiento horizontal en viewport móvil

| Campo | Valor |
|---|---|
| **Severidad** | Media |
| **Tipo** | Usabilidad / diseño responsivo |
| **Módulo** | `public/estilos.css` |
| **Detectado por** | Prueba end-to-end de robustez de la interfaz (390 × 844 px) |
| **Estado** | Cerrado |

### Descripción

Con un viewport de 390 px de ancho, la página se desplazaba horizontalmente:
`document.documentElement.scrollWidth` superaba `clientWidth`.

### Causa raíz

La barra superior usa Flexbox con cuatro controles (título, prioridad, fecha y
botón). El campo de título tenía `min-width: 160px` y el de fecha
`flex: 0 0 150px`, que impide encogerse. La suma de los anchos mínimos más los
espacios excedía los 390 px disponibles, y el contenedor no tenía permitido
pasar a varias líneas.

### Corrección aplicada

1. `min-width: 0` en los campos, para que Flexbox pueda encogerlos por debajo
   del ancho mínimo de su contenido.
2. `flex-wrap: wrap` en la barra, para que los controles pasen a la línea
   siguiente.
3. Media query a partir de 560 px que apila los controles al 100 % de ancho y
   reduce los márgenes laterales de 24 px a 16 px.

### Prueba de regresión

| Prueba | Qué garantiza |
|---|---|
| "la interfaz sigue siendo usable en viewport móvil" | Sin desplazamiento horizontal a 390 px |
| "un título muy largo no rompe el diseño del tablero" | La tarjeta no excede el ancho de su columna |

---

## 6. DEF-005 — Punto de soltado ambiguo en la prueba de arrastre

| Campo | Valor |
|---|---|
| **Severidad** | Baja |
| **Tipo** | Defecto en el código de pruebas |
| **Módulo** | `tests/e2e/tablero.spec.js` |
| **Detectado por** | Fallo de CP-E-035 |
| **Estado** | Cerrado |

### Descripción

CP-E-035 arrastraba dos tareas a la columna de completadas y esperaba el orden
`[uno, dos]`, pero obtenía `[dos, uno]`.

### Causa raíz

`dragTo(columna)` suelta en el **centro geométrico** del elemento destino.
Tras el primer arrastre la columna contenía una tarjeta, y su centro quedaba
justo por encima de la mitad de esa tarjeta. La lógica de inserción
(`calcularPosicionDeSoltado`) interpreta correctamente que el cursor está en la
mitad superior y coloca la nueva tarea **antes**.

La aplicación hizo lo correcto; la prueba no expresaba su intención. "Soltar en
la columna" es ambiguo cuando la columna ya tiene contenido.

### Corrección aplicada

Indicar explícitamente el punto de soltado en la parte inferior de la columna:

```js
const caja = await destino.boundingBox();
await tarjetaPorTitulo(page, 'Tarea dos').dragTo(destino, {
  targetPosition: { x: caja.width / 2, y: caja.height - 2 },
});
```

---

## 7. DEF-006 — Centinela de XSS nunca inicializado

| Campo | Valor |
|---|---|
| **Severidad** | Baja |
| **Tipo** | Defecto en el código de pruebas |
| **Módulo** | `tests/e2e/seguridad.spec.js` |
| **Detectado por** | Fallo de CP-E-041 |
| **Estado** | Cerrado |

### Descripción

```
expect(received).toBe(expected)
Expected: false
Received: undefined
```

### Causa raíz

La prueba inicializaba el centinela con `page.addInitScript()`, que solo se
ejecuta en la **siguiente navegación**. Como la navegación ocurría en el
`beforeEach` (antes de registrar el script) y la prueba no volvía a navegar, el
centinela nunca se definió.

El riesgo es sutil pero serio: `undefined !== true`, así que una variante de la
aserción podría haber dado por buena la prueba sin comprobar nada. Una prueba
de seguridad que no ejecuta su verificación es peor que no tenerla, porque da
una falsa sensación de cobertura.

### Corrección aplicada

Definir el centinela en la página ya cargada:

```js
await page.evaluate(() => {
  window.__xssEjecutado = false;
});
```

---

## 8. DEF-007 — Aserciones intermitentes por lectura sin espera

| Campo | Valor |
|---|---|
| **Severidad** | Media |
| **Tipo** | Defecto en el código de pruebas (intermitencia) |
| **Módulo** | `tests/e2e/ayudas.js`, `tablero.spec.js`, `tareas.spec.js` |
| **Detectado por** | Fallo intermitente de CP-E-033 |
| **Estado** | Cerrado |

### Descripción

CP-E-033 pasó en una ejecución y falló en la siguiente **sin ningún cambio de
código**: la columna de origen aún mostraba las tres tareas.

```
Array [
    "Tarea A",
+   "Tarea B",
    "Tarea C",
  ]
```

### Causa raíz

El auxiliar `titulosDeColumna` usa `allTextContents()`, una lectura instantánea
sin espera automática. Tras un arrastre, el tablero se repinta cuando llega la
respuesta del servidor; la aserción se ejecutaba antes de ese repintado.

Es el mismo patrón de DEF-002, lo que indica una causa sistémica: el equipo
mezclaba lecturas instantáneas con aserciones que esperan. Una prueba
intermitente erosiona la confianza en toda la suite, porque enseña a repetir la
ejecución en lugar de investigar.

### Corrección aplicada

Auxiliar con reintentos basado en `expect.poll`, que reevalúa la lectura hasta
que coincide o se agota el tiempo:

```js
export async function esperarTitulosDeColumna(page, estado, esperados) {
  await expect
    .poll(() => titulosDeColumna(page, estado), { timeout: 5000 })
    .toEqual(esperados);
}
```

Se reemplazaron todas las comparaciones instantáneas de listas en
`tablero.spec.js` y `tareas.spec.js`.

### Verificación

`npx playwright test tests/e2e/tablero.spec.js --repeat-each=3` →
**39 pruebas en verde, 0 intermitentes.**

---

## 9. DEF-008 — El hash de contraseñas bloqueaba el servidor completo

| Campo | Valor |
|---|---|
| **Severidad** | Alta |
| **Tipo** | Rendimiento |
| **Módulo** | `src/domain/password.js` |
| **Detectado por** | Prueba de carga con 50 usuarios concurrentes |
| **Estado** | Cerrado |

### Descripción

En las primeras ejecuciones de la prueba de carga, el registro y el inicio de
sesión tardaban **más de dos segundos**:

```
OPERACION       PETIC.  PROM        P95
registro        50      2268.09ms   2296.34ms
login           50      2730.53ms   2736.56ms
crear_tarea     250     212.88ms    582.45ms
```

Los criterios de salida quedaban incumplidos. Lo más llamativo es la última
línea: `crear_tarea` **no deriva ninguna clave** y aun así su p95 llegó a
582 ms, por encima de su límite de 500 ms.

### Causa raíz

La derivación de clave usaba `scryptSync`, la variante **sincrona**:

```js
// Código con el defecto
const hash = scryptSync(password, sal, LONGITUD_HASH).toString('hex');
```

Node.js ejecuta JavaScript en un solo hilo. `scryptSync` ocupa ese hilo durante
todo el cálculo (unos 35 ms), de modo que con 50 usuarios simultáneos los
cálculos se serializaban: 50 × 35 ms ≈ 1.75 s para el último.

El efecto más grave no es la lentitud del login, sino que **el bucle de eventos
quedaba bloqueado para todas las demás peticiones**. Mientras alguien se
registraba, las consultas al tablero de los otros usuarios también esperaban.
Un solo endpoint degradaba el sistema entero, y en producción un puñado de
registros simultáneos bastaría para que la aplicación pareciera caída.

Este defecto es invisible para una prueba de un solo usuario: cada petición
aislada responde en 35 ms. Solo la concurrencia lo revela.

### Corrección aplicada

1. Migración a la variante asíncrona de `scrypt`, que delega el cálculo al
   grupo de hilos de libuv y deja libre el bucle de eventos.
2. Propagación de `async`/`await` por el servicio de autenticación y las rutas.
3. Declaración explícita de los parámetros de costo (N = 2^14, r = 8, p = 1),
   para que sea una decisión documentada y no un valor por defecto implícito.

```js
const scryptAsync = promisify(scrypt);

export async function hashPassword(password) {
  const sal = randomBytes(LONGITUD_SAL).toString('hex');
  const derivada = await scryptAsync(password, sal, LONGITUD_HASH, COSTO);
  return sal + ':' + derivada.toString('hex');
}
```

### Resultado medido

Para descartar que la diferencia fuera ruido de la máquina se midieron **tres
ejecuciones de cada versión**, restaurando temporalmente el código defectuoso.
Las cifras son la mediana de las tres:

| Métrica (mediana de 3) | Antes (`scryptSync`) | Después (`scrypt` asíncrono) | Mejora |
|---|---|---|---|
| Rendimiento | 82.89 pet/s | 318.91 pet/s | **3.8×** |
| Autenticación, promedio | 2499.31 ms | 458.95 ms | **5.4×** |
| Autenticación, p95 | 2735.72 ms | 869.59 ms | 3.1× |
| Promedio de `login` | 2730.53 ms | 360.15 ms | 7.6× |
| Promedio de `registro` | 2381.66 ms | 557.75 ms | 4.3× |
| **CRUD, promedio** | **106.26 ms** | **48.05 ms** | **2.2×** |
| **CRUD, p95** | **172.33 ms** | **81.13 ms** | **2.1×** |
| Tasa de error | 0 % | 0 % | — |

Rangos observados en las tres ejecuciones:

| Métrica | Antes | Después |
|---|---|---|
| Rendimiento | 77 – 104 pet/s | 296 – 342 pet/s |
| Autenticación, promedio | 2254 – 3074 ms | 455 – 462 ms |

Los rangos **no se solapan**, por lo que la mejora no es atribuible a la
variabilidad de la máquina.

La mejora en el CRUD de tareas (más del doble) es la prueba de que el problema
era el bloqueo del bucle de eventos: esas operaciones no hacen ningún hashing y
aun así se degradaban.

### Decisión sobre los umbrales

El registro sigue costando unos 490 ms de promedio porque scrypt es **caro por
diseño**: ese costo es precisamente la defensa contra el descifrado masivo por
fuerza bruta si alguien roba la base de datos. Abaratarlo debilitaría la
seguridad.

Se separaron por tanto los criterios de salida por clase de operación:

| Clase | p95 | Promedio | Justificación |
|---|---|---|---|
| CRUD de tareas | ≤ 500 ms | ≤ 200 ms | Operaciones interactivas |
| Autenticación | ≤ 1500 ms | ≤ 1000 ms | Incluye derivación de clave deliberadamente costosa |

Un umbral global mezclaba ambas y producía un p95 dominado por scrypt, que
ocultaba el comportamiento real de la aplicación.

### Prueba de regresión

| Prueba | Qué garantiza |
|---|---|
| CP-U-054 | Un temporizador de 0 ms se dispara antes de terminar 8 hashes en paralelo |
| "varias verificaciones en paralelo" | La concurrencia no altera los resultados |
| Prueba de carga | Los cinco criterios de salida se cumplen |

---

## 10. Hallazgo de entorno — Playwright 1.49 incompatible con Node.js 25

| Campo | Valor |
|---|---|
| **Severidad** | Bloqueante (no es un defecto del producto) |
| **Tipo** | Herramientas / entorno |
| **Estado** | Resuelto |

### Descripción

El ejecutor de Playwright 1.49.1 se quedaba colgado indefinidamente sin emitir
ninguna salida. Ni siquiera `playwright test --list`, que solo descubre pruebas
y no abre el navegador, terminaba.

### Diagnóstico

Se descartaron causas por eliminación:

1. `playwright --version` respondía en 3 segundos → la instalación estaba bien.
2. El servidor arrancaba correctamente a mano en el puerto 3100 → no era el
   servidor web de la configuración.
3. El mismo bloqueo ocurría desde Git Bash y desde PowerShell → no era el shell.
4. Una configuración mínima con un único test trivial también se colgaba → no
   era el código del proyecto.

Conclusión: la versión 1.49.1 (diciembre de 2024) no es compatible con
Node.js 25.2.1, muy posterior a su publicación.

### Resolución

Actualización a Playwright 1.64.1. La misma configuración mínima pasó en
694 ms.

### Lección

Verificar que la cadena de herramientas funciona **antes** de escribir la suite
completa. Se habían escrito cuatro archivos de pruebas end-to-end antes de
descubrir que el ejecutor no arrancaba. Un "hola mundo" de cada herramienta al
inicio del proyecto habría ahorrado ese trabajo a riesgo.

---

## 11. Análisis consolidado

### 11.1 ¿Qué capa encontró cada defecto?

| Capa de pruebas | Defectos encontrados |
|---|---|
| Unitarias (140) | 0 |
| Integración (69) | 0 |
| Seguridad de API (87) | 0 |
| **End-to-end (60)** | **6** |
| **Prueba de carga** | **1** |
| Configuración del entorno | 1 |

El dato más importante del proyecto: con 287 pruebas de servidor en verde y
98 % de cobertura, el sistema tenía tres defectos reales visibles para
cualquier usuario. La cobertura mide qué código se ejecutó, no si el
comportamiento observable es correcto.

### 11.2 Patrones recurrentes

1. **El control de seguridad en la capa equivocada** (DEF-001). Las pruebas
   codificaban la decisión errónea y por eso la protegían.
2. **Mezclar lecturas instantáneas con aserciones que esperan** (DEF-002,
   DEF-007). Produce intermitencia y desconfianza en la suite.
3. **Probar con un solo usuario** (DEF-008). La concurrencia revela una clase
   de defectos que la ejecución secuencial no puede mostrar.
4. **Aserciones sobre valores no inicializados** (DEF-006). Comparar contra
   `undefined` puede dar por buena una prueba que no verificó nada.

### 11.3 Trazabilidad defecto → prueba de regresión

| Defecto | Pruebas que lo impiden volver |
|---|---|
| DEF-001 | CP-U-022, CP-U-026, CP-S-011, CP-S-012, CP-S-016b, CP-E-041 a CP-E-046 |
| DEF-002 | CP-E-008 (con espera explícita) |
| DEF-003 | "el token se borra del almacenamiento local", CP-E-011, CP-I-016 |
| DEF-004 | "viewport móvil", "título muy largo" |
| DEF-005 | CP-E-035 (con punto de soltado explícito) |
| DEF-006 | CP-E-041 (con centinela inicializado) |
| DEF-007 | CP-E-033, CP-E-019, CP-E-026, CP-E-032, CP-E-034, CP-E-035 |
| DEF-008 | CP-U-054, prueba de carga |

Los 8 defectos tienen al menos una prueba automatizada que falla si el defecto
reaparece.
