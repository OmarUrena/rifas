import "server-only";
import { createHmac, randomUUID } from "node:crypto";
import { isIP } from "node:net";
import { readEnvironment } from "@/lib/config";
import { fetchFromServer } from "@/lib/server-fetch";

const privateHeaders = { "Cache-Control": "private, no-store, max-age=0", "X-Content-Type-Options": "nosniff" };
class ProxyFailure extends Error {
  constructor(readonly status: number, readonly code: string) { super(code); }
}

// Deliberately excludes admin, arbitrary targets, media and receipt downloads.
function allowed(method: string, path: string) {
  if (method === "POST") return ["/api/v1/checkout-session", "/api/v1/checkout-holds", "/api/v1/orders", "/api/v1/ticket-lookup/search"].includes(path);
  if (/^\/api\/v1\/checkout-holds\/[a-f0-9-]{36}$/i.test(path)) return ["GET", "DELETE"].includes(method);
  if (method !== "GET") return false;
  return ["/api/v1/bank-accounts/public", "/api/v1/ticket-lookup/raffles"].includes(path) || /^\/api\/v1\/orders\/RF-[A-Z0-9]{16,64}$/.test(path);
}

async function bodyBytes(request: Request, limit: number) {
  if (Number(request.headers.get("content-length") ?? 0) > limit) throw new ProxyFailure(413, "FILE_TOO_LARGE");
  const reader = request.body?.getReader();
  if (!reader) return undefined;
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) { await reader.cancel(); throw new ProxyFailure(413, "FILE_TOO_LARGE"); }
      chunks.push(value);
    }
    return Buffer.concat(chunks);
  } finally { reader.releaseLock(); }
}

export async function checkoutProxy(request: Request): Promise<Response> {
  try {
    const config = readEnvironment(process.env);
    if (!config.checkoutProxyEnabled) throw new ProxyFailure(404, "NOT_FOUND");
    const url = new URL(request.url);
    if (!allowed(request.method, url.pathname)) throw new ProxyFailure(404, "NOT_FOUND");
    const origin = process.env.WEB_ORIGIN!;
    // Check reads too: never offer an authenticated cross-origin JSON relay.
    // Next's internal request URL can use localhost behind the public Host.
    if ((request.headers.get("host") ?? url.host) !== new URL(origin).host || request.headers.get("sec-fetch-site") === "cross-site"
      || (request.headers.has("origin") && request.headers.get("origin") !== origin)
      || (request.method !== "GET" && request.headers.get("origin") !== origin)) throw new ProxyFailure(403, "FORBIDDEN");

    let ip: string;
    if (process.env.VERCEL === "1") {
      ip = request.headers.get("x-vercel-forwarded-for") ?? "";
      if (!isIP(ip)) throw new ProxyFailure(503, "SERVICE_UNAVAILABLE");
    } else {
      // No configurable trust in arbitrary forwarded headers outside Vercel.
      if (!["development", "test"].includes(config.appEnv) || !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) throw new ProxyFailure(503, "SERVICE_UNAVAILABLE");
      ip = "127.0.0.1";
    }
    const secret = process.env.CHECKOUT_PROXY_SECRET!;
    const clientKey = createHmac("sha256", secret).update(`client-ip-v1:${ip}`).digest("hex");
    const target = new URL(config.apiBaseUrl! + url.pathname.slice("/api/v1".length) + url.search);
    const body = request.method === "POST" ? await bodyBytes(request, url.pathname === "/api/v1/orders" ? config.receiptMaxBytes + 65536 : 65536) : undefined;
    const timestamp = String(Date.now());
    const signature = createHmac("sha256", secret).update(JSON.stringify([request.method, target.pathname + target.search, origin, timestamp, clientKey])).digest("hex");
    const headers = new Headers({ Origin: origin, "Sec-Fetch-Site": "same-origin", "X-Sorteos-Client-Key": clientKey, "X-Sorteos-Proxy-Time": timestamp, "X-Sorteos-Proxy-Signature": signature });
    for (const name of ["content-type", "idempotency-key"]) {
      const value = request.headers.get(name); if (value) headers.set(name, value);
    }
    const cookieName = ["production", "staging"].includes(config.appEnv) ? "__Host-sorteos_guest" : "sorteos_guest";
    const guestCookies = (request.headers.get("cookie") ?? "").split(";").map(value => value.trim()).filter(value => value.startsWith(cookieName + "="));
    if (guestCookies.length > 1) throw new ProxyFailure(401, "SESSION_INVALID");
    if (guestCookies.length === 1) headers.set("Cookie", guestCookies[0]!);
    const upstream = await fetchFromServer(target, { method: request.method, headers, body, cache: "no-store", redirect: "error", signal: AbortSignal.any([request.signal, AbortSignal.timeout(120000)]) });
    const responseHeaders = new Headers(privateHeaders);
    for (const name of ["content-type", "x-request-id", "retry-after"]) {
      const value = upstream.headers.get(name); if (value) responseHeaders.set(name, value);
    }
    // Forward only the guest credential; never leak privileged cookies/headers.
    if (url.pathname === "/api/v1/checkout-session" && upstream.ok) {
      for (const cookie of upstream.headers.getSetCookie()) {
        if (cookie.startsWith(cookieName + "=")) responseHeaders.append("Set-Cookie", cookie);
      }
    }
    return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
  } catch (error) {
    const failure = error instanceof ProxyFailure ? error : new ProxyFailure(503, "SERVICE_UNAVAILABLE");
    const requestId = randomUUID();
    return Response.json({ error: { code: failure.code, message: "No pudimos completar la solicitud.", details: {}, requestId } }, { status: failure.status, headers: { ...privateHeaders, "X-Request-Id": requestId } });
  }
}
