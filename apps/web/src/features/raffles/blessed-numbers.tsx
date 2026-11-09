import Link from "next/link";
import type { components } from "@sorteos/api-client";
import { formatMoney } from "@/lib/format";
export type BlessedNumber = components["schemas"]["BlessedNumberDto"];
export function BlessedNumbers({ numbers = [], total = numbers.length, slug }: { numbers?: BlessedNumber[]; total?: number; slug?: string }) {
  if (!numbers.length) return null;
  const groups = new Map<string, { prize: BlessedNumber; numbers: string[] }>();
  for (const prize of numbers) {
    const key = JSON.stringify([prize.prizeTitle, prize.prizeDescription, prize.prizeKind, prize.amountMinor]);
    const group = groups.get(key) ?? { prize, numbers: [] }; group.numbers.push(prize.number); groups.set(key, group);
  }
  return <section className="blessed-preview" aria-label="Números bendecidos">
    <strong className="blessed-heading">Números bendecidos</strong><p>Si recibes uno de estos números, serás bendecido con:</p>
    <ul className="blessed-prizes">{Array.from(groups, ([key, { prize, numbers: digits }]) => <li key={key}>
      <strong>{prize.prizeTitle}{prize.prizeKind === "MONEY" && prize.amountMinor !== null ? ` · ${formatMoney(prize.amountMinor)}` : ""}</strong>
      <div className="blessed-digits" aria-label={`Números para ${prize.prizeTitle}`}>{digits.map(number => <code key={number}>{number}</code>)}</div>
    </li>)}</ul><p className="blessed-condition">Premio sujeto a la verificación del pago.</p>
    {total > numbers.length && slug && <Link className="text-link" href={`/rifas/${slug}/bendecidos`}>Ver los {total} números bendecidos</Link>}
  </section>;
}
