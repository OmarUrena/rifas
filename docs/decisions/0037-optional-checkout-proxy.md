# ADR 0037 — Proxy opcional de invitado para dominios separados de Vercel

Fecha: 2026-11-11. Estado: implementado localmente, sin despliegue autorizado.

## Problema y alcance

El propietario reportó un 403 al comprar en `rifas-web-pink.vercel.app` con
API en `rifas-api-omega.vercel.app`. La comprobación HTTP remota confirmó catálogo
200 y CORS exacto, pero checkout-session con Fetch Metadata cross-site devuelve
403 sin cookie. La compra necesita sesión SameSite=Lax y validación CSRF.
El propietario autorizó adaptar el transporte y pidió una variable para poder
retirarlo cuando compre un dominio propio.

Se amplía la decisión F003: transporte directo predeterminado, relay opcional
para los dominios actuales. No se modifica inventario, estados ni acceso admin.

## Decisiones

- `CHECKOUT_PROXY_ENABLED=true` en web habilita un Route Handler `/api/v1/[...path]`
  y hace que los clientes OpenAPI de checkout, órdenes y consulta por teléfono
  usen el origen del navegador. SSR y catálogo conservan acceso directo a la API.
  El booleano se incorpora durante el build; cambiarlo exige reconstrucción.
- `false` desactiva el relay y restaura transporte directo. No es una excepción
  a CSRF: requiere web y API bajo el mismo sitio. `API_BASE_URL` siempre apunta
  a NestJS, nunca al propio proxy.
- `WEB_ORIGIN` exacto es obligatorio con relay. Se comprueban Host público,
  Origin y Fetch Metadata antes de reenviar. Next puede representar internamente
  la URL con localhost; no se confía en esa representación como dominio externo.
- Solo se permiten sesión, alta/consulta/cancelación de holds, alta/consulta de
  órdenes, cuentas públicas y consulta censurada. No es un proxy arbitrario;
  excluye administración, medios y descarga de comprobantes.
- Solo se reenvía cookie invitada, Content-Type e Idempotency-Key del cliente.
  No se reenvían Authorization, cookies admin ni cabeceras de identidad aportadas
  por el comprador. Multipart conserva sus bytes y boundary. Set-Cookie de sesión,
  estado, envelope y requestId se preservan; todas las respuestas son no-store.
- Una clave privada independiente `CHECKOUT_PROXY_SECRET` (32 bytes aleatorios
  representados en 64 caracteres hexadecimales) se configura igual en web y API.
  La web deriva una identidad seudónima de la IP y firma método, ruta/query,
  origen, timestamp e identidad con HMAC-SHA256. La API verifica en tiempo constante
  y rechaza firmas ausentes/parciales, inválidas o con más de 60 s de desfase.
  Una petición sin cabeceras de relay conserva el transporte directo existente.
  La firma solo autentica identidad para cuotas; no autoriza órdenes ni sustituye
  cookie, DTO, idempotencia o controles de negocio.
- Nest usa esa identidad verificada tanto en throttling HTTP como en cuotas
  persistentes de sesión/holds/consulta. `trust proxy` sigue desactivado y una
  cabecera X-Forwarded-For enviada a la API no altera esa identidad.
- En Vercel la fuente es `x-vercel-forwarded-for`, validada como una IP única;
  ausencia/valor ambiguo falla cerrado. Fuera de Vercel solo se ofrece desarrollo
  o test loopback con IP local fija. Otros proveedores requieren diseñar su fuente
  confiable de identidad antes de usar este relay en producción. Referencia:
  [cabeceras de Vercel](https://vercel.com/docs/headers/request-headers).
- No se registran IP, cabeceras, cuerpos, secretos o PII. La clave no se incorpora
  a variables públicas y se incluye en la redacción del logger.
- En Vercel el máximo del archivo en web se acota a 4 MiB para dejar espacio
  al multipart bajo el límite de 4.5 MB de Functions; el cuerpo se lee con límite
  incluso sin Content-Length. No se hacen reintentos automáticos ni operaciones
  externas dentro de transacciones. Referencia:
  [límite de payload](https://vercel.com/kb/guide/how-to-bypass-vercel-body-size-limit-serverless-functions).

## Contrato y datos

No cambian endpoints ni esquemas públicos de NestJS: regenerar OpenAPI/cliente
no produce diferencias. No hay migración, seed ni rollback de datos. Para revertir
el código se conserva el commit; para retirar el relay basta desactivar el flag
y reconstruir, con los dominios correctamente configurados.

Cambiar transporte/dominio cambia el ámbito de la cookie. Coordinar sin envíos
en curso y conservar asistencia para órdenes anteriores; no prometer que una
cookie del dominio antiguo se transfiere al nuevo. No borrar intención local ni
crear una orden nueva para recuperar una transferencia.

## Validación y límites

Pruebas de relay cubren flag, orígenes, cookie, secreto ausente del cliente,
multipart, claves de reintento, errores, límites de cuerpo y separación de clientes.
Prueba HTTP con NestJS real verifica cookie, firma alterada/caducada, CSRF y cuotas
por cliente, con servicio de sesión sustituido y sin escrituras de negocio.
El recorrido `test:checkout:proxy` reutiliza el fixture PostgreSQL temporal y
Next/Nest reales de etapa 6; Auth/Storage son adaptadores locales de prueba.

Los resultados actuales y cualquier limitación de verificación se registran
al cerrar esta corrección. No se ha configurado Vercel ni ejecutado una compra
remota. La prueba local no acredita disponibilidad de Storage remoto ni ventas
reales. No se declara M6/M7 completado.
