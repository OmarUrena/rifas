# ADR 0028 — Consulta pública censurada por teléfono

Fecha: 2026-11-08. Decisión expresa del propietario durante la etapa 5.

El propietario sustituyó la recuperación OTP por una consulta sin verificación: seleccionar rifa, buscar por teléfono y mostrar solo nombre con al menos la mitad censurada, correo parcialmente censurado si existe y cantidad de boletos registrados. La excepción permite únicamente ese resumen; no autoriza recuperar órdenes completas, números de boletos, códigos, contactos completos, datos bancarios, premios, comprobantes ni sesiones invitadas. RN15 se mantiene para esos datos.

La censura ocurre en NestJS antes de construir la respuesta. Se conserva la primera mitad de caracteres (truncada); el resto se sustituye por asteriscos. Para correo se aplica por separado a usuario y dominio. Un valor de un carácter queda totalmente oculto. No se devuelven identificadores de personas ni contactos completos. Conocer un teléfono permite inferir si tiene participación y su cantidad: es el alcance público autorizado, no una prueba de identidad.

Se cuentan cantidades de órdenes no canceladas, incluidas las pendientes de revisión, únicamente dentro de la rifa seleccionada. HELD no cuenta: todavía no hay orden. Una cancelación elimina esa orden del resumen pero conserva su historial. La versión inicial agrupaba por nombre/correo. Tras la ampliación del propietario, cada orden tiene su propia fila y estado; no se fusionan identidades ni estados de distintas compras. La UI pagina las órdenes. No hay búsquedas parciales ni por correo/nombre.

Se acepta teléfono internacional con + y código de país. También diez cifras dominicanas con prefijos 809/829/849 y su forma 1 + diez cifras; se normalizan a +1. Solo se eliminan espacios, paréntesis, puntos y guiones. La comparación usa la normalización compatible con el checkout existente, sin reescribir datos históricos ni inferir otros países.

El teléfono viaja por POST, no por URL. Respuestas no-store, página noindex, sin persistencia de contactos en navegador ni logs. Auditoría de cada búsqueda admitida sin contacto, identidad, conteos ni rifa vinculable a una persona. Límite durable PostgreSQL por hora: 20 solicitudes/IP y 30/teléfono, además del límite HTTP compartido. Se incluyen consultas vacías y páginas. Los contadores usan HMAC con la clave de abuso existente; un rechazo no revierte su incremento. Limpieza acotada de contadores antiguos, sin eliminar auditoría contable. No se solicita ni se envía OTP.

Una migración aditiva crea solo la tabla efímera de límites con RLS y permisos exclusivos del runtime, y dos índices de consulta. La API no abre la búsqueda sin la tabla. Recuperación en `infra/recovery/stage5-down.sql`, sin tocar órdenes o clientes. La migración fue generada con CLI oficial; su nombre conserva la intención inicial de etapa 5, pero no crea tablas ni flujo OTP. No incorpora proveedores ni nuevas variables/secretos.

## Ampliación solicitada: estado de cada orden

El propietario pidió incluir el estado en la consulta. Se devuelve una fila por orden no cancelada con `orderStatus`, cantidad y datos censurados. Se reemplaza la agrupación por persona para distinguir compras con estados distintos, manteniendo el total general de boletos. No se exponen códigos/identificadores de orden, números ni datos bancarios. El estado público no permite mutaciones ni recuperar la orden completa. No requiere migración. OpenAPI/cliente 0.11.1.
