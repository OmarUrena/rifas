# Etapa 7 — Regresión y entrega

Estado: regresión y entrega local completadas en main. Los resultados se componen de bloques aprobados, con incidencias y repeticiones documentadas. La etapa 7 de ajustes no equivale a M7 de publicación ni autoriza despliegues o ventas reales.

## Alcance vigente

Rango lógico 00000–99999 sin precarga, objetivo privado y progreso PAID, bendecidos y premios inmutables, Pick 4 + FIREBALL al final registrado en un solo campo, entregas auditadas, consulta pública censurada por teléfono con estado por orden y compra simplificada. No hay OTP por decisión expresa del propietario.

## Método reproducible

Desde la raíz, ejecutar `npm run test:stage7:checks`: generación, comparación del contrato, lint de API/web, tipos, configuración, pruebas base, core/web, build y verificación de artefactos. Se detiene ante un fallo.

Ejecutar los bloques de verificaciones **en serie**, sin otros clústeres de carga o navegadores simultáneos en el mismo equipo. El ensayo de contención H03 conserva timeouts de producción; saturar el equipo con otros arneses no constituye un ensayo aislado de esa prueba.

La regresión de datos y navegador se ejecuta exclusivamente en bases locales desechables:

```powershell
powershell -NoProfile -File scripts/test-backend-local.ps1 -PgBin 'C:/Program Files/PostgreSQL/17/bin' -Port 54348 -TestScript test:adjustments -PasswordAuthentication
```

`test:adjustments` ejecuta la suite completa PostgreSQL y, después, M4, M5, lotería/entregas, consulta y compra simplificada. Se detiene ante un fallo; lo no ejecutado queda pendiente. Requiere los navegadores correspondientes a la versión instalada de Playwright. La preparación usa adaptadores locales de Auth/Storage, no credenciales ni entregas reales.

Las pruebas base se ejecutan en serie entre archivos para evitar que compiladores ts-node simultáneos compitan con la comprobación de arranque. El hijo que prueba EADDRINUSE transpila sin repetir el typecheck de todo el proyecto; typecheck sigue siendo un control obligatorio separado. Se conservan sus aserciones y sus plazos. Decisiones en [ADR 0030](decisions/0030-regression-delivery.md).

Después de los recorridos integrados, ejecutar `npm run test:e2e --workspace @sorteos/web` para catálogo/detalle/DEMO en Chromium móvil/tablet/escritorio, Firefox y WebKit. No sustituir navegadores silenciosamente.

`npm run verify:delivery` verifica enlaces documentales de la entrega, nombres/versiones locales de migraciones, ausencia de archivos .env privados versionados y coincidencias de valores privados configurados en JS/JSON/map públicos compilados. Solo informa conteos y rutas, nunca valores. No certifica ausencia absoluta de secretos ni servicios externos.

## Evidencia actual

La suite completa PostgreSQL pasó 108 pruebas, sin omisiones. Incluye los tres casos nuevos de etapa 7, recuperación B2–B5 y restauración SQL. M4 pasó 18 pruebas de navegador con login, MFA, autorización, compra, conciliación, errores de red y Firefox/WebKit.

H03: 100 solicitudes entre dos instancias, 20 aceptadas, 80 rechazadas por stock, cero errores inesperados y cero holds/boletos duplicados; los 20 reintentos recuperaron su hold. Duración local 1109 ms; p95 1060 ms. No es un SLA de hosting. S06 restauró 26 tablas con RLS, restricciones e histórico/orden pendiente preservados; los objetos Storage no forman parte de pg_dump.

Incidencias encontradas y corregidas durante esta sesión:

