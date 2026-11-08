# Plan de acción Backend — App Sorteos (NestJS + PostgreSQL/Supabase)

**Extensión 2026-11-08:** [fase 1 de ajustes](AJUSTES_NEGOCIO_FASE_1.md)
documenta inventario técnico, reglas objetivo y compatibilidad. N configurable
describe la implementación histórica; nuevas rifas adoptarán 100000 números
en etapa 2. No alterar universos existentes como parte de la fase documental.

**Uso vigente (2026-11-05):** especificación técnica del backend dentro de [PLAN_DESARROLLO.md](PLAN_DESARROLLO.md), la única secuencia de ejecución M0–M7. Implementar cada hito junto a su frontend en la misma sesión. B0–B8 conservan su identidad para referencias, migraciones y evidencias; no son una agenda separada. Para rutas y payloads ya implementados prevalece [CONTRATO_API.md](CONTRATO_API.md).

**Objetivo:** construir primero el núcleo confiable de inventario, órdenes con comprobante, conciliación de transferencias y control administrativo. **No implementar el sorteo/selección de ganadores sin especificación aprobada.**

## 0. Contexto obligatorio
- Plataforma de venta de rifas propias; cliente compra como invitado. Un propietario administra todas las rifas.
- Configuración de cantidad de boletos **por rifa** (`total_tickets`), precio, compra mínima/máxima, fechas, imágenes y condiciones; números asignados ALEATORIAMENTE por backend.
- Cliente completa formulario único con datos, monto calculado, instrucciones de transferencia, referencia bancaria y **archivo de comprobante obligatorio**. Pulsar «Enviar orden» crea orden y reporte de pago juntos; entonces muestra números aleatorios reservados y código de orden.
- Un comprobante se recibe pero **no se considera pago aprobado**. Admin revisa ingreso bancario y decide. Orden con comprobante mantiene boletos hasta resolver el pago **SIN autoexpiración**.
- Pre-reserva interna temporal de inventario durante formulario (TTL propuesto 60 min). No es orden, no entrega números; si vence se liberan solo esos `HELD` y se atiende pago potencialmente realizado mediante procedimiento de incidencia, sin emitir boletos duplicados.
- Inventario: `AVAILABLE` -> `HELD` -> `RESERVED` -> `SOLD`; alternativas: expiración `HELD` -> `AVAILABLE`, cancelación administrativa conciliada `RESERVED` -> `AVAILABLE`. Nunca `SOLD` -> `AVAILABLE` sin proceso extraordinario definido.
- La finalidad de la rifa, permisos, método de selección del ganador y fecha real deben validarse antes de operar.

## Stack e ingeniería transversal
- NestJS + TypeScript con módulos delimitados y controladores delgados: `raffles`, `tickets/inventory`, `checkout-holds`, `orders`, `customers`, `payment-reports`, `admin`, `storage`, `audit`, `health`, `common`.
- PostgreSQL Supabase mediante conexión segura solo desde API, migraciones versionadas, OpenAPI con `@nestjs/swagger`, DTO y validación, API `/api/v1`.
- Se puede elegir Drizzle o ORM ya presente; para bloqueos y operaciones críticas usar SQL transaccional explícito cuando el ORM no soporte garantías necesarias. **No montar dos sistemas de migraciones**.
- Storage privado para comprobantes; Auth de Supabase para admin; verificación server-side de JWT + consulta `admin_users` activo y roles; jamás dar `service_role` al browser.
- Tests unitarios, integración contra PostgreSQL aislado, E2E HTTP y pruebas de concurrencia. CI con typecheck/lint/test/build.

## B0 — Auditoría del repositorio y fundamentos
**Objetivo:** entregar una base ejecutable sin cambiar reglas de negocio.

**Instrucciones a Codex**
1. Inspeccionar estado del repositorio, dependencias, convenciones, ramas, migraciones y archivos preexistentes. Mostrar plan de cambios antes de modificar.
2. Si es proyecto nuevo, preparar monorepo pnpm con `apps/api`, `apps/web`, `packages/api-client`, `infra`, `docs`, junto al armazón F0 dentro de M0. Si existe estructura, respetarla.
3. Crear app NestJS con TypeScript `strict`, prefijo `/api/v1`, validación central, manejo de errores, configuración tipada y logging estructurado.
4. Endpoint `GET /api/v1/health` con información no sensible; `GET /api/v1/health/ready` comprueba DB cuando esté configurada.
5. Agregar OpenAPI/Swagger para desarrollo (no exposición insegura en producción), CORS allowlist, Helmet/security headers, `.env.example`, scripts e instrucciones de uso.
6. Configurar CI y estándares de calidad; entorno de pruebas local con PostgreSQL aislado (Docker solo si disponible).

