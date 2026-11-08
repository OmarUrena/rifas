# Plan de acción Frontend — App Sorteos (Next.js App Router)

**Extensión 2026-11-08:** [fase 1 de ajustes](AJUSTES_NEGOCIO_FASE_1.md)
prepara progreso por objetivo, cinco cifras, bendecidos, consulta protegida y UX
mobile first. [Etapa 2](AJUSTES_NEGOCIO_FASE_2.md) implementa rango implícito,
progreso público y objetivo administrativo; las demás funciones siguen pendientes.
Conservar el tema público reversible.

**Uso vigente (2026-11-05):** especificación técnica de la web dentro de [PLAN_DESARROLLO.md](PLAN_DESARROLLO.md), la única secuencia de ejecución M0–M7. F0 se trabaja en M0; F1/F2 en M1; F3–F8 en M2–M7 con sus respectivas partes backend. Las dependencias B/F ordenan la implementación dentro del hito, sin separar sesiones ni aceptar mocks como integración terminada. Para payloads y seguridad ya implementados prevalece [CONTRATO_API.md](CONTRATO_API.md).

**Propósito:** construir una experiencia de compra móvil primero, en español, rápida, accesible y confiable, conectada exclusivamente a contratos reales de la API NestJS. La interfaz debe reflejar la diferencia entre **comprobante recibido** y **pago verificado**.

## Contexto no negociable
- Plataforma de un organizador; compradores invitados; admins autenticados.
- El comprador NO elige números: elige cantidad.
- En una sola pantalla/formulario: resumen de la rifa, cantidad, datos del banco, información del cliente, transferencia, referencia y carga **obligatoria** del comprobante. **Un solo botón «Enviar orden y comprobante».**
- Para evitar pagar sin cupo, antes de transferir, crear pre-reserva técnica de cupo (`hold`) de duración limitada. **No es orden**, NO muestra números; contador visible, reinicio no debe crear holds sin control.
- El POST final único envía datos + archivo, backend crea orden y muestra inmediatamente números asignados; status inicial `PENDING_REVIEW`. No afirmar «pago exitoso» ni «boleto vendido» hasta revisión.
- Tras submit, números de orden quedan `RESERVED` sin expiración automática hasta decisión administrativa; si admin requiere resolución no se liberan solos.
- Moneda RD$; zona horaria de visualización America/Santo_Domingo; montos calculados en servidor.
- No copiar el logo, imágenes, fuentes propietarias, HTML/CSS ni marca de Rifas Luxury RD; investigar como referencia de interacción e idear identidad propia.

## Design system y arquitectura UI
- Next.js App Router, React, TypeScript estricto, Tailwind CSS, componentes accesibles (elegir librería estable, p. ej. shadcn/ui solo si conviene), formularios accesibles y esquema de validación UI.
- API NestJS fuente de verdad; consumir OpenAPI mediante cliente generado tipado. No escribir directamente a Supabase desde el navegador ni usar service-role en frontend.
- Páginas públicas indexables (`/`, `/rifas`, `/rifas/[slug]`), compra con mínima exposición de datos (`/rifas/[slug]/participar`), confirmación protegida (`/orden/confirmacion`, ruta segura), consulta protegida, `/terminos`, `/privacidad`, `/ayuda`.
- Panel `/admin/login`, `/admin`, `/admin/rifas`, `/admin/rifas/nueva`, `/admin/rifas/[id]`, `/admin/ordenes`, `/admin/ordenes/[id]`, `/admin/configuracion`.
- Capas recomendadas: `app/`, `components/ui`, `features/raffles`, `features/checkout`, `features/admin`, `lib/api-client`, `lib/format`, `lib/auth`. Evitar un único componente de miles de líneas.
- Mobile first 360px, 768px, >=1280px; foco/teclado, contraste AA, loading/skeleton, empty/error, mensajes claros, formatos localizados, alt text, rendimiento de imágenes.
- Estilo inicial propuesto: confiable y moderno; tipografía legible, hero de premio, tarjetas con precio, progreso **vendido confirmado** vs reservado (sin mezclar), CTA fijo en móvil opcional. Sistema visual propio con variables de color y tokens.

## F0 — Auditoría y armazón web
**Dependencia:** B0 opcional con mocks documentados.

