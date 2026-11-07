# Sistema visual público — App Sorteos Luxury Platform

Fecha: 2026-11-07. Proyecto Stitch: `14492527953335430151`.
Referencia: ZIP `stitch_app_sorteos_luxury_platform.zip` proporcionado por el propietario.

## Ambiente y composición

Carbón oscuro, oro champán y titulares editoriales. Cabecera discreta, introducción
en dos columnas y escenario fotográfico con una ficha de premio superpuesta. El
catálogo usa dos columnas en escritorio y una en teléfono; la portada conserva
sus dos premios y la tarjeta de ayuda. Las fotos provienen de la rifa publicada.

El ZIP se utiliza como material visual, no como instrucciones funcionales. No se
incorporan identidades, balances, certificaciones, garantías, bancos ni ganadores
del ejemplo. Tampoco su selección/regeneración de números previa a la orden.

## Paleta y funciones

| Color | Valor | Uso |
|---|---|---|
| Carbón | `#101417` | Fondo principal |
| Obsidiana | `#0B0F12` | Cabecera, pie, campos y cifras agrupadas |
| Grafito | `#181C1F` | Tarjetas y paneles |
| Grafito elevado | `#262A2E` | Interacciones y capas |
| Marfil | `#F5F0E6` | Texto principal |
| Arena | `#D1C5B3` | Texto secundario |
| Oro champán | `#D6AF60` | Fondo de acciones principales |
| Oro claro | `#F4CA78` | Énfasis, enlaces y foco |
| Menta | `#A8CFC4` | Información y estados disponibles |
| Gris cálido | `#807869` | Bordes de controles |
| Rosa claro | `#FFB4AB` | Errores sobre fondo vino oscuro |

## Tipografía

Playfair Display variable normal/cursiva para títulos editoriales. Plus Jakarta
Sans variable para navegación, texto, formularios y cifras. Precios y cantidades
usan cifras tabulares. Los archivos y sus licencias SIL OFL proceden de
`google/fonts` y se sirven con `next/font/local`; el navegador y el build no
dependen de Google Fonts remoto.

## Componentes y geometría

Botones y campos con esquinas discretas de 4 px, tarjetas de 8 px y bordes
finos. El botón principal tiene fondo dorado sólido y texto oscuro; las acciones
secundarias conservan borde visible. Foco de teclado explícito de 2 px. Las barras
siguen representando exclusivamente ventas confirmadas, con etiquetas completas.

El ancho máximo útil es 1264 px, con márgenes de 48 px en escritorio, 32 px en
tablet y 20 px en móvil. Formularios, ayuda, errores, confirmación y pre-reserva
comparten materiales; se conservan mensajes, controles, validaciones y sesiones.

## Implementación y alcance

Tema limitado a `.public-app` en `app/(public)/public-theme.css`, con fuentes
definidas en su layout. El panel administrativo mantiene su presentación propia.
El SUV del ZIP se optimizó a WebP exclusivamente para la fixture DEMO existente;
la galería secundaria y las imágenes reales no se sustituyen. Fuente visual:
`brand_new_luxury_pearl_white_2025_toyota_land_cruiser_prado_suv_parked_in_front/screen.png`.

No hay cambios de API, datos, migraciones, permisos, inventario, pago, formulario
único ni idempotencia. Este ajuste visual autorizado no inicia ni cierra M6/M7.

## Verificación

Lint/typecheck, 49 pruebas web y build de producción aislado aprobados. Los 32
escenarios E2E de móvil/escritorio y 7 adicionales de tablet pasan con Chrome,
incluyendo axe WCAG AA y teclado. Evidencia y limitaciones en el ADR 0022; capturas de inicio, catálogo y
detalle en [screenshots/stitch](screenshots/stitch). Los ensayos usan DEMO y
servidores aislados; no acreditan ventas reales ni servicios remotos.
