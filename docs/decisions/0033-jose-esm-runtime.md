# ADR 0033 — Carga de jose ESM desde la API CommonJS

Fecha: 2026-11-09. Alcance: error de ejecución del backend desplegado en Vercel.

## Contexto

La función desplegada falla antes de responder `/api/v1/health` porque
`admin.guard.js` ejecuta `require('jose')`. La versión fijada `jose@6.2.10` es ESM.
La configuración `module: commonjs` convierte la importación estática en
`require()`, y también transformaría una llamada `import()` en una carga CommonJS.

La ejecución local habitual usa una versión de Node que admite `require(ESM)`;
por eso el problema no aparecía en las comprobaciones anteriores. Se reprodujo
el mismo `ERR_REQUIRE_ESM` al cargar el bootstrap compilado con
`node --no-experimental-require-module`.

## Decisión

Usar `module: NodeNext` y `moduleResolution: NodeNext`. El paquete de la API
conserva su salida CommonJS y las llamadas dinámicas `import()` permanecen como
importaciones ESM nativas. Mantener la versión fijada de `jose`.

`AdminGuard` carga `jose` al verificar una solicitud administrativa con token y
configuración Auth. El resolvedor JWKS se inicializa una vez por guard y conserva
sus timeouts, caché y cliente HTTP. La comprobación criptográfica mantiene emisor,
audiencia, algoritmos ES256/RS256 y claims obligatorios. La consulta autoritativa
de usuario, allowlist y auditoría siguen siendo necesarias.

Referencias: [interoperabilidad en TypeScript](https://www.typescriptlang.org/docs/handbook/modules/reference.html#node16-node18-node20-nodenext)
y [compatibilidad de jose](https://github.com/panva/jose#supported-runtimes).

## Regresión

`npm run test:esm --workspace @sorteos/api` requiere compilar previamente la API.
Carga el bootstrap CommonJS con `require(ESM)` desactivado y comprueba HTTP real:

- Salud pública 200.
- JWT ausente, firma ajena, emisor/audiencia incorrectos o token expirado: 401.
- JWT válido y usuario vigente: alcanza el límite de acceso a PostgreSQL; el
  fixture sin DB devuelve `DATABASE_NOT_CONFIGURED`, sin conceder acceso admin.
- Usuario eliminado en Auth: 401; la consulta autoritativa se repite en cada petición.
- Caché JWKS compartida entre las solicitudes de un mismo guard.

El proveedor Auth de esta prueba es un servidor loopback con claves ES256
generadas para la prueba; no se usan cuentas ni datos remotos. El flujo CI ejecuta
esta regresión después del build de la API.

Verificaciones ejecutadas con Node 24.22.1:

- Build, typecheck y lint del backend: correctos.
- `npm test`: 27 pruebas aprobadas.
- `npm run test:config`: 10 pruebas aprobadas.
- `npm run test:esm --workspace @sorteos/api`: una regresión compilada aprobada.
- `scripts/test-backend-local.ps1 -TestScript test:catalog`: 22 pruebas aprobadas
  con PostgreSQL temporal loopback, detenido al terminar. El sandbox impedía
  iniciar PostgreSQL; la ejecución autorizada fuera del sandbox completó la suite.
- No se omitió ninguna prueba en estas ejecuciones.

## Límites

Las pruebas locales y el build no certifican el despliegue remoto. Tras subir el
commit, comprobar de nuevo salud, readiness y catálogo en la URL del usuario.
