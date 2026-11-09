import { NextRequest, NextResponse } from "next/server";
import type { components } from "@sorteos/api-client";
import { AdminError, backendClient, checked, jsonBody, privateHeaders } from "./server";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function prizeRoute(method: string, path: string[]) {
  return path.length === 3 && path[0] === "raffles" && uuid.test(path[1] ?? "") &&
    (method === "GET" ? ["prizes", "blessed-numbers", "blessed-awards"].includes(path[2] ?? "") : method === "POST" && ["prizes", "blessed-numbers"].includes(path[2] ?? ""));
}
export async function proxyPrizes(request: NextRequest, path: string[], client: ReturnType<typeof backendClient>) {
  const id = path[1]!, operation = path[2]; let data: unknown;
  if (request.method === "GET") {
    const query: { page?: number; pageSize?: number; status?: components["schemas"]["BlessedAwardDto"]["status"] } = {};
    for (const [key, value] of request.nextUrl.searchParams) {
      if (!(operation === "prizes" ? [] : operation === "blessed-awards" ? ["page", "pageSize", "status"] : ["page", "pageSize"]).includes(key) || request.nextUrl.searchParams.getAll(key).length !== 1) throw new AdminError("INVALID_REQUEST", 400);
      Object.assign(query, { [key]: key === "status" ? value : Number(value) });
    }
    const params = { path: { id }, query };
    if (operation === "prizes") data = await checked(await client.GET("/api/v1/admin/raffles/{id}/prizes", { params: { path: { id } } }));
    if (operation === "blessed-numbers") data = await checked(await client.GET("/api/v1/admin/raffles/{id}/blessed-numbers", { params }));
    if (operation === "blessed-awards") data = await checked(await client.GET("/api/v1/admin/raffles/{id}/blessed-awards", { params }));
  } else {
    const key = request.headers.get("Idempotency-Key"); if (!key || !uuid.test(key)) throw new AdminError("INVALID_REQUEST", 400);
    const body = await jsonBody(request, 65536), params = { path: { id }, header: { "Idempotency-Key": key } };
    if (operation === "prizes") data = await checked(await client.POST("/api/v1/admin/raffles/{id}/prizes", { params, body: body as unknown as components["schemas"]["PrizeInputDto"] }));
    if (operation === "blessed-numbers") data = await checked(await client.POST("/api/v1/admin/raffles/{id}/blessed-numbers", { params, body: body as unknown as components["schemas"]["BlessedNumbersInputDto"] }));
  }
  return NextResponse.json(data, { headers: privateHeaders });
}
