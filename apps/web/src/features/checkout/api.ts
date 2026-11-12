import type { components } from "@sorteos/api-client";
import { createApiClient } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";

export type Hold = components["schemas"]["HoldDto"];
export type BankAccount = components["schemas"]["PublicBankAccountDto"];
// One initialization per browser tab, including multiple mounted consumers.
let sessionFlight: Promise<void> | undefined;
export function checkoutApi(baseUrl: string, origin = () => window.location.origin) {
  const client = createApiClient(baseUrl, undefined, true);
  const signal = () => AbortSignal.timeout(15000);
  function checked(data: Hold | undefined): Hold {
    if (!data || !Number.isSafeInteger(data.totalMinor) || data.totalMinor < 0 || !Number.isSafeInteger(data.unitPriceMinor) || !Number.isFinite(Date.parse(data.serverTime)) || !Number.isFinite(Date.parse(data.expiresAt))) throw new ApiError("INVALID_RESPONSE", 502);
    return data;
  }
  return {
    async session() {
      const initialize = async () => {
        const { data } = await client.POST("/api/v1/checkout-session", { params: { header: { Origin: origin() } }, signal: signal() });
        if (!data?.ready) throw new ApiError("INVALID_RESPONSE", 502);
      };
      sessionFlight ??= (typeof navigator !== "undefined" && navigator.locks ? navigator.locks.request("sorteos-checkout-session", initialize).then(() => undefined) : initialize()).finally(() => { sessionFlight = undefined; });
      return sessionFlight;
    },
    async create(raffleId: string, quantity: number, key: string) {
      // B3 OpenAPI declares both casings. openapi-fetch normalizes them with Headers.set.
      const { data } = await client.POST("/api/v1/checkout-holds", { params: { header: { Origin: origin(), "Idempotency-Key": key, "idempotency-key": key } }, body: { raffleId, quantity }, signal: signal() });
      return checked(data);
    },
    async get(id: string) {
      const { data } = await client.GET("/api/v1/checkout-holds/{id}", { params: { path: { id } }, signal: signal() });
      return checked(data);
    },
    async cancel(id: string) {
      const { data } = await client.DELETE("/api/v1/checkout-holds/{id}", { params: { path: { id }, header: { Origin: origin() } }, signal: signal() });
      return checked(data);
    },
    async banks() {
      const { data } = await client.GET("/api/v1/bank-accounts/public", { signal: signal() });
      if (!data) throw new ApiError("INVALID_RESPONSE", 502);
      return data.items;
    },
  };
}
