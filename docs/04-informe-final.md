# Informe Final de Pruebas — TaskFlow

**Documento:** Informe de resultados y evaluación de la calidad
**Versión:** 1.0
**Fecha:** 30 de octubre de 2026
**Autor:** Oscar Rivera
**Curso:** Aseguramiento de Calidad de Software

---

## 1. Resumen ejecutivo

Se diseñó, implementó y ejecutó un plan de aseguramiento de calidad completo
para **TaskFlow**, una aplicación web de gestión de tareas construida para este
proyecto. Se automatizaron **356 pruebas** en cuatro niveles (unitario,
integración, seguridad y end-to-end), más una prueba de carga con usuarios
concurrentes.

El proceso **encontró 8 defectos**, todos corregidos y verificados con pruebas
de regresión. Los dos de severidad alta eran invisibles para las pruebas de
servidor, que estaban al 100 % en verde con 98 % de cobertura:

- **DEF-001:** los usuarios veían `&lt;auth&gt;` en lugar del texto que
  escribían, porque el escapado de HTML se aplicaba en la capa equivocada.
- **DEF-008:** el hash de contraseñas bloqueaba el único hilo de Node.js y
  degradaba **todas** las peticiones del sistema, no solo el inicio de sesión.
  Corregirlo casi **cuadruplicó el rendimiento** (83 → 319 peticiones por
  segundo, medianas de tres ejecuciones).

### Veredicto

| Criterio de salida | Umbral | Resultado | Estado |
|---|---|---|---|
| 1. Pruebas unitarias, integración y seguridad | 100 % | 296/296 | CUMPLE |
| 2. Pruebas end-to-end | 100 % | 60/60 | CUMPLE |
| 3. Cobertura de líneas | ≥ 85 % | 98.47 % | CUMPLE |
| 4. Cobertura de ramas | ≥ 80 % | 93.67 % | CUMPLE |
| 5. Defectos de severidad alta abiertos | 0 | 0 | CUMPLE |
| 6. Defectos de severidad media abiertos | 0 | 0 | CUMPLE |
| 7. Criterios de rendimiento | RNF-01 a 03 | 5 de 5 | CUMPLE |
| 8. Pruebas intermitentes | 0 | 0 en 3 ejecuciones | CUMPLE |

**Los 8 criterios de salida se cumplen. Se recomienda aprobar la entrega**, con
las reservas detalladas en la sección 8.

---

## 2. Alcance de la ejecución

### 2.1 Resumen de pruebas ejecutadas

| Nivel | Archivos | Pruebas | Resultado | Duración |
|---|---|---|---|---|
| Unitarias | 6 | 140 | 140 en verde | 1.2 s |
| Integración | 2 | 69 | 69 en verde | 5.2 s |
| Seguridad (API) | 2 | 87 | 87 en verde | incluido arriba |
| End-to-end | 4 | 60 | 60 en verde | 32.6 s |
| Carga | 1 | 550 peticiones | APROBADA | 1.5 s |
| **Total** | **15** | **356** | **356 en verde (100 %)** | **~40 s** |

Desglose por archivo:

| Archivo | Pruebas |
|---|---|
| `tests/unit/validadores.test.js` | 66 |
| `tests/unit/ordenamiento.test.js` | 22 |
| `tests/unit/metricas.test.js` | 17 |
| `tests/unit/password.test.js` | 16 |
| `tests/unit/sanitizer.test.js` | 12 |
| `tests/unit/limitador.test.js` | 7 |
| `tests/integration/tareas.test.js` | 44 |
| `tests/integration/autenticacion.test.js` | 25 |
| `tests/seguridad/xss-y-cabeceras.test.js` | 44 |
| `tests/seguridad/inyeccion.test.js` | 43 |
| `tests/e2e/tareas.spec.js` | 23 |
| `tests/e2e/autenticacion.spec.js` | 14 |
| `tests/e2e/tablero.spec.js` | 13 |
| `tests/e2e/seguridad.spec.js` | 10 |

### 2.2 Tamaño del esfuerzo

| Métrica | Valor |
|---|---|
| Líneas de código de aplicación | 2 166 |
| Líneas de código de pruebas | 2 605 |
| Relación pruebas / aplicación | 1.2 a 1 |
| Total | 4 771 |

