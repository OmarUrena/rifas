import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, ValidationPipe } from '@nestjs/common';
import { Request, Response } from 'express';
import { ApiProperty } from '@nestjs/swagger';

export class ErrorDetailDto {
  @ApiProperty() code!: string;
  @ApiProperty() message!: string;
  @ApiProperty({ type: Object, additionalProperties: true }) details!: Record<string, unknown>;
  @ApiProperty({ format: 'uuid' }) requestId!: string;
}

export class ErrorResponseDto {
  @ApiProperty({ type: ErrorDetailDto }) error!: ErrorDetailDto;
}

export function validationPipe(): ValidationPipe {
  return new ValidationPipe({
    transform: true, whitelist: true, forbidNonWhitelisted: true,
    validationError: { target: false, value: false },
    exceptionFactory: () => new HttpException({ code: 'INVALID_REQUEST' }, HttpStatus.BAD_REQUEST),
  });
}

const errorMap: Record<number, [string, string]> = {
  400: ['INVALID_REQUEST', 'La solicitud no es válida.'],
  401: ['UNAUTHORIZED', 'Se requiere autenticación.'],
  403: ['FORBIDDEN', 'No tienes permiso para realizar esta acción.'],
  404: ['NOT_FOUND', 'Recurso no encontrado.'],
  409: ['CONFLICT', 'La operación entra en conflicto con el estado actual.'],
  413: ['FILE_TOO_LARGE', 'La solicitud supera el tamaño permitido.'],
  415: ['UNSUPPORTED_FILE_TYPE','Adjunta un comprobante JPG, PNG o PDF.'],
  422: ['INVALID_REQUEST', 'Los datos no cumplen las reglas de la operación.'],
  429: ['RATE_LIMITED', 'Demasiadas solicitudes; inténtalo más tarde.'],
  500: ['INTERNAL_ERROR', 'No pudimos procesar la solicitud.'],
  503: ['SERVICE_UNAVAILABLE', 'Servicio temporalmente no disponible.'],
};

const domainErrors: Record<string,number> = {
  LOOKUP_UNAVAILABLE:503,
  LOTTERY_NOT_ELIGIBLE:409,
  PRIZES_NOT_READY:503,PRIZES_LOCKED:409,INVALID_PRIZE:422,PRIZE_CAPACITY_EXCEEDED:422,BLESSED_NUMBER_EXISTS:409,
  CLOSE_REQUIRES_PAUSE:409,ACTIVE_HOLDS_EXIST:409,EXPORT_TOO_LARGE:422,
  MFA_REQUIRED:403,ADMIN_ACCESS_REVOKED:403,SESSION_REVOKED:401,
  INVALID_DATE_RANGE:422,AMOUNT_MISMATCH:422,DUPLICATE_REVIEW_REQUIRED:422,RECONCILIATION_REQUIRED:422,INVALID_ORDER_STATE:409,
  SESSION_INVALID:401,INVALID_QUANTITY:422,INSUFFICIENT_TICKETS:409,RAFFLE_NOT_AVAILABLE:409,
  IDEMPOTENCY_CONFLICT:409,HOLD_CONSUMED:409,
  HOLD_EXPIRED:409,RULES_CHANGED:409,INVALID_RECEIPT:422,UNSUPPORTED_FILE_TYPE:415,
  STORAGE_UNAVAILABLE:503,INVALID_BANK_ACCOUNT:422,INVALID_TRANSFER_DATE:422,
  DATABASE_NOT_CONFIGURED:503,DATABASE_UNAVAILABLE:503,AUTH_UNAVAILABLE:503,MEDIA_UNAVAILABLE:503,
  INVALID_MEDIA:422,PUBLICATION_REQUIREMENTS_NOT_MET:422,INVALID_RAFFLE:422,
  RAFFLE_NOT_EDITABLE:409,RAFFLE_FIELDS_LOCKED:409,INVALID_RAFFLE_STATE:409,CONCURRENT_MODIFICATION:409,
};

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const request = host.switchToHttp().getRequest<Request>();
    if (response.headersSent) return;
    const parserType = typeof exception === 'object' && exception !== null && 'type' in exception
      ? exception.type : undefined;
    const sqlCode = typeof exception === 'object' && exception !== null && 'code' in exception ? String(exception.code) : '';
    const status = exception instanceof HttpException ? exception.getStatus()
      : parserType === 'entity.parse.failed' ? 400 : parserType === 'entity.too.large' ? 413
      : sqlCode==='P0502' ? 401 : ['P0501','P0503'].includes(sqlCode)?403
      : sqlCode==='23505' ? 409 : ['23514','23503','23502','22007'].includes(sqlCode) ? 422
      : ['42501','42P01','42704','ECONNREFUSED','ETIMEDOUT','57014'].includes(sqlCode) ? 503 : 500;
    const [code, message] = errorMap[status] ?? errorMap[500]!;
    const payload = exception instanceof HttpException ? exception.getResponse() : undefined;
    // Solo códigos conocidos del servidor; jamás texto de excepción o valores del DTO.
    const readinessCode = typeof payload === 'object' && payload !== null && 'code' in payload
      && domainErrors[String(payload.code)] === status
      ? String(payload.code) : undefined;
    response.locals.errorCode = readinessCode ?? code;
    response.status(status).json({ error: {
      code: readinessCode ?? code, message, details: {}, requestId: request.res?.getHeader('X-Request-Id'),
    } });
  }
}
