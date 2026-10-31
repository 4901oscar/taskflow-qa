# Presentación Final — TaskFlow

**Guion de presentación** · 15 diapositivas · duración estimada 12–15 minutos
Oscar Rivera · Aseguramiento de Calidad de Software · 30 de octubre de 2026

---

## Diapositiva 1 — Portada

# Plan de Aseguramiento de Calidad
## TaskFlow — Aplicación web de gestión de tareas

Oscar Rivera
Aseguramiento de Calidad de Software
Octubre de 2026

> **Para decir:** "Construí una aplicación web de tareas y le apliqué un plan de
> calidad completo. Lo interesante no son las 356 pruebas que pasan, sino los 8
> defectos que encontraron y lo que eso enseña sobre dónde se esconden los
> problemas."

---

## Diapositiva 2 — El sistema bajo prueba

**TaskFlow:** tablero de tareas con tres columnas, autenticación y arrastrar y soltar

| Capa | Tecnología |
|---|---|
| Interfaz | HTML, CSS y JavaScript sin framework |
| API | Node.js con Express |
| Dominio | Funciones puras |
| Datos | SQLite |

**Diez historias de usuario** · registro, inicio de sesión, CRUD de tareas,
arrastrar y soltar, filtros y privacidad entre usuarios

> **Para decir:** "El dominio son funciones puras a propósito: eso hace que las
> reglas de negocio se puedan probar sin base de datos ni servidor. Fue la
> decisión que hizo posible todo lo demás."

---

## Diapositiva 3 — Estrategia: la pirámide de pruebas

```
          /\          End-to-end (60)      ─ navegador real
         /  \
        /----\        Integración (69)     ─ API + base de datos
       /      \
      /--------\      Seguridad (87)       ─ inyección, XSS, acceso
     /          \
    /------------\    Unitarias (140)      ─ dominio puro
```

**+ 1 prueba de carga** con 50 usuarios concurrentes (550 peticiones)

| Herramienta | Uso |
|---|---|
| Vitest | Unitarias, integración y seguridad |
| Playwright | End-to-end sobre Chromium |
| Script propio en Node.js | Carga y concurrencia |

> **Para decir:** "Muchas pruebas rápidas abajo, pocas y lentas arriba. Cada
> nivel encuentra defectos que los otros no pueden ver, y eso quedó demostrado."

---

## Diapositiva 4 — Resultados globales

| Métrica | Resultado |
|---|---|
| Pruebas ejecutadas | **356** |
| Tasa de éxito | **100 %** |
| Cobertura de líneas | **98.47 %** |
| Cobertura de ramas | **93.67 %** |
| Defectos encontrados | **8** |
| Defectos abiertos | **0** |
| Densidad de defectos | 1.85 por KLOC |
| Duración de la suite completa | ~40 segundos |

**Los 8 criterios de salida se cumplen.**

> **Para decir:** "Estos son los números del final. Ahora viene la parte que
> realmente importa: por qué estos números, por sí solos, no habrían bastado."

---

## Diapositiva 5 — El hallazgo central

# 287 pruebas en verde
# 98 % de cobertura
# 3 defectos que cualquier usuario habría visto

| Lo que el usuario escribía | Lo que la aplicación mostraba |
|---|---|
| `Actualizar src/http/app.js` | `Actualizar src&#x2F;http&#x2F;app.js` |

El token de sesión **seguía en el navegador** después de cerrar sesión.
La página **se desplazaba horizontalmente** en móvil.

> **Para decir:** "Con todas las pruebas de servidor en verde y 98 % de
> cobertura, la aplicación tenía tres defectos visibles en el primer minuto de
> uso. La cobertura mide qué código se ejecutó, no si lo que hace está bien."

---

## Diapositiva 6 — DEF-001: el escapado en la capa equivocada

**Síntoma**

```
Esperado: "Revisar modulo <auth> & reportes"
Obtenido: "Revisar modulo &lt;auth&gt; &amp; reportes"
```

**Causa raíz:** el HTML se escapaba **al entrar** el dato, y el cliente ya
escapaba al renderizar con `textContent`. Doble codificación.

**Lo más grave:** las pruebas de seguridad **exigían el defecto**. Afirmaban
que el valor almacenado no debía contener `<`.

> **Para decir:** "Durante 287 pruebas en verde, la suite estaba protegiendo un
> defecto. Una prueba no valida que el diseño sea correcto, solo que el código
> hace lo que la prueba dice."

---

## Diapositiva 7 — La corrección: escapar en la salida

| Capa | Responsabilidad |
|---|---|
| Entrada | Validar y normalizar |
| Almacenamiento | Guardar el dato **íntegro** |
| Salida | Codificar **según el contexto** (`textContent`) |
| Defensa en profundidad | `Content-Security-Policy` sin `unsafe-inline` |

