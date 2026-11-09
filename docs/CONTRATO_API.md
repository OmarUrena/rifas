# Contrato REST compartido — App Sorteos / API v1

## Etapa 6 — OpenAPI 0.12.0

Catálogo y detalle incorporan `canPurchase`: verdadero solo con estado PUBLISHED, ventana de venta abierta y disponibilidad para la compra mínima. Es una proyección informativa; no crea hold/orden ni sustituye las validaciones transaccionales del checkout. El progreso al 100% no altera esta propiedad. La compra conserva los mismos endpoints, cuerpo multipart, comprobante obligatorio, idempotencia y consulta protegida.


## Etapa 5 revisada — OpenAPI 0.11.1

Decisión del propietario: búsqueda pública por teléfono sin OTP, exclusivamente para resumen censurado. No concede sesión ni acceso a órdenes/boletos completos.

- `GET /api/v1/ticket-lookup/raffles?page=1&pageSize=12`: rifas publicadas alguna vez, incluidas pausadas/cerradas; `{items:[{id,title}],total}`.
- `POST /api/v1/ticket-lookup/search?page=1&pageSize=12`: cuerpo `{raffleId,phone}`, Origin permitido. HTTP 200 `{items:[{maskedName,maskedEmail,ticketCount,orderStatus}],total,totalTickets}`; correo nullable. Máximo efectivo 12 órdenes/página.
- Cuenta órdenes no canceladas, incluidas pendientes; no HELD. Devuelve una fila por orden, con su estado PENDING_REVIEW/UNDER_REVIEW/NEEDS_RESOLUTION/PAID; distintas órdenes no comparten un estado inferido. Sin coincidencia devuelve lista y conteos vacíos, incluso para rifa no publicada/inexistente.
- Censura al menos la mitad del nombre y de cada parte del correo en servidor. Nunca devuelve nombres/correos completos, números, códigos de orden, contactos, premios, comprobantes o datos bancarios.
- Teléfono internacional o formas dominicanas con prefijos 809/829/849; normalización exacta sin cambios históricos. No admite búsquedas parciales.
- Sin OTP, cookies nuevas ni proveedor. POST/no-store, auditoría sin parámetros, límite durable de 20 consultas/IP/hora y 30/teléfono/hora (incluye páginas y vacíos). 429 al exceder, 503 `LOOKUP_UNAVAILABLE` sin migración. Se conserva la protección de `GET /orders/:code`.

## Extensión de etapas 3 y 4 — OpenAPI 0.10.0

Todas las rutas siguientes llevan prefijo `/api/v1`. Escrituras administrativas con OWNER, sesión/MFA vigente e `Idempotency-Key` UUID; lecturas privadas disponibles para ADMIN/OWNER y auditadas. Las respuestas no se almacenan en caché.

- `GET/POST /admin/raffles/:id/prizes`: configuración inmutable de premios bendecidos.
- `GET/POST /admin/raffles/:id/blessed-numbers`: consulta y asignación MANUAL o RANDOM, cinco cifras; no crea boletos.
- `GET /admin/raffles/:id/blessed-awards`: beneficiarios privados, paginación y estado.
- `GET /raffles/:slug/blessed-numbers`: números configurados públicos de rifas publicadas, sin beneficiarios.
- Catálogo incluye `blessedNumbers` y `blessedNumberCount`; orden protegida incluye `blessedAwards`.
- `GET /admin/raffles/:id/lottery/:kind`: `prizes`, `results`, `awards` o `deliveries`, con `page` y `pageSize`. Responde `{items,total}`. Los registros incluyen identificador, premio, número, estado, referencia, fecha, orden, contacto privado y actor según el tipo.
- `POST /admin/raffles/:id/lottery`: `action: PRIZE` con `title`; `RESULT` con `pick4` de cuatro cifras, `fireball` de una, `eventAt` ISO UTC y `reference`; `AWARD` con `resultId,prizeId`; `DELIVERY` con `source: LOTTERY|BLESSED`, `awardId,eventAt,reference`. Responde `{id}`. Misma clave y cuerpo recuperan el resultado, cuerpo distinto devuelve 409.
- Formación exacta en servidor y PostgreSQL: Pick 4 + FIREBALL al final (`0012` + `5` = `00125`). Registro manual; no existe conexión a Florida Lottery.
- Registrar un resultado no declara ganador ni cambia estado de rifa. Solo la venta cerrada antes del evento, orden ya PAID y boleto SOLD permiten congelar elegibilidad. Confirmación exige además cero órdenes pendientes y cero holds vigentes. No existe resultado sustituto automático.
- Premios de lotería: una unidad por registro, separados de las unidades bendecidas. Entregas únicas, confirmadas y documentadas; historial inmutable. No se ejecutan pagos bancarios ni se publican datos personales.
- Errores conocidos: `PRIZES_LOCKED`, `PRIZE_CAPACITY_EXCEEDED`, `BLESSED_NUMBER_EXISTS`, `LOTTERY_NOT_ELIGIBLE`, `IDEMPOTENCY_CONFLICT`. Requisitos de integridad fallidos: 422; unidad o entrega duplicada: 409.

Las secciones previas a continuación describen los hitos históricos; el contrato generado actual es `docs/openapi.json`.

> Ajustes etapa 2 (2026-11-08), OpenAPI 0.8.0: rango implícito 00000..99999 para
> nuevas rifas, generación al pre-reservar, objetivo privado y progreso público.
> Detalles en [fase 2](AJUSTES_NEGOCIO_FASE_2.md). Bendecidos, premios y OTP
> permanecen pendientes; no asumir endpoints para esas funciones.

