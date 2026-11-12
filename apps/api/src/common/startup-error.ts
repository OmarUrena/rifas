// Only fixed diagnostics: arbitrary exception messages may contain credentials or PII.
const settingNames = new Set([
  'NODE_ENV', 'HOST', 'PORT', 'CORS_ORIGINS', 'SWAGGER_ENABLED', 'LOG_LEVEL', 'CHECKOUT_PROXY_SECRET',
  'RATE_LIMIT', 'RATE_TTL_MS', 'DATABASE_URL', 'DATABASE_SSL', 'HTTP_RATE_STORE',
  'SUPABASE_URL', 'HOLD_TTL_MINUTES', 'HOLD_MAX_QUANTITY', 'HOLD_MAX_ACTIVE_SESSION',
  'HOLD_MAX_ACTIVE_IP', 'HOLD_HOURLY_IP', 'CHECKOUT_SESSION_HOURLY_IP', 'HOLD_SWEEP_MS',
  'DEVELOPMENT_LOCAL_RECEIPTS', 'DEVELOPMENT_LOCAL_MEDIA', 'RECEIPT_MAX_BYTES',
]);

const configurationSettings: Record<string, string[]> = {
  'HTTP_RATE_STORE debe ser postgres en staging/production': ['HTTP_RATE_STORE'],
  'Fotos locales solo permitidas en desarrollo loopback': ['DEVELOPMENT_LOCAL_MEDIA', 'HOST'],
  'Comprobantes locales solo permitidos en desarrollo loopback': ['DEVELOPMENT_LOCAL_RECEIPTS', 'HOST'],
  'Excepcion MFA solo permitida en desarrollo loopback con capacidad y vencimiento validos': ['ADMIN_DEVELOPMENT_MFA_TOKEN', 'ADMIN_DEVELOPMENT_MFA_UNTIL', 'HOST'],
  'Excepcion MFA requiere origenes web loopback': ['CORS_ORIGINS', 'ADMIN_DEVELOPMENT_MFA_TOKEN'],
  'CHECKOUT_ABUSE_HASH_KEY requiere al menos 32 caracteres': ['CHECKOUT_ABUSE_HASH_KEY'],
  'Swagger público prohibido en staging/production': ['SWAGGER_ENABLED'],
  'DB con TLS requerida': ['DATABASE_URL', 'DATABASE_SSL'],
  'DATABASE_URL inválida: configurar TLS mediante DATABASE_SSL/DATABASE_CA': ['DATABASE_URL', 'DATABASE_SSL', 'DATABASE_CA'],
  'SUPABASE_URL debe ser un origen HTTPS (loopback HTTP solo en desarrollo/test)': ['SUPABASE_URL'],
  'PUBLIC_RAFFLE_BUCKET inválido': ['PUBLIC_RAFFLE_BUCKET'],
  'PRIVATE_RECEIPT_BUCKET inválido o compartido con premios': ['PRIVATE_RECEIPT_BUCKET', 'PUBLIC_RAFFLE_BUCKET'],
  'SUPABASE_STORAGE_KEY inválida': ['SUPABASE_STORAGE_KEY'],
  'SUPABASE_STORAGE_KEY debe ser una clave secreta de servidor': ['SUPABASE_STORAGE_KEY'],
  'SUPABASE_PUBLISHABLE_KEY inválida': ['SUPABASE_PUBLISHABLE_KEY'],
};

export function startupFailure(error: unknown, port?: number) {
  const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined;
  const diagnostics = {
    EADDRINUSE: 'Puerto ocupado. Deten la otra instancia de la API antes de volver a iniciar.',
    EACCES: 'Sin permiso para escuchar en el puerto configurado.',
    EADDRNOTAVAIL: 'La direccion HOST configurada no esta disponible en este equipo.',
  } as const;
  const known = typeof code === 'string' && Object.hasOwn(diagnostics, code)
    ? code as keyof typeof diagnostics : undefined;
  const message = error instanceof Error ? error.message : '';
  const setting = message.match(/^Configuración inválida: ([A-Z_]+)$/)?.[1];
  const settings = setting && settingNames.has(setting) ? [setting]
    : Object.hasOwn(configurationSettings, message) ? configurationSettings[message] : undefined;
  return {
    level: 'error', event: 'startup_failed', code: known ?? (settings ? 'CONFIGURATION_INVALID' : 'STARTUP_FAILED'),
    message: known ? diagnostics[known] : settings
      ? 'Configuracion invalida. Revisa las variables indicadas.'
      : 'No se pudo iniciar la API. Revisa la configuracion del servidor.',
    ...(settings ? { settings } : {}),
    ...(Number.isSafeInteger(port) && port! > 0 && port! <= 65535 ? { port } : {}),
  };
}
