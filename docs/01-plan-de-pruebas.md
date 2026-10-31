# Plan de Aseguramiento de Calidad — TaskFlow

**Proyecto:** TaskFlow, aplicación web de gestión de tareas
**Documento:** Plan de pruebas
**Versión:** 1.0
**Fecha:** 30 de octubre de 2026
**Autor:** Oscar Rivera
**Curso:** Aseguramiento de Calidad de Software

---

## 1. Introducción

### 1.1 Propósito

Este documento define la estrategia, el alcance, los recursos y el calendario
de las actividades de aseguramiento de calidad para **TaskFlow**, una
aplicación web de gestión de tareas organizada en un tablero de tres columnas
(pendientes, en progreso, completadas), con autenticación de usuarios y
reordenamiento mediante arrastrar y soltar.

El objetivo no es solo encontrar defectos, sino dejar instalada una red de
pruebas automatizadas que permita modificar el sistema con confianza y medir
objetivamente su calidad.

### 1.2 Descripción del sistema bajo prueba

TaskFlow es una aplicación web de una sola página con API REST propia:

| Capa | Tecnología | Responsabilidad |
|---|---|---|
| Presentación | HTML, CSS y JavaScript sin framework | Tablero, formularios, arrastrar y soltar |
| API | Node.js con Express | Rutas REST, autenticación por token, cabeceras de seguridad |
| Dominio | JavaScript (funciones puras) | Validación, ordenamiento, métricas, hash de contraseñas |
| Persistencia | SQLite (`node:sqlite`) | Usuarios, sesiones y tareas |

La arquitectura separa deliberadamente el dominio de la infraestructura: las
reglas de negocio son funciones puras, lo que las hace verificables con
pruebas unitarias rápidas y sin dobles de prueba.

---

## 2. Requerimientos del sistema

### 2.1 Historias de usuario

| ID | Historia | Criterios de aceptación |
|---|---|---|
| HU-01 | Como visitante quiero **crear una cuenta** para tener mi propio tablero | Nombre, correo válido y contraseña de al menos 8 caracteres con letra y número; no se permiten correos duplicados |
| HU-02 | Como usuario registrado quiero **iniciar sesión** para acceder a mis tareas | Credenciales correctas abren sesión; credenciales incorrectas muestran un mensaje que no revela si el correo existe |
| HU-03 | Como usuario quiero **cerrar sesión** para proteger mi información | El token deja de ser válido y se elimina del navegador |
| HU-04 | Como usuario quiero **crear tareas** con título, descripción, prioridad y fecha | El título es obligatorio (3 a 100 caracteres); la tarea nace en "pendientes" |
| HU-05 | Como usuario quiero **editar** una tarea para corregirla | Se puede editar cualquier campo; una edición parcial no pierde los demás datos |
| HU-06 | Como usuario quiero **eliminar** una tarea | La tarea desaparece del tablero de forma permanente |
| HU-07 | Como usuario quiero **mover tareas entre columnas** arrastrándolas | La tarea cambia de estado y de posición, y el cambio persiste |
| HU-08 | Como usuario quiero **reordenar tareas** dentro de una columna | El nuevo orden se conserva sin huecos ni duplicados |
| HU-09 | Como usuario quiero **buscar y filtrar** mis tareas | Filtro por texto y por prioridad, sin distinguir mayúsculas |
| HU-10 | Como usuario quiero que **mis tareas sean privadas** | Ningún usuario puede leer, editar, mover ni eliminar tareas de otro |

### 2.2 Requerimientos no funcionales

