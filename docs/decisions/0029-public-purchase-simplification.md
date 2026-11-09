# ADR 0029 — Una selección de cantidad y una orden con comprobante

La etapa 6 conserva el mecanismo de compra existente y simplifica su presentación. El detalle no mantiene una cantidad ficticia: enlaza a la selección real del checkout. Confirmar cupo sigue creando solo HELD sin números; «Enviar orden» envía datos y archivo juntos y obtiene la orden protegida con sus números RESERVED.

`canPurchase` en el catálogo es una proyección de estado/fechas/cupo mínimo calculada por NestJS, nunca una autorización para el POST posterior. La web puede mostrar menos compras posibles ante información desactualizada, pero no ignora el rechazo transaccional del servidor. Cien por ciento de progreso no altera esta proyección. El contrato compartido se regenera.

El resumen del hold, vencimiento y cuentas están antes del formulario, en la misma página y sin ocultar instrucciones bancarias necesarias. La confirmación prioriza estado y números, manteniendo el resumen monetario accesible mediante details. Se conservan invariantes de idempotencia, recuperación de respuestas perdidas, expiración de HELD, comprobante privado, revisión manual y no expiración de RESERVED.

Los textos y selectores de pruebas se actualizan a las etiquetas finales sin eliminar sus aserciones financieras. No se cambia esquema ni se introduce otro flujo de escritura, tema o proveedor.