Que el código de pruebas supere al de producción es esperable y deseable en un
proyecto con enfoque en calidad: las pruebas incluyen datos, escenarios y
aserciones explícitas que no tienen equivalente en el código de aplicación.

---

## 3. Resultados de las pruebas funcionales

### 3.1 Cobertura de requerimientos

Los 10 requerimientos funcionales y los 8 no funcionales tienen al menos un
caso de prueba automatizado. La matriz completa está en la sección 6 de
`02-casos-de-prueba.md`.

### 3.2 Hallazgos destacados por nivel

**Pruebas unitarias.** Validaron el comportamiento en los límites exactos
(título de 2, 3, 100 y 101 caracteres; posiciones −5, 0, n y n+1) y el
tratamiento de entradas no textuales. El módulo de ordenamiento concentra 22
pruebas porque es el que tiene más casos borde: columna vacía, posición fuera de
rango, reordenamiento dentro de la misma columna, tarea inexistente e
inmutabilidad de la entrada.

**Pruebas de integración.** Confirmaron el contrato de la API en 69 escenarios,
incluidos los códigos de estado correctos para cada error (422 para validación,
404 para recurso ausente, 400 para identificador inválido, 409 para duplicado,
429 para exceso de intentos). Un detalle que estas pruebas aseguran: un cuerpo
JSON malformado devuelve 400 y no 500.

**Pruebas end-to-end.** Encontraron 6 de los 8 defectos. Validaron el arrastrar
y soltar real en Chromium, incluida la reordenación dentro de una columna, que
es el escenario más difícil de verificar.

---

## 4. Resultados de las pruebas de seguridad

### 4.1 Amenazas evaluadas

| Amenaza | Casos | Resultado |
|---|---|---|
| Inyección SQL | 43 | Ninguna carga se ejecutó como SQL |
| XSS almacenado | 30 | Ninguna carga se ejecutó en el navegador |
| Control de acceso roto (IDOR) | 14 | Ningún acceso cruzado entre usuarios |
| Fuerza bruta | 6 | Bloqueo tras exceder el límite |
| Enumeración de usuarios | 2 | Mensajes indistinguibles |
| Exposición de información | 4 | Sin filtración de SQL, rutas ni tokens |
| Cabeceras de protección | 5 | Las cinco presentes |

### 4.2 Controles verificados

| Control | Implementación | Verificación |
|---|---|---|
| Sentencias preparadas | Todas las consultas usan parámetros enlazados | CP-S-001 a CP-S-010 |
| Hash de contraseñas | scrypt con sal aleatoria por usuario | CP-U-047 a CP-U-053, CP-I-003 |
| Comparación en tiempo constante | `timingSafeEqual` | `password.js` |
| Aislamiento por usuario | Todas las consultas filtran por `usuario_id` | CP-I-046 a CP-I-050 |
| Codificación de salida | `textContent` en el cliente | CP-E-041 a CP-E-046 |
| CSP restrictiva | Sin `unsafe-inline` ni `unsafe-eval` | CP-S-019 |
| Límite de intentos | Ventana deslizante de 5 por minuto | CP-U-055 a CP-U-059, CP-I-013 |
| Límite de tamaño del cuerpo | 64 KB | CP-S-025 |

### 4.3 Decisión de diseño: dónde escapar

El hallazgo de seguridad más instructivo del proyecto fue **DEF-001**. La
implementación inicial escapaba el HTML al entrar el dato, antes de guardarlo.
Las pruebas de seguridad del servidor lo exigían así, afirmando que el valor
almacenado no debía contener `<`.

Eso era incorrecto. El escapado depende del **contexto de salida**: el mismo
texto se escapa distinto en HTML, en un atributo, en una URL o en JSON. Guardar
el dato ya escapado fija una sola representación y corrompe el valor para todo
lo demás: el usuario veía `src&#x2F;http&#x2F;app.js` en lugar de la ruta que
había escrito.

El modelo corregido es el estándar de la industria:

| Capa | Responsabilidad |
|---|---|
| Entrada | Validar y normalizar (recortar espacios, quitar caracteres de control) |
| Almacenamiento | Guardar el dato íntegro, sin transformarlo |
| Salida | Codificar según el contexto (`textContent` en el DOM) |
| Defensa en profundidad | `Content-Security-Policy` sin `unsafe-inline` |