| ID | Requerimiento | Criterio medible |
|---|---|---|
| RNF-01 | Rendimiento del CRUD | p95 ≤ 500 ms y promedio ≤ 200 ms con 50 usuarios concurrentes |
| RNF-02 | Rendimiento de autenticación | p95 ≤ 1500 ms (incluye la derivación de clave, costosa por diseño) |
| RNF-03 | Fiabilidad bajo carga | Tasa de error ≤ 1 % |
| RNF-04 | Seguridad de contraseñas | Nunca se almacenan ni se devuelven en texto plano |
| RNF-05 | Resistencia a inyección SQL | Toda consulta usa sentencias preparadas con parámetros enlazados |
| RNF-06 | Resistencia a XSS | Ninguna entrada del usuario llega a ejecutarse en el navegador |
| RNF-07 | Protección contra fuerza bruta | Máximo 5 intentos de inicio de sesión por minuto y por correo |
| RNF-08 | Usabilidad responsiva | Sin desplazamiento horizontal desde 390 px de ancho |

---

## 3. Alcance de las pruebas

### 3.1 Incluido

- Validación de datos de entrada en todos los campos del sistema
- Flujo completo de autenticación (registro, inicio y cierre de sesión, sesiones)
- Operaciones CRUD de tareas a través de la API y de la interfaz
- Lógica de ordenamiento del tablero y arrastrar y soltar
- Aislamiento de datos entre usuarios
- Seguridad: inyección SQL, XSS, control de acceso y cabeceras HTTP
- Rendimiento con usuarios concurrentes
- Comportamiento responsivo en viewport móvil

### 3.2 Excluido y justificación

| Fuera de alcance | Justificación |
|---|---|
| Compatibilidad con varios navegadores | Se prueba solo Chromium; el resto se evaluaría en una fase posterior |
| Pruebas de accesibilidad con lector de pantalla | Requiere herramientas y criterios que exceden el período del proyecto |
| Recuperación de contraseña y correo transaccional | No está implementada en esta versión |
| Pruebas de penetración manuales con OWASP ZAP | Se cubren por pruebas automatizadas equivalentes; se documenta como recomendación |
| Tolerancia a fallos de infraestructura | La aplicación corre en un único nodo |

---

## 4. Estrategia de pruebas

La estrategia sigue la **pirámide de pruebas**: muchas pruebas unitarias
rápidas en la base, un número intermedio de pruebas de integración y un
conjunto reducido pero representativo de pruebas end-to-end.

```
          /\          End-to-end (60)      ─ navegador real, flujos completos
         /  \
        /----\        Integración (69)     ─ API + base de datos
       /      \
      /--------\      Seguridad (87)       ─ inyección, XSS, control de acceso
     /          \
    /------------\    Unitarias (140)      ─ funciones puras del dominio
```

### 4.1 Pruebas unitarias

| Aspecto | Definición |
|---|---|
| **Objetivo** | Verificar que cada función del dominio se comporta correctamente de forma aislada, incluidos los valores límite y las entradas inválidas |
| **Alcance** | `validadores.js`, `sanitizer.js`, `ordenamiento.js`, `metricas.js`, `password.js`, `limitador.js` |
| **Herramienta** | Vitest 2.1.8 |
| **Técnica** | Partición de equivalencia, análisis de valores límite y pruebas de funciones puras |
| **Criterio de aceptación** | 100 % de las pruebas pasan; cobertura de líneas ≥ 85 % y de ramas ≥ 80 % |

Se concentra el mayor esfuerzo en `ordenamiento.js` porque es el módulo con más
casos borde (columna vacía, posición fuera de rango, reordenamiento dentro de la
misma columna, tarea inexistente).

### 4.2 Pruebas de integración

| Aspecto | Definición |
|---|---|
| **Objetivo** | Comprobar que la ruta HTTP, el servicio, el repositorio y la base de datos funcionan correctamente en conjunto |
| **Alcance** | Todos los endpoints de `/api/auth` y `/api/tareas` |
| **Herramientas** | Vitest + Supertest |
| **Técnica** | Pruebas de contrato de la API: código de estado, forma de la respuesta y efecto real en la base de datos |
| **Aislamiento** | Cada caso monta la API sobre una base SQLite **en memoria** nueva, por lo que no hay estado compartido ni necesidad de limpieza |
| **Criterio de aceptación** | 100 % de las pruebas pasan |

### 4.3 Pruebas funcionales (end-to-end)

