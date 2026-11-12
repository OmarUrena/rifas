type EnvironmentInput = Record<string, string | undefined>;

export function localLoginTest(env: EnvironmentInput, now = Date.now()) {
  const expiry = env.ADMIN_LOGIN_WITHOUT_TOTP_UNTIL;
  if (!expiry || !["development", "test"].includes(env.NODE_ENV ?? "")
    || (env.APP_ENV && !["development", "test"].includes(env.APP_ENV))) return undefined;
  const { appEnv, mode, apiBaseUrl } = readEnvironment(env);
  if (!["development", "test"].includes(appEnv) || mode !== "live" || !apiBaseUrl || !env.WEB_ORIGIN) return undefined;
  const expiresAt = Date.parse(expiry);
  if (!Number.isFinite(expiresAt) || expiresAt <= now) return undefined;
  try {
    const web = new URL(env.WEB_ORIGIN), api = new URL(apiBaseUrl);
    const loopback = (url: URL) => url.protocol === "http:" && ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname);
    if (!loopback(web) || !loopback(api) || web.origin !== env.WEB_ORIGIN) return undefined;
  } catch { return undefined; }
  return { expiresAt };
}

export function adminLoginDestination(mfaRequired: boolean, env: EnvironmentInput, now = Date.now()) {
  return !mfaRequired ? "/admin/ordenes" : localLoginTest(env, now) ? "/admin/prueba-acceso" : "/admin/mfa";
}

export function readAdminEnvironment(env: EnvironmentInput) {
  const { mode, appEnv } = readEnvironment(env);
  if (mode !== "live" || !env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY) return undefined;
  const url = new URL(env.SUPABASE_URL);
  if (url.username || url.password || url.search || url.hash || url.pathname !== "/" || (url.protocol !== "https:" && !(appEnv === "test" && url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname)))) throw new Error("SUPABASE_URL administrativo debe ser un origen HTTPS sin credenciales.");
  if (!/^sb_publishable_[A-Za-z0-9_-]+$/.test(env.SUPABASE_PUBLISHABLE_KEY)) throw new Error("La web administrativa requiere una clave publicable de Supabase, nunca una clave secreta o service_role.");
  return { url: url.origin, publishableKey: env.SUPABASE_PUBLISHABLE_KEY };
}

export function readEnvironment(env: EnvironmentInput) {
  const checkoutProxyEnabled = env.CHECKOUT_PROXY_ENABLED ?? "false";
  if (!["true", "false"].includes(checkoutProxyEnabled)) throw new Error("CHECKOUT_PROXY_ENABLED debe ser true o false.");
  const mode = env.API_MODE ?? "live";
  const appEnv = env.APP_ENV ?? (env.NODE_ENV === "development" ? "development" : "production");
  if (!["development", "test", "staging", "production"].includes(appEnv)) throw new Error("APP_ENV no válido.");
  if (mode !== "live" && mode !== "mock") throw new Error("API_MODE debe ser live o mock.");
  if (mode === "mock" && (env.NODE_ENV === "production" || !["development", "test"].includes(appEnv))) {
    throw new Error("El modo mock está prohibido en builds de producción y staging.");
  }
  const raw = env.API_BASE_URL;
  // F0 can build an offline shell without API configuration. No client is initialized here.
  let apiBaseUrl: string | undefined;
  if (raw) {
    const url = new URL(raw);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname.replace(/\/$/, "") !== "/api/v1") {
      throw new Error("API_BASE_URL debe ser un origen HTTP(S) con ruta /api/v1, sin credenciales.");
    }
    if (["staging", "production"].includes(appEnv) && url.protocol !== "https:") throw new Error("La API requiere HTTPS en staging/producción.");
    apiBaseUrl = url.toString().replace(/\/$/, "");
  }
  let receiptMaxBytes = Number(env.RECEIPT_MAX_BYTES ?? 5242880);
  if (!Number.isSafeInteger(receiptMaxBytes) || receiptMaxBytes < 1 || receiptMaxBytes > 10485760) throw new Error("RECEIPT_MAX_BYTES debe ser un entero entre 1 y 10485760, coherente con la API.");
  if (checkoutProxyEnabled === "true") {
    // Leave room for multipart fields under Vercel Functions' 4.5 MB body limit.
    if (env.VERCEL === "1") receiptMaxBytes = Math.min(receiptMaxBytes, 4194304);
    if (!apiBaseUrl || !/^[a-f0-9]{64}$/.test(env.CHECKOUT_PROXY_SECRET ?? "")) throw new Error("El proxy requiere API_BASE_URL y CHECKOUT_PROXY_SECRET de 64 caracteres hexadecimales.");
    const web = new URL(env.WEB_ORIGIN ?? "");
    if (web.origin !== env.WEB_ORIGIN || !["http:", "https:"].includes(web.protocol) || web.origin === new URL(apiBaseUrl).origin
      || (["staging", "production"].includes(appEnv) && web.protocol !== "https:")) throw new Error("WEB_ORIGIN debe ser el origen web exacto, distinto de la API y HTTPS en producción.");
  }
  return { mode, appEnv, apiBaseUrl, receiptMaxBytes, checkoutProxyEnabled: checkoutProxyEnabled === "true" } as const;
}
