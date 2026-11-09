"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { components } from "@sorteos/api-client";
import Link from "next/link";
import { Alert, Button, Card, Input } from "@/components/ui";
import { adminFetch } from "./client";
import type { AdminSession } from "./types";
import { formatDate } from "@/lib/format";
type Row = components["schemas"]["LotteryRecordDto"];
type Kind = "prizes" | "results" | "awards" | "deliveries";
export function localLotteryTime(value: string): string {
 if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(value)) throw new Error("Indica una fecha y hora válidas para el evento o entrega.");
 const date = new Date(`${value.length === 16 ? `${value}:00` : value}-04:00`);
 if (!Number.isFinite(date.getTime())) throw new Error("Fecha del evento o entrega no válida.");
 return date.toISOString();
}
const kinds: Kind[] = ["prizes", "results", "awards", "deliveries"];
const labels: Record<string, string> = { AVAILABLE: "Disponible", AWARDED: "Adjudicado", PRELIMINARY: "Preliminar: ventas abiertas al registrar", NO_ELIGIBLE_WINNER: "Sin ganador elegible", ELIGIBLE: "Boleto pagado elegible", CONFIRMED: "Adjudicación confirmada", DELIVERED: "Entregado" };
export function LotteryWorkspace({ id, role }: { id: string; role: AdminSession["role"] }) {
 const [data, setData] = useState<components["schemas"]["LotteryPageDto"] | null>(null), [kind, setKind] = useState<Kind>("results"), [page, setPage] = useState(1);
 const [options, setOptions] = useState<{ prizes: Row[]; results: Row[] }>({ prizes: [], results: [] });
 const [error, setError] = useState(""), [notice, setNotice] = useState(""), [busy, setBusy] = useState(false), [revision, setRevision] = useState(0);
 const intent = useRef<{ body: string; key: string } | null>(null), flight = useRef(false);
 const root = `/admin/api/raffles/${id}/lottery`;
 useEffect(() => {
  let active = true;
  Promise.all([adminFetch<components["schemas"]["LotteryPageDto"]>(`${root}/${kind}?page=${page}&pageSize=12`), adminFetch<components["schemas"]["LotteryPageDto"]>(`${root}/prizes?page=1&pageSize=100`), adminFetch<components["schemas"]["LotteryPageDto"]>(`${root}/results?page=1&pageSize=100`)])
   .then(([history, prizes, results]) => { if (active) { setData(history); setOptions({ prizes: prizes.items, results: results.items }); } })
   .catch(e => { if (active) setError(e.message); });
  return () => { active = false; };
 }, [root, kind, page, revision]);
 async function submit(event: FormEvent<HTMLFormElement>, action: "PRIZE" | "RESULT" | "AWARD" | "DELIVERY") {
  event.preventDefault(); if (flight.current) return;
  const form = new FormData(event.currentTarget), value = (key: string) => String(form.get(key) ?? "").trim();
  setError(""); setNotice("");
  try {
   const number = value("number");
   if (action === "RESULT" && !/^[0-9]{5}$/.test(number)) throw new Error("Indica un número de exactamente cinco cifras.");
   const payload = action === "PRIZE" ? { action, title: value("title") } : action === "RESULT" ? { action, pick4: number.slice(0, 4), fireball: number.slice(4), eventAt: localLotteryTime(value("eventAt")), reference: value("reference") } : action === "AWARD" ? { action, resultId: value("resultId"), prizeId: value("prizeId") } : { action, awardId: value("awardId"), source: value("source"), eventAt: localLotteryTime(value("eventAt")), reference: value("reference") };
   const body = JSON.stringify(payload); if (intent.current?.body !== body) intent.current = { body, key: crypto.randomUUID() };
   flight.current = true; setBusy(true);
   await adminFetch(root, { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": intent.current.key }, body });
   setNotice("Registro guardado. El historial se conserva."); setData(null); setRevision(n => n + 1);
  } catch (e) { setError(e instanceof Error ? e.message : "No se pudo registrar la operación."); }
  finally { flight.current = false; setBusy(false); }
 }
 return <section aria-labelledby="lottery-heading"><h2 id="lottery-heading">Lotería y entregas</h2>
  <p>Introduce el número completo de cinco cifras, incluidos los ceros iniciales. Usa el evento y horario establecidos en las reglas. Las horas del formulario son de Santo Domingo.</p>
  {error && <Alert title="No se pudo completar la operación" tone="error">{error}</Alert>}{notice && <p role="status">{notice}</p>}
  {role === "OWNER" && <>
   <Card><h3>Registrar premio de lotería</h3><p>Una unidad por registro. Configurar antes de publicar. Los premios bendecidos tienen unidades independientes.</p><form className="admin-form" onSubmit={e => void submit(e, "PRIZE")}><fieldset disabled={busy}><Input id="lottery-prize-title" name="title" label="Premio principal o secundario" required maxLength={180} /><label className="admin-check"><input type="checkbox" required />Confirmo el premio definitivo.</label><Button>Guardar premio de lotería</Button></fieldset></form></Card>
   <Card><h3>Registrar resultado manual</h3><p>El resultado es preliminar. Para adjudicar, las ventas deben estar cerradas antes del registro y todos los pagos conciliados. Si no hay ganador, registra otra edición cuando corresponda; conserva los registros previos.</p><form className="admin-form" onSubmit={e => void submit(e, "RESULT")}><fieldset disabled={busy}>
    <Input id="lottery-number" name="number" label="Número ganador (cinco cifras)" inputMode="numeric" pattern="[0-9]{5}" minLength={5} maxLength={5} required />
    <Input id="lottery-event" name="eventAt" label="Fecha y hora del evento (Santo Domingo)" type="datetime-local" step={1} required />
    <Input id="lottery-reference" name="reference" label="Edición, horario y referencia verificable del resultado" maxLength={1000} required />
    <label className="admin-check"><input type="checkbox" required />Verifiqué el resultado y el horario de las reglas.</label><Button>Registrar resultado y buscar boleto</Button>
   </fieldset></form></Card>
   <Card><h3>Confirmar adjudicación</h3><form className="admin-form" onSubmit={e => void submit(e, "AWARD")}><fieldset disabled={busy}>
    <label className="field">Resultado y beneficiario<select aria-label="Resultado y beneficiario" name="resultId" required defaultValue=""><option value="">Selecciona un resultado</option>{options.results.filter(r => r.status === "ELIGIBLE").map(r => <option key={r.id} value={r.id}>{r.number} · {r.customerName} · {formatDate(r.eventAt)} · {r.reference}</option>)}</select></label>
    <label className="field">Premio disponible<select aria-label="Premio disponible" name="prizeId" required defaultValue=""><option value="">Selecciona un premio</option>{options.prizes.filter(r => r.status === "AVAILABLE").map(r => <option key={r.id} value={r.id}>{r.title}</option>)}</select></label>
    <label className="admin-check"><input type="checkbox" required />Confirmo número, beneficiario, premio y fuente; esta adjudicación es definitiva.</label><Button>Confirmar premio</Button>
   </fieldset></form></Card>
   <Card><h3>Documentar entrega</h3><p>Copia el identificador de la adjudicación desde el historial de lotería o de beneficiarios bendecidos. Solo se admiten premios confirmados.</p><form className="admin-form" onSubmit={e => void submit(e, "DELIVERY")}><fieldset disabled={busy}>
    <label className="field">Origen<select aria-label="Origen" name="source"><option value="LOTTERY">Lotería</option><option value="BLESSED">Bendecido</option></select></label>
    <Input id="delivery-award" name="awardId" label="Identificador de adjudicación" required />
    <Input id="delivery-date" name="eventAt" label="Fecha y hora de entrega (Santo Domingo)" type="datetime-local" step={1} required />
    <Input id="delivery-reference" name="reference" label="Referencia privada de constancia de entrega" required maxLength={1000} />
    <label className="admin-check"><input type="checkbox" required />Confirmo que la entrega ya ocurrió y está documentada.</label><Button>Registrar entrega</Button>
   </fieldset></form></Card>
  </>}
  <Card><h3>Histórico privado</h3><label className="field">Registros<select aria-label="Registros" value={kind} onChange={e => { setKind(e.target.value as Kind); setPage(1); setData(null); setError(""); }}>{kinds.map((k, i) => <option key={k} value={k}>{["Premios", "Resultados", "Adjudicaciones", "Entregas"][i]}</option>)}</select></label>
   {!data ? <p role="status">{error ? "No se pudo cargar el historial." : "Cargando registros…"}</p> : !data.items.length ? <p>No hay registros.</p> : <ul className="admin-history">{data.items.map(row => <li key={row.id}><strong>{row.number} {row.title}</strong><p>{labels[row.status] ?? row.status} · {formatDate(row.eventAt)}</p><p style={{ overflowWrap: "anywhere" }}>{row.reference} {row.customerName} {row.customerPhone}</p><p style={{ overflowWrap: "anywhere" }}>ID: {row.id}{row.actorId ? ` · Responsable: ${row.actorId}` : ""}</p>{row.orderId && <Link href={`/admin/ordenes/${row.orderId}`} prefetch={false}>Ver orden del beneficiario</Link>}</li>)}</ul>}
   <div className="admin-toolbar"><Button disabled={page <= 1 || busy} onClick={() => { setPage(p => p - 1); setData(null); }}>Anteriores</Button><span>Página {page}</span><Button disabled={!data || page * 12 >= data.total || busy} onClick={() => { setPage(p => p + 1); setData(null); }}>Siguientes</Button><Button disabled={busy} onClick={() => { setError(""); setData(null); setRevision(n => n + 1); }}>Actualizar histórico</Button></div>
  </Card>
 </section>;
}
