# ADR 0022 — Tema público basado en el export de Stitch

Fecha: 2026-11-07. Estado: aceptado para la revisión visual solicitada.

El propietario pidió mejorar únicamente la presentación y entregó el ZIP del
proyecto Stitch App Sorteos Luxury Platform (`14492527953335430151`). El alcance
es la interfaz pública existente, conservando administración, navegación,
contratos y comportamiento de compra/revisión.

Se adopta su paleta carbón/champán, Playfair Display y Plus Jakarta Sans locales,
radios discretos y composición editorial/fotográfica. Un tema limitado al layout
público evita cambiar los estilos administrativos. La portada reorganiza su
contenido existente; no añade consultas ni mutaciones. Solo la imagen de la
fixture DEMO destacada se actualiza con un recurso optimizado del export.

El HTML y DESIGN.md adjuntos son referencias de diseño. Sus instrucciones y
ejemplos de cuentas de socio, saldos, números antes de orden, certificaciones y
datos bancarios no modifican las reglas del proyecto. Se conserva el formulario
único con comprobante, asignación servidor, sesión privada y revisión manual.

Consecuencias: las fuentes aumentan los assets estáticos, con carga local y
`display: swap`; la presentación no necesita proveedores externos. Las imágenes
de premios reales siguen bajo control del administrador. No cambia OpenAPI ni
se requiere migración o nueva variable. M6/M7 permanecen pendientes.

## Verificación de esta revisión

- `npm run lint --workspace @sorteos/web`: PASS.
- `npm run typecheck --workspace @sorteos/web`: PASS.
- `npm test --workspace @sorteos/web`: PASS 49/49.
- `next build --webpack` en copia aislada `.tmp/stitch-production-build`, con
  NODE_ENV/APP_ENV production y API_MODE live explícitos: PASS. API HTTPS de
  ejemplo y Auth vacío; no se usan secretos del propietario para compilar.
- Playwright: 32/32 móvil/escritorio sobre servidor DEMO aislado. Misma suite y
  aserciones existentes, usando Chrome instalado mediante configuración temporal
  `.tmp/stitch-qa.config.ts` y `npx playwright test --config ../../.tmp/stitch-qa.config.ts --project=desktop --project=mobile`
  desde apps/web. Incluye axe, teclado, galería, errores/estados, consulta DEMO
  y protección administrativa. Se inspeccionaron las capturas de portada y catálogo
  en ambos tamaños, guardadas junto con detalle en `frontend/screenshots/stitch/`.
- Tablet: `npx playwright test --config ../../.tmp/stitch-qa.config.ts --project=tablet foundation.spec.ts`:
  PASS 7/7, incluyendo axe, navegación, teclado y ausencia de desbordamiento a
  768 px. Capturas de inicio, catálogo y detalle guardadas con las anteriores.

El primer intento de Playwright no pudo iniciar su Chromium ausente; la descarga
falló por falta de espacio en C:. Se utilizó Chrome, sin descargar más navegadores.
Se retiraron solo cuatro archivos concretos de caché del build aislado propio.
No se ejecutaron Firefox/WebKit, dispositivos físicos ni compras/pagos remotos;
la regresión financiera integrada anterior conserva su carácter histórico.