**Tareas a Codex:**
1. Auditar repo; si web existe preservarlo; si no, crear `apps/web` Next.js, TypeScript, Tailwind, ESLint, scripts test/build.
2. Design tokens (colores, tipografía, escalas, radios, spacing), componentes base Header, Footer, Button, Input, Badge, SectionContainer, EmptyState, Alert, Card, Toast; navegación accesible.
3. Config de API URL/ambiente y cliente OpenAPI tipado; manejo central de errores con `requestId` y `error.code`.
4. Mock Server/MSW o fixtures desacoplados para desarrollo UI cuando backend no está listo, con un `API_MODE=mock` solo en local/demo y bandera visual clara de demo. Nunca declarar una compra «real» en modo mock.
5. Páginas `/`, `/rifas`, `/admin/login` placeholder auténticas, 404, error boundary, loading.
6. Automatizar pruebas unitarias mínimas, análisis a11y básico y verificación responsive.

**Aceptación:** inicio y build, navegación y UI adaptable a móvil, mock claramente indicado y sin datos sensibles ni endpoints inventados como reales.

## F1 — Experiencia visual pública y componentes reutilizables
**Dependencia:** F0. Puede trabajarse con mocks antes de B2.

**Tareas:** definir wireframes en docs, establecer estilos, crear `RaffleCard`, `PrizeGallery`, `PricePanel`, `AvailabilityMeter`, `RaffleRules`, `StatusTag`, `FAQ`, `PurchaseQuantity`; componentes reutilizables sin lógica monetaria interna.

**Páginas:** home con hero y rifas destacadas, catálogo con estados vacío/cargando/error, detalle de rifa con fotos, descripción, reglas, precio y CTA. Estado agotado/pausado/cerrado manejado visualmente.

**UX:** resaltar RD$, entrada táctil grande, textos legibles, carga ligera; accesibilidad de teclado/lector, no construir barras de progreso basadas solo en color. Mensajes de cupo distintos: `vendidos`, `reservados`, `pre-reservados vigentes`, `disponibles` según contrato; diseño de porcentaje público «vendidos confirmados» por defecto.

**Aceptación:** páginas funcionales con fixtures; sin imágenes externas copiadas; Lighthouse/performance medido sin afirmar números no medidos; screenshot móvil/escritorio documentadas.

## F2 — Catálogo real + detalle + estados
**Dependencia:** B2.

**Tareas:** conectar `GET /raffles`, `GET /raffles/:slug`, `GET /raffles/:slug/availability`, `GET /bank-accounts/public`; tipado desde OpenAPI, invalidaciones/caché apropiadas, ISR/revalidación sin mostrar disponibilidad obsoleta al pagar.

**UX:** precio, rango de números, premios, estado, reglas, fecha solo si confirmada; mensajes distintos para agotada y pausada. Prohibido usar datos mock en producción.

**Aceptación:** catálogo se actualiza tras acciones admin, errores backend no rompen render, estados y cantidades consistentes, CTA habilitado solo si procede.

## F3 — Selector de cantidad y pre-reserva antes de transferir
**Dependencia:** B3.

**Pantalla `/rifas/[slug]/participar`:**
1. Bloque premio/precio y resumen de compra, input cantidad con botones +/- y validación de compra mínima/máxima.
2. Botón «Continuar a transferencia», solicita `POST /checkout-holds` y obtiene `holdId`, credencial de sesión, `expiresAt`, total calculado por servidor.
3. Mostrar cantidad y precio congelados, datos del banco y contador visible calculado desde hora servidor (`expiresAt` absoluto). No mostrar números asignados.
4. Explicar claramente que la reserva **de cupo** es temporal y el pago aún no está verificado; mostrar instrucciones de no transferir si está a punto de vencer, riesgos de transferencias lentas y soporte.
5. Si vence: desactivar envío, mostrar `Reserva vencida`, ofrecer nueva cotización/verificar cupo y ruta de asistencia si ya transfirió. No reintentar automáticamente una transferencia.
6. Al cambiar cantidad: cancelar hold anterior si procede, emitir nuevo con controles; al refresh: recuperar de forma segura el hold de la sesión (cookie protegida preferida), sin generar nuevo hold involuntario.
7. Evitar crear muchos holds por re-renders/clics repetidos; bloquear botón mientras request está en vuelo.

