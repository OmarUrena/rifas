# Etapa 3 — Premios y números bendecidos

Estado: implementación en curso. Migración aplicada a Supabase remoto el 2026-11-08 con autorización explícita del propietario para las migraciones necesarias en esta sesión.

## Decisión del propietario

Un premio por número. Premios y números guardados son inmutables. El catálogo público muestra los números configurados y sus premios. La configuración se permite antes de la primera publicación y de cualquier pre-reserva.

## Implementación

- Tablas de premios, números configurados y adjudicaciones históricas; no materializan boletos.
- Registro manual o aleatorio en servidor, control de capacidad, versión e idempotencia.
- Panel `/admin/rifas/[id]/premios`, con beneficiarios privados y filtros.
- Catálogo y detalle muestran números de cinco cifras y premios, con listado público paginado.
- Confirmación de orden muestra felicitación y estado pendiente de revisión del pago.
- Aprobación confirma adjudicaciones; cancelación conciliada las anula conservando historial.
- Migración `20261108182737_blessed_prizes_stage3.sql`; recuperación restringida a configuración sin datos en `infra/recovery/stage3-down-unused.sql`.
- Compatibilidad temporal: las lecturas públicas y de órdenes omiten premios si la migración todavía no existe; los endpoints administrativos nuevos responden `PRIZES_NOT_READY`.

## Verificación actual

Corrección posterior del 404: faltaba también la política UPDATE requerida por RLS para `SELECT FOR UPDATE`; sin ella el premio existente quedaba filtrado. Aplicada `20261108183832_blessed_prize_lock_policy.sql`. Verificado con runtime que el bloqueo devuelve el premio existente (1), dentro de una transacción revertida. El trigger continúa impidiendo editar la configuración. La comprobación anterior sin filas no era suficiente para verificar visibilidad RLS.

Incidente 503 del 2026-11-08: logs PostgreSQL confirmaron `permission denied for table raffle_prizes`. El `SELECT FOR UPDATE` utilizado para controlar capacidad requiere permiso UPDATE de una columna. Corrección aplicada remotamente en `20261108183430_blessed_prize_lock_permission.sql`: únicamente `UPDATE(id)`; el trigger inmutable sigue rechazando cualquier edición. Verificado bloqueo con rol runtime dentro de una transacción revertida. Falta repetir la operación completa desde la interfaz.

Typecheck API, cliente y web: correcto. Lint API y web: correcto. Suite web existente: 51/51.

Suite administrativa existente con migración local: 25/25. Aplicación remota verificada en proyecto Rifas (`vukzxpwnfbavlwaeqkki`), versión nativa `20261108182737`: tres tablas nuevas con RLS, cero números bendecidos configurados; órdenes (3) y boletos (200) conservaron sus conteos. Asesores de seguridad sin hallazgos nuevos en estas tablas; persisten las advertencias previas de `public.rls_auto_enable` y protección de contraseñas filtradas.

Pendiente: pruebas específicas de configuración, compra ganadora, cancelación/reasignación y revisión visual móvil; compilación final, documentación de contrato y commit de cierre. La etapa no se considera terminada hasta completar estas verificaciones. El propietario autorizó cualquier migración necesaria durante esta sesión; no se autorizó despliegue.
