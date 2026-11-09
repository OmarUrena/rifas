# Etapa 4 — Lotería, adjudicaciones y entregas

Estado: implementada, migración remota aplicada e integración de navegador verificada. La etapa 3 se integra conservando sus correcciones remotas de permisos y RLS. No confundir pruebas históricas con pruebas de esta etapa.

## Alcance autorizado

Registro preliminar de resultados por rifa, consulta privada del boleto y comprador, selección de premio, confirmación idempotente cuando se aprueben las reglas concretas, entrega e histórico administrativo. No publicar datos personales ni cambiar a DRAWN por registrar un resultado preliminar.

## Decisiones pendientes

Definición del propietario: se usa Pick 4 de la Lotería de Florida. El horario del resultado aplicable se establece en las reglas de cada rifa. El administrador registra manualmente el número; no se requiere integración, consulta automática ni sincronización con la lotería. Conservar en el registro la identificación del evento y su hora/zona horaria, además de la referencia verificable.

Pendiente precisar correspondencia entre cuatro cifras del resultado y cinco cifras de boletos, y tratamiento del número no vendido. No asumir prefijo cero, coincidencia por terminación ni resultado sustituto. Estas decisiones se solicitaron al propietario.

Actualización del propietario: se usarán las cuatro cifras de Pick 4 y el dígito adicional FIREBALL para formar las cinco cifras. Falta confirmar el orden de concatenación. Si no se vendió el número, se espera otra edición elegida por el administrador; la elección y programación de esa edición quedan fuera del sistema. Permitir registrar otro evento manualmente, preservando resultados anteriores, sin elegir sustitutos automáticamente.

Decisión confirmada: FIREBALL se coloca al final. Formación exacta: `pick4` (cadena de cuatro dígitos) + `fireball` (un dígito). Ejemplos: `1234` + `5` → `12345`; `0012` + `0` → `00120`; `0000` + `0` → `00000`. Validar ambos campos por separado y formar el número en servidor; conservar su presentación de cinco cifras. Esta concatenación es la regla de la rifa, no el mecanismo de sustitución del juego oficial. Quedan resueltas modalidad, formación del número y ausencia de selección automática de una edición posterior.

Se solicitó al propietario modalidad concreta, formación de cinco cifras y tratamiento de números no vendidos o múltiples resultados. Según `PLAN_AJUSTES_NEGOCIO.md`, apartados 4.2 y etapa 4, estas decisiones bloquean la adjudicación real definitiva, no el registro preliminar ni la consulta administrativa.

## Diseño de implementación

El listado siguiente describe el alcance de referencia. La implementación final usa premios de lotería independientes (una unidad por registro), resultados preliminares y adjudicaciones/entregas inmutables. No cambia a DRAWN ni automatiza sustituciones. Las correcciones se registran como un resultado adicional con referencia explicativa, conservando el anterior; una adjudicación definitiva no admite edición ni reasignación. Los selectores ofrecen los últimos 100 registros; el histórico completo se consulta paginado. Estos límites se mantienen explícitos.

1. Ampliar premios con origen LOTTERY/BLESSED, conservando los registros bendecidos existentes como BLESSED. Prohibir consumir una misma unidad por ambos mecanismos.
2. Añadir resultados preliminares inmutables: rifa, modalidad, fecha del evento UTC, número interno 0..99999, referencia verificable, premio, actor y fecha de registro. Correcciones mediante un nuevo registro que referencia el anterior y exige motivo; conservar historial.
3. Registrar el contexto de ventas al guardar el resultado. La búsqueda puede mostrar estado actual, pero una compra posterior al resultado no permite adjudicar retroactivamente. No inferir ganador por proximidad ni por ausencia de fila de boleto.
4. API Nest administrativa con OWNER y MFA para escrituras, UUID de idempotencia, validación y auditoría. Consulta de beneficiarios restringida y auditada. Permitir lectura a ADMIN según permisos existentes.
5. Confirmación transaccional: bloquear rifa antes de premio y orden, exigir ventas cerradas, cero órdenes sin conciliar, boleto SOLD y orden PAID, reglas aprobadas y unidad disponible. Congelar snapshot del premio y contexto de elegibilidad.
6. Entregas con actor, fecha y referencia de constancia, idempotencia y unicidad por adjudicación. Solo premios confirmados con pago PAID. No incorporar cargas de documentos públicos ni afirmar transferencias realizadas por la plataforma.
7. Bloquear cualquier cancelación financiera que afecte una adjudicación ya entregada; conservar evidencia y exigir procedimiento excepcional aprobado.
8. Extender el panel de premios existente con resultados y entregas, filtros e histórico privado. UI responsive con carga, vacío y error reales; confirmaciones explícitas para operaciones definitivas.
9. Mantener invariantes en PostgreSQL, RLS y triggers. Probar `SELECT FOR UPDATE` con filas existentes y rol runtime: necesita permiso de columna UPDATE y política UPDATE, además de SELECT. Conservar triggers de inmutabilidad.
10. Generar OpenAPI y cliente, actualizar contrato y ADR, preparar migración y recuperación sin borrar histórico; verificar datos/API/web antes de cierre y aplicar migraciones necesarias con la autorización vigente del propietario.

