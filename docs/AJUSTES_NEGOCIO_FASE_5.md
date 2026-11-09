# Etapa 5 — Consulta pública censurada por teléfono

Estado: implementada y verificada localmente en API/datos/web. Sustituye expresamente el diseño OTP original por instrucción del propietario del 2026-11-08. No declarar desplegada ni migrada remotamente sin evidencia.

## Alcance

`/consultar-boletos`, accesible desde la cabecera, menú móvil y navegación inferior. Rifa + teléfono → nombre y correo parcialmente censurados y cantidad registrada. No entrega números, códigos de orden, identidad completa, estados de pagos ni premios. Las órdenes completas mantienen la sesión protegida original. La consulta pública no verifica la identidad del visitante.

Incluye órdenes pendientes/en revisión/en resolución y pagadas; excluye canceladas y pre-reservas técnicas. Paginar rifas y grupos de registros; no asumir una sola orden/persona por teléfono. Correo ausente muestra «No registrado». Ver [ADR 0028](decisions/0028-public-masked-phone-summary.md) para reglas exactas, privacidad y límites.

## Datos y contrato

- Migración aditiva `20261109021312_ticket_recovery_stage5.sql`: tabla RLS `ticket_lookup_limits`, índices de teléfono normalizado y cliente/rifa. Ninguna modificación de clientes, órdenes ni boletos.
- Recuperación: `infra/recovery/stage5-down.sql`, limitada a contadores e índices nuevos. Conservar auditoría e histórico.
- DEMO: reutiliza `infra/seeds/demo.sql`; la prueba integrada crea compras sintéticas con comprobantes del adaptador privado local y correos `.invalid`. No hay filas funcionales que sembrar en la tabla de contadores.
- OpenAPI/cliente 0.11.0: `GET /api/v1/ticket-lookup/raffles` y `POST /api/v1/ticket-lookup/search`. Paginación, validación, Origin permitido, respuesta no-store y DTO exclusivamente censurado.
- No hay proveedor, envío real de mensajes ni nueva variable. Usa `CHECKOUT_ABUSE_HASH_KEY` existente, requerida estable y secreta en staging/production.
- El endpoint responde `LOOKUP_UNAVAILABLE` (503) hasta aplicar la migración; no usa un contador local que eluda el control durable.

## Verificación

- `npm run generate:api`: contrato y cliente 0.11.0 regenerados.
- `npm run typecheck`, `npm run lint` y `npm run lint --workspace @sorteos/web`: aprobados. Se corrigió un aviso inicial de referencia en cleanup de React; no se deshabilitó la regla.
- `npm test`: 27/27 API, incluidas censura de valores cortos/Unicode y normalización exacta. `npm run test:config`: 10/10.
- `npm run test --workspace @sorteos/web`: 59/59; `npm run test:core --workspace @sorteos/web`: 6/6.
- `npm run build:api` y `npm run build --workspace @sorteos/web`: aprobados.
- PostgreSQL 17 aislado, `scripts/test-backend-local.ps1 -PgBin 'C:/Program Files/PostgreSQL/17/bin' -Port 54348 -TestScript test:lookup -PasswordAuthentication`: 1/1 escenario integrado, múltiples órdenes, privacidad, aislamiento por rifa, cancelación y límites concurrentes entre dos instancias (20 consultas admitidas y 4 rechazadas; sigue rechazando después). Auditoría sin teléfono, contadores HMAC y RLS verificados.
- Mismo runner con `-TestScript test:recovery`: 2/2; rollback/reaplicación B3/B4 preservan restricciones e historial y reincorporan la tabla nueva (26 tablas).

Incidencias corregidas: el campo histórico `published_at` no se rellena por el flujo actual de publicación; se usan los estados públicos PUBLISHED/PAUSED/CLOSED/DRAWN en vez de suponer una fecha. Una corrección inicial tuvo comillas TypeScript inválidas, resuelta antes del resultado aprobado. El intento de crear un correo nulo en una compra nueva fue rechazado correctamente por `customer_email_required`; se retiró ese fixture inválido. La compatibilidad de correo ausente se prueba en el enmascarador y la UI, sin relajar la restricción de compra.

Navegador: 1/1 integrado aprobado con PostgreSQL/Nest/Next reales y Chrome instalado (`PLAYWRIGHT_CHANNEL=chrome`, runner con `-TestScript test:stage5`). Verifica escritorio 1280 px, móvil 390 px sin desbordamiento, búsqueda positiva/vacía, privacidad y ausencia de OTP; axe WCAG A/AA sin incidencias en escritorio. Capturas revisadas en `.tmp/stage5-browser/desktop.png` y `mobile.png`. El primer intento falló por puerto de Next desalineado; el segundo por falta del Chromium incluido con Playwright. Se corrigió el puerto y se añadió selección opcional del canal para usar Chrome instalado sin quitar aserciones.

No se ejecutó la regresión global de etapa 7 ni Auth/Storage productivos. Los límites por IP comparten cuota entre personas detrás de una misma dirección; el servidor mantiene su política previa de no confiar automáticamente en proxies. Revisar topología/proxy y protección de borde antes de producción (pendiente M6/M7).

## Siguiente paso

Etapa 6: simplificación pública restante. La migración remota y el despliegue requieren autorización explícita; la continuación de etapa 5 no los presupone.