## Extensión de etapa 2 — rango y recaudación

- Nuevas altas exigen `totalTickets: 100000` y `fundraisingTargetMinor` entero
  positivo <=9007199254740991. El primero es capacidad lógica: no crea tickets.
- Catálogo y detalle incluyen `progressPercent: integer | null`, 0..100,
  calculado con suma de órdenes PAID, truncado y limitado a 100. Null significa
  objetivo no configurado, no cero recaudado. No devuelve objetivo o ingreso.
- `numberWidth` es cinco para universos <=100000; legacy mayor conserva su ancho.
  Órdenes y detalles administrativos presentan números con ese criterio.
- Disponibilidad usa total configurado menos HELD vigentes/RESERVED/SOLD.
  Un número sin fila también está disponible. Al crear un hold se generan solo
  los seleccionados, bajo bloqueo y aleatoriedad criptográfica uniforme.
- `POST /admin/raffles/:id/fundraising-target`, OWNER/Bearer,
  `Idempotency-Key` UUID obligatorio. JSON `{fundraisingTargetMinor,
  expectedVersion, reason}`; 200 `{id, version, fundraisingTargetMinor}`.
  Igual clave/payload recupera resultado; conflicto de clave/payload o versión:
  409. Funciona sin pausar; no cambia publicación, precio o reglas. El patch
  general rechaza objetivo; mantiene las restricciones de edición existentes.
- DTO administrativo añade `inventoryPolicy`, objetivo nullable,
  `confirmedAmountMinor` y `actualProgressPercent` nullable como cadenas decimales.
- Toda lectura sigue `no-store`; refrescar para ver aprobaciones y nuevos objetivos.
  Alcanzar 100% no bloquea compras: disponibilidad y estado son controles separados.

**Fuente de verdad:** OpenAPI generado desde NestJS. Este documento define el contrato inicial deseado; si Codex detecta incompatibilidad, debe proponer ADR y actualizar **ambos** consumidores, no divergir silenciosamente.

## Convenciones
- Base `/api/v1`; JSON excepto `POST /orders` que recibe `multipart/form-data` con comprobante.
- Dinero: entero en **centavos DOP** `amountMinor` (RD$100.00 = 10000); no `float`. Formateo visual `Intl.NumberFormat('es-DO',{style:'currency',currency:'DOP'})` tras conversión segura para presentación.
- Timestamps ISO 8601 UTC en red; UI muestra hora de Santo Domingo; backend es autoridad para expiraciones.
- UUID para IDs internos; `orderCode` público no secuencial, no es credencial de acceso; números de boleto string ceropadded en respuesta, integer en DB.
- Todas las respuestas de error: `{ "error": { "code": "...", "message": "...", "details": {}, "requestId": "..." } }` sin PII ni errores internos.
- `Idempotency-Key` UUID (cliente lo reutiliza en reintentos de **la misma** operación); backend distingue payload igual vs distinto y mantiene respuesta vinculada al guest session.
- Paginación `{items:[], pagination:{page,pageSize,total}}` sin exponer datos privados en rutas públicas.
- `Cache-Control: no-store` para órdenes, holds, admin y comprobantes. Disponibilidad pública puede cachearse por pocos segundos, pero al crear hold se valida en DB.

## Sesión de invitado, acceso a órdenes y CSRF
**Decisión de implementación sugerida:** NestJS crea cookie anónima de sesión con 256 bits de entropía al primer checkout. Cookie `HttpOnly; Secure; SameSite=Lax; Path=/`; en desarrollo local tratar Secure según HTTPS. El servidor almacena solo el hash del secreto y vincula holds/órdenes a esa sesión. Ningún token ni `orderCode` en localStorage, querystrings o analíticas. Frontend usa `credentials:'include'`; CORS restringido a web origin; validar `Origin` y defensa CSRF en POST. Esto NO convierte al invitado en usuario autenticado: si pierde la cookie, recuperación futura exige OTP del teléfono o soporte verificado, nunca consulta pública por nombre/teléfono.

## Endpoints públicos

### Salud del servicio — implementado y validado en B0

- `GET /health`: 200 `{"status":"ok"}` indica que responde el proceso.
- `GET /health/ready`: consulta PostgreSQL con `SELECT 1`; 200
  `{"status":"ready","database":"up"}` si responde. Sin conexión configurada:
  503 `DATABASE_NOT_CONFIGURED`; fallo de conexión: 503 `DATABASE_UNAVAILABLE`.
- Errores con el envelope común; `X-Request-Id` generado por servidor y
  `Cache-Control: no-store`. No divulgar host, versión, credenciales ni diagnóstico DB.
- JSON OpenAPI de las rutas implementadas: `/api/v1/openapi.json`; UI:
  `/api/v1/docs`. Ambos solo si Swagger está habilitado en desarrollo/test.
  Generación offline del esquema mediante `pnpm generate:api` (requiere dependencias).

En B4 están implementados catálogo, cuentas públicas, administración de rifas,
sesión invitada, pre-reservas y envío/consulta de órdenes con comprobante privado.
Revisión de pagos y reportes siguen pendientes de B5–B6.