## Verificación requerida

Resultados sin venta, HELD, RESERVED y SOLD; privacidad; reglas no aprobadas; ventas posteriores al resultado; premio sin unidades; concurrencia e idempotencia; versiones y correcciones; rechazo de entrega pendiente; duplicado de entrega; cancelación de premio entregado; histórico y recuperación; integración real del panel en móvil y escritorio. No declarar esta etapa completada hasta implementar y verificar estos recorridos.

## Evidencia actual

Migración `20261108194414_lottery_awards_stage4.sql` aplicada en Rifas (`vukzxpwnfbavlwaeqkki`) con la autorización vigente para migraciones. Se verificaron las cuatro tablas con RLS y los conteos previos sin cambio (3 órdenes, 200 boletos). Sin nuevos avisos de seguridad sobre estas tablas; persisten los avisos anteriores de `public.rls_auto_enable` y protección de contraseñas filtradas. Recuperación solo sin datos: `infra/recovery/stage4-down-unused.sql`; con datos, preservar historial y reparar hacia adelante.

- API con PostgreSQL temporal, rol runtime y Auth/MFA realista: 26/26, incluyendo resultado preliminar rechazado, formación con ceros, cierre, adjudicación y entrega, reintentos entre instancias, duplicado de entrega, histórico e inmutabilidad. Fixture DEMO crea premio antes de publicar, sin ganador ni entrega reales.
- Web: 55/55, incluyendo permisos de ADMIN, formulario manual con ceros, conversión horaria con segundos y error sin éxito simulado.
- Typecheck de API/web/cliente, lint y compilación API/cliente/web correctos; build web aislado de servicios externos.
- Navegador Chromium con sesión administrativa: 1/1 recorrido integrado aprobado, escritorio 1280 px y móvil 390 px, con resultado, adjudicación, entrega e histórico. Capturas revisadas en `.tmp/stage4-browser/desktop.png` y `mobile.png`; sin desbordamiento móvil.

Prueba integrada reproducible del panel: `powershell -NoProfile -File scripts/test-backend-local.ps1 -PgBin 'C:/Program Files/PostgreSQL/18/bin' -Port 54348 -TestScript test:stage4 -PasswordAuthentication`. Utiliza PostgreSQL/Nest/Next reales y adaptadores locales de los protocolos Auth/Storage; prueba login/MFA, resultado, adjudicación y entrega, y guarda capturas en `.tmp/stage4-browser`. No usa datos ni entregas reales.

Regresión amplia inicial: 102 pruebas, 80 aprobadas y 22 fallidas. Veinte fallaron por timeout de Supabase CLI al preparar la base de la suite de esquema, antes de ejecutarse; dos fallaron por conteos de tablas obsoletos en recuperación B3/B4. Se corrigieron los conteos (25 tablas) y se repitieron por separado: recuperación 2/2 y esquema 20/20 aprobadas. No presentar esa primera ejecución como verde.

Pruebas específicas actuales `test:lottery`: 2/2 aprobadas. Incluyen ausencia de ganador para número no vendido, rechazo de resultado preliminar, confirmación y entrega idempotentes, así como compra bendecida pendiente/confirmada y entrega protegida. Base API: 25/25 aprobadas.

La primera prueba de navegador detectó rechazo local de fechas con segundos antes de enviar el POST. Se reemplazó el conversor bancario (solo minutos) por uno de eventos/entregas que admite segundos; se conserva la zona UTC-04:00. Las repeticiones también corrigieron una aserción que confundía el anunciador de navegación de Next con errores y el nombre accesible del selector de histórico. La ejecución final completó las tres escrituras con 200 y comprobó una única entrega en DB y el histórico paginado. Las capturas fallidas se conservan solo como diagnóstico ignorado en `.tmp`.

## Uso y siguiente fase

Administración → Rifa → Premios y números bendecidos → Lotería y entregas. Configurar premios en borrador antes de publicar. Antes del evento, conciliar pagos y cerrar ventas. Registrar después el resultado y su referencia, seleccionar premio/beneficiario elegibles, confirmar y documentar entrega. Una referencia de constancia no carga archivos ni realiza pagos.

Siguiente etapa: consulta protegida de boletos por correo o teléfono (fase 5), con proveedor y verificación de identidad por definir. No se desplegó la aplicación ni se registró ganador real durante esta fase.
