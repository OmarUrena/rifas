# Matriz de QA y criterios de aceptación — App Sorteos

**Ejecución integrada:** usar la secuencia M0–M7 de [PLAN_DESARROLLO.md](PLAN_DESARROLLO.md). La columna Fase conserva referencias técnicas B/F; ejecutar los escenarios relevantes en ambas capas y su integración dentro del mismo hito. No cerrar un hito solo con pruebas aisladas de API o de UI.

**Entornos de pruebas:** base de datos aislada, archivos y bancos ficticios, sin transferencias reales. Los escenarios deben ejecutarse automáticamente siempre que sea viable. Reportar PASS/FAIL/SKIPPED con evidencia; nunca marcar PASS por inferencia.

**Ajustes de negocio:** cobertura y resultados de la regresión vigente en [etapa 7](AJUSTES_NEGOCIO_FASE_7.md). Los escenarios con universos pequeños son fixtures legacy de contención; las nuevas rifas usan exclusivamente 00000..99999 sin precarga.

**M6 (2026-11-07):** ejecución y límites actuales en [ESTADO_M6.md](ESTADO_M6.md).
H03 registra 100 peticiones entre dos instancias, 20 reintentos y p50/p95/p99.
S06 ejecuta backup custom y restauración transaccional en DB nueva, con evidencia
de filas, RLS e invariantes. S08 incluye 429, 503 y red en la bandeja administrativa;
la regresión M4/M5 conserva los fallos de envío y conciliación. Las verificaciones
remotas, dispositivos físicos, borde/CAPTCHA y recuperación de Storage/Auth siguen
separadas y no se marcan PASS por esos ensayos locales.

## A. Creación y configuración de rifas

| ID | Escenario | Esperado | Fase |
|---|---|---|---|
| R01 | Admin crea una rifa nueva | Universo lógico 0..99999 y cero filas de tickets antes del hold | B1/B2 |
| R02 | Rifa histórica con 10,000 números | Conserva rango 0..9999 sin ampliación; presentación mínima de cinco cifras | B1/F2 |
| R03 | Fixture legacy no decimal (ej. 137) | Asigna únicamente entre 0..136; conserva universo y formato sin renumeración | B1/F2 |
| R04 | Crear rifa con universo distinto de 100000 o cantidad inválida | Rechazo de validación, sin rifa/inventario parcial | B1/B2 |
| R05 | Rifa DRAFT/PAUSED/CLOSED | No admite nuevos holds | B2/B3 |
| R06 | Cambiar precio/N tras primer hold | Bloqueado o sujeto a política aprobada y auditada | B2 |
| R07 | Cliente ve progreso | Porcentaje PAID/objetivo truncado y limitado a 100%; sin objetivo ni importes privados | B2/F2 |

## B. Pre-reservas

| ID | Escenario | Esperado | Fase |
|---|---|---|---|
| H01 | Hold de 3 en rifa de 10 | 3 HELD, 7 AVAILABLE, sin número visible | B3/F3 |
| H02 | Dos holds simultáneos de los últimos 3 | Máximo uno confirmado, nunca sobreventa | B3 |
| H03 | 50–100 peticiones paralelas | Estados coherentes, ningún ticket repetido | B3/B7 |
| H04 | Expira un hold sin orden | Solo sus tickets pasan a AVAILABLE | B3 |
| H05 | Expira hold ya consumido | No afecta orden ni RESERVED | B3/B4 |
| H06 | Reintento misma idempotencyKey | Mismo hold; sin inventario adicional bloqueado | B3 |
| H07 | Cambiar contenido con misma key | 409 y no cambia inventario | B3 |
| H08 | Sesión ajena intenta leer/cancelar hold | 404/403; sin exposición de números | B3 |
| H09 | Spam masivo de holds | Throttle/rate limits; señales de abuso | B3/B7 |
| H10 | Contador expira con pestaña suspendida y retomada | Calcula contra tiempo absoluto server y bloquea submit | F3 |

## C. Orden única + comprobante

