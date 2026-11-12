// @vitest-environment node
import { createHmac } from "node:crypto";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { checkoutProxy } from "@/features/checkout/proxy";
import { readEnvironment } from "@/lib/config";

const origin = "https://web.example.test", secret = "a".repeat(64);
beforeEach(() => {
  for (const [key, value] of Object.entries({ CHECKOUT_PROXY_ENABLED: "true", CHECKOUT_PROXY_SECRET: secret, WEB_ORIGIN: origin, API_BASE_URL: "https://api.example.test/api/v1", APP_ENV: "production", VERCEL: "1", HTTP_DNS_FAMILY: "auto" })) vi.stubEnv(key, value);
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
function request(path = "/checkout-session", init: RequestInit = {}) {
  return new Request(origin + "/api/v1" + path, { method: "POST", ...init, headers: { Origin: origin, "Sec-Fetch-Site": "same-origin", "x-vercel-forwarded-for": "192.0.2.1", ...init.headers } });
}
test("valida flag, secreto, origen y destino antes de activar el proxy", () => {
  const settings = { CHECKOUT_PROXY_ENABLED: "true", CHECKOUT_PROXY_SECRET: secret, WEB_ORIGIN: origin, API_BASE_URL: "https://api.example.test/api/v1" };
  expect(readEnvironment(settings).checkoutProxyEnabled).toBe(true);
  expect(readEnvironment({}).checkoutProxyEnabled).toBe(false);
  for (const patch of [{ CHECKOUT_PROXY_ENABLED: "yes" }, { CHECKOUT_PROXY_SECRET: "" }, { WEB_ORIGIN: origin + "/" }, { WEB_ORIGIN: "https://api.example.test" }, { API_BASE_URL: "" }]) expect(() => readEnvironment({ ...settings, ...patch })).toThrow();
  expect(readEnvironment({ ...settings, VERCEL: "1" }).receiptMaxBytes).toBe(4194304);
});
test("sesión reenvía solo cookie invitada, conserva Set-Cookie, envelope y firma compatible con NestJS", async () => {
  const fetcher = vi.fn(async (url: URL, init: RequestInit) => {
    const headers = new Headers(init.headers);
    expect(headers.get("Cookie")).toBe("__Host-sorteos_guest=guest-secret");
    expect(headers.has("Authorization")).toBe(false);
    const clientKey = createHmac("sha256", secret).update("client-ip-v1:192.0.2.1").digest("hex");
    expect(headers.get("x-sorteos-client-key")).toBe(clientKey);
    expect(headers.get("x-sorteos-proxy-signature")).toBe(createHmac("sha256", secret).update(JSON.stringify([init.method, url.pathname + url.search, origin, headers.get("x-sorteos-proxy-time"), clientKey])).digest("hex"));
    return Response.json({ ready: true }, { status: 201, headers: { "Set-Cookie": "__Host-sorteos_guest=new-secret; Path=/; HttpOnly; Secure; SameSite=Lax", "X-Request-Id": "upstream-id" } });
  });
  vi.stubGlobal("fetch", fetcher);
  const response = await checkoutProxy(request(undefined, { headers: { Cookie: "admin=private; __Host-sorteos_guest=guest-secret", Authorization: "Bearer private", "X-Sorteos-Client-Key": "spoof" } }));
  expect(response.status).toBe(201); expect(await response.json()).toEqual({ ready: true });
  expect(response.headers.get("Set-Cookie")).toContain("HttpOnly; Secure; SameSite=Lax");
  expect(response.headers.get("X-Request-Id")).toBe("upstream-id"); expect(response.headers.get("Cache-Control")).toContain("no-store");
});
test("multipart conserva bytes, boundary y clave de reintento sin crear otro envío", async () => {
  const form = new FormData(); form.set("receipt", new File(["TEST PDF"], "test.pdf", { type: "application/pdf" })); form.set("holdId", "test-hold");
  const req = request("/orders", { body: form, headers: { "Idempotency-Key": "same-intent" } });
  const expected = new Uint8Array(await req.clone().arrayBuffer());
  const fetcher = vi.fn(async (_url: URL, init: RequestInit) => {
    expect(new Uint8Array(init.body as Buffer)).toEqual(expected);
    expect(new Headers(init.headers).get("content-type")).toBe(req.headers.get("content-type"));
    expect(new Headers(init.headers).get("idempotency-key")).toBe("same-intent");
    return Response.json({ error: { code: "HOLD_EXPIRED", requestId: "backend-id" } }, { status: 409 });
  }); vi.stubGlobal("fetch", fetcher);
  const response = await checkoutProxy(req); expect(response.status).toBe(409);
  expect(await response.json()).toMatchObject({ error: { code: "HOLD_EXPIRED" } }); expect(fetcher).toHaveBeenCalledTimes(1);
});
test("rechaza orígenes ajenos, rutas privadas, IP ausente, cookies ambiguas, flag apagado y archivos grandes sin contactar API", async () => {
  const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
  expect((await checkoutProxy(request(undefined, { headers: { Origin: "https://evil.invalid" } }))).status).toBe(403);
  expect((await checkoutProxy(request(undefined, { headers: { "Sec-Fetch-Site": "cross-site" } }))).status).toBe(403);
  expect((await checkoutProxy(request("/orders/RF-" + "A".repeat(32), { method: "GET", headers: { "Sec-Fetch-Site": "cross-site" } }))).status).toBe(403);
  expect((await checkoutProxy(request("/admin/orders"))).status).toBe(404);
  expect((await checkoutProxy(request(undefined, { headers: { "x-vercel-forwarded-for": "", "x-forwarded-for": "192.0.2.2" } }))).status).toBe(503);
  expect((await checkoutProxy(request(undefined, { headers: { Cookie: "__Host-sorteos_guest=a; __Host-sorteos_guest=b" } }))).status).toBe(401);
  expect((await checkoutProxy(request("/orders", { body: new Uint8Array(4194304 + 65537) }))).status).toBe(413);
  vi.stubEnv("CHECKOUT_PROXY_ENABLED", "false"); expect((await checkoutProxy(request())).status).toBe(404);
  expect(fetcher).not.toHaveBeenCalled();
});
test("dos IP distintas conservan cuotas separadas y fallo de red no provoca reintentos", async () => {
  const keys: string[] = [];
  const fetcher = vi.fn(async (_url: URL, init: RequestInit) => { keys.push(new Headers(init.headers).get("x-sorteos-client-key")!); throw new Error("PRIVATE NETWORK DETAILS"); }); vi.stubGlobal("fetch", fetcher);
  const first = await checkoutProxy(request());
  await checkoutProxy(request(undefined, { headers: { "x-vercel-forwarded-for": "192.0.2.2" } }));
  expect(keys[0]).not.toBe(keys[1]); expect(fetcher).toHaveBeenCalledTimes(2);
  expect(first.status).toBe(503); expect(await first.text()).not.toContain("PRIVATE NETWORK DETAILS");
});
test("Host público se valida contra WEB_ORIGIN aunque Next use una URL interna", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => Response.json({ ready: true })));
  const headers = { Host: "web.example.test", Origin: origin, "x-vercel-forwarded-for": "192.0.2.1" };
  expect((await checkoutProxy(new Request("http://localhost:3000/api/v1/checkout-session", { method: "POST", headers }))).status).toBe(200);
  expect((await checkoutProxy(new Request("http://localhost:3000/api/v1/checkout-session", { method: "POST", headers: { ...headers, Host: "evil.invalid" } }))).status).toBe(403);
});
