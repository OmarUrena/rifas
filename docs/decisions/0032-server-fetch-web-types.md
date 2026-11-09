# ADR 0032 — Tipos Web API explícitos para fetch en el backend

Fecha: 2026-11-09. Alcance: error de compilación reportado en Vercel.

## Contexto

Después de detectar NestJS, Vercel informa TS2339 en `media.service.ts`: el tipo
global `Response` no tiene `ok` ni `headers`. El build local completo no reproduce
el fallo con el entorno habitual del monorepo.

Las declaraciones de Node condicionan sus tipos Web API a la presencia de
`onmessage` en el ámbito global. Un entorno con esa declaración y sin la librería
Web API completa puede resolver `Response` como una interfaz incompleta. Se
reprodujeron exactamente los dos TS2339 al compilar el servicio con una declaración
ambiental de `onmessage` y la configuración anterior (`lib: ["ES2023"]`). Este
modelo verifica el fallo de tipos; no certifica cuáles son las declaraciones
ambientales exactas del build remoto.

## Decisión

Declarar `lib: ["ES2023", "DOM", "DOM.Iterable"]` y `types: ["node"]` en el
`tsconfig.json` de la API. Las APIs estándar `fetch`, `Response` y `Headers` que
utiliza el servidor reciben tipos completos; las inclusiones globales de paquetes
`@types` quedan limitadas a Node. Las dependencias importadas conservan sus tipos.

En `MediaService`, derivar el tipo de la respuesta del retorno de
`fetchFromServer`. Se conserva el cliente nativo con el agente Undici existente.
La prueba HTTP saliente existente cubre ahora configuración ausente, `auto` e
IPv4, verificando estado, `ok`, cabeceras y cuerpo, además de los errores de IPv6,
cancelación y configuración inválida que ya comprobaba.

Referencias: [lib](https://www.typescriptlang.org/tsconfig/lib.html) y
[types](https://www.typescriptlang.org/tsconfig/types.html) de TypeScript.

## Verificación y límites

El caso de declaraciones Web API parciales produce los dos errores con la
configuración anterior y cero diagnósticos con la configuración actual. El
contrato HTTP y las variables del entorno conservan su definición.

Comprobaciones locales ejecutadas con Node 24.22.1:

- `npm run typecheck --workspace @sorteos/api`: correcto.
- `npm run build --workspace @sorteos/api`: correcto.
- `npm run lint`: correcto.
- `npm test`: 27 pruebas aprobadas, ninguna omitida.
- `git diff --check`: correcto.

El resultado de Vercel debe verificarse en un nuevo despliegue del commit que
contenga esta corrección; las pruebas locales no certifican la integración remota.
