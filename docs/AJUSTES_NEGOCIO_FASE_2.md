# Ajustes de negocio — Etapa 2: rango y progreso

Fecha: 2026-11-08. Estado: implementación integrada y verificación local completadas, con incidencias de ejecución descritas abajo. Posteriormente el propietario autorizó y se aplicó la migración al proyecto Supabase Rifas; catálogo verificado. No se desplegó la web.

## Comportamiento

- Nuevas rifas: rango 00000..99999, cero filas de boletos al crearlas. Solo se materializan números elegidos al pre-reservar. No se revelan números en HELD.
- Selección uniforme CSPRNG entre posiciones libres, sin reemplazo ni generación anticipada del universo. Bloqueo de rifa y restricción única evitan asignaciones dobles.
- Objetivo requerido en nuevas altas; edición independiente para OWNER, incluso con ventas al 100% o después del cierre, con motivo, versión e idempotencia.
- Progreso público genérico de 0..100, calculado por servidor con dinero PAID. Importes agregados y cálculo entero sin floats. Objetivo/importe/porcentaje real son administrativos.
- Legacy mantiene su universo y filas. Objetivo inicial null; sin objetivo no hay barra pública. Presentación de cinco cifras si el universo cabe; universos mayores mantienen ancho histórico. No se inventan objetivos ni se convierten registros reales.
- Administración dispone de formulario de objetivo separado del editor bloqueado; el sitio conserva tema rojo reversible. El texto «Comprar» y la simplificación general siguen en etapa 6.

## Datos y contrato

Migración creada con CLI oficial y probada inicialmente como `20261108153831_raffle_fundraising_stage2.sql`. Archivo vigente: `infra/supabase/migrations/20261108165909_raffle_fundraising_stage2.sql`; renombrado para coincidir con la versión registrada al aplicarla mediante Supabase MCP, sin cambios de contenido (SHA-256 verificado antes/después). No se editaron manualmente registros del historial.

Agrega `inventory_policy`, `fundraising_target_minor`, guardas e índices parciales de importes PAID e idempotencia en auditoría. Cambia población inicial a solo LEGACY; conserva protección por número y transacciones. No agrega tablas ni permite acceso desde navegador.

OpenAPI 0.8.0: `progressPercent: integer | null` en catálogo/detalle; alta exige `totalTickets: 100000` y `fundraisingTargetMinor`. Valores de total anteriores se rechazan, no se ignoran. Patch general permite repetir total histórico sin modificarlo y rechaza objetivo. DTO administrativo incorpora objetivo, política, importe confirmado como cadena y porcentaje real como cadena nullable.

`POST /api/v1/admin/raffles/:id/fundraising-target` requiere Bearer de OWNER activo e `Idempotency-Key` UUID. Body: `{fundraisingTargetMinor, expectedVersion, reason}`. Responde `{id, version, fundraisingTargetMinor}`. Misma clave/payload devuelve resultado previo; payload cambiado o versión obsoleta: 409. Validación estricta, auditoría y `no-store`. El proxy Next conserva sesión/origen y envía la cabecera tipada.

Autorización reutiliza AdminGuard de catálogo y revalida allowlist/rol en transacción. No cambia los requisitos MFA del flujo administrativo ni concede aprobación de pagos a esta ruta.

## Seed y recuperación

`infra/seeds/demo.sql` sigue siendo fixture histórico LEGACY. `infra/seeds/stage2-demo.sql` es un fixture opcional DRAFT sin venta real: al ejecutarlo dos veces conserva rango/objetivo y cero boletos.

`infra/recovery/stage2-down-unused.sql` se ejecuta solo transaccionalmente en una DB aislada o autorizada. Rechaza uso FIVE_DIGIT, objetivo o historial de cambio. Con negocio en uso: corregir hacia delante. No modificar migraciones aplicadas, reducir rango, borrar tickets o restaurar un backup sobre ventas posteriores.

Las suites de recuperación hacen preflight antes de retirar columnas y antes de reparar historia; una prueba negativa no puede dejar parcialmente retirado el esquema. El procedimiento de diagnóstico/conversión de fase 1 sigue pendiente de autorización para datos reales.

## Verificación

### Aplicación remota autorizada — 2026-11-08

El propietario reportó «No pudimos completar la solicitud», referencia
`36b1c834-476f-44f7-ada9-ebecdd580569`. No se encontró esa referencia en los
registros locales disponibles; sí se reprodujo catálogo 500 con readiness 200.
Se confirmó por consulta de metadatos que faltaban ambas columnas de etapa 2.

Autorización explícita posterior: «Aplica la migracion». Se aplicó únicamente
`raffle_fundraising_stage2` al proyecto `Rifas` (`vukzxpwnfbavlwaeqkki`) mediante
la herramienta nativa `apply_migration`. Resultado: success; versión
`20261108165909`. La migración M6 sigue pendiente en ese proyecto y no se aplicó
como efecto secundario de esta corrección.

Verificación posterior:

- `/api/v1/health/ready`: HTTP 200.
- `/api/v1/raffles`: HTTP 200, antes respondía 500.
- Web `/rifas` y `/admin/login`: HTTP 200. El catálogo devuelve `progressPercent`
  en ambas rifas y no expone `fundraisingTargetMinor`.
