import type { Metadata } from "next";
import { Alert, ButtonLink, EmptyState, SectionContainer } from "@/components/ui";
import { getCatalog } from "@/features/raffles/data";
import { RaffleCatalog } from "@/features/raffles/catalog";
import { RaffleCard } from "@/features/raffles/components";
import { CatalogFailure } from "@/features/raffles/catalog-failure";

export const metadata: Metadata = { title: "Explorar rifas" };
export default async function RafflesPage({ searchParams }: { searchParams: Promise<{ page?: string | string[] }> }) {
  const query = await searchParams;
  const requested = typeof query.page === "string" && /^[1-9]\d{0,5}$/.test(query.page) ? Number(query.page) : 1;
  const { mode, items, pagination, error } = await getCatalog(requested);
  const pages = Math.ceil(pagination.total / pagination.pageSize);
  return <SectionContainer><div className="page-heading"><p className="eyebrow">Tu próxima ilusión</p><h1>Encuentra lo que<br /><em>te mueve.</em></h1><p>Explora los premios, conoce las reglas y descubre cada detalle.</p></div><div className="page-content">
    {mode === "mock" ? <RaffleCatalog raffles={items} /> : error ? <CatalogFailure error={error} /> : <>
      {items.length ? <><p className="result-count">{pagination.total} rifas publicadas · Página {pagination.page} de {pages}</p><div className="raffle-grid">{items.map((raffle, index) => <RaffleCard key={raffle.slug} raffle={raffle} priority={index === 0} />)}</div></> : <EmptyState title={requested > 1 ? "Esta página no tiene rifas" : "Todavía no hay rifas publicadas"}>Vuelve pronto para descubrir nuestros próximos premios.</EmptyState>}
      <nav className="pagination" aria-label="Páginas del catálogo">{requested > 1 && <ButtonLink href={`/rifas?page=${requested - 1}`} className="button-secondary">Página anterior</ButtonLink>}{requested < pages && <ButtonLink href={`/rifas?page=${requested + 1}`} className="button-secondary">Página siguiente</ButtonLink>}</nav>
    </>}
    <div className="catalog-note"><Alert title="Información clara desde el principio">Tú eliges la cantidad de boletos. Los números se asignan en el servidor al recibir la orden con comprobante; el pago se verifica manualmente.</Alert></div>
    <ButtonLink href="/" className="button-secondary catalog-back">Volver al inicio</ButtonLink>
  </div></SectionContainer>;
}
