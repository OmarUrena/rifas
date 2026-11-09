# ADR 0034 — Empaquetar la salida compilada de la API en Vercel

Fecha: 2026-11-09. Alcance: persistencia de ERR_REQUIRE_ESM tras ADR 0033.

## Evidencia

El propietario confirmó que el despliegue usa `435f892` y compartió la pantalla
de Vercel: preset NestJS, Build Command sin override y Output Directory sin override.
El log remoto sigue señalando `/var/task/apps/api/src/auth/admin.guard.js`.
El build local, en cambio, conserva `await import('jose')` y pasa la regresión de
arranque/JWT con `require(ESM)` desactivado. El artefacto empaquetado desde `src`
no queda cubierto por esa prueba local; no atribuimos el fallo a un commit antiguo.

## Decisión

Versionar `apps/api/vercel.json` con:

- Preset `nestjs`.
- `pnpm install --frozen-lockfile --prod=false` para disponer de TypeScript durante
  el build incluso con `NODE_ENV=production`.
- Build Command `pnpm run build`, que utiliza `tsconfig.build.json` y NodeNext.
- Output Directory `dist`, de modo que el constructor busque y use `dist/main.js`.
- Referencia estática de `dist/orders/receipt.worker.js` mediante `require.resolve`
  en `ReceiptService`, para que el trazado incluya el worker y sus dependencias.

Corrección del mismo día tras el primer reintento remoto: se elimina la sección
`functions` inicialmente añadida con `dist/main.js`. Vercel la rechazó con
`unused_function` al validar ese patrón como función de un directorio `api`, antes
del empaquetado de NestJS. La función única la genera el preset NestJS; su
configuración conserva build y Output Directory. La referencia estática del
worker sustituye el `includeFiles` incompatible con esa validación.

El constructor oficial de NestJS en Vercel ejecuta el build antes de seleccionar
el punto de entrada y, al configurar Output Directory, lo busca dentro de ese
directorio. El código del paquete conserva la importación de `@nestjs/core` que
permite reconocer el punto de entrada CommonJS generado.

Referencias: [configuración versionada de Vercel](https://vercel.com/docs/project-configuration/vercel-json)
y [selección de entrada del constructor](https://github.com/vercel/vercel/blob/main/packages/build-utils/src/generate-node-builder-functions.ts).

## Verificación y límites

La regresión `test:esm` usa el JavaScript de `dist` y ahora también valida un PDF
mediante el worker compilado. Se mantienen las comprobaciones de firma, emisor,
audiencia, expiración, consulta autoritativa y caché JWKS.

Verificación local actual con Node 24.22.1: build, lint y typecheck correctos;
`test:esm` aprueba sus dos pruebas sin omisiones. La salida configurada contiene
`main.js` reconocible por el patrón de NestJS y el worker incluido. `git diff
--check` también pasa. Las suites generales y de PostgreSQL del ADR 0033 son
evidencia de la revisión anterior; no se presentan como repetidas en esta revisión.

El Root Directory del proyecto sigue siendo `apps/api`. La configuración de
archivo prevalece sobre los valores de build/output/install del panel. El primer
reintento debe usar el nuevo commit y omitir la caché de build anterior.

Verificación de la corrección `unused_function`: build, lint, typecheck y las dos
regresiones compiladas pasan. Se repitió `npm test`: 27 pruebas aprobadas, ninguna
omitida. El trazador `@vercel/nft` disponible con Next en
este workspace encuentra el worker JavaScript y los módulos de `pdf-lib` y `jose`
desde `dist/main.js`, sin la sección `functions`. Esta comprobación local del
trazado no equivale a ejecutar el empaquetador remoto de Vercel.

No cambian el contrato HTTP, las variables ni las reglas de autorización. Las
pruebas locales no certifican el paquete final de Vercel: comprobar después salud,
readiness y catálogo, y distinguir los logs nuevos de los del artefacto de `src`.
