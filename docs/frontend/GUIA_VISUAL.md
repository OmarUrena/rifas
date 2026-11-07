# App Sorteos — Guía visual de la aplicación web

Actualización 2026-11-07: la presentación pública vigente adopta el export de
Stitch proporcionado por el propietario. Ver [DISENO_STITCH.md](DISENO_STITCH.md)
y ADR 0022. Esta guía conserva el contexto histórico y las reglas de adaptación
al negocio; sus tokens iniciales quedan sustituidos por el nuevo tema público.

Fecha: 2026-10-29. Versión: 1.0, aprobada para iniciar F1.

**Estado: el propietario confirmó «Puedes empezar a trabajar». Se autoriza el diseño y la implementación de F1 conforme a esta guía, manteniendo las dependencias de las fases siguientes. No se autoriza un despliegue.**

## 1. Objetivo y alcance

Reorientar la interfaz de App Sorteos hacia una experiencia de aplicación web que se utilice principalmente desde el navegador del teléfono y también resulte cómoda en escritorio.

La referencia es la imagen adjunta por el propietario en la conversación: una composición de cuatro pantallas móviles con inicio, detalle de premio, selección de cantidad y pantalla de orden/pago. La imagen se describe aquí para conservar el criterio de diseño; no se ha guardado una copia del adjunto en el repositorio.

Esta guía define dirección estética, jerarquía, distribución responsive, componentes, estados y criterios de aceptación. Complementa [PLAN_FRONTEND.md](../PLAN_FRONTEND.md), [CONTRATO_API.md](../CONTRATO_API.md) y [MATRIZ_QA.md](../MATRIZ_QA.md). Las reglas de negocio de [AGENTS.md](../../AGENTS.md) siguen vigentes.

El cambio visual propuesto reemplaza, una vez aprobado, el fondo claro, el acento lima y la ilustración de boleto de la base F0. La base funcional, la accesibilidad y el cliente API compartido se conservan. La decisión visual queda registrada como propuesta en este documento; no modifica todavía el ADR de F0 ni sus estilos implementados.

## 2. Dirección visual

**Concepto: una experiencia de premios de carácter premium, oscura, fotográfica y fácil de utilizar con una mano.**

| Rasgo observado en la referencia | Aplicación propuesta |
| --- | --- |
| Negro con reflejos verdes | Fondos oscuros con matiz petróleo y superficies diferenciadas |
| Dorado cálido | Acción principal, precio, selección y detalles puntuales |
| Fotografías grandes | El premio es el protagonista de inicio, tarjetas y detalle |
| Títulos con serif | Identidad editorial en títulos de premios y encabezados |
| Texto funcional sans serif | Lectura clara en formularios, navegación, estados y cifras |
| Tarjetas con bordes finos | Agrupar contenido sin recargarlo con sombras |
| Barra inferior móvil | Acceso rápido a secciones públicas habilitadas |
| Botones anchos | Acción principal visible, con superficie táctil generosa |
| Composición compacta | Información útil cerca del premio y pocas acciones simultáneas |

El tono debe sentirse cuidado y sobrio. Los destellos, reflejos y degradados acompañan al contenido; la lectura y la respuesta de los controles tienen prioridad. El primer recorrido debe permitir entender qué se ofrece, cuánto cuesta, qué disponibilidad existe y qué ocurrirá al participar.

## 3. Adaptación de la referencia al producto

La estética orienta el diseño. Los importes, fechas, bancos, premios y afirmaciones comerciales mostrados en la imagen no constituyen datos del proyecto.

