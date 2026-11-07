import { randomBytes } from 'node:crypto';

const developmentAbuseKey = randomBytes(32).toString('hex');
export interface AppConfig {
  environment: 'development' | 'test' | 'staging' | 'production';
  host: string;
  port: number;
  corsOrigins: string[];
  swaggerEnabled: boolean;
  logLevel: 'silent' | 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace';
  rateLimit: number;
  rateTtlMs: number;
  httpRateStore: 'memory' | 'postgres';
  databaseUrl?: string;
  databaseSsl: boolean;
  databaseCa?: string;
  supabaseUrl?: string;
  supabasePublishableKey?: string;
  publicMediaBucket: string;
  holdTtlMinutes: number;
  holdMaxQuantity: number;
  holdMaxActiveSession: number;
  holdMaxActiveIp: number;
  holdHourlyIp: number;
  sessionHourlyIp: number;
  holdSweepMs: number;
  abuseHashKey: string;
  receiptBucket:string;
  storageKey?:string;
  receiptMaxBytes:number;
  developmentMfaToken?:string;
  developmentMfaUntil?:string;
  developmentLocalReceipts:boolean;
  developmentLocalMedia:boolean;
}

export const APP_CONFIG = Symbol('APP_CONFIG');

function integer(value: string | undefined, fallback: number, name: string, max: number): number {
  const parsed = value === undefined ? fallback : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > max) {
    throw new Error(`Configuración inválida: ${name}`);
  }
  return parsed;
}

function boolean(value: string | undefined, fallback: boolean, name: string): boolean {
  if (value === undefined) return fallback;
  if (value !== 'true' && value !== 'false') throw new Error(`Configuración inválida: ${name}`);
  return value === 'true';
}

