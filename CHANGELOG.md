# Changelog

## Bucket privado de comprobantes — 2026-11-14

- Detectado `receipts` ausente en Supabase Rifas: la API devuelve `STORAGE_UNAVAILABLE` cuando no puede verificar el bucket privado antes de subir el archivo.
- Creado mediante Storage API con `public=false`, límite de 5 MiB y MIME JPG/PNG/PDF; configuración confirmada mediante SDK y consulta de metadatos. El proxy Vercel conserva su límite de 4 MiB.
- Sin cambios de código, esquema, contrato ni despliegue; sin crear órdenes o subir comprobantes de prueba. Queda pendiente verificar el envío desde Vercel con sus propias credenciales. Evidencia y recuperación en ADR 0038.

## Proxy de compra opcional para Vercel — 2026-11-11

- `CHECKOUT_PROXY_ENABLED` activa el transporte bajo el dominio web para sesión, cupos, órdenes y consulta por teléfono; `false` conserva la conexión directa para dominios del mismo sitio.
- Cookie invitada privada, CSRF, idempotencia y límites por cliente conservados. Identidad de red firmada entre servidores con `CHECKOUT_PROXY_SECRET`, sin confiar globalmente en cabeceras reenviadas ni exponer claves al navegador.
- Relay limitado a rutas públicas de invitado, sin reintentos de escritura; multipart y errores preservados. En Vercel, archivos limitados a 4 MiB para dejar espacio al formulario.
- Variables y transición a dominio propio documentadas; pruebas de relay, firma y controles de NestJS, más recorrido integrado local reproducible. Sin migraciones, despliegue ni escrituras remotas.

## Optimización de visualización de imágenes — 2026-11-09

- Versiones responsive desde 360 px, límite superior de 1920 px y tamaños ajustados a la portada y galería. Evita la descarga mínima anterior de 640 px para imágenes que se muestran a unos 350 px en móviles de densidad 1x.
- Solo la primera tarjeta del catálogo recibe prioridad alta; se conservan WebP, carga diferida, galería sin recorte y estados de error. Sin cambios en comprobantes, subida de archivos, datos remotos ni contrato.
- Misma imagen WebP en portada de 390 px/1x: 42002 a 20298 bytes (51.7% menos), al seleccionar 360 en lugar de 640 px. Es ahorro de bytes de esa imagen, no de tiempo global. Lint/tipos/build, 65 unitarias y 27 E2E Chromium móvil/tablet/escritorio aprobados.

## Limpieza local posterior a etapa 7 — 2026-11-09

- Eliminados 221 destinos y 127783 archivos desechables (12.27 GiB de contenido lógico): 68 copias aisladas de navegador, 78 clústeres de prueba detenidos, cachés y temporales acumulados. Se conservan dependencias, aplicación activa, configuración privada, respaldos, Storage local y evidencia útil.
- Añadido `npm run clean:local`: revisión sin borrado por defecto y aplicación explícita con `-- -Apply`, límites de ruta, protección de archivos versionados/procesos y eliminación de junctions sin seguir destinos.
- Verificación posterior: revisión de limpieza sin candidatos; `verify:delivery` PASS; dependencias, navegadores y rutas protegidas presentes; API y web HTTP 200. Sin cambios de negocio ni datos remotos.

## Etapa 7 — Regresión y entrega local — 2026-11-09

- Regresión de inventario, objetivo, bendecidos, lotería, entregas, consulta y compra; tres casos adicionales cubren extremos, capacidad, reintentos, cancelación/reasignación y elegibilidad congelada.
- Corregidos el watcher ante escrituras intermedias de archivos, conteos de recuperación SQL y selectores/formato de fecha de recorridos históricos. Sin cambios en transiciones financieras ni ampliación de sus timeouts.
- Scripts reproducibles, CI para recorridos integrados y control de artefactos públicos; capturas actuales en .tmp para conservar evidencia histórica.
- README, contrato y planes alineados con consulta censurada por teléfono y estado por orden, sin OTP. OpenAPI/cliente 0.12.0 conservados; sin migraciones ni variables nuevas. Resultados, incidencias y pendientes externos en docs/AJUSTES_NEGOCIO_FASE_7.md; sin despliegue ni escrituras remotas.

## Etapa 6 — Compra pública simplificada — 2026-11-08

