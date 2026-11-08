# Imágenes públicas de rifas

Catálogo, galería principal y miniaturas usan proporción 3:2 y `object-fit: contain`, con imagen centrada y fondo neutro. Se recomienda subir archivos de 1500 × 1000 px; otras proporciones se muestran completas con espacio sobrante.

Implementación aislada en `apps/web/src/app/(public)/public-prize-images.css`, compartida por los dos temas públicos. No cambia comprobantes ni imágenes de administración.

Verificación: typecheck y lint web correctos. Prueba Playwright `prize-images.spec.ts`: 2/2 aprobadas (Chromium móvil 360 px y escritorio 1280 px); comprueba proporción, carga, ajuste sin recorte y ausencia de desbordamiento en catálogo y detalle. Servidor temporal cerrado al terminar.