La verificación también se reorganizó en dos capas: el servidor comprueba la
integridad del dato y el tipo de contenido de la respuesta; el navegador
comprueba que la carga no se ejecuta.

### 4.4 Nota sobre las herramientas

El plan mencionaba OWASP ZAP y Burp Suite. Se optó por pruebas automatizadas
equivalentes integradas en la suite, por dos razones: quedan dentro del ciclo de
regresión (se ejecutan en cada cambio, no una sola vez) y permiten verificar el
estado interno de la base de datos, algo que un escáner externo no puede hacer.
Un escaneo con ZAP sigue siendo recomendable como verificación complementaria
(sección 9).

---

## 5. Resultados de las pruebas de rendimiento

### 5.1 Escenario

50 usuarios concurrentes; cada uno se registra, crea 5 tareas, consulta el
tablero y su resumen, mueve una tarea, edita una tarea y vuelve a iniciar
sesión. Total: **550 peticiones** lanzadas en paralelo.

### 5.2 Resultados finales

Ejecución registrada en `evidencias/rendimiento.json`:

| Operación | Peticiones | Promedio | p50 | p95 | p99 | Máximo |
|---|---|---|---|---|---|---|
| `registro` | 50 | 579.50 ms | 569.29 ms | 960.21 ms | 1021.77 ms | 1021.77 ms |
| `login` | 50 | 384.35 ms | 357.94 ms | 628.26 ms | 648.02 ms | 648.02 ms |
| `crear_tarea` | 250 | 45.39 ms | 44.62 ms | 84.88 ms | 94.00 ms | 124.82 ms |
| `listar_tareas` | 50 | 43.56 ms | 46.16 ms | 64.80 ms | 85.25 ms | 85.25 ms |
| `resumen` | 50 | 42.64 ms | 41.23 ms | 75.17 ms | 82.18 ms | 82.18 ms |
| `mover_tarea` | 50 | 42.23 ms | 42.17 ms | 75.04 ms | 87.89 ms | 87.89 ms |
| `editar_tarea` | 50 | 39.42 ms | 36.44 ms | 66.24 ms | 80.11 ms | 80.11 ms |

| Agrupación | Peticiones | Promedio | p95 |
|---|---|---|---|
| CRUD de tareas | 450 | 43.87 ms | 80.11 ms |
| Autenticación | 100 | 481.92 ms | 919.10 ms |

| Métrica global | Valor |
|---|---|
| Duración total | 1.74 s |
| Rendimiento | 315.44 peticiones/s |
| Tasa de error | 0 % (0 de 550) |

### 5.3 Variabilidad entre ejecuciones

Una sola medición no es un resultado. Se ejecutó la prueba **tres veces
consecutivas** en la misma máquina para cuantificar la dispersión:

| Métrica | Ejec. 1 | Ejec. 2 | Ejec. 3 | Rango |
|---|---|---|---|---|
| Rendimiento (pet/s) | 342.08 | 295.87 | 318.91 | 296 – 342 |
| CRUD, promedio | 39.35 ms | 60.29 ms | 48.05 ms | 39 – 60 ms |
| CRUD, p95 | 57.24 ms | 126.05 ms | 81.13 ms | 57 – 126 ms |
| Autenticación, promedio | 455.22 ms | 462.17 ms | 458.95 ms | 455 – 462 ms |
| Autenticación, p95 | 869.59 ms | 993.52 ms | 854.09 ms | 854 – 994 ms |

El tiempo de autenticación es muy estable (variación menor al 2 %) porque está
dominado por el costo fijo de scrypt. Las operaciones de CRUD, mucho más
rápidas, muestran una dispersión relativa mayor: a esa escala influyen la carga
del sistema operativo y el recolector de basura. Las tres ejecuciones cumplen
los cinco criterios con holgura.

### 5.4 Criterios de salida