- Comprar condicionado a estado, fechas y cupo mínimo de la API; catálogo con imagen, precio y progreso. Detalle sin cantidad de vista previa y con reglas/información ampliada desplegables.
- Compra en una columna, cuentas copiables visibles, formulario único con comprobante obligatorio y errores contextuales; Enviar orden conserva idempotencia y recuperación.
- Confirmación con estado real, números y bendecidos antes del resumen secundario, más acceso a consulta. Tema público reversible conservado.
- OpenAPI/cliente 0.12.0; sin migraciones ni variables nuevas. Evidencia en docs/AJUSTES_NEGOCIO_FASE_6.md.


## Estado de orden en consulta pública — 2026-11-08

- La consulta censurada por teléfono muestra estado y cantidad de cada orden no cancelada, separando compras con estados diferentes y conservando el total de boletos.
- Contrato/cliente 0.11.1; sin identificadores públicos nuevos, datos bancarios ni cambios de esquema.


## Migración autorizada de etapa 5 — 2026-11-08

- Aplicada solo la migración de consulta censurada en Supabase Rifas, con autorización expresa. Archivo alineado a la versión remota `20261109024246`, SQL intacto.
- Conteos y huellas de rifas/clientes/órdenes/boletos preservados; RLS, cuatro políticas, tres índices y acceso runtime verificados. Sin nuevos avisos de seguridad.
- Readiness, listado y búsqueda sintética sin coincidencias responden 200. Sin compras, pagos, comunicaciones ni despliegue. Evidencia en docs/AJUSTES_NEGOCIO_FASE_5.md.

## Etapa 5 — Consulta pública censurada — 2026-11-08

- Por decisión del propietario, búsqueda por rifa y teléfono sin OTP: nombre y correo censurados en servidor y cantidad de boletos no cancelados. No concede acceso a órdenes, números, pagos ni comprobantes.
- UI conectada, paginación, estados reales, acceso móvil/escritorio y aviso de privacidad actualizado.
- Límites durables por IP/teléfono con HMAC, auditoría sin PII, migración e índices aditivos, recuperación y OpenAPI/cliente 0.11.0. Evidencia y límites en docs/AJUSTES_NEGOCIO_FASE_5.md.


## Resultado manual en un campo — 2026-11-08

- Registro administrativo con un único número de cinco cifras y conservación de ceros iniciales. Validación de longitud y dígitos antes de enviar; adaptación compatible con API y base de datos existentes.
- Actualizados el recorrido de navegador y la prueba de envío del resultado.

## Corrección de catálogo — Migración autorizada — 2026-11-08

- Aplicada exclusivamente la migración de etapa 2 en Supabase Rifas tras autorización explícita. El catálogo pasó de HTTP 500 a 200; readiness 200.
- Preservados conteos y huellas de rifas/tickets existentes. Sin precarga de boletos, conversión de rangos o asignación de objetivos.
- Archivo local renombrado a `20261108165909_raffle_fundraising_stage2.sql` para coincidir con el historial nativo remoto; SQL idéntico. M6 permanece pendiente y no se desplegó la web.

## Ajustes de negocio — Etapa 2 — 2026-11-08

- Nuevas rifas configuran rango 00000..99999 sin crear 100000 filas. Checkout elige uniformemente posiciones libres con CSPRNG y materializa solo números de la pre-reserva; reutiliza registros liberados y conserva bloqueo, unicidad e idempotencia.
- Objetivo privado positivo y editable por OWNER mediante acción separada, con versión, motivo y auditoría de reintentos. Progreso público basado exclusivamente en PAID, truncado/limitado a 100, sin bloquear compras al alcanzarlo.
- Inventario público y gerencial derivado del universo lógico y estados ocupados; formato de cinco cifras para universos compatibles. Legacy conserva rango y filas, sin objetivos inventados.
- Nueva migración aditiva y recuperación protegida, seed DEMO virtual, OpenAPI/cliente 0.8.0, editor conectado y pruebas ampliadas. Estado, comandos y límites en docs/AJUSTES_NEGOCIO_FASE_2.md. Sin despliegue o migración remota.

## Ajustes de negocio — Fase 1 — 2026-11-08

- Inspección de fuentes y diseño: inventario de archivos, reglas AJ01–AJ11, decisiones D01–D06 y ADR 0025.
- Plan de migración aditiva con compatibilidad legacy, objetivos sin valores inventados, diagnóstico previo y recuperación sin borrar histórico.
- Hallazgos: total inmutable, ancho generado, patch limitado a DRAFT/PAUSED y recaudación actual basada en PAID; devoluciones posteriores a PAID no soportadas.
- Actualizados plan integrado y referencias técnicas, distinguiendo diseño objetivo de contrato implementado. Sin código, migraciones, cambios remotos ni pruebas funcionales ejecutadas.

## Paleta pública reversible — 2026-11-08