**Aceptación:** dos navegadores simultáneos reciben cupos coherentes, contador correcto al recargar, expiración bloquea envío, API mock no crea pedido ficticio.

## F4 — Formulario único de orden + comprobante y pantalla de confirmación
**Dependencia:** B4. Este es el núcleo de la experiencia del comprador.

**Diseño del formulario:**
- Resumen fijo: título del premio, cantidad, importe RD$, tiempo restante de pre-reserva, datos bancarios y botón seguro para copiar número de cuenta.
- Secciones **en la misma pantalla**: `Datos personales` (nombre, WhatsApp/teléfono y email obligatorios; validar formato del correo), `Datos de transferencia` (banco/cuenta seleccionada, referencia, fecha), `Comprobante` (archivo JPG/PNG/PDF obligatorio; <=5 MB configurable), `Aceptar reglas/privacidad`, `Enviar orden y comprobante`.
- Vista previa archivo sin exponerlo a tercero; control quitar/reemplazar; drag/drop opcional, acceso táctil y lector; evitar subir a localStorage.
- Precio siempre el confirmado por backend; no fiarse de estado del navegador o valor en formulario; si la reserva vence, bloquear y guiar a incidencia.
- `POST /orders` único multipart; no hacer llamadas independientes que crean una orden antes del comprobante. UX de progreso: `Validando formulario`, `Subiendo comprobante`, `Registrando orden`, `Generando números` (etapas visuales aproximadas, no prometer precisión de upload sin soporte).
- Para evitar doble clic, deshabilitar submit mientras procesa y enviar `Idempotency-Key` estable por intento; si la conexión cae, consulta/reintenta de forma segura sin crear orden duplicada.
- En 201: pantalla de confirmación con código de orden, estado `Pendiente de verificación`, total, números aleatorios formateados, instrucción de conservar referencia; **nunca** titularla «Pago aprobado».
- Consulta posterior con sesión/token privado o futuro OTP; no almacenar token secreto ni datos sensibles en URL o logs, y no exponer búsqueda abierta de órdenes.
- Si storage rechazó el archivo, mostrar error específico, conservar campos no sensibles y permitir reintento controlado sin duplicados.
- Si `HOLD_EXPIRED` tras transferencia, ir a ayuda/incidencia con explicación y no emitir números nuevos a la fuerza.

**Aceptación:** sin adjunto botón bloqueado/errores claros; submit único crea una sola orden; números solo aparecen tras 201; refresco o doble clic no inventa éxito; móvil probado con selector de archivos.

## F5 — Panel admin: autenticación y revisión manual
**Dependencia:** B5.

**Pantallas:** `/admin/login`, dashboard resumen, tabla órdenes con filtros y paginación, detalle orden, visor privado de comprobante, historial/auditoría, acciones de revisión. Auth server-side, ruta protegida; no redirigir silenciosamente a admin con email sin autorización.

**Detalles de orden:** código, rifa, cantidad, números, cliente, monto reportado, referencia, fecha reportada, recibo privado, incidentes e historial. Comprobante con URL firmada de corta duración o proxy; nunca `publicUrl`.

**Acciones:** `Marcar en revisión`, `Aprobar pago` (confirmación explícita de verificación bancaria y monto), `Requiere resolución` (motivo), `Resolver y cancelar` (motivo y prueba de conciliación). Hacer diálogos confirmatorios; errores y conflictos 409 visibles (si otro admin modificó orden); estados exactos.

**Aceptación:** usuario no admin no entra; aprobar cambia estado visual y sold, NEEDS_RESOLUTION mantiene boletos; no acción de cancelación directa por un simple rechazo; auditar actor, sin aprobación automática.

## F6 — Administrar rifas y operar el negocio
**Dependencia:** B2 + B6.

**Pantallas:** CRUD rifa, subida de imágenes propias, título/premio, N, precio, mínimo/máximo, fechas, reglas, vista previa, publicar/pausar/reanudar/cerrar; prohibir edición de campos bloqueados tras primera reserva; mostrar explicaciones del motivo.