### `GET /raffles?page=1&pageSize=12`
**200:** `{items:[{id,slug,title,prizeImageUrl,status,ticketPriceMinor,totalTickets,confirmedSoldCount,availableCount}],pagination:{...}}`.
Solo rifas PUBLISHED (o histórico visible con control explícito). No divulgar titulares/compradores/números.
En B2 solo PUBLISHED; `page>=1`, `pageSize` entre 1 y 100. `prizeImageUrl` puede
ser null; las imágenes proceden del bucket público de premios configurado.

### `GET /raffles/:slug`
**200:** `{id,slug,title,description,prize,prizeImageUrl,images:[{url,alt}],status,totalTickets,numberWidth,ticketPriceMinor,minPurchase,maxPurchase,rules,rulesVersion,startsAt,endsAt,confirmedSoldCount,reservedCount,availableCount}`.
`startsAt` y `endsAt` admiten null; DRAFT/PAUSED/CLOSED responden 404 en rutas públicas.

### `GET /raffles/:slug/availability`
**200:** `{total,available,held,reserved,sold,asOf}`. Invariante `total=available+held+reserved+sold` cuando no hay VOID. Lo único que garantiza compra es una pre-reserva exitosa.
`held` solo cuenta pre-reservas vigentes; HELD vencidos se computan como disponibles
sin cambiar inventario en el GET de disponibilidad. B3 libera transaccionalmente
al operar holds y mediante un barrido periódico.
RESERVED nunca se reclasifica por tiempo.

### `GET /bank-accounts/public`
**200:** `{items:[{id,bankName,accountType,accountDisplay,holderName,currency:'DOP'}]}`. Solo cuentas publicadas por admin, datos destinados a recibir transferencias.

### `POST /checkout-session` — B3

Antes de la primera pre-reserva, llamar con `Origin` de la allowlist y
`credentials:'include'`. Responde 201 `{ready:true}` y establece cookie
`__Host-sorteos_guest` en staging/production; en development/test `sorteos_guest`.
Es HttpOnly, SameSite=Lax, Path=/ y Secure en entornos desplegados. Caduca a las
24 horas; repetir con sesión vigente renueva el plazo y conserva el secreto.
No devuelve credenciales en JSON. El servidor guarda SHA-256 del secreto de
256 bits; no se utiliza UUID público como credencial.

Este paso separado permite reintentar un hold cuya respuesta se perdió sin
perder también su sesión. Esperar la respuesta antes de enviar holds y mantener
una sola inicialización de sesión a la vez en el cliente. Una cookie inválida o
vencida se reemplaza; no recupera holds de sesiones anteriores. Si la respuesta
inicial de sesión se pierde, repetirla puede crear una sesión vacía adicional,
sujeta al límite por IP; no crea órdenes ni asigna boletos.

POST/DELETE exigen Origin válido y rechazan Sec-Fetch-Site: cross-site.
Desplegar web/API bajo el mismo sitio para que SameSite=Lax permita la cookie;
una integración SSR debe reenviar esa cookie de forma protegida. No hay token
en querystrings, body ni localStorage. Sin sesión vigente: 401 SESSION_INVALID.

### `POST /checkout-holds`
**Header:** `Idempotency-Key: 0b30...` + `Origin` válido.

**JSON solicitud:**
```json
{"raffleId":"11111111-1111-4111-8111-111111111111","quantity":10}
```
**201 ejemplo:**
```json
{
  "holdId":"22222222-2222-4222-8222-222222222222",
  "raffleId":"11111111-1111-4111-8111-111111111111",
  "quantity":10,
  "unitPriceMinor":10000,
  "totalMinor":100000,
  "currency":"DOP",
  "expiresAt":"2026-10-27T02:00:00Z",
  "serverTime":"2026-10-27T01:00:00Z",
  "status":"ACTIVE"
}
```
**No devuelve números.** Si insuficiencia => 409 `INSUFFICIENT_TICKETS`; si límites => 422 `INVALID_QUANTITY`; 429 abuso.

Requiere cookie de sesión obtenida previamente. Solo acepta raffleId y quantity;
rechaza precios, números y campos desconocidos. La cantidad respeta min/max de
rifa y HOLD_MAX_QUANTITY (100 por defecto). Se valida PUBLISHED y ventana de
venta con hora DB; en otro caso 409 RAFFLE_NOT_AVAILABLE. TTL inicial 60 minutos.
La sesión debe durar al menos ese TTL; si falta plazo, 401 SESSION_INVALID:
renovar checkout-session con la misma cookie antes de crear el hold.

Idempotencia única por sesión y UUID de cabecera, incluso entre rifas. Mismo
payload devuelve 201 con el mismo hold, precio y vencimiento; serverTime refleja
la consulta actual. Distinto payload: 409 IDEMPOTENCY_CONFLICT. El reintento de
un hold vencido/cancelado/consumido devuelve su estado actual, nunca lo reactiva
ni sustituye: para otra intención se requiere una clave nueva. No hay renovación
de TTL por reintentos o lecturas. Cambiar cantidad requiere cancelar el hold
anterior y crear otro, sujeto a disponibilidad y límites; no hay reemplazo garantizado.

Defaults: 1 hold vigente/sesión, 3/IP, 20 nuevas pre-reservas exitosas/IP/hora,
60 sesiones nuevas/IP/hora. Límites compartidos por DB; fallan con 429
RATE_LIMITED. Las cancelaciones no reinician el cupo horario. IP mediante HMAC
privada estable, sin guardar IP cruda ni confiar en X-Forwarded-For del cliente.
El throttling HTTP general añade límite por proceso a intentos fallidos.

