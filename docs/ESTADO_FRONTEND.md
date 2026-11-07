# Estado del frontend

M5: resumen, editor/listado de rifas, fotografías propias, acciones de publicación/cierre y reportes conectados a NestJS. Consulta de cliente protegida reutilizada. Ver [ESTADO_M5.md](ESTADO_M5.md) para verificaciones actuales y límites; lo que sigue es histórico.

Consolidación documental: 2026-11-05. Fuente única de estado del frontend; reúne los informes de F0 y F1 y referencia las entregas F2–F4 integradas sin eliminar sus evidencias, incidencias ni pendientes.

**Coordinación vigente:** seguir [PLAN_DESARROLLO.md](PLAN_DESARROLLO.md), con backend y frontend en una sola sesión y carpeta. M5 integra operación diaria sobre M4; [ESTADO_M5.md](ESTADO_M5.md) registra resultados actuales y límites remotos. Las indicaciones históricas sobre ramas/worktrees por capa ya no son el modo de trabajo vigente. La verificación local no certifica el proyecto remoto.

## M4

Ampliación posterior solicitada por el propietario, 2026-11-06: el perfil completo de desarrollo abre administración sin TOTP cuando la API confirma la capacidad vigente. La web comunica el vencimiento y conserva login/rol/sesión reales. Se probaron compra con archivo privado local y aprobación desde navegador; el formulario real de 3000 creó una orden DEMO pendiente para el propietario. La ventana actual y resultados se documentan en [prueba completa](DESARROLLO_PRUEBA_COMPLETA.md); el párrafo siguiente conserva el alcance inicial de login solamente.

Prueba temporal de login solicitada el 2026-11-06: acceso AAL1 a confirmación protegida sin TOTP, limitado a desarrollo local y con vencimiento automático; datos/acciones financieras conservan MFA. Ver [ADR 0017](decisions/0017-local-login-trial.md). Verificación actual: 45/45 web, 15/15 integración M4 y lint/typecheck/build web aprobados. Sin cambio remoto de Auth ni uso de credenciales personales del propietario.

Diagnóstico posterior del login, 2026-11-06: el mensaje genérico ocultaba un 503 por permisos efectivos de la sesión Auth. Se distinguen indisponibilidad, error interno y red; la corrección de sesión fue autorizada y aplicada, con verificación real bajo runtime aprobada. No se declara login/TOTP personal completado: corresponde reintentarlo en el navegador. Ver [corrección de acceso](ADMIN_AUTH_CORRECCION.md).

Activación operativa 2026-11-06: web local en modo live con Auth configurado, API en 3001 y B3–B5 aplicadas en Supabase con permiso del propietario. Formulario habilitado y protección anónima verificados en Chromium contra la instancia de 3000. El login personal y la inscripción TOTP real del OWNER aún deben comprobarse; Storage real sigue pendiente. Ver [detalle de activación](MIGRACIONES_SUPABASE_B3_B5.md). La evidencia de integración con proveedores locales que sigue conserva su alcance original.

Implementación y verificación local: 2026-11-05. Administración F5 conectada con B5 en la carpeta principal. Sin validación de staging/producción ni despliegue.

### Alcance

- Login real de Supabase Auth solo en servidor, sesión HttpOnly/Strict, Secure bajo HTTPS, renovación en Route Handler, logout y TOTP reciente. Inscripción inicial del autenticador sin registro público ni recuperación que omita MFA.
- `/admin/ordenes`: filtros de estado/rifa/fechas, paginación y lista sin PII. `/admin/ordenes/[id]`: comprador, números, reporte, historial/incidencias y visor privado por proxy B5.
- Decisiones de revisión, aprobación OWNER, requerimiento de resolución y cancelación conciliada con tres modalidades. Confirmación explícita, importes enteros exactos y fecha local dominicana; no se realizan transferencias.
- Payload/UUID fijados para reintentos tras respuesta ambigua; 409 exige actualizar detalle. Requerir resolución mantiene RESERVED; aprobar convierte SOLD y cancelar tras conciliación libera q, conservando historial.
- Autorización real en cada solicitud y verificación periódica/al retomar pestaña. Cambio de autenticación descarta estado del cliente; páginas y comprobantes sin caché pública, noindex/no-referrer. Sin tokens en props, URL o almacenamiento JavaScript.
- Endpoint adicional de sesión en NestJS, OpenAPI/cliente 0.5.1. Sin migraciones o modificaciones de servicios remotos. [ADR 0012](decisions/0012-m4-admin-web-session.md).

