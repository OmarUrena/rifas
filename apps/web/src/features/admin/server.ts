import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextRequest, NextResponse } from "next/server";
import { createClient, type Session } from "@supabase/supabase-js";
import { createApiClient } from "@sorteos/api-client";
import { readAdminEnvironment, readEnvironment } from "@/lib/config";
import type { AdminSession } from "./types";
import { fetchFromServer } from "@/lib/server-fetch";

export const privateHeaders = { "Cache-Control": "private, no-store, max-age=0", "Pragma": "no-cache", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer" };
export class AdminError extends Error {
  constructor(public code: string, public status: number) { super(code); }
}
const secure = () => process.env.NODE_ENV === "production" || ["staging", "production"].includes(process.env.APP_ENV ?? "development");
const prefix = () => secure() ? "__Secure-sorteos_admin_" : "sorteos_admin_";
export function adminConfigured() {
  return Boolean(readAdminEnvironment(process.env) && process.env.API_BASE_URL);
}
export function authClient() {
  if (!adminConfigured()) throw new AdminError("AUTH_UNAVAILABLE", 503);
  const config = readAdminEnvironment(process.env)!;
  // No browser SDK, localStorage, service key, shared client or automatic background refresh.
  return createClient(config.url, config.publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (input, init) => fetchFromServer(input, { ...init, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10000) }) },
  });
}
export async function tokens() {
  const jar = await cookies();
  // A separate tombstone is never cleared by refresh/read responses arriving after logout.
  // It grants no privileges; NestJS still authorizes every request with the real Auth token.
  if (jar.has(prefix() + "signed_out")) return { access_token: "", refresh_token: "" };
  return { access_token: [0, 1, 2].map(i => jar.get(prefix() + "access_" + i)?.value ?? "").join(""), refresh_token: jar.get(prefix() + "refresh")?.value ?? "" };
}
export function saveSession(response: NextResponse, session: Pick<Session, "access_token" | "refresh_token"> | null, establish = false) {
  if (session && (session.access_token.length > 8192 || session.refresh_token.length > 2048)) throw new AdminError("AUTH_UNAVAILABLE", 503);
  const options = { httpOnly: true, secure: secure(), sameSite: "strict" as const, path: "/admin", maxAge: session ? 28800 : 0 };
  for (let i = 0; i < 3; i++) response.cookies.set(prefix() + "access_" + i, session?.access_token.slice(i * 3000, (i + 1) * 3000) ?? "", options);
  response.cookies.set(prefix() + "refresh", session?.refresh_token ?? "", options);
  if (!session || establish) response.cookies.set(prefix() + "signed_out", session ? "" : "1", { ...options, maxAge: session ? 0 : 31536000 });
}
export function backendClient(accessToken: string) {
  const { apiBaseUrl } = readEnvironment(process.env);
  if (!apiBaseUrl) throw new AdminError("AUTH_UNAVAILABLE", 503);
  const client = createApiClient(new URL(apiBaseUrl).origin, accessToken);
  client.use({ onRequest: ({ request }) => new Request(request, { cache: "no-store", redirect: "error", signal: AbortSignal.timeout(15000) }) });
  return client;
}
export async function checked<T>(result: { data?: T; error?: unknown; response: Response }): Promise<T> {
  if (!result.response.ok || result.data === undefined) {
    const error = result.error as { error?: { code?: string } } | undefined;
    throw new AdminError(error?.error?.code ?? "SERVICE_UNAVAILABLE", result.response.status || 503);
  }
  return result.data;
}
export async function identity(accessToken: string): Promise<AdminSession> {
  if (!accessToken || accessToken.length > 8192) throw new AdminError("UNAUTHORIZED", 401);
  return checked(await backendClient(accessToken).GET("/api/v1/admin/session"));
}
export async function requireAdmin(allowMfa = false) {
  if (!adminConfigured()) redirect("/admin/login");
  const stored = await tokens();
  if (!stored.access_token) redirect("/admin/login");
  let session: AdminSession;
  try { session = await identity(stored.access_token); }
  catch (error) {
    if (error instanceof AdminError && error.status === 401) redirect("/admin/login");
    throw error;
  }
  if (session.mfaRequired && !allowMfa) redirect("/admin/mfa");
  return session;
}
export function sameOrigin(request: NextRequest) {
  const expected = process.env.WEB_ORIGIN || `${secure() ? "https:" : request.nextUrl.protocol}//${request.headers.get("host") ?? request.nextUrl.host}`;
  if (request.headers.get("origin") !== expected || request.headers.get("sec-fetch-site") === "cross-site") throw new AdminError("ORIGIN_NOT_ALLOWED", 403);
}
export async function jsonBody(request: NextRequest, maxBytes = 8192): Promise<Record<string, unknown>> {
  if (!request.headers.get("content-type")?.startsWith("application/json")) throw new AdminError("INVALID_REQUEST", 400);
  const reader = request.body?.getReader();
  if (!reader) throw new AdminError("INVALID_REQUEST", 400);
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) { const { done, value } = await reader.read(); if (done) break; size += value.byteLength; if (size > maxBytes) { await reader.cancel(); throw new AdminError("INVALID_REQUEST", 413); } chunks.push(value); }
    const body: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error();
    return body as Record<string, unknown>;
  } catch (error) { if (error instanceof AdminError) throw error; throw new AdminError("INVALID_REQUEST", 400); }
}
export function failure(error: unknown) {
  const known = error instanceof AdminError ? error : new AdminError("SERVICE_UNAVAILABLE", 503);
  const response = NextResponse.json({ error: { code: known.code } }, { status: known.status, headers: privateHeaders });
  if (known.status === 401 || ["ADMIN_ACCESS_REVOKED", "FORBIDDEN"].includes(known.code)) saveSession(response, null);
  return response;
}
export async function restoredAuth() {
  const stored = await tokens();
  if (!stored.access_token || !stored.refresh_token) throw new AdminError("UNAUTHORIZED", 401);
  const client = authClient();
  const { data, error } = await client.auth.setSession(stored);
  if (error || !data.session) throw new AdminError(error?.status && error.status >= 500 ? "AUTH_UNAVAILABLE" : "UNAUTHORIZED", error?.status && error.status >= 500 ? 503 : 401);
  return { client, session: data.session, changed: data.session.access_token !== stored.access_token || data.session.refresh_token !== stored.refresh_token };
}