| Criterio | Umbral | Medido | Estado |
|---|---|---|---|
| p95 del CRUD de tareas | ≤ 500 ms | 80.11 ms | CUMPLE |
| Promedio del CRUD de tareas | ≤ 200 ms | 43.87 ms | CUMPLE |
| p95 de autenticación | ≤ 1500 ms | 919.10 ms | CUMPLE |
| Promedio de autenticación | ≤ 1000 ms | 481.92 ms | CUMPLE |
| Tasa de error | ≤ 1 % | 0 % | CUMPLE |

### 5.5 El defecto que solo la concurrencia podía revelar

Las primeras ejecuciones incumplían criterios de salida: el registro y el
inicio de sesión tardaban más de dos segundos porque `scryptSync` bloqueaba el
único hilo de JavaScript de Node.js durante todo el cálculo.

Para que la comparación fuera defendible se midieron **tres ejecuciones de cada
versión**, restaurando temporalmente el código defectuoso:

| Métrica (mediana de 3) | Antes (`scryptSync`) | Después (`scrypt` asíncrono) | Mejora |
|---|---|---|---|
| Rendimiento | 82.89 pet/s | 318.91 pet/s | **3.8×** |
| Autenticación, promedio | 2499.31 ms | 458.95 ms | **5.4×** |
| Autenticación, p95 | 2735.72 ms | 869.59 ms | 3.1× |
| `login`, promedio | 2730.53 ms | 360.15 ms | 7.6× |
| `registro`, promedio | 2381.66 ms | 557.75 ms | 4.3× |
| **CRUD, promedio** | **106.26 ms** | **48.05 ms** | **2.2×** |
| **CRUD, p95** | **172.33 ms** | **81.13 ms** | **2.1×** |

Los rangos de rendimiento de ambas versiones (77 – 104 pet/s frente a
296 – 342 pet/s) **no se solapan**, por lo que la mejora no es atribuible a la
variabilidad de la máquina.

Lo determinante no es la lentitud del login, sino que **las peticiones de tareas
también se degradaban** aunque no hicieran ningún hashing: su promedio y su p95
mejoraron algo más del doble al corregir el bloqueo. En una de las tres
ejecuciones de la versión defectuosa el p95 del CRUD alcanzó 560 ms e
**incumplió su criterio de salida**, pese a que esas operaciones no derivan
ninguna clave. Un solo endpoint estaba degradando el sistema completo.

Este defecto es **estructuralmente invisible** para una prueba de un solo
usuario: cada petición aislada responde en unos 35 ms y parece correcta. Solo
aparece cuando varias peticiones compiten por el mismo hilo.

### 5.6 Por qué la autenticación sigue costando ~480 ms

No es un defecto pendiente, es una decisión de seguridad. scrypt es costoso a
propósito: ese costo es lo que hace económicamente inviable descifrar las
contraseñas por fuerza bruta si alguien roba la base de datos. Abaratarlo
mejoraría el número del informe y debilitaría la protección real.

Por eso los criterios se separaron por clase de operación. Un umbral único
mezclaba el alta de usuarios con la lectura del tablero y producía un p95
dominado por scrypt que ocultaba el comportamiento real de la aplicación.

---

## 6. Métricas de calidad

### 6.1 Cobertura de código

| Métrica | Valor | Umbral | Estado |
|---|---|---|---|
| Sentencias | 98.47 % (1098/1115) | ≥ 85 % | CUMPLE |
| Líneas | 98.47 % (1098/1115) | ≥ 85 % | CUMPLE |
| Ramas | 93.67 % (326/348) | ≥ 80 % | CUMPLE |
| Funciones | 95.89 % (70/73) | ≥ 85 % | CUMPLE |

Por módulo:

| Módulo | Sentencias | Ramas |
|---|---|---|
| `src/errores.js` | 100 % | 100 % |
| `src/db/esquema.js` | 100 % | 100 % |
| `src/domain/constantes.js` | 100 % | 100 % |
| `src/domain/metricas.js` | 100 % | 100 % |
| `src/domain/sanitizer.js` | 100 % | 100 % |
| `src/domain/validadores.js` | 100 % | 100 % |
| `src/domain/ordenamiento.js` | 100 % | 95.83 % |
| `src/domain/password.js` | 97.01 % | 94.44 % |
| `src/http/limitador.js` | 100 % | 100 % |
| `src/http/app.js` | 97.38 % | 79.68 % |
| `src/services/autenticacionServicio.js` | 100 % | 100 % |
| `src/services/tareaServicio.js` | 98.24 % | 94.73 % |
| `src/repositories/tareaRepositorio.js` | 95.27 % | 85 % |
| `src/repositories/usuarioRepositorio.js` | 96.72 % | 90 % |