| Aspecto | Definición |
|---|---|
| **Objetivo** | Validar los flujos de usuario completos en un navegador real, tal como los vive la persona |
| **Alcance** | Registro, inicio y cierre de sesión, CRUD de tareas, arrastrar y soltar, filtros, persistencia y responsividad |
| **Herramienta** | Playwright 1.64.1 sobre Chromium |
| **Técnica** | Pruebas basadas en escenarios, con localizadores `data-testid` estables |
| **Aislamiento** | Cada prueba registra un usuario con correo único, lo que permite ejecutarlas en paralelo |
| **Evidencia** | Captura de pantalla, video y traza automáticos ante cualquier fallo |
| **Criterio de aceptación** | 100 % de las pruebas pasan y ninguna es intermitente en 3 ejecuciones consecutivas |

### 4.4 Pruebas de regresión

| Aspecto | Definición |
|---|---|
| **Objetivo** | Garantizar que una corrección o una funcionalidad nueva no rompe lo que ya funcionaba |
| **Mecanismo** | La suite completa es la suite de regresión: `npm run test:regresion` ejecuta cobertura y end-to-end |
| **Regla del proyecto** | **Cada defecto corregido incorpora una prueba que falla antes de la corrección y pasa después.** Esa prueba queda en la suite de forma permanente |
| **Criterio de aceptación** | Ninguna prueba previamente verde se vuelve roja |

### 4.5 Pruebas de seguridad

| Aspecto | Definición |
|---|---|
| **Objetivo** | Verificar que los controles de seguridad resisten los ataques más comunes contra aplicaciones web |
| **Amenazas evaluadas** | Inyección SQL, XSS almacenado, control de acceso roto (referencia directa insegura a objetos), fuerza bruta, enumeración de usuarios, exposición de información sensible y ausencia de cabeceras de protección |
| **Herramientas** | Vitest + Supertest para el servidor, Playwright para el navegador |
| **Técnica** | Inyección de cargas maliciosas conocidas y verificación de que se tratan como datos inertes |
| **Criterio de aceptación** | Ninguna carga logra ejecutarse, alterar el esquema ni acceder a datos ajenos |

La verificación se hace en **dos capas**, porque una sola no basta:

1. **En el servidor** se comprueba que el dato se almacena íntegro, que la
   respuesta se sirve como JSON y que las consultas están parametrizadas.
2. **En el navegador** se comprueba que la carga no se ejecuta al renderizarse.

### 4.6 Pruebas de rendimiento

| Aspecto | Definición |
|---|---|
| **Objetivo** | Confirmar que el sistema atiende usuarios simultáneos dentro de los tiempos acordados |
| **Escenario** | 50 usuarios concurrentes; cada uno se registra, crea 5 tareas, consulta el tablero y su resumen, mueve y edita una tarea, y vuelve a iniciar sesión (550 peticiones) |
| **Herramienta** | Script propio en Node.js (`tests/performance/carga.js`) |
| **Métricas** | Promedio, p50, p95, p99, máximo, peticiones por segundo y tasa de error |
| **Criterio de aceptación** | RNF-01, RNF-02 y RNF-03 |

Los umbrales se evalúan **por clase de operación**. Mezclar el alta de usuarios
con la lectura del tablero produce un p95 global dominado por la derivación de
clave y oculta el comportamiento real de la aplicación.

---

## 5. Entorno de pruebas

| Elemento | Versión / valor |
|---|---|
| Sistema operativo | Windows 11 |
| Node.js | 25.2.1 |
| npm | 11.6.2 |
| Navegador | Chromium (Playwright 1.64.1) |
| Base de datos de pruebas unitarias e integración | SQLite en memoria |
| Base de datos de pruebas end-to-end | `evidencias/e2e.db` (archivo desechable) |
| Puerto del servidor en pruebas end-to-end | 3100 |

---

## 6. Criterios de entrada y salida

### 6.1 Criterios de entrada

- El código compila y el servidor arranca sin errores
- Las dependencias están instaladas y el navegador de Playwright descargado
- Los casos de prueba están documentados y revisados