- Conteos antes/después: 2 rifas, 200 tickets, 2 órdenes y 2 reportes de pago.
- Huellas de rifa (ID, rango, estado, precio) y tickets (ID, rifa, número,
  estado y vínculos) idénticas. Ambas rifas conservan LEGACY y objetivo null.
- Sin creación de rifas/boletos de prueba, asignación de objetivos o cambio de
  universos existentes. El permiso concedido no autoriza esas conversiones.
- Asesores de seguridad sin diferencias frente a la lectura previa: avisos
  preexistentes sobre `public.rls_auto_enable` y protección de contraseñas.
  Referencias: [ejecución anónima](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable),
  [ejecución autenticada](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable)
  y [contraseñas](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
  No se cambiaron permisos o ajustes Auth fuera de la migración autorizada.

Lección operativa: aplicar y verificar el esquema requerido antes de activar
el código que lo consume. La verificación de conexión sola no acredita que
la versión del esquema sea compatible con la API.

### Verificación local histórica de implementación

Las pruebas usan PostgreSQL 18 local aislado, servicios Next/Nest reales y fixtures de protocolos Auth/Storage; no acreditan servicios remotos.

Comandos desde raíz salvo indicación contraria:

- `npm run generate:api`: PASS, OpenAPI y cliente regenerados.
- `npm run lint`, `npm run lint --workspace @sorteos/web`, `npm run typecheck`: PASS.
- `npm test`: PASS 25/25. Un primer intento agotó el plazo de arranque de un subproceso bajo ejecución concurrente; repetición sin modificar la prueba aprobada.
- `npm test --workspace @sorteos/web`: PASS 51/51; `npm run test:core --workspace @sorteos/web`: PASS 6/6.
- `npm run build:api`: PASS. `node .tmp/build-stage2.mjs`: PASS, build web de producción con webpack sobre fuentes finales, copia aislada sin `.env`, API_MODE live y API/Auth sin configurar; no verifica servicios remotos.
- `powershell -NoProfile -File scripts/test-backend-local.ps1 -PgBin 'C:/Program Files/PostgreSQL/18/bin' -PasswordAuthentication -Port 54348 -TestScript test:integration`: 100/101 aprobados; un alta de orden del fixture financiero respondió 500 en ejecución concurrente. No se acredita salida cero de esta ejecución.
- Mismo comando con `-TestScript test:payments`: PASS 25/25 en repetición, incluido el caso fallido, concurrencia de objetivos y edición tras cierre. Los otros 76 escenarios de integración pasaron en la ejecución completa. No hubo cambios de código de producto entre estas dos verificaciones.
- `$env:STAGE2_QA='1'; powershell -NoProfile -File scripts/test-backend-local.ps1 -PgBin 'C:/Program Files/PostgreSQL/18/bin' -PasswordAuthentication -Port 54350 -TestScript test:m5`: PASS 5/5. Navegador móvil comprador y escritorio administrativo, Next/Nest/PostgreSQL reales, adaptadores externos de pruebas. Incluye cero boletos al crear, objetivo publicado, compra con comprobante, cierre, aprobación y objetivo posterior al cierre. Primer recorrido agotó el plazo de navegación; repetición completa aprobada, sin omitir pasos.

- Desde `apps/web`, `npx playwright test foundation.spec.ts catalog.spec.ts --project=mobile --project=desktop`: PASS 28/28, salida cero. Incluye axe/contraste, teclado, ausencia de desbordamiento y nueva semántica de progreso. El cierre automático quedó esperando al servidor DEMO en Windows; se identificó y terminó únicamente el árbol `start-test-web.mjs 3102` creado por esa ejecución. El runner terminó después con código cero.
- `node .tmp/check-business-docs.cjs`: PASS, 90 enlaces locales en 16 documentos, cero destinos ausentes. `git diff --check`: PASS.

Capturas administrativas inspeccionadas en `.tmp/stage2-browser-screenshots/` y captura pública móvil en `apps/web/test-results/`. No se repitieron tablet/Firefox/WebKit o dispositivos físicos; no se atribuye cobertura de esos entornos a esta entrega.

La ejecución completa de integración conserva su resultado 100/101; la repetición financiera 25/25 verifica el caso pendiente. No se presenta la primera como una ejecución global con salida cero. El primer recorrido M5 tampoco se acredita como aprobado: la evidencia válida es la repetición completa 5/5.

Incidencias encontradas durante desarrollo: interpretación inicial de materialización descartada tras aclaración del propietario; fixtures legacy explícitos; consultas adaptadas a universo implícito; pruebas manuales de holds deben crear sus números de fixture. No se bajan restricciones para acomodar pruebas.

No se han implementado bendecidos, adjudicaciones de lotería ni consulta OTP. Siguiente etapa: 3, catálogo de premios y bendecidos, con política D06 pendiente de definición. La configuración de un bendecido debe referenciar rifa/número del rango sin exigir que exista ya una fila de boleto: no reintroducir población anticipada para configurar premios.