| Elemento de la referencia | Tratamiento en App Sorteos |
| --- | --- |
| Vehículo, portátil y sus especificaciones | Usar premios configurados por el administrador; las muestras visuales deberán identificarse como DEMO |
| Corona y logotipo | Mantener el nombre App Sorteos y diseñar una identidad propia al aprobarse el trabajo; el isotipo queda por definir |
| Corazones/favoritos | Fuera del alcance inicial; incorporar solo con comportamiento y persistencia definidos |
| Búsqueda | Mostrar cuando permita buscar contenido disponible; no incluir un icono sin acción |
| Perfil de comprador | La compra es como invitado; no introducir registro o cuenta obligatoria |
| «Mis órdenes» | Acceso mediante sesión protegida o recuperación verificada cuando exista; el código público nunca basta |
| «Garantía oficial», entrega o especificaciones | Mostrar únicamente información confirmada para ese premio |
| Fecha de sorteo o «sorteo en vivo» | Mostrar solo fechas y modalidad aprobadas, sin inventar un evento |
| Porcentaje vendido | Usar únicamente boletos SOLD confirmados; distinguir reservas y cupo disponible |
| «Mayor cantidad, más oportunidades» | Priorizar instrucciones sobre cantidad, límites y coste; sin prometer premios o probabilidades no calculadas |
| «¡Orden creada!» antes de subir comprobante | Mover la confirmación después del envío único de datos y archivo válido |
| Banco, titular y número de cuenta del ejemplo | No copiarlos; consumir datos publicados y aprobados desde la API |
| Referencia de orden para transferir | Mostrar una referencia previa solo si el backend la define para esa etapa; no inventar un código de orden antes del envío |

## 4. Paleta y materiales

Los siguientes valores son tokens de partida propuestos. Se deberán comprobar sobre los componentes finales, incluyendo fotografías, transparencias, degradados y estados interactivos.

| Token visual | Valor inicial | Uso |
| --- | --- | --- |
| Fondo principal | `#070E0F` | Fondo general de la aplicación |
| Fondo de sección | `#0B1517` | Separación suave de bloques |
| Superficie | `#101A1C` | Tarjetas y formularios |
| Superficie elevada | `#182426` | Resúmenes, menús y diálogos |
| Borde decorativo | `#344447` | Divisiones y contenedores |
| Borde de control | `#667975` | Inputs y controles que necesitan contorno reconocible |
| Texto principal | `#F6F1E7` | Títulos y contenido destacado |
| Texto secundario | `#B8C2BE` | Descripciones, etiquetas y metadatos |
| Texto auxiliar | `#94A39D` | Ayuda y datos de menor jerarquía |
| Dorado principal | `#E7C474` | Precios, selección e iconos de énfasis |
| Dorado profundo | `#B5873D` | Extremo inferior del botón dorado |
| Dorado claro | `#F5D88A` | Foco visible y extremo superior del botón |
| Texto sobre dorado | `#17130A` | Texto e iconos del botón principal |
| Confirmación | `#91D3B0` | Pago confirmado y acciones completadas |
| Advertencia | `#F4CD78` | Pendiente, vencimiento cercano y revisión |
| Error | `#FFA5A0` | Validaciones y fallos que requieren atención |
| Información | `#9BCBDF` | Avisos neutrales |

### Superficies y efectos

- El fondo principal debe ser estable y ligero. Un degradado ambiental muy suave puede acompañar la cabecera o el hero.
- Las tarjetas tendrán fondo suficientemente opaco para leer sobre cualquier fotografía. El efecto de cristal, si se usa, será secundario y contará con fondo alternativo sin desenfoque.
- El botón principal puede usar un degradado vertical de dorado claro a dorado profundo, con texto oscuro y borde discreto.
- Reservar el brillo para énfasis puntual; no aplicar resplandores a cada tarjeta, texto o icono.
- Sobre imágenes, usar una capa oscura donde haya texto. Comprobar contraste con la foto real y en todos los recortes.
- Los colores de estado se acompañarán siempre de texto y, cuando ayude, un icono.

## 5. Tipografía y jerarquía

Se proponen dos familias visuales: serif editorial para títulos y sans serif para interacción. La selección final de fuentes se hará en la etapa de diseño aprobada, con licencia compatible y carga local. Para el primer ajuste pueden utilizarse Georgia y una sans serif de sistema.

| Elemento | Teléfono | Escritorio | Criterio |
| --- | --- | --- | --- |
| Título principal | 30–36 px | 44–56 px | Serif, pocas líneas, sin desplazar excesivamente el contenido |
| Título de premio | 24–28 px | 32–40 px | Serif; permitir nombre completo |
| Título de tarjeta | 20–24 px | 22–26 px | Serif, legible sin depender de la fotografía |
| Encabezado de sección | 20–24 px | 26–32 px | Jerarquía clara entre bloques |
| Cuerpo e inputs | 16 px | 16–18 px | Sans serif, interlineado aproximado 1.5 |
| Texto secundario | 14 px | 14–16 px | Evitar reducir instrucciones importantes |
| Etiquetas pequeñas | 12–13 px | 12–13 px | Solo metadatos breves, nunca instrucciones críticas |
| Precio o total | 24–30 px | 28–36 px | Cifras claras; diferenciar por boleto y total |