### Configuración y operación

Seguir [README web](../apps/web/README.md): variables `SUPABASE_URL` y `SUPABASE_PUBLISHABLE_KEY` del mismo proyecto de la API, solo en servidor. Se rechazan claves secretas/service_role. Acceso mediante `/admin/login` con usuario previamente provisionado y allowlist activa. B3–B5 y permisos de metadatos Auth deben existir en el entorno utilizado.

La sesión vencida al abrir una página vuelve al login; «Continuar sesión existente» renueva sin mutar cookies durante render. Logout que no consigue revocación remota elimina credenciales locales y muestra un aviso explícito. Credenciales/TOTP se introducen únicamente en la aplicación, nunca por chat.

### Evidencia y pendientes

| Comando/control de esta sesión | Resultado |
|---|---|
| `npm run generate:api` | PASS, OpenAPI y cliente 0.5.1 |
| `npm run api:check-catalog --workspace @sorteos/web` | PASS, sin rutas públicas faltantes |
| `npm run lint` y `npm run lint --workspace @sorteos/web` | PASS, sin advertencias de lint |
| `npm run typecheck` | PASS, API, web y cliente |
| `npm run build` (live/production, API de ejemplo HTTPS, Auth no configurado) | PASS, API, Next.js y cliente; no contacta servicios remotos |
| `npm run test:config` y `npm test` | PASS, 9 y 13 pruebas de backend |
| `npm run test:core --workspace @sorteos/web` | PASS, 6 pruebas |
| `npm run test --workspace @sorteos/web` | PASS, 42 pruebas, incluidas 8 nuevas de M4 |
| Runner PostgreSQL SCRAM, `-Port 54345 -TestScript test:payments` | PASS, 18/18 financieras y sesión, 0 omitidas |
| Runner PostgreSQL SCRAM, `-Port 54346 -TestScript test:m4` | PASS, 14/14 (13 escenarios y contenedor), 0 fallos/canceladas/omitidas; duración total 256366.5999 ms |
| `npm run test:e2e --workspace @sorteos/web`, seguido de `-- --last-failed` | 80 escenarios distintos finalmente verificados: 75 en pasada completa, 3 en primera repetición y 2 en repetición final; no se declara una pasada única 80/80 |
| Axe A/AA, detalle administrativo móvil y capturas | PASS automatizado, sin desbordamiento a 360 px; Chromium, Firefox y WebKit móvil ejecutados |
| Búsqueda de `SUPABASE_STORAGE_KEY`, `sb_secret_`, `SUPABASE_PUBLISHABLE_KEY`, `refresh_token` en JS público de producción | Sin coincidencias; no sustituye una auditoría completa |
| `git diff --check` | PASS; avisos CRLF/LF en tres páginas públicas preexistentes, sin errores de whitespace |

Los comandos del runner usan `powershell -NoProfile -File scripts/test-backend-local.ps1 -PasswordAuthentication` más los parámetros indicados. Evidencia local ignorada: `.tmp/m4-payments.txt`, `.tmp/m4-browser.txt`, `.tmp/m4-build-verified.txt`, `.tmp/m4-demo-e2e.txt`, `.tmp/m4-demo-e2e-retry.txt`, `.tmp/m4-demo-e2e-final.txt`. Los resultados financieros, unitarios y de navegador se mantienen separados; no se suman como una única suite.

La regresión pública inicial tuvo cinco fallos de sincronización bajo compilación fría/carga concurrente. Se conservaron sus criterios: esperar redirección/navegación real y carga/hidratación, con presupuesto de test de 60 s para el servidor aislado. Tras repetir solo los fallidos, los cinco pasaron. No se eliminó ningún escenario ni se certificó un SLA de rendimiento.