- Rojo, blanco y negro en la interfaz pública, con administración intacta.
- Tema original conservado; restauración con `publicTheme = "original"` en el layout público.
- Capa CSS opcional, sin cambios en API, datos, variables ni flujos de compra.

## Origen local de checkout — 2026-11-07

- Alineado el ejemplo CORS con el launcher web en 127.0.0.1:3000, conservando localhost explícito para desarrollo. Evita un 403 al crear sesión de invitado desde la dirección canónica del launcher.
- La corrección local conserva la lista de orígenes existente y añade solo el origen loopback de la web. Se mantienen la comparación exacta y el rechazo de solicitudes cross-site.

## M6 — Robustez integrada local — 2026-11-07

- Límite HTTP compartido en PostgreSQL con claves HMAC, RLS, ventana/bloqueo atómicos y limpieza acotada. HTTP_RATE_STORE=postgres obligatorio en staging/production; desarrollo/test conservan memory. Migración M6 generada por CLI oficial y aplicada solo a DB de pruebas locales; recuperación de contadores separada de historial contable.
- Liveness independiente, timeouts de transporte explícitos y proxy no confiable por defecto. Logs por categoría/estado/duración/código conocido, sin URL, cuerpos ni PII; 5xx error y 429 warning.
- Web distingue indisponibilidad. Rechazo de origen devuelve ORIGIN_NOT_ALLOWED sin eliminar una sesión válida; CSRF, MFA y allowlist se conservan. OpenAPI/cliente 0.7.0 con Retry-After documentado.
- Verificación local: 97/97 integración; repetición checkout 11/11 con HTTP compartido, 4/4 resiliencia/restore, 18/18 M4, 5/5 M5 y 80/80 E2E en Chromium/Firefox/WebKit. Base API 22/22, configuración 10/10, web 50/50 y core 6/6; lint/tipos/builds aprobados.
- Carga de 100 solicitudes y 20 reintentos: 20 holds, 80 rechazos por cupo, cero duplicados/errores inesperados, p95 hasta cabeceras 737 ms en entorno local. Backup custom restaurado transaccionalmente en otra DB con datos, RLS, permisos y restricciones verificados. Reportes sin secretos en docs/qa; 25 observaciones de navegador son QA en next dev, no SLA.
- Preparación previa de rutas y selector de alerta acotado corrigen fallos iniciales del arnés sin omitir escenarios. CI preparada para SQL/restauración y M4/M5, todavía sin ejecución remota.
- Auditoría productiva sin avisos; un moderado de minimatch en lint y tres WARN remotos conocidos permanecen documentados. M6 sigue abierto por selección de hosting/CAPTCHA, protección de borde/origen, alarmas y validación real de Auth/Storage. No se despliega ni se habilitan ventas.
- Evidencia, límites y recomendaciones de hosting en docs/ESTADO_M6.md, docs/OPERACION_SEGURA_M6.md y docs/OPCIONES_HOSTING.md.

## Presentación pública basada en Stitch — 2026-11-07

- Paleta carbón/champán, Playfair Display y Plus Jakarta Sans locales bajo SIL OFL; tarjetas, campos y botones con radios discretos, cifras tabulares y foco visible.
- Portada con introducción editorial y escenario fotográfico, catálogo en dos columnas de escritorio y una móvil; detalle, ayuda, pre-reserva y confirmación comparten materiales. Tema limitado al layout público, sin cambios administrativos, de API o de negocio.
- Imagen SUV del ZIP optimizada a WebP para la fixture DEMO; fotografías de premios reales conservadas. El export es una referencia visual, sin importar sus perfiles, saldos, certificaciones ni selección previa de números.
- Verificación: lint/typecheck web, 49/49 pruebas web y build de producción aislado correctos. 32/32 escenarios E2E en Chrome instalado, móvil/escritorio y 7/7 adicionales en tablet; incluyen axe WCAG AA, teclado, catálogo, estados y ausencia de escrituras en DEMO. No se repite la integración financiera/remota por este cambio visual.
- El intento inicial E2E no arrancó por falta del Chromium de Playwright; su descarga falló por espacio insuficiente. Se utilizó Chrome mediante configuración temporal, sin modificar las pruebas ni sus aserciones. Se retiraron cuatro archivos de caché del build aislado creado en esta sesión.
- Documentación en `docs/frontend/DISENO_STITCH.md`, ADR 0022 y capturas en `docs/frontend/screenshots/stitch/`. Sin nuevas variables, migraciones ni despliegue; M6/M7 siguen pendientes.

## Acceso administrativo fuera de la navegación pública — 2026-11-07