### `GET /checkout-holds/:id`
Requiere sesión invitado propietaria, devuelve estado/importe/expiración **sin números**; 404 para otros. `DELETE /checkout-holds/:id` opcional, sujeto a sesión y auditoría.

Ambos endpoints están implementados. GET libera el hold si venció y devuelve
200 con EXPIRED. DELETE de ACTIVE devuelve 200 CANCELLED y libera solo sus HELD;
repetir conserva CANCELLED/EXPIRED; CONSUMED devuelve 409 HOLD_CONSUMED.
Un job por instancia barre hasta 20 rifas/ciclo (30 segundos por defecto),
omite rifas bloqueadas y reintenta después. Nunca libera RESERVED ni SOLD,
ni modifica una orden por antigüedad. La liberación lazy ocurre dentro de la
transacción de la operación y se revierte si esa operación falla.

### `POST /orders` — UN SOLO SUBMIT de orden + pago
`multipart/form-data`, con campos concretos:
- `holdId`: UUID de pre-reserva propia aún ACTIVE.
- `idempotencyKey`: UUID estable (también cabe en header).
- `customerName`: nombre completo, longitud validada.
- `customerPhone`: teléfono normalizado en backend.
- `customerEmail`: obligatorio, no vacío y con formato válido (máximo 254 caracteres).
- `bankAccountId`: UUID de cuenta activa.
- `bankReference`: referencia de transferencia, texto seguro validado.
- `transferDate`: fecha/hora reportada por cliente (no equivale a confirmación bancaria).
- `receipt`: imagen JPG/PNG o PDF, obligatorio, 5MB máximo inicial configurable.
- `acceptedRulesVersion`: versión de reglas/condiciones aceptadas.

Decisión del 2026-11-03: el correo es obligatorio para nuevas órdenes y debe
validarse tanto en F4 como en B4 antes de subir el archivo o crear la orden.
Recogerlo no implica verificar su titularidad ni autoriza acceso a la orden;
no se añade OTP ni envío de mensajes sin definir ese flujo. B4 valida el correo
en DTO y exige presencia en nuevas escrituras mediante CHECK NOT VALID, sin
rellenar datos históricos ni editar la migración B1 aplicada.

El endpoint está implementado en B4. Usa la cookie de B3; no recibe un token
en body ni URL. Exige Origin válido. Idempotency-Key UUID en cabecera o campo
idempotencyKey; si ambos están presentes deben coincidir. Campos desconocidos,
arrays o duplicados no válidos se rechazan; no acepta precios ni números.
Teléfono se normaliza a E.164 quitando separadores de presentación; admite
prefijos internacionales. Campos de texto se recortan. transferDate debe incluir
zona horaria y no superar la hora DB en más de 5 min. Banco activo y no DEMO.

acceptedRulesVersion debe coincidir con snapshot y reglas vigentes; cambio:
409 RULES_CHANGED. Hold vigente de una rifa PUBLISHED o PAUSED puede finalizar:
la pausa impide nuevos holds, no invalida por sí sola una transferencia en curso.
Rifa CLOSED/DRAWN no admite envío. Las reglas/banco/hold/sesión se revalidan
después de Storage y antes de confirmar. Si el hold venció/canceló, 409 HOLD_EXPIRED;
si ya fue consumido por otra clave, 409 HOLD_CONSUMED, sin asignar sustitutos.

Archivos: 5 MiB por defecto, límite configurable hasta 10 MiB; un solo archivo.
MIME y firma JPG/PNG/PDF, decodificación completa de imágenes (hasta 10 millones
de píxeles, sin animación) y parseo PDF 1.0–1.7 (1–20 páginas, sin cifrado ni
acciones/formularios/adjuntos activos admitidos). No se confía en nombre/extensión.
Se conserva el original y su SHA-256, no una URL pública. Validación aislada en
worker, máximo 10 s y heap acotado; no equivale a escaneo antivirus certificado.
Como máximo 4 uploads por instancia y 2 validaciones simultáneas. Cada sesión
puede tener 2 cargas pendientes vigentes y 20 intentos de staging por hora;
exceso: 429. Los límites HTTP de B0 y la sesión de B3 siguen aplicándose.

Storage requiere clave privada de servidor y bucket diferente del público de
premios; se comprueba public=false antes del upload y se usa upsert=false.
Sin configuración o Storage disponible no se crea una orden nueva (503).
receipt_staging registra cada intento antes del I/O. Upload fuera de transacciones;
commit enlaza staging y reporte en la misma transacción que el inventario.
Rollback o intento concurrente perdedor compensa su archivo; si hubo resultado
ambiguo del upload, un job lo limpia tras 10 min. Job cada 60 s, hasta 20 filas
por ciclo, con reintentos si falla borrar. Un staging reclamado para limpieza
ya no puede adjuntarse a una orden. Nunca borrar ATTACHED automáticamente.

**201 ejemplo tras creación y commit atómico:**
```json
{
  "orderCode":"RF-0123456789ABCDEF0123456789ABCDEF",
  "status":"PENDING_REVIEW",
  "paymentReportStatus":"REPORTED",
  "raffleId":"11111111-1111-4111-8111-111111111111",
  "raffleTitle":"RIFA DE DEMOSTRACIÓN",
  "quantity":3,
  "ticketNumbers":["00184","03592","08731"],
  "totalMinor":30000,
  "currency":"DOP",
  "createdAt":"2026-10-27T01:32:00Z",
  "message":"Orden y comprobante recibidos. Los números están reservados y el pago está pendiente de verificación."
}
```
**Invariantes:** `numberCount===quantity`; numeros únicos de esa rifa; órdenes en `PENDING_REVIEW` no expiran solas; sin comprobante válido => nunca emitir 201 ni crear orden.