La prueba de fallo del proveedor durante logout detectó cookies reescritas por lecturas pendientes. Se corrigió el producto: lecturas sin renovación no escriben credenciales y una barrera HttpOnly de cierre impide reabrir la sesión local con tokens de respuestas tardías; solo un login nuevo elimina esa barrera. La suite final conserva la comprobación de borrado de credenciales y simula su reaparición para exigir 401. Se verificaron además inscripción TOTP y renovación de token expirado.

Las pruebas integradas ejecutan Next.js, NestJS, PostgreSQL y JWT/JWKS reales con adaptadores HTTP locales Auth/Storage. Se crea una copia temporal de la web en `.tmp`, puerto 3115, para conservar el servidor existente en 3000. Los errores iniciales del harness (arranque, lock compartido y selectores de diálogos ocultos) se corrigieron sin rebajar las comprobaciones. Webpack se usa para servidores de prueba aislados; el build de producto conserva su configuración.

Capturas locales: [detalle escritorio](frontend/screenshots/m4/detalle-desktop.png), [detalle móvil 360 px](frontend/screenshots/m4/detalle-mobile.png), [Firefox](frontend/screenshots/m4/detalle-firefox.png), [WebKit móvil](frontend/screenshots/m4/detalle-webkit-mobile.png). Revisada visualmente la captura móvil; axe no sustituye una revisión humana con lector/dispositivo físico.

Pendiente de entorno autorizado: Auth/Storage del proyecto real, inscripción/uso del OWNER real y migraciones remotas B3–B5. El resultado local no acredita staging/producción. CI remoto, despliegue y controles de borde no ejecutados. Editor de rifas, dashboard agregado, CSV y cierre corresponden a M5; no hay sorteo ni ganador.

## Resumen del último estado documentado

