# Operación y diagnóstico — M6

Fecha: 2026-11-07. Preparación local; no autoriza publicación o ventas.

## Límites y origen

En staging/production, Nest exige `HTTP_RATE_STORE=postgres`. Aplicar primero
`20261107194617_http_rate_limits_m6.sql` con respaldo y autorización del entorno.
Desarrollo/test mantienen `memory` para poder iniciar sin DB; no representa un
límite distribuido. No cambiar el `.env` remoto para simular la comprobación.

Todas las instancias deben compartir `RATE_LIMIT`, `RATE_TTL_MS` y la misma
`CHECKOUT_ABUSE_HASH_KEY` privada. Nest conserva su guard y cabeceras HTTP; el
almacén PostgreSQL actualiza atómicamente la ventana por IP normalizada/ruta.
La persistencia contiene solo HMAC, contador y tiempos, bajo RLS. Los contadores
se saturan y se limpian en lotes de hasta 1000, tras una hora de inactividad
adicional a su vencimiento. No son historial contable.

No se confía en `X-Forwarded-For` ni `Forwarded`. Con proxy aún no definido,
varios compradores pueden compartir un presupuesto conservador. Antes de
producción hay que autenticar el proxy, definir la identidad de cliente, bloquear
acceso directo al origen y verificarlo. Cambiar a `trust proxy=true` a ciegas no
es una solución. El techo Next de login/MFA sigue por proceso y se complementa
con límites de Supabase Auth; la política distribuida del borde está pendiente.

`GET /api/v1/health` no depende del contador PostgreSQL cuando se usa el modo
compartido. Readiness y las rutas restantes fallan cerradas si ese almacén falla.
Transporte: 15 s para cabeceras, 120 s para recepción de solicitud, keep-alive
5 s, hasta 100 cabeceras y 1000 solicitudes por conexión. No son un SLA de negocio.

## Señales y respuesta

Los eventos `http_request` incluyen requestId, método, categoría fija de ruta,
estado, duración y código de error conocido. 5xx se registran como error; 429
como warning. No se registran URL, query, identificadores de orden, IP, cuerpo,
cookies, JWT, archivos o datos de comprador.

| Señal | Comprobación y respuesta |
|---|---|
| Readiness 503 | Consultar estado de PostgreSQL, TLS y migraciones desde servidor autorizado. Conservar liveness separada. No desactivar TLS ni poner secretos en logs. |
| 429 sostenidos | Revisar `Retry-After`, volumen agregado, presupuesto compartido y alertas de coste. No repetir automáticamente envíos con nuevas claves. |
| 5xx o latencia creciente | Correlacionar requestId y categoría; revisar conexiones, bloqueos, CPU y memoria del hosting. Reducir admisión antes de cambiar inventario. |
| Storage/Auth fallan | Mantener reservas y estado de pago. Reintentar la misma intención protegida; no reconstruir órdenes a partir de una imagen. |
| Disco lleno | Liberar solo cachés/builds identificados; conservar comprobantes, auditoría y dumps. La limpieza de builds no sustituye una cuota y alarma de espacio. |
| Incidente de pago | Pausar admisión según procedimiento, conservar RESERVED, conciliar manualmente y documentar la resolución. |

Para el hosting elegido, configurar un sondeo de readiness, alertas de 5xx,
429, latencia y espacio/coste; definir umbrales tras medir staging y un destinatario
real. Este documento no afirma que exista un monitor remoto ni se envían mensajes.
No realizar ataques DDoS ni carga contra producción para validar estos controles.

## Restauración ensayada

El runner local y `test:resilience` crean un cluster/DB exclusivamente local, aplican el historial
oficial, carga DEMO y ejecuta `pg_dump --format=custom`. Restaura con
`pg_restore --exit-on-error --single-transaction` en otra DB vacía. Compara
conteos y digest de todas las filas, RLS, permisos, la orden pendiente y sus
RESERVED; comprueba rechazo de duplicados y DRAWN y reejecución del historial.
La contraseña se pasa por entorno, nunca en argumentos o reportes.

`test:m6` ejecuta secuencialmente integración PostgreSQL, M4, M5 y E2E pública;
no debe confundirse con las cuatro pruebas focalizadas de `test:resilience`.

El respaldo cubre `sorteos` y `supabase_migrations`. No contiene bytes de Storage,
usuarios/factores/sesiones de Auth ni roles globales. Un desastre real requiere
restaurar y comprobar esos componentes con el proveedor y roles previamente
provisionados; la prueba local no certifica recuperación completa de Supabase.
No usar dumps de datos reales como fixtures, ni restaurar sobre producción para
ensayar. Los archivos `.tmp/m6/*.dump` son DEMO y están ignorados por Git.

Para recuperar M6, detener tráfico y usar corrección hacia adelante con datos.
`infra/recovery/m6-down.sql` solo retira contadores desechables. No es válido
volver al modo memory en un entorno desplegado. El historial sigue siendo del CLI
oficial; reparar únicamente la versión autorizada y reaplicar antes de reabrir.

## Retención y pendientes externos

Conservar contabilidad, auditoría, órdenes y archivos vinculados; no liberar
reservas por tiempo ni eliminar comprobantes ATTACHED como limpieza. La política
legal definitiva de retención/anonimización y el canal de soporte requieren
aprobación del propietario. La limpieza de fotos huérfanas y la recuperación de
objetos requieren cotejo/auditoría y ensayo con Storage real.

CAPTCHA aún no tiene proveedor ni claves: el sistema no finge una validación.
Preparar un desafío únicamente en operaciones de abuso con validación servidor,
acción/hostname, caducidad y manejo de red/reintento compatible con idempotencia.
Turnstile es un candidato, no una selección aprobada. La protección DDoS exige
configurar web y API en el borde y verificar que no puede eludirse por el origen.

Fuentes: [Nest rate limiting](https://docs.nestjs.com/security/rate-limiting),
[backup SQL PostgreSQL](https://www.postgresql.org/docs/current/backup-dump.html),
[herramientas PostgreSQL Ubuntu](https://www.postgresql.org/download/linux/ubuntu/).
