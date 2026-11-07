import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export function createDocument(app: INestApplication) {
  const document = SwaggerModule.createDocument(app, new DocumentBuilder()
    .setTitle('App Sorteos API').setDescription('M6: límites HTTP compartidos, errores uniformes y observabilidad sin PII; conserva catálogo, compra con comprobante y conciliación manual.')
    .addCookieAuth('__Host-sorteos_guest',{type:'apiKey',in:'cookie',description:'Cookie HttpOnly de checkout-session; en desarrollo: sorteos_guest.'},'guestSession')
    .addBearerAuth().setVersion('0.7.0').build(), {
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
  return document;
}