**Errores relevantes:** 400 `INVALID_REQUEST`, 401/403 `SESSION_INVALID`, 409 `HOLD_EXPIRED`, 409 `HOLD_CONSUMED`, 409 `RAFFLE_NOT_AVAILABLE`, 409 `IDEMPOTENCY_CONFLICT`, 413 `FILE_TOO_LARGE`, 415 `UNSUPPORTED_FILE_TYPE`, 422 `INVALID_RECEIPT`, 503 `STORAGE_UNAVAILABLE`.

**Respuesta perdida:** mismo idempotencyKey + misma sesión + mismos campos y
archivo (SHA-256 del original) => misma orden y mismos tickets, sin duplicación.
Si payload cambia => 409 IDEMPOTENCY_CONFLICT. El nombre del archivo no forma
parte del fingerprint. Si la orden ya existe no se repite el upload; se devuelve
su estado actual, incluso si el hold ya aparece CONSUMED. Sin archivo también
se rechaza un retry: para consultar sin reenviar, usar GET protegido.

### `GET /orders/:orderCode`
Implementado: requiere guest session propietaria; no basta conocer código.
**200:** mismo OrderDto que POST: `{orderCode,status,paymentReportStatus,raffleId,
raffleTitle,ticketNumbers,quantity,totalMinor,currency,createdAt,message}`.
Se unifica el DTO de consulta/submit para el cliente tipado. No devuelve nombre,
teléfono, correo, comprobante o cuenta sensible. Sin sesión válida 401;
con otra sesión o código desconocido 404. Accesos propios auditados.
La cookie de B3 tiene plazo renovable de 24 h; las órdenes no expiran con ella.
Perderla o dejarla vencer requiere una recuperación verificada futura; B4 no
habilita consulta pública por email/teléfono ni implementa OTP.

## Endpoints administrativos (JWT + admin_users activo + autorización)

### Autenticación implementada en B2

Enviar `Authorization: Bearer <access_token>` de Supabase Auth del proyecto
configurado. Se verifican ES256/RS256, firma mediante JWKS fijo, emisor, audiencia
authenticated, expiración, subject UUID y session_id. Además, se consulta
`/auth/v1/user` con la clave publicable del servidor y se exige que el UUID
coincida. Cada solicitud comprueba `admin_users.active` y rol en PostgreSQL;
email, user_metadata, cookies isAdmin y flags del navegador no autorizan.

Sin token/inválido: 401. Usuario Auth válido fuera de allowlist/inactivo: 403.
Auth sin configurar o no disponible: 503 AUTH_UNAVAILABLE. No se expone login,
signup ni bootstrap privilegiado por HTTP; F5 usará Supabase Auth y sesión SSR.
El JWT no debe ir en URLs, logs ni localStorage del flujo de compra.

OWNER y ADMIN pueden consultar, crear DRAFT, editar DRAFT/PAUSED y pausar.
Solo OWNER publica o reanuda. Accesos y mutaciones se auditan sin guardar tokens.

### Payload y respuestas de rifas — B2

`POST /admin/raffles` recibe JSON: slug, title, description, prize, totalTickets,
ticketPriceMinor (entero en centavos), minPurchase, maxPurchase, rules,
rulesVersion; startsAt/endsAt opcionales y anulables; images opcional (máximo 8):
`[{storageKey:'prizes/imagen-propia.webp',alt:'Descripción',rightsConfirmed:true}]`.
No acepta status, números seleccionados ni campos de autorización. La creación
de rifa y N boletos es atómica. Devuelve 201 con AdminRaffleDto.

AdminRaffleDto contiene el detalle público más version, hasCommitments y media
(`storageKey`, alt, rightsConfirmed). `GET /admin/raffles/:id` devuelve 200 con
ese mismo DTO; `GET /admin/raffles` admite page/pageSize y status opcional.

PATCH admite esos mismos campos como opcionales y responde 200. Solo fechas
pueden ser null. N es inmutable por la decisión de B1; precio bloqueado desde el
primer hold. Una rifa publicada se pausa antes de editar. Editar invalida su
aprobación anterior. Los cambios de estado se hacen exclusivamente con acciones.

Publicar/reanudar reciben obligatoriamente:

```json
{"rulesApproved":true,"requirementsReviewed":true,"mediaRightsConfirmed":true}
```

Es una declaración administrativa del propietario, no una certificación legal
automática. Se requieren reglas, imágenes propias marcadas y objeto accesible
con MIME de imagen en el bucket público. Se verifica HEAD fuera de la transacción
y luego version bajo bloqueo; edición concurrente: 409 CONCURRENT_MODIFICATION.
Publicar exige DRAFT; reanudar exige PAUSED. Pausar exige PUBLISHED y no necesita
payload. Las tres acciones responden 200 con AdminRaffleDto.

Errores adicionales uniformes: 409 RAFFLE_FIELDS_LOCKED, RAFFLE_NOT_EDITABLE o
INVALID_RAFFLE_STATE; 422 INVALID_RAFFLE, INVALID_MEDIA o
PUBLICATION_REQUIREMENTS_NOT_MET; 503 MEDIA_UNAVAILABLE. Conflicto de slug: 409
CONFLICT. Validación estructural y campos desconocidos: 400 INVALID_REQUEST.

