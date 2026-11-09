import type { components } from "@sorteos/api-client";
import { formatMoney } from "@/lib/format";
export function BlessedAwards({ awards = [] }: { awards?: components["schemas"]["BlessedAwardDto"][] }) {
  if (!awards.length) return null;
  const active = awards.some(award => award.status !== "VOIDED");
  return <section className="blessed-award-message" role="status" aria-live="polite" aria-label="Premios de tus números bendecidos">
    <h2>{active ? awards.filter(a => a.status !== "VOIDED").length > 1 ? "¡Te tocaron números bendecidos!" : "¡Te tocó un número bendecido!" : "Premios históricos de esta orden"}</h2>
    <ul>{awards.map(award => <li key={award.id}><strong>{award.number}</strong> · {award.prizeTitle}{award.prizeKind === "MONEY" && award.amountMinor !== null ? ` · ${formatMoney(award.amountMinor)}` : ""}
      <p>{award.status === "CONFIRMED" ? "Premio confirmado. La entrega se coordina con el organizador." : award.status === "VOIDED" ? "Adjudicación anulada al cancelar la orden." : "Premio pendiente de verificar tu pago."}</p>
    </li>)}</ul>
  </section>;
}
