"use client";
import { useRef, useState, type FormEvent } from "react";
import { Alert, Button, Card, Input } from "@/components/ui";
import { useHydrated } from "@/lib/use-hydrated";
import { adminFetch } from "./client";
import { parseMinor } from "./types";
import { aggregateMoney, type AdminRaffle } from "./operations";

export function FundraisingTarget({ raffle, owner, onSaved }: { raffle: AdminRaffle; owner: boolean; onSaved: () => void }) {
  const hydrated = useHydrated(), flight = useRef(false);
  const intent = useRef<{ body: string; key: string } | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (flight.current) return;
    setError("");
    try {
      const form = new FormData(event.currentTarget);
      const body = JSON.stringify({ fundraisingTargetMinor: parseMinor(String(form.get("target"))), expectedVersion: raffle.version, reason: String(form.get("reason")).trim() });
      if (intent.current?.body !== body) intent.current = { body, key: crypto.randomUUID() };
      flight.current = true; setBusy(true);
      await adminFetch(`/admin/api/raffles/${raffle.id}/fundraising-target`, { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": intent.current.key }, body });
      onSaved();
    } catch (error) { setError(error instanceof Error ? error.message : "No se pudo actualizar el objetivo."); }
    finally { flight.current = false; setBusy(false); }
  }
  const target = raffle.fundraisingTargetMinor;
  return <Card><h2>Objetivo de recaudación</h2>
    <p>Ingresos confirmados: {aggregateMoney(raffle.confirmedAmountMinor)}. Progreso real: {raffle.actualProgressPercent === null ? "Sin objetivo" : `${raffle.actualProgressPercent}%`}.</p>
    {target === null && <Alert title="Objetivo pendiente">Esta rifa no muestra progreso público hasta configurar su objetivo.</Alert>}
    <p>El objetivo es privado. Alcanzarlo no cierra las ventas ni modifica los boletos disponibles.</p>
    {error && <Alert title="No se pudo guardar el objetivo" tone="error">{error}</Alert>}
    {owner ? <form className="admin-form" onSubmit={submit}><fieldset disabled={busy || !hydrated}>
      <Input id="fundraising-target" name="target" label="Objetivo (DOP)" inputMode="decimal" required defaultValue={target === null ? "" : `${BigInt(target) / 100n}.${String(BigInt(target) % 100n).padStart(2, "0")}`} />
      <Input id="target-reason" name="reason" label="Motivo del cambio" required maxLength={500} />
      <Button disabled={busy}>{busy ? "Guardando…" : "Guardar objetivo"}</Button>
    </fieldset></form> : <p>Solo el propietario puede modificar el objetivo.</p>}
  </Card>;
}
