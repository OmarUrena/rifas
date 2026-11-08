# Ajustes de negocio — Fase 1: reglas y diseño

Fecha: 2026-11-08. Alcance autorizado: etapa 1 de [PLAN_AJUSTES_NEGOCIO.md](PLAN_AJUSTES_NEGOCIO.md).

Estado: revisión de fuentes y diseño documental completados. No se implementaron funciones, migraciones ni endpoints. No se consultaron bases locales/remotas ni datos de clientes. La existencia y volumen de rifas reales siguen sin verificar; los estados históricos no sustituyen ese inventario.

## 1. Resultado de la inspección

Repositorio limpio al comenzar, rama `main`. Monorepo con NestJS, Next.js, PostgreSQL, cliente OpenAPI y `pnpm-lock.yaml`. Se conservan scripts npm de raíz y workspaces. No se necesitan dependencias nuevas en esta fase.

| Área | Archivos existentes | Hallazgo e intervención futura |
|---|---|---|
| Esquema base | `infra/supabase/migrations/20261102010448_domain_b1.sql` | `total_tickets` admite 1..1000000; `ticket_width` es generado a partir del total. Trigger crea boletos y otro impide modificar el total. No editar esta migración aplicada. |
| Migraciones posteriores | `infra/supabase/migrations/` | Catálogo B2, holds B3, órdenes B4, pagos B5, controles Auth/desarrollo, operación M5 y límites M6. Reutilizar el sistema existente y crear nuevas migraciones en etapas de implementación. |
| Alta y edición | `apps/api/src/catalog/catalog.dto.ts`, `catalog.service.ts`, `catalog.controller.ts` | Alta recibe `totalTickets`; patch bloquea su cambio y solo admite DRAFT/PAUSED. Introducir objetivo con operación acotada; no abrir el patch general a PUBLISHED/CLOSED/DRAWN. |
| Inventario y aleatoriedad | `apps/api/src/checkout/checkout.service.ts` | Usa `node:crypto.randomInt` y bloqueo de rifa. Preservar selección uniforme y límites; medir el costo con 100000 boletos. |
| Creación/consulta de orden | `apps/api/src/orders/orders.service.ts`, `orders.dto.ts`, `orders.controller.ts` | Formato usa ancho de la rifa; sesión invitada protege acceso. Futuras coincidencias deben persistir en la transacción y recuperarse en GET, no solo en la respuesta inicial. |
| Comprobantes | `apps/api/src/orders/receipt.service.ts`, `private-storage.service.ts`, `receipt.worker.ts` | Reutilizar staging y limpieza; no almacenar constancias de entrega como archivos públicos. |
| Revisión de pago | `apps/api/src/payments/payments.service.ts`, `payments.dto.ts` | Bloqueo rifa → hold → orden → reporte. PAID/CANCELLED son terminales en el servicio; no inventar devolución posterior a PAID. Integrar adjudicaciones sin cambiar esa política. |
| Indicadores/cierre | `apps/api/src/operations/operations.service.ts`, `operations.dto.ts` | Confirmado actual = suma de `orders.total_minor` con PAID, serializada como cadena decimal. Mantener definición común; no restar devoluciones de órdenes nunca incluidas en esa suma. |
| Acceso administrativo | `apps/api/src/auth/admin.guard.ts`, `financial.guard.ts`; `apps/web/src/features/admin/` | Reutilizar allowlist, roles, sesión y requisitos MFA vigentes. No añadir bypass para premios. |
| Contrato | `docs/openapi.json`, `packages/api-client/src/generated.ts`, `src/index.ts` | Fuente generada desde NestJS. Cambios futuros se hacen en DTO/controlador, luego `npm run generate:api`; no editar a mano el cliente generado. |
| Catálogo público | `apps/web/src/features/raffles/components.tsx`, `api.ts`, `types.ts` | `AvailabilityMeter` usa vendidos/total, incluso en atributos ARIA; tarjeta dice «Ver detalles». Cambiar semántica completa, no solo texto o ancho CSS. |
| Compra/confirmación | `apps/web/src/features/checkout/form.tsx`, `features/orders/form.tsx`, `confirmation.tsx`, `recovery.tsx` | Simplificar manteniendo acción única, reglas aceptadas, archivo obligatorio, recuperación y estados pendientes. |
| Administración de rifas | `apps/web/src/features/admin/raffle-editor.tsx`, `operations.tsx`, `order-actions.tsx` | Editor permite 1..1000000 y valor inicial 100. Actualizar alta y añadir edición de objetivo independiente del bloqueo general. |
| Navegación y tema | `apps/web/src/components/header.tsx`, `bottom-navigation.tsx`, `app/(public)/layout.tsx`, `public-theme-red.css` | Incorporar consulta mobile first; conservar tema reversible y aislamiento administrativo. |
| Fixtures/seed | `apps/web/src/fixtures/catalog.ts`, `infra/seeds/demo.sql`, `apps/api/src/database/seed-demo.ts` | Actualizar fixtures en la etapa correspondiente; distinguir escenarios legacy de nuevas rifas. No ejecutar seed sobre datos del propietario. |
| Pruebas | `apps/api/test/{schema,catalog,checkout,orders,payments,resilience}.integration.ts`; `apps/web/tests/` | Ampliar suites reales y harness M4/M5; no cambiar expectativas antiguas mecánicamente ni presentar DEMO como integración real. |
| Recuperación | `infra/recovery/`, `scripts/test-backend-local.ps1` | Reutilizar ensayo en PostgreSQL aislado. Rollback vacío no es recuperación segura para negocio con órdenes. |