**Criterios de aceptación:** API inicia local; health responde; DTO inválido da error uniforme; OpenAPI genera JSON; tests básicos, lint y build pasan; no secretos hardcodeados.

## B1 — Dominio, esquema SQL y migraciones
**Objetivo:** persistencia íntegra y reglas verificadas a nivel DB.

**Crear entidades / tablas** (tipos exactos y enums con migración):

1. `raffles`: UUID, `slug` único, título, descripción, premio, `total_tickets` (>0), `ticket_width`, `ticket_price_minor` (entero positivo DOP), `min_purchase`, `max_purchase`, `starts_at`, `ends_at` opcionales, `status`, `rules_version`, timestamps. `published_at`, `closed_at`. No permitir cambio de numeración/precio una vez existan compromisos salvo política explícita y auditada.
2. `raffle_media`: imágenes/orden/alt y clave storage pública de material propio autorizado; imágenes de premios pueden ser públicas.
3. `tickets`: UUID, `raffle_id`, `number` entero, `status`, `hold_id`/`current_order_id` nullable según estado, `created_at`, `updated_at`; `UNIQUE(raffle_id,number)` y `CHECK number>=0`. La pertenencia exacta a `0..N-1` se garantiza en servicio de creación/transacción con tests y controles; agregar constraint/trigger robusto si necesario.
4. `checkout_holds`: UUID, `raffle_id`, `quantity`, `unit_price_minor_snapshot`, `expires_at`, `status=ACTIVE|CONSUMED|EXPIRED|CANCELLED`, hash de token/session, IP/huella limitada para abuse-prevention, timestamps e identificador de idempotencia. `hold_tickets` si no se desea FK `hold_id` directo.
5. `customers`: UUID, nombre, teléfono normalizado (formato E.164, preferencia +1-809/829/849 según validación), email obligatorio para nuevas órdenes (decisión 2026-11-03), creado; PII protegida. El esquema B1 ya aplicado conserva email nullable: B4 debe incorporar validación y migración compatible sin rellenar históricos con datos inventados. Ni teléfono ni email sin verificar prueban identidad por sí solos.
6. `orders`: UUID, `order_code` opaco único y no secuencial predecible, `raffle_id`, `customer_id`, `hold_id` único, `ticket_quantity`, `unit_price_minor`, `total_minor`, `currency='DOP'`, `status`, `created_at`, `reviewed_at/by`, `cancel_reason`, `rules_version_snapshot`, hash de credencial segura de consulta, versión de registro. `UNIQUE(idempotency_key)` con scope definido.
7. `order_tickets`: `order_id`, `ticket_id`, asignado_en, estado/historial; evitar asignación activa doble por PK/índice parcial o FK y check; al cancelar conservar relación histórica y liberación en ledger.
8. `payment_reports`: UUID, `order_id`, `bank_account_id`, `reference`, `reported_at`, `transfer_date`, `receipt_storage_path`, `receipt_sha256`, `status`, `verified_amount_minor`, `bank_posted_at`, `reviewer_id`, `reviewed_at`, `resolution_note`; solo uno activo inicial por orden, versiones correctivas auditables.
9. `bank_accounts`: UUID, banco, titular, número enmascarado/publicación segura, tipo, moneda, activo, etiquetas; fuente administrable y lectura pública limitada a datos necesarios para transferir.
10. `admin_users`: `auth_user_id` UUID, rol, activo, timestamps. Nunca autoconceder admin al registrarse.
11. `audit_logs`: actor_id, acción, entidad, id, old/new seguro (sin comprobante, tokens o secretos), IP resumida, timestamp, correlación.
12. `payment_incidents`: orden/hold opcional, categoría, monto reportado, referencia, estado, resolución (conciliado/devuelto), timestamps y admin responsable.
13. `idempotency_records` opcional si no se resuelve en orders/holds de manera transaccional; almacenar request hash, resultado/estado.

**Validaciones/índices:** claves foráneas; precios y cantidades positivos; unique de boleto por rifa; índice `(raffle_id,status)`; índices de expiración de holds; referencia bancaria indexada y alertas de posible reuso (no confiar en igualdad para decidir si dinero entró); búsquedas admin por estado/fecha; prohibición de borrar órdenes pagadas; RLS cerrado por defecto si se habilita Data API de Supabase.

