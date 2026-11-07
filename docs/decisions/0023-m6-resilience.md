# ADR 0023 — M6: límites compartidos y evidencia de recuperación

Fecha: 2026-11-07. Alcance autorizado: M6, en main y sin cambios remotos.

El límite HTTP general estaba en memoria por proceso, aunque los límites del
checkout ya se compartían en PostgreSQL. Se añade almacenamiento PostgreSQL
atómico para el guard existente de Nest, con claves HMAC, TTL y limpieza acotada.
No se confía en X-Forwarded-For: el origen continúa siendo el socket hasta definir
y verificar los proxies del hosting. La clave HMAC debe ser igual entre instancias.

El modo compartido se activa mediante HTTP_RATE_STORE=postgres, obligatorio en
staging/production. Desarrollo/test mantienen memory por compatibilidad con
herramientas sin DB. La migración se aplica solo a bases de prueba locales;
la instalación remota requiere su autorización concreta. El endpoint de liveness
continúa independiente de PostgreSQL; readiness y el resto fallan cerrados si el
almacenamiento requerido no funciona. Este control no acredita protección DDoS.

Se amplía la evidencia con contención de stock (100 peticiones, dos instancias,
reintentos y percentiles), un pg_dump/pg_restore real en DB nueva y verificación
de tablas, inventario, importes, restricciones, RLS y referencias de comprobantes.
El dump SQL no respalda los bytes de Storage: esa recuperación y su proveedor
real se ensayan por separado en staging. Solo datos DEMO, sin credenciales en
argumentos o reportes.

La web debe comprobar límites/errores y conservar la intención de envío. No se
relajan MFA, allowlist, CSRF, idempotencia ni reservas. Se preparará una guía de
incidentes/observabilidad con datos no sensibles. CAPTCHA y protección en borde
requieren elegir proveedores y hosting; no se implementa verificación fingida.

## Verificación

Resultados actuales en [ESTADO_M6.md](../ESTADO_M6.md): 97/97 integración SQL,
11/11 checkout repetido con contador HTTP compartido, 4/4 resiliencia/restauración,
18/18 M4, 5/5 M5 y 80/80 E2E públicas. Lint, tipos, builds y pruebas base aprobados.
La restauración excluye Storage/Auth/roles y no se confunde con recuperación
completa del proveedor. La migración y los controles remotos siguen pendientes;
los tres avisos WARN del asesor se consultaron en solo lectura, sin remediación
remota no autorizada. El aviso moderado de minimatch es de herramientas.
