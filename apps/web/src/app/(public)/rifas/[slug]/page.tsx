import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Alert, Badge, Button, ButtonLink, SectionContainer } from "@/components/ui";
import { Icon } from "@/components/ui/icon";
import { AvailabilityMeter, PricePanel, RaffleRules } from "@/features/raffles/components";
import { getRaffle } from "@/features/raffles/data";
import { BlessedNumbers } from "@/features/raffles/blessed-numbers";
import { PrizeGallery } from "@/features/raffles/gallery";
import { PurchaseQuantity } from "@/features/raffles/quantity";
import { formatDate } from "@/lib/format";
import { availabilityLabel } from "@/features/raffles/types";
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
  const open = raffle.status === "PUBLISHED" && raffle.available > 0;
  return <SectionContainer className="detail-page">
    <div className="detail-breadcrumb"><Link href="/rifas"><Icon name="back" />Todas las rifas</Link>{raffle.demo && <Badge>Vista de demostración</Badge>}</div>
    <div className="detail-grid">
      <div className="detail-primary">
        <PrizeGallery images={raffle.images} title={raffle.title} demo={raffle.demo} />
        <div className="detail-heading"><p className="eyebrow">{raffle.demo ? `${raffle.category} · Colección demo` : "Premio publicado"}</p><h1>{raffle.title}</h1><p className="detail-subtitle">{raffle.subtitle}</p><p>{raffle.description}</p></div>
      </div>
      <aside className="participation-panel" id="participacion" aria-labelledby="participation-title">
        <div className="panel-topline"><Icon name="ticket" /><span>Tu próxima ilusión</span>{raffle.demo && <Badge>DEMO</Badge>}</div>
        <h2 id="participation-title">Todo empieza aquí.</h2>
        <PricePanel raffle={raffle} />
        <AvailabilityMeter raffle={raffle} />{raffle.asOf && <p className="field-hint">Cupo consultado: {formatDate(raffle.asOf)}. Puede cambiar; esta consulta no reserva boletos.</p>}
        {!raffle.demo && <RefreshAvailability />}
        <div className="panel-divider" />
        <PurchaseQuantity min={raffle.minPurchase} max={raffle.maxPurchase} disabled={!open} />
        <Alert title={open ? "Explora con tranquilidad" : availabilityLabel(raffle)}>{open ? "Esta vista previa no reserva cupo ni genera una orden. El importe final se confirmará en el servidor cuando se habilite la compra." : raffle.status === "PUBLISHED" ? "El cupo está comprometido. Los boletos reservados todavía no equivalen a ventas confirmadas." : "La participación está deshabilitada en este estado."}</Alert>
        {raffle.demo ? <Button disabled className="purchase-disabled">{open ? "Compra no habilitada en demo" : availabilityLabel(raffle)}</Button> : <ButtonLink href={`/rifas/${raffle.slug}/participar`}>{open ? "Participar" : "Revisar mi cupo temporal"}</ButtonLink>}
        <p className="panel-footnote"><Icon name="shield" />Sin transferencias ni datos personales</p>
        <a href="#reglas" className="rules-link">{raffle.demo ? "Leer reglas de la demostración" : "Leer reglas de participación"}</a>
      </aside>
      <div className="detail-more">
        {raffle.demo && <div className="detail-highlights">{raffle.highlights.map((highlight, index) => <div key={highlight}><Icon name={index === 0 ? "image" : index === 1 ? "ticket" : "shield"} /><span>{highlight}</span></div>)}</div>}
        {raffle.demo ? <section className="detail-section" aria-labelledby="description-title"><h2 id="description-title">El inicio de otra historia.</h2><p>Esta presentación te permite conocer cómo se mostrará un premio: imágenes claras, información del cupo y reglas accesibles antes de decidir.</p><p>La imagen es conceptual. No representa un premio anunciado, una marca patrocinadora ni especificaciones confirmadas.</p></section> : <section className="detail-section"><h2>Información de participación</h2><p>Premio: {raffle.prize}</p><p>Formato de números: {String(0).padStart(raffle.numberWidth ?? 1, "0")}–{String(raffle.total - 1).padStart(raffle.numberWidth ?? 1, "0")}. La asignación se realiza en el servidor; no eliges los números.</p>{raffle.startsAt && <p>Inicio de participación: {formatDate(raffle.startsAt)}</p>}{raffle.endsAt && <p>Cierre de participación: {formatDate(raffle.endsAt)}</p>}</section>}
        <BlessedNumbers numbers={raffle.blessedNumbers} total={raffle.blessedNumberCount} slug={raffle.slug} /><RaffleRules raffle={raffle} />
        <section className="detail-section"><h2>Conoce el siguiente paso.</h2><p>En una compra habilitada, primero confirmarás cupo temporal. Después enviarás tus datos y el comprobante juntos. Solo entonces recibirás los números asignados.</p><Link href="/ayuda" className="text-link">Cómo funciona <Icon name="arrow" /></Link></section>
      </div>
    </div>
    <div className="detail-mobile-action"><a href="#participacion" className="button button-full">{open ? "Explorar participación" : "Consultar estado"}<Icon name="arrow" /></a></div>
  </SectionContainer>;
}