**Semillas y documentación:** rifa DEMO de 100 números, usuarios y pagos ficticios; diagramar relaciones, tablas y reglas de transición. Ninguna credencial ni cuenta real.

**Criterios de aceptación:** migraciones up/down o procedimiento verificable de recuperación; DB limpia genera exactamente N números sin duplicados; constraints fallan ante duplicado/valor inválido; seed reejecutable sin duplicación; integración DB pasa.

## B2 — Admin autenticado + CRUD de rifas públicas
**Objetivo:** catálogo administrable y API pública consumible por frontend.

**API mínima:**
- `GET /api/v1/raffles` (lista pública de rifas PUBLISHED; paginación/filtros)
- `GET /api/v1/raffles/:slug` (detalle público)
- `GET /api/v1/raffles/:slug/availability` (conteos agregados: available/held/reserved/sold; ninguna PII)
- `GET /api/v1/bank-accounts/public` (datos mínimos habilitados)
- `GET /api/v1/admin/raffles`, `POST /api/v1/admin/raffles`, `PATCH /api/v1/admin/raffles/:id`, `POST /api/v1/admin/raffles/:id/publish`, `.../pause`, `.../resume`.

**Instrucciones:** auth verificada server-side (JWT + admin_users), roles básicos owner/admin; validaciones estrictas, permisos de publicación, imágenes propias, transacción de creación de tickets; auditoría; filtros/paginación. Rechazar modificación de precio/N tras primer hold u orden salvo decisión formal.

**Criterios:** visitante solo ve rifas publicadas; anónimo no puede CRUD; cambios inválidos no crean boletos parciales; porcentaje público explica si es vendido vs comprometido.

## B3 — Motor de disponibilidad y pre-reservas técnicas
**Objetivo:** asegurar cupo antes de transferir sin crear una orden.

**API:** `POST /api/v1/checkout-holds` (rifa + cantidad + idempotencyKey), `GET /api/v1/checkout-holds/:id` (solo con token secreto), `DELETE /api/v1/checkout-holds/:id` (opcional, token); mostrar cantidad, total, `expiresAt`, pero **nunca números**.

**Reglas:**
1. Rifa PUBLISHED en ventana válida; cantidad entre mínimo/máximo y disponible suficiente; precio obtenido de DB. No superar límites por sesión/IP.
2. Una pre-reserva tiene token impredecible, TTL configurado inicialmente 60 minutos y estado ACTIVE.
3. Toda mutación de inventario por rifa debe adquirir bloqueo transaccional en orden consistente, por ejemplo **bloquear primero la fila `raffles` con `FOR UPDATE`** y luego boletos/hold. Esto serializa la asignación por rifa en MVP; medir contención luego.
4. Selección uniformemente aleatoria: consultar los números disponibles dentro del bloqueo, seleccionar sin reemplazo con `crypto.randomInt` + Fisher-Yates parcial (nunca `Math.random()` para asignación); actualizar exactamente q tickets `HELD` de forma atómica. Si capacidad crece mucho, benchmark y reemplazar algoritmo por otro igual de verificable.
5. Cambios de cantidad crean otra cotización/hold controlada; no reusar números de hold vencido.
6. Liberador periódico y liberación lazy liberan **solo** `HELD` vencidos; nunca `RESERVED` de órdenes. Comparar contra hora DB, transacción y auditoría. Si hold ya CONSUMED no tocar.
7. Implementar protección de acaparamiento: límites por IP/sesión, rate limiting, máximo de holds simultáneos, CAPTCHA adaptable y monitorización sin exponer PII.

**Pruebas obligatorias:** 50-100 solicitudes paralelas para últimos boletos; todos los números únicos; total de estados suma N; expirar hold libera solo sus números; retry mismo idempotencyKey produce mismo hold; hold no permite adivinar números.

**Criterios:** ningún doble hold; respuestas 409 (`INSUFFICIENT_TICKETS`) cuando q > disponible; comprobación de atomicidad y rendimiento documentada.

## B4 — Formulario único: crear orden + subir comprobante
**Objetivo:** implementar **una sola operación del comprador** que envía todo y devuelve números.

**API:** `POST /api/v1/orders` con `multipart/form-data` (holdId, token, idempotencyKey, campos comprador, banco, referencia, fecha transferencia, comprobante); `GET /api/v1/orders/:code` requiere mecanismo de consulta privado (cookie segura + sesión corta, token de alta entropía u OTP). No hay `POST /payments` para el flujo normal.

