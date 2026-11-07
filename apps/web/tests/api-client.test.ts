// @vitest-environment node
import { afterEach, expect, test, vi } from "vitest";
import { createApiClient } from "@/lib/api/client";
import { ApiError, parseApiError } from "@/lib/api/errors";

afterEach(() => vi.unstubAllGlobals());

test("M6: caída del servicio conserva referencia sin exponer mensajes internos", () => {
  const failure=parseApiError({error:{code:"DATABASE_UNAVAILABLE",requestId:"test-request",message:"PRIVATE_DATABASE_HOST"}},503);
  expect(failure.requestId).toBe("test-request");
  expect(failure.message).toContain("temporalmente fuera de línea");
  expect(failure.message).not.toContain("PRIVATE_DATABASE_HOST");
});

test("cliente usa una sola versión, cookies y no-store sobre el contrato health real", async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: "ok" }), { headers: { "Content-Type": "application/json" } }));
  vi.stubGlobal("fetch", fetcher);
  const client = createApiClient("http://localhost:3001/api/v1/");
  const result = await client.GET("/api/v1/health");
  const request = fetcher.mock.calls[0]?.[0] as Request;
  expect(request.url).toBe("http://localhost:3001/api/v1/health");
  expect(request.credentials).toBe("include");
  expect(request.cache).toBe("no-store");
  expect(result.data).toEqual({ status: "ok" });
});

test("configuración errónea se rechaza antes de enviar una petición", () => {
  for (const url of ["https://api.example.test", "https://api.example.test/other", "https://user:secret@api.example.test/api/v1", "https://api.example.test/api/v1?token=secret", "https://api.example.test/api/v1#secret"]) {
    expect(() => createApiClient(url)).toThrow();
  }
});

test("error JSON conserva correlación del envelope sin exponer su mensaje interno", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { code: "FORBIDDEN", requestId: "req-456", message: "INTERNAL-SECRET" } }), { status: 403 })));
  await expect(createApiClient("https://api.example.test/api/v1").GET("/api/v1/health")).rejects.toMatchObject({ code: "FORBIDDEN", status: 403, requestId: "req-456", message: "No tienes permiso para realizar esta acción." });
});

test("429 de proxy sin JSON mantiene mensaje de límite y correlación segura", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("Too many requests", { status: 429, headers: { "X-Request-Id": "proxy-123" } })));
  await expect(createApiClient("https://api.example.test/api/v1").GET("/api/v1/health")).rejects.toMatchObject({ code: "RATE_LIMITED", requestId: "proxy-123" });
});

test("HTML inesperado no se muestra ni conserva correlaciones inseguras", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<html>PRIVATE-ERROR</html>", { status: 500, headers: { "X-Request-Id": "user@example.test" } })));
  await expect(createApiClient("https://api.example.test/api/v1").GET("/api/v1/health")).rejects.toMatchObject({ code: "UNKNOWN_ERROR", requestId: undefined, message: "No pudimos completar la solicitud. Inténtalo más tarde." });
});

test("fallo de conexión no dispara reintentos automáticos", async () => {
  const fetcher = vi.fn().mockRejectedValue(new TypeError("NETWORK-DETAILS"));
  vi.stubGlobal("fetch", fetcher);
  await expect(createApiClient("https://api.example.test/api/v1").GET("/api/v1/health")).rejects.toBeInstanceOf(ApiError);
  expect(fetcher).toHaveBeenCalledTimes(1);
});