### 6.2 Criterios de salida

| # | Criterio | Umbral |
|---|---|---|
| 1 | Pruebas unitarias, de integración y de seguridad | 100 % en verde |
| 2 | Pruebas end-to-end | 100 % en verde |
| 3 | Cobertura de líneas | ≥ 85 % |
| 4 | Cobertura de ramas | ≥ 80 % |
| 5 | Defectos de severidad alta abiertos | 0 |
| 6 | Defectos de severidad media abiertos | 0 |
| 7 | Criterios de rendimiento (RNF-01 a RNF-03) | Todos cumplidos |
| 8 | Pruebas intermitentes | 0 en 3 ejecuciones consecutivas |

---

## 7. Clasificación de defectos

### 7.1 Severidad

| Nivel | Definición | Tiempo objetivo de corrección |
|---|---|---|
| **Crítica** | Impide usar el sistema o expone datos de otros usuarios | Inmediato, bloquea la entrega |
| **Alta** | Funcionalidad principal incorrecta, o degradación grave de rendimiento o seguridad | Antes de la entrega |
| **Media** | Funcionalidad secundaria incorrecta, o problema de usabilidad con alternativa | Antes de la entrega |
| **Baja** | Defecto cosmético o de mantenibilidad | Puede diferirse |

### 7.2 Ciclo de vida

```
Abierto → En análisis → En corrección → Corregido → Verificado → Cerrado
                                                 ↘ Reabierto ↗
```

Un defecto solo pasa a **Verificado** cuando existe una prueba automatizada que
lo demuestra, y solo se **Cierra** cuando la suite completa vuelve a estar verde.

### 7.3 Gestión

El seguimiento se lleva en `docs/03-bitacora-defectos.md`, que cumple la función
que en un equipo real tendría un tablero de Jira o Trello. Cada defecto registra
identificador, título, severidad, tipo, módulo, cómo se detectó, causa raíz,
corrección aplicada y prueba de regresión asociada.

---

## 8. Riesgos del proyecto

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| Pruebas end-to-end intermitentes por condiciones de carrera | Alta | Medio | Usar siempre aserciones con espera automática; verificar con 3 ejecuciones repetidas |
| Incompatibilidad entre versiones de herramientas y Node.js | Media | Alto | Fijar versiones exactas en `package.json` y validar la ejecución desde el inicio |
| Cobertura alta pero de poco valor | Media | Alto | Priorizar casos límite y entradas inválidas sobre el camino feliz |
| El escapado de datos aplicado en la capa equivocada | Media | Alto | Verificar la seguridad en dos capas: almacenamiento y renderizado |
| Operaciones costosas que bloquean el servidor | Media | Alto | Medir con usuarios concurrentes, no con peticiones sueltas |

---

## 9. Calendario

| Semana | Fase | Entregable |
|---|---|---|
| 1 | Planificación | Requerimientos, estrategia y este plan |
| 2 | Diseño de casos de prueba | `02-casos-de-prueba.md` |
| 3 | Automatización | Suites de Vitest y Playwright |
| 4 | Ejecución y gestión de defectos | `03-bitacora-defectos.md` y reportes de ejecución |
| 5 | Evaluación de la calidad | Métricas de cobertura, defectos, seguridad y rendimiento |
| 6 | Documentación final | `04-informe-final.md`, `05-lecciones-aprendidas.md` y presentación |

---

## 10. Entregables

| Entregable | Ubicación |
|---|---|
| Plan de pruebas | `docs/01-plan-de-pruebas.md` |
| Casos de prueba | `docs/02-casos-de-prueba.md` |
| Bitácora de defectos | `docs/03-bitacora-defectos.md` |
| Informe final de pruebas | `docs/04-informe-final.md` |
| Lecciones aprendidas | `docs/05-lecciones-aprendidas.md` |
| Presentación | `docs/06-presentacion.md` |
| Código de pruebas automatizadas | `tests/` |
| Evidencias de ejecución | `evidencias/` |
