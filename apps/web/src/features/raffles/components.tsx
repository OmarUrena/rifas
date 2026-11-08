import { PrizeImage as Image } from "./prize-image";
import Link from "next/link";
import { Badge, ButtonLink } from "@/components/ui";
import { Icon } from "@/components/ui/icon";
import { formatMoney } from "@/lib/format";
import { availabilityLabel, type RaffleView, type RaffleSummary } from "./types";

export function StatusTag({ raffle }: { raffle: Pick<RaffleView, "status" | "available"> }) {
  const open = raffle.status === "PUBLISHED" && raffle.available > 0;
  return <span className={`status-tag ${open ? "status-open" : "status-muted"}`}><span aria-hidden="true" />{availabilityLabel(raffle)}</span>;
}

export function AvailabilityMeter({ raffle, compact = false }: { raffle: RaffleSummary & Partial<Pick<RaffleView, "reserved" | "held">>; compact?: boolean }) {
  const percent = raffle.progressPercent;
  const number = (value: number) => new Intl.NumberFormat("es-DO").format(value);
  return <div className="availability">
    {percent != null && <><div className="availability-track" role="progressbar" aria-label="Progreso de la rifa" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-valuetext={`${percent}%${raffle.demo ? "; datos demo" : ""}`}><span style={{ width: `${percent}%` }} /></div>
    <div className="availability-caption"><span>Progreso de la rifa</span><strong>{percent}%</strong></div></>}
    {!compact && raffle.reserved !== undefined && raffle.held !== undefined && <dl className="inventory-grid"><div><dt>Disponibles</dt><dd>{number(raffle.available)}</dd></div><div><dt>Reservados</dt><dd>{number(raffle.reserved)}</dd></div><div><dt>Cupo temporal</dt><dd>{number(raffle.held)}</dd></div></dl>}
  </div>;
}

export function RaffleCard({ raffle, priority = false }: { raffle: RaffleSummary; priority?: boolean }) {
  const image = raffle.images[0];
  return <article className="raffle-card">
    <Link href={`/rifas/${raffle.slug}`} className="raffle-image-link" aria-label={`Ver ${raffle.title}`}>
      {!image && <span className="image-fallback">Imagen del premio pendiente</span>}{image && <Image src={image.src} alt={image.alt} fill sizes="(max-width: 767px) calc(100vw - 32px), (max-width: 1023px) 46vw, 380px" loading={priority ? "eager" : "lazy"} fetchPriority={priority ? "high" : undefined} className="prize-image" />}
      <div className="image-badges">{(raffle.category || raffle.featured) && <Badge tone={raffle.featured ? "accent" : "neutral"}>{raffle.featured ? "Destacada" : raffle.category}</Badge>}{raffle.demo && <span className="image-demo">DEMO</span>}</div>
    </Link>
    <div className="raffle-card-content"><div className="raffle-card-title"><h3><Link href={`/rifas/${raffle.slug}`}>{raffle.title}</Link></h3><p>{raffle.subtitle}</p></div>
      <div className="raffle-meta"><div><Icon name="tag" /><span><strong>{formatMoney(raffle.ticketPriceMinor)}</strong><small>por boleto{raffle.demo ? " · demo" : ""}</small></span></div><div><Icon name="users" /><span><strong>{new Intl.NumberFormat("es-DO").format(raffle.total)}</strong><small>boletos totales</small></span></div></div>
      <StatusTag raffle={raffle} /><AvailabilityMeter raffle={raffle} compact />
      <ButtonLink href={`/rifas/${raffle.slug}`}>Ver detalles <Icon name="arrow" /></ButtonLink>
    </div>
  </article>;
}

export function PricePanel({ raffle }: { raffle: RaffleView }) {
  return <div className="price-panel"><div><span className="overline">Precio por boleto{raffle.demo ? " · demo" : ""}</span><strong className="price">{formatMoney(raffle.ticketPriceMinor)}</strong></div><StatusTag raffle={raffle} /></div>;
}

export function RaffleRules({ raffle }: { raffle: RaffleView }) {
  return <section className="detail-section" id="reglas" aria-labelledby="rules-title"><p className="eyebrow">Antes de participar</p><h2 id="rules-title">Todo empieza con las reglas.</h2><ol className="rules-list">{raffle.rules.map(rule => <li key={rule}>{rule}</li>)}</ol></section>;
}
