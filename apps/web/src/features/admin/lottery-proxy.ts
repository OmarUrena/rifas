import { NextRequest, NextResponse } from "next/server";
import type { components } from "@sorteos/api-client";
import { AdminError, backendClient, checked, jsonBody, privateHeaders } from "./server";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function lotteryRoute(method: string, path: string[]) {
 return path[0] === "raffles" && uuid.test(path[1] ?? "") && path[2] === "lottery" &&
  (method === "POST" ? path.length === 3 : method === "GET" && path.length === 4 && ["prizes", "results", "awards", "deliveries"].includes(path[3] ?? ""));
}
export async function proxyLottery(request: NextRequest, path: string[], client: ReturnType<typeof backendClient>) {
 const id = path[1]!; let data: unknown;
 if (request.method === "POST") {
  const key = request.headers.get("Idempotency-Key"); if (!key || !uuid.test(key)) throw new AdminError("INVALID_REQUEST", 400);
  data = await checked(await client.POST("/api/v1/admin/raffles/{id}/lottery", { params: { path: { id }, header: { "Idempotency-Key": key } }, body: await jsonBody(request, 8192) as unknown as components["schemas"]["LotteryInputDto"] }));
 } else {
  const query: { page?: number; pageSize?: number } = {};
  for (const [key, value] of request.nextUrl.searchParams) {
   if (!["page", "pageSize"].includes(key) || request.nextUrl.searchParams.getAll(key).length !== 1) throw new AdminError("INVALID_REQUEST", 400);
   Object.assign(query, { [key]: Number(value) });
  }
  data = await checked(await client.GET("/api/v1/admin/raffles/{id}/lottery/{kind}", { params: { path: { id, kind: path[3]! }, query } }));
 }
 return NextResponse.json(data, { headers: privateHeaders });
}