**Verificación en dos capas:**

- **Servidor:** el dato viaja íntegro y la respuesta es JSON, nunca HTML
- **Navegador:** la carga no se ejecuta (CP-E-041 a CP-E-043)

> **Para decir:** "El escapado depende del contexto de salida: el mismo texto se
> escapa distinto en HTML, en un atributo o en una URL. Guardarlo ya escapado
> fija una sola representación y corrompe el dato para todo lo demás."

---

## Diapositiva 8 — DEF-008: el defecto que solo la concurrencia revela

**Primeras ejecuciones de la prueba de carga:**

| Operación | Promedio | p95 |
|---|---|---|
| `registro` | 2268 ms | 2296 ms |
| `login` | 2731 ms | 2737 ms |
| `crear_tarea` | 213 ms | **582 ms** |

**Causa:** `scryptSync` bloqueaba el único hilo de JavaScript de Node.js.
50 usuarios × ~45 ms de cálculo ≈ más de 2 s de espera serializada.

**Lo determinante:** `crear_tarea` **no deriva ninguna clave** y aun así
incumplió su criterio de 500 ms.

> **Para decir:** "Un solo endpoint estaba degradando el sistema completo.
> Mientras alguien se registraba, todos los demás esperaban. Y en una prueba de
> un usuario cada petición responde en 35 ms y parece perfecta."

---

## Diapositiva 9 — El resultado de la corrección

**`scryptSync` → `scrypt` asíncrono** (el cálculo pasa al grupo de hilos)

Medianas de **tres ejecuciones de cada versión**:

| Métrica | Antes | Después | Mejora |
|---|---|---|---|
| Rendimiento | 83 pet/s | **319 pet/s** | **3.8×** |
| Autenticación, promedio | 2499 ms | 459 ms | 5.4× |
| Promedio de `login` | 2731 ms | 360 ms | 7.6× |
| **CRUD, p95** | **172 ms** | **81 ms** | **2.1×** |

Rangos sin solapamiento: 77 – 104 pet/s frente a 296 – 342 pet/s.

La mejora de 2.1× en el CRUD **prueba** que el problema era el bloqueo del
bucle de eventos: esas operaciones no hacen hashing.

> **Para decir:** "Casi cuadruplicar el rendimiento sin cambiar una sola regla
> de negocio. Y medí tres veces cada versión para que la comparación no fuera
> ruido de la máquina: los rangos no se solapan."

---

## Diapositiva 10 — Por qué la autenticación sigue costando ~480 ms

**No es un defecto pendiente. Es una decisión de seguridad.**

scrypt es costoso **a propósito**: ese costo es lo que hace económicamente
inviable el descifrado por fuerza bruta si roban la base de datos.

**Umbrales separados por clase de operación:**

| Clase | p95 | Medido | Estado |
|---|---|---|---|
| CRUD de tareas | ≤ 500 ms | 80 ms | CUMPLE |
| Autenticación | ≤ 1500 ms | 919 ms | CUMPLE |

> **Para decir:** "Un umbral global mezclaba el alta de usuarios con la lectura
> del tablero y daba un p95 dominado por scrypt. Promediar operaciones de
> naturaleza distinta no mide nada."

---

## Diapositiva 11 — Seguridad: 87 pruebas, 7 amenazas

| Amenaza | Casos | Resultado |
|---|---|---|
| Inyección SQL | 43 | Ninguna carga se ejecutó como SQL |
| XSS almacenado | 30 | Ninguna carga se ejecutó en el navegador |
| Control de acceso (IDOR) | 14 | Ningún acceso cruzado entre usuarios |
| Fuerza bruta | 6 | Bloqueo tras exceder el límite |
| Enumeración de usuarios | 2 | Mensajes indistinguibles |
| Exposición de información | 4 | Sin filtrar SQL, rutas ni tokens |
| Cabeceras de protección | 5 | Las cinco presentes |

**Controles:** sentencias preparadas · scrypt con sal por usuario ·
`timingSafeEqual` · filtrado por `usuario_id` · CSP restrictiva

> **Para decir:** "Las pruebas de inyección usan 8 cargas reales. Y verifican
> además el estado de la base de datos, que un escáner externo no puede ver."

---

## Diapositiva 12 — La mitad de los defectos estaban en las pruebas

| Defecto | Problema |
|---|---|
| DEF-002 | Leer el mensaje de error antes de que apareciera |
| DEF-005 | Punto de soltado ambiguo en el arrastre |
| DEF-006 | **El centinela de XSS nunca se inicializaba** |
| DEF-007 | Aserción intermitente: verde y roja sin cambiar código |

**DEF-006 es el más preocupante:** la aserción comparaba `undefined` con
`false`. Una variante ligeramente distinta habría dado verde **sin verificar
nada**.

