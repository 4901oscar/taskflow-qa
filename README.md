# TaskFlow — Plan de Aseguramiento de Calidad

Aplicación web de gestión de tareas con un plan de aseguramiento de calidad
completo: **356 pruebas automatizadas** en cuatro niveles, pruebas de seguridad,
prueba de carga y documentación de todo el ciclo.

Proyecto final de la asignatura **Aseguramiento de Calidad de Software**.
Autor: Oscar Rivera · Octubre de 2026

---

## Resultados

| Métrica | Valor |
|---|---|
| Pruebas automatizadas | 356 (100 % en verde) |
| Cobertura de líneas | 98.47 % |
| Cobertura de ramas | 93.67 % |
| Defectos encontrados y corregidos | 8 |
| Densidad de defectos | 1.85 por KLOC |
| Rendimiento | 315 peticiones/s con 50 usuarios concurrentes |
| Duración de la suite completa | ~40 segundos |

---

## Requisitos

- **Node.js 22.5 o superior** (se usa el módulo nativo `node:sqlite`).
  Probado con Node.js 25.2.1.
- npm 10 o superior

---

## Instalación

```bash
npm install
npx playwright install chromium
```

---

## Ejecutar la aplicación

```bash
npm start
```

Abrir <http://localhost:3000>, crear una cuenta y empezar a usar el tablero.

Variables de entorno opcionales:

| Variable | Valor por defecto | Descripción |
|---|---|---|
| `PORT` | `3000` | Puerto del servidor |
| `DB_PATH` | `taskflow.db` | Archivo de la base de datos SQLite |

---

## Ejecutar las pruebas

```bash
npm test                  # unitarias + integración + seguridad (296)
npm run test:unit         # solo unitarias (140)
npm run test:integration  # solo integración (69)
npm run test:seguridad    # solo seguridad (87)
npm run test:coverage     # las 296 con reporte de cobertura
npm run test:e2e          # end-to-end con Playwright (60)
npm run test:rendimiento  # prueba de carga con 50 usuarios concurrentes
npm run test:regresion    # cobertura + end-to-end
npm run test:todo         # todo, incluida la prueba de carga
npm run metricas          # métricas consolidadas de calidad
```

Para ver el reporte de las pruebas end-to-end:

```bash
npm run test:reporte-e2e
```

El reporte de cobertura queda en `evidencias/cobertura/index.html`.

> La prueba de carga admite ajustes:
> `USUARIOS=100 TAREAS=10 npm run test:rendimiento`

---

## Documentación

| Documento | Contenido |
|---|---|
| [Plan de pruebas](docs/01-plan-de-pruebas.md) | Requerimientos, estrategia, criterios de entrada y salida, riesgos |
| [Casos de prueba](docs/02-casos-de-prueba.md) | Catálogo de casos con trazabilidad a los requerimientos |
| [Bitácora de defectos](docs/03-bitacora-defectos.md) | Los 8 defectos con causa raíz, corrección y prueba de regresión |
| [Informe final](docs/04-informe-final.md) | Resultados, métricas de calidad, reservas y recomendaciones |
| [Lecciones aprendidas](docs/05-lecciones-aprendidas.md) | Retrospectiva del proceso |
| [Presentación](docs/06-presentacion.md) | Guion de 15 diapositivas |

---

## Estructura del proyecto

```
proyecto_final/
├── src/                          Código de la aplicación
│   ├── domain/                   Funciones puras: validación, ordenamiento,
│   │                             métricas, contraseñas
│   ├── db/esquema.js             Esquema SQLite
│   ├── repositories/             Acceso a datos (sentencias preparadas)
│   ├── services/                 Casos de uso
│   ├── http/                     Aplicación Express y limitador de intentos
│   ├── errores.js                Errores de aplicación con código HTTP
│   └── server.js                 Punto de entrada
├── public/                       Interfaz (HTML, CSS y JavaScript)
├── tests/
│   ├── unit/                     140 pruebas unitarias
│   ├── integration/              69 pruebas de integración
│   ├── seguridad/                87 pruebas de seguridad
│   ├── e2e/                      60 pruebas end-to-end
│   ├── performance/carga.js      Prueba de carga
│   └── ayudas/servidor.js        Utilidades compartidas
├── scripts/metricas.js           Cálculo de métricas de calidad
├── docs/                         Documentación del plan de calidad
├── evidencias/                   Reportes generados (cobertura, JUnit, carga)
├── vitest.config.js
└── playwright.config.js
```

