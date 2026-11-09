// Vercel detects NestJS from a direct import in the server entrypoint.
import '@nestjs/core';
import type { INestApplication } from '@nestjs/common';
import type { IncomingMessage, RequestListener, ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';
import { createApp } from './bootstrap';
import { loadConfig } from './config/load-config';
import { startupFailure } from './common/startup-error';

let startupPort: number | undefined;
let vercelApplication: Promise<INestApplication> | undefined;

async function initializeVercelApplication(): Promise<INestApplication> {
  const app = await createApp(loadConfig());
  try {
    await app.init();
    return app;
  } catch (error) {
    await app.close().catch(() => undefined);
    throw error;
  }
}

// Export a handler immediately; Vercel owns the socket and calls it per request.
export default async function handler(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const initializing = vercelApplication ??= initializeVercelApplication();
  let app: INestApplication;
  try {
    app = await initializing;
  } catch (error) {
    if (vercelApplication === initializing) vercelApplication = undefined;
    process.stderr.write(`${JSON.stringify(startupFailure(error))}\n`);
    const requestId = randomUUID();
    response.statusCode = 503;
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Request-Id', requestId);
    response.end(JSON.stringify({ error: {
      code: 'SERVICE_UNAVAILABLE', message: 'Servicio temporalmente no disponible.', details: {}, requestId,
    } }));
    return;
  }
  const listener = app.getHttpAdapter().getInstance() as RequestListener;
  listener(request, response);
}

async function main(): Promise<void> {
  const config = loadConfig();
  startupPort = config.port;
  const app = await createApp(config);
  try {
    await app.listen(config.port, config.host);
  } catch (error) {
    // Release pools, sweep timers and shutdown hooks when listen fails.
    await app.close().catch(() => undefined);
    throw error;
  }
}

if (process.env.VERCEL !== '1') {
  void main().catch((error: unknown) => {
    process.stderr.write(`${JSON.stringify(startupFailure(error, startupPort))}\n`);
    process.exitCode = 1;
  });
}