## 2. Reglas: procedencia y vigencia

Esta sección especifica el comportamiento objetivo. El código mantiene el comportamiento anterior hasta las etapas de implementación.

| ID | Regla objetivo | Procedencia |
|---|---|---|
| AJ01 | Nuevas rifas: 100000 números internos 0..99999, presentación de cinco cifras, incluidos bendecidos y resultados | Solicitud explícita del propietario; sustituye N configurable para nuevas rifas |
| AJ02 | Cantidad elegida por comprador, asignación uniforme CSPRNG servidor, sin selección de números | RN03 preservada |
| AJ03 | Objetivo de recaudación positivo y editable en cualquier momento; progreso recalculado y sin cierre al 100% | Solicitud explícita |
| AJ04 | Progreso público genérico, sin mostrar objetivo/recaudación; independiente de disponibilidad | Solicitud explícita; nunca etiquetar como porcentaje vendido |
| AJ05 | Numerador = importes de órdenes PAID; porcentaje entero truncado y limitado al 100% en público | Criterio técnico propuesto en el plan; coincide con agregado actual para PAID |
| AJ06 | Bendecidos opcionales, manuales o aleatorios en servidor, premio asociado y felicitación persistente tras crear orden | Solicitud explícita |
| AJ07 | Configuración de bendecidos solo antes de primera publicación; un premio por número | Política propuesta del plan, no petición expresa de congelación; validar antes de implementar etapa 3 |
| AJ08 | Coincidencia pendiente hasta pago aprobado; entrega y adjudicación con estados/histórico propios | Diseño para preservar RN07–RN11 |
| AJ09 | Resultado de lotería registrado administrativamente, búsqueda de boleto y selección de premio; histórico de adjudicaciones y entregas | Solicitud explícita; operación definitiva supeditada a reglas aprobadas |
| AJ10 | Consulta por rifa + correo/teléfono después de demostrar control del canal | Solicitud explícita + RN15; OTP es mecanismo propuesto, proveedor pendiente |
| AJ11 | Menos texto, mobile first y «Comprar» como acción de rifas comprables | Solicitud explícita; no eliminar advertencias necesarias |

RN04–RN17 siguen vigentes: envío único con comprobante, no revelar números antes del commit, revisión manual, no expirar RESERVED, conciliación antes de cancelar, dinero seguro, auditoría y privacidad. El progreso no certifica pago ni autoriza sorteo. El registro preliminar de resultado no significa DRAWN.

Un objetivo puede cambiar sin modificar reglas, precio, estado o aprobación de publicación. Proponer operación OWNER, `expectedVersion`, motivo y auditoría de anterior/nuevo; idempotencia ante reintentos. Conservar las restricciones actuales para el resto del editor.

## 3. Diseño de integración por etapa

### Etapa 2: numeración y progreso

