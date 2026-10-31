# Lecciones Aprendidas — TaskFlow

**Documento:** Retrospectiva del proyecto de aseguramiento de calidad
**Fecha:** 30 de octubre de 2026

---

## 1. Lo que funcionó bien

### 1.1 Separar el dominio de la infraestructura

Escribir la validación, el ordenamiento y las métricas como **funciones puras**
sin dependencias de la base de datos ni de Express hizo que 140 pruebas
unitarias corrieran en 1.2 segundos sin un solo doble de prueba ni dato
simulado.

El efecto práctico: el módulo de ordenamiento tiene 22 pruebas que cubren casos
que serían tediosos de montar a través de la API (columna vacía, posición
negativa, posición mayor que el tamaño de la columna, inmutabilidad de la
entrada). Esa facilidad es la razón de que esos casos existan.

**Lección:** la testabilidad es una propiedad del diseño, no de las pruebas. Si
probar algo es incómodo, el problema casi siempre está en el código, no en la
prueba.

### 1.2 Base de datos en memoria para las pruebas de integración

Cada una de las 69 pruebas de integración monta la API completa sobre una base
SQLite nueva en memoria. No hay estado compartido, no hace falta limpiar entre
casos y no se abre ningún puerto.

El beneficio no previsto fue poder **verificar el estado interno**: varias
pruebas de seguridad consultan directamente la tabla para confirmar que la
contraseña se guardó como hash o que la carga de inyección quedó como texto
literal. Un escáner externo no puede hacer eso.

### 1.3 Identificadores de caso de prueba dentro del nombre de la prueba

Escribir `CP-E-044` literalmente en el nombre de la prueba hizo que la
trazabilidad entre la documentación y el código fuera verificable con una
búsqueda de texto, en lugar de depender de una tabla que se desactualiza.

Cuando un defecto aparecía, el nombre del test fallido decía de inmediato qué
caso documentado se había roto.

### 1.4 Localizadores `data-testid`

Las 60 pruebas end-to-end usan atributos `data-testid` en lugar de clases CSS o
posiciones en el DOM. Cuando se corrigió el diseño responsivo de DEF-004,
cambiaron reglas de CSS y la estructura de la barra superior: **ninguna prueba
se rompió**.

### 1.5 Medir el rendimiento con concurrencia desde el principio

DEF-008, el defecto con mayor impacto del proyecto, era invisible en una
prueba de un solo usuario: cada petición respondía en 35 ms. Solo apareció al
lanzar 50 usuarios en paralelo.

**Lección:** una prueba de rendimiento secuencial no es una prueba de
rendimiento. Lo que importa es qué pasa cuando las peticiones compiten por los
mismos recursos.

### 1.6 Guardar evidencias automáticamente de cada fallo

Configurar Playwright para capturar pantalla, video y traza solo cuando una
prueba falla costó tres líneas de configuración y resultó decisivo: la
documentación de DEF-001 a DEF-007 se escribió a partir de esas evidencias, sin
necesidad de reproducir los fallos a mano.

---

## 2. Lo que se haría distinto

### 2.1 Validar la cadena de herramientas antes de escribir las pruebas

Se escribieron **cuatro archivos completos de pruebas end-to-end** antes de
descubrir que Playwright 1.49.1 se colgaba indefinidamente con Node.js 25.

El diagnóstico llevó varias iteraciones: revisar si era el servidor web, si era
el shell, si era el código del proyecto. Al final el problema se aisló con una
configuración mínima y un único test trivial, que también se colgaba.

**Lección:** antes de invertir horas en una suite, escribir un "hola mundo" de
cada herramienta y comprobar que termina. Diez minutos al inicio habrían
ahorrado todo ese trabajo a riesgo.

### 2.2 Pensar en qué capa va cada control antes de probarlo

El error de diseño de DEF-001 fue escapar el HTML al entrar el dato. Lo grave
no es haberlo hecho, sino que **las pruebas lo consagraron**: afirmaban
explícitamente que el valor almacenado no debía contener `<`.

Durante 287 pruebas en verde, la suite estaba protegiendo un defecto.

**Lección:** una prueba no valida que el diseño sea correcto, solo que el código
hace lo que la prueba dice. Antes de escribir una aserción conviene preguntarse
*por qué* ese es el comportamiento correcto y en qué capa corresponde el
control. En el caso del escapado, la respuesta correcta es "en la salida, según
el contexto", y eso se verifica en el navegador.

### 2.3 Usar aserciones con espera automática desde el primer día

DEF-002 y DEF-007 son el mismo error cometido dos veces: leer el DOM con
`textContent()` o `allTextContents()`, que son lecturas instantáneas, en lugar
de usar aserciones que reintentan.

DEF-007 fue especialmente molesto porque **pasó en una ejecución y falló en la
siguiente sin ningún cambio de código**. Ese tipo de intermitencia enseña al
equipo a repetir la ejecución en vez de investigar, y así se pierde la
confianza en toda la suite.

**Lección:** en pruebas de interfaz, nunca leer el estado directamente. Usar
`expect(locator).toHaveText(...)` o `expect.poll(...)`, que esperan a que la
condición se cumpla.

### 2.4 Verificar que la aserción realmente se ejecuta

En DEF-006 el centinela de XSS nunca se inicializaba porque
`page.addInitScript()` solo se aplica en la siguiente navegación. La aserción
comparaba `undefined` con `false`.

Lo preocupante es lo cerca que estuvo de pasar desapercibido: una variante
ligeramente distinta (`expect(x).not.toBe(true)`) habría dado verde sin
verificar nada. Una prueba de seguridad que no ejecuta su verificación es peor
que no tenerla, porque da falsa confianza.

**Lección:** al escribir una prueba, comprobar que **falla** cuando debe fallar.
Una prueba que nunca se ha visto en rojo no se ha verificado.

