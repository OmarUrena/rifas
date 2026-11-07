# Estado del backend

M5: editor integrado con CRUD existente, indicadores consistentes, cierre con regla PostgreSQL, fotos normalizadas y CSV auditado implementados. Resultados actuales y límites remotos en [ESTADO_M5.md](ESTADO_M5.md); los informes que siguen conservan evidencia histórica.

Consolidación documental y revisión B5: 2026-11-05. Fuente única de estado del backend; conserva los informes históricos de B0–B4 y añade la verificación B5.

**Coordinación vigente:** seguir [PLAN_DESARROLLO.md](PLAN_DESARROLLO.md), con backend y frontend en una sola sesión. M5 (B6 + F6) se implementa sobre M4; [ESTADO_M5.md](ESTADO_M5.md) registra las pruebas locales y la migración remota autorizada, aplicada y verificada. Las recomendaciones históricas de avanzar por capas no sustituyen este orden. La prueba local no certifica todos los servicios remotos.

## M4 — Integración administrativa web

Ampliación autorizada el 2026-11-06: proceso de desarrollo completo sin TOTP mediante capacidad privada de servidor, vinculada a OWNER/sesión y con vencimiento. Ocho migraciones aplicadas y 17 tablas RLS; cuenta DEMO conserva is_demo/inactiva y el checkout solo la admite para la rifa de prueba bajo capacidad. Comprobante privado local real y una orden PENDING_REVIEW creada por el formulario normal, sin transferencia. MFA/roles normales siguen fuera de la excepción; Supabase Storage productivo pendiente. Ver [ADR 0018](decisions/0018-development-full-workflow.md) y [ejecución](DESARROLLO_PRUEBA_COMPLETA.md).

Corrección posterior del login, 2026-11-06: Auth aceptaba las credenciales y la allowlist pasaba, pero faltaba USAGE del esquema Auth. Tras autorización explícita se aplicó la comprobación privada booleana y se retiró SELECT directo del runtime. Verificación real de sesión OWNER y rechazos bajo runtime aprobada; seis migraciones alineadas, sin pendientes. Login/TOTP personal por reintentar. Estado vigente y evidencia en [corrección de acceso](ADMIN_AUTH_CORRECCION.md).

Actualización operativa 2026-11-06: con autorización explícita se aplicaron B3/B4/B5 al proyecto Supabase de B1/B2 y se arrancó la API local. Historial alineado, 16 tablas RLS, metadatos Auth limitados y ready 200 comprobados. El OWNER se conserva; faltan su login personal/TOTP y Storage privado real para probar comprobantes. Ver [ejecución y evidencia remota](MIGRACIONES_SUPABASE_B3_B5.md). Los pendientes fechados al final de B4/B5 son históricos y esta actualización sustituye únicamente su estado de aplicación remota.

Fecha: 2026-11-05. Se mantienen las ocho operaciones B5 y se incorpora `GET /api/v1/admin/session`, con AdminGuard, allowlist, comprobación de sesión Auth y autorización financiera cuando MFA está vigente. Respuesta mínima de rol/necesidad de MFA; AAL1 no puede leer órdenes. OpenAPI/cliente pasan a 0.5.1. No hay migración nueva: usa los permisos de metadatos de B5.

Regresión financiera y sesión ejecutada con PostgreSQL local aislado/SCRAM: **18/18 aprobadas**, sin omitidas. Comando: `powershell -NoProfile -File scripts/test-backend-local.ps1 -PasswordAuthentication -Port 54345 -TestScript test:payments`; evidencia local ignorada `.tmp/m4-payments.txt`. La instancia temporal se detuvo al terminar.

