# Instrucciones y plan de implementación — Ajustes de negocio de App Sorteos

Fecha: 2026-11-08.

Estado: planificación para ejecución posterior. La creación de este documento no implementa cambios de negocio ni autoriza despliegues o migraciones remotas.

Destinatario: modelo ejecutor con razonamiento Medium o Light. Trabajar por etapas, reutilizar el proyecto y comprobar cada resultado antes de continuar.

## 1. Objetivo y límites

Implementar sobre el proyecto existente:

1. Números bendecidos opcionales por rifa, con premios asociados.
2. Aviso al comprador cuando reciba un número bendecido.
3. Administración y seguimiento de premios, beneficiarios y entregas.
4. Interfaz pública más sencilla, con menos texto y enfoque mobile first.
5. Botones públicos «Comprar» en sustitución de «Ver detalles».
6. Progreso público calculado según un objetivo de recaudación configurable.
7. Numeración única de cinco cifras: `00000` a `99999`.
8. Registro administrativo del resultado de lotería y búsqueda del posible ganador.
9. Consulta pública de boletos por rifa y correo o teléfono, con verificación de identidad.

Trabajar exclusivamente en `main`, en `C:\Users\Alexander\Desktop\Rifas`, siguiendo `AGENTS.md`. Conservar cambios existentes y registrar avances en commits pequeños y claros. No crear ramas ni worktrees.

Esta solicitud modifica algunas reglas anteriores de manera explícita. No elimina las protecciones de pagos, privacidad, inventario, comprobantes privados, auditoría ni asignación aleatoria en servidor.

No desplegar ni ejecutar migraciones remotas sin autorización explícita. No realizar sorteos, pagos de premios ni comunicaciones reales durante pruebas.

## 2. Método de trabajo del modelo ejecutor

Antes de implementar:

1. Revisar `git status`, rama, estructura, dependencias y scripts.
2. Leer `AGENTS.md`, `apps/web/AGENTS.md`, `docs/CONTRATO_API.md`, `docs/PLAN_DESARROLLO.md`, `docs/PLAN_BACKEND.md`, `docs/PLAN_FRONTEND.md` y los ADR/estados de las funciones afectadas.
3. Localizar las implementaciones de rifas, inventario, creación/consulta de órdenes, aprobación/cancelación de pagos, autenticación administrativa, progreso, disponibilidad, formulario de compra y notificaciones públicas.
4. Identificar qué puede reutilizarse. No reiniciar la aplicación ni crear una arquitectura paralela.
5. Actualizar reglas y plan documental antes de cambiar comportamiento. Registrar las decisiones pendientes como pendientes, no como requisitos aprobados.
6. Implementar por las etapas de este documento, integrando API, datos y web en cada una.
7. Ejecutar pruebas relevantes y registrar resultados reales.

Para mantener el trabajo manejable:

- Resolver una etapa por vez.
- Mantener una lista breve de archivos afectados y criterios pendientes.
- No ampliar el alcance por iniciativa propia.
- Ante una decisión pendiente, detener solo la funcionalidad dependiente y continuar lo independiente.
- Al cerrar cada etapa, registrar cambios, verificaciones y siguiente paso.
- No introducir componentes que simulen operaciones exitosas.

## 3. Reglas de negocio actualizadas

### 3.1. Inventario y numeración

Para nuevas rifas:

- Universo exacto: enteros `0..99999`.
- Cada rifa dispone de `100000` números distintos.
- Presentación siempre con cinco cifras: `0` → `00000`; `45` → `00045`; `99999` → `99999`.
- Aplicar el formato a boletos, bendecidos, resultados de lotería, premios, búsquedas, confirmaciones y exportaciones.
- El comprador elige cantidad, nunca números.
- La asignación permanece uniforme y criptográficamente segura en servidor entre números elegibles.
- Ser bendecido no aumenta ni disminuye la probabilidad de asignación.
- La unicidad del número se aplica dentro de cada rifa.