Mantener el formato monetario dominicano con prefijo `RD$` y centavos cuando correspondan. La capa de presentación recibe importes en unidades menores; el servidor sigue calculando precios y totales. Usar cifras tabulares en cantidades, precios y temporizadores cuando la fuente lo permita.

## 6. Espaciado, formas e iconografía

- Escala de espaciado: 4, 8, 12, 16, 24, 32 y 48 px.
- Márgenes laterales móviles: 16 px; ampliar a 20–24 px cuando el ancho lo permita.
- Separación entre bloques relacionados: 12–16 px. Entre secciones: 24–32 px.
- Radio de tarjeta: 16–20 px. Radio de botón e input: 10–12 px. Badges: forma de píldora.
- Altura objetivo de botón principal: 52–56 px. Controles e iconos accionables: área táctil mínima de 44 × 44 px, preferentemente 48 × 48 px.
- Iconos de trazo consistente, 20–24 px, con una sola familia visual. Las acciones que puedan resultar ambiguas tendrán etiqueta visible.
- Evitar emojis como sustituto del sistema de iconos final.
- La aplicación ocupa el viewport del navegador. Los marcos redondeados de teléfono de la referencia representan la composición del ejemplo; no se dibujarán dentro de la web.

## 7. Distribución responsive

El diseño se construirá primero para 360 px y se ampliará según el espacio disponible. El contenido podrá crecer con el texto y el zoom, sin alturas de pantalla rígidas.

| Ancho de referencia | Distribución propuesta |
| --- | --- |
| 360–430 px | Una columna; navegación inferior; controles de ancho generoso; detalle y formulario en flujo vertical |
| 768–1023 px | Más aire, hasta dos columnas en catálogo cuando las tarjetas sigan siendo legibles; navegación adaptada al espacio |
| 1024–1279 px | Cabecera de escritorio; detalle en dos columnas; formulario con resumen lateral si cabe |
| 1280 px o más | Contenedor centrado de hasta 1200 px; catálogo de tres columnas; detalle amplio; resumen lateral contenido |

### Teléfono

Cabecera compacta de unos 56–64 px. En inicio, marca y acceso al menú; en detalle o compra, volver y título de contexto. La navegación inferior tendrá entre tres y cuatro destinos reales, icono y etiqueta: Inicio, Rifas y Ayuda; Consulta de orden se agregará cuando exista el acceso protegido. Las rutas pendientes no se mostrarán como acciones funcionales.

La barra inferior y los botones fijos deberán respetar el área segura del dispositivo. El contenido tendrá espacio inferior para no quedar oculto. En la compra, la acción contextual podrá sustituir a la navegación inferior para mantener visible una sola acción principal. Al abrir el teclado, priorizar el campo enfocado y evitar que los elementos fijos lo tapen.

### Escritorio

Usar el ancho disponible con estructura de aplicación: cabecera, navegación y contenido centrado. La portada puede disponer imagen y mensaje en dos columnas; el detalle presenta galería a la izquierda e información a la derecha. En la compra, el formulario ocupa la columna principal y el resumen puede permanecer visible en una columna lateral. El resumen deja de ser fijo si no cabe en la altura disponible.

No ampliar una pantalla estrecha para llenar el monitor ni dejar el contenido restringido a una franja de teléfono. Mantener el mismo orden lógico de lectura en ambos dispositivos.

## 8. Pantallas de referencia para la futura implementación

Estas especificaciones describen el resultado esperado una vez autorizada la fase correspondiente. No indican que esas funciones estén implementadas.

### 8.1 Inicio — `/`

Orden de contenido móvil:

1. Cabecera compacta con marca y navegación.
2. Hero de un premio destacado, con fotografía autorizada, título breve y acción «Ver rifa» o «Explorar rifas».
3. Sección «Rifas activas», con acceso a ver el catálogo completo.
4. Tarjetas con fotografía, título, precio por boleto, disponibilidad y acción «Ver rifa» o «Participar» según el contexto y la integración disponible.
5. Explicación breve de cómo funciona la compra y acceso a reglas/ayuda.
6. Navegación inferior móvil.