1. Elegir representación de compatibilidad explícita para rifas legacy y nuevas; no inferir que una rifa de 100000 tickets tiene aprobadas reglas nuevas solo por su total.
2. Añadir objetivo inicialmente nullable para conservar registros existentes. El objetivo de rifas vigentes debe proporcionarlo el propietario; no inventar un importe con precio × inventario.
3. Exigir objetivo válido para publicación bajo la nueva política. Antes de cambiar el frontend global de progreso, resolver rifas publicadas sin objetivo: no mostrar 0% ni reutilizar vendidos como si fuera recaudación. Fallback transitorio: omitir indicador e informar al administrador.
4. Para nuevas altas, fijar total en servidor y restricción DB compatible con legacy. Revisar validadores, OpenAPI, editor, seed y fixture. No basta un valor por defecto en HTML.
5. Agregado por rifa separado del join de tickets. Calcular `floor(100 * confirmado / objetivo)` con NUMERIC/BigInt, no multiplicación JS insegura. Exponer únicamente `progressPercent` público (nombre propuesto); mantener objetivo y numerador solo administrativos.
6. Actualización acotada de objetivo en todos los estados según solicitud, sin reabrir ventas en CLOSED/DRAWN. Auditar incluso cambios posteriores a resolución; no reescribir snapshots del resultado.
7. Actualizar semántica ARIA a «Progreso de la rifa», rango 0..100; conservar disponibilidad en validación de compra.
8. Regenerar contrato/cliente y verificar invalidación de caché después de aprobación/cambio de objetivo.

El sistema actual no cancela órdenes PAID ni soporta su devolución posterior. No introducir un ledger de devoluciones por esta fase: si se solicita en el futuro, definirlo expresamente y compartir el neto con reportes. Restar REFUNDED de una orden CANCELLED que nunca integró PAID produciría un numerador incorrecto.

### Etapa 3: bendecidos

Diseñar premios, configuración de números y adjudicaciones como entidades distintas. Claves compuestas o equivalentes deben garantizar misma rifa; índice único de adjudicación vigente por bendecido y vínculo idempotente con orden. Un premio configurado y una entrega no son el mismo registro.

Mantener bloqueos rifa → hold → orden → reporte; introducir bloqueos de premios/adjudicaciones después y en orden estable. Detección de coincidencias en transacción de creación, aprobación en revisión PAID y anulación con cancelación conciliada. Si un número vuelve a estar elegible, preservar la adjudicación anulada y permitir otra vigente; no reutilizar el historial del beneficiario anterior.

El GET protegido de orden devuelve las mismas coincidencias que la creación, con snapshot de premio, número y estado. No enviar contactos, configuración completa de bendecidos o comprobantes. Sin permiso de publicación de la lista, no exponer todos los números bendecidos en catálogo.

### Etapa 4: lotería e histórico

Resultado preliminar, adjudicación y entrega separados. Corregir con historial; no sobrescribir una adjudicación confirmada como simple edición. Para confirmación definitiva: reglas aprobadas, ventas cerradas, sin órdenes pendientes de conciliación y boleto SOLD. Número no vendido: registrar ausencia de ganador elegible sin inventar sustituto. Su resolución depende del propietario.

### Etapa 5: consulta protegida

Reutilizar validación de contacto y servicios de consulta, no autorización por código público. Diseñar sesión OTP distinta de sesión invitada, limitada a contacto verificado y rifa; paginación de órdenes. Proveedor detrás de interfaz con adaptador de prueba, sin enviar comunicaciones reales en suites. Antes de implementar, decidir retención, TTL, intentos, normalización y política para contactos históricos/reasignados; posesión actual del canal no prueba por sí sola la identidad histórica de una persona.

### Etapa 6: UX

Auditar copia por pantalla y mantener un único aviso contextual de revisión manual. Reutilizar componentes, no reducir protecciones backend. «Comprar» lleva al flujo existente; navegación no crea hold. Conservar estado no comprable y accesibilidad. Tema rojo reversible intacto.

## 4. Plan de migración y recuperación de rifas existentes

Este es un procedimiento preparado, no ejecutado. Ningún dato real ha sido clasificado.

### A. Diagnóstico previo autorizado

Obtener solo agregados sin PII por rifa: ID, estado, total/ancho, mínimo/máximo de número, conteo de tickets por estado, holds vigentes, órdenes por estado, asociaciones activas/históricas y reglas/versiones. Comprobar `count(distinct number)`, rango, ausencia de huecos y consistencia de vínculos. Guardar resultado privado sin contactos ni secretos.

Clasificar:

| Caso | Tratamiento propuesto |
|---|---|
| DRAFT, sin órdenes ni holds ni historial comprometido, total <=100000 | Conversión explícita y auditada mediante procedimiento nuevo; preferir crear nueva rifa si simplifica preservar invariantes. No borrar histórico para hacerla parecer nueva. |
| PUBLISHED/PAUSED o cualquier compromiso/historial de venta | Mantener universo hasta decisión específica; no expandir ni renumerar automáticamente. |
| Total >100000, incluso si números altos no se vendieron | Incompatible con universo nuevo. Mantener legacy y bloquear conversión automática. Nunca truncar ni aplicar módulo 100000. |
| CLOSED/DRAWN | Preservar universo e histórico; cambio del objetivo es independiente, no reabre ventas. |
| Ya tiene 100000 tickets | Comprobar integridad y reglas; no suponer conversión aprobada. |

