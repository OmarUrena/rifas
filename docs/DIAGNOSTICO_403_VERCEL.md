# Diagnóstico de 403 en Vercel — 2026-11-12

## Causa confirmada en la compra pública

Revisión del commit `92d184d` y recorrido con Chromium sobre la web desplegada.
No se crearon cupos, órdenes, pagos ni cambios administrativos en producción.

| Comprobación remota | Resultado |
|---|---|
| Portada, catálogo y consulta | 200 |
| API `/api/v1/health` y `/health/ready` | 200 |
| Web `/api/v1/bank-accounts/public` | 404, envelope del relay `NOT_FOUND` |
| Web `/api/v1/checkout-session`, origen web válido | 404, envelope del relay `NOT_FOUND` |
| Navegador al confirmar cupo | POST directo a la API, 403 `FORBIDDEN` |

El código del relay devuelve ese 404 en una ruta permitida cuando
`CHECKOUT_PROXY_ENABLED` está desactivado. El navegador también usa transporte
directo en el bundle publicado. La configuración efectiva del despliegue no
activó el proxy; publicar el código no configura las variables de Vercel.
La petición directa es cross-site y falla en la defensa de origen antes de crear
la sesión invitada. No es un requisito de login administrativo para comprar.

Referencia del rechazo observado en Chromium:
`994c6b02-1005-4f04-ab71-2c16995e6759`.
Evidencia local no versionada: `.tmp/live-403-20261112/evidence.json` y
`.tmp/live-403-20261112/purchase-error.png`.

## Configuración del propietario

En cada proyecto de Vercel: **Settings → Environment Variables**. Crear o editar
las variables en **Production**, sin comillas ni espacios añadidos.

| Proyecto | Nombre | Valor |
|---|---|---|
| Web | `CHECKOUT_PROXY_ENABLED` | `true` |
| Web | `API_BASE_URL` | `https://rifas-api-omega.vercel.app/api/v1` |
| Web | `WEB_ORIGIN` | `https://rifas-web-pink.vercel.app` |
| Web y API | `CHECKOUT_PROXY_SECRET` | La misma clave privada generada una sola vez |
| API | `CORS_ORIGINS` | `https://rifas-web-pink.vercel.app` (o incluirlo en la lista existente separada por comas) |

Para generar la clave en una terminal local:

```powershell
node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('hex'))"
```

Copiar el resultado completo de 64 caracteres a ambos proyectos. No enviar la
clave por chat, no guardarla en Git y no usar prefijos `NEXT_PUBLIC_` para ella.
No sustituir otras claves de Auth/Storage ni la configuración de PostgreSQL.

Después, **Deployments → despliegue actual → … → Redeploy**: primero API y después
web. La web necesita un build nuevo porque el modo de transporte se incorpora
al JavaScript del navegador. Editar variables o promover un build antiguo no
actualiza ese bundle. Abrir la URL de producción estable y recargar tras el build.
Para esta comprobación puede desmarcarse **Use existing Build Cache** al redesplegar
la web. Probar en el dominio estable indicado, no en una URL Preview distinta cuyo
origen no esté autorizado.
Referencia oficial:
[variables y redespliegue en Vercel](https://vercel.com/docs/environment-variables/managing-environment-variables).

Comprobación de lectura sin crear sesiones, cupos u órdenes: abrir
`https://rifas-web-pink.vercel.app/api/v1/ticket-lookup/raffles`.
Debe responder 200 con el catálogo de consulta, en lugar del 404 actual.
Esto verifica relay, firma, origen permitido y acceso de lectura de la API.

En el formulario, el POST de sesión debe ir a
`https://rifas-web-pink.vercel.app/api/v1/checkout-session`, responder 201 y
establecer la cookie invitada HttpOnly/Secure. A continuación debe obtenerse
el cupo antes de realizar una transferencia. Conservar la intención de un envío
previo si ya hubo transferencia; no borrar almacenamiento ni enviar otra orden.

Cuando existan dominios propios del mismo sitio, actualizar sus orígenes y
poner `CHECKOUT_PROXY_ENABLED=false`, reconstruyendo la web. Ver
[ADR 0037](decisions/0037-optional-checkout-proxy.md).

## Autorización administrativa: revisión separada

Las peticiones remotas sin sesión a órdenes, rifas y factores administrativos
devuelven 401 `UNAUTHORIZED`, como corresponde. Login con origen correcto y
cuerpo vacío devuelve 400 `INVALID_REQUEST`. Un origen ajeno devuelve 403
`ORIGIN_NOT_ALLOWED`. No se observó un rechazo general de origen en el login
desde la URL de producción estable.

Consulta de solo lectura al proyecto Rifas mediante el conector oficial Supabase:
existe un OWNER activo que corresponde a un usuario de Auth y tiene un factor
TOTP verificado. No se modificaron roles, sesiones, factores ni permisos. Esto
comprueba la configuración registrada; no prueba que el navegador del propietario
tenga una sesión válida ni una verificación MFA reciente.

El proxy de compra no autoriza administradores. Sus acciones siguen exigiendo
sesión real, rol y MFA vigente. Sin la sesión del propietario o una referencia
exacta del rechazo, no se atribuye un 403 administrativo a esa causa ni se declara
resuelto. No se deshabilita MFA, CSRF ni la lista de permisos para eliminar errores.

## Verificaciones locales

Se ejecutó nuevamente el recorrido integrado de administración y operación
`powershell -NoProfile -File scripts/test-backend-local.ps1 -TestScript test:stage7:browser`.
Utiliza PostgreSQL temporal, NestJS y Next.js reales, con adaptadores locales
de Auth/Storage. Resultado actual: 26 pruebas aprobadas, sin fallos ni omisiones:

- M4: 18 (login, CSRF, allowlist, MFA, revisión/conciliación, sesiones, archivos y Chromium/Firefox/WebKit).
- M5: 5 (editor, publicación, pausa/cierre, conciliación, indicadores y CSV).
- Etapa 4: 1 recorrido de resultados, adjudicación y entrega de prueba.
- Etapa 5: 1 recorrido de consulta censurada en escritorio/móvil.
- Etapa 6: 1 recorrido de compra, archivo obligatorio, confirmación y recuperación sin duplicados.

Verificaciones actuales adicionales: `npm run typecheck`, `npm run lint` y lint web
correctos; `npm test`: 28 pruebas aprobadas; pruebas web: 72 aprobadas;
`npm run test:core --workspace @sorteos/web`: 6 aprobadas.
`npm run verify:delivery`: PASS, sin secretos detectados en assets públicos ni
enlaces documentales rotos. No hubo cambios en código, esquema o contrato por
este diagnóstico; no se necesita recompilación local adicional para los documentos.
El recorrido con proxy de la corrección anterior pasó localmente; se distingue
esa evidencia histórica del estado real del despliegue observado hoy.

No se han editado variables remotas ni desplegado por esta revisión. La corrección
operativa pendiente es aplicar la configuración anterior y verificar el despliegue
nuevo, no ampliar permisos de compradores o administradores.
