# ADR 0024 — Paleta pública roja, blanca y negra reversible

Fecha: 2026-11-08. Estado: aceptado para el ajuste visual solicitado.

El propietario solicita cambiar exclusivamente los colores de la interfaz pública
y poder recuperar fácilmente el tema anterior. Se conserva intacto el tema de
ADR 0022 y se añade `public-theme-red.css`, limitado a
`.public-app[data-public-theme='red']`. La constante `publicTheme` en el layout
público activa la capa; cambiar `"red"` por `"original"` restaura la presentación
anterior sin eliminar archivos. No se añade selector para visitantes ni estado
persistente: es una decisión de presentación del propietario.

La nueva paleta conserva fondos negros, texto blanco, secundarios grises y rojo
en botones, enlaces, foco y detalles. Los botones usan rojo oscuro con texto
blanco y los enlaces rojo claro para contrastar sobre fondos oscuros. Avisos y
errores conservan sus textos, roles y estructura; no dependen solo del color.

No se modifican estilos globales o administrativos, contrato, datos, variables
de entorno ni flujos de negocio. Es un ajuste visual acotado, no el cierre de
un hito integrado. No requiere migración ni despliegue.

## Verificación actual

- `npm run lint --workspace @sorteos/web`: PASS.
- `npm run typecheck --workspace @sorteos/web`: PASS.
- `npm test --workspace @sorteos/web`: PASS, 50/50.
- `node .tmp/build-red-theme.mjs`: PASS. Copia de fuentes sin archivos `.env`,
  `next build --webpack`, entorno de producción/live sin API/Auth configurados.
- `node .tmp/verify-red-theme.mjs`: PASS en Chrome local. Colores calculados
  rojo/negro activos, restauración carbón/champán al cambiar el atributo y
  administración azul sin atributo de tema público.
- Desde `apps/web`, `npx playwright test --config ../../.tmp/red-theme-qa.config.ts
  --project=desktop --project=mobile`: PASS, 32/32 en Chrome, servidor DEMO
  aislado. Incluye axe/contraste, teclado, navegación, galería, estados del
  catálogo, protección administrativa y ausencia de desbordamiento.
- Capturas de inicio y catálogo inspeccionadas en móvil y escritorio en
  `.tmp/red-theme-results/`. No se ejecutaron tablet, Firefox o WebKit.

El primer intento del arnés temporal falló por la resolución relativa del
`globalSetup`; se corrigió la ruta absoluta y se ejecutó la suite completa.
Las 32 pruebas emitieron resultado aprobado; el proceso quedó esperando al
cierre del servidor de pruebas en Windows y se interrumpió después. Por ello,
el arnés no terminó con código cero, aunque no hubo aserciones fallidas.

La comprobación de restauración cambia únicamente el atributo del DOM para
verificar la cascada CSS; no modifica la opción guardada en el código.
No se probaron compras remotas ni se desplegó la aplicación.