Internamente pueden conservarse enteros. Centralizar el formato de cinco cifras para evitar conversiones inconsistentes.

**Compatibilidad:** no ampliar automáticamente inventarios de rifas publicadas o con órdenes. Primero identificar las rifas existentes y el efecto sobre sus reglas.

Preparar un procedimiento de migración que preserve asignaciones, evite duplicados, identifique universos modificados, determine las actualizaciones de reglas necesarias y obtenga aprobación específica antes de modificar inventarios comprometidos. No reescribir silenciosamente condiciones históricas.

### 3.2. Progreso de la rifa

Incorporar `fundraisingTargetMinor`:

- Entero en unidades menores DOP, mayor que cero.
- Editable por el propietario autorizado, incluso después del 100%.
- Auditar valor anterior, valor nuevo, actor, fecha y motivo.
- No cambiar precios ni snapshots de órdenes existentes.

Usar dinero confirmado, nunca comprobantes enviados:

```text
recaudación_confirmada =
  suma de importes efectivamente aprobados
  menos devoluciones confirmadas, cuando el sistema las soporte

porcentaje_real = recaudación_confirmada × 100 / objetivo
porcentaje_visible = mínimo(100, porcentaje_real)
```

Compartir la definición de recaudación con los reportes administrativos. Evitar duplicaciones por reintentos o joins con boletos. Usar enteros o `NUMERIC`, con precisión y redondeo definidos. Si se muestra un entero, truncar antes del límite para no anunciar 100% cuando todavía falta recaudación.

El administrador puede ver el porcentaje real, incluso superior al 100%. Limitar visualmente el porcentaje público al 100% es la propuesta de este plan.

La vista pública mostrará únicamente «Progreso de la rifa» y el porcentaje. No exponer objetivo, recaudación monetaria ni etiquetas como «porcentaje recaudado». Tampoco presentar ese indicador como boletos vendidos, ocupación o probabilidad de ganar.

Al modificar el objetivo, recalcular e invalidar/actualizar cachés. El porcentaje puede subir o bajar. No alterar disponibilidad ni cerrar o pausar automáticamente.

Llegar al 100% no impide comprar. La compra depende del estado, ventana de venta, inventario elegible, límites y controles existentes. Conservar en las reglas la información material sobre universo de números y condiciones de participación.

### 3.3. Números bendecidos

Cada rifa puede tener cero o varios. Asociar a cada configuración: rifa, número interno, premio, estado, actor/fecha de creación e historial.

El administrador podrá introducir un número de cinco cifras o solicitar selección aleatoria al servidor, asociar el premio y consultar estado del número y beneficiario cuando corresponda.

La selección aleatoria se realiza en servidor con aleatoriedad criptográficamente segura, sin duplicados, respetando la cantidad de números elegibles. Es independiente de la asignación de boletos a compradores.

**Política propuesta contra modificaciones retroactivas:** configurar antes de publicar y congelar números/premios al publicar. Conservar el historial. No convertir en bendecido un número ya asignado para beneficiar a una persona determinada.

Si se necesita editar durante las ventas, definir y aprobar ese flujo por separado. No inventar excepciones administrativas. Inicialmente cada número bendecido tiene un premio; varios premios sobre el mismo número requieren ampliación expresa.

### 3.4. Detección y aviso al comprador

En el envío exitoso de la orden:

1. Validar formulario y comprobante.
2. Confirmar la pre-reserva.
3. Crear la orden.
4. Convertir números en `RESERVED`.
5. Detectar bendecidos.
6. Registrar coincidencias de premio.
7. Confirmar la transacción.
8. Devolver números y coincidencias al comprador autorizado.

No mostrar coincidencias en `HELD`. Integrar detección y registro en la operación transaccional existente; no introducir llamadas externas dentro de ella.

Mensaje recomendado:

