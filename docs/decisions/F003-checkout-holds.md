# ADR F003 — Pre-reservas del frontend mediante la sesión B3

Actualización 2026-11-11: [ADR 0037](0037-optional-checkout-proxy.md) amplía
el transporte directo con un proxy opcional firmado para dominios separados de
Vercel, manteniendo CSRF, sesión privada y cuotas por cliente.

Fecha: 2026-11-03. Estado: aceptada. Prefijo F para evitar colisiones numéricas con ADR de backend.

## Contexto

B3 ofrece sesión invitada, alta idempotente, consulta y cancelación de holds. Todavía no se integra el formulario único F4. Se trabaja en `feat/frontend-f3`, conservando el worktree `.tmp/frontend-f2`; la sesión backend mantiene su checkout principal y puede avanzar de forma independiente.

## Decisiones

1. Las mutaciones van directamente desde el navegador a NestJS con el cliente OpenAPI y `credentials: include`. Solo se entrega al cliente la URL pública de la API, nunca credenciales de servidor. Evitamos interponer un proxy que agrupe a todos los compradores bajo una IP para las cuotas B3. Web/API deben ser del mismo sitio y CORS debe autorizar exactamente el origen web. En local, ambas usan `127.0.0.1`.
2. La credencial permanece en la cookie HttpOnly emitida por B3. JavaScript no la lee ni la almacena. El origen lo establece el navegador; el contrato generado exige declararlo también en las opciones del cliente. B3 comprueba Origin y Sec-Fetch-Site. No se inventan tokens CSRF, claves admin ni sesiones simuladas.
3. La inicialización de sesión sucede solo por acción explícita previa al primer hold. Se comparte una promesa por pestaña y se serializa entre pestañas con Web Locks cuando está disponible. Una recuperación que ya conoce un hold hace únicamente GET; una sesión perdida no se reemplaza automáticamente para recrear el cupo.
4. `sessionStorage` guarda una intención no secreta: UUID de idempotencia, ID/slug de rifa, cantidad, ID de hold cuando existe y banderas de preparación/resultado incierto. Se persiste antes del POST. No guarda cookie, comprobante, datos del comprador, números ni importes. El servidor siempre exige la sesión propietaria; el ID no autoriza acceso.
5. Una respuesta ambigua mantiene la misma clave/payload, incluso si el reintento recibe 429. Recargar sin ID deja un botón de recuperación explícita; no envía POST por montaje. Con ID consulta GET y recupera el mismo vencimiento. Un rechazo conocido del primer intento permite revisar cantidad; un conflicto de idempotencia o un resultado previamente incierto conserva la intención.
6. El contador parte de `expiresAt - serverTime`, descuenta conservadoramente la latencia y usa tiempo monotónico del navegador. Se actualiza cada segundo y al recuperar visibilidad/foco. No anuncia cada segundo al lector. A cinco minutos o menos muestra advertencia y oculta cuentas; al vencer bloquea instrucciones y ofrece conciliación/asistencia o nueva consulta explícita. GET y reintentos no renuevan TTL.
7. Para cambiar cantidad se cancela primero el hold anterior, se comprueba CANCELLED/EXPIRED y luego se permite una intención nueva. No hay sustitución garantizada. Si se pierde la respuesta de cancelación se conserva el ID para consultar/cancelar nuevamente; CONSUMED no se libera.
8. Se muestran solo las cuentas devueltas por el endpoint público durante un hold activo lejos de vencer. Toda esta entrega indica que todavía no debe transferirse: falta el formulario F4 para recibir orden y comprobante juntos. Por eso el botón se llama «Consultar y reservar cupo temporal», no «Continuar a transferencia». No hay botón de envío simulado.
9. Demo nunca crea sesión, hold ni pedido ficticio. Correo obligatorio es una decisión del contrato B3 para B4/F4; no se recogen datos personales en F3.

## Límites

Cerrar una pestaña o borrar su almacenamiento pierde el localizador de recuperación. B3 no ofrece listado de holds propios; no se inventa ese endpoint. Los límites del servidor y el TTL siguen protegiendo inventario. Otra pestaña con la misma sesión no tiene garantizada recuperación sin ese localizador. No se promueve crear otra sesión para eludir cuotas.

La integración se verifica en NestJS/PostgreSQL locales y tres motores de navegador; no certifica Supabase remoto, despliegue, proxy productivo ni dispositivo físico. El canal real de asistencia aún no está configurado: la ayuda lo comunica y no inventa contacto. Ver `docs/frontend/ESTADO_F3.md` para resultados y comandos.