- Retirados los enlaces a Administración de la cabecera, el menú móvil y el pie del sitio público. El panel conserva su acceso directo en /admin/login.
- Verificado con lint/typecheck web y Chromium local en escritorio/móvil: cero enlaces administrativos en /rifas y acceso directo al login con HTTP 200.

## Administración con estructura empresarial — 2026-11-06

- Layout independiente del sitio público: navegación lateral, área de trabajo clara, títulos sans serif, controles legibles y menú móvil propio. El catálogo conserva sus URLs y presentación dentro de app/(public).
- Órdenes y rifas en tablas semánticas con paginación, estados, importes y acciones. Los filtros de rifa muestran nombres mediante consultas paginadas reales.
- Editor organizado en cuatro secciones, guardado separado de publicación, barra de acciones y motivos de bloqueo visibles. Detalle de orden, diálogos financieros, reportes, login y MFA adaptados al nuevo sistema visual.
- Sin cambios de negocio, datos o contrato; se conservan autorización, revisión bancaria e idempotencia. Evidencia actual en docs/ADMINISTRACION_VISUAL.md y ADR 0021.

## Migración M5 autorizada — 2026-11-06

- Aplicada únicamente `20261106232520_operations_m5` en Supabase tras autorización expresa, con respaldo y hashes verificados. Nueve migraciones y dry-run sin pendientes.
- Verificados trigger de cierre, función invoker sin ejecución pública, metadata de auditoría y permisos runtime. Conservadas 17 tablas RLS, una orden y su número reservado.
- Consultas M5 bajo sorteos_runtime en transacción de solo lectura: inventario coherente, dinero entero y metadata accesible. API ready 200, login web 200 y protección administrativa anónima 401. Asesores sin avisos nuevos.
- Detalle y límites en docs/ESTADO_M5.md. No se renovó la ventana temporal MFA ya vencida ni se alteraron pagos/rifas para realizar la comprobación.

## M5 — Operación diaria integrada — 2026-11-06

- Editor web de rifas con fotos propias normalizadas, reglas/versiones, fechas dominicanas, vista previa y acciones reales de publicación/pausa/reanudación/cierre.
- Indicadores consistentes y separados de inventario, órdenes pendientes, incidencias e importes confirmados; importes agregados como cadenas de enteros decimales para conservar precisión.
- Cierre irreversible PAUSED sin holds vigentes, verificado también en PostgreSQL; mantiene reservas y conciliación posterior. No se habilita DRAWN.
- CSV autorizado solo OWNER, auditado, sin PII/boletos/referencias bancarias, filtros y límite explícito de 10000 filas; protección contra fórmulas.
- Contrato/cliente OpenAPI 0.6.0, edición web con versión, privacidad/retención, nueva migración y recuperación vacía sin borrar histórico.
- Evidencia actual, comandos y limitaciones en docs/ESTADO_M5.md; continuidad exclusivamente sobre main.

## Disponibilidad administrativa durante desarrollo — 2026-11-06

- Sustituido `node --watch` por un supervisor de contenido limitado a fuentes, .env y configuraciones. Los avisos sobre dependencias/metadatos ya no interrumpen el login; una única instancia se reinicia después del cierre del hijo por cambios reales. Se conservó la web en 3000.
- Verificación real: cuatro ready 200 y lecturas de archivos con PID de API estable. Pruebas base 20/20, financieras 19/19, lint/typecheck y build API/cliente aprobados. Sin cambios de contrato o migraciones.
- Renovada la prueba completa sin TOTP hasta las 8:53 p. m. del 6 de noviembre, hora dominicana. La preparación NestJS extiende únicamente el fin de la rifa DEMO cuando se renueva, conservando precio, inventario, órdenes y auditoría. Ver ADR 0019.

## Proceso completo de desarrollo sin TOTP — 2026-11-06