---

## Arquitectura

La aplicación separa el dominio de la infraestructura. Las reglas de negocio
(validación, ordenamiento del tablero, métricas) son **funciones puras** sin
dependencias de la base de datos ni de Express, lo que permite probarlas sin
dobles de prueba ni datos simulados.

```
Navegador  ──HTTP──▶  Express  ──▶  Servicios  ──▶  Repositorios  ──▶  SQLite
                                        │
                                        ▼
                                     Dominio
                              (funciones puras)
```

### Estrategia de pruebas

| Nivel | Qué verifica | Herramienta |
|---|---|---|
| Unitarias | Funciones del dominio, con sus valores límite | Vitest |
| Integración | Ruta HTTP → servicio → repositorio → SQLite | Vitest + Supertest |
| Seguridad | Inyección SQL, XSS, control de acceso, cabeceras | Vitest + Supertest |
| End-to-end | Flujos completos en un navegador real | Playwright |
| Carga | 50 usuarios concurrentes, 550 peticiones | Script en Node.js |

Las pruebas de integración y de seguridad montan la API sobre una base SQLite
**en memoria** nueva en cada caso: aislamiento total, sin limpieza entre pruebas
y sin abrir puertos. Las end-to-end registran un usuario con correo único por
prueba, lo que permite ejecutarlas en paralelo.

---

## Controles de seguridad implementados

| Control | Implementación |
|---|---|
| Inyección SQL | Todas las consultas usan sentencias preparadas con parámetros enlazados |
| Contraseñas | scrypt asíncrono con sal aleatoria por usuario |
| Comparación de hash | `timingSafeEqual` (tiempo constante) |
| XSS | Codificación en la salida (`textContent`) más CSP sin `unsafe-inline` |
| Aislamiento entre usuarios | Toda consulta de tareas filtra por `usuario_id` |
| Enumeración de usuarios | Mismo mensaje para credenciales inválidas y usuario inexistente |
| Fuerza bruta | Límite de 5 intentos por minuto y por correo |
| Cabeceras | `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, CSP; `X-Powered-By` deshabilitada |
| Tamaño del cuerpo | Límite de 64 KB |

---

## API

Todas las rutas de tareas requieren la cabecera `Authorization: Bearer <token>`.

### Autenticación

| Método | Ruta | Descripción |
|---|---|---|
| `POST` | `/api/auth/registro` | Crear una cuenta y abrir sesión |
| `POST` | `/api/auth/login` | Iniciar sesión |
| `POST` | `/api/auth/logout` | Revocar el token actual |
| `GET` | `/api/auth/yo` | Usuario de la sesión activa |

### Tareas

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/tareas` | Listar; admite `estado`, `prioridad` y `busqueda` |
| `GET` | `/api/tareas/resumen` | Conteo por columna |
| `POST` | `/api/tareas` | Crear una tarea |
| `GET` | `/api/tareas/:id` | Obtener una tarea |
| `PUT` | `/api/tareas/:id` | Editar (admite edición parcial) |
| `PATCH` | `/api/tareas/:id/mover` | Mover de columna o reordenar |
| `DELETE` | `/api/tareas/:id` | Eliminar |

### Técnicas

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/salud` | Estado del servicio |
| `GET` | `/api/catalogos` | Estados y prioridades válidos |

### Códigos de estado

| Código | Significado |
|---|---|
| `400` | Identificador o cuerpo mal formado |
| `401` | Falta autenticación o el token no es válido |
| `404` | Recurso inexistente o ajeno al usuario |
| `409` | Correo ya registrado |
| `413` | Cuerpo demasiado grande |
| `422` | Error de validación (incluye el detalle por campo) |
| `429` | Demasiados intentos de inicio de sesión |

---

## Nota sobre `node:sqlite`

El proyecto usa el módulo SQLite nativo de Node.js para evitar dependencias
binarias. Node.js emite una advertencia indicando que la API es experimental; es
esperada y no afecta al funcionamiento. En un sistema en producción conviene
migrar a un controlador estable.
