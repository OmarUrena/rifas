import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { Server } from 'node:http';
import { INestApplication, ForbiddenException } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';
import { json, NextFunction, Request, Response, urlencoded } from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AppConfig } from './config/config';
import { ApiExceptionFilter, validationPipe } from './common/errors';
import { SafeLogger } from './common/logger';
import { createDocument } from './openapi';
import { authenticateCheckoutProxy } from './common/client-address';

export function configureApp(app: INestApplication, config: AppConfig, logger: SafeLogger): void {
  app.getHttpAdapter().getInstance().set('trust proxy', false);
  const server = app.getHttpServer() as Server;
  server.headersTimeout = 15000;
  server.requestTimeout = 120000;
  server.keepAliveTimeout = 5000;
  server.maxHeadersCount = 100;
  server.maxRequestsPerSocket = 1000;
  app.setGlobalPrefix('api/v1');
  app.use((req: Request, res: Response, next: NextFunction) => {
    const requestId = randomUUID();
    const start = performance.now();
    res.setHeader('X-Request-Id', requestId);
    res.setHeader('Cache-Control', 'no-store');
    res.on('finish', () => {
      // Route categories come from fixed registered patterns, never raw URLs or parameters.
      const pattern = String(req.route?.path ?? '');
      const routeGroup = pattern.startsWith('/api/v1/health') ? 'health'
        : pattern.startsWith('/api/v1/checkout') ? 'checkout'
        : pattern.startsWith('/api/v1/admin') ? 'admin'
        : pattern.startsWith('/api/v1/orders') ? 'orders'
        : pattern.startsWith('/api/v1/raffles') ? 'catalog' : 'other';
      const level = res.statusCode >= 500 ? 'error' : res.statusCode === 429 ? 'warn' : 'info';
      logger.output[level]({ event: 'http_request', requestId, method: req.method, routeGroup,
        status: res.statusCode, durationMs: Math.round(performance.now() - start), errorCode: res.locals.errorCode,
      });
    });
    next();
  });
  app.use((req: Request, _res: Response, next: NextFunction) => {
    try { authenticateCheckoutProxy(req,config); next(); }
    catch (error) { next(error); }
  });
  app.use(helmet());
  app.enableCors({
    origin: (origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) => {
      if (!origin || config.corsOrigins.includes(origin)) callback(null, true);
      else callback(new ForbiddenException(), false);
    },
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key'],
    exposedHeaders: ['X-Request-Id'], maxAge: 600,
  });
  app.use(json({ limit: '64kb' }));
  app.use(urlencoded({ extended: false, limit: '64kb' }));
  app.useGlobalPipes(validationPipe());
  app.useGlobalFilters(new ApiExceptionFilter());
  if (config.swaggerEnabled) SwaggerModule.setup('api/v1/docs', app, createDocument(app), {
    jsonDocumentUrl: 'api/v1/openapi.json',
    swaggerOptions: { persistAuthorization: false },
  });
}

export async function createApp(config: AppConfig): Promise<INestApplication> {
  const logger = new SafeLogger(config.logLevel);
  const app = await NestFactory.create(AppModule.register(config), { logger, bodyParser: false });
  configureApp(app, config, logger);
  app.enableShutdownHooks();
  return app;
}