Las líneas sin cubrir corresponden a manejadores de error de último recurso
(fallo de la transacción en el repositorio, error no controlado en Express) que
requerirían inyectar fallos en la base de datos para ejercitarse.

`src/server.js` se excluye del cálculo: solo arranca el proceso y se ejercita de
forma implícita en las 60 pruebas end-to-end.

### 6.2 Advertencia sobre la cobertura

La cobertura de este proyecto es alta, pero el hallazgo central del informe es
precisamente que **no fue suficiente**: con 98 % de cobertura y 287 pruebas de
servidor en verde, la aplicación tenía tres defectos visibles para cualquier
usuario (DEF-001, DEF-003 y DEF-004).

La cobertura mide qué líneas se ejecutaron, no si el comportamiento observable
es el correcto. En el caso de DEF-001 la línea defectuosa estaba cubierta al
100 % por pruebas que **afirmaban el comportamiento equivocado**.

### 6.3 Densidad de defectos

| Métrica | Valor |
|---|---|
| Defectos en código de aplicación | 4 |
| Líneas de código de aplicación | 2 166 |
| **Densidad** | **1.85 defectos por KLOC** |

Densidad por módulo (incluye los defectos del código de pruebas):

| Módulo | Defectos por KLOC |
|---|---|
| `tests/e2e` | 6.24 |
| `src/services` | 5.46 |
| `src/domain` | 2.19 |
| `public` | 1.98 |

Como referencia de industria, un rango habitual en software comercial va de 1 a
25 defectos por KLOC. El valor obtenido está en el extremo bajo, pero debe
leerse con cautela: refleja los defectos **encontrados**, no los existentes, y
el sistema es pequeño y de dominio acotado.

Que `tests/e2e` tenga la mayor densidad es un dato honesto y no una anomalía:
el código de pruebas es código, y sus defectos (intermitencia, aserciones que
no verifican nada) son especialmente dañinos porque erosionan la confianza en
toda la suite.

### 6.4 Tiempos de respuesta

| Acción del usuario | Tiempo medido |
|---|---|
| Crear una tarea | 45.39 ms promedio |
| Cargar el tablero | 43.56 ms promedio |
| Mover una tarea | 42.23 ms promedio |
| Editar una tarea | 39.42 ms promedio |
| Iniciar sesión | 384.35 ms promedio |
| Crear una cuenta | 579.50 ms promedio |

Todas las operaciones interactivas están por debajo de los 100 ms, el umbral
habitual para que una interfaz se perciba como instantánea.

### 6.5 Eficacia de la detección

| Métrica | Valor |
|---|---|
| Defectos detectados por automatización | 8 de 8 (100 %) |
| Defectos escapados a una fase posterior | 0 |
| Defectos reabiertos | 0 |
| Pruebas de regresión añadidas | 1 por defecto como mínimo |
| Tasa de éxito final | 100 % (356/356) |

---

## 7. Evidencias

| Evidencia | Ubicación |
|---|---|
| Reporte JUnit de Vitest | `evidencias/vitest-junit.xml` |
| Reporte JUnit de Playwright | `evidencias/playwright-junit.xml` |
| Reporte HTML de Playwright | `evidencias/playwright-report/index.html` |
| Reporte HTML de cobertura | `evidencias/cobertura/index.html` |
| Cobertura en formato lcov | `evidencias/cobertura/lcov.info` |
| Resultado de la prueba de carga | `evidencias/rendimiento.json` |
| Métricas consolidadas | `evidencias/metricas.json` |
| Capturas, videos y trazas de fallos | `evidencias/playwright-resultados/` |

Comandos para reproducir todo:

```bash
npm install
npx playwright install chromium
npm run test:coverage     # 296 pruebas + cobertura
npm run test:e2e          # 60 pruebas end-to-end
npm run test:rendimiento  # prueba de carga
npm run metricas          # métricas consolidadas
```

---

## 8. Reservas y limitaciones

Se recomienda aprobar la entrega, con estas reservas explícitas:

