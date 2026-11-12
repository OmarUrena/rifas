import { submitOrder, type OrderSubmission, type components } from "@sorteos/api-client";
import { createApiClient } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";

export type Order = components["schemas"]["OrderDto"];
export type OrderFields = Omit<OrderSubmission, "receipt" | "idempotencyKey">;
export function orderApi(baseUrl: string, origin = () => window.location.origin) {
  const client = createApiClient(baseUrl, 120000, true);
  const checked = (data: Order | undefined) => {
    if (!data || !/^RF-[A-Z0-9]{16,64}$/.test(data.orderCode) || !Number.isSafeInteger(data.totalMinor) || data.totalMinor < 0 || data.quantity !== data.ticketNumbers.length || new Set(data.ticketNumbers).size !== data.quantity || !data.ticketNumbers.every(number => /^\d+$/.test(number))) throw new ApiError("INVALID_RESPONSE", 502);
    return data;
  };
  return {
    async submit(fields: OrderFields, receipt: File, key: string) {
      // Shared B4 helper preserves multipart boundary and never sends a client price.
      const { data, response } = await submitOrder(client, { ...fields, receipt }, key, origin());
      if (response.status !== 201) throw new ApiError("INVALID_RESPONSE", 502);
      return checked(data);
    },
    async get(code: string) {
      const { data, response } = await client.GET("/api/v1/orders/{code}", { params: { path: { code } }, signal: AbortSignal.timeout(15000) });
      if (response.status !== 200) throw new ApiError("INVALID_RESPONSE", 502);
      return checked(data);
    },
  };
}
