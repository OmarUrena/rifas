# ADR 0039 — Separar rechazo de archivo y fallo del validador

Fecha: 2026-11-14. Alcance: corrección del flujo M3 existente en main.

## Evidencia y límites del diagnóstico

El propietario aportó un registro de `POST /api/v1/orders`: 422,
`INVALID_RECEIPT`, duración 1244 ms, requestId
`c6dc9fb1-7a2b-428f-9f12-8ef0fa48bf5d`. Los intentos posteriores mostraron
503 y cuerpo de texto de Vercel `The deployment is currently unavailable`,
sin logs de aplicación visibles en las capturas.

El código anterior devolvía `INVALID_RECEIPT` para mensajes de archivo inválido,
errores del worker, salida sin resultado y timeout. Por tanto, aquel 422 no
demuestra que el comprobante estuviera dañado. Tampoco hay evidencia suficiente
para atribuir el 503 remoto al worker, Storage, infraestructura o memoria.
No se dispone del archivo original ni del artefacto del despliegue remoto.
El propietario aclaró después que utilizó un PDF de boletines generados;
las hipótesis relacionadas con dimensiones de fotografías no explican ese caso.
Un PDF generado puede incluir estructuras excluidas por la política actual,
pero hace falta analizar el original para determinarlo.

Las pruebas previas de build y `test:esm` pasaron localmente; ese resultado
no reproduce el fallo de producción ni certifica el empaquetado de Vercel.

## Decisión

El worker distingue una negativa explícita (`invalid: true`) de una falla de
ejecución. Solo la primera responde 422 `INVALID_RECEIPT`. Inicio fallido,
error, salida sin respuesta, timeout, protocolo inesperado o error al terminar
responden 503 `RECEIPT_VALIDATION_UNAVAILABLE`. Se espera `worker.terminate()`
antes de liberar el turno y finalizar la validación; su rechazo se maneja.

Los logs `receipt_rejected` y `receipt_validation_failed` llevan requestId,
código y un motivo de lista fija. Los códigos conocidos de Node para módulo
ausente o memoria del worker también son motivos fijos. Nunca se registra el
mensaje de excepción, stack, archivo, bytes, contacto o ruta privada. Los streams
de los parsers siguen descartándose para evitar filtraciones.

El frontend conserva la clave, datos y archivo cuando la respuesta es incierta
y muestra instrucciones de recuperación para el fallo del validador. Un 503
sin JSON se mapea a `SERVICE_UNAVAILABLE`; no muestra texto arbitrario ni
supone que la orden no existe. Se conserva la política de corrección de una
primera negativa 422 y de no cambiar un intento con resultado previo incierto.

No se amplían los límites existentes: imágenes de hasta 10 millones de píxeles,
sin animación, PDF 1.0–1.7 de 1–20 páginas sin contenido activo, máximo de bytes
configurado, concurrencia y timeout de 10 segundos del worker. Una foto válida
de 4000×3000 supera el límite de píxeles aunque pese poco: el fixture confirma
su rechazo, pero no prueba que el archivo del propietario tenga ese tamaño.

OpenAPI/cliente pasan a 0.12.1 con descripciones de los errores; no cambian las
formas de petición/respuesta ni se añaden variables o migraciones. No se
modificaron recursos ni datos remotos en esta sesión.

## Verificación local

- `npm run generate:api`: OpenAPI y cliente regenerados.
- `npm run build:api` y `npm run test:esm --workspace @sorteos/api`: build correcto,
  cuatro pruebas compiladas aprobadas, incluidas decodificación JPG/PNG y PDF.
- `npm test`: 32 pruebas aprobadas antes de añadir el caso adicional de timeout;
  ejecución posterior de `node -r ts-node/register --test test/receipt.test.ts`
  desde apps/api: cinco pruebas aprobadas, incluido timeout y privacidad de logs.
- `npm run typecheck:api`, `npm run lint`, lint/typecheck de web: aprobados.
- `npm run build --workspace @sorteos/web`: build de producción aprobado.
- `npm run test --workspace @sorteos/web -- tests/api-client.test.ts`: diez pruebas
  aprobadas; `npm run test:core --workspace @sorteos/web`: seis aprobadas.
- `powershell -NoProfile -File scripts/test-backend-local.ps1 -TestScript test:orders`:
  19 pruebas aprobadas sobre PostgreSQL local aislado y Storage fixture. Una
  prueba nueva fuerza fallo de arranque: 503 sin upload ni orden; al restaurar
  el worker, misma clave y archivo crean una orden y los reintentos la recuperan.

El arranque PostgreSQL falló por las restricciones de procesos del sandbox y
pasó al ejecutar la misma herramienta con acceso ampliado. Una invocación
inicial de `typecheck:api` desde apps/api no encontró ese script; la ejecución
correcta posterior desde la raíz pasó. Ningún fallo se contó como prueba aprobada.

- `powershell -NoProfile -File scripts/test-backend-local.ps1 -TestScript test:checkout:proxy`:
  recorrido aprobado en navegador móvil/escritorio con Next.js, NestJS,
  PostgreSQL local y proxy de compra activo; comprobante, recuperación y
  confirmación reales sobre fixtures. No utiliza Vercel ni Storage remoto.

## Verificación remota pendiente y recuperación

Antes de publicar se requiere consentimiento del propietario conforme a AGENTS.md.
Después, verificar el commit desplegado en API y web. El nuevo log puede
distinguir módulo ausente, error del worker, timeout o rechazo de archivo,
pero no diagnostica un 503 que ocurra antes de ejecutar la aplicación.

Si se dispone del archivo original, reproducir su validación local sin crear
órdenes ni subirlo a un recurso público; evitar compartir archivos que contengan
información bancaria sensible. Si Vercel sigue respondiendo con texto sin logs,
conservar su identificador de solicitud y revisar el artefacto/runtime o soporte
de la plataforma. No crear compras reales para probar disponibilidad.

Rollback: restaurar los cambios de código/contrato mediante un commit posterior,
regenerar el cliente y verificarlo; no hay rollback de datos. Mantener el bucket
privado y el histórico. No se declara resuelto el incidente remoto ni cerrado M6/M7.