| Método | Ruta | Acciones / validaciones |
|---|---|---|
| GET | `/admin/raffles` | listar incluidas DRAFT/PAUSED |
| GET | `/admin/raffles/:id` | B2: detalle de administración sin datos de compradores |
| POST | `/admin/raffles` | crear rifa + N tickets en DB de forma atómica |
| PATCH | `/admin/raffles/:id` | validar campos inmutables tras compromiso |
| POST | `/admin/raffles/:id/publish` | validar requisitos para publicación |
| POST | `/admin/raffles/:id/pause` | pausar nuevos holds |
| POST | `/admin/raffles/:id/resume` | reanudar si permitido |
| POST | `/admin/raffles/:id/close` | bloquear nuevas ventas y auditar; sorteo no disponible si pendientes |
| GET | `/admin/orders` | paginado, filtros status/fecha/rifa, acceso mínimo |
| GET | `/admin/orders/:id` | detalle privado y auditoría |
| GET | `/admin/payment-reports/:id/receipt-url` | B5: descriptor del proxy autenticado |
| GET | `/admin/payment-reports/:id/receipt` | B5: bytes privados, Bearer MFA, sin caché |
| POST | `/admin/orders/:id/start-review` | `PENDING_REVIEW -> UNDER_REVIEW` |
| POST | `/admin/orders/:id/approve` | requiere importe+referencia verificados; `RESERVED->SOLD` atómico |
| POST | `/admin/orders/:id/request-resolution` | motivo; mantiene RESERVED |
| POST | `/admin/orders/:id/cancel` | resolución documentada; libera solo después de conciliación |
| GET | `/admin/dashboard` | cifras agregadas coherentes |
| GET | `/admin/reports/orders.csv` | export auditable, acceso admin |

### Sesión administrativa web — M4

`GET /api/v1/admin/session` requiere Bearer, usuario Auth válido, allowlist activa y sesión Auth existente/no vencida. Devuelve `200 {adminId,role:'OWNER'|'ADMIN',mfaRequired,mfaVerifiedUntil:string|null,developmentAccessUntil:string|null}` con `Cache-Control: no-store`. Sin MFA reciente devuelve metadatos mínimos para configurar/verificar TOTP y no concede acceso financiero, salvo la capacidad explícita de desarrollo descrita abajo. Con MFA reciente vuelve a comprobar sesión/factor mediante autorización financiera B5. Sesión revocada: 401 SESSION_REVOKED; no autorizado: 403; Auth/metadatos no disponibles: 503. No devuelve JWT, refresh token, email ni otra PII. OpenAPI 0.5.2.

Excepción autorizada de desarrollo: solo con API development/test y loopback, capacidad secreta de servidor vinculada a administrador/sesión y concesión DB vigente, `mfaRequired=false`, `mfaVerifiedUntil=null` y `developmentAccessUntil` contiene el vencimiento. No certifica MFA ni eleva OWNER/ADMIN; cada acceso financiero verifica la capacidad y se audita. El navegador no puede suministrar el token. Staging/production rechazan la configuración de excepción.

En ese mismo perfil, `GET /bank-accounts/public` puede ofrecer cuentas marcadas DEMO que siguen inactivas en DB. `POST /orders` solo las admite para `demo-prueba-completa` con reglas DEMO-PRUEBA-1 y capacidad vigente, revalidando tras el upload. Los clientes de esa ruta se marcan DEMO. Fuera de ese caso continúan exigiéndose cuentas reales activas y no DEMO. El comprobante sigue obligatorio y la orden inicia PENDING_REVIEW; véase [ADR 0018](decisions/0018-development-full-workflow.md).

La web usa cookies HttpOnly de alcance `/admin` y rutas same-origin propias: POST `/admin/auth/login`, `factors`, `enroll`, `verify`, `refresh`, `logout`; GET `/admin/api/orders`, `/admin/api/orders/:id`, `/admin/api/payment-reports/:id/receipt`, `/admin/api/session`; POST de las cuatro acciones B5 bajo `/admin/api/orders/:id/*`. Son adaptadores de sesión/cliente tipado en Next.js, no nuevos endpoints de negocio ni acceso directo a tablas. Todas las mutaciones comprueban Origin exacto. No hay registro público, consulta por email o salto de MFA. Ver [ADR 0012](decisions/0012-m4-admin-web-session.md).

Logout borra las credenciales web y solicita revocación de la sesión Auth actual. Una marca HttpOnly independiente de cierre bloquea cookies que reaparezcan por renovaciones pendientes; solo un login nuevo la elimina. Las lecturas sin renovación no reescriben tokens. Si el proveedor no confirma revocación, la web informa cierre local con revocación remota pendiente; no considera un JWT expirado como prueba de revocación del refresh token.

### Reglas financieras B5 mantenidas en M4

Las ocho operaciones B5 (bandeja, detalle, descriptor, descarga y cuatro
acciones) requieren Bearer de Supabase, allowlist activa, `aal2` y TOTP
verificado en los últimos 15 minutos. Se comprueba también sesión y factor
vigentes en Auth, incluyendo antes de entregar un archivo descargado.
OWNER aprueba/cancela; OWNER y ADMIN pueden ejecutar las demás operaciones.
No se aprueba por OCR o por recibir una imagen.

`GET /admin/orders` admite page/pageSize (máximo 100), status, raffleId,
from/to (ISO con zona, límites inclusivos de creación). Devuelve
`{items,pagination:{page,pageSize,total}}`, sin datos personales en la lista.
Los elementos contienen id, orderCode, raffleId, raffleTitle, status,
paymentReportStatus, quantity, totalMinor, version, createdAt,
duplicateReferenceCount y duplicateReceiptCount.

