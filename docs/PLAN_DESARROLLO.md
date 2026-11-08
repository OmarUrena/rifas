# Plan de desarrollo integrado — App Sorteos

Fecha: 2026-11-05. Modalidad acordada: una sola sesión, una carpeta principal y una secuencia de hitos que incluyen backend y frontend.

## Cómo se ejecuta

Este documento fija el orden y el alcance de trabajo. [PLAN_BACKEND.md](PLAN_BACKEND.md) y [PLAN_FRONTEND.md](PLAN_FRONTEND.md) conservan los requisitos técnicos B0–B8/F0–F8; ya no son dos agendas independientes. [CONTRATO_API.md](CONTRATO_API.md) define el comportamiento compartido y prevalece sobre ejemplos antiguos de los planes. Las reglas de [AGENTS.md](../AGENTS.md) siguen vigentes.

Cada hito entrega una función desde la base de datos y NestJS hasta Next.js. En la misma sesión se ajustan contrato, servicios, interfaz y pruebas según sus dependencias. No hace falta terminar toda la API para empezar la web ni abrir otra sesión para integrar. Los procesos web y API pueden ejecutarse simultáneamente; los cambios de contrato, generación y consumo se realizan en ese orden.

Se trabaja desde la raíz actual y exclusivamente en `main`, por instrucción explícita del propietario. No crear ramas adicionales ni worktrees; no delegar a agentes salvo solicitud explícita. El historial de las ramas anteriores se conserva en la consolidación y el trabajo local antiguo se archiva como respaldo. Conservar los cambios locales existentes y guardar los avances en commits claros sobre `main`.

## Secuencia única y punto de partida

### Ajustes de negocio autorizados — 2026-11-08

La secuencia complementaria de [PLAN_AJUSTES_NEGOCIO.md](PLAN_AJUSTES_NEGOCIO.md)
amplía las funciones existentes sin reiniciar M0–M5 ni declarar cerrado M6/M7.
El propietario solicitó comenzar solo su fase 1: reglas y diseño documental,
completada en [AJUSTES_NEGOCIO_FASE_1.md](AJUSTES_NEGOCIO_FASE_1.md).
Las etapas 2–7 siguen pendientes de ejecución. Sus entregas serán integradas
entre datos, API y web; esta fase no altera comportamiento o contratos HTTP.

### Estado de los hitos existentes

| Hito | Referencias técnicas | Entrega conjunta | Situación al unificar |
|---|---|---|---|
| M0 — Fundamentos | B0 + F0 | API y web ejecutables, errores, cliente tipado y controles de calidad | Implementación y verificaciones locales históricas registradas |
| M1 — Catálogo | B1 + B2 + F1 + F2 | Esquema íntegro, API administrable y catálogo/detalle públicos conectados | Flujo público local comprobado en la integración M4; evidencia histórica conservada |
| M2 — Cupo temporal | B3 + F3 | Cantidad, precio servidor, hold protegido y contador sin números | Flujo local comprobado en M4, sin números antes de crear orden |
| M3 — Orden con comprobante | B4 + F4 | Envío único, archivo privado, números reservados y confirmación protegida | Flujo local comprobado en M4 con adaptador privado Storage de pruebas |
| M4 — Revisión administrativa | B5 + F5 | Login real, MFA, bandeja, comprobante y conciliación desde la web | Verificado localmente; correcciones remotas aplicadas. Perfil completo de desarrollo sin TOTP autorizado, con plazo y almacenamiento privado local; una orden DEMO pendiente. Storage Supabase para staging/producción pendiente |
| M5 — Operación diaria | B6 + F6; reutiliza CRUD B2 | Editor de rifas, cierre, indicadores, CSV y consulta protegida | Verificado localmente y migración Supabase aplicada con autorización; nueve versiones sin pendientes. Ver ESTADO_M5.md para evidencia y límites de staging/Storage remoto |
| M6 — Robustez conjunta | B7 + F7 | Seguridad, concurrencia, resiliencia, accesibilidad y rendimiento medidos | En curso autorizado el 7 de noviembre; límites compartidos, carga y restauración SQL implementados localmente. Ver ESTADO_M6.md. Hosting/CAPTCHA/borde y ensayos remotos pendientes |
| M7 — Staging y salida controlada | B8 + F8 | Entorno aislado, ensayo completo, manuales y revisión de lanzamiento | Pendiente; despliegue y ventas reales requieren autorización |