| ID | Escenario | Esperado | Fase |
|---|---|---|---|
| O01 | Formulario completo + archivo válido | 1 orden PENDING_REVIEW + pago REPORTED + q RESERVED | B4/F4 |
| O02 | Sin archivo de comprobante | No crea orden | B4/F4 |
| O03 | Archivo PDF/PNG/JPG válido menor al límite | Aceptado en storage privado | B4 |
| O04 | Archivo .exe, SVG, contenido MIME falso o >5MB | Rechazado con 415/422/413 | B4 |
| O05 | Cliente manipula total/price/quantity en request | Backend usa snapshot de hold, no total cliente | B4 |
| O06 | Hold venció mientras transfería | No orden ni números; error + camino a conciliación | B4/F4 |
| O07 | Doble clic + envío concurrente mismo idempotencyKey | 1 orden, 1 archivo lógico, mismo conjunto de números | B4/F4 |
| O08 | Se pierde respuesta HTTP tras commit; retry | Recuperación idempotente de misma orden, sin doble venta | B4 |
| O09 | Storage no disponible | No orden completa ni venta; error comprensible | B4 |
| O10 | DB rollback tras upload temporal | No orden; archivo se programa para limpieza | B4 |
| O11 | Cookie/sesión ajena solicita orden por código | 404/403 sin filtrar datos | B4 |
| O12 | La orden recién enviada se visualiza | Muestra números reservados y «pendiente», nunca «pagado» | F4 |
| O13 | Refresh tras confirmación | Consulta protegida, o vía de recuperación segura | B4/F4 |
| O14 | Precio con centavos y múltiples boletos | Cálculo exacto en minor units; sin float | B4 |
| O15 | Correo ausente, vacío o con formato inválido | Validación en formulario y API; sin upload ni creación de orden | B4/F4 |
| O16 | Limpieza reclama staging mientras se completa carga | No se confirma una orden con archivo eliminado; ATTACHED nunca se limpia | B4 |
| O17 | Cambian reglas/banco mientras Storage responde | Se revalidan antes del commit, sin orden parcial y con compensación | B4 |
| O18 | Reporte inventado desde rol runtime sin staging coherente | Constraint diferida rechaza el commit y revierte inventario/orden | B4 |

## D. Revisión y pagos

| ID | Escenario | Esperado | Fase |
|---|---|---|---|
| P01 | Admin entra a bandeja pendiente | Datos correctos, filtros/paginación | B5/F5 |
| P02 | Visitante no autenticado intenta aprobar | 401/403 | B5 |
| P03 | Admin sin rol activo intenta aprobar | 403 | B5 |
| P04 | Admin aprueba pago confirmado | Orden PAID, TODOS los tickets SOLD, auditoría | B5 |
| P05 | Repetir aprobación de misma orden | Idempotente, no duplica transacciones | B5 |
| P06 | Dos admins aprueban/cancelan simultáneamente | Una sola transición válida; conflicto explícito | B5/B7 |
| P07 | Comprobante sospechoso/rechazado | NEEDS_RESOLUTION y tickets continúan RESERVED | B5 |
| P08 | Orden NEEDS_RESOLUTION sin intervención por meses | **NO autoexpira** ni libera tickets | B5/B7 |
| P09 | Cancelar sin prueba de conciliación | Prohibido; no libera tickets | B5 |
| P10 | Cancelación después de verificar no pago/reembolso | Cambia a CANCELLED y libera exactamente q | B5 |
| P11 | Intentar cancelación directa de PAID | Bloqueado; procedimiento extraordinario fuera de alcance | B5 |
| P12 | Reuso mismo comprobante o referencia | Señal de posible duplicación, sin aprobación automática | B5 |
| P13 | Archivo comprobante público o firmado sin control | Debe fallar acceso no autorizado | B5/B7 |
| P14 | JWT aal1, TOTP antiguo o instante futuro | 403 MFA_REQUIRED, sin cambios | B5 |
| P15 | Sesión borrada, vencida, de otro usuario o factor revocado | Acceso denegado aunque el JWT no haya vencido | B5 |
| P16 | Sesión revocada durante descarga de Storage | No entregar bytes del comprobante | B5 |
| P17 | ADMIN intenta aprobar/cancelar | 403; solo OWNER puede conciliar | B5 |
| P18 | expectedVersion obsoleta o clave repetida con otro payload | 409, sin sobrescribir la revisión | B5 |
| P19 | Fallo SQL a mitad de aprobación | Rollback de reporte, orden, boletos y ledger | B5 |
| P20 | Reembolso incompleto o duplicado sin orden PAID acreditada | Cancelación bloqueada; mantiene RESERVED | B5 |
| P21 | Sesión administrativa en web sin MFA reciente | Solo preparación de TOTP; no órdenes ni comprobantes | M4 |
| P22 | Respuesta perdida después de decisión desde la web | Reintento conserva clave/payload y una sola acción financiera | M4 |
| P23 | Access token vencido con refresh válido | Renovación por Route Handler; cookies protegidas, sin mutación durante render | M4 |
| P24 | Administrador autorizado sin factor TOTP | Inscribe y verifica su propio factor antes de acceder a órdenes | M4 |
| P25 | Auth no confirma revocación al cerrar | Se borran cookies locales y se informa revocación remota pendiente | M4 |
| P26 | Login antes de hidratar o sin JavaScript | Credenciales deshabilitadas antes de hidratar; nunca contraseña por GET/URL | M4 |