El detalle añade customer (name, phone, email; históricos pueden tener null),
ticketNumbers con ceros, paymentReport sin ruta/hash de Storage, las últimas
100 acciones y 100 incidencias. Cada acceso sensible se audita.
`receipt-url` devuelve `{url:'/api/v1/admin/payment-reports/<id>/receipt',
access:'AUTHENTICATED_PROXY'}`. La ruta requiere Authorization en cada GET;
no es un enlace público ni una URL firmada. La descarga responde JPG/PNG/PDF,
`Cache-Control: no-store`, `nosniff` y nombre genérico de adjunto.

Las cuatro acciones reciben `Idempotency-Key` UUID y `expectedVersion` del
detalle vigente. La clave se conserva en reintentos del mismo payload, con
alcance por administrador; reutilizarla con otro contenido da 409
IDEMPOTENCY_CONFLICT. Versión obsoleta: 409 CONCURRENT_MODIFICATION.
`start-review` recibe solo `{expectedVersion}` y admite PENDING_REVIEW o
NEEDS_RESOLUTION. `request-resolution` añade reason (10–2000 caracteres) y
reportStatus (`DISPUTED` o `INVALID`); mantiene todos los boletos RESERVED.

**Ejemplo de aprobación (datos de demostración):**
```json
{
  "expectedVersion": 1,
  "verifiedAmountMinor": 30000,
  "bankPostedAt": "2026-10-27T01:33:00Z",
  "bankConfirmationReference": "REF-BANCO-DEMOSTRACION",
  "note": "Depósito verificado en extracto bancario.",
  "bankVerified": true,
  "duplicateSignalsReviewed": true
}
```
El importe debe ser exactamente el total congelado de la orden, entero en
centavos; fecha con zona horaria y sin exceder cinco minutos futuros.
`duplicateSignalsReviewed` es opcional salvo señales de referencia/hash o
referencia bancaria verificada repetida: entonces debe ser true. Estas señales
requieren revisión humana y no determinan fraude automáticamente.

Las acciones responden **200** con
`{actionId,orderCode,status,version,soldTicketCount,reservedTicketCount,
releasedTicketCount,reviewedAt,reviewedBy}`. El reintento idéntico devuelve el
resultado original. Aprobación convierte exactamente q RESERVED en SOLD.

**Ejemplo cancelación (solución del pago explícita):**
```json
{
  "expectedVersion": 1,
  "resolutionType":"NOT_PAID_CONFIRMED",
  "reason":"Comprobante inválido y sin depósito bancario localizado tras conciliación.",
  "evidenceReference":"INC-DEMOSTRACION",
  "reconciliationConfirmed":true
}
```
REFUNDED exige además receivedAmountMinor, refundAmountMinor (ambos positivos
e iguales), refundReference y refundedAt con zona. Registra una devolución
comprobada fuera del sistema; no ejecuta una transferencia bancaria.
DUPLICATE_RESOLVED exige duplicateOfOrderId de otra orden PAID y
duplicateBankReference igual a la referencia verificada de su reporte VERIFIED
del mismo banco. Campos de otra modalidad se rechazan.
La cancelación conserva orden, reporte, archivo e historial, resuelve incidencias
y libera exactamente q RESERVED. PAID/CANCELLED son terminales para estas acciones.

Errores B5 adicionales: 401 SESSION_REVOKED; 403 MFA_REQUIRED o
ADMIN_ACCESS_REVOKED; 422 AMOUNT_MISMATCH, DUPLICATE_REVIEW_REQUIRED,
RECONCILIATION_REQUIRED o INVALID_DATE_RANGE; 409 INVALID_ORDER_STATE;
503 AUTH_UNAVAILABLE/STORAGE_UNAVAILABLE. Falta de rol OWNER: 403 FORBIDDEN.
### Operación diaria — M5 (OpenAPI 0.6.0)

Implementados `GET /admin/dashboard`, `GET /admin/raffles/:id/summary`,
`POST /admin/raffles/:id/close` y `GET /admin/reports/orders.csv`.
Requieren JWT real, allowlist activa, sesión vigente y MFA reciente (o la capacidad
temporal de desarrollo ya autorizada); cierre y exportación solo OWNER.

Dashboard/resumen: `{total,available,held,reserved,sold,asOf,confirmedAmountMinor,
pendingAmountMinor,pendingOrders,openIncidents,activeRaffles}`. Los importes son
**cadenas de enteros decimales en centavos DOP**, sin redondeo JS; conteos enteros.
Ingreso confirmado suma órdenes PAID; pendiente incluye PENDING_REVIEW,
UNDER_REVIEW y NEEDS_RESOLUTION. Incidencias incluye OPEN y UNDER_REVIEW, también
las vinculadas a holds sin orden. Cifras en una instantánea REPEATABLE READ.
HELD vencidos cuentan disponibles; RESERVED no vence.

Cierre recibe `{expectedVersion}` obligatorio. Exige PAUSED y cero holds ACTIVE
con `expires_at > now()`. Conflictos 409: CLOSE_REQUIRES_PAUSE, ACTIVE_HOLDS_EXIST,
CONCURRENT_MODIFICATION. PostgreSQL verifica nuevamente bajo bloqueo de rifa y
exige contexto financiero. Cierre irreversible: rechaza nuevos holds/envíos;
mantiene órdenes y revisión posterior. No declara resultado, libera reservas
ni habilita DRAWN.