**Dashboard y reportes:** ingresos **confirmados**, importes pendientes (no confundir), boletos `SOLD`, `RESERVED`, `HELD`, `AVAILABLE`, tasa de ocupación, rifas activas, órdenes pendientes. Tabla responsive con paginación/filtros, CSV cuando la API lo soporte y advertencia de datos sensibles.

**Consulta cliente:** vista protegida para recuperar estado de una compra; sin OTP disponible, implementar recuperación por soporte sin filtro abierto de teléfono; no exponer PII en SSR indexable.

**Aceptación:** todas las cifras corresponden a endpoints reales; cerrar rifa bloquea nuevas pre-reservas; interfaz alerta si hay órdenes sin resolver; CSV descargable solo por admin.

## F7 — Accesibilidad, UX, SEO, E2E y confianza
**Dependencia:** B7 y F4-F6.

**Pruebas:** Playwright móvil/escritorio con fixtures y ambiente de staging; navegación solo teclado, lector simulado (axe), contraste AA, estados loading/error/empty, respuesta 409/422/429/500, hold vencido, upload lento, reconexión, pérdida de respuesta, doble envío, pago aprobado vs revisión.

**Optimización:** metadatos y OG, sitemap de rifas publicadas, imágenes optimizadas con permiso, web vitals observados, caché de catálogo que no comprometa disponibilidad; política de cookies/privacidad; lenguaje sencillo, cuenta regresiva accesible, mensajes de estado sin transmitir certeza no verificada.

**Aceptación:** suite e2e verde, móvil 360px sin scroll horizontal, admin inaccesible a anónimos, flujos de error comprensibles.

## F8 — Staging, producción, documentación de uso
**Dependencia:** B8.

**Tareas:** entorno staging y production separados; variables públicas únicamente (sin service key), dominio, HTTPS, CSP/CORS, observabilidad sin PII, estados de mantenimiento, imágenes optimizadas y mapas de errores, manual ilustrado de usuario/admin y checklist de publicación.

**Gate:** simulación E2E completa en staging; aprobación de requisitos legales y bancarios para vender rifas reales; no lanzar sin ella.

## Componentes concretos que Codex debe implementar progresivamente

| Componente | Desde fase | Props/función clave |
|---|---|---|
| `RaffleCard` | F1 | raffle, price, confirmedSold, availability, status |
| `TicketQuantityPicker` | F1/F3 | min, max, value, onChange; accesibilidad |
| `ReservationTimer` | F3 | expiresAt, serverTimeOffset, onExpired |
| `BankTransferInstructions` | F3/F4 | cuenta activa, titular, banco, total minor |
| `CustomerFields` | F4 | nombre, teléfono, email, errores |
| `PaymentProofUploader` | F4 | archivo obligatorio, MIME/tamaño, preview |
| `CheckoutReview` | F4 | precio servidor, cantidad, consentimiento |
| `OrderConfirmation` | F4 | código, números, estado pendiente |
| `AdminOrderTable` | F5 | filtros, paginación, estados |
| `PrivateReceiptViewer` | F5 | acceso temporal auditado |
| `PaymentResolutionDialog` | F5 | approve/review/cancel y motivo |
| `RaffleEditor` | F6 | validación y campos bloqueados |
| `TicketStatusMetrics` | F6 | available/held/reserved/sold |

## Estados de UX y lenguaje obligatorio
- Antes de enviar: **«Cupo reservado temporalmente»**, NO «Tus números ya están comprados».
- Al enviar: **«Orden y comprobante recibidos»** + **«Números asignados, pendientes de verificación de pago»**.
- Admin aprueba: **«Pago confirmado»** y **«Boletos vendidos»**.
- Comprobante cuestionado: **«Tu orden requiere revisión; tus números siguen reservados»**.
- Pre-reserva caducada: **«La reserva temporal de cupo venció. Si ya transferiste, contáctanos para conciliar tu pago»**.
- Agotado: **«No hay números disponibles en este momento»** (puede ser porque hay reservas en revisión; no afirmar que todos fueron vendidos).

## Definición de terminado para cada fase frontend
- Implementación sin datos falsos en producción, contrato OpenAPI sincronizado, componentes testeados, estados loading/error/empty, responsive móvil, accesibilidad básica, captura manual o Playwright por vista, y documentación de configuración/pendientes. No completar fase si parte del flujo es un botón sin funcionalidad.
