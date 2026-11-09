# AGENTS.md — Instrucciones permanentes para Codex / App Sorteos

## Identidad del proyecto
**App Sorteos**: plataforma de venta de rifas de un único propietario en República Dominicana. Clientes compran como invitados; administración restringida. Idioma español, importes en pesos dominicanos (DOP). Arquitectura objetivo: Next.js + Tailwind (web), NestJS (API), PostgreSQL sobre Supabase (datos), Supabase Storage privado (comprobantes) y Supabase Auth para administradores.

## Antes de escribir código
0. Trabaja exclusivamente en `main`, en esta carpeta principal. No crees ramas adicionales ni worktrees. Guarda los avances en commits claros sobre `main`; no dejes una nueva línea de desarrollo por fase o por capa. La política de una sola rama es una instrucción explícita del propietario.
1. Inspecciona carpetas, dependencias, scripts, migraciones, tests, README y git status. No sobreescribas trabajo existente.
2. Lee `docs/CONTRATO_API.md` y `docs/PLAN_DESARROLLO.md`, la secuencia única de trabajo. Consulta `docs/PLAN_BACKEND.md` y `docs/PLAN_FRONTEND.md` como especificaciones técnicas del hito. Si están en raíz, ajusta sus rutas documentales; no copies a ciegas.
3. Trabaja solo el hito integrado solicitado (M0–M7), incluyendo backend, frontend, datos, contrato y pruebas en una misma sesión y carpeta de trabajo. B0–B8/F0–F8 son referencias técnicas, no líneas de ejecución separadas. Reutiliza lo implementado y completa las diferencias de ambas capas antes de cerrar el hito. Si requiere un hito previo fuera del alcance autorizado, impleméntalo mínimamente solo con consentimiento del usuario o informa el bloqueo.
4. Entrega implementación funcional, no solo pseudocódigo ni pantallas estáticas que fingen éxito.
5. Registra supuestos y decisiones de arquitectura (`docs/decisions/` o sección ADR).

## Reglas de negocio NO NEGOCIABLES
- **RN01.** Un único organizador/administrador empresarial, no marketplace.
- **RN02.** Nuevas rifas: rango fijo `0..99999`, presentación `00000..99999` (cinco cifras), precio, compra mínima/máxima, premio, reglas y fechas configurables. El rango no implica crear 100000 filas: materializar solo los números elegidos al pre-reservar. Conservar universos históricos sin ampliación ni renumeración automática; legacy con números mayores de 99999 mantiene su ancho hasta resolución expresa. Número único dentro de cada rifa.
- **RN03.** El comprador indica cantidad, **nunca selecciona números**. Asignación uniforme entre elegibles usando aleatoriedad criptográficamente segura **en servidor**.
- **RN04.** Compra y envío del comprobante bancario ocurren **en el mismo formulario y la misma acción «Enviar orden»**. Comprobante obligatorio; sin archivo válido no se crea orden.
- **RN05.** Antes de enviar, una pre-reserva técnica temporal (`HELD`) puede proteger stock durante la transferencia. No es una orden, no ofrece boleto definitivo y NO muestra números. TTL inicial propuesto: 60 minutos, configurable; requiere límites y protección antiacaparamiento.
- **RN06.** Al enviar exitosamente formulario + comprobante, se crea la orden y se convierten esos números en `RESERVED`; entonces se muestran los números y código de orden inmediatamente.
- **RN07.** Estado inicial de orden `PENDING_REVIEW`; la transferencia se verifica **manualmente**. Un archivo adjunto NO equivale a pago recibido.
- **RN08.** Los números de una orden que tiene comprobante **NO vencen automáticamente** mientras espera revisión o resolución administrativa.
- **RN09.** El administrador puede aprobar el pago (`PAID` y boletos `SOLD`), requerir resolución (`NEEDS_RESOLUTION`, mantener reserva) o cancelar solo después de documentar la conciliación y la resolución (liberación controlada).
- **RN10.** No se pueden vender, reservar o pre-reservar números duplicados ni crear órdenes dobles por reintentos/doble clic.
- **RN11.** Órdenes, pagos, cambios de estado, reservas, anulaciones y acceso sensible deben auditarse. No borrar histórico contable.
- **RN12.** El precio final y disponibilidad se calculan en servidor y se congelan en snapshot de orden. No confiar en importes enviados por el cliente.
- **RN13.** Al agotarse los números **disponibles** (vendidos + reservados + pre-reservas vigentes), no aceptar nueva pre-reserva. Una rifa no puede sortearse con órdenes pendientes de conciliación.
- **RN14.** Comprobantes almacenados en bucket PRIVADO, acceso solo a personal autorizado; nunca en URL pública persistente.
- **RN15.** El código público de orden nunca basta para acceder a teléfono, nombre, boletos u otros datos. Usar token de consulta secreto de alta entropía, sesión protegida u OTP; proteger el endpoint de enumeración.
- **RN16.** Dinero en unidades menores enteras (`amount_minor`) o `NUMERIC` seguro; no usar floats JS para lógica monetaria. Zona horaria de presentación `America/Santo_Domingo`; persistir UTC.
- **RN17.** No inventar autorización legal, permisos, números bancarios reales, ganador o sorteo. Ninguna función de sorteo real se publica hasta aprobación de reglas y requisitos.
- **RN18.** Objetivo privado de recaudación positivo y editable por OWNER con versión, motivo y auditoría. Progreso público = porcentaje entero truncado de importes PAID sobre objetivo, limitado visualmente a 100%; sin objetivo, omitir indicador. Alcanzar 100% no modifica disponibilidad ni estado de ventas. No descontar devoluciones de órdenes que nunca integraron PAID. En inventario por rango, ausencia de fila significa número libre; HELD vigente, RESERVED y SOLD ocupan números.