> ¡Te tocó un número bendecido!  
> Tu número **01234** tiene **[premio]**.  
> Pendiente de verificar tu pago.

No afirmar que el pago está aprobado o que el premio fue entregado. Si hay varias coincidencias, mostrar todas en una lista compacta.

El resultado persiste, reaparece al consultar la orden y se recupera tras respuestas perdidas. No depender solo de un toast ni duplicar premios al reintentar. Una celebración visual breve debe respetar `prefers-reduced-motion`; la información permanece tras la animación.

### 3.5. Validación y entrega del premio

Separar coincidencia, derecho confirmado y entrega.

| Estado orientativo | Significado |
|---|---|
| `PENDING_PAYMENT` | Coincidencia encontrada; pago sin aprobar |
| `CONFIRMED` | Pago aprobado y premio validado |
| `DELIVERED` | Entrega documentada |
| `VOIDED` | Adjudicación anulada con motivo y auditoría |

Adaptar nombres al modelo existente sin reutilizar ambiguamente estados de órdenes.

- `PENDING_REVIEW`, `UNDER_REVIEW` y `NEEDS_RESOLUTION` no habilitan entrega.
- Aprobar el pago confirma bendecidos una sola vez.
- Rechazar comprobante no anula automáticamente premio ni libera números.
- Cancelación conciliada invalida la adjudicación pendiente y conserva histórico.
- Si el número se libera y se vende después, puede generar otra adjudicación para la nueva orden.
- Nunca permitir dos adjudicaciones vigentes incompatibles sobre el mismo bendecido.
- No borrar ni revertir automáticamente una entrega documentada.

Si una operación financiera afecta un premio entregado, bloquear la resolución automática y exigir procedimiento administrativo explícito y auditable.

## 4. Premios y resultados de lotería

### 4.1. Catálogo de premios por rifa

Crear o ampliar el catálogo administrativo para premios principales, secundarios y bendecidos. Incluir descripción, tipo (dinero, artículo u otro permitido), importe cuando corresponda, unidades disponibles si se admiten varias adjudicaciones, estado y condiciones.

No convertir automáticamente la valoración de un artículo en dinero a pagar. Conservar un snapshot del premio en cada adjudicación; editar la descripción no cambia el histórico del beneficiario.

Definir cuáles se adjudican por lotería y cuáles por bendecido. No adjudicar dos veces la misma unidad.

### 4.2. Registro administrativo del resultado

Por rifa registrar: identificación del sorteo/modalidad, fecha y hora del evento, número ganador de cinco cifras, fuente/referencia verificable, premio correspondiente, actor, fecha de registro e historial de correcciones.

No asumir que cualquier resultado de Lotería Nacional se convierte directamente en cinco cifras. Antes de habilitar adjudicación definitiva deben estar aprobados:

- Modalidad concreta y resultado utilizado.
- Regla de correspondencia con los cinco dígitos.
- Tratamiento de números no vendidos y resultados múltiples.
- Condiciones de cierre y elegibilidad.

Hasta entonces, preparar estructura y datos DEMO, bloqueando adjudicación real definitiva. No inventar números ganadores, fuentes oficiales, permisos o reglas legales.

### 4.3. Búsqueda y selección del premio

1. Registrar resultado y referencia.
2. Buscar el boleto dentro de esa rifa.
3. Mostrar coincidencia y estado.
4. Si está `SOLD`, mostrar orden/comprador al administrador autorizado.
5. Seleccionar premio elegible y disponible.
6. Presentar confirmación de rifa, número, comprador, premio y fuente.
7. Confirmar adjudicación con idempotencia.
8. Auditar.

No hay ganador definitivo cuando el número está `AVAILABLE`, `HELD` o `RESERVED`. La ausencia de coincidencia se trata según reglas aprobadas; no inventar sustitutos, números cercanos ni otros compradores.

