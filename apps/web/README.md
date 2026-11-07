# App Sorteos — frontend integrado M4

Presentación pública basada en el ZIP de App Sorteos Luxury Platform: ver
[sistema visual](../../docs/frontend/DISENO_STITCH.md) y [ADR 0022](../../docs/decisions/0022-public-stitch-theme.md).
Fuentes locales bajo SIL OFL, tema acotado a `.public-app` y fotografías reales
conservadas. No requiere nuevas variables ni cambia las funciones de compra.

Desde la raíz de AppRifas, iniciar el backend configurado con `npm run dev:api` y la web con `npm run dev:web` en otra terminal. Abrir http://127.0.0.1:3000/rifas. No se requiere cambiar de rama ni de carpeta de trabajo.

El script `scripts/start-web.ps1` usa API_MODE=live, APP_ENV=development y API_BASE_URL=http://127.0.0.1:3001/api/v1 sin modificar .env.local. Permite -Port y -ApiBaseUrl. CORS_ORIGINS de NestJS debe incluir el origen web exacto; usar 127.0.0.1 en ambos servicios para compartir la cookie invitada. Para demo explícita usar -Demo; demo no crea cupos ni órdenes.

## Rutas

| Ruta | Función |
|---|---|
| / y /rifas | Catálogo real B2, estados de carga, vacío y errores |
| /rifas/[slug] | Detalle público y disponibilidad |
| /rifas/[slug]/participar | Cantidad, pre-reserva B3 y formulario único B4 con comprobante obligatorio |
| /orden/confirmacion | Consulta protegida por sesión; números reservados y pago pendiente de revisión |
| /orden/recuperar | Recuperación idempotente de envíos ambiguos de la pestaña |
| /ayuda y /privacidad | Ayuda y tratamiento de datos |
| /admin/login | Login real, renovación de sesión existente y acceso exclusivo por allowlist |
| /admin/prueba-acceso | Confirmación protegida de login sin TOTP durante una ventana local autorizada; sin datos ni acciones financieras |
| /admin/mfa | Verificación TOTP reciente e inscripción del primer autenticador |
| /admin/ordenes | Bandeja con filtros y paginación, sin PII en lista |
| /admin/ordenes/[id] | Detalle protegido, comprobante privado, historial y decisiones de conciliación |

Para ver el formulario hay que confirmar primero cupo de una rifa publicada con disponibilidad. Requiere API/DB configuradas; para enviar también cuenta de pruebas activa y Storage privado. No se inventan cuentas ni pagos. El seed básico DRAFT no publica por sí solo una rifa.

## Configuración y verificación

Variables servidor documentadas en [.env.example](.env.example): API_BASE_URL, API_MODE, APP_ENV, RECEIPT_MAX_BYTES (igual al backend), WEB_ORIGIN y PUBLIC_PRIZE_IMAGE_BASE_URL (solo imágenes públicas de premios). Sin claves privilegiadas en navegador. Conservar las variables privadas existentes.

Para M4 configurar también SUPABASE_URL (HTTPS) y SUPABASE_PUBLISHABLE_KEY (sb_publishable_) del mismo proyecto que NestJS, solo en el servidor web. No usar service_role o claves secretas en estas variables. Sin Auth configurado o en modo demo, login no recibe credenciales. El administrador debe existir en Auth y tener una entrada activa en admin_users mediante el procedimiento autorizado; no hay registro público. B3–B5 y permisos sobre metadatos Auth deben estar aplicados en el entorno antes de usar revisión financiera.

Si la resolución dual-stack local retrasa Auth, configurar `HTTP_DNS_FAMILY=4` en los archivos privados de ambos servidores y reiniciarlos. El valor habitual es `auto`; también se admite `6`. La opción solo selecciona familia de conexión HTTP, con TLS verificado y los mismos tiempos de espera. Ver [ADR 0014](../../docs/decisions/0014-server-http-address-family.md).

Login envía credenciales al servidor web; los tokens quedan en cookies HttpOnly/Strict de alcance /admin, Secure con HTTPS. La aplicación solicita TOTP y permite configurar el primer autenticador manualmente si falta. Requiere MFA en los últimos 15 minutos. Si el access token vence al abrir una página, volver al login y usar «Continuar sesión existente»; la renovación ocurre en Route Handler, no durante render. Logout revoca la sesión actual y borra cookies; un fallo de revocación se informa. No enviar contraseñas/códigos por chat.