- Ampliación explícita solicitada por el propietario, proyecto no productivo: login, compra con archivo privado y decisiones administrativas bajo capacidad de servidor, administrador/sesión reales y vencimiento. Se mantienen roles, snapshots, reservas, conciliación e idempotencia. La API rechaza la configuración de excepción en staging/production y orígenes externos.
- Aplicadas con respaldo/CLI oficial las migraciones `20261106203619_development_admin_access` y `20261106205731_development_demo_checkout`. Capacidad hasheada en tabla privada RLS, acceso auditado y sin permisos de lectura/escritura del runtime sobre concesiones. Ocho versiones sin pendientes, 17 tablas RLS y asesores sin avisos nuevos.
- Preparación NestJS idempotente del OWNER existente, rifa/cuenta DEMO y PDF sintético; cuenta conserva is_demo/inactiva, sin números bancarios. Checkout DEMO solo durante la capacidad y para esa rifa. Comprobantes guardados realmente fuera de public mediante adaptador privado local de desarrollo; Supabase Storage productivo sigue pendiente.
- OpenAPI/cliente 0.5.2 incorporan `developmentAccessUntil`, sin fingir MFA verificado. La web informa el modo y vencimiento; las pantallas anteriores abren órdenes con la autorización de la API. Recuperación vacía local actualizada; con datos se conserva histórico y se corrige hacia adelante.
- Corregido cierre de API al procesar PDF en Node watch: se ignoran avisos internos de dependencias del worker y se valida el resultado sin exponer entrada. Regresión reproducida con WATCH_REPORT_DEPENDENCIES.
- Verificación: 19/19 base API, 88/88 integración PostgreSQL (19 financieras), 16/16 navegador M4 y 45/45 web; lint/typecheck/builds aprobados. Formulario real en 3000 creó una orden DEMO pendiente con PDF privado y un número reservado; no se aprobó ni hubo transferencia real en remoto. Ventana actual hasta las 7:01 p. m. del 6 de noviembre, hora dominicana. Ver docs/DESARROLLO_PRUEBA_COMPLETA.md y ADR 0018.

## Prueba temporal local de login sin TOTP — 2026-11-06

- Por petición del propietario, login/renovación AAL1 conducen a una confirmación de cuenta y sesión reales sin pedir TOTP durante una ventana local. La pantalla MFA ya abierta redirige a esa confirmación al recargar.
- Configuración de servidor `ADMIN_LOGIN_WITHOUT_TOTP_UNTIL`, vacía por defecto; efectiva solo en development/test, live y web/API HTTP loopback. La configuración privada local vence a las 6:25 p. m. del 6 de noviembre, hora de Santo Domingo. Production/staging, fecha vencida o configuración ausente conservan el flujo habitual.
- Se conservan Auth, JWT, allowlist y sesión vigente. Órdenes, comprobantes y decisiones financieras siguen protegidos por MFA. No se modificaron factores, opciones Supabase, datos, API ni OpenAPI. Ver ADR 0017.
- Verificación actual: 45/45 web y 15/15 integración M4, sin omitidas. Incluye login/logout temporal en navegador y rechazo de datos/aprobación AAL1, más la regresión habitual con MFA. Lint, typecheck y build web aprobados; build probado con fecha futura y NODE_ENV production. Logs ignorados `.tmp/admin-login-test-m4.txt` y `.tmp/admin-login-test-build.txt`.
- Se iniciaron una sola web/API locales tras comprobar puertos libres. Chromium contra 3000 confirmó formulario de prueba operable y protección anónima; API ready 200. No se usó la contraseña personal del propietario. Servidores activos para su prueba, evitando iniciarlos de nuevo mientras sigan escuchando.

## Aplicación autorizada de la corrección Auth — 2026-11-06

- Autorización explícita del propietario: «Autorizo la migración». Aplicada `20261106051455_admin_auth_session_checks` con el CLI oficial, hashes revisados y respaldo previo; seis versiones confirmadas y dry-run sin pendientes.
- Comprobación real en transacción de solo lectura bajo `sorteos_runtime`: sesión OWNER válida, contextos ausentes/incorrectos rechazados y acceso directo a Auth bloqueado. Sin ampliar roles, modificar credenciales ni registrar secretos. Cero órdenes/holds/reportes y 16 tablas RLS conservadas.
- API ready 200 con DB up, login web 200 y ruta administrativa anónima 401. Asesores sin avisos nuevos; pruebas locales de la corrección conservan la evidencia de la entrada anterior. Reintento personal de login/TOTP y Storage real pendientes. Ver docs/ADMIN_AUTH_CORRECCION.md.

## Corrección del login con Auth alojado — 2026-11-06

- Identificado el fallo posterior a contraseña válida: falta de USAGE sobre el esquema Auth para el rol runtime. La verificación anterior de columnas no comprobaba ese acceso efectivo.
- Preparada migración nueva de comprobación booleana privada de sesión/MFA, con ejecución restringida; se retira SELECT directo Auth del runtime y se conservan guardas financieros y revocación. Los cinco SQL aplicados permanecen intactos. Ver ADR 0016.
- Mensajes web específicos para indisponibilidad de API, fallo interno y red. Regresión: 18/18 financieras, 14/14 integración M4 y 43/43 web; lint/typecheck y builds aprobados, contrato/cliente sin cambios.
- Respaldo remoto y dry-run completados. Aplicación rechazada por revisión automática por falta de aprobación explícita para la nueva migración remota; login remoto aún bloqueado. Detalle en docs/ADMIN_AUTH_CORRECCION.md.

