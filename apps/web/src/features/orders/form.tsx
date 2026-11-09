"use client";
import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Alert, Button, Input } from "@/components/ui";
import { ApiError } from "@/lib/api/errors";
import type { BankAccount, Hold } from "@/features/checkout/api";
import { orderApi, type Order, type OrderFields } from "./api";
import { fingerprint, orderIntentKey, readOrderIntent, transferDate, validReceipt, writeOrderIntent, type OrderIntent } from "./intent";

type Props = { baseUrl: string; hold: Hold; active: boolean; serverNowMs: number; banks: BankAccount[] | null; rulesVersion: string; rules: string[]; maxBytes: number; onLock: (locked: boolean) => void; onSuccess: (order: Order) => Promise<void> };
export function OrderForm({ baseUrl, hold, active, serverNowMs, banks, rulesVersion, rules, maxBytes, onLock, onSuccess }: Props) {
  const api = useMemo(() => orderApi(baseUrl), [baseUrl]);
  const [fields, setFields] = useState({ customerName: "", customerPhone: "", customerEmail: "", bankAccountId: "", bankReference: "", date: "" });
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [intent, setIntent] = useState<OrderIntent | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [reference, setReference] = useState<string | undefined>();
  const sending = useRef(false);
  const frozen = useRef<{ fields: OrderFields; file: File; intent: OrderIntent } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [lockedFields, setLockedFields] = useState(false);
  const [touched,setTouched]=useState<Record<string,boolean>>({});
  const touch=(field:string)=>setTouched(previous=>({...previous,[field]:true}));

  useEffect(() => {
    let current = true;
    void Promise.resolve().then(() => {
      if (!current) return;
      try {
        const stored = readOrderIntent(sessionStorage);
        if (stored && stored.holdId !== hold.holdId) { setError("Hay un envío de otra pre-reserva pendiente. No crees otra orden; vuelve a su recuperación."); return; }
        setIntent(stored); onLock(!!stored?.uncertain);
        if (stored) setFields(value => ({ ...value, bankAccountId: stored.bankAccountId }));
        setReady(true);
      } catch { setError("No podemos recuperar de forma segura el envío. Solicita asistencia antes de intentarlo otra vez."); }
    });
    return () => { current = false; };
  }, [hold.holdId, onLock]);
  useEffect(() => {
    if (!file || !["image/jpeg", "image/png"].includes(file.type) || !validReceipt(file, maxBytes)) return;
    const url = URL.createObjectURL(file);
    let current = true;
    // Object URL is local; no receipt is sent to a preview service.
    void Promise.resolve().then(() => { if (current) setPreview(url); });
    return () => { current = false; URL.revokeObjectURL(url); };
  }, [file, maxBytes]);

  const iso = transferDate(fields.date);
  const phone = fields.customerPhone.trim().replace(/[\s().-]/g, "");
  const recover = !!intent?.uncertain;
  const dateAllowed = !!iso && (recover || Date.parse(iso) <= serverNowMs + 300000);
  const valid = fields.customerName.trim().length >= 2 && fields.customerName.trim().length <= 180 && !/[\p{Cc}]/u.test(fields.customerName) && /^\+[1-9][0-9]{7,14}$/.test(phone) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.customerEmail.trim()) && fields.customerEmail.trim().length <= 254 && !!fields.bankAccountId && fields.bankReference.trim().length > 0 && fields.bankReference.trim().length <= 180 && !/[\p{Cc}]/u.test(fields.bankReference) && dateAllowed && accepted && validReceipt(file, maxBytes);
  const canSubmit = ready && !busy && valid && (active || recover);
  const edit = (name: keyof typeof fields, value: string) => setFields(previous => ({ ...previous, [name]: value }));

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (sending.current || !canSubmit || !file || !iso) return;
    sending.current = true; setBusy(true); setError(null); setReference(undefined); setPhase("Validando datos y comprobante…");
    let submitted: OrderIntent | null = null;
    try {
      const payload: OrderFields = { holdId: hold.holdId, customerName: fields.customerName.trim(), customerPhone: phone, customerEmail: fields.customerEmail.trim(), bankAccountId: fields.bankAccountId, bankReference: fields.bankReference.trim(), transferDate: iso, acceptedRulesVersion: intent?.rulesVersion ?? rulesVersion };
      const digest = await fingerprint(payload, file);
      if (intent && intent.fingerprint !== digest) throw new Error("Para recuperar el envío introduce exactamente los datos originales y selecciona el mismo archivo. No cambies la referencia, fecha, cuenta ni comprobante.");
      const priorUnknown = !!intent?.uncertain;
      submitted = intent ?? { key: crypto.randomUUID(), holdId: hold.holdId, fingerprint: digest, bankAccountId: fields.bankAccountId, rulesVersion, uncertain: false };
      submitted = { ...submitted, uncertain: true };
      writeOrderIntent(sessionStorage, submitted); setIntent(submitted); onLock(true);
      frozen.current ??= { fields: payload, file, intent: submitted };
      setLockedFields(true); setPhase("Enviando comprobante y registrando la orden… No cierres esta pestaña.");
      let result: Order;
      try { result = await api.submit(frozen.current.fields, frozen.current.file, submitted.key); }
      catch (error) {
        // A known rejection of a FIRST attempt permits correction. An earlier unknown
        // outcome always preserves payload/key, even if a proxy now returns 4xx.
        if (!priorUnknown && error instanceof ApiError && [400, 413, 415, 422].includes(error.status)) {
          sessionStorage.removeItem(orderIntentKey); setIntent(null); frozen.current = null; setLockedFields(false); onLock(false);
        }
        throw error;
      }
      setPhase("Orden y comprobante recibidos.");
      await onSuccess(result);
    } catch (error) {
      setPhase("");
      if (error instanceof ApiError) { setError(error.code === "IDEMPOTENCY_CONFLICT" ? "Este intento tiene otros datos asociados. No crees otra orden: solicita asistencia." : error.message); setReference(error.requestId); }
      else setError(submitted ? "No pudimos confirmar el resultado. Conserva esta pestaña y recupera el mismo envío; no repitas la transferencia." : error instanceof Error ? error.message : "Revisa los datos antes de enviar.");
    } finally { sending.current = false; setBusy(false); }
  }
  return <form className="order-form" id="enviar-orden" onSubmit={submit} aria-busy={busy}>
    <h2>Completa tu orden</h2>
    {recover && <Alert title="Recuperación del mismo envío">La respuesta anterior no confirmó el resultado. Intentaremos recuperar la orden ya enviada. Si recargaste, vuelve a introducir los datos originales y selecciona el mismo archivo. No hagas otra transferencia. <Link href="/orden/recuperar">Abrir recuperación</Link>.</Alert>}
    {!active && !recover && <Alert title="No se puede enviar con este cupo" tone="error">La pre-reserva ya no está vigente. Si transferiste, solicita asistencia; no crees otro cupo para intentar vincular el pago.</Alert>}
    <fieldset disabled={!ready || busy || lockedFields}>
      <legend>Datos del comprador</legend>
      <Input id="customer-name" label="Nombre completo" autoComplete="name" required minLength={2} maxLength={180} value={fields.customerName} onChange={e => edit("customerName", e.target.value)} onBlur={()=>touch('name')} error={touched.name&&(fields.customerName.trim().length<2||/[\p{Cc}]/u.test(fields.customerName))?'Introduce tu nombre completo.':undefined} />
      <Input id="customer-phone" label="Teléfono con código de país" type="tel" autoComplete="tel" required maxLength={30} hint="Incluye + y el código de país." value={fields.customerPhone} onChange={e => edit("customerPhone", e.target.value)} onBlur={()=>touch('phone')} error={touched.phone&&!/^\+[1-9][0-9]{7,14}$/.test(phone)?'Introduce el teléfono completo con + y código de país.':undefined} />
      <Input id="customer-email" label="Correo electrónico" type="email" autoComplete="email" required maxLength={254} value={fields.customerEmail} onChange={e => edit("customerEmail", e.target.value)} onBlur={()=>touch('email')} error={touched.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.customerEmail.trim())?'Introduce un correo válido.':undefined} />
    </fieldset>
    <fieldset disabled={!ready || busy || lockedFields}><legend>Transferencia</legend>
      <label htmlFor="order-bank">Cuenta a la que transferiste</label><select id="order-bank" required value={fields.bankAccountId} onChange={e => edit("bankAccountId", e.target.value)}><option value="">Selecciona la cuenta publicada</option>{banks?.map(bank => <option key={bank.id} value={bank.id}>{bank.bankName} · {bank.accountDisplay}</option>)}{intent && !banks?.some(bank => bank.id === intent.bankAccountId) && <option value={intent.bankAccountId}>Cuenta del intento original · solo recuperación</option>}</select>
      <Input id="bank-reference" label="Referencia bancaria" required maxLength={180} value={fields.bankReference} onChange={e => edit("bankReference", e.target.value)} onBlur={()=>touch('reference')} error={touched.reference&&(!fields.bankReference.trim()||/[\p{Cc}]/u.test(fields.bankReference))?'Introduce la referencia de la transferencia.':undefined} />
      <Input id="transfer-date" label="Fecha y hora de la transferencia" type="datetime-local" required step={60} hint="Hora de Santo Domingo." error={fields.date && !dateAllowed ? "Revisa la fecha: no puede superar en más de cinco minutos la hora del servidor." : undefined} value={fields.date} onChange={e => edit("date", e.target.value)} />
    </fieldset>
    <fieldset disabled={!ready || busy || lockedFields}><legend>Comprobante obligatorio</legend>
      <label htmlFor="order-receipt">Imagen JPG/PNG o PDF</label><input ref={fileInput} id="order-receipt" type="file" accept="image/jpeg,image/png,application/pdf" required onChange={e => { setFile(e.target.files?.[0] ?? null); setPreview(null); }} aria-describedby="receipt-hint" />
      <p id="receipt-hint">JPG, PNG o PDF, hasta {Math.floor(maxBytes / 1048576)} MiB.</p>
      {file && <><p>{file.name} · {Math.ceil(file.size / 1024)} KiB</p>{!validReceipt(file, maxBytes) && <p role="alert" className="field-error">Selecciona un JPG, PNG o PDF no vacío dentro del límite.</p>}{preview && file.type.startsWith("image/") && <div className="receipt-preview"><Image src={preview} alt="Vista previa local del comprobante seleccionado" width={640} height={480} unoptimized /></div>}{file.type === "application/pdf" && <p>PDF seleccionado.</p>}<Button type="button" className="button-secondary" onClick={() => { setFile(null); setPreview(null); if (fileInput.current) fileInput.current.value = ""; }}>Quitar comprobante</Button></>}
      <details><summary>Ver reglas</summary>{rules.map((rule, index) => <p className="rules-text" key={index}>{rule}</p>)}<p>Versión: {intent?.rulesVersion ?? rulesVersion}</p></details>
      <label className="check-label"><input type="checkbox" required checked={accepted} onChange={e => setAccepted(e.target.checked)} />He leído y acepto las reglas de la rifa y el <Link href="/privacidad" target="_blank">aviso de privacidad</Link>.</label>
    </fieldset>
    {phase && <p role="status">{phase}</p>}
    {error && <Alert title="El envío necesita atención" tone="error"><p>{error}</p>{reference && <p>Referencia de consulta: {reference}</p>}<Link href="/ayuda#incidencias">Solicitar orientación si ya transferiste</Link></Alert>}
    <p>Revisaremos tu transferencia antes de confirmar el pago.</p>
    <Button type="submit" disabled={!canSubmit}>{busy ? "Registrando…" : recover ? "Recuperar el mismo envío" : "Enviar orden"}</Button>

  </form>;
}