El hero debe dejar entrever contenido útil debajo. Priorizar una imagen estática bien compuesta; cualquier carrusel posterior requerirá controles accesibles, pausa y ausencia de movimiento automático por defecto. No dibujar indicadores de carrusel en una imagen estática.

### 8.2 Catálogo — `/rifas`

Título, descripción breve y lista de tarjetas. En móvil, una tarjeta por fila; a mayor ancho, cuadrícula. Imagen suficientemente grande para reconocer el premio, con título y datos sobre superficie sólida. No colocar un botón dentro del enlace global de tarjeta ni superponer acciones que dificulten tocar el destino correcto.

Los filtros o la búsqueda se incorporarán cuando haya una fuente real o fixtures de desarrollo con comportamiento explícito. Contemplar desde el diseño catálogo vacío, cargando, error y estados pausado/cerrado/agotado.

### 8.3 Detalle — `/rifas/[slug]`

1. Volver y título de contexto; compartir únicamente información pública si se implementa esa acción.
2. Galería fotográfica del premio.
3. Título, descripción breve y etiqueta de estado.
4. Precio por boleto, total de boletos y fecha confirmada cuando exista.
5. Disponibilidad y porcentaje de vendidos confirmados, con texto explícito.
6. Información del premio respaldada por datos disponibles.
7. Descripción, cómo participar y reglas en secciones legibles. Si se utilizan tabs, implementar navegación por teclado y conservar el acceso al contenido en móvil.
8. Acción «Participar», visible según el estado de la rifa y su disponibilidad.

En móvil, un CTA inferior puede facilitar la acción al terminar de revisar. No deberá cubrir reglas o información. Cuando no haya cupo, mostrar «Sin cupo disponible» y explicar el estado; no afirmar que todo está vendido si existen reservas pendientes.

### 8.4 Participación — `/rifas/[slug]/participar`

Conservar la claridad de la referencia mediante un indicador de tres etapas: **Cantidad · Transferencia y comprobante · Confirmación**. El indicador describe el progreso; no crea órdenes intermedias ni obliga a separar los datos y el archivo en formularios distintos.

Primera etapa: premio resumido, selector de cantidad con controles menos/más e input editable, límites y una cotización claramente identificada cuando todavía no haya hold confirmado. «Continuar a transferencia» solicita cupo al servidor. Al obtenerlo, se habilitan las secciones de transferencia en la misma ruta y formulario.

El formulario contendrá:

- Resumen del premio, cantidad, precio y total confirmado por servidor.
- Aviso «Cupo reservado temporalmente» y contador visible de vencimiento.
- Datos personales con etiquetas permanentes y ayuda contextual.
- Instrucciones y cuenta bancaria publicada, con copiar y confirmación accesible de la copia.
- Referencia y fecha de transferencia según contrato.
- Selector obligatorio de comprobante, formatos/tamaño permitidos, vista previa local y opción de reemplazar o quitar.
- Consentimientos y acceso a las versiones de reglas/privacidad correspondientes.
- Un único botón final: **«Enviar orden y comprobante»**.

Seleccionar un archivo no crea una orden. La pre-reserva tampoco muestra números. Si el cupo vence, bloquear el envío y ofrecer ayuda si la persona ya transfirió. No iniciar una nueva transferencia o generar una orden automáticamente.

En escritorio, el resumen puede ir a la derecha y las secciones a la izquierda. En móvil, presentar bloques consecutivos con ayudas breves, evitando un asistente de pantallas que esconda datos necesarios para transferir.

### 8.5 Confirmación protegida

La confirmación aparece únicamente después de la respuesta exitosa de creación conjunta de orden y comprobante.

Jerarquía propuesta:

1. Icono de recepción completada con tratamiento dorado moderado.
2. Título **«Orden y comprobante recibidos»**.
3. Estado visible **«Pendiente de verificación de pago»**.
4. Código de orden, premio, cantidad, total y números asignados por el servidor.
5. Explicación: los números están reservados mientras se verifica manualmente el ingreso.
6. Acceso seguro para consultar el estado o instrucciones de recuperación disponibles.