### B. Migración aditiva

1. Backup y ensayo de restauración en DB aislada; fijar versiones API/web/migraciones y ventana operativa.
2. Nueva migración con objetivo nullable y mecanismo explícito de política legacy/nueva. No cambiar migraciones aplicadas ni retirar globalmente el trigger de inmutabilidad.
3. Rellenar objetivos solo con valores proporcionados; lotes auditados, idempotentes y verificables.
4. Conversiones aprobadas: transacción con bloqueo de rifa, volver a comprobar ausencia de compromisos/holds, aplicar cambio mediante excepción de mantenimiento estrecha y auditada, insertar únicamente números faltantes, preservar IDs existentes y verificar restricciones antes del commit. Diseñar la excepción y sus privilegios en la etapa 2; no dar al rol runtime permiso genérico para alterar totales.
5. Cinco cifras para legacy con números <=99999 sin cambiar el entero. Si hay números mayores, no pueden representarse en cinco cifras: conservar presentación histórica hasta resolver el caso. Señalar expresamente la excepción pendiente al requisito global.
6. Validar nuevo total/rango/unicidad, referencias, estados, importes y snapshots. Si falla, rollback completo; no correcciones parciales manuales.
7. Preparar constraints para nuevas rifas y transición compatible de API; probar clientes antiguos con `totalTickets` distinto de 100000 y devolver error claro, no ignorar silenciosamente el valor.

### C. Recuperación

Antes de compromisos nuevos se puede revertir únicamente lo que se pruebe sin uso, con auditoría. Después de ventas bajo el nuevo universo, no reducir inventario ni borrar registros: usar corrección hacia delante. Restauración completa solo coordinada con suspensión de escrituras y conciliación de todo lo ocurrido tras el backup; nunca sobreescribir ventas posteriores. El rollback no elimina adjudicaciones, entregas o historial contable.

## 5. Registro de decisiones pendientes

| ID | Decisión | Bloquea | Continuación independiente |
|---|---|---|---|
| D01 | Modalidad de lotería y formación de cinco cifras | Adjudicación real definitiva, etapa 4 | Modelo preliminar y pruebas DEMO |
| D02 | Resultado no vendido / múltiples resultados | Resolución real de esos casos | Búsqueda y registro sin ganador confirmado |
| D03 | Proveedores correo/teléfono, costos y configuración | OTP de producción, etapa 5 | Contrato/adaptadores de prueba |
| D04 | Lista real de rifas y autorización de conversión/objetivos | Migración de datos vigentes | Esquema aditivo y nuevas rifas en pruebas |
| D05 | Premio entregado y posterior incidencia financiera | Resolución excepcional automática | Bloquearla y auditar incidencia |
| D06 | Congelación al publicar y un premio por bendecido | Política de etapa 3 | Diseño de entidades, sin habilitar edición retroactiva |

D01–D05 ya constan en el plan general; D06 hace explícita una propuesta que no debe confundirse con instrucción literal del propietario. No hace falta resolverlas para cerrar esta fase documental. Preguntar cuando se vaya a ejecutar el trabajo dependiente, agrupando las dudas pertinentes.

## 6. Verificación de esta fase y siguiente entrega

- Inspección estática de fuentes, scripts, restricciones, fixtures y suites existentes: realizada.
- `git diff --check`: PASS, sin errores de espacios del diff.
- `node .tmp/check-business-docs.cjs`: PASS, 67 enlaces locales verificados en los nueve documentos de la entrega, cero destinos ausentes. Helper local no versionado.
- Lint/typecheck/build y suites funcionales: no ejecutados en esta fase documental; no hay cambios ejecutables. Resultados M4/M5/M6 previos siguen siendo históricos.
- Sin DB consultada/modificada, nuevas dependencias, variables, OpenAPI generado o cliente alterados.

Siguiente entrega: etapa 2 integrada con datos/API/web, nuevas migraciones y recuperación probadas en PostgreSQL aislado. Usar `npm run generate:api`, ambos lint, `npm run typecheck`, suites relevantes de catálogo/esquema/checkout/órdenes/pagos, build y pruebas de navegador. Reutilizar `scripts/test-backend-local.ps1`; no apuntar suites a datos compartidos. Alcance de cada comando y requisitos de entorno en el plan integrado.