export function parseConfig(env: NodeJS.ProcessEnv): AppConfig {
  const environment = env.NODE_ENV ?? 'development';
  if (!['development', 'test', 'staging', 'production'].includes(environment)) {
    throw new Error('Configuración inválida: NODE_ENV');
  }
  const deployed = environment === 'production' || environment === 'staging';
  const httpRateStore = env.HTTP_RATE_STORE ?? (deployed ? 'postgres' : 'memory');
  if (!['memory','postgres'].includes(httpRateStore) || (deployed && httpRateStore !== 'postgres')) {
    throw new Error('HTTP_RATE_STORE debe ser postgres en staging/production');
  }
  const developmentMfaToken=env.ADMIN_DEVELOPMENT_MFA_TOKEN||undefined;
  const developmentMfaUntil=env.ADMIN_DEVELOPMENT_MFA_UNTIL||undefined;
  const developmentLocalReceipts=boolean(env.DEVELOPMENT_LOCAL_RECEIPTS,false,'DEVELOPMENT_LOCAL_RECEIPTS');
  const developmentLocalMedia=boolean(env.DEVELOPMENT_LOCAL_MEDIA,false,'DEVELOPMENT_LOCAL_MEDIA');
  if(developmentLocalMedia&&(deployed||!['127.0.0.1','localhost','::1','[::1]'].includes(env.HOST??'127.0.0.1')))
    throw new Error('Fotos locales solo permitidas en desarrollo loopback');
  if(developmentLocalReceipts&&(deployed||!['127.0.0.1','localhost','::1','[::1]'].includes(env.HOST??'127.0.0.1')))
    throw new Error('Comprobantes locales solo permitidos en desarrollo loopback');
  if(developmentMfaToken||developmentMfaUntil){
    if(deployed || !developmentMfaToken || !/^[a-f0-9]{64}$/.test(developmentMfaToken)
      || !developmentMfaUntil || !Number.isFinite(Date.parse(developmentMfaUntil))
      || !['127.0.0.1','localhost','::1','[::1]'].includes(env.HOST??'127.0.0.1'))
      throw new Error('Excepcion MFA solo permitida en desarrollo loopback con capacidad y vencimiento validos');
  }
  const abuseHashKey=env.CHECKOUT_ABUSE_HASH_KEY || (deployed ? '' : developmentAbuseKey);
  if (abuseHashKey.length<32) throw new Error('CHECKOUT_ABUSE_HASH_KEY requiere al menos 32 caracteres');
  const corsOrigins = (env.CORS_ORIGINS ?? (deployed ? '' : 'http://localhost:3000'))
    .split(',').map((origin) => origin.trim()).filter(Boolean);
  if (corsOrigins.length === 0 || corsOrigins.some((origin) => {
    try {
      const url = new URL(origin);
      return url.origin !== origin || !['http:', 'https:'].includes(url.protocol)
        || (deployed && url.protocol !== 'https:');
    } catch { return true; }
  })) throw new Error('Configuración inválida: CORS_ORIGINS');
  if((developmentMfaToken||developmentLocalReceipts||developmentLocalMedia)&&corsOrigins.some(origin=>{
    const url=new URL(origin);return url.protocol!=='http:'||!['127.0.0.1','localhost','[::1]'].includes(url.hostname);
  }))throw new Error('Excepcion MFA requiere origenes web loopback');
  const swaggerEnabled = boolean(env.SWAGGER_ENABLED, !deployed, 'SWAGGER_ENABLED');
  if (deployed && swaggerEnabled) throw new Error('Swagger público prohibido en staging/production');
  const logLevel = env.LOG_LEVEL ?? 'info';
  if (!['silent', 'fatal', 'error', 'warn', 'info', 'debug', 'trace'].includes(logLevel)) {
    throw new Error('Configuración inválida: LOG_LEVEL');
  }
  const databaseSsl = boolean(env.DATABASE_SSL, true, 'DATABASE_SSL');
  const databaseUrl = env.DATABASE_URL || undefined;
  if (deployed && (!databaseUrl || !databaseSsl)) throw new Error('DB con TLS requerida');
  if (databaseUrl) {
    let url: URL;
    try { url = new URL(databaseUrl); } catch { throw new Error('Configuración inválida: DATABASE_URL'); }
    if (!['postgres:', 'postgresql:'].includes(url.protocol)
      || [...url.searchParams.keys()].some((key) => key.startsWith('ssl'))) {
      throw new Error('DATABASE_URL inválida: configurar TLS mediante DATABASE_SSL/DATABASE_CA');
    }
  }
  const supabaseUrl = env.SUPABASE_URL || undefined;
  if (supabaseUrl) {
    let url: URL;
    try { url = new URL(supabaseUrl); } catch { throw new Error('Configuración inválida: SUPABASE_URL'); }
    const local = !deployed && ['127.0.0.1','localhost','[::1]'].includes(url.hostname);
    if (url.origin !== supabaseUrl || (url.protocol !== 'https:' && !(local && url.protocol === 'http:'))) {
      throw new Error('SUPABASE_URL debe ser un origen HTTPS (loopback HTTP solo en desarrollo/test)');
    }
  }
  const publicMediaBucket = env.PUBLIC_RAFFLE_BUCKET ?? 'raffle-media';
  if (!/^[a-z0-9][a-z0-9-]{0,62}$/.test(publicMediaBucket)) throw new Error('PUBLIC_RAFFLE_BUCKET inválido');
  const supabasePublishableKey=env.SUPABASE_PUBLISHABLE_KEY||undefined;
  const receiptBucket=env.PRIVATE_RECEIPT_BUCKET??'receipts';
  if(!/^[a-z0-9][a-z0-9-]{0,62}$/.test(receiptBucket) || receiptBucket===publicMediaBucket)throw new Error('PRIVATE_RECEIPT_BUCKET inválido o compartido con premios');
  const storageKey=env.SUPABASE_STORAGE_KEY||undefined;
  if(storageKey && (!/^[a-zA-Z0-9_.-]{24,4096}$/.test(storageKey)))throw new Error('SUPABASE_STORAGE_KEY inválida');
  if(storageKey && !storageKey.startsWith('sb_secret_')) {
    try {
      const payload=JSON.parse(Buffer.from(storageKey.split('.')[1]??'','base64url').toString()) as {role?:string};
      if(payload.role!=='service_role')throw new Error();
    }catch{throw new Error('SUPABASE_STORAGE_KEY debe ser una clave secreta de servidor');}
  }
  if (supabasePublishableKey && (!/^[a-zA-Z0-9_.-]{8,4096}$/.test(supabasePublishableKey)
    || supabasePublishableKey.startsWith('sb_secret_'))) throw new Error('SUPABASE_PUBLISHABLE_KEY inválida');
  return {
    environment: environment as AppConfig['environment'],
    host: env.HOST ?? '127.0.0.1',
    port: integer(env.PORT, 3001, 'PORT', 65535),
    corsOrigins, swaggerEnabled,
    logLevel: logLevel as AppConfig['logLevel'],
    rateLimit: integer(env.RATE_LIMIT, 120, 'RATE_LIMIT', 10000),
    rateTtlMs: integer(env.RATE_TTL_MS, 60000, 'RATE_TTL_MS', 3600000),
    httpRateStore: httpRateStore as AppConfig['httpRateStore'],
    databaseUrl, databaseSsl, databaseCa: env.DATABASE_CA?.replace(/\\n/g, '\n'),
    supabaseUrl, supabasePublishableKey, publicMediaBucket,
    holdTtlMinutes:integer(env.HOLD_TTL_MINUTES,60,'HOLD_TTL_MINUTES',720),
    holdMaxQuantity:integer(env.HOLD_MAX_QUANTITY,100,'HOLD_MAX_QUANTITY',1000),
    holdMaxActiveSession:integer(env.HOLD_MAX_ACTIVE_SESSION,1,'HOLD_MAX_ACTIVE_SESSION',10),
    holdMaxActiveIp:integer(env.HOLD_MAX_ACTIVE_IP,3,'HOLD_MAX_ACTIVE_IP',1000),
    holdHourlyIp:integer(env.HOLD_HOURLY_IP,20,'HOLD_HOURLY_IP',10000),
    sessionHourlyIp:integer(env.CHECKOUT_SESSION_HOURLY_IP,60,'CHECKOUT_SESSION_HOURLY_IP',10000),
    holdSweepMs:integer(env.HOLD_SWEEP_MS,30000,'HOLD_SWEEP_MS',3600000),
    abuseHashKey,
    receiptBucket,storageKey,receiptMaxBytes:integer(env.RECEIPT_MAX_BYTES,5242880,'RECEIPT_MAX_BYTES',10485760),
    developmentMfaToken,developmentMfaUntil,developmentLocalReceipts,developmentLocalMedia,
  };
}

