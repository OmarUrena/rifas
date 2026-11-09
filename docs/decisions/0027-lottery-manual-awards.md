# ADR 0027 — Resultados manuales y premios

Se usa Pick 4 de Florida y FIREBALL concatenado al final, según decisión expresa del propietario. El horario aplicable se publica en las reglas. Se conserva fecha UTC y referencia manual del evento; formularios muestran Santo Domingo. No se consulta la lotería automáticamente.

Resultados preliminares no son ganadores. La elegibilidad se congela al registrar, con ventas cerradas antes del evento y pago confirmado antes del evento. Se usa `raffles.updated_at` de manera conservadora para comprobar cierre previo: un cambio posterior del objetivo puede impedir adjudicar un evento anterior, nunca habilitarlo indebidamente. Si ese caso aparece se deberá incorporar fecha específica de cierre mediante migración, sin relajar esta comprobación.

Premios de lotería son unidades independientes e inmutables; no consumen premios bendecidos. Los registros posteriores conservan los anteriores. No se elige sustituto si no hay ganador. Confirmación y entrega requieren OWNER/MFA y transacción bajo bloqueo de rifa; cada premio y cada entrega tiene unicidad en PostgreSQL. La clave de idempotencia y su huella quedan en auditoría, sin PII en metadata.

Las entregas son constancias administrativas de acciones ya ocurridas, con referencia privada, fecha y responsable. No hay movimientos bancarios ni publicación de beneficiarios. Se bloquean cambios de estado de órdenes con entregas; su resolución excepcional queda fuera de alcance hasta que el propietario apruebe procedimiento.
