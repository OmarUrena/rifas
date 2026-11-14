# ADR 0038 — Contenedor privado de comprobantes

Fecha: 2026-11-14. Alcance: configuración operativa de Storage para M3 existente.

## Diagnóstico

La captura del comprador muestra el texto asociado a `STORAGE_UNAVAILABLE`.
`PrivateStorageService.upload` verifica la existencia del bucket y `public=false`
antes de subir el archivo. Una lectura de `storage.buckets` en Supabase Rifas
(`vukzxpwnfbavlwaeqkki`) encontró únicamente `raffle-media`, público; faltaba
`receipts`, el nombre predeterminado configurado para los comprobantes.
Esa ausencia es suficiente para impedir la carga, aunque no acredita que sea el
único problema de configuración del despliegue. No se consultó el log de Vercel
correspondiente a la referencia de la captura.

## Corrección y evidencia actual

Se utilizó el SDK instalado `@supabase/supabase-js`, con credenciales privadas
locales cargadas en memoria, para ejecutar `storage.createBucket('receipts', …)`:

- `public: false`.
- `fileSizeLimit: 5242880` (5 MiB, compatible con el límite base de la API).
- `allowedMimeTypes: ['image/jpeg', 'image/png', 'application/pdf']`.

La lectura posterior `storage.getBucket('receipts')` confirmó esos valores con
la clave local de servidor. Otra lectura independiente de `storage.buckets`
mediante el conector Supabase confirmó la misma configuración. Los primeros
intentos HTTP desde el sandbox fallaron por conectividad; la ejecución con
acceso de red ampliado completó creación y lectura correctamente.

Esto provisiona un recurso de Storage por su API, sin modificar el esquema
PostgreSQL ni el historial de migraciones. No se cambiaron permisos de acceso
de clientes, archivos, órdenes, pagos, inventario o el bucket público existente.
No se hizo despliegue ni se imprimieron secretos. El proxy Vercel mantiene
su límite de archivo de 4 MiB.

## Límites y siguiente verificación

No se hizo una compra real ni se subió un archivo de prueba a producción.
La prueba acredita existencia y privacidad del contenedor y acceso con la clave
local; no certifica las variables de Vercel ni el flujo web/API completo.
Allí deben coincidir `SUPABASE_URL`, `PRIVATE_RECEIPT_BUCKET` y una
`SUPABASE_STORAGE_KEY` de servidor válida para el mismo proyecto.

El comprador debe conservar su sesión, los datos originales y el mismo archivo
y utilizar «Recuperar el mismo envío». La idempotencia existente recupera una
orden previa si la hubiera; no debe hacer otra transferencia para reintentar.
Si el hold ya venció sin orden, la recuperación puede requerir conciliación
administrativa; no se crean nuevos cupos automáticamente.

## Recuperación

Mantener el bucket privado. Si persiste el error, inspeccionar los logs de API
por su referencia y comprobar las variables del servidor antes de otro cambio.
No borrar el bucket, vaciarlo, hacerlo público ni cambiar el identificador para
resolver una incidencia: podría contener comprobantes ya vinculados a órdenes.
Una retirada futura exige inventario de referencias y conservación del histórico
con autorización del propietario. No hay rollback de esquema que ejecutar.

Solo cambiaron documentos: verificación local con `git diff --check`; no se
ejecutaron compilación ni pruebas de código porque no se modificó la aplicación.
