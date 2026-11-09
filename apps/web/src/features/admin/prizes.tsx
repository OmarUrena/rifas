"use client";
import Link from "next/link";
import { LotteryWorkspace } from "./lottery";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { components } from "@sorteos/api-client";
import { Alert, Button, Card, Input } from "@/components/ui";
import { BlessedNumbers } from "@/features/raffles/blessed-numbers";
import { adminFetch } from "./client";
import { parseMinor, type AdminSession } from "./types";
import { formatDate, formatMoney } from "@/lib/format";
type S = components["schemas"];
const awardLabels = { PENDING_PAYMENT: "Pendiente de pago", CONFIRMED: "Premio confirmado", VOIDED: "Adjudicación anulada" };
export function PrizesWorkspace({ id, role }: { id: string; role: AdminSession["role"] }) {
  const [configuration, setConfiguration] = useState<S["PrizeConfigurationDto"] | null>(null), [numbers, setNumbers] = useState<S["BlessedNumbersPageDto"] | null>(null), [awards, setAwards] = useState<S["BlessedAwardsPageDto"] | null>(null);
  const [revision, setRevision] = useState(0), [numberPage, setNumberPage] = useState(1), [awardPage, setAwardPage] = useState(1), [filter, setFilter] = useState("");
  const [error, setError] = useState(""), [notice, setNotice] = useState(""), [busy, setBusy] = useState(false), [kind, setKind] = useState("ITEM"), [mode, setMode] = useState("MANUAL");
  const flight = useRef(false), intent = useRef<{ body: string; route: string; key: string } | null>(null);
  const root = `/admin/api/raffles/${id}`;
  useEffect(() => {
    let active = true;
    Promise.all([adminFetch<S["PrizeConfigurationDto"]>(`${root}/prizes`), adminFetch<S["BlessedNumbersPageDto"]>(`${root}/blessed-numbers?page=${numberPage}&pageSize=12`), adminFetch<S["BlessedAwardsPageDto"]>(`${root}/blessed-awards?page=${awardPage}&pageSize=12${filter ? `&status=${filter}` : ""}`)])
      .then(([config, digits, winners]) => { if (active) { setConfiguration(config); setNumbers(digits); setAwards(winners); } })
      .catch(error => { if (active) setError(error.message); });
    return () => { active = false; };
  }, [root, revision, numberPage, awardPage, filter]);
  function reload() { setError(""); setConfiguration(null); setNumbers(null); setAwards(null); setRevision(n => n + 1); }
  async function mutate(route: string, value: object) {
    if (flight.current) return;
    const body = JSON.stringify(value); if (intent.current?.body !== body || intent.current.route !== route) intent.current = { route, body, key: crypto.randomUUID() };
    flight.current = true; setBusy(true); setError(""); setNotice("");
    try { await adminFetch(`${root}/${route}`, { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": intent.current.key }, body }); setNotice("Configuración registrada. Los datos guardados son definitivos."); reload(); }
    catch (error) { setError(error instanceof Error ? error.message : "No se pudo guardar."); }
    finally { flight.current = false; setBusy(false); }
  }
  function createPrize(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!configuration) return;
    const form = new FormData(event.currentTarget), text = (key: string) => String(form.get(key) ?? "").trim();
    try { void mutate("prizes", { title: text("title"), description: text("description"), kind, quantity: Number(text("quantity")), ...(kind === "MONEY" ? { amountMinor: parseMinor(text("amount")) } : {}), expectedVersion: configuration.version }); }
    catch (error) { setError(error instanceof Error ? error.message : "Revisa el premio."); }
  }
  function createNumbers(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!configuration) return;
    const form = new FormData(event.currentTarget), raw = String(form.get("numbers") ?? "").trim();
    const digits = raw ? raw.split(/[\s,;]+/) : [];
    if (mode === "MANUAL" && (!digits.length || digits.some(n => !/^\d{5}$/.test(n)) || new Set(digits).size !== digits.length)) { setError("Escribe números distintos de cinco cifras, separados por coma o espacio."); return; }
    void mutate("blessed-numbers", { prizeId: String(form.get("prize")), mode, ...(mode === "MANUAL" ? { numbers: digits } : { quantity: Number(form.get("count")) }), expectedVersion: configuration.version });
  }
  const editable = role === "OWNER" && configuration?.configurable;
  return <><LotteryWorkspace id={id} role={role} /><div className="admin-toolbar"><Link href={`/admin/rifas/${id}`}>← Volver a la rifa</Link><Button className="button-secondary" onClick={reload} disabled={busy}>Actualizar premios y registros</Button></div>
    {notice && <p role="status">{notice}</p>}{error && <Alert title="No se pudieron completar los premios" tone="error">{error}</Alert>}
    {!configuration ? <p role="status">{error ? "Actualiza los datos para volver a intentar." : "Cargando premios y beneficiarios…"}</p> : <>
      <Alert title="Un premio por número">Los premios y números guardados no pueden editarse ni eliminarse. Solo se pueden añadir antes de la primera publicación y antes de crear pre-reservas.</Alert>
      {!configuration.configurable && <p>Configuración cerrada. Puedes consultar los números y sus beneficiarios.</p>}
      <Card><h2>Premios bendecidos</h2>{configuration.prizes.length ? <ul>{configuration.prizes.map(prize => <li key={prize.id}><strong>{prize.title}</strong>{prize.amountMinor !== null ? ` · ${formatMoney(prize.amountMinor)}` : ""} · {prize.assignedNumbers}/{prize.quantity} unidades asociadas a números.</li>)}</ul> : <p>Esta rifa todavía no tiene premios bendecidos.</p>}
        {editable && <form className="admin-form" onSubmit={createPrize}><fieldset disabled={busy}><legend>Registrar premio</legend>
          <Input id="prize-title" name="title" label="Nombre del premio" required maxLength={180} />
          <Input id="prize-description" name="description" label="Descripción del premio" maxLength={2000} />
          <label className="field">Tipo de premio<select value={kind} onChange={event => setKind(event.target.value)}><option value="ITEM">Artículo</option><option value="MONEY">Dinero</option><option value="OTHER">Otro</option></select></label>
          {kind === "MONEY" && <Input id="prize-amount" name="amount" label="Importe del premio (DOP)" inputMode="decimal" required />}
          <Input id="prize-quantity" name="quantity" label="Unidades disponibles de este premio" type="number" min={1} max={100000} defaultValue={1} required />
          <label className="admin-check"><input type="checkbox" required />Confirmo que este premio es definitivo.</label><Button disabled={busy}>Registrar premio</Button>
        </fieldset></form>}
      </Card>
      {editable && configuration.prizes.length > 0 && <Card><h2>Añadir números bendecidos</h2><form className="admin-form" onSubmit={createNumbers}><fieldset disabled={busy}>
        <label className="field">Premio<select name="prize" required defaultValue=""><option value="">Selecciona un premio</option>{configuration.prizes.map(prize => <option key={prize.id} value={prize.id} disabled={prize.assignedNumbers >= prize.quantity}>{prize.title} · {prize.quantity - prize.assignedNumbers} disponibles</option>)}</select></label>
        <label className="field">Asignación de bendecidos<select value={mode} onChange={event => setMode(event.target.value)}><option value="MANUAL">Introducir números</option><option value="RANDOM">Elegir aleatoriamente en servidor</option></select></label>
        {mode === "MANUAL" ? <Input id="blessed-digits" name="numbers" label="Números bendecidos (cinco cifras)" required placeholder="00007, 12345" hint="Separados por coma o espacio. No se crean boletos al configurarlos." /> : <Input id="blessed-count" name="count" label="Cantidad de números aleatorios" type="number" min={1} max={1000} defaultValue={1} required hint="Máximo 1000 por operación." />}
        <label className="admin-check"><input type="checkbox" required />Confirmo que estos números y su premio son definitivos.</label><Button disabled={busy}>Guardar números bendecidos</Button>
      </fieldset></form></Card>}
      <Card><h2>Números registrados</h2>{numbers?.items.length ? <BlessedNumbers numbers={numbers.items} /> : <p>No hay números bendecidos en esta página.</p>}
        {numbers && <div className="admin-toolbar"><Button className="button-secondary" disabled={busy || numberPage <= 1} onClick={() => { setNumbers(null); setNumberPage(n => n - 1); }}>Números anteriores</Button><span>{numberPage} / {Math.max(1, Math.ceil(numbers.pagination.total / 12))}</span><Button className="button-secondary" disabled={busy || numberPage * 12 >= numbers.pagination.total} onClick={() => { setNumbers(null); setNumberPage(n => n + 1); }}>Más números</Button></div>}
      </Card>
      <Card><h2>Beneficiarios e histórico</h2><label className="field">Estado del premio<select value={filter} onChange={event => { setFilter(event.target.value); setAwardPage(1); setAwards(null); }}><option value="">Todos los estados</option>{Object.entries(awardLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        {!awards ? <p role="status">Consultando registros…</p> : awards.items.length ? <ul className="admin-history">{awards.items.map(award => <li key={award.id}><strong>{award.number} · {award.prizeTitle}</strong><p style={{ overflowWrap: "anywhere" }}>ID de adjudicación: {award.id}</p><p>{awardLabels[award.status]} · {formatDate(award.createdAt)}</p><p>{award.customerName} · {award.customerPhone}{award.customerEmail ? ` · ${award.customerEmail}` : ""}</p><Link href={`/admin/ordenes/${award.orderId}`} prefetch={false}>Ver orden {award.orderCode}</Link></li>)}</ul> : <p>No hay beneficiarios para este filtro.</p>}
        {awards && <div className="admin-toolbar"><Button className="button-secondary" disabled={busy || awardPage <= 1} onClick={() => { setAwards(null); setAwardPage(n => n - 1); }}>Registros anteriores</Button><span>{awardPage} / {Math.max(1, Math.ceil(awards.pagination.total / 12))}</span><Button className="button-secondary" disabled={busy || awardPage * 12 >= awards.pagination.total} onClick={() => { setAwards(null); setAwardPage(n => n + 1); }}>Más registros</Button></div>}
      </Card>
    </>}
  </>;
}