- El watcher observaba estados intermedios de archivos al escribir .env; se añadió estabilidad de huella y una prueba que fuerza ese vacío temporal.
- La prueba de puerto ocupado repetía typecheck dentro del proceso hijo; ahora verifica el arranque sin duplicarlo. El control separado de tipos sigue obligatorio.
- Recuperación B5/S06 seguía esperando 25 tablas y 15 migraciones; ahora comprueba las 26 tablas y 16 migraciones actuales, además de la ausencia de SELECT público sobre límites de consulta.
- El recorrido histórico M5 buscaba «Participar» y «Pago confirmado.»; se alinea con los textos de etapa 6. El enlace Comprar se limita a la sección de participación y Cantidad al campo numérico, distinguiéndolos de los contenedores/accesos móviles con el mismo nombre.
- El regreso por teclado desde catálogo espera explícitamente la navegación, como ya hacía el trayecto de ida.
- El recorrido de lotería normaliza `datetime-local` cuando los segundos son `00`; conserva segundos en los demás casos y la comprobación de entrega posterior a adjudicación. Evita el rechazo intermitente del formato por el navegador.

Las primeras ejecuciones mezclaron carga, compilación y navegadores y tuvieron fallos de plazos/contención. No se cuentan como aprobadas. Se repiten los bloques en serie, conservando timeouts y aserciones de negocio. Las ejecuciones fallidas de M5 se detuvieron antes de los pasos dependientes; no se consideran cobertura de las etapas 4–6.

La auditoría `pnpm audit --prod --json` reportó cero vulnerabilidades en 251 dependencias productivas.

| Comando o bloque | Resultado actual |
|---|---|
| `npm run test:stage7:checks` | PASS: contrato sin diferencias; lint API/web y tipos; configuración 10/10, API base 27/27, core web 6/6, web 65/65; build de todos los workspaces |
| `test:integration` mediante clúster local | PASS: 108/108, sin omitidas |
| `test:m4` mediante clúster local | PASS: 18/18, sin omitidas |
| `test:stage7:flows` mediante clúster local | PASS: M5 5/5; etapas 4, 5 y 6, 1/1 cada una; sin omitidas |
| `npm run test:e2e --workspace @sorteos/web` | Chromium móvil/tablet/escritorio y WebKit: 68/68 aprobadas; Firefox falló al abrir página dentro del sandbox. Repetición Firefox fuera del sandbox, un worker: 17/17 PASS, salida cero. Los 85 escenarios tienen una pasada aprobada por perfil; no se afirma una única ejecución verde de los 85 |
| `npm run verify:delivery` tras build | PASS: 28 assets públicos, tres valores privados comprobados sin coincidencias; cero .env privados versionados; enlaces documentales válidos; 16 versiones de migración únicas |

El bloque completo inicial `test:adjustments` pasó SQL y M4, pero falló en el selector antiguo de M5. Tras las correcciones, `test:stage7:flows` pasó completo (M5 y etapas 4–6); no se presenta la ejecución inicial como verde. El resultado actual se compone de bloques aprobados en serie, no de una única ejecución verde del comando agregado.

La ejecución E2E del sandbox reportó 68 aprobadas y 17 fallos `browserContext.newPage: Target crashed`, todos en Firefox. Tras completar los 85 casos quedó atascada en limpieza; se cerró únicamente su árbol de procesos identificado. Firefox se repitió fuera del sandbox con `PLAYWRIGHT_PORT=3103 npm run test:e2e --workspace @sorteos/web -- --project=firefox-desktop --workers=1`: 17/17, salida cero y limpieza normal. No se cambiaron aserciones ni se sustituyó Firefox por Chromium. El entorno y la concurrencia difieren; no se atribuye una causa única al cierre del navegador.

Se revisaron visualmente las capturas móviles actuales de consulta y confirmación, con datos DEMO: nombre/correo censurados y estado por orden; confirmación pendiente sin afirmar pago recibido. Resumen portable en [QA de etapa 7](qa/AJUSTES_ETAPA_7.json).

## Matriz de cobertura