Conservar la prohibición de resolver definitivamente una rifa con órdenes pendientes de conciliación. Guardar un resultado preliminar no declara ganador.

Vincular resultados confirmados a un contexto de ventas cerrado. Una venta posterior a conocerse el resultado no crea retroactivamente un ganador. No establecer `DRAWN` solo por guardar un número.

### 4.4. Histórico administrativo

Permitir filtros por rifa, tipo de premio, bendecido/lotería, número, estado, beneficiario y fechas de adjudicación/entrega.

Mostrar según permisos: premio, número de cinco cifras, orden, comprador, estado del pago, adjudicación, entrega, responsable e historial.

La entrega registra fecha, responsable y constancia/referencia. Documentos sensibles en almacenamiento privado con acceso autorizado. No publicar automáticamente nombres, teléfonos, correos o fotografías de ganadores.

## 5. Consulta pública de boletos

### 5.1. Experiencia

Añadir «Consultar mis boletos», visible especialmente en móvil:

1. Seleccionar rifa.
2. Elegir correo o teléfono.
3. Introducir el dato.
4. Solicitar código.
5. Verificar código.
6. Mostrar únicamente boletos autorizados.

Conocer un correo o teléfono no autoriza acceso a órdenes.

### 5.2. Verificación obligatoria

Este flujo amplía RN15, no la elimina. La propuesta es OTP enviado al canal correspondiente; un mecanismo equivalente requiere aprobación previa.

Requisitos:

- Respuesta genérica sin revelar si existen órdenes.
- Código de uso único, caducidad corta y límites de intentos/reenvíos.
- Protección por IP y contacto.
- Almacenamiento seguro del verificador; no registrar códigos en logs.
- Sesión protegida tras verificar, limitada a rifa y contacto verificados.
- Respuestas privadas y `no-store`.
- Sin secretos en URLs, analítica o almacenamiento persistente del navegador.
- La solicitud inicial no devuelve nombres, cantidades de boletos ni estados de pago.

Dependencia pendiente: elegir/configurar proveedores de correo y SMS o canal telefónico aprobado. No simular envíos reales ni habilitar consultas inseguras mientras falten. Usar adaptadores explícitos de prueba; producción sin proveedor informa indisponibilidad sin exponer datos.

### 5.3. Alcance de la consulta

Mostrar rifa, código de orden, números de cinco cifras, estados de orden/pago, bendecidos y estado de sus premios. Agrupar y paginar múltiples órdenes; no asumir una orden por contacto.

Preservar la consulta existente por sesión del comprador. La recuperación no convierte la sesión invitada en acceso general a todas las órdenes del contacto.

Definir normalización de teléfonos/correos. No modificar masivamente datos históricos ni fusionar identidades por similitud.

## 6. Simplificación pública

### 6.1. Diseño

La compra debe entenderse por estructura, etiquetas y acciones: mobile first, una acción principal por sección, textos breves, información contextual, detalles extensos desplegables y errores junto al campo. Eliminar instrucciones repetidas.

Conservar paleta pública roja/blanca/negra y mecanismo existente para restaurar el tema original.

### 6.2. Catálogo y detalle

Cambiar «Ver detalles» por «Comprar» en tarjetas y enlaces equivalentes de rifas comprables. Llevar al detalle con participación accesible o al inicio del flujo existente; el clic no crea orden ni pre-reserva.

Para rifas no comprables usar estados coherentes: «Agotada», «Ventas pausadas», «Finalizada». No mostrar «Comprar» activo si está bloqueada la compra.

Priorizar imagen, nombre del premio/rifa, precio por boleto, progreso genérico y acción. Retirar explicaciones repetidas y cifras de ocupación usadas como progreso. Mantener disponibilidad real para autorizar/rechazar compras.

### 6.3. Compra

Organizar secciones breves: cantidad/total, datos del comprador, transferencia, comprobante, aceptación de reglas y «Enviar orden».