**Pasos del servidor:**
1. Validar antiabuso, tamaño <=5 MB configurable, MIME y magic bytes (JPG/PNG/PDF, no SVG/ejecutables), campos, hold token/vigencia y que cantidad/precio coincidan; no confiar en client total.
   Correo obligatorio, no vacío y con formato válido, máximo 254 caracteres;
   rechazar ausencia/formato inválido antes del upload y sin crear orden.
2. Calcular SHA-256 del archivo, rechazar archivos peligrosos según políticas, almacenar preliminarmente en bucket privado mediante cuenta del servidor (`pending/{uuid}`) fuera de una transacción DB larga; crear política de limpieza de huérfanos; si storage falla, no crear orden. Nunca emitir URL pública.
3. Transacción DB: lock raffle -> hold y tickets; comprobar hold ACTIVE/no vencido; idempotencia transaccional y `hold_id` consumible una sola vez; crear/upsert seguro cliente, orden, `order_tickets`, reporte de pago con path del archivo y estado REPORTED, convertir `HELD` en `RESERVED`, marcar hold CONSUMED, auditoría y commit.
4. Tras commit: 201 con código no adivinable, estado PENDING_REVIEW, cantidad, total, vencimiento nulo de orden y números formateados; sesión de consulta segura. Si fallo, compensar archivo huérfano y permitir reintento seguro.
5. Doble clic, timeout y respuesta perdida: retry idempotente devuelve la **misma** orden y mismo conjunto de números con prueba de identidad de la sesión/hold. No permitir al usuario modificar prueba de otra orden.
6. Si hold venció cuando se estaba haciendo transferencia, **no inventar ni asignar números**; error específico `HOLD_EXPIRED` y ruta operativa de incidencia/soporte sin borrar posibilidad de conciliación de pago.

**Pruebas:** sin comprobante => no orden; PDF falso/corrupto => 422; storage down => no orden sin prueba; retry/timeout => 1 orden; dos submits de un hold => 1 resultado; precios alterados => importe DB; token ajeno => 403/404; nunca URLs privadas en respuesta.

**Criterios:** flujo funcional completo de orden+comprobante; números aparecen únicamente tras commit exitoso; no existe autoexpiración de `RESERVED`.

## B5 — Verificación manual de pagos y resolución
**Objetivo:** operativa real de revisión sin aprobación automática.

**API:**
- `GET /api/v1/admin/orders?status=&from=&to=&page=`
- `GET /api/v1/admin/orders/:id` (cliente, números, importe, historial y acceso efímero al archivo)
- `POST /api/v1/admin/orders/:id/start-review`
- `POST /api/v1/admin/orders/:id/approve` (confirmación bancaria y monto verificado)
- `POST /api/v1/admin/orders/:id/request-resolution` (motivo)
- `POST /api/v1/admin/orders/:id/cancel` (resolución, evidencia de no cobro/reembolso si aplica)

**Requisitos:**
- Roles y reautorización para acciones críticas; verificar ingreso bancario fuera del sistema; nunca marcar PAID solo por imagen OCR/archivo.
- Aprobación atómica: validar estado, monto y referencia; registrar el movimiento y convertir TODOS los tickets `RESERVED` a `SOLD`, auditoría; idempotente ante duplicado de petición.
- Alertar referencias/comprobantes/hash repetidos entre órdenes sin asumir fraude automáticamente. El admin registra referencia bancaria verificable y monto confirmado.
- Revisión negativa -> `NEEDS_RESOLUTION`; números siguen `RESERVED`. El admin puede contactar/completar subsanación por proceso controlado, sin una segunda «compra».
- Cancelación **solo tras conciliación** y resultado documentado (`NOT_PAID_CONFIRMED`, `REFUNDED`, `DUPLICATE_RESOLVED`, etc.); dentro de transacción liberar `RESERVED` a `AVAILABLE`; preservar historial.
- Limitar acceso a comprobantes a admin y URLs firmadas cortas (o proxy autenticado), nunca registros abiertos.

**Pruebas:** repetir aprobación no duplica ventas; cancelación de PAID directa bloqueada; NEEDS_RESOLUTION mantiene números; cancelación comprobada libera exactamente q; admin no autorizado obtiene 403; trazabilidad del reviewer.

## B6 — Consultas, cierre de rifas y operación diaria
**Objetivo:** completar funciones operativas y evitar sorteos con pagos sin resolver.

