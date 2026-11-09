import Link from "next/link";
import { notFound } from "next/navigation";
import { Alert, ButtonLink, SectionContainer } from "@/components/ui";
import { getRaffle } from "@/features/raffles/data";
import { catalogApi } from "@/features/raffles/api";
import { BlessedNumbers } from "@/features/raffles/blessed-numbers";
import { readEnvironment } from "@/lib/config";
import type { components } from "@sorteos/api-client";
export default async function BlessedNumbersPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ page?: string }> }) {
  const { slug } = await params, query = await searchParams;
  const page = query.page === undefined ? 1 : /^\d+$/.test(query.page) ? Number(query.page) : 0;
  if (!Number.isSafeInteger(page) || page < 1 || page > 1000000) notFound();
  let raffle;
  try { raffle = await getRaffle(slug); } catch { return <SectionContainer className="section"><h1>Números bendecidos</h1><Alert title="No pudimos consultar los premios">Vuelve a intentarlo en unos momentos.</Alert></SectionContainer>; }
  if (!raffle) notFound();
  const { mode, apiBaseUrl } = readEnvironment(process.env);
  let data: components["schemas"]["BlessedNumbersPageDto"];
  try {
    if (mode === "mock") { const items = raffle.blessedNumbers ?? []; data = { items: items.slice((page - 1) * 100, page * 100), pagination: { page, pageSize: 100, total: items.length } }; }
    else if (apiBaseUrl) data = await catalogApi(apiBaseUrl).blessedNumbers(slug, page);
    else throw new Error("API unavailable");
  } catch { return <SectionContainer className="section"><h1>Números bendecidos</h1><Alert title="No pudimos consultar los premios">Vuelve a intentarlo en unos momentos.</Alert><Link href={`/rifas/${slug}`}>Volver a la rifa</Link></SectionContainer>; }
  const pages = Math.max(1, Math.ceil(data.pagination.total / data.pagination.pageSize));
  return <SectionContainer className="section"><p className="eyebrow">{raffle.demo ? "Demostración" : raffle.title}</p><h1>Números bendecidos</h1>
    {data.items.length ? <BlessedNumbers numbers={data.items} /> : <p>Esta página no contiene números bendecidos.</p>}
    <nav aria-label="Páginas de números bendecidos" className="admin-toolbar">
      {page > 1 && <ButtonLink className="button-secondary" href={`?page=${page - 1}`}>Página anterior</ButtonLink>}
      <span>Página {page} de {pages}</span>{page < pages && <ButtonLink className="button-secondary" href={`?page=${page + 1}`}>Página siguiente</ButtonLink>}
    </nav><Link className="text-link" href={`/rifas/${slug}`}>Volver a la rifa</Link>
  </SectionContainer>;
}
