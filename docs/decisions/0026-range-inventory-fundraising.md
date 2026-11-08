# ADR 0026 — Rango implícito de números y progreso por objetivo

Fecha: 2026-11-08. Estado: implementación de etapa 2 solicitada; corrección explícita del propietario incorporada durante la sesión.

El propietario aclaró que el universo 00000..99999 no debe materializarse al crear la rifa: los boletos se generan cuando se pre-reservan. Se reemplaza la interpretación inicial de inventario completo para nuevas rifas. No se eliminan filas históricas ni se amplían universos comprometidos.

La migración agrega política inmutable LEGACY/FIVE_DIGIT y objetivo nullable. Registros previos conservan LEGACY y objetivo vacío; nuevas altas de NestJS fijan FIVE_DIGIT y total lógico 100000. El trigger de población solo conserva la generación histórica para fixtures LEGACY explícitos, inaccesibles como nuevas altas del rol runtime. No hay procedimiento de conversión automática; para un borrador incompatible, crear nueva rifa evita retirar la protección de numeración.

Checkout bloquea la rifa, libera HELD vencidos y consulta números ocupados. Construye intervalos libres, elige posiciones uniformes sin reemplazo con `crypto.randomInt` y las traduce a números mediante búsqueda binaria. No crea una lista de todos los números ni usa un bucle de rechazo cerca del agotamiento. Inserta únicamente seleccionados ausentes y reutiliza registros AVAILABLE existentes antes de convertirlos en HELD en la misma transacción. Unicidad, triggers, compensación, auditoría e idempotencia existentes se conservan.

La disponibilidad pública y gerencial se calcula desde suma de universos menos HELD vigentes/RESERVED/SOLD; contar filas de tickets ya no representa el total lógico. El esquema actual no admite VOID. Una futura incorporación de VOID deberá actualizar la selección y los agregados conjuntamente.

Objetivo positivo, seguro en centavos y privado. Progreso = `floor(PAID * 100 / objetivo)` con BigInt; máximo público 100, porcentaje real administrativo como cadena decimal. Se conserva suma PAID de reportes. Sin objetivo legacy, no se inventa 0% ni se reutiliza porcentaje vendido.

La edición de objetivo es una acción OWNER separada del patch general, con versión, motivo y clave de idempotencia. Usa bloqueo de rifa y auditoría inmutable con índice único por actor/clave para recuperar reintentos. Conserva publicación, precio, reglas e inventario; puede aplicarse a rifa cerrada sin reabrirla. DRAWN sigue prohibido como transición: solo se permite editar un registro histórico que ya estuviese DRAWN.

Las lecturas de catálogo y clientes mantienen `no-store`, y la web vuelve a consultar tras guardar objetivo. No requiere caché distribuida o nuevas variables de producto. OpenAPI 0.8.0 y cliente se regeneran desde NestJS.

Seguridad: funciones SECURITY INVOKER, esquema privado existente, sin nuevos grants de cliente, nuevas tablas o bypass RLS. Se revisaron la [documentación RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), las guías locales de índices parciales y transacciones cortas y el [changelog](https://supabase.com/changelog). Se conserva CLI fijado 2.122.0; no se adopta CLI v3 como parte de esta entrega.

Recuperación: down solo si la etapa está sin uso; con nuevas rifas, objetivo o auditoría de cambios se exige recuperación hacia delante. No borrar boletos, órdenes ni historial. Ver [estado y verificación](../AJUSTES_NEGOCIO_FASE_2.md).
