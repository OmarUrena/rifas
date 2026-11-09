# ADR 0035 — Exportar el handler HTTP e identificar errores de configuración

Fecha: 2026-11-09. Alcance: error `No exports found` en `dist/main.js` y diagnóstico
genérico `STARTUP_FAILED` durante el despliegue solicitado.

## Decisión

`main.ts` exporta por defecto un handler HTTP asíncrono. Cuando Vercel importa el
entrypoint (`VERCEL=1`, suministrado por la plataforma), obtiene esa función sin
abrir un puerto ni iniciar una promesa de bootstrap sin esperar. La primera
petición inicializa NestJS con `app.init()`; una promesa compartida protege la
inicialización concurrente y las peticiones posteriores reutilizan la aplicación.

El handler delega en la misma instancia Express configurada por `createApp`, con
validación, guards, CORS, filtros y logging. Si falla la inicialización, libera
la promesa para permitir recuperación, registra un diagnóstico redactado y
responde 503 con el envelope existente, `Cache-Control: no-store` y correlación.
El proceso conserva su estado para atender un reintento.

Fuera de Vercel se mantiene el arranque con `app.listen` y su cierre ante error.
`loadConfig` usa únicamente las variables de proceso en Vercel; conserva dotenv
para ejecución local. No se añaden variables que deba configurar el propietario.

`startupFailure` reconoce los mensajes fijos de validación de configuración y
registra `CONFIGURATION_INVALID` con una lista cerrada de nombres de variables.
Los valores y mensajes arbitrarios siguen excluidos de los logs. Los diagnósticos
de configuración quedan en el servidor; la respuesta HTTP no revela sus nombres.

Referencias: [runtime Node.js de Vercel](https://vercel.com/docs/functions/runtimes/node-js)
y [variable VERCEL](https://vercel.com/docs/environment-variables/system-environment-variables#vercel).

## Verificación

La regresión compilada ahora importa el entrypoint real `dist/main.js` con
`VERCEL=1` y `require(ESM)` desactivado. Comprueba:

- Exportación inmediata de una función sin alterar el código de salida del proceso.
- Configuración inválida: 503 redactado y logs con los nombres de las variables.
- Recuperación después de un bootstrap fallido y peticiones de salud concurrentes: 200.
- Readiness sin DB: 503 `DATABASE_NOT_CONFIGURED`; admin sin JWT: 401.
- Reutilización de la aplicación en invocaciones posteriores.

Las regresiones de JWT y worker JavaScript permanecen en el mismo comando
`npm run test:esm --workspace @sorteos/api`, ejecutado después del build en CI.
La prueba local del puerto ocupado fuerza `VERCEL=0` para comprobar la ejecución
local incluso si el proceso que la lanza tiene variables de la plataforma.

Verificaciones locales actuales con Node 24.22.1: build, lint y typecheck
correctos; `npm test` aprueba 27 pruebas; `npm run test:config` aprueba 10;
`npm run test:esm --workspace @sorteos/api` aprueba las tres regresiones compiladas.
No se omitieron pruebas. El contrato HTTP no introduce códigos ni esquemas nuevos:
`CONFIGURATION_INVALID` se usa exclusivamente en el diagnóstico del servidor.

## Límites

El error genérico recibido no permite identificar retrospectivamente qué variable
o fallo de arranque lo causó. El siguiente despliegue debe comprobarse por HTTP
y mediante sus logs nuevos. No se declara el backend remoto operativo por pasar
las pruebas locales ni se modifican credenciales o datos remotos.
