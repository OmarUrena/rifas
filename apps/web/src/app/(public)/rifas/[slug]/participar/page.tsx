import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Alert, SectionContainer } from "@/components/ui";
import { getRaffle } from "@/features/raffles/data";
import { salesOpen } from "@/features/raffles/types";
import { CheckoutForm } from "@/features/checkout/form";
import { CatalogFailure } from "@/features/raffles/catalog-failure";
import { ApiError } from "@/lib/api/errors";
import { readEnvironment } from "@/lib/config";

export const metadata: Metadata = { title: "Comprar boletos", robots: { index: false, follow: false } };
export default async function ParticipatePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let raffle;
  try { raffle = await getRaffle(slug); }
  catch (error) {
    const failure = error instanceof ApiError ? error : new ApiError("NETWORK_ERROR", 0);
    return <SectionContainer className="section"><h1>No pudimos consultar la rifa</h1><CatalogFailure error={{ message: failure.message, requestId: failure.requestId }} /></SectionContainer>;
  }
  if (!raffle) notFound();
  const { apiBaseUrl, receiptMaxBytes } = readEnvironment(process.env);
  return <SectionContainer className="checkout-page"><div className="detail-breadcrumb"><Link href={`/rifas/${slug}`}>← Volver al premio</Link></div><div className="page-heading"><p className="eyebrow">Comprar</p><h1>Comprar boletos</h1><p>Elige la cantidad para continuar.</p></div>{raffle.demo || !raffle.id || !apiBaseUrl ? <Alert title="Sin pre-reservas en demo">Esta demostración no crea cupos ni órdenes. No realices transferencias.</Alert> : <CheckoutForm key={raffle.id} baseUrl={apiBaseUrl} recoveryOnly={!salesOpen(raffle)} maxBytes={receiptMaxBytes} raffle={{ id: raffle.id, slug, title: raffle.title, min: raffle.minPurchase, max: Math.min(1000, raffle.maxPurchase), available: raffle.available, unitPriceMinor: raffle.ticketPriceMinor, rulesVersion: raffle.rulesVersion, rules: raffle.rules }} />}</SectionContainer>;
}
