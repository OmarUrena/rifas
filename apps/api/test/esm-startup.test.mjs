import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { fetch } from 'undici';

const require = createRequire(import.meta.url);
// Load the CommonJS build with require(ESM) disabled by the test command.
const { createApp } = require('../dist/bootstrap.js');
const { parseConfig } = require('../dist/config/config.js');
const { ReceiptService } = require('../dist/orders/receipt.service.js');
const { PDFDocument } = require('pdf-lib');

test('worker del build valida un PDF con el archivo JavaScript incluido en Vercel', { timeout: 15000 }, async () => {
  const config = parseConfig({ NODE_ENV: 'test' });
  const pdf = await PDFDocument.create();
  pdf.addPage();
  const bytes = await pdf.save();
  const receipt = await new ReceiptService(config).validate({
    buffer: bytes, size: bytes.length, mimetype: 'application/pdf',
  });
  assert.equal(receipt.mime, 'application/pdf');
  assert.equal(receipt.extension, 'pdf');
  assert.deepEqual(new Uint8Array(receipt.bytes), bytes);
});

test('build CommonJS arranca y verifica JWT con jose ESM sin require(ESM)', { timeout: 20000 }, async () => {
  const subject = randomUUID();
  const sessionId = randomUUID();
  const key = await generateKeyPair('ES256', { extractable: true });
  const foreign = await generateKeyPair('ES256');
  const jwk = { ...await exportJWK(key.publicKey), kid: 'esm-regression', alg: 'ES256', use: 'sig' };
  let jwksRequests = 0;
  let userRequests = 0;
  let deleted = false;
  let userApiKey;
  const issuerServer = createServer((request, response) => {
    response.setHeader('content-type', 'application/json');
    if (request.url === '/auth/v1/.well-known/jwks.json') {
      jwksRequests++;
      response.end(JSON.stringify({ keys: [jwk] }));
    } else if (request.url === '/auth/v1/user') {
      userRequests++;
      userApiKey = request.headers.apikey;
      response.statusCode = deleted ? 401 : 200;
      response.end(JSON.stringify(deleted ? {} : { id: subject, is_anonymous: false }));
    } else {
      response.statusCode = 404;
      response.end('{}');
    }
  });
  let app;
  try {
    await new Promise(resolve => issuerServer.listen(0, '127.0.0.1', resolve));
    const issuer = `http://127.0.0.1:${issuerServer.address().port}`;
    app = await createApp(parseConfig({
      NODE_ENV: 'test', LOG_LEVEL: 'silent', SWAGGER_ENABLED: 'false', RATE_LIMIT: '1000',
      SUPABASE_URL: issuer, SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_fixture',
    }));
    await app.listen(0, '127.0.0.1');
    const base = await app.getUrl();
    const health = await fetch(`${base}/api/v1/health`);
    assert.equal(health.status, 200);
    assert.deepEqual(await health.json(), { status: 'ok' });
    const request = async token => {
      const response = await fetch(`${base}/api/v1/admin/raffles`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      return { status: response.status, body: await response.json() };
    };
    const signed = async ({ privateKey = key.privateKey, audience = 'authenticated',
      tokenIssuer = `${issuer}/auth/v1`, expires = '5m' } = {}) => new SignJWT({
      role: 'authenticated', session_id: sessionId, is_anonymous: false,
    }).setProtectedHeader({ alg: 'ES256', kid: 'esm-regression' }).setSubject(subject)
      .setIssuer(tokenIssuer).setAudience(audience).setIssuedAt().setExpirationTime(expires).sign(privateKey);

    assert.equal((await request()).status, 401);
    for (const invalid of [
      await signed({ privateKey: foreign.privateKey }),
      await signed({ audience: 'other-audience' }),
      await signed({ tokenIssuer: `${issuer}/other-issuer` }),
      await signed({ expires: Math.floor(Date.now() / 1000) - 60 }),
    ]) assert.equal((await request(invalid)).status, 401);
    assert.equal(userRequests, 0, 'JWT inválido no consulta usuario ni llega a DB');

    const valid = await signed();
    const authorized = await request(valid);
    // Reaching the DB boundary proves JWT + authoritative Auth checks succeeded.
    assert.equal(authorized.status, 503);
    assert.equal(authorized.body.error.code, 'DATABASE_NOT_CONFIGURED');
    assert.equal(userRequests, 1);
    assert.equal(userApiKey, 'sb_publishable_fixture');

    deleted = true;
    assert.equal((await request(valid)).status, 401);
    assert.equal(userRequests, 2, 'la comprobación autoritativa se repite por solicitud');
    assert.equal(jwksRequests, 1, 'se conserva la caché JWKS entre solicitudes');
  } finally {
    await app?.close();
    issuerServer.closeAllConnections();
    await new Promise((resolve, reject) => issuerServer.close(error => error ? reject(error) : resolve()));
  }
});