## Diagnóstico del arranque API — 2026-11-06

- Retirada la instancia local de fondo que ocupaba 3001 e impedía iniciar el watcher del propietario. Verificados ready 200 con DB up y login web 200 con la instancia de desarrollo.
- `startup_failed` distingue puerto ocupado, permisos y dirección no disponible mediante códigos/mensajes fijos, sin registrar excepciones arbitrarias. Un fallo al escuchar cierra recursos de la aplicación antes de terminar con salida 1.
- `npm test`: 16/16, incluida reproducción real de EADDRINUSE en un proceso hijo. Lint, typecheck API/cliente y build API/cliente aprobados. Sin cambios de datos ni contrato; ver ADR 0015.

## Activación administrativa local con Supabase — 2026-11-06

- Aplicadas B3/B4/B5 con autorización explícita, CLI oficial e historial original. B1/B2 y datos administrativos conservados; sin seeds ni nuevas órdenes.
- Respaldo previo, segundo dry-run sin pendientes, 16 tablas RLS y permisos Auth limitados verificados. API local arrancada: ready 200 y administración anónima 401.
- Web local cambiada de demo a live con la configuración publicable existente; formulario y redirección anónima verificados en Chromium. Configuración privada ignorada por Git.
- Corregida la demora DNS local de Auth mediante familia HTTP configurable en servidor y Undici 7.30.2; TLS y límites conservados. JWKS frío 200 en 144 ms y login inválido real 401 en 1.124 ms. Ver ADR 0014.
- Verificación: 14 pruebas base API, 18 financieras PostgreSQL y 42 web; lint, typecheck y builds aprobados, cliente generado sin cambios y auditoría de producción sin avisos.
- Login/TOTP personal del OWNER y Storage real siguen pendientes. Sin despliegue, buckets nuevos o ventas; evidencia en docs/MIGRACIONES_SUPABASE_B3_B5.md.

## Consolidación Git en main — 2026-11-05

- Todo el desarrollo integrado y M4 se guardan en main, con el historial previo backend/frontend conservado y un respaldo local del worktree antiguo.
- main pasa a ser la única rama de trabajo y la predeterminada del repositorio; se retiran las ramas por fases/capas y el worktree activo adicional.
- AGENTS, README, plan y prompts recogen la instrucción permanente de no crear ramas ni worktrees. Ver ADR 0013.

## M4 — Revisión administrativa integrada — 2026-11-05

- Frontend F5 conectado a B5: login Auth en servidor, MFA TOTP, inscripción inicial, renovación y logout, bandeja, detalle, comprobante privado e historial.
- Decisiones con confirmación bancaria/conciliación, rol OWNER/ADMIN, expectedVersion e idempotencia estable ante respuesta perdida; sin expiración de órdenes.
- Nuevo GET /api/v1/admin/session, OpenAPI/cliente 0.5.1 y ADR 0012. Sin migración nueva ni cambio remoto.
- Pruebas financieras, componentes y navegador con PostgreSQL/JWT reales y proveedores Auth/Storage de pruebas; servidores web aislados para conservar la sesión de desarrollo abierta. Resultados y límites en docs/ESTADO_FRONTEND.md#m4.
- Cierre local: 18/18 financieras/sesión, 42/42 web, 14/14 integración M4 y todos los 80 escenarios públicos/demo verificados entre pasada inicial y repetición de fallidos; lint/typecheck/build aprobados. No se presenta como una pasada única de 80/80.
- Corregida la carrera de logout detectada en la integración: las lecturas no reescriben credenciales sin renovación y una barrera de cierre impide recuperar acceso con cookies de respuestas tardías. Se conserva la prueba de regresión.

## Plan de desarrollo integrado — 2026-11-05

- Secuencia única M0–M7 en docs/PLAN_DESARROLLO.md; backend y frontend se implementan y verifican en una misma sesión y carpeta.
- AGENTS, README, planes técnicos, prompts, estados y QA alineados con hitos conjuntos, conservando los identificadores B/F y su evidencia histórica.
- Próximo hito funcional M4: completar F5 sobre B5 y comprobar las dependencias M1–M3 incorporadas. No se declara la integración probada por esta actualización.
- ADR 0011 registra la decisión. Cambios exclusivamente documentales, sin migraciones, cambios de contrato ni despliegue.

## Integración frontend F2–F4 — 2026-11-05