Para una prueba local autorizada del login, `ADMIN_LOGIN_WITHOUT_TOTP_UNTIL` admite una fecha ISO UTC futura en el servidor web. Solo actúa en development/test con web y API HTTP loopback y modo live. Muestra `/admin/prueba-acceso` después de verificar la cuenta y sesión reales, sin habilitar consulta/decisiones de órdenes ni comprobantes. Vacío o vencido restaura TOTP; production/staging no lo habilitan. La configuración de ejemplo está vacía. No cambia factores ni opciones de Supabase. Ver [ADR 0017](../../docs/decisions/0017-local-login-trial.md).

Ampliación autorizada al proceso completo: si NestJS devuelve `developmentAccessUntil` vigente tras comprobar capacidad privada, administrador y sesión, el login abre órdenes y permite revisión/conciliación con los roles habituales. La web muestra la fecha de vencimiento y conserva `mfaVerifiedUntil=null` para esa excepción; no declara TOTP verificado. La capacidad se configura únicamente en la API, nunca en Next.js. Fuera del perfil development/test loopback no se habilita. Operación DEMO y archivos privados locales en [prueba completa](../../docs/DESARROLLO_PRUEBA_COMPLETA.md).

Logout mantiene además una marca HttpOnly sin credenciales que impide reabrir la sesión con cookies de respuestas pendientes; solo un login nuevo la elimina. Si Auth falla, el acceso local queda cerrado y el login muestra «Revocación remota pendiente», para seguir el procedimiento de seguridad del propietario. Las lecturas normales no renuevan ni reescriben credenciales.

OWNER puede aprobar/cancelar; ADMIN puede revisar/requerir resolución. Aprobar exige importe exacto y verificación bancaria, cancelar exige conciliación documentada. La pantalla ofrece los tres resultados de cancelación B5: no ingreso, reembolso completo ya realizado o duplicado contra otra orden PAID. NEEDS_RESOLUTION mantiene los boletos reservados. Ante pérdida de respuesta, usar «Reintentar misma decisión»; ante conflicto, actualizar detalle. No reenviar automáticamente tras recargar.

Los comprobantes se obtienen por proxy autenticado y se muestran mediante blob temporal, sin URL pública ni optimización/caché. Descargar genera una copia privada bajo responsabilidad del operador. M4 no incorpora editor de rifas, dashboard agregado, CSV, cierre ni sorteo.

Prueba integrada aislada (PostgreSQL 17, dependencias y navegadores Playwright ya instalados):

```powershell
$env:PLAYWRIGHT_BROWSERS_PATH = Join-Path (Get-Location) '.tmp/playwright-browsers'
powershell -NoProfile -File scripts/test-backend-local.ps1 -PasswordAuthentication -Port 54346 -TestScript test:m4
```

El runner inicia NestJS, protocolo Auth/Storage local y una copia temporal de Next en 3115, sin usar .env.local ni detener la web en 3000. Fallará si falta infraestructura; no omite pruebas silenciosamente. Evidencias y límites en [estado frontend](../../docs/ESTADO_FRONTEND.md), decisión en [ADR 0012](../../docs/decisions/0012-m4-admin-web-session.md). Validar Auth/Storage remotos sigue requiriendo un entorno autorizado.

```powershell
npm run api:check-catalog --workspace @sorteos/web
npm run lint --workspace @sorteos/web
npm run typecheck --workspace @sorteos/web
npm run test:core --workspace @sorteos/web
npm run test --workspace @sorteos/web
npm run test:e2e --workspace @sorteos/web
```

Playwright usa puerto 3102 y Chromium/Firefox/WebKit. Configurar PLAYWRIGHT_BROWSERS_PATH con la carpeta local de navegadores. No ejecutar dos servidores Next dev sobre este mismo checkout simultáneamente.

Pruebas live: test:live, test:checkout:live y test:orders:live requieren PostgreSQL efímero local, TEST_DATABASE_URL, Next live en 3105 apuntando a API de pruebas en 3106 y navegadores instalados. BACKEND_CHECKOUT es opcional y predetermina esta misma raíz. No usar datos productivos. Ver [estado consolidado](../../docs/ESTADO_FRONTEND.md) para resultados de esta integración.

Para build usar API_MODE=live y APP_ENV=production; API_BASE_URL debe usar HTTPS (por ejemplo https://api.example.test/api/v1). Mock está prohibido en build de producción. Administración M4 está implementada y activada localmente con Auth remoto; login/TOTP personal y Storage real siguen pendientes según la [evidencia de activación](../../docs/MIGRACIONES_SUPABASE_B3_B5.md). No se ha desplegado.
