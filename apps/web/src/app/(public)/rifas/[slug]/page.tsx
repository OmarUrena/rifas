import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Alert, Badge, Button, ButtonLink, SectionContainer } from "@/components/ui";
import { Icon } from "@/components/ui/icon";
import { AvailabilityMeter, PricePanel, RaffleRules } from "@/features/raffles/components";
import { getRaffle } from "@/features/raffles/data";
import { BlessedNumbers } from "@/features/raffles/blessed-numbers";
import { PrizeGallery } from "@/features/raffles/gallery";
import { formatDate } from "@/lib/format";
import { availabilityLabel, salesOpen } from "@/features/raffles/types";
import { ApiError } from "@/lib/api/errors";
import { CatalogFailure, RefreshAvailability } from "@/features/raffles/catalog-failure";

type Props = { params: Promise<{ slug: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const raffle = await getRaffle(slug).catch(() => null);
  return { title: raffle ? `${raffle.title}${raffle.demo ? " · DEMO" : ""}` : "Rifa no disponible", robots: { index: !!raffle && !raffle.demo, follow: !!raffle && !raffle.demo } };
}

export default async function RaffleDetailPage({ params }: Props) {
  const { slug } = await params;
  let raffle;
  try { raffle = await getRaffle(slug); }
  catch (error) {
    const failure = error instanceof ApiError ? error : new ApiError("NETWORK_ERROR", 0);
    return <SectionContainer className="section"><h1>No pudimos consultar esta rifa</h1><CatalogFailure error={{ message: failure.message, requestId: failure.requestId }} /></SectionContainer>;
  }
  if (!raffle) notFound();
  const open = salesOpen(raffle);
  return <SectionContainer className="detail-page">
    <div className="detail-breadcrumb"><Link href="/rifas"><Icon name="back" />Todas las rifas</Link>{raffle.demo && <Badge>Vista de demostración</Badge>}</div>
    <div className="detail-grid">
      <div className="detail-primary">
        <PrizeGallery images={raffle.images} title={raffle.title} demo={raffle.demo} />
        <div className="detail-heading"><p className="eyebrow">{raffle.demo ? `${raffle.category} · Colección demo` : "Premio publicado"}</p><h1>{raffle.title}</h1><p className="detail-subtitle">{raffle.subtitle}</p></div>
      </div>
      <aside className="participation-panel" id="participacion" aria-labelledby="participation-title">
        <div className="panel-topline"><Icon name="ticket" /><span>Participa</span>{raffle.demo && <Badge>DEMO</Badge>}</div>
        <h2 id="participation-title">Comprar boletos</h2>
        <PricePanel raffle={raffle} />
        <AvailabilityMeter raffle={raffle} compact />{raffle.asOf && <p className="field-hint">Actualizado: {formatDate(raffle.asOf)}.</p>}
        {!raffle.demo && <RefreshAvailability />}
        <div className="panel-divider" />
        <p>De {raffle.minPurchase} a {raffle.maxPurchase} boletos por orden.</p>
        {!open && <Alert title={availabilityLabel(raffle)}>Esta rifa no admite nuevas compras en este momento.</Alert>}
        {raffle.demo ? <Button disabled>{open?"Vista demo":availabilityLabel(raffle)}</Button> : open ? <ButtonLink href={`/rifas/${raffle.slug}/participar`}>Comprar</ButtonLink> : <><Button disabled>{availabilityLabel(raffle)}</Button><Link href={`/rifas/${raffle.slug}/participar`} className="text-link">Revisar un cupo anterior</Link></>}
        <Link href="/consultar-boletos" className="text-link">Consultar mis boletos</Link>
        <a href="#reglas" className="rules-link">{raffle.demo ? "Leer reglas de la demostración" : "Leer reglas de participación"}</a>
      </aside>
      <div className="detail-more">
        {raffle.demo && <div className="detail-highlights">{raffle.highlights.map((highlight, index) => <div key={highlight}><Icon name={index === 0 ? "image" : index === 1 ? "ticket" : "shield"} /><span>{highlight}</span></div>)}</div>}
        {raffle.demo ? <section className="detail-section" aria-labelledby="description-title"><h2 id="description-title">El inicio de otra historia.</h2><p>Esta presentación te permite conocer cómo se mostrará un premio: imágenes claras, información del cupo y reglas accesibles antes de decidir.</p><p>La imagen es conceptual. No representa un premio anunciado, una marca patrocinadora ni especificaciones confirmadas.</p></section> : <section className="detail-section"><details><summary>Información de la rifa</summary><p>{raffle.description}</p><p>Premio: {raffle.prize}</p><p>Formato de números: {String(0).padStart(raffle.numberWidth ?? 1, "0")}–{String(raffle.total - 1).padStart(raffle.numberWidth ?? 1, "0")}. La asignación se realiza en el servidor; no eliges los números.</p>{raffle.startsAt && <p>Inicio de participación: {formatDate(raffle.startsAt)}</p>}{raffle.endsAt && <p>Cierre de participación: {formatDate(raffle.endsAt)}</p>}</details></section>}
        <BlessedNumbers numbers={raffle.blessedNumbers} total={raffle.blessedNumberCount} slug={raffle.slug} /><RaffleRules raffle={raffle} />
        <Link href="/ayuda" className="text-link">Ayuda para comprar</Link>
      </div>
    </div>
    <div className="detail-mobile-action"><a href="#participacion" className="button button-full">{open && !raffle.demo ? "Comprar" : "Consultar estado"}<Icon name="arrow" /></a></div>
  </SectionContainer>;
}
