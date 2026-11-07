# M6 — Seguridad, calidad y resiliencia conjunta

Fecha: 2026-11-07. Autorizado por el propietario: «Continuar con M6».
Trabajo exclusivamente en main. Estado: implementación local verificada; M6
permanece abierto por requisitos externos explícitos. No habilita ventas reales.

## Implementación

- Nest conserva su guard HTTP, con almacén PostgreSQL atómico opt-in en local y
  obligatorio en staging/production. Una tabla RLS separada guarda solo HMAC,
  conteos y tiempos; no contiene IP, cookies, tokens ni datos de comprador.
- Ventanas/bloqueos usan reloj PostgreSQL; contadores saturados, limpieza acotada,
  Retry-After y fallo cerrado. Dos instancias no duplican el presupuesto.
- Liveness independiente del almacén compartido; timeouts HTTP explícitos y
  trust proxy desactivado hasta verificar el borde/origen del hosting.
- Logs con categoría fija, estado, duración, requestId y código conocido. 5xx
  son error y 429 warning; no se registran URL, parámetros ni PII.
- Web distingue indisponibilidad temporal. Un rechazo de origen administrativo
  informa `ORIGIN_NOT_ALLOWED` y conserva una sesión válida; continúa rechazando
  CSRF. La integración prueba recuperación de 429/503/red sin repetir acciones.
- OpenAPI/cliente 0.7.0 documentan Retry-After. Se conserva la semántica de negocio.
- Nuevos ensayos de contención/reintentos y restauración SQL real. Playwright
  recoge métricas de carga, LCP cuando esté soportado, CLS y recursos en DEMO;
  no convierte mediciones de next dev en un SLA de producción.
- CI preparada para integración SQL y navegador M4/M5; cliente PostgreSQL 17
  desde el repositorio oficial y runners Ubuntu 24.04 explícitos. CI remota no
  ejecutada desde esta sesión.

Diseño previo: [ADR 0023](decisions/0023-m6-resilience.md).
Procedimientos: [operación segura](OPERACION_SEGURA_M6.md).

## Datos y recuperación

Migración `20261107194617_http_rate_limits_m6.sql`, creada con el CLI oficial.
Solo aplicada en clusters locales desechables: diez versiones y 18 tablas RLS.
La instalación remota conserva su estado anterior; esta sesión no la modifica.
El seed DEMO existente sirve para el ensayo y no introduce nuevos datos reales.

La restauración usa formato custom, una DB nueva y pg_restore transaccional.
Compara filas/conteos, RLS, privilegios, orden pendiente y RESERVED, duplicados y
DRAWN bloqueado. No incluye objetos de Storage, Auth ni roles globales; no se
certifica recuperación integral del proveedor. `infra/recovery/m6-down.sql`
retira exclusivamente contadores; con datos de negocio, preferir forward-only.

## Evidencia y límites

La línea base previa al cambio aprobó 93/93 pruebas de integración en PostgreSQL
18 local con SCRAM. No debe confundirse con la regresión final de esta revisión.
La regresión final y sus repeticiones dirigidas produjeron estos resultados:

| Verificación ejecutada | Resultado actual |
|---|---|
| `npm run lint`; lint web | PASS |
| `npm run typecheck` | PASS API, cliente y web |
| `npm test`; `npm run test:config` | PASS 22/22 y 10/10 |
| `npm run test:core --workspace @sorteos/web`; `npm test --workspace @sorteos/web` | PASS 6/6 y 50/50 |
| Runner PostgreSQL SCRAM con `test:integration` | PASS 97/97; sin omitidas |
| Repetición `test:checkout` con HTTP_RATE_STORE=postgres en ambas instancias | PASS 11/11; 100 solicitudes, 20 aceptadas, 80 sin cupo, 20 reintentos, cero duplicados/errores inesperados |
| Repetición `test:resilience` | PASS 4/4; contadores, TTL, fallo cerrado y restauración con SQLSTATE esperado |
| Runner `test:m4` | PASS 18/18; MFA, roles, permisos, archivos, idempotencia, perfil de desarrollo y 429/503/red |
| Runner `test:m5` | PASS 5/5; edición, publicación, cierre, compra, conciliación, consulta y CSV |
| `npm run test:e2e --workspace @sorteos/web` | PASS 80/80 en Chromium móvil/tablet/escritorio, Firefox y WebKit móvil; axe AA, teclado y sin desbordamiento |
| `npm run build:api`; build web aislado `next build --webpack` | PASS; web APP_ENV/NODE_ENV production, API_MODE live y API HTTPS de ejemplo, sin secretos/Auth locales |
| Escaneo de JS/map estáticos de la web actual | 81 archivos, un valor privado configurado comprobado; cero coincidencias. No es un análisis exhaustivo de secretos |