El check indica recepción de la orden, no pago aprobado. La aprobación bancaria posterior tendrá su estado «Pago confirmado» y tratamiento visual propio. La confirmación no vuelve a pedir una transferencia ni una primera carga de comprobante. No exponer nombre, teléfono, archivo o números por una URL pública basada solo en el código.

### 8.6 Ayuda, consulta y administración

Ayuda, términos y privacidad compartirán el sistema visual, con prioridad de lectura y contenido aprobado. La consulta de orden reutilizará los estados y necesitará sesión o verificación segura. La administración podrá usar las mismas bases cromáticas, pero con tablas, filtros y auditoría orientados a operar; su diseño detallado corresponde a la fase administrativa.

## 9. Componentes que deben compartir las pantallas

| Componente | Criterio visual y funcional |
| --- | --- |
| Cabecera y navegación | Compactas en móvil; destino activo marcado por icono/texto además del color |
| Botón principal | Dorado con texto oscuro, etiqueta inequívoca y estado de procesamiento |
| Botón secundario | Fondo oscuro y contorno reconocible; menor jerarquía |
| Tarjeta de rifa | Foto, título, estado y datos legibles; una acción principal |
| Galería | Recortes consistentes y navegación usable con teclado y tacto |
| Etiqueta de estado | Texto específico; no convertir todo estado en «activo» o «exitoso» |
| Medidor de disponibilidad | Proporción y texto coherentes; distinguir vendido, reservado, held y disponible |
| Selector de cantidad | Botones e input accesibles, límites visibles y sin selección de números |
| Resumen de compra | Importe claro, datos del servidor y cambios anunciados |
| Temporizador | Vencimiento absoluto del servidor; anunciar hitos, sin leer cada segundo |
| Instrucciones de transferencia | Cuenta aprobada, monto y copiar; sin bancos ficticios presentados como reales |
| Carga de comprobante | Selección táctil, formatos y tamaño, archivo seleccionado y errores comprensibles |
| Aviso/alerta | Icono, título breve y acción de recuperación cuando corresponda |
| Loading/empty/error | Mismo sistema oscuro; mensajes y acciones coherentes con el estado real |

## 10. Estados y lenguaje

| Situación | Mensaje o tratamiento esperado |
| --- | --- |
| Datos cargando | Esqueleto con tamaño estable y anuncio accesible; sin cifras provisionales que parezcan reales |
| Catálogo vacío | «No hay rifas publicadas en este momento», cuando esa sea la respuesta real |
| Sin conexión / error | Mensaje claro y reintento explícito; conservar lo necesario de forma segura |
| Rifa pausada | Etiqueta «Pausada», explicación y participación bloqueada |
| Sin disponibilidad | «No hay cupo disponible en este momento»; distinguirlo de vendido confirmado |
| Hold activo | «Cupo reservado temporalmente»; sin números |
| Hold vencido | «La reserva temporal de cupo venció. Si ya transferiste, solicita asistencia» |
| Envío en proceso | Botón bloqueado y anuncio de procesamiento, sin porcentaje ficticio |
| Orden recibida | «Orden y comprobante recibidos» y «Pendiente de verificación de pago» |
| Requiere resolución | «Tu orden requiere revisión; tus números siguen reservados» |
| Pago aprobado por admin | «Pago confirmado»; solo cuando el servidor lo confirme |
| Demo | Banda visible «DEMO · Sin transacciones reales», incluso con fotografías convincentes |

Evitar urgencia artificial, testimonios inventados, fechas sin aprobar, afirmaciones de seguridad absoluta o disponibilidad calculada en el navegador. Los números de una orden con comprobante no muestran un contador de liberación automática.

## 11. Accesibilidad, movimiento y rendimiento