## Estados que deben mantenerse coherentes
- **Rifa:** `DRAFT`, `PUBLISHED`, `PAUSED`, `CLOSED`, `DRAWN` (el agotamiento es computado, no debe confundirse con un sorteo realizado).
- **Boleto:** `AVAILABLE`, `HELD` (solo pre-reserva), `RESERVED` (orden pendiente), `SOLD`. `VOID` solo con auditoría si se admite excepcionalmente.
- **Orden:** `PENDING_REVIEW`, `UNDER_REVIEW`, `NEEDS_RESOLUTION`, `PAID`, `CANCELLED`.
- **Reporte de pago:** `REPORTED`, `UNDER_REVIEW`, `VERIFIED`, `DISPUTED`, `INVALID`, `REFUNDED` (diferenciar transferencia real de comprobante).
- Rechazar comprobante ≠ cancelar automáticamente una orden; mantener sus boletos reservados hasta resolución.

## Restricciones arquitectónicas
- Todas las escrituras del negocio pasan por NestJS; Next.js no muta tablas de negocio directamente ni expone claves privilegiadas.
- API versionada `/api/v1` con OpenAPI; frontend usa cliente tipado generado del contrato.
- Preferir un único sistema de migraciones (si repo existe, reutilizar el suyo); restricciones críticas en PostgreSQL, no solo validaciones de NestJS.
- Todas las transiciones de inventario y confirmaciones se hacen en transacción y con bloqueo consistente. No ejecutar operaciones externas dentro de una transacción abierta; gestionar almacenamiento externo mediante staging + compensación/limpieza.
- Los secretos solo por variables de entorno del servidor; mantener `.env.example` sin valores reales, excluir `.env*` del control de versiones.
- Usar autenticación y autorización *reales* para admin; no confiar en bandera `isAdmin` del navegador ni en email sin lista de permisos.
- No ejecutar operaciones destructivas en Supabase/prod ni desplegar sin consentimiento explícito.
- Implementar manejo centralizado de errores, validación de entradas, rate limiting, controles de acceso, logging con redacción de PII, y mecanismos contra abuso de pre-reservas.

## Definición de terminado (DoD) de cualquier fase
- La unidad de entrega es el hito integrado de `docs/PLAN_DESARROLLO.md`: una funcionalidad conectada entre web y API, con evidencia de ambas capas y de su integración. Una capa terminada no completa el hito; distinguir evidencia histórica de verificaciones actuales.
- Código compila y pasa lint/typecheck.
- Tests relevantes pasan; no añadir tests falsos o saltarlos silenciosamente.
- Si hay cambios de datos, migración + rollback/plan de recuperación + seed DEMO.
- OpenAPI y cliente tipado actualizados si cambió contrato.
- Accesibilidad, responsive, error/loading/empty-state cuando aplica al frontend.
- README, variables de entorno, changelog/ADR actualizados.
- No se introduce dato bancario real, PII ficticia confundible con real, ni URL pública de comprobante.
- Informe final: resumen de cambios, comandos ejecutados y resultados, limitaciones, riesgos y propuesta de siguiente fase. No declarar completado lo no probado.

## Reglas adicionales de premios (propietario, 2026-11-08)

Un premio por número bendecido; configuración guardada inmutable. Lotería: Pick 4 de Florida seguido del dígito FIREBALL al final, cinco cifras conservando ceros. Registro manual del administrador según horario en las reglas. Si no se vendió, el administrador decide externamente la edición posterior y registra otro evento; no automatizar sustitución. Premios entregados conservan histórico y no admiten resolución financiera automática.