La integración de navegador comprueba compra, autorización, decisiones, reservas, consulta y disponibilidad junto con Next.js. Resultados finales en [M4 frontend](ESTADO_FRONTEND.md#m4). Auth/Storage usan adaptadores HTTP de protocolo locales; no se certifica el proyecto remoto. Sin despliegue, aplicación remota de migraciones ni transferencias reales. Decisión en [ADR 0012](decisions/0012-m4-admin-web-session.md).

Cierre local: **14/14** en el runner M4, incluidas inscripción/renovación TOTP, cookies protegidas, roles, descarga privada, conflictos, idempotencia y fallo de revocación. El producto web se corrigió para impedir que una respuesta tardía reescriba una sesión usable después de logout. Lint, typecheck, build, generación y suites base de ambas capas aprobados; detalle de comandos y límites en el estado frontend. Se mantienen separados los resultados de B5 histórico y esta sesión.

## Resumen del último estado documentado

| Fase | Alcance | Última verificación registrada | Pruebas aprobadas registradas |
|---|---|---|---|
| [B0](#b0) | Fundamentos NestJS, configuración, salud, OpenAPI y cliente | 2026-10-29; cierre de CI el 2026-11-01 | 17 |
| [B1](#b1) | Esquema privado, migraciones, integridad, RLS y seed DEMO | 2026-11-01 | 39 |
| [B2](#b2) | Catálogo y administración autenticada de rifas | 2026-11-03, incluida integración SCRAM | 60 |
| [B3](#b3) | Sesión invitada y pre-reservas idempotentes con CSPRNG | 2026-11-03 | 72 |
| [B4](#b4) | Orden y comprobante en un envío, Storage privado y consulta protegida | 2026-11-03 | 91 |
| [B5](#b5) | Revisión manual, MFA, conciliación y proxy privado | 2026-11-05, regresión B1–B5 con SCRAM | 108 |

Los totales de cada fase incluyen pruebas de fases anteriores; no se suman. B0–B4 conservan sus resultados históricos; B5 registra una regresión completa nueva.

Siguen pendientes la aplicación remota de B3–B5, la preparación y comprobación del Storage privado real, el login HTTP del OWNER con sesión MFA real y un nuevo CI remoto. B1/B2 y el alta del OWNER sí constan realizados en la continuación de B2. El CI de B0 aprobado no valida las fases posteriores.

La revisión B5 completa el contrato, las decisiones y las instrucciones de recuperación que habían quedado pendientes. Ver [B5](#b5) para los resultados y límites; el siguiente hito funcional es B6.

## Cómo leer y mantener este documento

Los apartados por fase conservan su contexto y sus fechas. Expresiones como «todavía no implementado», «siguiente fase» o «pendiente» describen ese momento: una continuación posterior prevalece cuando documenta su resolución. Por ejemplo, B0 primero registra CI pendiente y después confirma su aprobación; B2 primero registra OWNER pendiente y después documenta el alta.

Actualizar este archivo al cerrar nuevas fases, junto con el resumen y los pendientes. Mantener los [planes](PLAN_BACKEND.md), el [contrato](CONTRATO_API.md), el [esquema](ESQUEMA_B1.md), el [registro de migraciones remotas](MIGRACIONES_SUPABASE_B1_B2.md), las [decisiones](decisions/) y el [changelog](../CHANGELOG.md) como documentos especializados. El estado del frontend está en [ESTADO_FRONTEND.md](ESTADO_FRONTEND.md).

## B0

Rama local: `feat/backend-b0`. Verificación: 2026-10-29.

### Resultado

B0 validado localmente: instalación con lockfile, generación OpenAPI/cliente,
lint, typecheck, build y 17 pruebas aprobadas. No hay implementación de B1–B8,
despliegue ni cambios en bases remotas. El workflow CI está configurado; todavía
no se ha ejecutado en GitHub.

### Evidencia

| Criterio | Estado | Comando / resultado |
|---|---|---|
| Instalar dependencias | PASS | Instalador local, pnpm 10.28.2 con `--frozen-lockfile` |
| OpenAPI y cliente | PASS | `npm.cmd run generate:api`: JSON desde NestJS y tipos generados |
| Lint | PASS | `npm.cmd run lint`: sin errores |
| Typecheck | PASS | `npm.cmd run typecheck:api`: API y cliente |
| Build | PASS | `npm.cmd run build:api`: API y cliente |
| Configuración | PASS | `npm.cmd run test:config`: 6/6 |
| HTTP y fundamentos | PASS | `npm.cmd test`: 10/10 |
| PostgreSQL real | PASS | `npm.cmd run test:integration`: 1/1 con PostgreSQL 17.5 aislado |
| Auditoría de dependencias | PASS | `pnpm audit --json`: cero vulnerabilidades reportadas |
| CI remoto | PASS | [Backend](https://github.com/OmarUrena/app1/actions/runs/41308070038) aprobado; comprobado el 2026-11-01 |
| Migración / rollback / seed | No aplica | B0 no crea tablas de negocio |

Las pruebas HTTP verifican arranque, health, readiness sin DB, CORS, errores
uniformes, DTO inválido, JSON corrupto, rate limiting, Swagger deshabilitado y
DB inaccesible sin filtración de secretos. La integración comprueba `SELECT 1`
y respuesta `ready` sobre PostgreSQL real; no valida todavía dominio ni concurrencia.

### Correcciones realizadas al instalar

- Declarar Express como dependencia directa: pnpm no permite depender de la
  copia transitiva instalada para el adaptador NestJS.
- Tipar explícitamente el callback CORS para compilar en modo strict.
- Corregir declaraciones literales de DTO que incumplían lint.
- Generar `docs/openapi.json` y `packages/api-client/src/generated.ts`.
- CI usa `pnpm install --frozen-lockfile` con el lockfile disponible.
- Corregir dos alertas transitivas con overrides específicos en
  `pnpm-workspace.yaml`: multer 2.5.0 y js-yaml 5.4.1. Auditoría posterior sin alertas.

### Instalación y acceso a internet

Se verificó `powershell -NoProfile -File scripts/install-backend.ps1`. Usa el
paquete JavaScript oficial de pnpm con Node 24.22.1 y guarda herramientas/caches
en el proyecto, evitando el pnpm.exe global que antes fallaba con EPERM.

Las conexiones desde el sandbox estándar siguen devolviendo EACCES. Las
descargas y consultas de auditoría funcionaron con permisos ampliados autorizados
por revisión automática. No fue necesario modificar firewall, permisos globales
de Windows ni desactivar TLS.

pnpm informa scripts de instalación omitidos de `@scarf/scarf` y `unrs-resolver`.
Las verificaciones del backend pasan sin habilitarlos. No se verificó el build
del frontend en esta tarea.

### PostgreSQL aislado

Se encontró PostgreSQL 17.5 en `C:/Program Files/PostgreSQL/17/bin`.
Se creó un cluster exclusivo de prueba en `.tmp/postgres-b0/data`, sin tocar
el servicio `postgresql-x64-17`. Escuchó únicamente en `127.0.0.1:54329`, con
zona horaria UTC. La integración utilizó el usuario DEMO `demo_test`, sin datos
de negocio. La instancia temporal quedó detenida después de la prueba.
Docker no está instalado y no fue necesario. Pasos reproducibles en `infra/README.md`.

### Límites y siguiente fase

- Sin rifas, órdenes, transferencias, comprobantes ni auth admin hasta las fases
  correspondientes. No se declara MVP ni preparación productiva.
- Rate limiting por proceso, sin topología proxy configurada.
- TLS remoto y entorno Supabase no probados: esta fase solo necesita PostgreSQL
  aislado. El test local usa conexión sin TLS exclusivamente loopback.
- CI remoto confirmado como aprobado el 2026-11-01; separar worktrees antes del trabajo simultáneo.
  Se conserva el frontend existente; no se hicieron commits con trabajo ajeno.
- Próxima fase desbloqueada: B1, esquema PostgreSQL, migraciones y seed DEMO.

### Cierre de pendientes — 2026-11-01

Consulta de solo lectura a GitHub Actions: Backend y Frontend completados con
conclusión `success` en la rama B0. Trabajo de B1 iniciado en `feat/backend-b1`.
Los resultados de B0 de esta página son históricos; ver [B1](#b1) para la
verificación de la implementación nueva.

---

## B1

Fecha de verificación: 2026-11-01. Rama: `feat/backend-b1`.

### Resultado

B1 validada localmente: migración oficial repetida, seed DEMO reejecutable,
constraints, RLS y recuperación comprobados sobre PostgreSQL 17.5 aislado.
No se ha desplegado ni aplicado SQL en Supabase remoto. CI de esta rama todavía
no ejecutado; el CI remoto de B0 sí está aprobado.

| Criterio | Estado | Evidencia |
|---|---|---|
| Pendiente CI de B0 | PASS | Backend y Frontend de la rama B0 aprobados en GitHub Actions |
| Dependencias y lockfile | PASS | CLI oficial 2.122.0 fijado; pnpm-lock actualizado |
| Lint | PASS | `npm.cmd run lint` |
| Typecheck API/cliente | PASS | `npm.cmd run typecheck:api` |
| Build API/cliente | PASS | `npm.cmd run build:api` |
| OpenAPI/cliente | PASS | `npm.cmd run generate:api`; contrato HTTP sin cambios |
| Configuración | PASS | `npm.cmd run test:config`: 6/6 |
| Fundamentos y protecciones locales | PASS | `npm.cmd test`: 13/13 |
| PostgreSQL real | PASS | `scripts/test-backend-local.ps1`: 20/20 (19 de esquema y 1 de readiness) |
| Migración y seed reejecutables | PASS | Historial único y seed sin duplicar filas ni auditoría |
| Integridad y RLS | PASS | Numeración 1/10/137/10000, constraints, estados, privacidad y denegación por rol |
| Recuperación | PASS | Down exitoso sin datos y bloqueado con histórico presente |
| Auditoría de producción | PASS | `pnpm audit --prod --json`: cero vulnerabilidades reportadas |
| Auditoría completa | WARN | Un aviso moderado de minimatch en tres rutas de herramientas; cero altas/críticas |
| CI remoto B1 | SKIPPED | No se publicó esta rama ni se ejecutó en GitHub |

Total: **39 pruebas aprobadas**, ninguna omitida en las suites ejecutadas.

### Implementado

- `infra/supabase/migrations/20261102010448_domain_b1.sql`: esquema privado con
  13 tablas, enums/domains, FKs, checks, índices y triggers diferidos.
- Inventario generado 0..N-1, snapshots inmutables y dinero entero con total de
  orden calculado por PostgreSQL. Comprobante activo obligatorio al commit.
- Integridad de holds, reservas, ventas y liberación conciliada. INVALID y
  NEEDS_RESOLUTION mantienen RESERVED. Auditoría e histórico protegidos.
- `infra/seeds/demo.sql`: rifa DRAFT de 100 números, 3 RESERVED, orden pendiente
  y reporte simulado; cuenta DEMO y owner inactivos. Sin usuario Auth ni objeto Storage.
- Herramientas de mantenimiento limitadas a loopback, DBs DEMO y fuera de
  staging/production; rechazo de parámetros que pueden redirigir el host.
- Script Windows que inicia y detiene únicamente su cluster temporal. Las bases
  creadas por las pruebas se eliminan al terminar, sin tocar el servicio del sistema.
- Diagrama, decisiones y plan de recuperación en ESQUEMA_B1.md, ADR 0004 e infra/recovery.

### Correcciones verificadas durante la ejecución

El revisor de permisos volvió a estar disponible y autorizó la prueba local.
Se detectaron y corrigieron dos fallos reales antes de aprobar B1:

1. El CLI requiere TLS por defecto. La herramienta valida primero que la conexión
   sea loopback y luego añade sslmode=disable exclusivamente para ese PostgreSQL
   local sin TLS. La configuración del backend remoto no cambia.
2. Un CASE dentro de un IF PL/pgSQL requería paréntesis en el constraint diferido.
   Corregido y verificado al aplicar la migración desde una DB limpia.

El diagnóstico del CLI conserva un mensaje acotado y redacta URL/contraseña,
para poder identificar fallos sin propagar credenciales de execFile.

Última suite SQL: 20 aprobadas, 0 fallos, 0 omitidas. PostgreSQL temporal detenido
al finalizar. El resultado anterior bloqueado/fallido ya no describe el estado actual.

### Riesgos y límites

La auditoría completa reporta GHSA-g3hv-75wg-m249 en minimatch transitivo de eslint,
typescript-eslint y openapi-typescript/redocly. El parche anunciado es 11.0.1;
las herramientas usan versiones mayores anteriores. La actualización compatible
queda pendiente; no se oculta el aviso ni se fuerza un override global que pueda
romper otras herramientas. No hay hallazgos en las 236 dependencias de producción.

No hay endpoints de catálogo, compra, pagos ni admin todavía: corresponden a B2–B5.
Tampoco hay comprobantes reales, autenticación admin configurada, sorteo o despliegue.
La existencia y validación de archivos privados se comprobará en B4; B1 solo
valida sus metadatos y referencia obligatoria.

Próxima fase desbloqueada: **B2**, Auth admin y catálogo administrable/público.
Antes de trabajo simultáneo, separar frontend y backend en worktrees.

---

## B2

Fecha: 2026-11-01. Rama: `feat/backend-b2`.

### Entrega

Catálogo público y gestión de rifas funcionales, JWT verificado con JWKS de
Supabase, consulta autoritativa de usuario y allowlist activa en PostgreSQL.
El runtime no tiene flags de autenticación simulada. Sin las variables del
proyecto propio, las rutas admin fallan cerrado con 503.

### Verificación

| Criterio | Resultado | Evidencia |
|---|---|---|
| Lint | PASS | npm run lint |
| Typecheck API/cliente | PASS | npm run typecheck:api |
| Build API/cliente | PASS | npm run build:api |
| OpenAPI y cliente | PASS | npm run generate:api, 11 operaciones nuevas B2 y 2 de salud |
| Compatibilidad tipada frontend | PASS | npm run typecheck --workspace apps/web |
| Configuración | PASS | npm run test:config: 7 pruebas |
| Fundamentos y herramientas | PASS | npm test: 13 pruebas |
| Persistencia y HTTP B2 | PASS | test-backend-local.ps1: 40 pruebas, 20 de B2 y 20 previas |
| Integración con contraseña SCRAM | PASS | 2026-11-03: 40/40 en cluster temporal separado que exige scram-sha-256 |
| Producción: auditoría | PASS | pnpm audit --prod: 0 alertas, 237 dependencias |
| Auditoría completa | WARN | Aviso moderado minimatch en 3 rutas de herramientas, ya registrado en B1 |
| Supabase remoto: esquema y lecturas | PASS | B1/B2 aplicadas con autorización; 13 tablas RLS y pruebas HTTP del API correctas |
| Supabase remoto: allowlist OWNER | PASS | UUID autorizado por el usuario, identidad Auth existente y alta auditada el 2026-11-03 |
| Supabase remoto: login de administrador | PENDIENTE | OWNER activo; falta ejecutar una petición con su sesión real |
| CI remoto B2 | FAIL en revisión | La rama está publicada; falló integración en el commit d25c8df. Corrección local de autenticación del login de prueba pendiente de nueva ejecución remota |

Las suites SQL previas de B1 pasan con ambas migraciones. Las 20 pruebas nuevas
de B2 verifican JWT firmado, firma ajena/expiry/aud/iss/HS256, allowlist/metadata,
usuario eliminado, rol DB limitado, creación de N boletos, validaciones atómicas,
catálogo/paginación, derechos/publicación, pausa/edición/resume, campos bloqueados,
venta vs reserva, HELD vencido, cuentas públicas, concurrencia HEAD, bootstrap y
recuperación con reparación oficial/reaplicación.

Total verificado: **60 pruebas aprobadas**, sin omitidas en las suites ejecutadas.

El proveedor Auth/Storage de tests solo existe dentro del archivo de integración;
no hay uno disponible para el producto. Usa firmas reales ES256, un endpoint JWKS
y una comprobación de usuario independiente con la misma identidad. La aplicación
no omite verificaciones para NODE_ENV=test.

### Uso

Configurar apps/api/.env con DATABASE_URL del entorno local, SUPABASE_URL y
SUPABASE_PUBLISHABLE_KEY del mismo proyecto, además de PUBLIC_RAFFLE_BUCKET.
No usar service_role ni sb_secret_. El proyecto debe tener claves asimétricas
ES256/RS256; un proyecto con solo HS256 necesita habilitarlas antes de usar admin.

Aplicar migraciones con `npm run db:migrate:local` en DB local sorteos_dev o
sorteos_test. Para configurar un OWNER real de desarrollo, usar una DB migrada
sin seed y ejecutar el bootstrap manual descrito en README. El fixture DEMO
permanece desactivado; no sirve como login ni como permiso legal o bancario.

Arranque: `npm run dev:api`. Swagger: /api/v1/docs. Público: /api/v1/raffles.
Para admin, enviar Bearer access_token de Supabase de una sesión protegida.
Mantener tokens fuera de URLs, logs y almacenamiento persistente del comprador.

### Cambios y límites

- Migración 20261102020713_catalog_admin_b2.sql, rol servidor, RLS, versión y
  aprobación de publicación, metadatos de derechos e índices.
- Servicios/controladores catalog y guard auth; transacciones acotadas, auditoría
  sin PII, errores uniformes y generación de cliente actualizada.
- Seed B1 se conserva sin publicar rifas ni activar administradores/cuentas.
- Recuperación b2-down-empty.sql probada; no destruye datos de negocio ni el rol
  global que podría compartirse con otra DB. Con datos se exige forward-only.
- El alta de Auth y los objetos del bucket deben prepararlos los operadores del
  proyecto propio; no se crearon usuarios ni imágenes en Supabase remoto.
- Verificada conexión TLS a Supabase y aceptación de clave publicable/JWKS ES256.
  Tras autorización, B1/B2 quedaron aplicadas y el runtime accede correctamente
  al esquema privado. Falta provisionar un OWNER y verificar su login real.
  Reautenticación/MFA y políticas de sesión financiera corresponden a B5.
- Se conservó el cambio previo de apps/web/next-env.d.ts; no se implementó F2.

B2 habilita F2 (catálogo real). Próxima fase backend: B3, pre-reservas técnicas,
CSPRNG, TTL, límites antiacaparamiento y concurrencia del inventario.

### Continuación del 2026-11-03

Se confirmó que la rama remota contiene el commit d25c8df. El
[CI Backend](https://github.com/OmarUrena/app1/actions/runs/41404885565) pasó
instalación, generación sin diferencias, lint, typecheck y pruebas sin DB;
falló en integración y no llegó al build. GitHub restringió la descarga del log
completo sin autenticación. El CI frontend de ese commit pasó.

La revisión encontró que el login limitado de integración se creaba sin
contraseña y que su URL eliminaba la credencial. Esto pasa con el trust local,
pero impide conectar cuando PostgreSQL exige contraseña, como en el servicio de CI.
Se corrigió el fixture para crear y usar una contraseña UUID aleatoria y
desechable, sin ampliar privilegios ni cambiar el producto o las migraciones.

Verificación del 2026-11-03: generate:api sin diferencias; lint, typecheck:api,
build:api, test:config (7) y test (13) aprobados. Las 40 pruebas de integración
pasaron primero en el cluster local habitual y luego, con la corrección, en uno
nuevo en loopback:54340 con auth-host=scram-sha-256 y credenciales aleatorias.
Ambas instancias temporales se detuvieron al finalizar. Total: 60 pruebas, sin
fallos ni omitidas. Registros locales ignorados en .tmp/b2-resume-integration.txt
y .tmp/b2-scram-integration.txt. No se afirma aún éxito del nuevo CI remoto.

Se repitió la comprobación HTTP del backend conectado a Supabase: health/ready,
catálogo y cuentas públicas devolvieron 200; admin sin JWT devolvió 401. El
servidor de esta comprobación se cerró al terminar.

El usuario autorizó explícitamente su UUID Auth como OWNER. Se comprobó su
existencia, que no fuera anónimo, eliminado o bloqueado; se dio de alta en
admin_users bajo bloqueo y transacción, con evento SYSTEM en audit_logs.
La comprobación posterior confirmó un OWNER activo y un evento de alta.
No se crearon usuarios Auth ni se publicaron rifas. La allowlist no sustituye
la prueba HTTP con una sesión real: esa validación sigue pendiente.

### Configuración remota de solo lectura

Se guardó la configuración suministrada en apps/api/.env, excluido de Git,
sin imprimir contraseña ni claves. Se interpretaron los corchetes como formato
de plantilla de la cadena PostgreSQL. La conexión autenticada resultó exitosa.
Se configuró la CA oficial Supabase Root 2021 en DATABASE_CA manteniendo verificación
de cadena y hostname. Auth settings y JWKS respondieron 200, con clave ES256.

La inspección inicial READ ONLY confirmó ausencia del esquema/historial. Después
de la autorización explícita se aplicaron B1/B2 con el CLI oficial, preservando
sus versiones. No se ejecutaron seed, bootstrap, creación de usuarios o cambios
de Storage. El API conectado a Supabase pasó health/readiness, catálogo y cuentas
vacías, y rechazó acceso admin sin JWT. Detalles y avisos del asesor en
[MIGRACIONES_SUPABASE_B1_B2.md](MIGRACIONES_SUPABASE_B1_B2.md).

---

## B3

Fecha: 2026-11-03. Rama: feat/backend-b3. Implementado y validado localmente.

### Entrega

- POST checkout-session: secreto de 256 bits en cookie HttpOnly, hash SHA-256
  en DB, renovación conservando secreto, Origin y defensa CSRF.
- POST checkout-holds: rifa y cantidad, Idempotency-Key por sesión, precio DB,
  total entero exacto, TTL 60 min y asignación criptográfica sin reemplazo.
- GET/DELETE checkout-holds/:id: solo sesión propietaria; no muestran números.
- Límites persistentes de simultáneos por sesión/IP y altas exitosas por hora;
  HMAC de IP, sin confiar en X-Forwarded-For ni guardar IP cruda.
- Bloqueo por rifa, actualización atómica y constraints diferidas de B1; auditoría
  de altas, cambios y accesos propios. No se crean órdenes ni se confirma pago.
- Expiración lazy y job interno de ACTIVE/HELD vencidos; no toca RESERVED/SOLD,
  CONSUMED ni órdenes. Cancelar un hold consumido devuelve 409.
- Migración nueva 20261104022108_checkout_holds_b3.sql, tabla checkout_limits con
  RLS, permisos mínimos de servidor, trigger y recuperación b3-down-empty.sql.
- Contrato, OpenAPI 0.3.0 y cliente generado actualizados; sin cambios de frontend.

### Verificación

| Comando / comprobación | Resultado |
|---|---|
| npm run generate:api | PASS, 4 operaciones nuevas B3 |
| npm run lint | PASS |
| npm run typecheck:api | PASS |
| npm run typecheck --workspace apps/web | PASS |
| npm run build:api | PASS |
| npm run test:config | PASS, 8 pruebas |
| npm test | PASS, 13 pruebas |
| npm run test:integration, cluster loopback con SCRAM | PASS, 51 pruebas: 40 previas y 11 B3 |
| Recuperación B3 vacía/datos/permisos/reparación/reaplicación | PASS, incluida en integración |
| Recuperación B2 después de revertir B3 | PASS, incluida en integración |
| Migraciones B1/B2 ya aplicadas | Sin diferencias |
| git diff --check | PASS |
| Runner Windows -PasswordAuthentication -TestScript test:checkout | PASS, 11/11 y servidor detenido |
| Aplicación de B3 en Supabase y CI remoto de B3 | PENDIENTE, no ejecutados |

Total: **72 pruebas aprobadas**, sin fallos ni omitidas. La suite final SCRAM
completa tardó aproximadamente 114 s en el equipo local. Una pasada anterior
con trust también aprobó las 49 pruebas existentes antes de añadir los dos
últimos casos B3. La autenticación de los logins de prueba usa contraseña,
sin depender del trust local que ocultó el fallo de CI B2.

Concurrencia: 50 solicitudes HTTP en paralelo, 20 boletos disponibles, repartidas
entre dos instancias NestJS con pools independientes sobre la misma DB.
Resultado: 20 respuestas 201 y 30 respuestas 409 INSUFFICIENT_TICKETS, exactamente
20 tickets HELD distintos, 20 holds y total de inventario conservado.
Tiempo medido: 1185 ms para las 50 solicitudes, excluyendo crear sesiones.
No es un benchmark de producción ni certifica capacidad de rifas de un millón.
También se prueban 25 reintentos paralelos con una clave: todos el mismo hold.

Evidencia local ignorada: .tmp/b3-scram-integration.txt. El comando de Windows
reproducible usa el runner del repositorio:

```powershell
powershell -NoProfile -File scripts/test-backend-local.ps1 -PasswordAuthentication
# Solo B3:
powershell -NoProfile -File scripts/test-backend-local.ps1 -PasswordAuthentication -TestScript test:checkout
```

El runner crea un cluster nuevo por ejecución SCRAM, contraseña temporal, quita
el archivo de inicialización y detiene solo su instancia. No toca el servicio
del sistema. Las suites crean y eliminan sus DB/roles. Las pruebas no usan la
URL de Supabase ni alteran los datos remotos. El fixture DEMO previo de B1 sigue
siendo reejecutable, DRAFT y sin transferencias o comprobantes reales.

El runner SCRAM del repositorio también se verificó de forma independiente:
11 pruebas B3 aprobadas y 858 ms en su prueba de 50 solicitudes/dos instancias.
Registro: .tmp/b3-runner-scram.txt. Diferencias de latencia entre pasadas son
esperables en este entorno local y no se fijan umbrales de rendimiento ficticios.

### Pendientes y límites

- Aplicar B3 remoto mediante el único historial CLI cuando se autorice esa
  operación; el arranque no migra automáticamente. Sin B3, los nuevos endpoints
  fallan al faltar permisos/esquema; no simulan éxito.
- Publicar esta rama/correcciones y comprobar un CI nuevo. No se afirma corregido
  el resultado remoto anterior solo porque la suite local pasó.
- B2: OWNER ya provisionado; sigue pendiente probar acceso con su sesión real.
- No hay proveedor CAPTCHA: exceso de cuota se bloquea con 429. Integrar un
  desafío adaptativo requiere proveedor y claves; no hay verificación fingida.
- Antes de producción: identidad de proxy confiable, clave HMAC privada estable
  entre procesos, retención/limpieza de contadores y medición de rifas grandes.
- Job requiere API activa; el catálogo calcula disponibilidad elegible y la
  siguiente operación valida/libera bajo lock. Una operación fallida revierte
  también su liberación lazy; el job vuelve a intentarlo.
- Nueva sesión no recupera holds antiguos. Pérdida de cookie/transferencia con
  hold vencido requiere flujo de incidencia posterior; B3 no emite boletos.

Siguiente fase: **B4**, submit único de formulario + comprobante privado,
conversión HELD -> RESERVED y creación atómica de orden PENDING_REVIEW.
Decisiones y límites completos: [ADR 0006](decisions/0006-backend-b3-holds.md).

---

## B4

Fecha: 2026-11-03. Rama: feat/backend-b4. Implementado y verificado localmente.
Se conservaron los cambios pendientes de B2/B3 y no se modificó frontend.

### Entrega

POST /api/v1/orders multipart recibe datos y comprobante en la misma acción.
Correo obligatorio, teléfono E.164 normalizado, banco activo, referencia, fecha
con zona horaria y reglas aceptadas. Requiere Origin y cookie de B3. No admite
números, precio o total del cliente. Archivo obligatorio JPG/PNG/PDF válido.

Validación aislada, Storage privado y registro durable de intentos. Segunda
transacción con bloqueo de sesión/rifa/hold/staging revalida después del upload,
crea cliente, orden PENDING_REVIEW, reporte REPORTED y vínculos, convierte HELD
en RESERVED y marca el hold CONSUMED. Solo después del commit se devuelven los
mismos números del hold, con ancho y ceros de la rifa. No hay aprobación de pago.

GET /orders/:code requiere sesión propietaria y devuelve estado/números/importe;
no PII ni acceso al comprobante. El código solo no autoriza. Idempotencia por
sesión + UUID + fingerprint del payload/archivo original; retry recupera orden
sin otro upload, payload distinto falla. Dos claves no pueden consumir un hold.

receipt_staging y job de compensación impiden referencias a cargas reclamadas
para limpieza y conservan ATTACHED incluso ante error ambiguo del commit.
Storage siempre está fuera de la transacción de inventario. Órdenes pendientes
y sus RESERVED no expiran automáticamente. Pausa permite finalizar hold válido;
si cambian reglas/banco/vigencia durante carga, se revalida antes de confirmar.

### Verificación

| Comando / criterio | Resultado |
|---|---|
| npm run generate:api | PASS, OpenAPI 0.4.0 y 2 operaciones B4 nuevas |
| npm run lint | PASS |
| npm run typecheck:api | PASS |
| npm run build:api | PASS |
| npm run typecheck --workspace apps/web | PASS |
| npm run test:config | PASS, 9 pruebas |
| npm test | PASS, 13 pruebas |
| Integración completa con SCRAM | PASS, 69 pruebas (18 de B4 y 51 previas) |
| Worker de validación desde dist JS | PASS, PNG válido y bytes originales conservados |
| Cliente tipado: multipart/boundary/cookie SSR | PASS, incluido en integración |
| Down B4 vacío / rechazo con datos / repair y reapply | PASS, incluido en integración |
| Recuperaciones previas B2/B3 con cuatro migraciones | PASS |
| pnpm install --frozen-lockfile --offline --store-dir .pnpm-store --ignore-scripts | PASS |
| pnpm audit --prod | PASS, 0 vulnerabilidades en 250 dependencias de producción |
| git diff --check | PASS |
| Migraciones remotas, bucket/clave Storage real y CI remoto B4 | PENDIENTE, no ejecutados |

**91 pruebas aprobadas**, sin fallos ni omitidas en la ejecución final. Integración
completa: aproximadamente 169 s. Evidencia local ignorada:
.tmp/b4-final-integration.txt y .tmp/b4-prod-audit.json. Una pasada previa detectó
timeout de arranque ts-node del worker en carga paralela; se corrigió compilando
una vez el código local antes de ejecutar el worker, sin ampliar timeout ni
omitir validación. La suite final volvió a aceptar JPG/PDF válidos y rechazar
comprobantes corruptos/activos. Registro anterior conservado en .tmp para diagnóstico.

Casos B4 cubiertos: correo ausente/incorrecto; sin archivo; tipo falso/SVG/
truncado/tamaño; PDF activo; JPG/PNG/PDF válidos; números exactos y dinero entero;
retry tras respuesta perdida; concurrencia con misma/distinta clave en dos APIs;
Storage público/fallido/ambiguo; limpieza con reintento; hold vencido durante
upload sin lock abierto; rollback después de insertar cliente/orden; consulta
ajena; reglas/banco/fecha; permisos; DB rechaza reporte inventado sin staging;
carrera limpieza/commit; reglas cambiadas durante I/O; cliente multipart y recovery.

### Reproducir

```powershell
powershell -NoProfile -File scripts/test-backend-local.ps1 -PasswordAuthentication -Port 54342
# Solo B4:
powershell -NoProfile -File scripts/test-backend-local.ps1 -PasswordAuthentication -TestScript test:orders -Port 54342
```

Se utilizó otro puerto porque 54339 estaba ocupado; no se detuvo esa instancia.
Las instancias creadas por las pruebas se detuvieron y las suites eliminaron sus
DB/roles. Storage de prueba vive solo en test/orders.integration.ts y conserva
los bytes enviados para comprobar hash, compensación y concurrencia. El producto
utiliza SDK real, nunca un modo de éxito simulado. Seed B1 sigue reejecutable y
no introduce archivos reales ni datos bancarios reales.

### Configuración y pendientes

- Nuevas variables: PRIVATE_RECEIPT_BUCKET, SUPABASE_STORAGE_KEY y
  RECEIPT_MAX_BYTES; ejemplos sin secretos. Se verifica public=false antes de
  upload, sin upsert ni URLs públicas. El bucket debe tener políticas privadas.
- Falta preparar/verificar bucket y clave de servidor en Supabase real, aplicar
  B3/B4 con autorización y probar el flujo remoto. No se crearon recursos remotos,
  se modificaron B1/B2 aplicadas, se cargó seed remoto ni se publicaron rifas.
- B2: OWNER provisionado, prueba de login real aún pendiente. CI remoto anterior
  no equivale a validar esta rama; no se ha publicado ni vuelto a ejecutar aquí.
- La interfaz del formulario corresponde a F4. No se añadió UI al backend.
- Sin antivirus externo ni garantía universal contra malware; límites de páginas,
  píxeles, tiempo, memoria, tipos y PDF activo documentados. Sin protección DDoS
  certificada; WAF/proxy/timeouts de ingreso y observabilidad corresponden a B7/B8.
- Job requiere API activa y Storage accesible; pendiente retención/reconciliación
  operativa adicional de huérfanos. Nunca borrar ATTACHED como limpieza temporal.
- Perder cookie no elimina orden/números; recuperación verificada y notificaciones
  por correo no se implementan automáticamente por exigir email.

Siguiente fase backend: **B5**, revisión manual, visor privado autorizado,
aprobación, resolución/cancelación documentada y requisitos de sesión/MFA.
Decisiones: [ADR 0008](decisions/0008-backend-b4-order-receipts.md).

---

## B5

Revisión: 2026-11-05. Implementación existente en el commit `60736fb`;
esta continuación completa documentación y repite verificaciones locales.

### Alcance implementado

- Bandeja con filtros/paginación sin PII y detalle privado con comprador,
  números, reporte, señales de duplicación, últimas 100 acciones e incidencias.
- Inicio/reapertura de revisión, aprobación bancaria manual, solicitud de
  resolución y cancelación conciliada; ocho operaciones nuevas en OpenAPI 0.5.0.
- OWNER aprueba/cancela; ADMIN puede revisar. JWT firmado, allowlist activa,
  sesión Auth vigente, `aal2` y TOTP de los últimos 15 minutos en todas las rutas B5.
  La autorización se comprueba de nuevo en la transacción y después del I/O de
  Storage, antes de entregar un comprobante.
- Proxy privado de descarga autenticada con no-store/nosniff; nunca URL pública.
- Idempotencia persistida por administrador y versión esperada; bloqueo
  consistente y commit atómico de orden, reporte, boletos, incidencias y ledger.
- PAID implica todos los boletos SOLD y monto exacto verificado. Una revisión
  negativa conserva RESERVED. Cancelación exige evidencia y conciliación, libera
  exactamente q y conserva orden, reporte, archivo y vínculos históricos.
- Reembolso exige devolución completa del importe recibido documentado;
  duplicado resuelto exige otra orden PAID del mismo banco y referencia verificada.
  El sistema no realiza transferencias. PAID no se cancela por estas rutas.
- Quinta migración `20261104035954_admin_payments_b5.sql`: tabla 16
  `admin_actions` inmutable, permisos limitados, RLS y constraints financieras.
  No se alteran migraciones anteriores. Seed DEMO B1 conservado y reejecutable.

### Verificación de la revisión

| Comando | Resultado |
|---|---|
| `npm run lint` | PASS |
| `npm run typecheck:api` | PASS, API y cliente |
| `npm run build:api` | PASS |
| `npm run generate:api` | PASS, OpenAPI/cliente sin diferencias respecto al commit |
| `npm run typecheck --workspace apps/web` | PASS |
| `npm run test:config` | PASS, 9/9 |
| `npm test` | PASS, 13/13 |
| `powershell -NoProfile -File scripts/test-backend-local.ps1 -PasswordAuthentication -Port 54343` | PASS, 86/86 de integración B1–B5 |
| `git diff --check` | PASS; aviso de normalización CRLF en README frontend preexistente |

Total: **108 pruebas aprobadas, 0 fallos, 0 omitidas**. Integración completa en
222282 ms, incluyendo 17 casos B5, seed reejecutable, recuperación protegida,
reparación del historial y reaplicación de migraciones. PostgreSQL temporal
detenido al terminar; servicio del sistema y Supabase remoto sin cambios.
Evidencia local ignorada: `.tmp/b5-all-integration.txt`. Ejecución seleccionada
anterior: 17/17 B5 en `.tmp/b5-payments.txt`.

Se verifican revocación de sesión/factor/allowlist, MFA antiguo/futuro, roles,
concurrencia de aprobación y cancelación entre dos APIs, idempotencia y versiones,
rollback tras fallo SQL, NEEDS_RESOLUTION sin liberar, reembolso y duplicado
conciliados, archivo privado y revocación durante descarga, ledger inmutable y
denegación de acceso a secretos Auth. No se repitió auditoría de dependencias
en esta revisión: no se añadieron dependencias; el resultado de B4 es histórico.

### Documentación y recuperación completadas

Contrato actualizado con payloads reales, versiones, confirmaciones, resultados,
errores y proxy; README, QA, changelog, infraestructura y
[ADR 0009](decisions/0009-backend-b5-manual-payments.md) actualizados.
El down vacío B5 preserva datos Auth y revierte solo sus objetos y permisos;
reparación de historial por CLI oficial. Con negocio/histórico se exige una
migración correctiva, no borrar datos para habilitar rollback.

### Límites y pendientes

- Migraciones B3–B5 todavía sin aplicar remotamente; requiere autorización para
  esa operación. B1/B2 y OWNER ya constan aplicados/provisionado.
- Configuración y verificación del bucket privado y clave de servidor en el
  entorno real, inscripción TOTP del OWNER y prueba HTTP con su sesión vigente.
  No se solicitan contraseñas, claves o códigos TOTP por chat.
- Verificar en staging permisos/políticas SELECT sobre metadatos de las tablas
  administradas Auth. Solo se conceden columnas sin secretos; sin compatibilidad
  o permisos correctos las rutas financieras fallan cerrado.
- Las pruebas locales usan PostgreSQL real, dos APIs, JWT/JWKS reales y servidores
  HTTP de protocolo Auth/Storage de pruebas. No certifican el proyecto remoto.
- CI remoto nuevo, despliegue, observabilidad y protección de borde no ejecutados
  en esta revisión. Se conserva el frontend existente.
- La verificación bancaria y el reembolso ocurren fuera del sistema; el API registra
  la confirmación y evidencia del propietario, no verifica un banco automáticamente.

Siguiente fase funcional: **B6**, consultas operativas, cierre y reportes. No se
implementa sorteo ni selección de ganador en B5.
# Actualización integrada M6 — 2026-11-07

M6 autorizado en main. Se añade almacén HTTP PostgreSQL con RLS, timeouts,
observabilidad por categoría/código sin PII, contención de 100 solicitudes y
pg_dump/pg_restore real sobre DEMO. OpenAPI/cliente 0.7.0. La regresión local
actual aprobó 97/97 pruebas de integración; la línea base previa fue 93/93.
La migración M6 no se aplica al proyecto remoto por esta verificación. Ver
[estado conjunto M6](ESTADO_M6.md) y [operación segura](OPERACION_SEGURA_M6.md).