| Criterios | Evidencia ejecutable |
|---|---|
| Extremos 00000/99999, entradas inválidas, unicidad, configuración sin precarga | `schema.integration.ts`, `catalog.integration.ts`, nuevo caso etapa 7 de bendecidos |
| CSPRNG servidor, ausencia de números HELD, concurrencia e idempotencia | `checkout.integration.ts`, H03, `orders.integration.ts` |
| Objetivo privado, PAID, agregación, cambio auditado y compra al 100% | `catalog.integration.ts` y `payments.integration.ts` |
| Bendecidos sin/con coincidencias, capacidad, congelación, reintento y entrega | `payments.integration.ts`, recorridos M4/etapa 4, pruebas unitarias web |
| Cancelación, liberación y reasignación conservan histórico | Nuevo caso etapa 7 de cancelación/reasignación |
| Lotería sin ganador inventado, conciliación previa, elegibilidad congelada y premio agotado | Casos etapa 4 y nuevo caso etapa 7 de lotería en `payments.integration.ts` |
| Consulta censurada, estados separados, sin códigos/números, límites durables y aislamiento | Caso etapa 5 de `payments.integration.ts`, recorrido etapa 5 y pruebas web |
| Comprar según fechas/stock, comprobante obligatorio, recuperación y confirmación | Casos etapa 6 de `payments.integration.ts`, recorrido etapa 6, `orders.integration.ts` |
| Teclado, 360 px, accesibilidad automatizada y cinco perfiles de navegador | `apps/web/tests/e2e`, axe en recorridos integrados |
| RLS, ledger inmutable, restauración y recuperación | `schema.integration.ts`, `payments.integration.ts`, S06 en `resilience.integration.ts` |
| Contrato/cliente, build, variables y documentación | `test:stage7:checks`, `verify:delivery` |

La matriz identifica pruebas; no convierte verificaciones pendientes en aprobadas ni sustituye una auditoría manual de accesibilidad completa.

## Datos y entrega revisable

No hay migraciones, variables ni cambios de contrato nuevos en etapa 7; se conserva OpenAPI/cliente 0.12.0. Se reutilizan las 16 migraciones locales, `infra/seeds/demo.sql` y los procedimientos de recuperación de etapas anteriores. Los ensayos B2–B5 y S06 verifican reaplicación/restauración sobre bases desechables, sin retirar datos remotos. Los escenarios adicionales usan exclusivamente registros DEMO y correos `.invalid`.

Los scripts `test:adjustments`, `test:stage7:browser`, `test:stage7:flows` y `test:adjustments:edge` permiten repetir la entrega completa o los bloques corregidos. CI queda preparado para los recorridos y el control de artefactos; no se ejecutó CI remoto ni se publicó esta sesión. Las capturas actuales se generan en `.tmp`, preservando los PNG históricos de documentación.

Siguiente paso: resolver los pendientes externos M6/M7 y preparar un ensayo de staging autorizado con hosting, borde, Auth/Storage reales y migración M6 revisada. No habilitar ventas por el solo cierre de esta regresión local.

## Límites operativos que no desaparecen con pruebas locales

- Sin despliegue ni habilitación de ventas por esta etapa.
- Hosting, CAPTCHA/protección de borde, identidad de proxy, alarmas y ensayo completo autorizado en staging siguen abiertos en M6/M7.
- La migración M6 de límite HTTP compartido sigue pendiente en la base remota; no se aplica bajo la autorización anterior, que fue específica para etapa 5.
- Las pruebas con protocolos locales Auth/Storage no certifican el proveedor real, MFA personal ni recuperación integral de objetos/roles del proveedor.
- No convertir universos legacy ni resolver automáticamente incidencias financieras de premios entregados; requieren decisiones específicas.

## Auditoría externa de solo lectura

El historial remoto de Rifas conserva 15 migraciones y la etapa 5 aplicada; las 16 locales incluyen además M6 pendiente. No se modificó el proyecto remoto en esta etapa. Persisten los avisos anteriores de ejecución de `public.rls_auto_enable` para [anon](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable) y [authenticated](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), y [protección de contraseñas filtradas](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) desactivada. No aparecen avisos nuevos en las tablas de los ajustes.

La auditoría completa de dependencias mantiene un aviso moderado de [minimatch](https://github.com/isaacs/minimatch/security/advisories/GHSA-g3hv-75wg-m249) en la cadena de lint/typescript-eslint. La auditoría productiva reporta cero. No se impone una actualización mayor transitiva fuera del alcance de esta entrega.