## E. Operaciones y seguridad

| ID | Escenario | Esperado | Fase |
|---|---|---|---|
| S01 | Total disponible+held+reserved+sold | Igual a N por rifa siempre | B6/B7 |
| S02 | Stock agotado y progreso de recaudación al 100% | Stock agotado bloquea holds; 100% de recaudación no bloquea con cupo | Ajustes 2/6 |
| S03 | Cierre y adjudicación con pendientes | Cierre conserva reservas; adjudicación definitiva bloqueada hasta conciliación | M5/Ajustes 4 |
| S04 | Consulta por teléfono o código de orden | Teléfono solo devuelve resumen censurado y estado por orden; código no autoriza orden completa | Ajustes 5 |
| S05 | Secretos en bundle JS, logs o error HTTP | Ninguna credencial ni PII sensible | B7/F7 |
| S06 | Restaurar backup en entorno aislado | Datos íntegros; procedimiento documentado | B7 |
| S07 | 360px ancho: checkout, upload y confirmación | Sin scroll horizontal; teclado y lector operables | F7 |
| S08 | 429, 500, conexión lenta, reintentos | UI coherente, sin éxito falso ni venta duplicada | F7 |
| S09 | Producción recibe `API_MODE=mock` | Build/config prohibidos; no datos ficticios | F7/F8 |
| S10 | Migrar staging + rollback autorizado | Sin perder órdenes pagadas | B8 |

## Invariantes automáticas (ejecutar contra DB)

1. Para cada rifa: `N = disponibles computados + HELD vigentes + RESERVED + SOLD`. En FIVE_DIGIT, ausencia de fila significa número libre y se materializan solo elegidos; no exigir `N = count(tickets)`. LEGACY conserva su universo y sus filas históricas.
2. `count(distinct (raffle_id,number))=count(tickets)`.
3. Cada ticket tiene **exactamente un** estado actual; no puede apuntar a dos órdenes activas.
4. `PAID` implica `quantity` tickets SOLD; `PENDING_REVIEW`, `UNDER_REVIEW` y `NEEDS_RESOLUTION` implican `quantity` tickets RESERVED.
5. `EXPIRED` aplica a holds, **nunca a orders** pendientes con comprobante.
6. `amountMinor = quantity × unitPriceMinor` con matemáticas exactas y rango seguro.
7. Toda transacción relevante cuenta con audit log.
8. `receipt_storage_path` siempre es privado y pertenece a la orden, jamás URL pública permanente.
9. Las cifras públicas no cuentan comprobantes recibidos como dinero confirmado.
10. Pruebas de aleatoriedad evalúan ausencia de sesgo de la implementación sin prometer certificación formal (distribución aproximada en simulación y prueba del algoritmo).

## Evidencia que Codex debe adjuntar al completar una fase
- Comando de test y salida resumida (p. ej. `pnpm test:integration`).
- Nombre del archivo de prueba y escenario cubierto, o descripción de prueba manual cuando sea inevitable.
- Reporte de test concurrente: solicitudes, aceptadas, rechazadas, duplicados, invariantes, duración, percentiles observados (sin números inventados).
- Capturas móviles/escritorio de pantalla relevante si infraestructura lo permite.
- Lista explícita de SKIPPED y motivo (p. ej. Supabase sin credenciales, no simular como PASS).
