import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export function createDocument(app: INestApplication) {
  const document = SwaggerModule.createDocument(app, new DocumentBuilder()
    .setTitle('App Sorteos API').setDescription('Etapa 6: compra pública simplificada y disponibilidad informativa calculada por servidor; conserva comprobante obligatorio, idempotencia y consulta protegida.')
    .addCookieAuth('__Host-sorteos_guest',{type:'apiKey',in:'cookie',description:'Cookie HttpOnly de checkout-session; en desarrollo: sorteos_guest.'},'guestSession')
      .addBearerAuth().setVersion('0.12.1').build(), {
    operationIdFactory: (controller, method) => `${controller}_${method}`,
  });
  for (const path of Object.values(document.paths)) {
    for (const method of ['get', 'post', 'put', 'patch', 'delete'] as const) {
      const operation = path[method];
      if (!operation) continue;
      for (const status of ['400', '401', '403', '404', '409', '413', '415', '422', '429', '500', '503']) {
        operation.responses[status] ??= { description: 'Error uniforme', content: {
          'application/json': { schema: { $ref: '#/components/schemas/ErrorResponseDto' } },
        } };
      }
      operation.responses['429'] = { ...operation.responses['429'], description: 'Límite de solicitudes; respetar Retry-After antes de reintentar.',
        headers: { 'Retry-After': { description: 'Segundos de espera del límite HTTP.', schema: {type:'integer',minimum:1} } },
      };
    }
  }
  const order=document.paths['/api/v1/orders']?.post;
  if(order){
    order.responses['422']={...order.responses['422'],description:'INVALID_RECEIPT: archivo rechazado por validación; no equivale a fallo del servicio validador.'};
    order.responses['503']={...order.responses['503'],description:'RECEIPT_VALIDATION_UNAVAILABLE: worker no disponible, agotado o fallido; STORAGE_UNAVAILABLE: almacenamiento no disponible. Conservar el mismo envío para recuperación.'};
  }
  return document;
}