Preservar cálculo servidor, comprobante obligatorio, envío único, protección de doble clic, recuperación de respuesta perdida, advertencia contextual cuando vence un hold después de transferir, revisión manual y números solo tras crear orden.

Texto junto al envío:

> Revisaremos tu transferencia antes de confirmar el pago.

No repetirlo en cada sección. Mantener instrucciones bancarias necesarias visibles y fáciles de copiar. Las condiciones extensas pueden ir en «Ver reglas». No ocultar información indispensable ni convertir pasos visuales en órdenes separadas.

### 6.4. Confirmación

Priorizar «Orden recibida», «Pago pendiente de revisión», números, felicitación por bendecidos, consulta y resumen secundario. No mostrar «Compra pagada» o «Pago confirmado» antes de aprobación.

## 7. Diseño técnico orientativo

Reutilizar entidades existentes; los nombres siguientes son orientativos.

### 7.1. Datos

Posibles incorporaciones: `raffles.fundraising_target_minor`, premios, bendecidos, resultados de lotería, adjudicaciones, entregas, desafíos OTP y sesiones verificadas.

Restricciones PostgreSQL además de validaciones NestJS:

- Número entre `0` y `99999`.
- Bendecido único por rifa.
- Referencias que garanticen misma rifa para premio, boleto, orden y resultado.
- Objetivo positivo.
- Idempotencia de adjudicaciones/entregas.
- Prevención de adjudicaciones vigentes duplicadas.
- Capacidad de premios respetada bajo concurrencia.
- Conservación de histórico.

### 7.2. Transacciones

Definir orden de bloqueo compatible con el existente para consumo de holds, órdenes, aprobaciones, cancelaciones, confirmación de premios y entregas. Evitar nuevos deadlocks.

OTP, documentos y operaciones externas ocurren fuera de transacciones abiertas. Reutilizar staging, compensación o trabajos pendientes cuando corresponda.

### 7.3. Contrato

Actualizar OpenAPI y regenerar el cliente tipado.

La API pública podrá exponer progreso, coincidencias de bendecidos en órdenes autorizadas, estado del premio del comprador y flujos OTP/consulta protegida.

No exponer objetivo privado, recaudación administrativa, contactos ajenos, beneficiarios, OTP, documentos privados o auditoría interna.

La API administrativa cubre configuración, resultados, adjudicaciones, entregas e histórico. Usar roles/permisos existentes; el frontend no autoriza operaciones.

## 8. Secuencia de implementación

### Etapa 1 — Reglas y diseño

Entregar inventario de código afectado, reglas actualizadas, ADR, plan de migración de rifas existentes y decisiones pendientes. No modificar inventarios comprometidos ni habilitar adjudicación real de lotería.

### Etapa 2 — Numeración y progreso

Implementar cinco cifras, universo de nuevas rifas, objetivo configurable, cálculo seguro, edición auditada, progreso público genérico y compra independiente del 100%. Cerrar con pruebas API/datos/web.

### Etapa 3 — Premios y bendecidos

Implementar catálogo, configuración administrativa, selección manual/aleatoria, congelación al publicar, detección transaccional, aviso persistente, confirmación por pago y anulación conciliada con histórico.

### Etapa 4 — Lotería y entregas

Implementar registro preliminar, búsqueda, selección de premio, elegibilidad, confirmación idempotente, entrega e histórico. Bloquear adjudicación real definitiva hasta aprobar reglas concretas de lotería.

### Etapa 5 — Consulta de boletos

Implementar rifa, correo/teléfono, proveedor OTP, verificación, sesión protegida, consulta limitada, rate limiting y auditoría. Sin proveedor, preparar integración y declarar pendiente; no marcar terminado.

### Etapa 6 — Simplificación pública

Implementar «Comprar», reducción de texto, jerarquía, formulario compacto, confirmación, acceso a consulta y accesibilidad mobile first. Reutilizar componentes adaptados anteriormente.

