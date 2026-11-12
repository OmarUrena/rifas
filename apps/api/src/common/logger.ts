import { LoggerService } from '@nestjs/common';
import pino, { Logger } from 'pino';
import { AppConfig } from '../config/config';

export class SafeLogger implements LoggerService {
  readonly output: Logger;

  constructor(level: AppConfig['logLevel']) {
    this.output = pino({ level, base: undefined, redact: {
      paths: ['req', 'res', 'body', 'headers', 'authorization', 'cookie', 'password', 'token',
        'phone', 'email', 'customerName', 'customerPhone', 'customerEmail', 'databaseUrl',
        'storageKey','supabaseStorageKey','developmentMfaToken','ADMIN_DEVELOPMENT_MFA_TOKEN','receipt','buffer',
        'checkoutProxySecret','CHECKOUT_PROXY_SECRET'],
      remove: true,
    } });
  }

  // Nest puede recibir excepciones arbitrarias; registrar solo el nivel y contexto fijo.
  log(_message: unknown) { this.output.info({ event: 'framework_info' }); }
  warn(_message: unknown) { this.output.warn({ event: 'framework_warning' }); }
  error(_message: unknown) { this.output.error({ event: 'framework_error' }); }
  debug(_message: unknown) { this.output.debug({ event: 'framework_debug' }); }
  verbose(_message: unknown) { this.output.trace({ event: 'framework_trace' }); }
}