Contención con límite compartido activado: p50 558 ms, p95 737 ms, p99 767 ms;
ventana inicial de 100 solicitudes en 772 ms. Se mide hasta recibir cabeceras HTTP,
tras el commit del hold; no es latencia de usuario, carga distribuida ni SLA.
Reportes versionados: [carga](qa/M6_LOAD.json), [restauración](qa/M6_RESTORE.json)
y [25 observaciones de navegador](qa/M6_BROWSER_METRICS.json). Estas últimas se
recogen durante QA con scroll/decodificación, no representan Core Web Vitals de
usuarios ni un build de producción. Capturas DEMO de la regresión administrativa
en `frontend/screenshots/m6/`; se conserva la evidencia histórica M4/M5 original.

Los primeros ensayos de navegador no se contabilizan como PASS: hubo recargas de
next dev durante compilación concurrente (77/80 públicas), un selector que contaba
el `role=alert` del anunciador de rutas de Next y dos subcasos M4 cancelados al
superar el plazo del padre. Se prepararon rutas antes de abrir contextos, se
acotó el selector a la alerta real y se comprobó la bandeja recuperada; repetición
completa y secuencial 80/80 y 18/18 sin omitidas. No se rebajaron aserciones de
negocio ni se reintentaron acciones financieras para conseguir el resultado.
Los fallos iniciales del arnés de backup se corrigieron: variables PG heredadas,
selección explícita de DB para pg_restore y nombre SQL ticket_quantity.

Auditoría de producción `pnpm audit --prod --json`: cero avisos, 251 dependencias.
La auditoría completa incluye un aviso moderado de minimatch 10.2.6 en
`typescript-eslint > @typescript-eslint/typescript-estree`; no hay avisos altos
ni críticos. El fix publicado requiere minimatch >=11.0.1, fuera del major
solicitado por esa herramienta. No se fuerza un override incompatible: revisar
actualización del proveedor de lint, mantener patrones de herramientas bajo
control del repositorio y el timeout de CI. No está en dependencias productivas.
[Aviso oficial](https://github.com/advisories/GHSA-g3hv-75wg-m249).
Asesor de seguridad Supabase consultado en solo lectura: persisten los tres WARN
históricos; no hay cambios de permisos remotos por esta consulta:

- `public.rls_auto_enable` ejecutable por anon: [remediación oficial](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable).
- La misma función ejecutable por authenticated: [remediación oficial](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).
- Protección de contraseñas filtradas desactivada: [configuración oficial](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

El propietario no ha elegido hosting ni CAPTCHA y solicitó sugerencias:
[opciones verificadas](OPCIONES_HOSTING.md). Aún faltan su selección, claves,
protección de borde/origen, identidad de proxy, alarmas con destinatario real y
ensayo autorizado con Auth/Storage reales. No hay resistencia DDoS certificada,
revisión humana con lector de pantalla/dispositivos físicos ni política legal de
retención aprobada. Estos puntos impiden declarar M6 completo o ventas habilitadas.

## Reproducir en Windows

Desde raíz, PostgreSQL 18 instalado en este equipo:

```powershell
powershell -NoProfile -File scripts/test-backend-local.ps1 -PgBin 'C:/Program Files/PostgreSQL/18/bin' -PasswordAuthentication -Port 54347 -TestScript test:integration
powershell -NoProfile -File scripts/test-backend-local.ps1 -PgBin 'C:/Program Files/PostgreSQL/18/bin' -PasswordAuthentication -Port 54348 -TestScript test:resilience
powershell -NoProfile -File scripts/test-backend-local.ps1 -PgBin 'C:/Program Files/PostgreSQL/18/bin' -PasswordAuthentication -Port 54349 -TestScript test:m4
powershell -NoProfile -File scripts/test-backend-local.ps1 -PgBin 'C:/Program Files/PostgreSQL/18/bin' -PasswordAuthentication -Port 54349 -TestScript test:m5
npm run test:e2e --workspace @sorteos/web
```

M4/M5 comparten puerto web de pruebas 3115: ejecutarlos secuencialmente. El runner
restaura el entorno del proceso, quita la contraseña temporal y detiene el cluster.
Las herramientas de backup requieren TEST_PG_BIN en Windows (el runner lo fija)
o pg_dump/pg_restore compatibles en PATH; falta de infraestructura falla el test.
Los reportes JSON no incluyen URL de DB ni credenciales; dumps DEMO quedan en .tmp.

Para repetir la regresión integrada en una sola ejecución, usar el mismo runner
con `-TestScript test:m6`: integra SQL, M4, M5 y navegador público secuencialmente.
En esta sesión se verifican también sus componentes por separado para diagnosticar
fallos sin ocultar ni omitir escenarios.