- Contraste objetivo: al menos 4.5:1 en texto normal y 3:1 en texto grande; componentes y estados gráficos esenciales reconocibles frente al fondo con contraste adecuado. Validar cada combinación final.
- Foco visible en dorado claro, sin depender exclusivamente de cambios sutiles de brillo.
- Uso completo con teclado, zoom al 200 % y redistribución del contenido al ampliar texto. Comprobar también 320 px como prueba de estrés.
- Formularios con etiquetas asociadas, ayuda vinculada y errores en el campo y resumen cuando convenga. No usar el placeholder como única etiqueta.
- Verificar comportamiento del selector de archivo en navegador móvil y formatos aceptados por el backend.
- Respetar prefers-reduced-motion. Transiciones discretas de unos 120–200 ms; ningún contenido esencial dependerá de una animación.
- No utilizar video de fondo ni partículas/confeti permanentes. Un efecto de recepción, si se aprueba, será breve, prescindible y no representará aprobación de pago.
- Fotografías propias o autorizadas, con dimensiones reservadas y tamaños adaptados al dispositivo. Cargar de forma diferida las imágenes fuera de la primera pantalla.
- Revisar el foco, las áreas seguras y la visibilidad del botón al abrir el teclado móvil, rotar el dispositivo y volver de una pestaña suspendida.
- Medir el rendimiento durante la implementación; este documento no afirma métricas ni accesibilidad ya verificadas para el rediseño.

## 12. Activos y decisiones de contenido

Se necesitarán imágenes propias o con permiso para los premios que realmente se publiquen. La referencia sirve para encuadre, iluminación y ambiente; no autoriza copiar marcas, fotografías o código de terceros.

Las imágenes de demostración se identificarán en el entorno local. No sustituir una fotografía pendiente por una representación que parezca confirmar un premio real. Mientras falte un activo, utilizar un placeholder honesto y mantener el espacio previsto.

La composición nocturna con luz cálida puede orientar los recursos, pero el producto fotografiado debe verse con claridad. Mantener la misma familia de recortes y tratamiento entre tarjetas y galería.

Decisiones todavía por cerrar durante el diseño autorizado: isotipo definitivo, fuentes finales y activos propios. Estas decisiones no implican agregar favoritos, perfiles, sorteos reales ni nuevas formas de pago.

## 13. Secuencia de trabajo después de la confirmación

| Etapa | Entregable | Límite |
| --- | --- | --- |
| Aprobación de esta guía | Dirección visual y ajustes solicitados por el propietario | Requerida antes de diseñar o construir |
| Diseño visual F1 | Composiciones móvil/escritorio, tokens y componentes de catálogo/detalle | Fixtures explícitos; sin checkout real |
| Implementación F1 | Inicio, catálogo y detalle responsive según guía aprobada | No agregar endpoints o éxitos simulados |
| Integración F2 | Catálogo conectado al contrato backend disponible | Depende de B2 |
| Compra F3–F4 | Cantidad, hold, formulario único y confirmación protegida | Depende de B3/B4 |
| Operación F5–F6 | Revisión administrativa y consulta protegida | Según fases y contratos correspondientes |

No implementar todas estas etapas en un mismo cambio. La autorización de una fase define su alcance; la existencia de una especificación visual de compra no adelanta sus dependencias.

## 14. Criterios para revisar el futuro diseño

- [ ] El conjunto se reconoce como una aplicación de uso frecuente en teléfono: cabecera compacta, navegación clara y acciones al alcance del pulgar.
- [ ] Fondos oscuros, dorado moderado, fotos protagonistas y títulos editoriales mantienen coherencia en todas las pantallas.
- [ ] El diseño de escritorio aprovecha el espacio con columnas y conserva la misma jerarquía de información.
- [ ] Inicio, catálogo, detalle y estados vacíos/cargando/error tienen composiciones resueltas.
- [ ] Hay capturas revisables a 360, 768 y 1280 px, sin desbordamiento ni botones ocultos.
- [ ] Se comprueban contraste, foco, teclado, zoom y controles táctiles sobre los componentes implementados.
- [ ] Las cantidades y estados distinguen vendido confirmado, reserva y cupo temporal.
- [ ] El comprador indica cantidad y recibe números solo al crear la orden con comprobante.
- [ ] La confirmación de recepción no comunica aprobación del pago.
- [ ] No aparecen bancos, fechas, premios, permisos o garantías inventados.
- [ ] Cada control visible tiene comportamiento dentro del alcance; los datos demo están identificados.
- [ ] Lint, typecheck, build y pruebas relevantes del cambio se ejecutan y reportan con resultados reales.

**Punto de control actualizado: confirmación recibida. Implementar F1 y registrar su validación; las fases de compra, autenticación e integración siguen sus propias dependencias.**
