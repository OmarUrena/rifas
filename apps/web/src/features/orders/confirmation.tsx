"use client";
import Link from "next/link";
import { BlessedAwards } from "./blessed-awards";
import { useEffect, useState } from "react";
import { Alert, Button } from "@/components/ui";
import { ApiError } from "@/lib/api/errors";
import { formatDate, formatMoney } from "@/lib/format";
import { orderApi, type Order } from "./api";

export function OrderSummary({ order }: { order: Order }) {
  const labels: Record<string, string> = { PENDING_REVIEW: "Pago pendiente de revisión", UNDER_REVIEW: "Pago en revisión", NEEDS_RESOLUTION: "Requiere resolución", PAID: "Pago confirmado", CANCELLED: "Orden cancelada" };
  return <section className="order-confirmation" aria-labelledby="order-title">
    <h1 id="order-title" tabIndex={-1}>{order.status === "PAID" ? "Pago confirmado" : order.status === "CANCELLED" ? "Orden cancelada" : "Orden recibida"}</h1>
    <Alert title={labels[order.status] ?? "Estado de tu orden"}>{order.status === "PAID" ? "El administrador verificó tu pago." : order.status === "CANCELLED" ? "Cancelada mediante resolución administrativa." : "Tus números están reservados. No repitas la transferencia."}</Alert>
    <h2>{order.status === "PAID" ? "Tus boletos" : order.status === "CANCELLED" ? "Números históricos" : "Tus números reservados"}</h2>
    <ul className="ticket-numbers" aria-label="Números asignados a la orden">{order.ticketNumbers.map(number => <li key={number}>{number}</li>)}</ul>
    <BlessedAwards awards={order.blessedAwards} />
    <p>Código de orden: <strong className="order-code">{order.orderCode}</strong></p>
    <div className="confirmation-actions"><Link href="/consultar-boletos" className="button">Consultar mis boletos</Link><Link href="/ayuda#incidencias" className="text-link">Ayuda con tu orden</Link></div>
    <details><summary>Ver resumen de la orden</summary><dl className="checkout-summary"><div><dt>Rifa</dt><dd>{order.raffleTitle}</dd></div><div><dt>Cantidad</dt><dd>{order.quantity}</dd></div><div><dt>Total registrado</dt><dd>{formatMoney(order.totalMinor)}</dd></div><div><dt>Registrada</dt><dd>{formatDate(order.createdAt)}</dd></div></dl></details>
    <p className="field-hint">Guarda el código; el acceso completo requiere tu sesión protegida.</p>
  </section>;
}

export async function rememberOrder(orderCode: string) {
  const response = await fetch("/api/order-locator", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderCode }), cache: "no-store" });
  if (!response.ok) throw new ApiError("NETWORK_ERROR", response.status);
}

export function ProtectedConfirmation({ baseUrl, code }: { baseUrl: string; code: string | null }) {
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(true);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let current = true;
    if (!code) return;
    orderApi(baseUrl).get(code).then(result => { if (current) { setOrder(result); setError(null); } }).catch(error => { if (current) setError(error instanceof ApiError ? error : new ApiError("NETWORK_ERROR", 0)); }).finally(() => { if (current) setBusy(false); });
    return () => { current = false; };
  }, [baseUrl, code, attempt]);
  useEffect(() => {
    if (order && !error) document.getElementById("order-title")?.focus({ preventScroll: true });
  }, [order, error]);
  if (!code) return <><h1>No hay una orden para consultar en este navegador</h1><p>Si enviaste un formulario y no recibiste confirmación, vuelve a la recuperación del mismo envío.</p><Link href="/orden/recuperar" className="button">Recuperar envío pendiente</Link></>;
  return <div className="order-confirmation">{order && !error && <OrderSummary order={order} />}{busy && <p role="status">Consultando tu orden de forma protegida…</p>}{error && <Alert title="No pudimos consultar la orden" tone="error"><p>{error.status === 401 || error.status === 404 ? "La sesión actual no permite consultar esta orden. No repitas la compra: si perdiste la cookie, solicita asistencia por un canal verificado." : error.message}</p>{error.requestId && <p>Referencia: {error.requestId}</p>}<Link href="/ayuda#incidencias">Cómo solicitar asistencia</Link></Alert>}<Button className="button-secondary" disabled={busy} onClick={() => { setOrder(null); setBusy(true); setAttempt(value => value + 1); }}>Actualizar estado de la orden</Button></div>;
}
