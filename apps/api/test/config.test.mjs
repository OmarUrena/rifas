import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseConfig } from '../src/config/config.ts';

test('desarrollo inicia sin credenciales y con TLS por defecto', () => {
  const config = parseConfig({});
  assert.equal(config.environment, 'development');
  assert.equal(config.port, 3001);
  assert.equal(config.databaseUrl, undefined);
  assert.equal(config.databaseSsl, true);
  assert.equal(config.swaggerEnabled, true);
  assert.equal(config.httpRateStore, 'memory');
  assert.deepEqual(config.corsOrigins, ['http://localhost:3000']);
});

test('límite HTTP compartido obligatorio fuera de desarrollo; no admite almacenes desconocidos', () => {
  assert.equal(parseConfig({HTTP_RATE_STORE:'postgres'}).httpRateStore,'postgres');
  assert.throws(()=>parseConfig({HTTP_RATE_STORE:'redis'}));
  assert.throws(()=>parseConfig({NODE_ENV:'production',HTTP_RATE_STORE:'memory'}),/HTTP_RATE_STORE/);
  assert.throws(()=>parseConfig({NODE_ENV:'staging',HTTP_RATE_STORE:'memory'}),/HTTP_RATE_STORE/);
});

test('orígenes exactos sin wildcard, path, credenciales ni esquemas ajenos', () => {
  for (const origin of ['*', 'https://demo.invalid/path', 'https://demo.invalid/',
    'https://user:secret@demo.invalid', 'file:///tmp/demo', 'null', '']) {
    assert.throws(() => parseConfig({ CORS_ORIGINS: origin }));
  }
  assert.deepEqual(parseConfig({ CORS_ORIGINS: 'https://a.invalid, https://b.invalid' }).corsOrigins,
    ['https://a.invalid', 'https://b.invalid']);
});

test('límites y puerto requieren enteros positivos acotados', () => {
  for (const env of [{ PORT: '0' }, { PORT: '65536' }, { PORT: '1.5' }, { PORT: 'abc' },
    { RATE_LIMIT: '0' }, { RATE_LIMIT: '10001' }, { RATE_TTL_MS: '-1' }]) {
    assert.throws(() => parseConfig(env));
  }
});

test('booleanos y nivel de log rechazan valores ambiguos', () => {
  for (const env of [{ SWAGGER_ENABLED: 'yes' }, { DATABASE_SSL: '0' },
    { LOG_LEVEL: 'verbose' }, { NODE_ENV: 'demo' }]) assert.throws(() => parseConfig(env));
});

test('staging y producción requieren HTTPS, DB y TLS y deshabilitan Swagger', () => {
  for (const environment of ['staging', 'production']) {
    const env = { NODE_ENV: environment, CORS_ORIGINS: 'https://app.invalid',
      DATABASE_URL: 'postgres://user:demo@db.invalid/demo', CHECKOUT_ABUSE_HASH_KEY:'x'.repeat(32) };
    assert.equal(parseConfig(env).swaggerEnabled, false);
    assert.throws(() => parseConfig({ ...env, SWAGGER_ENABLED: 'true' }));
    assert.throws(() => parseConfig({ ...env, DATABASE_SSL: 'false' }));
    assert.throws(() => parseConfig({ ...env, DATABASE_URL: '' }));
    assert.throws(() => parseConfig({ ...env, CORS_ORIGINS: 'http://app.invalid' }));
  }
});

test('URL DB no puede sobrescribir opciones TLS', () => {
  for (const url of ['not-a-url', 'https://db.invalid',
    'postgres://db.invalid/demo?sslmode=no-verify', 'postgres://db.invalid/demo?sslcert=bad']) {
    assert.throws(() => parseConfig({ DATABASE_URL: url }));
  }
  assert.equal(parseConfig({ DATABASE_CA: 'line1\\nline2' }).databaseCa, 'line1\nline2');
});

test('origen Auth fijo y bucket de premios no aceptan credenciales, rutas o HTTP remoto', () => {
  for (const origin of ['http://remote.invalid','https://user:secret@project.invalid',
    'https://project.invalid/path','https://project.invalid?token=bad']) {
    assert.throws(()=>parseConfig({SUPABASE_URL:origin}));
  }
  for (const bucket of ['../receipts','raffle-media/receipts','', 'bad bucket']) {
    assert.throws(()=>parseConfig({PUBLIC_RAFFLE_BUCKET:bucket}));
  }
  assert.equal(parseConfig({SUPABASE_URL:'https://project.supabase.co'}).supabaseUrl,'https://project.supabase.co');
});

test('B3 limita TTL, cupos y barrido; clave de abuso obligatoria en entornos desplegados',()=>{
  for(const env of [{HOLD_TTL_MINUTES:'0'},{HOLD_TTL_MINUTES:'721'},{HOLD_MAX_QUANTITY:'1001'},
    {HOLD_MAX_ACTIVE_SESSION:'0'},{HOLD_MAX_ACTIVE_IP:'-1'},{HOLD_HOURLY_IP:'1.5'},
    {HOLD_SWEEP_MS:'0'},{CHECKOUT_SESSION_HOURLY_IP:'0'},{CHECKOUT_ABUSE_HASH_KEY:'short'}])assert.throws(()=>parseConfig(env));
  const deployed={NODE_ENV:'production',DATABASE_URL:'postgres://user:demo@db.invalid/demo',CORS_ORIGINS:'https://app.invalid'};
  assert.throws(()=>parseConfig(deployed));
  assert.equal(parseConfig({...deployed,CHECKOUT_ABUSE_HASH_KEY:'x'.repeat(32)}).holdTtlMinutes,60);
});

test('B4 separa bucket privado y clave de servidor de las claves publicables y acota archivo',()=>{
  for(const env of [{PRIVATE_RECEIPT_BUCKET:'raffle-media'},{PRIVATE_RECEIPT_BUCKET:'../receipts'},
    {SUPABASE_STORAGE_KEY:'sb_publishable_fixture_not_privileged'},{SUPABASE_STORAGE_KEY:'sb_secret_bad\nheader'},
    {RECEIPT_MAX_BYTES:'0'},{RECEIPT_MAX_BYTES:'10485761'}])assert.throws(()=>parseConfig(env));
  const c=parseConfig({SUPABASE_STORAGE_KEY:'sb_secret_fixture_private_server_key'});
  assert.equal(c.receiptBucket,'receipts');assert.equal(c.receiptMaxBytes,5242880);
});