- Incorporados catálogo real, pre-reserva, formulario único con comprobante y confirmación protegida desde feat/frontend-f4 a la carpeta principal, conservando el backend B5 y los cambios documentales pendientes.
- Incorporadas pruebas, capturas y decisiones originales. Inicio web live desde raíz con npm run dev:web, puerto 3000.
- No se modifican migraciones ni servicios remotos.

## Revisión B5 — 2026-11-05

- Completada la documentación pendiente de la implementación B5 ya existente:
  contrato real de las ocho rutas, MFA reciente/sesión vigente, roles,
  expectedVersion e idempotencia, conciliación y proxy privado de comprobantes.
- Ejemplos de aprobación/cancelación corregidos con confirmaciones y versión
  obligatorias; condiciones de reembolso y duplicado documentadas.
- Añadidos ADR 0009, QA de revocación/concurrencia y recuperación B5. Estado y
  evidencia de la revisión en docs/ESTADO_BACKEND.md#b5.
- Regresión completa local: 108 pruebas aprobadas (86 de integración SCRAM,
  incluidas 17 B5), sin fallos ni omitidas; lint, typecheck, build y generación
  del cliente correctos. PostgreSQL temporal detenido al terminar.
- No se aplicaron migraciones remotas ni se desplegó. La validación con Auth y
  Storage reales sigue pendiente; el siguiente hito funcional es B6.

## Documentación — 2026-11-05

- Estados B0–B4 consolidados en docs/ESTADO_BACKEND.md y F0–F1 en
  docs/ESTADO_FRONTEND.md, con resumen y evidencias históricas por fase.
- Retirados los siete informes separados; referencias y enlaces a capturas
  actualizados. Se conservan planes, contrato, decisiones y documentos técnicos.
- Cambio exclusivamente documental; no se repiten pruebas de aplicación.

## Sin publicar — B4 — 2026-11-03

- POST multipart de orden + comprobante y GET protegido por sesión de invitado;
  correo obligatorio, validación server-side y números solo tras commit.
- Orden PENDING_REVIEW/reporte REPORTED y HELD -> RESERVED atómicos; idempotencia
  por sesión, clave y hash del payload/archivo. Sin aprobación ni expiración de órdenes.
- Storage privado real por SDK, staging durable, compensación y job de limpieza
  que no borra adjuntos confirmados. Validación JPG/PNG/PDF en worker aislado;
  bytes originales/SHA-256, sin claves/PII/diagnósticos de parsers en logs.
- Migración B4 nueva con email obligatorio en nuevas escrituras, permisos mínimos,
  comprobante adjunto exigido en DB y recuperación protegida; sin editar B1/B2/B3.
- Cliente tipado incluye helper multipart, OpenAPI 0.4.0, configuración y guías.
  Supabase JS 2.118.0, sharp 0.35.5 y pdf-lib 1.17.1 fijados en lockfile.
  No se aplica B3/B4 remoto, crea buckets ni despliega; F4/B5 siguen separados.
- Verificación final local: 91 pruebas aprobadas, 69 de integración SCRAM;
  auditoría de producción sin vulnerabilidades. Ver docs/ESTADO_BACKEND.md#b4.

## Requisito acordado — 2026-11-03

- Correo obligatorio para nuevas órdenes B4/F4: contrato, planes y QA actualizados;
  validación y cambio de persistencia pendientes de B4, sin editar migraciones aplicadas.
- Plan B7 explicita protección DDoS en borde/origen, límites distribuidos y alertas;
  no se ha configurado un proveedor ni certificado resistencia DDoS.

## Sin publicar — B3 — 2026-11-03

- Sesión invitada HttpOnly/CSRF, holds idempotentes por sesión y consulta/cancelación
  protegidas; snapshot de precio/TTL, sin números ni órdenes en respuestas.
- Inventario atómico bajo lock de rifa y Fisher-Yates parcial con crypto.randomInt;
  límites de simultáneos y altas horarias en PostgreSQL con HMAC de IP.
- Job por instancia y liberación lazy exclusivamente de HELD vencidos; RESERVED,
  SOLD y holds consumidos se conservan. Auditoría sin secretos ni IP cruda.
- Migración B3 nueva y recuperación protegida; B1/B2 aplicadas no se modifican.
  Pruebas de concurrencia sobre dos instancias, aislamiento de sesión, abuso,
  cancelación, expiración y recuperación; runner local con opción SCRAM.
- Contrato, OpenAPI/cliente generado, variables, README y ADR actualizados.
  No se aplica B3 remoto ni se despliega. CAPTCHA externo pendiente de proveedor.
