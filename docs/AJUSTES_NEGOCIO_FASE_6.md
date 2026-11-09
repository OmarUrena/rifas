# Etapa 6 — Simplificación pública

Estado: implementada y verificada localmente en API, datos y web. Alcance autorizado: catálogo/detalle, compra y confirmación conectados, mobile first, sin modificar reglas financieras ni habilitar ventas/despliegues nuevos.

## Decisiones

- Se elimina la cantidad de vista previa del detalle, que no se transmitía a la compra. La cantidad se elige una sola vez en el checkout y se confirma mediante el hold existente.
- Catálogo: imagen, título, precio, progreso por recaudación y «Comprar» para ventas abiertas. Estados bloqueados con acción deshabilitada; enlaces de título/imagen siguen permitiendo consultar información.
- API/cliente 0.12.0 incorpora `canPurchase`, calculado con estado PUBLISHED, fechas y stock para la compra mínima. Es informativo; el POST de hold vuelve a validar y sigue siendo la autoridad transaccional. No crea reservas al visitar páginas.
- Detalle: acción principal Comprar, reglas e información ampliada desplegables, universo/fechas/precio conservados y enlace de consulta censurada. No se confunde progreso con ocupación ni se bloquea al alcanzar 100%.
- Compra: una columna, cantidad antes del hold; tras confirmarlo, resumen, reloj y cuentas copiables visibles, seguido del formulario único. Persistencia, claves, recuperación, advertencias de vencimiento, bloqueo de doble envío y almacenamiento privado se reutilizan.
- Formulario: comprador, transferencia, comprobante obligatorio y aceptación de reglas; «Enviar orden» envía todo junto. Texto único junto al envío sobre revisión manual. Errores locales junto a los campos; fallo de API sigue en alerta y conserva el intento.
- Confirmación: «Orden recibida», estado real, números y bendecidos primero; código y consulta visibles, importe/fecha/resumen plegables. PAID y CANCELLED conservan sus mensajes propios. No se muestran números antes de la orden.
- Se conserva el tema rojo/blanco/negro reversible y el aviso DEMO. Se retira el aviso global repetido de revisión manual en modo live; esa información permanece contextual en compra, confirmación y ayuda.
- No hay cambios de esquema, migraciones ni nuevas variables. No se envían comunicaciones ni se despliega.

## Verificación

Controles de esta etapa:

- `npm run generate:api`: OpenAPI y cliente 0.12.0 regenerados.
- `npm run lint`, `npm run lint --workspace @sorteos/web` y `npm run typecheck`: aprobados.
- `npm run test --workspace @sorteos/web`: 65/65. Incluye proyección de disponibilidad, fechas/mínimo, Comprar al 100%, estados bloqueados y confirmación pendiente frente a PAID.
- `npm run build:api`: aprobado; `npm run build --workspace @sorteos/web`: aprobado tras corregir un error de edición CSS.
- Runner PostgreSQL 17 aislado, `-TestScript test:sales`: 1/1. API real proyecta fechas, mínimo y pausa, conserva conteos de holds y rechaza crear un hold fuera de ventana.
- Runner `-TestScript test:stage6` con `PLAYWRIGHT_CHANNEL=chrome`: 1/1 recorrido final aprobado, incluida aserción de foco accesible al confirmar el cupo. API/Nest/Next/PostgreSQL reales, adaptadores locales de Auth/Storage, sin compras reales. Comprueba ausencia de POST al navegar, cuentas copiables, errores junto al correo, archivo obligatorio, doble submit con una única orden, números solo después del envío, recuperación de respuesta perdida sin duplicar y expiración de UI con reloj de navegador adelantado. No se presenta ese adelanto como vencimiento real de la base.
- Catálogo/detalle: `PLAYWRIGHT_CHANNEL=chrome npx playwright test foundation.spec.ts catalog.spec.ts checkout-demo.spec.ts --project=mobile --project=tablet --project=desktop` desde apps/web: 45/45, salida cero. Incluye axe A/AA, teclado, carga de JavaScript, estados agotada/pausada/finalizada, reglas plegables, galería, navegación y ausencia de POST en DEMO.

Incidencia: un script de edición sobrescribió temporalmente la hoja CSS con contenido de otro componente. Compilación y ambos arneses de navegador lo detectaron. Se restauró íntegramente la hoja previa y se añadieron solo ocho líneas de estilo; no se omitieron aserciones. La compilación posterior aprobó. La primera ejecución de navegador fallida no acredita un resultado verde.

Capturas de compra y confirmación revisadas en `.tmp/stage6-browser/`, exclusivamente con datos DEMO. La vista de confirmación no afirma pago recibido para PENDING_REVIEW. Pruebas con Chrome instalado; no se acredita nueva cobertura Firefox/WebKit ni servicios Auth/Storage productivos. La regresión global y pruebas de staging pertenecen a etapa 7/M6/M7.

## Siguiente paso

Etapa 7: regresión y entrega global, con pendientes externos M6/M7 y publicación aún sujetos a aprobación.
