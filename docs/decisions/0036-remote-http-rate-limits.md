# ADR 0036 — Aplicación autorizada de M6 al proyecto Rifas

Fecha: 2026-11-09. El propietario respondió «Adelantes» a la solicitud concreta
de aplicar la migración M6 al proyecto Rifas con respaldo y comprobaciones.

## Diagnóstico y alcance

La API en Vercel arrancaba, pero el contador HTTP obligatorio en producción
impedía readiness y catálogo. La inspección remota confirmó:

- Proyecto Rifas activo; el rol `sorteos_runtime` y el esquema `sorteos` existen.
- El login `postgres` puede asumir el rol de ejecución.
- `sorteos.http_rate_limits` no existía.
- El historial tenía 15 migraciones y faltaba únicamente la migración M6 de
  las 16 versionadas en el repositorio.

Se reutilizó sin cambios el SQL de
`infra/supabase/migrations/20261107194617_http_rate_limits_m6.sql`. Crea la tabla
de contadores desechables, su índice de expiración, RLS y la política del rol
de ejecución; revoca permisos a PUBLIC, anon y authenticated.

## Respaldo y aplicación

Antes de la escritura se guardó un respaldo local de estructura e historial:
`.tmp/m6/rifas-before-http-rate-limits-1794262118179.json`.

SHA-256: `609D64C3FDDF7DD0609DCA2D95570AFD1B2F0FF28702159EFA10AC7E62006123`.

Incluye columnas, restricciones, índices, políticas, ACL, funciones del esquema,
configuración del rol de ejecución e historial completo de migraciones. Es un
respaldo de metadatos; no es un dump completo de filas ni contiene registros de
compradores. Permanece fuera de Git bajo `.tmp`.

El conector oficial aplicó el SQL como `http_rate_limits_m6` y registró su
versión automática `20261109220859`. Se normalizó exclusivamente esa nueva fila
a la versión canónica `20261107194617` del archivo existente. No se renombraron
migraciones del repositorio ni se alteraron las 15 filas históricas anteriores.
La comprobación final encuentra 16 migraciones y correspondencia de M6.

## Evidencia actual

- Aplicación de la migración: correcta.
- RLS activo; SELECT/INSERT/UPDATE/DELETE concedidos a `sorteos_runtime`.
- Sin permisos de tabla para PUBLIC, anon ni authenticated.
- Política `runtime_http_limits` limitada al rol `sorteos_runtime`.
- Asesor de salud: sin avisos.
- Asesor de seguridad: mismos tres WARN preexistentes; cero avisos nuevos.
- GET público `/api/v1/health`: 200, `status: ok`.
- GET público `/api/v1/health/ready`: 200, `status: ready, database: up`.
- GET público `/api/v1/raffles`: 200, tres elementos devueltos.
- GET de catálogo con Origin `https://rifas-web-pink.vercel.app`: 200, origen
  exacto permitido por CORS y `Access-Control-Allow-Credentials: true`.

La verificación HTTP ejercita también la transacción real del contador compartido.
No se crearon órdenes, pagos ni pre-reservas para esta comprobación. Las pruebas
locales históricas no se presentan como repetidas por esta aplicación remota.

Avisos preexistentes documentados, fuera del alcance de esta migración:
[función SECURITY DEFINER accesible a anon](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable),
[accesible a authenticated](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable)
y [protección de contraseñas filtradas](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

## Recuperación y límites

Se conserva `infra/recovery/m6-down.sql` como procedimiento de recuperación
revisable. No se ejecutó rollback. Requiere detener el tráfico y autorización
específica; nunca sustituir el límite compartido por memory en producción.

La evidencia acredita salud, conexión, permisos y lectura de catálogo. Todavía
deben probarse la conexión del frontend, sesión de comprador bajo el mismo sitio,
Auth/MFA, Storage privado y el flujo de compra/revisión en el entorno autorizado.
No se declara M6/M7 completado ni se habilitan ventas o sorteos por este cambio.
