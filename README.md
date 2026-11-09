# App Sorteos — paquete de implementación progresiva para Codex

## Ajustes de negocio

Fase 1 documental completada. La [etapa 2](docs/AJUSTES_NEGOCIO_FASE_2.md) implementa
rango 00000..99999 para nuevas rifas y generación de boletos al pre-reservar,
objetivo privado editable y progreso público calculado con pagos confirmados.
La migración fue aplicada con autorización al proyecto Supabase Rifas el 2026-11-08;
catálogo y conexión verificados con HTTP 200. En otros entornos, migrar antes de ejecutar el código.
Las rifas históricas conservan su universo y esperan objetivo del propietario.
Las etapas 3–6 incorporan premios y bendecidos inmutables, resultado manual en
un campo de cinco cifras, entregas auditadas, consulta censurada por teléfono
con estado por orden (sin OTP) y compra simplificada. La regresión y los límites
de entrega se registran en [etapa 7](docs/AJUSTES_NEGOCIO_FASE_7.md) y el
[plan de ajustes](docs/PLAN_AJUSTES_NEGOCIO.md).

Verificación reproducible: `npm run test:stage7:checks`; después ejecutar
`test:adjustments` mediante `scripts/test-backend-local.ps1` sobre PostgreSQL
local desechable y `npm run test:e2e --workspace @sorteos/web`. Ejecutar estos
bloques en serie. No aplican migraciones remotas ni despliegan.

## Limpieza local

`npm run clean:local` muestra los destinos desechables; `npm run clean:local -- -Apply`
elimina copias de navegador, clústeres PostgreSQL de prueba detenidos, cachés,
scripts temporales y salidas de pruebas. Ejecutarlo cuando no haya pruebas en curso.
Valida que los destinos estén dentro del repositorio y no contengan archivos
versionados; desvincula junctions sin recorrer sus destinos.

Conserva `.env`, dependencias instaladas, builds de la aplicación, certificados,
respaldos de consolidación/migraciones, comprobantes y medios locales, así como
evidencia documental y capturas actuales. Las cachés eliminadas se regeneran al
usar las herramientas; limpiar no afecta datos remotos.

## Imágenes públicas

Next sirve versiones WebP adaptadas al dispositivo. Se configuraron anchos desde
360 hasta 1920 px, tamaños acordes con el contenedor de portada/galería y una sola
tarjeta prioritaria en el catálogo; las demás conservan carga diferida. La API
ya normaliza fotos nuevas a un máximo de 2000 px. Tarjetas y galería conservan
la presentación completa del premio.