- 72 pruebas aprobadas (51 de integración SCRAM, con 50 solicitudes en dos
  instancias para 20 boletos, sin duplicados), lint/typecheck/build y
  compatibilidad tipada del frontend correctos. Ver docs/ESTADO_BACKEND.md#b3.

## Sin publicar — Continuación B2 — 2026-11-03

- OWNER remoto autorizado por UUID, validado contra Auth y provisionado en la
  allowlist con auditoría; pendiente la prueba HTTP de su sesión real.
- Detectado fallo del CI publicado de B2 en integración. El fixture del login
  limitado ahora usa una contraseña aleatoria, compatible con PostgreSQL SCRAM;
  no cambia permisos del producto ni migraciones aplicadas.
- Verificación local: 60 pruebas aprobadas, incluidas 40 de integración bajo
  SCRAM; lint, typecheck, build y contrato generado correctos. Lecturas HTTP
  sobre Supabase repetidas correctamente. Nueva ejecución remota del CI pendiente.

## Sin publicar — B2 — 2026-11-01

- Nueva rama feat/backend-b2, conservando B1 y cambios existentes de frontend.
- Catálogo público y cuentas habilitadas; administración de rifas con validación,
  transacciones, paginación, publicación/pausa/reanudación y auditoría.
- JWT ES256/RS256 vía JWKS, confirmación de usuario Auth y allowlist activa; alta
  inicial manual local sin autoasignación de roles al registrarse.
- Rol PostgreSQL limitado, aprobación de OWNER y derechos de medios; verificación
  externa de imágenes fuera de transacciones y detección de edición concurrente.
- OpenAPI, cliente tipado con Bearer opcional, env y guías actualizados. Recuperación
  selectiva B2, reparación del historial oficial y reaplicación comprobadas.
- B1/B2 aplicadas en Supabase con autorización explícita: historial conservado,
  13 tablas con RLS, runtime limitado y verificaciones HTTP de solo lectura correctas.
  No se cargaron fixtures ni se crearon administradores/usuarios remotos.
- Auditoría de producción sin alertas; se mantiene el aviso moderado de minimatch
  en herramientas de desarrollo. Avisos preexistentes de permisos del event trigger
  público documentados. CI de esta rama y publicación del sitio no ejecutados.

## 0.2.0 — 2026-11-01 — B1 validada localmente

- Confirmado el CI remoto exitoso de B0; nueva rama `feat/backend-b1`.
- Supabase CLI 2.122.0 fijado como único sistema de migraciones.
- Esquema privado con 13 tablas, constraints, índices, auditoría y RLS cerrada.
- Inventario generado por rifa, importes enteros y snapshots protegidos; integridad
  diferida de reservas/órdenes/reportes y conservación del histórico contable.
- Seed DEMO reejecutable, comandos locales protegidos y plan de recuperación.
- 39 pruebas aprobadas: 19 sin DB y 20 de integración PostgreSQL, con migración,
  seed, integridad, RLS y recuperación comprobados en bases desechables.
- Corregidas la configuración TLS del migrador loopback y la sintaxis PL/pgSQL
  detectadas en las primeras ejecuciones reales.
- Auditoría de producción sin alertas; aviso moderado de minimatch pendiente en
  herramientas de desarrollo. CI remoto B1 y despliegue todavía no realizados.

## 0.1.1 — 2026-10-29

- Instalación pnpm con lockfile y acceso de red verificada; CI usa frozen lockfile.
- Express declarado directamente, correcciones strict de CORS y lint de DTO.
- OpenAPI y cliente tipado generados; lint, typecheck y build aprobados.
- 17 pruebas aprobadas: configuración, HTTP y PostgreSQL 17.5 aislado.
- Overrides de multer y js-yaml corrigen alertas de seguridad; auditoría posterior
  sin vulnerabilidades reportadas. B0 validado localmente; no se ha desplegado.

## 0.1.0 — 2026-10-27

- Inicio de backend B0 en rama `feat/backend-b0`.
- API NestJS, configuración validada, errores uniformes, cabeceras seguras,
  CORS restringido, rate limit, logs sin contenido sensible y health checks.
- Generación OpenAPI/cliente, pruebas HTTP e integración PostgreSQL, CI.
- Seis pruebas de configuración aprobadas con Node, sin dependencias externas.
- Instalador PowerShell local de pnpm JavaScript y verificaciones backend;
  reintento de descarga aún bloqueado por EACCES de red en la sesión.
- No hay cambios de datos ni funcionalidad de compras. Validación ejecutable
  pendiente por restricciones de dependencias del entorno; ver `docs/ESTADO_BACKEND.md#b0`.
