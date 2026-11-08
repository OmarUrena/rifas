# Infraestructura B0/B1/B2

Etapa 2 de ajustes: migración `20261108165909_raffle_fundraising_stage2.sql`,
aplicada con autorización al proyecto Rifas el 2026-11-08. La versión local
coincide con la registrada por Supabase; SQL idéntico al probado anteriormente.
Las nuevas rifas configuran un rango, sin poblar tickets; se generan al pre-reservar.
Los fixtures pequeños existentes declaran LEGACY de forma explícita. Seed opcional
`seeds/stage2-demo.sql`, estado y límites en [fase 2](../docs/AJUSTES_NEGOCIO_FASE_2.md).
No aplicar a un entorno remoto sin autorización; no convierte rifas existentes.

B0 solo consulta salud de PostgreSQL. B1 añade un único sistema de migraciones:
Supabase CLI 2.122.0 y `supabase/migrations/`. Tablas privadas en `sorteos`, seed
DEMO en `seeds/demo.sql` ejecutado desde las herramientas del backend y recuperación
en `recovery/`. Ver [estado de verificación B1](../docs/ESTADO_BACKEND.md#b1).

Los tests de B1 crean DBs desechables con el usuario de pruebas (requiere CREATEDB
y CREATEROLE para verificar RLS). No aplican migraciones en la DB original que
se proporciona mediante TEST_DATABASE_URL. El script Windows
`scripts/test-backend-local.ps1` prepara su propia instancia en el puerto 54339.
Pruebas B1 ejecutadas y aprobadas con PostgreSQL 17.5: 20/20 de integración.

B2 añade otra migración en el mismo historial: rol NOLOGIN `sorteos_runtime`,
políticas RLS de servidor y metadatos de versión/aprobación/derechos de imágenes.
El API conecta con un login miembro del grupo y hace SET LOCAL ROLE en todas las
operaciones de negocio; las pruebas también usan un login limitado para el API.
No se concede ese rol a anon/authenticated ni se expone sorteos por la Data API.
El usuario que aplica migraciones necesita permisos de propietario y CREATEROLE;
el login de ejecución no los necesita. No reutilizar credenciales del migrador
para desplegar el API. Los comandos suministrados solo operan en bases loopback.

La integración B2 verifica Auth/JWKS/Storage con un proveedor HTTP local y firmas
reales; no crea usuarios ni objetos en Supabase remoto. Usar el proyecto propio
y configuración de servidor para la verificación de staging.

PostgreSQL aislado opcional con Docker:

```powershell
docker compose -f infra/compose.test.yaml up -d --wait
$env:TEST_DATABASE_URL = 'postgres://demo_test:demo_local_only@127.0.0.1:54329/sorteos_test'
pnpm test:integration
docker compose -f infra/compose.test.yaml down
```

Credenciales exclusivamente DEMO para el contenedor local, sin volumen persistente.
La prueba consulta `SELECT 1`; no cambia esquema ni datos. También puede usarse
una instancia PostgreSQL de pruebas ya disponible, mediante `TEST_DATABASE_URL`.
No utilizar conexiones de producción. Docker no es requisito para ejecutar la API.

La descripción anterior de `SELECT 1` corresponde a B0. `test:integration` ahora
incluye también el esquema B1, exclusivamente en nuevas DBs creadas por la suite.

## PostgreSQL instalado en Windows, sin Docker

Verificado con PostgreSQL 17.5. Crear una instancia exclusiva del proyecto (una sola vez):

```powershell
New-Item -ItemType Directory -Force .tmp/postgres-b0 | Out-Null
& 'C:/Program Files/PostgreSQL/17/bin/initdb.exe' -D .tmp/postgres-b0/data -U demo_test --auth=trust --encoding=UTF8 --locale=C
```

El usuario `demo_test` y la autenticación trust se usan solo para esta instancia
de pruebas ligada a loopback. No reutilizar esta configuración fuera del entorno local.
No ejecutar initdb contra un directorio de datos ya existente.

Desde la raíz, iniciar, verificar y detener únicamente esta instancia:

```powershell
$pgToolsPath = 'C:/Program Files/PostgreSQL/17/bin/pg_ctl.exe'
& $pgToolsPath -D .tmp/postgres-b0/data -l .tmp/postgres-b0/server.log -o '-h 127.0.0.1 -p 54329 -c timezone=UTC' -w start
if ($LASTEXITCODE -ne 0) { throw 'No se pudo iniciar PostgreSQL temporal' }
try {
    $env:TEST_DATABASE_URL = 'postgres://demo_test@127.0.0.1:54329/postgres'
    npm.cmd run test:integration
    if ($LASTEXITCODE -ne 0) { throw 'Fallo la prueba de integracion' }
} finally {
    Remove-Item Env:TEST_DATABASE_URL
    & $pgToolsPath -D .tmp/postgres-b0/data -m fast -w stop
}
```

En el sandbox de Windows, initdb/pg_ctl pueden requerir permisos ampliados para
crear procesos. No se detiene ni altera el servicio PostgreSQL instalado del sistema.

B3 añade una tercera migración y una tabla de límites con RLS, manteniendo cerrado
el acceso del browser al esquema de negocio. `test:integration` incluye B1/B2/B3.
Para reproducir la autenticación de CI en Windows, usar
`powershell -NoProfile -File scripts/test-backend-local.ps1 -PasswordAuthentication`;
se crea un cluster desechable separado con contraseña aleatoria SCRAM.
La opción `-TestScript test:checkout` limita la ejecución a B3. No usar URLs remotas
en estas herramientas locales ni editar SQL que ya figure en historial remoto.

B4 incorpora una cuarta migración y receipt_staging (15 tablas de negocio en total).
El seed B1 permanece DEMO y reejecutable; no sube archivos. `test:orders` usa
PostgreSQL con rol limitado y un servidor Storage local que almacena los bytes
de archivos de prueba válidos. El adaptador de producto requiere Supabase real,
bucket privado y clave de servidor; no crea recursos remotos automáticamente.
Recuperación: revertir B4 antes de B3/B2, reparar el historial mediante CLI.

B5 añade la quinta migración y `admin_actions` (16 tablas en `sorteos`).
`test:payments` verifica revisión, MFA, conciliación, proxy privado, concurrencia
y recuperación. El fixture Auth solo existe en tests y usa firmas JWT reales;
el producto requiere una sesión Supabase vigente y factor TOTP verificado.
Una instalación PostgreSQL sin tablas Auth permite migrar, pero las operaciones
B5 fallan cerrado. No crear tablas Auth de prueba en el entorno del producto.

La migración concede al rol de servidor lectura de columnas de metadatos de
sesión/factor y políticas SELECT acotadas al contexto autorizado. No concede
secretos, tokens, BYPASSRLS ni SECURITY DEFINER. Verificar la compatibilidad y
los permisos de las tablas administradas por Supabase antes de aplicar en staging.
Para recuperar una fase anterior, retirar B5 primero; ver [recuperación](recovery/README.md).
