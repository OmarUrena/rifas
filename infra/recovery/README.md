# Recuperación B1/B2

Etapa 2: `stage2-down-unused.sql` solo admite retirada sin uso FIVE_DIGIT,
objetivo o historial de cambios. Con uso real, recuperación hacia delante;
no reducir inventario ni borrar boletos. Coordinar versión API/web y respaldo.
Ver [procedimiento](../../docs/AJUSTES_NEGOCIO_FASE_2.md).

La recuperación se ensaya únicamente sobre las DB desechables de
`apps/api/test/schema.integration.ts`. No hay autorización para rollback, DROP,
reset ni restauración sobre bases de producción.

## Instalación sin datos

`b1-down-empty.sql` examina todas las tablas del esquema y se niega a continuar
si encuentra cualquier fila, incluidas las del seed o la auditoría. Solo entonces
elimina `sorteos`. Se debe ejecutar en una transacción; con psql usar `-1` y
`-v ON_ERROR_STOP=1`. No ejecutar el archivo contra otra base por cambiar la URL.

El down no borra el ledger `supabase_migrations.schema_migrations`. Tras una
recuperación autorizada y exitosa, consultar `supabase migration repair --help`
y marcar como revertida esa versión usando el mismo CLI y la misma DB. Esto
mantiene un único historial de migraciones. No editar ese ledger a mano ni volver
a aplicar SQL por fuera del migrador oficial.

## Instalación con datos

1. Detener escrituras y preservar el estado: no eliminar órdenes ni auditoría.
2. Tomar un backup con el procedimiento aprobado del entorno y verificar que se
   puede restaurar en otra DB aislada. B1 no implementa ni certifica backup productivo.
3. Corregir con una nueva migración forward-only en el mismo directorio/historial,
   después de revisar el impacto sobre pagos, boletos e idempotencia.
4. Verificar integridad y conciliación antes de reabrir escrituras. Nunca liberar
   RESERVED por antigüedad ni rechazar un comprobante para borrar una orden.

La suite incluye prueba positiva de down en un esquema vacío y prueba negativa
con el seed presente. Ambas pasaron en PostgreSQL 17.5 aislado. Esto verifica
el rollback protegido de B1; no constituye una restauración de backup productivo.

## Recuperación selectiva B2

`b2-down-empty.sql` conserva las tablas B1 y retira columnas, triggers, políticas
y privilegios añadidos por B2. Solo admite una DB completamente vacía y debe
ejecutarse en transacción. No se elimina `sorteos_runtime`: es un rol global del
cluster que podría estar compartido con otras DB. Sin USAGE en este esquema ni
políticas de acceso queda sin autoridad sobre los datos de B1.

La suite B2 prueba el down vacío, el rechazo con datos, la reparación de la
versión mediante `supabase migration repair --status reverted` del mismo CLI
y la reaplicación con `db push`. No se escribe directamente en el ledger ni se
introduce un segundo sistema de migraciones. Con datos reales usar forward-only.

## Recuperación selectiva B3

`b3-down-empty.sql` exige ausencia total de datos, retira la tabla de contadores,
índices/columna de abuso, trigger B3 y sus permisos/políticas; restaura B2.
Ejecutar en transacción y reparar exclusivamente la versión
20261104022108 con el CLI oficial antes de reaplicar. Para revertir B2, primero
revertir B3 y reparar ambas versiones en orden inverso. La suite B3 verifica
rechazo con seed, down vacío, permisos B2, reparación oficial y reaplicación.
Con datos de negocio/ledger se exige migración correctiva, no down.

## Recuperación selectiva B4

`b4-down-empty.sql` se ejecuta en transacción solo con todas las tablas vacías:
retira staging, constraint de correo nuevo, trigger de comprobante adjunto y
permisos de escrituras de orden, conservando B3. Reparar la versión
20261104030210 con CLI oficial antes de reaplicar. Para una fase anterior,
revertir B4 primero. Las suites prueban bloqueo con datos, down vacío, permisos
anteriores y reaplicación. No borrar comprobantes ATTACHED ni histórico para
forzar este procedimiento; con datos, migración correctiva y backup ensayado.

## Recuperación selectiva B5

Las extensiones de desarrollo `development_admin_access` y `development_demo_checkout` se retiran también en el down B5 exclusivamente vacío; el runner repara sus versiones antes de `admin_auth_session_checks` y B5, de más reciente a más antigua. Concesiones/auditoría existentes bloquean el down. En el proyecto remoto, terminar la prueba venciendo la concesión o retirando configuración; conservar órdenes, archivos e histórico. Para retirar funciones, utilizar migración correctiva revisada. No restaurar un dump ni borrar filas para terminar la prueba.

La corrección `admin_auth_session_checks` de 2026-11-06 se retira junto con B5 únicamente en la recuperación local vacía: el script elimina también el helper privado y el runner repara primero esa versión y luego B5 mediante el CLI. Reaplicar incorpora ambas en orden. Con datos o en Supabase alojado se exige migración correctiva hacia adelante; la ruta anterior de acceso directo a Auth no es operativa en ese entorno. No usar el down para resolver el login del propietario.

`b5-down-empty.sql` requiere todas las tablas de `sorteos` vacías y ejecución
en una transacción. Retira `admin_actions`, triggers financieros y permisos B5,
restaurando B4. Preserva las tablas y filas de Auth; elimina exclusivamente las
políticas `sorteos_b5_session_read` y `sorteos_b5_factor_read` y los permisos
específicos concedidos al rol dedicado `sorteos_runtime` por B5.

Reparar la versión `20261104035954` con el CLI oficial antes de reaplicar.
Para recuperar fases anteriores, revertir en orden B5 → B4 → B3 → B2.
Las pruebas comprueban la conservación de factores Auth y la reaplicación.
No vaciar órdenes, auditoría o ledger para habilitar el down; con datos usar
una migración correctiva. Este procedimiento no autoriza operaciones remotas.
## M5

Aplicar `m5-down-empty.sql` solo en instalación vacía y dentro de transacción antes de recuperar B5. Reparar la versión M5 mediante CLI oficial después del COMMIT. Con datos se rechaza: conservar respaldo e implementar corrección hacia adelante. Nunca borrar órdenes o auditoría para pasar la comprobación. El cierre no se revierte ni se liberan reservas como operación de recuperación.
# Recuperación M6

`m6-down.sql` retira solo la tabla de contadores HTTP desechables. No elimina
órdenes, pagos, auditoría, archivos ni Auth. Detener tráfico, conservar respaldo y
reparar únicamente `20261107194617` con el CLI oficial del entorno autorizado.
No usar memory en staging/production como sustitución del contador compartido.
Con datos reales, preferir corrección hacia adelante. La regresión aplica y
retira M6 en bases vacías junto con la recuperación protegida de B5.

El ensayo S06 usa pg_dump custom y pg_restore transaccional sobre una DB nueva
DEMO. Compara datos, RLS, permisos, constraints y la orden pendiente. No incluye
objetos de Storage, Auth ni roles globales; ver [operación M6](../../docs/OPERACION_SEGURA_M6.md).
