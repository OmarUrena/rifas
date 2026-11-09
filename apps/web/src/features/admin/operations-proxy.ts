import { NextRequest, NextResponse } from "next/server";
import type { components, paths } from "@sorteos/api-client";
import { AdminError, backendClient, checked, jsonBody, privateHeaders } from "./server";
import { prizeRoute, proxyPrizes } from "./prizes-proxy";
import { lotteryRoute, proxyLottery } from "./lottery-proxy";
type Schemas = components["schemas"];
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function operationRoute(method: string, path: string[]) {
  if (lotteryRoute(method, path)) return true;
  if (prizeRoute(method, path)) return true;
  if (method === "GET" && (path.join("/") === "dashboard" || path.join("/") === "reports/orders.csv")) return true;
  if (method === "POST" && path.join("/") === "media") return true;
  if (path[0] !== "raffles") return false;
  return (path.length === 1 && ["GET", "POST"].includes(method)) || (path.length === 2 && uuid.test(path[1] ?? "") && ["GET", "PATCH"].includes(method)) || (path.length === 3 && uuid.test(path[1] ?? "") && (method === "GET" ? path[2] === "summary" : method === "POST" && ["publish", "pause", "resume", "close", "fundraising-target"].includes(path[2] ?? "")));
}
export async function proxyOperation(request: NextRequest, path: string[], client: ReturnType<typeof backendClient>) {
  if (lotteryRoute(request.method, path)) return proxyLottery(request, path, client);
  if (prizeRoute(request.method, path)) return proxyPrizes(request, path, client);
  const id = path[1] ?? "", params = { path: { id } };
  let data: unknown;
  if (path[0] === "dashboard") data = await checked(await client.GET("/api/v1/admin/dashboard"));
  if (path[0] === "reports") {
    const query: NonNullable<paths["/api/v1/admin/reports/orders.csv"]["get"]["parameters"]["query"]> = {};
    for (const [key, value] of request.nextUrl.searchParams) {
      if (!["status", "raffleId", "from", "to"].includes(key) || request.nextUrl.searchParams.getAll(key).length !== 1) throw new AdminError("INVALID_REQUEST", 400);
      Object.assign(query, { [key]: value });
    }
    const blob: unknown = await checked(await client.GET("/api/v1/admin/reports/orders.csv", { params: { query }, parseAs: "blob" }));
    if (!(blob instanceof Blob) || !blob.type.startsWith("text/csv")) throw new AdminError("INVALID_RESPONSE", 502);
    return new NextResponse(blob, { headers: { ...privateHeaders, "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="ordenes.csv"' } });
  }
  if (path[0] === "media") {
    if (!request.headers.get("content-type")?.startsWith("multipart/form-data")) throw new AdminError("INVALID_REQUEST", 400);
    const reader = request.body?.getReader(); if (!reader) throw new AdminError("INVALID_REQUEST", 400);
    const chunks: Uint8Array[] = []; let size = 0;
    while (true) { const { value, done } = await reader.read(); if (done) break; size += value.length; if (size > 5 * 1024 * 1024 + 4096) { await reader.cancel(); throw new AdminError("INVALID_REQUEST", 413); } chunks.push(value); }
    let form: FormData;
    try { form = await new Response(Buffer.concat(chunks), { headers: { "Content-Type": request.headers.get("content-type")! } }).formData(); } catch { throw new AdminError("INVALID_REQUEST", 400); }
    if (Array.from(form.keys()).some(key => key !== "image") || form.getAll("image").length !== 1 || !(form.get("image") instanceof File)) throw new AdminError("INVALID_REQUEST", 400);
    data = await checked(await client.POST("/api/v1/admin/media", { body: { image: "" }, bodySerializer: () => form }));
  }
  if (path[0] === "raffles") {
    if (request.method === "GET") {
      if (path.length === 1) {
        const query: NonNullable<paths["/api/v1/admin/raffles"]["get"]["parameters"]["query"]> = {};
        for (const [key, value] of request.nextUrl.searchParams) {
          if (!["page", "pageSize", "status"].includes(key) || request.nextUrl.searchParams.getAll(key).length !== 1) throw new AdminError("INVALID_REQUEST", 400);
          Object.assign(query, { [key]: key === "status" ? value : Number(value) });
        }
        data = await checked(await client.GET("/api/v1/admin/raffles", { params: { query } }));
      } else if (path[2] === "summary") data = await checked(await client.GET("/api/v1/admin/raffles/{id}/summary", { params }));
      else data = await checked(await client.GET("/api/v1/admin/raffles/{id}", { params }));
    } else {
      const body = await jsonBody(request, 65536);
      if (request.method === "PATCH") data = await checked(await client.PATCH("/api/v1/admin/raffles/{id}", { params, body: body as Schemas["PatchRaffleDto"] }));
      else if (path.length === 1) data = await checked(await client.POST("/api/v1/admin/raffles", { body: body as unknown as Schemas["CreateRaffleDto"] }));
      else switch (path[2]) {
        case "fundraising-target": data = await checked(await client.POST("/api/v1/admin/raffles/{id}/fundraising-target", { params: { ...params, header: { "Idempotency-Key": request.headers.get("Idempotency-Key") ?? "" } }, body: body as unknown as Schemas["UpdateFundraisingTargetDto"] })); break;
        case "publish": data = await checked(await client.POST("/api/v1/admin/raffles/{id}/publish", { params, body: body as unknown as Schemas["PublicationApprovalDto"] })); break;
        case "resume": data = await checked(await client.POST("/api/v1/admin/raffles/{id}/resume", { params, body: body as unknown as Schemas["PublicationApprovalDto"] })); break;
        case "pause": data = await checked(await client.POST("/api/v1/admin/raffles/{id}/pause", { params })); break;
        case "close": data = await checked(await client.POST("/api/v1/admin/raffles/{id}/close", { params, body: body as unknown as Schemas["ReviewDto"] })); break;
      }
    }
  }
  return NextResponse.json(data, { headers: privateHeaders });
}