CSV acepta filtros `status`, `raffleId`, `from`, `to` (fechas con zona). No pagina:
máximo 10000 filas; excederlo devuelve 422 EXPORT_TOO_LARGE sin truncar. Columnas:
codigo_orden, rifa (slug), estado, cantidad, total_centavos_DOP, creada_UTC.
Excluye contactos, identidad, boletos, referencias bancarias, archivos y tokens.
UTF-8, comillas RFC4180, CRLF y protección contra fórmulas; attachment y no-store.
Se auditan cantidad y filtros no sensibles. Solo OWNER puede descargar.

`POST /admin/media`: multipart `image`, máximo 5 MiB, JPG/PNG/WebP/AVIF real,
máximo 20 millones de píxeles. La API normaliza WebP sin metadatos, genera clave
UUID sin sobrescritura y devuelve `{storageKey,url}` para images de creación/
edición. Bucket público de premios separado del privado de comprobantes.
Auth/MFA preceden al multipart; se revalida autorización antes de auditar y se
compensa el archivo si falla. 503 MEDIA_UNAVAILABLE; 422 INVALID_MEDIA.
Adaptador DEVELOPMENT_LOCAL_MEDIA explícito solo loopback development/test;
`GET /media/:id` sirve exclusivamente sus fotos y devuelve 404 fuera de ese modo.

PATCH /admin/raffles/:id admite `expectedVersion`; la web siempre lo envía.
Numeración inmutable desde creación; precio bloqueado tras la primera pre-reserva,
aunque venza. Editar exige DRAFT/PAUSED, borra aprobaciones y requiere nuevas
confirmaciones para reanudar. No existe borrado de rifas/histórico contable.

Se reutiliza GET /orders/:code con cookie de cliente: el código nunca basta.
La confirmación web actualiza estado; perder sesión conduce a asistencia por
canal verificado, sin búsqueda abierta por teléfono/correo ni OTP simulado.

## Matriz compacta de estados

| Objeto | Origen | Destino | Quién / condición |
|---|---|---|---|
| Hold | ACTIVE | CONSUMED | backend, POST /orders completado |
| Hold | ACTIVE | EXPIRED | job, `expiresAt<=now`, no orden |
| Ticket | AVAILABLE | HELD | checkout, DB transaction |
| Ticket | HELD | AVAILABLE | expiración/cancelación de hold sin orden |
| Ticket | HELD | RESERVED | submit con comprobante válido |
| Order | PENDING_REVIEW | UNDER_REVIEW | administrador |
| Order | PENDING_REVIEW/UNDER_REVIEW | PAID | admin verifica ingreso |
| Order | PENDING_REVIEW/UNDER_REVIEW | NEEDS_RESOLUTION | admin detecta problema |
| Order | NEEDS_RESOLUTION | UNDER_REVIEW/PAID | reanuda/reconcilia y valida |
| Order | NEEDS_RESOLUTION/UNDER_REVIEW/PENDING_REVIEW | CANCELLED | admin documenta resolución financiera |
| Ticket | RESERVED | SOLD | admin verifica pago orden |
| Ticket | RESERVED | AVAILABLE | orden CANCELLED tras conciliación |

**No hay transición automática `RESERVED -> AVAILABLE` por tiempo.**

## Errores y UX para frontend

| HTTP/código | Mensaje orientado al usuario |
|---|---|
| 409 `INSUFFICIENT_TICKETS` | «Ya no quedan tantos boletos disponibles. Reduce la cantidad.» |
| 409 `HOLD_EXPIRED` | «La reserva temporal venció. Si ya transferiste, solicita asistencia.» |
| 409 `IDEMPOTENCY_CONFLICT` | «Esta solicitud ya fue procesada con otros datos. Consulta tu orden.» |
| 415 `UNSUPPORTED_FILE_TYPE` | «Adjunta JPG, PNG o PDF.» |
| 413 `FILE_TOO_LARGE` | «El comprobante supera el tamaño permitido.» |
| 429 `RATE_LIMITED` | «Demasiadas solicitudes; inténtalo más tarde.» |
| 503 `STORAGE_UNAVAILABLE` | «No pudimos recibir el comprobante. No se creó la orden.» |
| 403 `FORBIDDEN` | «No tienes permiso para realizar esta acción.» |

## Contrato no funcional
- M6 / OpenAPI 0.7.0: el límite HTTP general usa `HTTP_RATE_STORE=postgres` en
  staging/production. Su 429 incluye `Retry-After` en segundos; los límites de
  negocio del checkout también pueden responder 429 sin ese encabezado. Mantener
  la intención y su clave al reintentar; nunca generar una orden nueva para eludirlo.
- El 503 del almacén de límites no permite continuar una operación crítica. El
  endpoint de liveness sigue independiente de DB; readiness no habilita ventas.
- En rutas Auth de Next, origen rechazado devuelve 403 `ORIGIN_NOT_ALLOWED`, sin
  borrar la sesión existente. Continúan la comparación estricta de origen y la
  prohibición de cross-site. No es un nuevo permiso ni un cambio de rol.
- No PII en respuestas públicas, logs, URLs, SEO o analytics.
- Cada write crítico auditado con `requestId` y actor.
- Entornos: `development`, `test`, `staging`, `production` separados; usar datos DEMO en primeros tres.
- Si se implementa otro mecanismo de autorización/archivo, documentar con ADR antes de cambiar el contrato; no romper formulario único.