### Etapa 7 — Regresión y entrega

Verificar flujos afectados y preparar changelog, README, contrato, ADR, migraciones/recuperación, variables sin secretos, evidencia, limitaciones y commits en `main`.

## 9. Criterios mínimos de aceptación

### Numeración e inventario

- [ ] `00000` y `99999` funcionan; negativos, decimales y fuera de rango se rechazan.
- [ ] Presentación siempre de cinco cifras.
- [ ] Nuevas rifas tienen el universo establecido sin duplicados.
- [ ] Asignación no favorece bendecidos; `HELD` no revela números.

### Progreso

- [ ] Pendientes no aumentan recaudación confirmada.
- [ ] Aprobación incrementa una sola vez.
- [ ] Cambiar objetivo actualiza porcentaje; aumentarlo puede reducirlo.
- [ ] Al 100% se puede comprar si hay stock.
- [ ] Sin stock se bloquea aunque el porcentaje sea inferior al 100%.
- [ ] No se filtra objetivo en API pública.
- [ ] Agregación correcta con órdenes de varios boletos.

### Bendecidos

- [ ] Rifa sin bendecidos funciona.
- [ ] Selección manual/aleatoria respeta rango y unicidad.
- [ ] No hay modificación tras publicar bajo la política propuesta.
- [ ] Orden con cero, uno o varios bendecidos.
- [ ] Reintentos no duplican; respuesta perdida recupera felicitación.
- [ ] Pendiente no permite entrega; aprobación confirma una vez.
- [ ] Cancelación conserva histórico.
- [ ] Reasignación no deja dos beneficiarios vigentes.

### Lotería y premios

- [ ] `SOLD` permite identificar al comprador autorizado.
- [ ] Número sin vender no inventa ganador; reservado no equivale a vendido.
- [ ] Pendientes bloquean resolución definitiva.
- [ ] No se adjudican premios incompatibles o agotados.
- [ ] Reintentos no duplican premios/entregas.
- [ ] Correcciones preservan resultado anterior.
- [ ] Ventas posteriores no crean ganadores retroactivos.

### Consulta y privacidad

- [ ] Contacto conocido no basta para obtener boletos.
- [ ] Solicitud OTP no revela existencia de órdenes.
- [ ] Código incorrecto, vencido o reutilizado se rechaza.
- [ ] Límites de intentos/reenvíos.
- [ ] Sesión no accede a otra rifa/contacto sin autorización.
- [ ] Múltiples órdenes del contacto se consultan correctamente.
- [ ] No se exponen comprobantes ni PII adicional.
- [ ] Fallo del proveedor no salta verificación.

### Interfaz

- [ ] Operable a 360 px sin desplazamiento horizontal.
- [ ] Teclado, foco y contraste correctos.
- [ ] Felicitación accesible/persistente.
- [ ] «Comprar» coherente con disponibilidad.
- [ ] Estados de error, carga, vacío y reintento.
- [ ] Comprobante obligatorio y envío único preservados.
- [ ] Administración mantiene permisos y tema independiente.

## 10. Decisiones explícitas y pendientes

Propuestas de este plan: progreso público limitado al 100%; recaudación basada en pagos confirmados; bendecidos antes de publicar; premio confirmado después del pago; OTP; histórico privado; asignación uniforme independiente de bendecidos.

Requieren definición antes de habilitar operaciones dependientes:

1. Modalidad concreta de Lotería Nacional y correspondencia de cinco cifras.
2. Tratamiento del resultado sobre número no vendido.
3. Proveedores de correo y canal telefónico OTP.
4. Migración del universo de rifas existentes con compromisos.
5. Procedimiento excepcional para incidencias financieras de premios entregados.

El ejecutor debe completar lo autorizado, identificar los bloqueos y no sustituirlos por simulaciones o decisiones silenciosas.