| Fase | Alcance | Verificación registrada | Pruebas aprobadas registradas |
|---|---|---|---|
| [F0](#f0) | Armazón Next.js, componentes, configuración y navegación accesible | 2026-10-29, local | 6 de núcleo, 3 de UI y 15 E2E Chromium |
| [F1](#f1) | Sistema visual, catálogo y detalle DEMO, galería, filtros y ayuda | 2026-10-29, local | 6 de núcleo, 6 de componentes y 39 E2E Chromium |
| [F2](frontend/ESTADO_F2.md) | Catálogo y detalle reales B2 | Incorporado 2026-11-05 | Ver integración actual |
| [F3](frontend/ESTADO_F3.md) | Pre-reserva temporal B3 | Incorporado 2026-11-05 | Ver integración actual |
| [F4](frontend/ESTADO_F4.md) | Formulario con comprobante y confirmación B4 | Incorporado 2026-11-05; flujo local comprobado en M4 | Ver M4 |
| [F5 / M4](#m4) | Auth/TOTP, revisión administrativa y visor privado B5 | 2026-11-05, local | 42 web y 14 integración M4; 18 financieras por separado |

La carpeta principal incorpora el frontend F2–F4 de feat/frontend-f4 y ahora F5/M4 sobre el backend B5. Incluye catálogo real, pre-reserva, formulario único con comprobante, confirmación protegida y revisión administrativa. Ver [M4](#m4) para pruebas actuales y [registro de incorporación](#integracion-f4) para su contexto; las evidencias históricas siguientes no equivalen a pruebas repetidas.

Los resultados de cada fase son históricos y no se suman ni se consideran repetidos durante esta consolidación. Los informes locales F0/F1 registran su CI como no ejecutado; el cierre B0 del backend documenta posteriormente CI Backend y Frontend aprobados en la rama B0 el 2026-11-01. Eso no acredita un CI posterior de F1. Siguen pendientes revisión humana de accesibilidad, dispositivos físicos y configuración remota; F5 está implementado y validado localmente en M4. Las verificaciones de integración actuales se registran por separado.

## Cómo leer y mantener este documento

Los apartados por fase conservan sus fechas, condiciones y limitaciones. Los pendientes y la «siguiente fase» dentro de F0 corresponden a ese momento; F1 documenta el avance posterior. Actualizar este archivo al cerrar nuevas fases, junto con el resumen y los pendientes.

Se mantienen como documentos especializados el [plan](PLAN_FRONTEND.md), la [guía visual](frontend/GUIA_VISUAL.md), el [diseño F1](frontend/DISENO_F1.md), los [activos F1](frontend/ASSETS_F1.md), las [decisiones](decisions/), el [README web](../apps/web/README.md) y su [changelog](../apps/web/CHANGELOG.md). Las capturas y la medición permanecen en frontend/.

## F0

Estado: validado localmente. Alcance: armazón frontend F0; no implementación F1–F8. Código en apps/web. Decisiones en docs/decisions/0002-frontend-f0.md.

### Instalación y coordinación

- Se conserva feat/backend-b0. No se creó commit/worktree desde esta sesión. La separación de ramas sigue pendiente de coordinación y permisos Git.
- Instalación desde raíz verificada con pnpm 10.28.2 y --frozen-lockfile, mediante el paquete JavaScript disponible en .tmp/backend-tooling. No se cambiaron versiones ni se habilitaron globalmente scripts opcionales de dependencias.
- Chromium 1248, Headless Shell, FFmpeg y Winldd descargados para Playwright en .tmp/playwright-browsers, mediante acceso de red autorizado.
- docs/openapi.json y packages/api-client/src/generated.ts generados desde NestJS con npm run generate:api. No se inventó otro contrato ni se accedió a una base de datos.
- La primera generación encontró dos parámetros sin tipo en apps/api/src/bootstrap.ts. El usuario autorizó corregirlos, pero otra sesión ya había aplicado los tipos al releer el archivo. Esta sesión no editó código de backend.
- Cambios de esta sesión: apps/web, documentos frontend, ADR 0002 y workflow frontend. Next.js actualiza automáticamente next-env.d.ts durante la compilación.

### Comandos y resultados reales

Los comandos npm se ejecutaron desde la raíz. El prefijo de la instalación fue node .tmp/backend-tooling/node_modules/pnpm/bin/pnpm.cjs.

| Criterio / comando | Resultado | Evidencia |
| --- | --- | --- |
| pnpm install --frozen-lockfile | PASS | Instalación completada respetando el lockfile |
| npm run generate:api | PASS | Exportación NestJS y openapi-typescript completadas |
| npm run lint --workspace @sorteos/web | PASS | ESLint sin advertencias |
| npm run typecheck --workspace @sorteos/web | PASS | TypeScript estricto sin errores |
| npm run test:core --workspace @sorteos/web | PASS | 6 tests: entorno, moneda, fechas y errores |
| npm run test --workspace @sorteos/web | PASS | 3 tests: input accesible, botón deshabilitado y toast |
| npm run build --workspace @sorteos/web | PASS | Next.js 16.4.3, API_MODE=live, APP_ENV=production; 6 páginas generadas |
| npm exec --workspace @sorteos/web -- playwright install chromium | PASS | Descargas completadas dentro del workspace |
| npm run test:e2e --workspace @sorteos/web | PASS | 15 tests Chromium, 36.5 s, 0 fallos en ejecución final |
| axe WCAG 2 A/AA y 2.1 AA | PASS automatizado | Sin infracciones detectadas en /, /rifas y /admin/login a 360/768/1280 px |
| Responsive y navegación | PASS | Sin desbordamiento horizontal, navegación por teclado y regreso al inicio |
| Admin y 404 | PASS en alcance F0 | /admin redirige al placeholder, sin campos de credenciales; ruta inexistente devuelve 404 |
| Capturas | PASS | 9 archivos en docs/frontend/screenshots: inicio, catálogo y admin por cada viewport |
| CI remota | SKIPPED | Workflow preparado con frozen-lockfile; no se ejecutó ni observó GitHub Actions |

Para reproducir descarga y E2E en esta máquina, establecer PLAYWRIGHT_BROWSERS_PATH con la ruta absoluta del workspace seguida de .tmp/playwright-browsers. Ver apps/web/README.md.

### Problemas encontrados y corregidos

- La instalación inicial estaba bloqueada por EACCES/EPERM; ahora las dependencias están disponibles y verificadas.
- ESLint rechazó la exportación anónima de PostCSS; se asignó un nombre a la configuración.
- La primera suite de navegador aprobó 12 tests y detectó 3 fallos de contraste en portada: el pie de la ilustración se superponía al boleto oscuro. Se añadió un fondo legible y la suite completa posterior aprobó los 15.
- El cierre del servidor de la primera ejecución quedó detenido por permisos Windows. Se cerraron únicamente los procesos de prueba identificados. La ejecución final contó con permisos para manejar sus procesos, terminó con código 0 y cerró el servidor.
- Playwright usa npm run dev y 127.0.0.1 para evitar el ejecutable global pnpm y ambigüedades IPv6. Se declaró data-scroll-behavior en html para Next.js.

### Limitaciones y siguiente fase

Validación limitada a F0 local con fixtures vacíos y Chromium. Axe no sustituye revisión humana con lector de pantalla; Safari/Firefox no se probaron. Autenticación real, catálogo integrado, checkout, comprobantes y pagos pertenecen a fases posteriores. No se desplegó, no se aplicaron migraciones ni se modificaron datos productivos.

Siguiente fase: F1, componentes de catálogo y detalle con fixtures explícitos. La integración real del catálogo F2 requiere B2. Antes de ampliar alcance, coordinar rama/worktree independiente con backend.

---

## F1

Fecha: 2026-10-29. Alcance: F1 visual, con datos demo explícitos; sin integración F2 ni compra F3–F4. Guía aprobada por el propietario mediante «Puedes empezar a trabajar».

### Cambios entregados

Se aplicó el sistema visual oscuro y dorado con fotografía conceptual, títulos serif y componentes compartidos. Inicio presenta el premio principal, dos tarjetas y la explicación del proceso. El catálogo permite buscar por premio/categoría sin depender de tildes, filtrar estados y recuperar resultados vacíos. El detalle contiene galería funcional, precio, inventario diferenciado, cantidad de vista previa y reglas. En móvil se priorizan precio y estado antes de las reglas extensas; en escritorio el panel va en una columna lateral.

La navegación móvil tiene Inicio/Rifas/Ayuda y un menú desplegable. En detalle se sustituye por una acción para llegar al resumen. Ayuda utiliza preguntas desplegables accesibles. Login mantiene la explicación de acceso no habilitado y no captura credenciales.

Los cinco fixtures cubren cupo, pausa, agotamiento y cierre. El agotamiento con reservas conserva 70% de vendidos confirmados, sin presentarlo como 100% vendido. La cantidad local no reserva ni calcula cobros; no se envían órdenes. Los importes y fotografías están marcados como DEMO. Live no importa fixtures para mostrarlos y mantiene el catálogo en preparación.

### Archivos y decisiones

- Interfaz y componentes: apps/web/src/app, components y features/raffles.
- Fixtures: apps/web/src/fixtures/catalog.ts, modelo de presentación separado de DTOs.
- Activos: apps/web/public/images/demo, tres imágenes originales generadas con imagegen incorporada. Prompts y procedencia en ASSETS_F1.md.
- Pruebas: apps/web/tests/raffles.test.tsx y tests/e2e/catalog.spec.ts; foundation.spec.ts ampliado.
- Configuración local: .env.local creado desde el ejemplo solo si no existía; ignorado por Git. No se sobreescribió configuración del usuario.
- Documentos: GUIA_VISUAL.md actualizada con aprobación, DISENO_F1.md, ASSETS_F1.md, README/CHANGELOG web y ADR 0003.
- Dependencias, backend, esquema de datos, OpenAPI y cliente compartido: sin cambios en esta fase. No hay migraciones ni despliegue.

### Verificación

Comandos desde la raíz, con Node 24 y dependencias del lockfile existente:

| Control | Resultado | Evidencia |
| --- | --- | --- |
| npm run lint --workspace @sorteos/web | PASS | Sin advertencias |
| npm run typecheck --workspace @sorteos/web | PASS | TypeScript estricto |
| npm run test:core --workspace @sorteos/web | PASS | 6 tests de entorno, moneda, fecha y errores |
| npm run test --workspace @sorteos/web | PASS | 6 tests de componentes y consistencia de fixtures |
| npm run build --workspace @sorteos/web | PASS | Next.js 16.4.3; rutas públicas, ayuda y detalle dinámico |
| npm run test:e2e --workspace @sorteos/web | PASS | 39 tests Chromium en 360/768/1280 px |
| axe WCAG 2 A/AA y 2.1 AA | PASS automatizado | Inicio, catálogo, detalle, ayuda y login sin infracciones detectadas |
| Navegación y estados | PASS | Teclado, menú, filtros, búsqueda, galería, cantidad inválida, pausa/cierre/agotamiento y 404 de ruta inexistente |
| Producción live sin demos | PASS | Servidor temporal en 3101: portada y catálogo no muestran datos ficticios; slug demo no revela su contenido |
| Capturas | PASS | 15 imágenes en screenshots/f1, conservando las de F0 |
| Observación local de rendimiento | Registrada | PERFORMANCE_F1.json; no es una puntuación Lighthouse |
| CI remota | SKIPPED | No se lanzó ni observó GitHub Actions |
| Safari/Firefox y dispositivo físico | SKIPPED | La ejecución observada utiliza Chromium local |

Para build se fijaron API_MODE=live, APP_ENV=production y API_BASE_URL=https://api.example.test/api/v1 únicamente en el proceso de comprobación. La URL es de ejemplo y no se consulta en F1. El servidor temporal de producción se cerró al terminar. El servidor demo del usuario en 3000 se conservó abierto.

Para E2E se reutilizó el servidor existente con PLAYWRIGHT_REUSE_SERVER=1 después de comprobar respuesta 200, banda DEMO y nuevo diseño. Los smoke tests verifican también esa banda. PLAYWRIGHT_BROWSERS_PATH apuntó a .tmp/playwright-browsers dentro del workspace. La CI conserva por defecto un servidor propio configurado mock/test.

### Evidencias visuales

| Pantalla | Móvil 360 px | Escritorio 1280 px |
| --- | --- | --- |
| Inicio | [Captura](frontend/screenshots/f1/inicio-mobile.png) | [Captura](frontend/screenshots/f1/inicio-desktop.png) |
| Catálogo | [Captura](frontend/screenshots/f1/catalogo-mobile.png) | [Captura](frontend/screenshots/f1/catalogo-desktop.png) |
| Detalle | [Captura](frontend/screenshots/f1/detalle-mobile.png) | [Captura](frontend/screenshots/f1/detalle-desktop.png) |
| Ayuda | [Captura](frontend/screenshots/f1/ayuda-mobile.png) | [Captura](frontend/screenshots/f1/ayuda-desktop.png) |
| Login | [Captura](frontend/screenshots/f1/admin-mobile.png) | [Captura](frontend/screenshots/f1/admin-desktop.png) |

También se conservan las cinco capturas a 768 px en la misma carpeta.

### Medición local

La portada se observó con Chromium en tres contextos nuevos, sin throttling y con servidor/optimizador ya calentados por E2E. Se registraron FCP de 532/392/260 ms y candidatos LCP de 532/808/860 ms para 360/768/1280 px respectivamente. Son muestras locales de desarrollo, no estimaciones de rendimiento en teléfonos reales ni resultados Lighthouse. El JSON conserva condiciones, tamaños de imagen observados y tiempos; el script apps/web/scripts/measure-ui.mjs permite repetir la observación.

### Incidencias y límites

La primera ejecución encontró un selector de test que coincidía tanto con el error de cantidad como con el anuncio de navegación de Next.js. Se corrigió para verificar la descripción accesible del input, sin quitar ni rebajar la validación. La suite completa posterior pasó. La revisión visual motivó acercar precio y disponibilidad al inicio del detalle móvil y volver a comprobar su composición.

No hay bancos, premios reales, fechas de sorteo o ganadores anunciados. Las imágenes son ilustraciones originales; la tipografía usa fuentes de sistema. No se implementaron favoritos, perfiles ni autenticación simulada. La lectura humana con tecnologías de asistencia y los controles de producción/staging corresponden a verificaciones posteriores; axe no los sustituye.

F1 no integra datos reales: la siguiente fase es F2, dependiente del catálogo B2. Compra, carga de comprobante y confirmación protegida requieren B3/B4 y sus fases frontend. No se alteró la rama backend ni se creó commit desde esta sesión.


<a id="integracion-f4"></a>
## Integración F2–F4 en la carpeta principal — 2026-11-05

Se incorpora el trabajo de feat/frontend-f4 (f0da3a7), incluyendo F2 y F3, a la raíz que contiene B5 (60736fb). Se conservan los cambios pendientes de la sesión documental y los archivos originales de la otra carpeta, incluida su ADR F004 y el script de inicio. No se modifican migraciones ni entornos remotos. No se declara completado F5.

Referencias históricas importadas: [F4](frontend/ESTADO_F4.md), [F2](frontend/ESTADO_F2.md), [F3](frontend/ESTADO_F3.md), [ADR F4](decisions/F004-order-receipt-form.md). Sus rutas a worktrees son contexto histórico; el inicio vigente es npm run dev:web desde raíz, puerto 3000.

Estado de este registro al incorporarse: verificaciones en curso. La sesión M4 posterior comprobó el flujo integrado local; ver [resultados M4](#m4).


## Seguimiento histórico F1 importado

## Actualización de cierre — 2026-11-01

Trabajo en feat/frontend-f2, dentro de .tmp/frontend-f2, sin modificar feat/backend-b0. Se completaron controles pendientes de navegadores y se confirmó la CI remota del commit base.

| Control actual | Resultado |
| --- | --- |
| Lint, typecheck y build producción live | PASS |
| Tests unitarios/componentes | 13 aprobados, incluidos cliente HTTP y recuperación |
| Tests de núcleo | 6 aprobados |
| E2E | 70 aprobados, 0 omitidos, 1.5 minutos |
| Motores | Chromium 360/768/1280 px; Firefox 1280 px; WebKit móvil 390 px |
| Accesibilidad automática | Axe A/AA en inicio, catálogo, detalle, ayuda y login en los cinco perfiles |
| CI base 8b66eb6 | [Frontend exitoso](https://github.com/OmarUrena/app1/actions/runs/41308070025), [Backend exitoso](https://github.com/OmarUrena/app1/actions/runs/41308070038) |
| CI de esta rama nueva | Pendiente de publicarse/integrarse; la CI base no la sustituye |
| Safari en iPhone físico / lector de pantalla humano | No ejecutado; requiere dispositivo/revisión humana |

La ampliación detectó pérdida de la primera búsqueda antes de hidratación y diferencias de foco/tabulación. Se protegieron los controles hasta instalar sus handlers, se añadió tabIndex=0 al enlace de salto y se retiró el scroll suave global. Una regresión retiene los scripts de red y verifica que el buscador no acepte entrada prematura. Las pruebas de teclado no se eliminaron ni se rebajaron. También se priorizó la primera fila de imágenes y se comprobó retry del error boundary.

Evidencia: [inicio WebKit móvil](frontend/screenshots/f1-followup/inicio-webkit-mobile.png), [catálogo WebKit móvil](frontend/screenshots/f1-followup/catalogo-webkit-mobile.png), [detalle Firefox](frontend/screenshots/f1-followup/detalle-firefox-desktop.png). f1-followup conserva diez capturas adicionales.

F1 queda verificado localmente dentro de estos límites. F2 requiere B2: ver [ESTADO_F2.md](frontend/ESTADO_F2.md). No se habilitaron compras, transferencias ni autenticación. Las secciones siguientes conservan el registro original.
# Actualización integrada M6 — 2026-11-07

Web con mensajes de indisponibilidad y origen administrativo rechazado sin
eliminar sesión válida. Cliente 0.7.0 y 50/50 pruebas unitarias locales aprobadas.
La regresión de navegador añade recuperación de 429/503/red y métricas de carga,
CLS/LCP observadas durante QA. Sus resultados finales y límites están en
[ESTADO_M6.md](ESTADO_M6.md); no sustituyen staging real ni dispositivos físicos.
