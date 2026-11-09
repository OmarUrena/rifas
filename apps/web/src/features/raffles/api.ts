import type { components } from "@sorteos/api-client";
import { createApiClient } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import type { RaffleSummary, RaffleView } from "./types";

type Schemas = components["schemas"];
export function publicImage(url: string | null, base?: string): boolean {
  if (!url || !base) return false;
  try {
    const source = new URL(url), allowed = new URL(base);
    const local = process.env.NODE_ENV !== "production" && source.protocol === "http:" && ["127.0.0.1", "localhost"].includes(source.hostname) && allowed.pathname === "/api/v1/media";
    return (source.protocol === "https:" || local) && !source.username && !source.password && !source.search && !source.hash && source.origin === allowed.origin && source.pathname.startsWith(allowed.pathname.replace(/\/$/, "") + "/");
  } catch { return false; }
}
export function mapCard(dto: Schemas["RaffleCardDto"], imageBase?: string): RaffleSummary {
  return { slug: dto.slug, title: dto.title, status: dto.status, ticketPriceMinor: dto.ticketPriceMinor,
    total: dto.totalTickets, sold: dto.confirmedSoldCount, available: dto.availableCount, demo: false, progressPercent: dto.progressPercent,
    blessedNumbers: dto.blessedNumbers, blessedNumberCount: dto.blessedNumberCount,
    images: publicImage(dto.prizeImageUrl, imageBase) ? [{ src: dto.prizeImageUrl!, alt: dto.title }] : [] };
}
export function mapDetail(dto: Schemas["RaffleDetailDto"], inventory: Schemas["AvailabilityDto"], imageBase?: string): RaffleView {
  if (inventory.total !== inventory.available + inventory.held + inventory.reserved + inventory.sold) throw new ApiError("INVALID_RESPONSE", 502);
  return { ...mapCard(dto, imageBase), id: dto.id, subtitle: "", description: dto.description,
    images: dto.images.filter(image => publicImage(image.url, imageBase)).map(image => ({ src: image.url, alt: image.alt })),
    minPurchase: dto.minPurchase, maxPurchase: dto.maxPurchase, total: inventory.total, sold: inventory.sold,
    reserved: inventory.reserved, held: inventory.held, available: inventory.available, asOf: inventory.asOf,
    rules: [dto.rules], rulesVersion: dto.rulesVersion, highlights: [], numberWidth: dto.numberWidth, startsAt: dto.startsAt, endsAt: dto.endsAt, prize: dto.prize };
}
export function catalogApi(baseUrl: string, imageBase?: string) {
  const client = createApiClient(baseUrl);
  const signal = () => AbortSignal.timeout(10000);
  return {
    async list(page: number) {
      const { data } = await client.GET("/api/v1/raffles", { params: { query: { page, pageSize: 12 } }, signal: signal() });
      if (!data) throw new ApiError("INVALID_RESPONSE", 502);
      return { items: data.items.map(dto => mapCard(dto, imageBase)), pagination: data.pagination };
    },
    async detail(slug: string) {
      const params = { path: { slug } };
      const [detail, availability] = await Promise.all([
        client.GET("/api/v1/raffles/{slug}", { params, signal: signal() }),
        client.GET("/api/v1/raffles/{slug}/availability", { params, signal: signal() }),
      ]);
      if (!detail.data || !availability.data) throw new ApiError("INVALID_RESPONSE", 502);
      return mapDetail(detail.data, availability.data, imageBase);
    },
    async blessedNumbers(slug: string, page = 1) {
      const { data } = await client.GET("/api/v1/raffles/{slug}/blessed-numbers", { params: { path: { slug }, query: { page, pageSize: 100 } }, signal: signal() });
      if (!data) throw new ApiError("INVALID_RESPONSE", 502); return data;
    },
    async bankAccounts() {
      const { data } = await client.GET("/api/v1/bank-accounts/public", { signal: signal() });
      if (!data) throw new ApiError("INVALID_RESPONSE", 502);
      return data.items;
    },
  };
}
