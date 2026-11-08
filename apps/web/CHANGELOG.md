# Cambios de frontend

## Ajustes de negocio — Etapa 2 — 2026-11-08

- Alta con rango fijo de cinco cifras y objetivo privado; edición OWNER del objetivo independiente del bloqueo general y con reintentos idempotentes.
- Progreso público desde la API con semántica accesible 0..100, omisión si falta objetivo y disponibilidad independiente. Conservados tema reversible y compra con comprobante.
- Cliente generado 0.8.0 y proxy administrativo tipado. Evidencia integrada y limitaciones en docs/AJUSTES_NEGOCIO_FASE_2.md.

## Paleta pública reversible — 2026-11-08

- Tema rojo, blanco y negro aislado mediante `data-public-theme="red"`.
- Paleta original intacta y restaurable desde `publicTheme` en el layout público.
- Conservados composición, responsive, fuentes y funcionamiento; administración sin cambios.

## M4 — Administración y revisión manual — 2026-11-05

- Login Supabase Auth exclusivamente en servidor, cookies HttpOnly/Strict, TOTP, inscripción inicial, renovación y cierre de sesión.
- Bandeja filtrada/paginada, detalle protegido, historial/incidencias y comprobante por proxy privado sin caché pública.
- Decisiones B5 con confirmación, rol, expectedVersion e idempotencia estable; conflictos y respuestas ambiguas tratados explícitamente.
- Configuración sin claves secretas, cliente generado 0.5.1, pruebas UI/financieras y harness integrado aislado. Resultados actuales en docs/ESTADO_FRONTEND.md.

## Integración F2–F4 — 2026-11-05

- Catálogo live, pre-reserva y formulario único con comprobante, recuperación idempotente y confirmación protegida incorporados al proyecto principal.
- Inicio desde raíz con npm run dev:web; la API sigue siendo autoridad de precios, números y estado de pago.

## Cierre adicional F1 y preparación F2 — 2026-11-01

- Trabajo separado en feat/frontend-f2 con worktree independiente; backend sin modificaciones.
- Compatibilidad comprobada con Firefox y WebKit móvil, además de Chromium. Regresión de JavaScript retenido para proteger la primera búsqueda.
- Controles React deshabilitados hasta estar listos; foco explícito del enlace de salto y scroll inmediato para navegación consistente.
- Primera fila de imágenes del catálogo priorizada y recuperación de segmento mediante retry de Next.js.
- Corregida duplicación /api/v1 del cliente, conservando cookies/no-store y correlación segura en errores JSON/HTML.
- Comprobador de contrato y documentación F2; integración pendiente de B2, sin rutas ni DTOs ficticios.
- CI base confirmada exitosa en GitHub; workflow preparado para los tres motores en próximos cambios.

## Rediseño F1 — 2026-10-29

- Aplicada la guía visual aprobada: fondo petróleo, dorado, títulos serif, hero fotográfico y navegación inferior móvil.
- Catálogo demo con búsqueda tolerante a tildes, filtros de estado y recuperación de vacío; detalle con galería, reglas e inventario diferenciado.
- Selector de cantidad local sin reservas, cobros ni órdenes; compra deshabilitada y explicada.
- Ayuda funcional con preguntas desplegables; conservación de estados loading/error/404 y login sin captura de credenciales.
- Tres imágenes originales generadas, persistidas en public/images/demo y documentadas con sus prompts.
- Ampliada la verificación a 39 E2E Chromium y 6 tests de componentes, además de los 6 tests de núcleo. Evidencia visual separada de F0.
- Medición local reproducible de la portada; producción live no publica fixtures. Sin cambios de API ni backend.

## Validación F0 — 2026-10-29

- Dependencias verificadas con lockfile congelado; OpenAPI y cliente compartido generados desde NestJS.
- Chromium y herramientas Playwright descargados en .tmp/playwright-browsers.
- Corregida advertencia ESLint en PostCSS y contraste del pie de la ilustración detectado por axe.
- Playwright usa npm y dirección IPv4 explícita; Next.js recibe la declaración de scroll suave.
- Lint, typecheck, build, 6 tests de núcleo, 3 tests UI y 15 E2E aprobados localmente. Nueve capturas conservadas en docs/frontend/screenshots.
- CI frontend actualizada para respetar el lockfile; ejecución remota pendiente.

## 0.1.0 — 2026-10-27

- Armazón F0 Next.js/React/TypeScript/Tailwind con identidad visual propia y componentes accesibles.
- Inicio, catálogo aún no habilitado, entrada administrativa sin captura de credenciales, loading/error/404.
- Consumo del cliente OpenAPI compartido; configuración de entorno, errores seguros y formatos DOP/UTC.
- Modo demo local visible y prohibido en build productivo.
- Tests de núcleo ejecutados; tests de UI y E2E con axe/capturas preparados y pendientes por restricciones de instalación.
