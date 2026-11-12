import { createHmac, timingSafeEqual } from 'node:crypto';
import { HttpException } from '@nestjs/common';
import { Request } from 'express';
import { AppConfig } from '../config/config';

const proxyClients = new WeakMap<Request, string>();

/** Authenticate only our relay. Never turn on Express trust proxy globally. */
export function authenticateCheckoutProxy(request: Request, config: AppConfig, now = Date.now()) {
  const names = ['x-sorteos-client-key', 'x-sorteos-proxy-time', 'x-sorteos-proxy-signature'];
  if (!names.some(name => request.headers[name] !== undefined)) return;
  const [clientKey, timestamp, signature] = names.map(name => request.headers[name]);
  const deny = () => { throw new HttpException({code:'FORBIDDEN'},403); };
  if (!config.checkoutProxySecret || typeof clientKey !== 'string' || !/^[a-f0-9]{64}$/.test(clientKey)
    || typeof timestamp !== 'string' || !/^\d{13}$/.test(timestamp) || Math.abs(now - Number(timestamp)) > 60000
    || typeof signature !== 'string' || !/^[a-f0-9]{64}$/.test(signature)
    || !config.corsOrigins.includes(request.headers.origin ?? '')) return deny();
  const expected = createHmac('sha256',config.checkoutProxySecret).update(JSON.stringify([
    request.method, request.originalUrl, request.headers.origin, timestamp, clientKey,
  ])).digest();
  if (!timingSafeEqual(expected,Buffer.from(signature,'hex'))) return deny();
  proxyClients.set(request,`checkout-proxy-v1:${clientKey}`);
}

export function clientAddress(request: Request): string {
  return proxyClients.get(request) ?? request.ip ?? request.socket.remoteAddress ?? '';
}