### 2.5 Separar los umbrales de rendimiento por clase de operación

El primer intento usó un umbral global (p95 ≤ 500 ms) que mezclaba el alta de
usuarios con la lectura del tablero. El resultado era un p95 dominado por
scrypt que ocultaba el comportamiento real: después de corregir DEF-008 el CRUD
pasó de 131 ms a 33 ms, y un umbral global no habría mostrado esa mejora.

**Lección:** un promedio sobre operaciones de naturaleza distinta no mide nada.
Las operaciones con costo intencional (derivación de clave) necesitan su propio
criterio y su propia justificación.

### 2.6 Documentar los defectos mientras se corrigen

Varias correcciones se hicieron antes de escribir su entrada en la bitácora.
Reconstruir después la causa raíz exacta y las cifras de antes y después obligó
a volver sobre los registros de ejecución.

**Lección:** escribir la entrada de la bitácora **antes** de corregir, con la
evidencia del fallo pegada. La causa raíz es más clara cuando el defecto está
vivo.

---

## 3. Qué sorprendió

### 3.1 El 98 % de cobertura no detectó tres defectos visibles

Es el hallazgo central del proyecto. Con 287 pruebas de servidor en verde y
98.47 % de cobertura de líneas, la aplicación tenía tres defectos que cualquier
usuario habría notado en el primer minuto: el texto aparecía corrupto, el token
se quedaba en el navegador al cerrar sesión y la página se desplazaba en móvil.

La cobertura mide **qué código se ejecutó**, no si lo que hace es correcto. En
DEF-001 la línea defectuosa estaba cubierta al 100 % por pruebas que afirmaban
el comportamiento equivocado.

### 3.2 La mitad de los defectos estaban en las pruebas

Cuatro de los ocho defectos (DEF-002, DEF-005, DEF-006, DEF-007) eran del
código de pruebas, no de la aplicación. Dos producían intermitencia y uno dejaba
una verificación de seguridad sin ejecutar.

Esto cambió la forma de ver la suite: **el código de pruebas es código**, con
sus propios defectos, y merece el mismo rigor. Su densidad de defectos (6.24
por KLOC) resultó ser la más alta del proyecto.

### 3.3 El defecto más grave no era funcional

DEF-008 no rompía ninguna funcionalidad: todas las pruebas funcionales pasaban.
Era un problema de **arquitectura de ejecución**: una operación costosa
bloqueaba el único hilo y degradaba el sistema entero. Corregirlo triplicó el
rendimiento sin cambiar una sola regla de negocio.

### 3.4 La prueba de un defecto puede mejorar el diseño

Al corregir DEF-003 (token persistente en el navegador), el arreglo no fue solo
cumplir la aserción: limpiar el estado local **antes** de llamar al servidor es
además mejor comportamiento, porque si la red falla el token no queda
abandonado en el navegador.

La prueba no solo detectó un defecto: señaló un orden de operaciones
equivocado.

---

## 4. Decisiones técnicas y su justificación

| Decisión | Alternativa descartada | Motivo |
|---|---|---|
| Vitest para unitarias e integración | Jest | Mismo ejecutor para ambos niveles, arranque más rápido y soporte nativo de módulos ES |
| Playwright para end-to-end | Selenium, Cypress | Esperas automáticas, trazas y videos integrados, y menos intermitencia por diseño |
| `node:sqlite` nativo | `better-sqlite3`, PostgreSQL | Sin dependencias binarias y con SQL real, que hace significativas las pruebas de inyección |
| Base en memoria para integración | Base compartida con limpieza | Aislamiento total entre casos y ejecución en paralelo sin interferencias |
| Token Bearer en `localStorage` | Cookie de sesión | Simplifica las pruebas de la API; en producción una cookie `HttpOnly` sería más segura |
| Script propio de carga | JMeter, Gatling, k6 | Sin instalación adicional y reutiliza las funciones de métricas ya probadas |
| Pruebas de seguridad propias | OWASP ZAP | Quedan dentro del ciclo de regresión y pueden verificar el estado de la base de datos |
| Bitácora en Markdown | Jira, Trello | Versionada junto al código, por lo que cada defecto queda ligado a su corrección |

### Decisión que se revisaría

El token en `localStorage` es cómodo para probar la API, pero una cookie
`HttpOnly` con `SameSite=Strict` sería más resistente al robo de token mediante
XSS, porque JavaScript no podría leerla. Se eligió el token por simplicidad de
las pruebas, y eso es priorizar la comodidad del proceso por encima de la
seguridad del producto. En un sistema real se usaría la cookie y se adaptarían
las pruebas.

---

## 5. Conclusiones de la retrospectiva

1. **La testabilidad se diseña, no se añade.** Separar las funciones puras del
   acceso a datos fue la decisión que hizo posible todo lo demás.

2. **Cada nivel de prueba ve lo que los otros no.** Las end-to-end encontraron
   6 de 8 defectos; la de carga encontró el de mayor impacto. Ningún nivel es
   redundante.

3. **La cobertura es un indicador, no un objetivo.** 98 % de cobertura convivió
   con tres defectos visibles. Lo que importa es qué verifican las aserciones.

4. **Una prueba que no se ha visto fallar no está verificada.** Dos defectos del
   proyecto fueron pruebas que no comprobaban lo que aparentaban.

5. **La intermitencia es un defecto, no un inconveniente.** Una prueba que falla
   una vez de cada tres destruye la confianza en la suite completa.

6. **Probar con un usuario no es probar.** El defecto más grave solo existía
   bajo concurrencia.

7. **Las herramientas se validan antes de usarlas.** Un "hola mundo" de cada
   herramienta al inicio evita descubrir incompatibilidades a mitad del trabajo.