La primera descarga y transformación desde almacenamiento remoto puede tardar más
que una respuesta en caché; las mediciones de desarrollo no son un SLA de hosting.
El adaptador de medios local conserva su excepción de optimización, sin habilitar
acceso general del optimizador a IP privadas. No cambian variables ni contratos.
Referencia: [imágenes responsive de Next](https://nextjs.org/docs/app/api-reference/components/image#sizes).

Comprobación local: portada a 390 px y densidad 1x, misma foto WebP/calidad:
antes se elegían 640 px (42002 bytes); después, 360 px (20298 bytes), un 51.7%
menos de contenido de esa imagen. No es una medición de aceleración global ni
un resultado extensible a todas las densidades. Lint, tipos, build, 65 pruebas
unitarias y 27 recorridos de catálogo/imágenes en Chromium móvil/tablet/escritorio
aprobados; sin despliegue ni modificación de archivos remotos.

## M6: seguridad y resiliencia

Límite HTTP compartido PostgreSQL, telemetría sin PII, timeouts de transporte y
ensayo real de backup/restauración local. La web distingue indisponibilidad y
origen administrativo rechazado. OpenAPI/cliente 0.7.0. Ver
[estado y evidencia](docs/ESTADO_M6.md), [operación segura](docs/OPERACION_SEGURA_M6.md)
y [opciones de hosting](docs/OPCIONES_HOSTING.md).

`HTTP_RATE_STORE=memory` se limita a desarrollo/test. Staging/producción requieren
`postgres`, la migración M6 y una clave CHECKOUT_ABUSE_HASH_KEY común. El trabajo
local no aplica la migración a Supabase ni activa CAPTCHA o despliegues.

La interfaz pública usa el [sistema visual de Stitch](docs/frontend/DISENO_STITCH.md):
con una paleta activa roja, blanca y negra y tipografías locales Playfair Display y Plus Jakarta Sans,
catálogo responsive y formularios coherentes. El ajuste conserva los flujos de negocio
y el estilo independiente de administración; no requiere nuevas variables de entorno.
El tema carbón/champán original se conserva intacto. Para restaurarlo, cambiar
`publicTheme` de `"red"` a `"original"` en `apps/web/src/app/(public)/layout.tsx`.

## Panel administrativo

La administración tiene estructura y estilo propios, separados del sitio público:
navegación lateral, resumen gerencial, tablas de órdenes/rifas, formularios por
secciones y filtros por nombre de rifa. En móvil, abre el menú de navegación;
las tablas desplazan horizontalmente sin desbordar la página.

Acceso: `/admin/login`. Operación: `/admin`, `/admin/ordenes`, `/admin/rifas`
y `/admin/reportes`. Ver [revisión visual y pruebas](docs/ADMINISTRACION_VISUAL.md).

## M5: administración de rifas y operación diaria

En `/admin`, el resumen separa ingresos confirmados y pendientes; `/admin/rifas`
permite crear/editar borradores, subir fotos propias, previsualizar y publicar,
pausar, reanudar o cerrar. `/admin/reportes` descarga CSV auditado sin datos del
comprador, solo para el propietario. La consulta del cliente sigue en
`/orden/confirmacion` y requiere su cookie protegida.

Cerrar exige pausar y esperar las pre-reservas vigentes. Conserva todas las
órdenes y permite conciliarlas después; no sortea ni publica ganadores.
Numeración inmutable; precio bloqueado tras la primera pre-reserva.

Fotos: `SUPABASE_STORAGE_KEY` solo en API y bucket público `PUBLIC_RAFFLE_BUCKET`
separado del bucket privado de comprobantes. La web configura su directorio
HTTPS en `PUBLIC_PRIZE_IMAGE_BASE_URL`. Para probar localmente sin Storage remoto:
API `DEVELOPMENT_LOCAL_MEDIA=true`; web `PUBLIC_PRIZE_IMAGE_BASE_URL=http://127.0.0.1:3001/api/v1/media`.
Reiniciar Next al cambiar esta base. Se rechaza el adaptador local en staging/producción.

Migración nueva `20261106232520_operations_m5.sql`; no se modifican migraciones
anteriores. Ver [estado y verificación M5](docs/ESTADO_M5.md),
[política de cierre y reportes](docs/decisions/0020-daily-operations.md).

Prueba integrada aislada:
`powershell -NoProfile -File scripts/test-backend-local.ps1 -PasswordAuthentication -Port 54346 -TestScript test:m5`.
Requiere los navegadores Playwright; no ejecutarla contra datos compartidos.

## Política de rama

El proyecto se desarrolla exclusivamente en `main`, desde esta carpeta. Backend, frontend y documentación se guardan juntos en commits de esa rama. No crear ramas por fase, por capa ni worktrees adicionales. Las referencias a `feat/*` en informes históricos se conservan para trazabilidad. Decisión: [ADR 0013](docs/decisions/0013-main-only.md).

## Administración local — activada el 2026-11-06

Los párrafos de esta sección son evidencia histórica de aquella preparación local, no una renovación de la excepción MFA ni una comprobación actual del proveedor. Para el estado actual de entrega y pendientes, consultar la etapa 7.

Prueba temporal ampliada por el propietario: en este equipo se permite el proceso M1–M4 sin TOTP hasta las **8:53 p. m. del 6 de noviembre de 2026**, hora de Santo Domingo. Login real, compra DEMO con archivo privado, revisión, aprobación y cancelación, conservando permisos y conciliación. [Rifa DEMO](http://127.0.0.1:3000/rifas/demo-prueba-completa/participar), [PDF de prueba](http://127.0.0.1:3000/development/comprobante-demo.pdf) y [operación/verificaciones](docs/DESARROLLO_PRUEBA_COMPLETA.md). No transferir dinero; la excepción vence automáticamente y el perfil se rechaza en producción. El entorno privado no se publica al clonar.

Estado posterior del login: corregida la restricción de permisos del esquema Auth alojado mediante migración autorizada y aplicada. La comprobación real del OWNER/sesión bajo el rol runtime pasa sin acceso directo a tablas Auth. Reintentar el login y configurar TOTP en el navegador; ese paso personal sigue por comprobar. Ver [causa, aplicación y evidencia](docs/ADMIN_AUTH_CORRECCION.md).

En esta máquina la web está configurada en live con Auth, las migraciones remotas B1–B5 y sus correcciones están aplicadas y la API local responde en 3001. Abrir http://127.0.0.1:3000/admin/login con el usuario propietario previamente autorizado. Fuera de la excepción anterior, configurar el autenticador y verificar TOTP. Hay una orden DEMO pendiente para probar la revisión. No introducir contraseñas o códigos en el chat.

El login personal requiere comprobación del propietario. Los comprobantes DEMO se guardan realmente en almacenamiento privado local; Supabase Storage privado sigue pendiente para staging/producción. [Operación, pruebas y límites](docs/DESARROLLO_PRUEBA_COMPLETA.md). Los `.env` locales no se publican en Git ni se incluyen al clonar el repositorio. Para volver a iniciar los servicios, usar `npm run dev:api` y `npm run dev:web` en terminales separadas desde esta raíz, evitando duplicar un servidor que ya esté activo.

Si la API informa `startup_failed` con `code=EADDRINUSE`, el puerto indicado ya está ocupado. Conservar una sola instancia: cerrar la API anterior con Ctrl+C en su terminal y volver a iniciar. No cerrar procesos Node ajenos ni cambiar el puerto sin actualizar la URL de la API en la web. Tras un fallo, el supervisor espera un cambio real de código/configuración; Ctrl+C y `npm run dev:api` permiten reintentarlo sin editar archivos.

El comando de desarrollo de API observa contenido de src, .env y configuraciones, evitando los reinicios por avisos/metadatos de dependencias que interrumpían el login. Tras cambiar paquetes instalados o el supervisor, reiniciar el comando manualmente. Diagnóstico y validación en [ADR 0019](docs/decisions/0019-api-development-content-watcher.md).

## Proyecto integrado — 2026-11-05

M4 añade administración web con login real, TOTP, bandeja, visor privado y decisiones de revisión sobre B5. Configurar las variables Auth de servidor de [apps/web/.env.example](apps/web/.env.example) y usar `/admin/login`. Guía operativa y prueba local integrada en [README web](apps/web/README.md); resultados y limitaciones en [estado frontend](docs/ESTADO_FRONTEND.md#m4). No hay despliegue ni cambios remotos por esta entrega.

Frontend F2–F5 y backend B1–B5 incorporados en esta carpeta principal. No hace falta iniciar la web desde otro worktree.

El desarrollo sigue ahora [un único plan M0–M7](docs/PLAN_DESARROLLO.md): cada hito incluye backend, frontend y verificación conjunta en la misma sesión. **M4 está implementado y verificado localmente**, incluido el flujo M1–M3. El siguiente hito propuesto es **M5, operación diaria (B6 + F6)**. El resultado local no certifica Auth/Storage remotos ni autoriza despliegue o ventas reales.

En dos terminales, desde la raíz:

```powershell
npm run dev:api
# En la segunda terminal:
npm run dev:web
```

Abrir http://127.0.0.1:3000/rifas y entrar a participar en una rifa publicada. El formulario está en /rifas/[slug]/participar; aparece después de confirmar cupo con la API. La API debe estar configurada con PostgreSQL local, Storage privado y una cuenta publicada de pruebas. CORS_ORIGINS debe incluir http://127.0.0.1:3000. No hacer transferencias reales durante pruebas.

El script web usa live y API_BASE_URL=http://127.0.0.1:3001/api/v1 solo durante su proceso; conserva .env.local. Para explorar el catálogo demo: powershell -NoProfile -File scripts/start-web.ps1 -Demo. Demo no permite crear órdenes ni ver un formulario que simule una compra.

Estado y límites actuales: [frontend](docs/ESTADO_FRONTEND.md) y [backend](docs/ESTADO_BACKEND.md). Las secciones anteriores por fase conservan su contexto histórico.


**Fecha de especificación:** 2026-10-26  
**Estado:** backend B0 validado localmente el 2026-10-29: lint, typecheck, build, OpenAPI/cliente y 17 pruebas aprobadas.  
**Avance B1 (2026-11-01):** esquema y migraciones validados en `feat/backend-b1`;
39 pruebas aprobadas, incluidas 20 de integración PostgreSQL. Ver [estado B1](docs/ESTADO_BACKEND.md#b1).
**Avance B2 (2026-11-01):** catálogo y administración de rifas en `feat/backend-b2`,
JWT + usuario Auth + allowlist, publicación auditada y rol DB limitado.
Ver [estado B2](docs/ESTADO_BACKEND.md#b2) para pruebas y configuración.
**Avance B3 (2026-11-03):** sesión invitada, pre-reservas idempotentes,
asignación CSPRNG, límites persistentes y liberación segura de HELD.
Ver [estado B3](docs/ESTADO_BACKEND.md#b3).
**Avance B4 (2026-11-03):** envío único de orden/comprobante, correo obligatorio,
consulta protegida y números reservados después del commit. Ver [estado B4](docs/ESTADO_BACKEND.md#b4).
**Idioma de producto:** español (República Dominicana); moneda DOP (RD$).

## Propósito
Construir una plataforma web propia para vender boletos de rifas de **un único organizador**, con una compra en un solo formulario, transferencias bancarias con comprobante obligatorio, asignación aleatoria de números, y validación manual del pago desde un panel administrativo.

## Ejecutar backend B0

Requisitos: Node.js 22.13+ o 24 LTS y pnpm 10.28.2. Desde la raíz:

En Windows, si `pnpm.exe` falla con EPERM, el instalador local usa el paquete
JavaScript oficial con el Node instalado y guarda herramientas/caches en el proyecto:

```powershell
powershell -NoProfile -File scripts/install-backend.ps1
```

Requiere acceso a `https://registry.npmjs.org/`. Instala dependencias y ejecuta
generación, lint, typecheck, pruebas y build del backend; se detiene ante el primer
fallo. No modifica pnpm global. La prueba PostgreSQL se ejecuta por separado.
En Codex, las descargas pueden requerir permisos de red ampliados; el instalador
ya se verificó con ese acceso. En una terminal normal necesita acceso al registro npm.

Instalación habitual con pnpm funcional:

```powershell
pnpm install --frozen-lockfile
Copy-Item apps/api/.env.example apps/api/.env
pnpm generate:api
pnpm dev:api
```

API en `http://127.0.0.1:3001/api/v1/health`. Swagger de desarrollo en
`http://127.0.0.1:3001/api/v1/docs`; JSON en `/api/v1/openapi.json`.
`GET /api/v1/health/ready` devuelve 503 mientras no se configure `DATABASE_URL`,
y 200 únicamente después de una consulta real a PostgreSQL. La API puede iniciar
sin DB en desarrollo. Para producción, tras build: `pnpm --filter @sorteos/api start`.

```powershell
pnpm generate:api
pnpm lint
pnpm typecheck:api
pnpm test:config
pnpm test
pnpm build:api
```

La generación escribe `docs/openapi.json` desde NestJS y
`packages/api-client/src/generated.ts` desde ese JSON. Ejecutarla antes de
compilar tras una instalación limpia y al modificar controladores/DTO.
El cliente se crea con `createApiClient('http://127.0.0.1:3001')` y usa
`client.GET('/api/v1/health')` o `client.GET('/api/v1/raffles')`. B2 ya incorpora
catálogo, administración, holds y órdenes B4 con comprobante privado.
Para un consumidor SSR autenticado, `createApiClient(apiOrigin, accessToken)`
envía Bearer. No guardar tokens en URLs ni logs; renovar el cliente al renovar JWT.

Para pruebas con DB, ver [infra/README.md](infra/README.md). Todas las variables
están documentadas en `apps/api/.env.example`; no se requieren claves Supabase en B0.
En staging/producción CORS exige HTTPS, DB exige TLS y Swagger está prohibido.
`HOST=127.0.0.1` por defecto; para contenedores configurar explícitamente `HOST=0.0.0.0`.

Estado de validación y limitaciones: [estado backend B0](docs/ESTADO_BACKEND.md#b0).
Decisiones: [ADR 0001](docs/decisions/0001-backend-b0.md).

## Persistencia B1: uso local

El único historial de migraciones es el del CLI Supabase 2.122.0, fijado en
devDependencies. SQL en `infra/supabase/migrations`; el CLI se usa aquí sobre
PostgreSQL loopback, sin enlazar proyectos remotos. Modelo y decisiones en
[ESQUEMA_B1](docs/ESQUEMA_B1.md) y [ADR 0004](docs/decisions/0004-backend-b1-persistence.md).

Con una DB de desarrollo vacía llamada `sorteos_dev` o `sorteos_test`, configurar
en `apps/api/.env` la conexión local, `DATABASE_SSL=false` para PostgreSQL sin TLS
y `NODE_ENV=development`. Luego:

```powershell
npm run db:migrate:local
$env:SEED_DEMO = 'true'
npm run db:seed:demo
Remove-Item Env:SEED_DEMO
```

El seed crea una rifa DEMO DRAFT de 100 números y una orden pendiente simulada,
sin cuentas bancarias ni archivos reales; puede repetirse sin duplicar datos.
No crea credenciales ni privilegios de administrador activos. Todas las tablas
de negocio quedan en el esquema privado `sorteos` con RLS y sin acceso de browser.

Para ejecutar la suite SQL en una instancia temporal separada, con PostgreSQL 17
instalado en Windows:

```powershell
powershell -NoProfile -File scripts/test-backend-local.ps1
```

La suite crea sus propias DBs desechables y las elimina al terminar. El script
detiene únicamente la instancia que inició, sin tocar el servicio del sistema.
El procedimiento fue verificado: migraciones, seed, integridad, RLS y recuperación
aprobados. Auditoría de producción sin alertas; queda un aviso moderado en las
herramientas de desarrollo, documentado en [estado backend B1](docs/ESTADO_BACKEND.md#b1).
Recuperación de esquema vacío y plan con datos: [infra/recovery](infra/recovery/README.md).

## Catálogo y administración B2

Con ambas migraciones aplicadas, los visitantes pueden usar GET `/api/v1/raffles`,
`/raffles/:slug`, `/raffles/:slug/availability` y `/bank-accounts/public`. Solo se
exponen rifas PUBLISHED; el seed DRAFT no simula un catálogo ya publicado.

Configurar en `apps/api/.env`:

- `SUPABASE_URL`: origen HTTPS del proyecto propio.
- `SUPABASE_PUBLISHABLE_KEY`: clave publicable del mismo proyecto, sin service_role.
- `PUBLIC_RAFFLE_BUCKET`: bucket público de imágenes propias de premios.
- `DATABASE_URL`: login del servidor con membresía a `sorteos_runtime`. En local,
  aplicar migraciones primero con el usuario autorizado para crear rol/esquema.

Auth requiere claves de firma ES256/RS256 habilitadas. El backend verifica JWKS,
consulta al usuario en Auth y comprueba la allowlist activa en cada solicitud.
Sin configuración no ofrece un login ficticio: las rutas admin devuelven 503.
Crear el usuario mediante el flujo de Supabase Auth del proyecto propio y tomar
su UUID; no autorizar por email ni metadata editable.

Sobre una DB local `sorteos_dev` migrada **sin seed**, el operador puede preparar
el primer OWNER con la herramienta del servidor:

```powershell
$env:PROVISION_LOCAL_ADMIN = 'true'
$env:LOCAL_ADMIN_USER_ID = 'REEMPLAZAR_POR_UUID_REAL_DE_AUTH'
$env:LOCAL_ADMIN_ROLE = 'OWNER'
npm run admin:provision:local
Remove-Item Env:PROVISION_LOCAL_ADMIN
Remove-Item Env:LOCAL_ADMIN_USER_ID
Remove-Item Env:LOCAL_ADMIN_ROLE
npm run dev:api
```

La herramienta requiere credenciales locales del operador, falla con configuración
incorrecta, es reejecutable para el mismo rol y no modifica administradores ya
existentes ni eleva el OWNER desactivado del seed. No existe endpoint de bootstrap.
En un entorno remoto, provisionar el login y allowlist mediante el procedimiento
de operación aprobado; estos comandos locales rechazan conexiones remotas.

Los endpoints `/api/v1/admin/raffles` usan Bearer JWT del usuario allowlisted.
OWNER/ADMIN crean borradores, editan DRAFT/PAUSED y pausan; OWNER publica/reanuda
con las tres confirmaciones del [contrato](docs/CONTRATO_API.md). Esa declaración
no constituye una certificación legal automática. El operador carga sus imágenes
propias al bucket público y registra claves prizes/ o raffles/: HEAD comprueba
acceso y MIME antes de publicar, sin una transacción DB abierta.

Pruebas completas: `powershell -NoProfile -File scripts/test-backend-local.ps1`.
Solo B2: agregar `-TestScript test:catalog`. El proveedor de pruebas es local y
usa claves generadas; Supabase real y assets propios requieren una verificación
del entorno antes de operar. Ver [ADR 0005](docs/decisions/0005-backend-b2-catalog-auth.md).

## Estados consolidados

- [Plan de desarrollo integrado](docs/PLAN_DESARROLLO.md): secuencia M0–M7 y próximo hito conjunto.
- [Estado del backend](docs/ESTADO_BACKEND.md): resumen, evidencias y pendientes por fase B0–B5.
- [Estado del frontend](docs/ESTADO_FRONTEND.md): resumen, evidencias F0–F4 y pendientes de la integración actual.

## Archivos y orden de lectura de Codex

Para operar o integrar pre-reservas, ver la sección B3 al final de este documento.

1. `AGENTS.md`: contexto inmutable, límites, arquitectura y reglas del agente. Debe ubicarse en la raíz del repositorio.
2. `docs/CONTRATO_API.md`: rutas, payloads, errores, estados y reglas compartidas. Fuente de integración backend-frontend.
3. `docs/PLAN_DESARROLLO.md`: única secuencia de ejecución M0–M7, alcance conjunto y estado de partida; consultar después los estados de ambas capas.
4. `docs/PLAN_BACKEND.md` y `docs/PLAN_FRONTEND.md`: especificaciones técnicas B0–B8/F0–F8 del hito integrado, sin agendas separadas.
5. `docs/MATRIZ_QA.md`: pruebas de aceptación, concurrencia, fallos y seguridad.
6. `docs/PROMPTS_CODEX.md`: instrucciones listas para continuar un hito integrado en una sola sesión.

## Estructura sugerida (adaptar, NO sobrescribir proyecto existente)

```text
app-sorteos/
├─ AGENTS.md
├─ README.md
├─ docs/
│  ├─ CONTRATO_API.md
│  ├─ PLAN_DESARROLLO.md
│  ├─ PLAN_BACKEND.md
│  ├─ PLAN_FRONTEND.md
│  ├─ MATRIZ_QA.md
│  └─ PROMPTS_CODEX.md
├─ apps/
│  ├─ api/              # NestJS
│  └─ web/              # Next.js App Router
├─ packages/
│  └─ api-client/       # Tipos/cliente generado a partir de OpenAPI
└─ infra/
   ├─ migrations/       # Una sola fuente de migraciones
   └─ scripts/          # Seed de DEMO y pruebas de concurrencia
```

## Milestones / integración continua por cortes verticales

La secuencia, correspondencia B/F, criterios y situación actual se mantienen en [PLAN_DESARROLLO.md](docs/PLAN_DESARROLLO.md). M4 completa la administración web sobre B5 y verifica el flujo conjunto local de M1–M4. El ensayo autorizado con Auth/Storage reales sigue pendiente; la preparación para operar requiere M5–M7 y las revisiones legales, fiscales, financieras y de seguridad.

## Modo de trabajo de Codex

- Leer archivos completos y reconocer el estado real del repo antes de cambiarlo.
- Ejecutar **un hito integrado** por alcance autorizado, trabajando API y web en la misma sesión y carpeta. No dividir por rol backend/frontend ni ampliar a otros hitos automáticamente.
- Antes de programar: mostrar alcance, dependencias, ficheros previstos y decisiones técnicas.
- Implementar código conectado, migraciones cuando correspondan, contrato/cliente, pruebas y documentación del hito en ambas capas.
- Terminar cada hito con: resumen, archivos modificados, comandos corridos y resultados, evidencia de integración, pendientes, riesgos y siguiente hito desbloqueado.
- Si falta un secreto, integración de Supabase o servicio externo, implementar adaptadores y usar configuración de DEMO sin inventar credenciales ni conexiones.
- Nunca tocar datos productivos, borrar tablas, desplegar, realizar pagos reales o publicar una rifa sin autorización explícita.

## Fuentes técnicas oficiales

- NestJS OpenAPI: https://docs.nestjs.com/openapi/introduction
- Next.js App Router: https://nextjs.org/docs/app
- PostgreSQL bloqueo de filas: https://www.postgresql.org/docs/current/sql-select.html
- Supabase Storage privado: https://supabase.com/docs/guides/storage/serving/downloads
- Supabase RLS: https://supabase.com/docs/guides/storage/security/access-control

## Aviso de alcance

No está decidido un proveedor de mensajería, una pasarela de pago, un mecanismo definitivo de elección de ganadores ni la operativa reglamentaria. No inventarlos. El lanzamiento con rifas reales queda bloqueado hasta verificar permisos, reglas del sorteo y cumplimiento dominicano. La referencia visual pública (Rifas Luxury RD) es inspiración funcional, no una autorización para copiar marca, imágenes ni código ajeno.

## Pre-reservas B3

Aplicar las tres migraciones en una DB **local** mediante `npm run db:migrate:local`.
La migración B3 está preparada y validada localmente; no se aplica a Supabase por
arrancar la API. B1/B2 remotas permanecen intactas. Variables nuevas en
[.env.example](apps/api/.env.example); en staging/production es obligatoria una
clave privada aleatoria CHECKOUT_ABUSE_HASH_KEY de al menos 32 caracteres,
compartida entre instancias del backend. No exponerla como NEXT_PUBLIC_.

Frontend: inicializar `POST /api/v1/checkout-session` con credentials include y
esperar respuesta antes de enviar `POST /api/v1/checkout-holds`. El navegador
añade Origin; el backend exige un origen de CORS_ORIGINS. Conservar un UUID
Idempotency-Key por intención y reutilizarlo en reintentos del mismo payload.
La cookie HttpOnly es la credencial, nunca el ID de hold. Usar el cliente tipado
regenerado; no guardar cookies o tokens en localStorage. Web y API deben estar
bajo el mismo sitio para el envío de cookie SameSite=Lax.

El hold responde cantidad, snapshot de precio/total, estado y expiresAt; no
responde números ni crea orden. GET/DELETE checkout-holds/:id requieren la misma
sesión. Cambiar cantidad requiere cancelar y crear con otra clave, sin garantía
de cupo. Un hold vencido/cancelado no se reactiva al repetir la clave. Antes de
una nueva intención, checkout-session renueva 24 horas conservando el secreto.

TTL 60 min, máximo técnico 100 boletos/hold y los límites de la rifa. Defaults:
1 activo/sesión, 3/IP, 20 altas exitosas/IP/hora y 60 sesiones nuevas/IP/hora.
Rechazo con 429; sin proveedor CAPTCHA configurado. El job barre cada 30 s
mientras la API esté activa; nunca libera RESERVED/SOLD ni cancela órdenes.
La API no confía en X-Forwarded-For: revisar identidad de proxy antes de desplegar.

Verificación Windows reproducible (PostgreSQL 17 instalado):

```powershell
# Toda la integración, con contraseña SCRAM como CI:
powershell -NoProfile -File scripts/test-backend-local.ps1 -PasswordAuthentication
# Solo B3:
powershell -NoProfile -File scripts/test-backend-local.ps1 -PasswordAuthentication -TestScript test:checkout
```

SCRAM crea un cluster aislado nuevo en .tmp por ejecución, con contraseña de
prueba aleatoria, elimina el archivo de inicialización y detiene su servidor
al finalizar. Las DB/roles de cada suite se eliminan; el cluster detenido queda
en .tmp para diagnóstico. No modifica el servicio PostgreSQL del sistema.
En CI Linux: `pnpm test:integration` con TEST_DATABASE_URL loopback de pruebas.
Algoritmo, límites y recuperación en [ADR 0006](docs/decisions/0006-backend-b3-holds.md).

## Órdenes y comprobantes B4

Requiere las cuatro migraciones en una DB local, sesión B3, rifa apta y cuenta
bancaria habilitada. No convertir el seed DEMO en una cuenta real ni transferir
dinero para probar. El seed sigue siendo un fixture histórico DRAFT y privado;
las suites crean sus propias cuentas ficticias y archivos válidos en entornos aislados.

Para Storage real, preparar un bucket **privado** del proyecto propio, sin acceso
de cliente no autorizado, diferente del bucket público de premios. Configurar
solo en `apps/api/.env`: PRIVATE_RECEIPT_BUCKET, RECEIPT_MAX_BYTES (5242880 por
defecto) y SUPABASE_STORAGE_KEY (sb_secret_ o service_role legado de servidor).
No compartir esa clave por chat, logs ni NEXT_PUBLIC_. B4 no crea buckets ni
políticas remotamente. Sin clave/bucket privado correcto, nuevos envíos fallan
con STORAGE_UNAVAILABLE; no hay fallback que finja guardar el comprobante.

POST `/api/v1/orders` recibe multipart con holdId, nombre/teléfono/**correo
obligatorio**, banco, referencia, fecha con zona horaria, reglas aceptadas y un
archivo JPG/PNG/PDF. Reutilizar Idempotency-Key para la misma intención/archivo.
Solo después del commit responde PENDING_REVIEW, REPORTED, total y números
reservados con ceros. Un adjunto no equivale a pago recibido. GET `/orders/:code`
requiere la misma cookie y no devuelve PII, comprobante ni una URL de Storage.

El cliente generado incluye `OrderSubmission` (receipt: Blob) y `submitOrder`:

```ts
import { createApiClient, submitOrder } from '@sorteos/api-client';
const api = createApiClient(apiOrigin);
// form contiene los campos del contrato y receipt: File/Blob; la sesión ya existe.
const result = await submitOrder(api, form, stableIdempotencyKey, window.location.origin);
```

El helper construye FormData y deja al navegador generar Content-Type/boundary;
no fijar Content-Type manualmente. SSR debe reenviar cookie y Origin permitido
desde una sesión protegida; credentials include en Node no crea un cookie jar.
La interfaz F4 está integrada en apps/web, junto al backend.

Storage siempre ocurre fuera de la transacción de inventario. Los intentos se
registran en receipt_staging; rollback o duplicados compensan archivos temporales.
Job cada 60 s limpia intentos vencidos (margen de 10 min) y reintenta fallos;
nunca elimina ATTACHED. Máximo 4 uploads simultáneos por instancia, 2 pendientes
vigentes por sesión y 20 intentos de staging/sesión/hora. Validación estructural
no sustituye antivirus ni protección DDoS en el borde.

```powershell
powershell -NoProfile -File scripts/test-backend-local.ps1 -PasswordAuthentication -TestScript test:orders
# Si el puerto de pruebas está ocupado, usar otro, sin detener esa instancia:
powershell -NoProfile -File scripts/test-backend-local.ps1 -PasswordAuthentication -Port 54342
```

Pruebas locales usan PostgreSQL real y un servidor de protocolo Storage; el
adaptador de producto usa el SDK real. Falta configuración/verificación del
bucket remoto y aplicar B3/B4 con autorización. No se desplegó ni publicó una rifa.
Ver [ADR 0008](docs/decisions/0008-backend-b4-order-receipts.md).

## Revisión manual B5

Implementa bandeja/detalle de órdenes, comprobante por proxy autenticado,
inicio de revisión, aprobación, solicitud de resolución y cancelación conciliada.
Ver [contrato](docs/CONTRATO_API.md) y [ADR 0009](docs/decisions/0009-backend-b5-manual-payments.md).

Requiere las cinco migraciones, Auth del mismo proyecto y allowlist activa.
El administrador debe inscribir y verificar TOTP mediante Supabase Auth y usar
una sesión `aal2` con verificación TOTP de menos de 15 minutos; renovar un JWT
no sustituye esa verificación. OWNER aprueba/cancela; ADMIN puede revisar.
Las rutas comprueban también la sesión y el factor vigentes en la base.
Sin configuración/permisos Auth correctos se deniega la operación.

El cliente `createApiClient(apiOrigin, accessToken)` admite Bearer. Obtener
`version` del detalle y enviar `expectedVersion` más `Idempotency-Key` UUID en
cada acción; conservar la clave ante reintentos. Para descargar el comprobante,
usar la ruta del descriptor con Bearer y `parseAs: 'blob'` en el cliente tipado.
La ruta no funciona como enlace anónimo. No persistir tokens en URLs o logs.

La aprobación exige comprobar el ingreso bancario manualmente; la cancelación
exige evidencia y conciliación. El sistema registra reembolsos ya comprobados,
sin realizar transferencias. NEEDS_RESOLUTION mantiene los números reservados.

```powershell
# Integración completa B1–B5, aislada de Supabase:
powershell -NoProfile -File scripts/test-backend-local.ps1 -PasswordAuthentication -Port 54343
# Solo B5:
powershell -NoProfile -File scripts/test-backend-local.ps1 -PasswordAuthentication -Port 54343 -TestScript test:payments
```

La migración B5 requiere permisos sobre metadatos de sesiones/factores Auth;
no concede lectura de secretos. Verificar su aplicación y MFA con sesión real
en staging antes de operar. Aplicación remota B3–B5, Storage privado real y
validación de esa sesión siguen pendientes. Estado en [B5](docs/ESTADO_BACKEND.md#b5).

## Lotería y premios (etapa 4)

Registro manual de Pick 4 Florida + FIREBALL al final, adjudicación privada y constancias de entrega en Administración → Rifa → Premios y números bendecidos. Configurar premios de lotería antes de publicar. Para adjudicar, cerrar ventas antes del evento y conciliar todos los pagos. Ver [detalle y verificaciones](docs/AJUSTES_NEGOCIO_FASE_4.md) y [contrato](docs/CONTRATO_API.md). No requiere nuevas variables de entorno ni conexión a la lotería.

## Consulta pública de registros — Etapa 5

En `/consultar-boletos` se busca por rifa y teléfono, sin OTP. Solo muestra nombre y correo censurados y cantidad y estado de cada orden no cancelada (incluye pendientes de pago); nunca números, códigos ni comprobantes. La migración local de etapa 5 debe aplicarse antes de habilitar el endpoint en otro entorno. No añade proveedores ni variables: usa la clave secreta estable `CHECKOUT_ABUSE_HASH_KEY` para límites compartidos. Contrato y evidencia en [fase 5](docs/AJUSTES_NEGOCIO_FASE_5.md).

## Compra simplificada — Etapa 6

El catálogo usa Comprar para rifas disponibles; el detalle lleva a la selección real de cantidad, sin reservas por navegar. Cuentas y total del hold permanecen visibles antes de Enviar orden, que adjunta el comprobante en la misma operación. La confirmación prioriza estado, números y bendecidos; el resumen se puede desplegar. La API proyecta `canPurchase` y conserva la validación final del inventario. No añade variables ni migraciones. Evidencia en [fase 6](docs/AJUSTES_NEGOCIO_FASE_6.md).
