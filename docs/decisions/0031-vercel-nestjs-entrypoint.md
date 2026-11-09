# ADR 0031 — Detección del punto de entrada NestJS en Vercel

Fecha: 2026-11-09. Alcance: preparación del backend para el despliegue solicitado.

## Contexto

Vercel encuentra `apps/api/src/main.ts` pero rechaza el build con
`No entrypoint found which imports nestjs`. La creación de la aplicación se
comparte en `bootstrap.ts` para conservar la misma configuración en ejecución,
exportación OpenAPI y pruebas. La importación de `@nestjs/core` estaba únicamente
en ese módulo, fuera de los candidatos que inspecciona el detector.

El [constructor oficial de Vercel](https://github.com/vercel/vercel/blob/main/packages/nestjs/src/build.ts)
comprueba una importación directa de `@nestjs/core` en el punto de entrada.

## Decisión

Añadir `import '@nestjs/core'` a `main.ts`. Es una dependencia de ejecución ya
declarada e importada por `bootstrap.ts`; no necesita una instalación adicional.
Conservar `createApp`, sus validaciones, configuración HTTP, cierre ante errores
y diagnóstico redactado de arranque.

## Consecuencias y verificación

El punto de entrada satisface el patrón de detección del constructor sin duplicar
la inicialización de NestJS. No cambia el contrato HTTP, las variables ni los datos.
Verificar build, typecheck, lint y las pruebas existentes del backend, incluida la
prueba que ejecuta `src/main.ts` con el puerto ocupado y exige cierre con salida 1.

Verificación local ejecutada el 2026-11-09 con Node 24.22.1:

- `npm run build --workspace @sorteos/api`: correcto.
- `npm run typecheck --workspace @sorteos/api`: correcto.
- `npm run lint`: correcto.
- `npm test`: 27 pruebas aprobadas, ninguna omitida.
- `git diff --check`: correcto; el patrón de detección del constructor oficial
  también reconoce el contenido actualizado de `src/main.ts`.

El despliegue remoto, el empaquetado completo y la integración con Auth, Storage,
PostgreSQL y el frontend deben comprobarse en Vercel; no se certifican mediante
esta corrección local.
