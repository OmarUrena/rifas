import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import process from 'node:process';
import { test } from 'node:test';
import { fetch } from 'undici';

test('entrypoint compilado exporta handler, diagnostica configuración y recupera el arranque', { timeout: 20000 }, async () => {
  const overrides = {
    VERCEL: '1', NODE_ENV: 'production', HOST: '127.0.0.1', PORT: '3001',
    LOG_LEVEL: 'silent', SWAGGER_ENABLED: 'false', HTTP_RATE_STORE: 'postgres',
    CORS_ORIGINS: 'https://frontend.example.invalid', CHECKOUT_ABUSE_HASH_KEY: 'SECRET_FIXTURE_'.repeat(4),
    DATABASE_URL: '', DATABASE_SSL: 'true', SUPABASE_URL: '', SUPABASE_PUBLISHABLE_KEY: '', SUPABASE_STORAGE_KEY: '',
    DEVELOPMENT_LOCAL_RECEIPTS: 'false', DEVELOPMENT_LOCAL_MEDIA: 'false',
    ADMIN_DEVELOPMENT_MFA_TOKEN: '', ADMIN_DEVELOPMENT_MFA_UNTIL: '', HTTP_DNS_FAMILY: 'auto',
  };
  const previous = Object.fromEntries(Object.keys(overrides).map(key => [key, process.env[key]]));
  const previousExitCode = process.exitCode;
  const originalWrite = process.stderr.write;
  const logs = [];
  let server;
  try {
    Object.assign(process.env, overrides);
    const require = createRequire(import.meta.url);
    const handler = require('../dist/main.js').default;
    assert.equal(typeof handler, 'function', 'el entrypoint real debe exportar una función');
    assert.equal(process.exitCode, previousExitCode, 'importar el entrypoint no inicia un listener ni mata el proceso');
    server = createServer(handler);
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${server.address().port}/api/v1`;

    process.stderr.write = chunk => { logs.push(String(chunk)); return true; };
    const unavailable = await fetch(`${base}/health`);
    process.stderr.write = originalWrite;
    assert.equal(unavailable.status, 503);
    assert.equal(unavailable.headers.get('cache-control'), 'no-store');
    const failure = await unavailable.json();
    assert.equal(failure.error.code, 'SERVICE_UNAVAILABLE');
    assert.equal(failure.error.requestId, unavailable.headers.get('x-request-id'));
    assert.ok(!JSON.stringify(failure).includes('DATABASE_URL'), 'los diagnósticos de configuración quedan en logs');
    const diagnostic = logs.map(line => JSON.parse(line)).find(line => line.event === 'startup_failed');
    assert.equal(diagnostic.code, 'CONFIGURATION_INVALID');
    assert.deepEqual(diagnostic.settings, ['DATABASE_URL', 'DATABASE_SSL']);
    assert.ok(!logs.join('').includes('SECRET_FIXTURE'));
    assert.equal(process.exitCode, previousExitCode);

    process.env.NODE_ENV = 'test';
    process.env.HTTP_RATE_STORE = 'memory';
    process.env.CORS_ORIGINS = 'http://127.0.0.1:3000';
    const healthy = await Promise.all(Array.from({ length: 4 }, () => fetch(`${base}/health`)));
    for (const response of healthy) {
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { status: 'ok' });
    }
    const ready = await fetch(`${base}/health/ready`);
    assert.equal(ready.status, 503);
    assert.equal((await ready.json()).error.code, 'DATABASE_NOT_CONFIGURED');
    const admin = await fetch(`${base}/admin/raffles`);
    assert.equal(admin.status, 401);
    await admin.body.cancel();

    // A warm invocation reuses the initialized app instead of reloading invalid config.
    process.env.NODE_ENV = 'production';
    process.env.HTTP_RATE_STORE = 'postgres';
    const warm = await fetch(`${base}/health`);
    assert.equal(warm.status, 200);
    await warm.body.cancel();
  } finally {
    process.stderr.write = originalWrite;
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
    if (server) {
      server.closeAllConnections();
      await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    }
  }
});