**Densidad de defectos más alta del proyecto:** `tests/e2e`, 6.24 por KLOC

> **Para decir:** "El código de pruebas es código, con sus propios defectos. Y
> una prueba de seguridad que no ejecuta su verificación es peor que no
> tenerla: da falsa confianza."

---

## Diapositiva 13 — Qué capa encontró cada defecto

| Capa | Pruebas | Defectos encontrados |
|---|---|---|
| Unitarias | 140 | 0 |
| Integración | 69 | 0 |
| Seguridad de API | 87 | 0 |
| **End-to-end** | **60** | **6** |
| **Carga** | 1 | **1** |
| Entorno | — | 1 |

**Ningún nivel es redundante.** Eliminar las end-to-end habría dejado pasar 6
defectos; eliminar la de carga, el de mayor impacto.

> **Para decir:** "Las 140 pruebas unitarias no encontraron ningún defecto, y no
> por eso sobran: son las que permiten cambiar el código con confianza. Pero
> solas no bastan."

---

## Diapositiva 14 — Reservas y recomendaciones

**Lo que no se probó**

- Un solo navegador (Chromium); sin Firefox ni Safari
- Sin pruebas de accesibilidad con tecnología asistiva
- Carga medida en local, en un solo nodo
- Sin escaneo independiente con OWASP ZAP
- `node:sqlite` es un módulo experimental

**Recomendaciones por valor sobre esfuerzo**

1. Integración continua que ejecute la suite en cada cambio
2. Añadir Firefox y WebKit a la matriz de Playwright
3. Pruebas de accesibilidad automatizadas
4. Escaneo con OWASP ZAP como verificación independiente
5. Elevar `UV_THREADPOOL_SIZE` en producción

> **Para decir:** "Sin integración continua, nada garantiza que la suite se
> ejecute. Una suite que no se ejecuta se degrada."

---

## Diapositiva 15 — Conclusiones

1. **La cobertura es un indicador, no un objetivo.** 98 % convivió con tres
   defectos visibles.

2. **Una prueba no valida el diseño.** En DEF-001 la suite protegía el
   comportamiento equivocado.

3. **Cada nivel ve lo que los otros no.** Las end-to-end encontraron 6 de 8; la
   de carga, el de mayor impacto.

4. **Probar con un usuario no es probar.** El defecto más grave solo existía
   bajo concurrencia.

5. **El código de pruebas necesita el mismo rigor.** La mitad de los defectos
   estaban ahí.

6. **Una prueba que no se ha visto fallar no está verificada.**

**Los 8 defectos tienen pruebas de regresión. La suite corre en 40 segundos.**

> **Para cerrar:** "El entregable no son las 356 pruebas en verde. Es una red
> que falla si alguno de estos 8 defectos vuelve, y que corre lo bastante rápido
> para ejecutarse en cada cambio."

---

## Anexo — Demostración en vivo (3 minutos)

| Paso | Comando o acción | Qué mostrar |
|---|---|---|
| 1 | `npm start` y abrir el navegador | Crear una tarea, arrastrarla entre columnas |
| 2 | Escribir una tarea titulada `Actualizar src/http/app.js` | Se muestra correctamente (regresión de DEF-001) |
| 3 | Escribir `<script>alert(1)</script>` como título | Se muestra como texto, no se ejecuta |
| 4 | `npm run test:unit` | 140 pruebas en 1.2 s |
| 5 | `npm run test:e2e` | Chromium recorriendo los flujos |
| 6 | `npm run test:rendimiento` | Tabla de percentiles y criterios de salida |
| 7 | Abrir `evidencias/cobertura/index.html` | Cobertura por módulo |

### Preguntas previsibles

**¿Por qué no usaron Jest / Selenium / JMeter?**
Vitest comparte ejecutor para unitarias e integración y soporta módulos ES de
forma nativa. Playwright trae esperas automáticas, trazas y videos, lo que
reduce la intermitencia por diseño. El script de carga propio evita una
instalación adicional y reutiliza las funciones de métricas ya probadas.

**¿98 % de cobertura no es excesivo?**
El objetivo era 85 %. El 98 % salió de probar los casos borde, no de perseguir
el número. Y aun así quedaron tres defectos: es el argumento de que la
cobertura no es la meta.

**¿Por qué la autenticación tarda ~480 ms?**
Porque scrypt es costoso por diseño: es la defensa contra fuerza bruta offline.
Abaratarlo mejoraría el informe y debilitaría la seguridad real.

**¿Qué pasa si un defecto reaparece?**
Falla al menos una prueba automatizada. Cada uno de los 8 defectos tiene su
prueba de regresión, con la trazabilidad en la sección 11.3 de la bitácora.