1. **Un solo navegador.** Las pruebas end-to-end corren únicamente en Chromium.
   No hay evidencia sobre Firefox ni Safari, donde el arrastrar y soltar y el
   elemento `<dialog>` pueden comportarse distinto.
2. **Sin pruebas de accesibilidad.** No se verificó navegación por teclado con
   lector de pantalla. El menú desplegable para mover tareas existe como
   alternativa al arrastre, pero no está validado con tecnología asistiva.
3. **Carga medida en un solo nodo y en local.** Los ~315 pet/s se midieron en
   una máquina de desarrollo contra SQLite en memoria. No predicen el
   comportamiento con red, disco real ni concurrencia mayor.
4. **No se probó el volumen de datos.** El escenario usa 5 tareas por usuario.
   No se sabe cómo responde el tablero con cientos de tareas en una columna.
5. **Sin escaneo con herramienta externa.** La seguridad se verificó con
   pruebas propias; falta una validación independiente con OWASP ZAP.
6. **`node:sqlite` es experimental.** El módulo emite una advertencia de API
   inestable y puede cambiar entre versiones de Node.js.
7. **Ausencia de integración continua.** Toda la ejecución fue local. Sin un
   pipeline, nada garantiza que la suite se ejecute en cada cambio.

---

## 9. Recomendaciones

Ordenadas por relación entre valor y esfuerzo:

| # | Recomendación | Motivo |
|---|---|---|
| 1 | Configurar integración continua que ejecute la suite en cada cambio | Una suite que no se ejecuta automáticamente se degrada; es la mayor ganancia por esfuerzo |
| 2 | Añadir Firefox y WebKit a la matriz de Playwright | Es cambiar la configuración; el arrastrar y soltar es el punto de mayor riesgo entre navegadores |
| 3 | Incorporar pruebas de accesibilidad automatizadas | Un defecto de accesibilidad excluye usuarios, y la base ya está en los `data-testid` |
| 4 | Ejecutar un escaneo con OWASP ZAP | Verificación independiente que puede encontrar lo que las pruebas propias no anticiparon |
| 5 | Elevar `UV_THREADPOOL_SIZE` en producción | El grupo de hilos por defecto (4) es el cuello de botella de la autenticación concurrente |
| 6 | Añadir pruebas con volumen de datos | Validar el comportamiento con cientos de tareas por columna |
| 7 | Monitorear la estabilidad de la suite en el tiempo | La intermitencia reaparece; conviene detectarla pronto (ver DEF-007) |
| 8 | Migrar a un controlador de SQLite estable | Reduce el riesgo del módulo experimental |

---

## 10. Conclusiones

1. **Los 8 criterios de salida se cumplen.** 356 pruebas en verde, 98.47 % de
   cobertura de líneas, 0 defectos abiertos y los 5 criterios de rendimiento
   satisfechos.

2. **El valor del proceso estuvo en los defectos que encontró, no en los
   números verdes.** Los dos defectos de severidad alta (texto corrupto en
   pantalla y bloqueo del servidor bajo concurrencia) habrían afectado a todos
   los usuarios y ninguna métrica de cobertura los habría señalado.

3. **La cobertura alta no equivale a calidad.** Con 287 pruebas de servidor en
   verde y 98 % de cobertura, el sistema tenía tres defectos visibles. En
   DEF-001, además, las pruebas protegían activamente el comportamiento
   equivocado.

4. **Cada nivel de prueba encuentra defectos que los otros no pueden ver.** Las
   unitarias verificaron los límites; las de integración, el contrato de la
   API; las end-to-end encontraron 6 de los 8 defectos; la prueba de carga
   encontró uno que ninguna otra podía revelar. Eliminar un nivel habría dejado
   defectos sin detectar.

5. **El código de pruebas necesita el mismo rigor que el de producción.** La
   mitad de los defectos registrados estaban en las propias pruebas: una
   comparación contra `undefined` que no verificaba nada y dos lecturas sin
   espera que producían intermitencia.

6. **La aplicación quedó con una red de seguridad real.** Los 8 defectos tienen
   pruebas de regresión que fallan si reaparecen, y la suite completa corre en
   unos 40 segundos, lo bastante rápido para ejecutarse en cada cambio.