No reiniciar M0–M3 ni asumir cierres solo por tener código. Los registros de [backend](ESTADO_BACKEND.md) y [frontend](ESTADO_FRONTEND.md#m4) contienen la evidencia especializada. B5 conserva su regresión histórica de 108 pruebas; la sesión M4 posterior verificó las 18 financieras/sesión actuales y el flujo integrado local de M1–M4 (14 pruebas), con Next.js/NestJS/PostgreSQL y protocolos Auth/Storage de prueba. Los resultados históricos no se presentan como pruebas repetidas y el resultado local no certifica servicios remotos.

M4 se implementó sobre B5 y comprobó las dependencias M1–M3 en esta carpeta. M5 fue solicitado el 6 de noviembre y se trabaja en esta misma línea. Permanecen pendientes la configuración/prueba del proyecto real y el ensayo autorizado en staging; no se declara preparación para ventas reales. No ampliar a otros hitos ni ejecutar cambios remotos o despliegues por haber terminado las pruebas locales.

## M0 — Fundamentos compartidos

- NestJS y Next.js en el monorepo existente, configuración tipada, validación y errores uniformes, health, estructura UI, navegación y estados de carga/error/vacío.
- OpenAPI desde NestJS y cliente generado compartido. Un único sistema de migraciones y variables documentadas sin secretos reales.
- Cierre: ambas aplicaciones compilan y arrancan; salud, cliente, navegación y controles de calidad verificados. Fixtures solo locales/demo y claramente identificados.

## M1 — Catálogo conectado

- Integridad SQL, migraciones/recuperación y seed DEMO de B1; catálogo público y CRUD autenticado de B2.
- Sistema visual, catálogo, detalle, imágenes autorizadas, reglas, cantidades y estados de F1/F2, consumiendo la API real.
- Cierre: publicar/pausar una rifa de prueba se refleja en el catálogo conforme al contrato; visitantes no acceden al CRUD ni eligen números. Mostrar por separado vendidos, reservados, pre-reservados y disponibles.
- El editor administrativo completo corresponde a M5; no marcarlo construido por existir CRUD HTTP en M1.

## M2 — Cupo temporal integrado

- Crear, consultar, cancelar y expirar holds con sesión protegida, idempotencia, límites antiacaparamiento y asignación CSPRNG transaccional en servidor.
- Selector de cantidad, total confirmado por servidor y contador absoluto, recuperación al recargar y asistencia si ya hubo transferencia al vencer.
- Cierre: dos compradores no obtienen el mismo cupo, reintentos no duplican holds, nunca se revelan números y solo expiran HELD. Ejecutar escenarios H de la matriz y controles de concurrencia relevantes.

## M3 — Orden y comprobante en una acción

- Formulario único con datos personales y correo obligatorio, transferencia y JPG/PNG/PDF obligatorio. Un POST multipart crea la orden con el reporte y convierte HELD en RESERVED.
- Validación real de archivo, Storage privado con staging/compensación y consulta por sesión protegida. Sin archivo válido no hay orden.
- Confirmación muestra números solo tras commit: «Orden y comprobante recibidos», pago pendiente. Gestionar doble clic, respuesta perdida, vencimiento y caída de Storage sin fingir éxito.
- Cierre: escenarios O de la matriz relevantes y navegador → NestJS → PostgreSQL con adaptadores externos de pruebas identificados. Nunca expirar órdenes con comprobante ni usar el código público como credencial.

## M4 — Revisión administrativa desde la web

- Reutilizar las ocho operaciones B5 existentes. Completar F5 con login Supabase Auth y sesión SSR protegida, logout, verificación de allowlist y MFA TOTP reciente según el contrato. No usar flags del navegador como autorización.
- Bandeja filtrada/paginada, detalle, historial, incidencias y visor privado mediante el proxy autenticado B5. Controlar carga, permisos revocados, errores de Auth y ausencia de sesión; no persistir comprobantes en caché pública.
- Acciones de iniciar revisión, aprobar, requerir resolución y cancelar tras conciliación. Usar `expectedVersion` e `Idempotency-Key` estable por intención; mostrar conflictos y recargar el estado antes de una nueva decisión.
- Exigir rol OWNER para aprobar/cancelar, confirmaciones bancarias, importe exacto y evidencias según modalidad de resolución. NEEDS_RESOLUTION mantiene RESERVED; solo la aprobación vuelve SOLD y solo la cancelación conciliada libera inventario.
- Cierre: crear una orden por la web y revisarla desde admin; verificar que consulta del comprador y disponibilidad reflejen cada resultado. Probar sesión ajena, MFA faltante/vencido, revocación, dos administradores concurrentes, reintento y descarga privada. Registrar qué se ejecutó con fixtures y qué falta validar con Auth/Storage reales en un entorno autorizado.
- Fuera del hito: editor completo, dashboard agregado, cierre y CSV de M5. La bandeja de revisión puede ser la entrada administrativa inicial sin inventar métricas.

## M5 — Operación y administración de rifas

- Integrar editor y acciones reales de B2; añadir B6 para resumen/dashboard, cierre y CSV auditable con autorización y minimización de datos.
- Mostrar importes confirmados separados de pendientes y métricas AVAILABLE/HELD/RESERVED/SOLD consistentes. Los campos inmutables deben explicar su bloqueo.
- Antes de implementar el cierre, documentar la política de holds activos y transferencias en curso. Mantener la prohibición actual de enviar órdenes a CLOSED/DRAWN salvo cambio explícito y compatible del contrato.
- Conservar la consulta protegida existente y la asistencia por pérdida de sesión. OTP o mensajería requieren definir proveedor y verificación; no sustituirlos por búsqueda abierta de teléfono/email ni inventar un canal de soporte.
- Documentar retención/privacidad preservando contabilidad y auditoría. No implementar sorteo o ganador; pendientes de conciliación e incidencias monetarias bloquean cualquier futura declaración de resultado.
- Cierre: editar/publicar/pausar/reanudar/cerrar mediante API, comprobar inventario e ingresos, exportar con acceso auditado y verificar consulta autorizada. No exponer cifras o botones sin respaldo real.

## M6 — Calidad, seguridad y resiliencia

- Completar la matriz QA entre comprador, admin, API y PostgreSQL: restricciones, concurrencia, idempotencia, fallos de red/DB/Storage, permisos, privacidad y restauración.
- Medir carga y percentiles, revisar accesibilidad/teclado/contraste, móvil y navegadores, SEO y rendimiento sin cachear disponibilidad crítica ni datos privados.
- Preparar límites compartidos, CAPTCHA según proveedor, protección DDoS en borde/origen, alertas y observabilidad sin PII. Las pruebas de inventario no acreditan resistencia DDoS.
- Cierre: evidencia de escenarios, restauración ensayada y riesgos pendientes explícitos; no convertir pruebas omitidas o falta de dispositivos/revisión humana en PASS.

## M7 — Ensayo operativo y publicación controlada

- Preparar configuración separada, pipeline, manuales, backup/recuperación, soporte, conciliación y checklist de publicación; solicitar autorización para el despliegue concreto cuando esté preparado para revisión.
- Ejecutar en staging autorizado la compra y revisión completas con datos de prueba y Auth/Storage reales. Los fixtures locales no sustituyen ese ensayo.
- Cierre: configuración y resultados revisables, requisitos legales/bancarios aprobados y autorización explícita antes de publicar o activar ventas. No habilitar sorteo real sin reglas y requisitos aprobados.

## Ciclo de una sesión

1. Leer este plan, contrato, reglas, estado de ambas capas y QA; revisar git status, dependencias y cambios locales.
2. Definir una entrega del hito activo con sus endpoints, tablas, pantallas y criterios verificables. Reutilizar las partes ya implementadas.
3. Implementar de forma conjunta: SQL/API cuando haga falta, OpenAPI/cliente si cambió contrato, UI conectada, errores y controles de acceso. No mantener implementaciones incompatibles para unirlas después.
4. Ejecutar controles de ambas capas y la integración afectada. Corregir fallos antes de ampliar alcance. Si falta infraestructura externa, avanzar las partes independientes y registrar la limitación.
5. Actualizar contrato/variables si cambiaron, ADR, changelog y evidencia en ambos estados; actualizar la situación del hito en este plan. Cerrar con resultados reales y siguiente hito.

Una sesión puede continuar con varias tareas del mismo hito. El cambio de hito sigue el alcance autorizado por el usuario; «trabajar ambas capas» no autoriza fases futuras, cambios remotos ni despliegues.

## Verificación reproducible

Los scripts actuales se conservan. Desde la raíz, iniciar `npm run dev:api` y `npm run dev:web` en terminales independientes para trabajar ambas aplicaciones en la misma sesión. Ver configuración en [README](../README.md).

Controles base de código por hito (no ejecutados por esta actualización documental):

```powershell
npm run lint
npm run lint --workspace @sorteos/web
npm run typecheck
npm run test:config
npm test
npm run test:core --workspace @sorteos/web
npm run test --workspace @sorteos/web
npm run build
```

Si cambia la API, ejecutar `npm run generate:api` antes de typecheck/build y revisar el diff del contrato generado. Para inventario/pagos, ejecutar PostgreSQL aislado con `powershell -NoProfile -File scripts/test-backend-local.ps1 -PasswordAuthentication`; no acreditar integración DB por `npm test`, que ejecuta solo la suite base de backend. `npm run lint` tampoco incluye la web: se requieren ambos comandos de lint.

Pruebas de navegador: `npm run test:e2e --workspace @sorteos/web`. Para M1/M2/M3 existen además `test:live`, `test:checkout:live` y `test:orders:live` en la web; requieren PostgreSQL local de pruebas en `TEST_DATABASE_URL`, API/fixtures y puertos según sus harnesses. No ejecutarlos sobre datos de desarrollo compartidos o un entorno remoto. M4–M5 deben añadir la evidencia integrada de sus nuevos flujos al implementarse.

## Criterio de cierre común

Cada hito necesita código funcional de ambas capas, lint/typecheck/build y pruebas relevantes, estados UI accesibles/responsive, contrato/cliente coherentes y documentación vigente. Cambios de datos requieren migración nueva, seed DEMO y recuperación; no editar migraciones ya aplicadas. Reportar por criterio PASS/FAIL/SKIPPED con comando/evidencia y entorno. Una implementación incorporada, una prueba histórica y una validación real en staging son estados distintos.

El MVP funcional corresponde a M4 con flujo conjunto verificado; la preparación para operar requiere M5–M7. Este plan no declara logrado ninguno de esos cierres por sí mismo.
