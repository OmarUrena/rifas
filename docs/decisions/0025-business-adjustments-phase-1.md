# ADR 0025 — Diseño de ajustes de negocio y compatibilidad

Fecha: 2026-11-08. Estado: aceptado como diseño de fase 1; propuestas operativas pendientes identificadas aparte.

El propietario autorizó iniciar la etapa 1 de ajustes. Se realiza inspección del repositorio y diseño documental; no se adelanta implementación ni se cierra M6/M7.

Se conserva el núcleo transaccional, sesión protegida, comprobante obligatorio y revisión manual. Nuevas rifas tendrán universo de 100000 números y cinco cifras. Progreso de recaudación y disponibilidad son conceptos separados; alcanzar 100% no cierra ventas. La edición del objetivo debe ser una operación acotada, sin ampliar permisos del patch general de rifas.

La inspección detectó total inmutable por trigger, ancho generado y soporte legacy de hasta un millón de números. Por ello se propone migración aditiva y compatibilidad explícita, sin renumeración, truncado ni ampliación automática de rifas comprometidas. Los datos reales deben diagnosticarse antes de cualquier conversión. No se inventan objetivos para registros anteriores.

El numerador actual de reportes es suma de órdenes PAID. Se reutilizará esa definición, sin descontar reembolsos de órdenes CANCELLED que nunca entraron en ella. Devoluciones posteriores a PAID no existen en el flujo actual y necesitan otra especificación si se requieren.

Premios, configuraciones de bendecidos, coincidencias/adjudicaciones, resultados y entregas se separan conceptualmente. Detección al crear orden; confirmación tras aprobar pago; historial preservado en cancelación. Acceso por contacto requiere verificación; nunca basta un correo/teléfono o código de orden.

Progreso público limitado al 100%, OTP y congelación de bendecidos antes de publicación son criterios propuestos en el plan, no nuevas autorizaciones de servicios externos. Congelación y multiplicidad se incluyen expresamente como decisión pendiente antes de la etapa 3.

Inventario de archivos, reglas AJ01–AJ11, secuencia, recuperación y decisiones D01–D06 en [fase 1](../AJUSTES_NEGOCIO_FASE_1.md). El contrato HTTP actual y el cliente generado permanecen vigentes hasta implementar y verificar cada extensión.
