// @vitest-environment node
import { afterEach, expect, test, vi } from "vitest";
import type { components } from "@sorteos/api-client";
import { catalogApi, mapCard, mapDetail, publicImage } from "@/features/raffles/api";

type Schemas = components["schemas"];
const card: Schemas["RaffleCardDto"] = { blessedNumbers: [], blessedNumberCount: 0, progressPercent: 73, id: "test", slug: "premio-test", title: "Premio TEST", prizeImageUrl: null, status: "PUBLISHED", ticketPriceMinor: 10025, totalTickets: 10, confirmedSoldCount: 2, availableCount: 8 };
const detail: Schemas["RaffleDetailDto"] = { ...card, description: "Descripción", prize: "Premio", images: [], numberWidth: 2, minPurchase: 1, maxPurchase: 5, rules: "Reglas\nTEST", rulesVersion: "1", startsAt: null, endsAt: null, reservedCount: 0 };
const inventory: Schemas["AvailabilityDto"] = { total: 10, available: 0, held: 1, reserved: 7, sold: 2, asOf: "2026-11-01T12:00:00Z" };
afterEach(() => vi.unstubAllGlobals());

test("resumen no inventa reservas, cupos temporales, categorías ni fotos", () => {
  const mapped = mapCard(card);
  expect(mapped).not.toHaveProperty("reserved"); expect(mapped).not.toHaveProperty("held");
  expect(mapped).not.toHaveProperty("category"); expect(mapped.images).toEqual([]); expect(mapped.demo).toBe(false);
});
test("detalle usa exclusivamente el snapshot de disponibilidad y conserva reglas como texto", () => {
  const mapped = mapDetail(detail, inventory);
  expect(mapped).toMatchObject({ total: 10, available: 0, held: 1, reserved: 7, sold: 2, asOf: inventory.asOf, rules: ["Reglas\nTEST"], endsAt: null });
  expect(() => mapDetail(detail, { ...inventory, available: 9 })).toThrow();
});
test("imágenes limitadas al directorio público autorizado, nunca URLs firmadas o privadas", () => {
  const base = "https://media.example.test/storage/v1/object/public/prizes";
  expect(publicImage(`${base}/premio.webp`, base)).toBe(true);
  for (const url of ["https://otro.example.test/premio.webp", `${base}-private/premio.webp`, `${base}/../receipt.webp`, `${base}/p.webp?token=secret`, `${base}/p.webp#fragment`, "javascript:alert(1)", null]) expect(publicImage(url, base)).toBe(false);
  expect(publicImage(`${base}/p.webp`)).toBe(false);
});
test("cliente generado propaga paginación y consume detalle, disponibilidad y cuentas públicas", async () => {
  const requests: Request[] = [];
  vi.stubGlobal("fetch", vi.fn(async (request: Request) => {
    requests.push(request);
    const path = new URL(request.url).pathname;
    return Response.json(path.endsWith("/availability") ? inventory : path.endsWith("/premio-test") ? detail : path.endsWith("/public") ? { items: [] } : { items: [card], pagination: { page: 2, pageSize: 12, total: 13 } });
  }));
  const api = catalogApi("http://localhost:3001/api/v1");
  expect((await api.list(2)).pagination.page).toBe(2);
  expect(new URL(requests[0]!.url).searchParams.get("page")).toBe("2");
  expect((await api.detail("premio-test")).available).toBe(0);
  expect(await api.bankAccounts()).toEqual([]);
  expect(requests).toHaveLength(4);
  for (const request of requests) { expect(request.cache).toBe("no-store"); expect(request.method).toBe("GET"); }
});
test.each([404, 429, 503])("fallo HTTP %s no se convierte en catálogo vacío ni datos demo", async status => {
  vi.stubGlobal("fetch", vi.fn(async () => Response.json({ error: { code: status === 429 ? "RATE_LIMITED" : "TEST_ERROR", message: "SECRET" } }, { status })));
  await expect(catalogApi("http://localhost:3001/api/v1").list(1)).rejects.toMatchObject({ status });
});