**API:**
- Consulta de orden solo con credencial segura de cliente (`GET /api/v1/orders/:code`), recuperación por OTP si se integra canal externo en fase posterior; nunca consultar por teléfono sin prueba de posesión.
- Admin `GET /api/v1/admin/dashboard`, `/reports/orders.csv` (permiso y sin datos innecesarios), `/raffles/:id/summary`, `POST /admin/raffles/:id/close`.
- Cierre: no aceptar nuevas pre-reservas; manejar holds vigentes con reglas explícitas; impedir declaración de resultado mientras haya `PENDING_REVIEW`, `UNDER_REVIEW`, `NEEDS_RESOLUTION` o incidencias monetarias abiertas.

**Reglas:** estadísticas separan `SOLD`, `RESERVED`, `HELD`, `AVAILABLE`; ingreso **confirmado** difiere de suma de comprobantes enviados; métricas en transacciones; exportaciones registradas. Agregar política de privacidad, borrado/retención con preservación exigible de contabilidad/auditoría.

**Criterios:** admin ve cifras consistentes (suma tickets=N); no filtra PII; no se puede finalizar sorteo con órdenes pendientes; las rifas PAUSED/CLOSED rechazan nuevos holds según regla.

## B7 — Seguridad, QA, carga y resiliencia
**Objetivo:** preparar para usuarios reales.

**Checklist:**
- Tests unitarios de dominio y tabla de transiciones.
- Integración Postgres real: aislamiento/concurrencia, timeouts, lock ordering, rollback, idempotencia, consistencia y constraints.
- E2E: desde hold -> upload -> creación -> revisión -> aprobación/cancelación -> resumen.
- Carga concurrente con últimas existencias, reintentos aleatorios, expiración del hold durante upload; medir percentiles p50/p95 y errores, sin inventar SLA.
- Validación de entradas, validación archivo por firma, antivírus/escaneo si disponible, extensión/MIME, rate limiting, CAPTCHA, permisos IDOR, CORS/CSRF según cookies, CSP, cabeceras y gestión de tokens.
- Seguridad de PII, retención y observabilidad sin log de contenido de comprobante, phone o token.
- Resiliencia DDoS antes de producción: protección en el borde para web y API,
  impedir acceso directo al origen que eluda esa protección, límites HTTP
  compartidos entre instancias, identidad de proxy confiable, cuotas/timeouts
  y alertas de saturación/coste. Verificarlo en el hosting elegido; los límites
  de holds y las pruebas de integridad concurrente no certifican resistencia DDoS.
- Simular caída Storage, DB, pérdida de red, dos admins a la vez, cambio de estado después de review, y errores de limpieza huérfana.
- Backup + restauración ensayada; no considerar un backup listo si no se probó restaurar.

**Criterios:** matriz `MATRIZ_QA.md` verde; vulnerabilidades críticas/altas corregidas; tests de restauración ejecutados; observabilidad y plan de incidentes listos.

## B8 — Staging, documentación y salida controlada
**Objetivo:** despliegue reproducible y revisión previa a la venta real.

**Entregables:** staging aislado de producción, pipelines con aprobación, migraciones automáticas controladas, variables de entorno documentadas, procedimientos de backup/rollback, manual del admin, tabla de métricas y alertas, procedimientos de soporte/reembolso y checklist legal/fiscal.

**Bloqueo de lanzamiento:** no activar ventas reales ni anunciar rifas sin verificar permisos aplicables, reglas y términos públicos, privacidad, obligaciones fiscales, requisitos de la entidad bancaria y seguridad.

## Integración en la secuencia única
- M0: B0 + F0, fundamentos compartidos.
- M1: B1 + B2 + F1 + F2, catálogo conectado.
- M2: B3 + F3, cantidad y pre-reserva sin números.
- M3: B4 + F4, orden y comprobante en una acción.
- M4: B5 + F5, revisión manual y conciliación desde la web.
- M5: B6 + F6, operación diaria y editor que reutiliza B2.
- M6: B7 + F7, robustez conjunta.
- M7: B8 + F8, staging y salida controlada.

Estas dependencias ordenan las tareas dentro de cada hito; no requieren sesiones separadas. B5 ya implementado se reutiliza al completar M4. La siguiente entrega conjunta y sus condiciones se mantienen en [PLAN_DESARROLLO.md](PLAN_DESARROLLO.md).

## Entrega obligatoria de cada tarea a Codex
**1.** Qué se implementó. **2.** Migraciones y pruebas. **3.** Endpoints + ejemplos OpenAPI. **4.** Cómo arrancar/demo. **5.** Riesgos y supuestos. **6.** Qué fase desbloqueó. **7.** Qué falta y por qué. No declarar éxito sin pruebas ejecutadas.
