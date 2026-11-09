"use client";

import { useId, useState } from "react";
import { EmptyState, Input } from "@/components/ui";
import { RaffleCard } from "./components";
import type { RaffleView } from "./types";
import { useHydrated } from "@/lib/use-hydrated";

const filters = ["Todas", "Con cupo", "Pausadas", "Sin cupo", "Cerradas"] as const;
export function RaffleCatalog({ raffles }: { raffles: RaffleView[] }) {
  const id = useId();
  const hydrated = useHydrated();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<typeof filters[number]>("Todas");
  const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es");
  const items = raffles.filter(raffle => {
    const matches = normalize(`${raffle.title} ${raffle.category ?? ""}`).includes(normalize(query.trim()));
    const state = filter === "Todas" || (filter === "Con cupo" && raffle.status === "PUBLISHED" && raffle.available > 0) || (filter === "Pausadas" && raffle.status === "PAUSED") || (filter === "Sin cupo" && raffle.status === "PUBLISHED" && raffle.available === 0) || (filter === "Cerradas" && raffle.status === "CLOSED");
    return matches && state;
  });
  return <><div className="catalog-toolbar" id="buscar"><div className="catalog-search"><Input id={id} label="Buscar rifas" type="search" disabled={!hydrated} placeholder="Un premio, una idea…" value={query} onChange={event => setQuery(event.target.value)} /></div><div className="filter-list" role="group" aria-label="Filtrar rifas por estado">{filters.map(item => <button key={item} type="button" className="filter-chip" disabled={!hydrated} aria-pressed={filter === item} onClick={() => setFilter(item)}>{item}</button>)}</div></div><p className="result-count" role="status">{items.length} {items.length === 1 ? "rifa de demostración" : "rifas de demostración"}</p>{items.length ? <div className="raffle-grid">{items.map((raffle, index) => <RaffleCard priority={index === 0} key={raffle.slug} raffle={raffle} />)}</div> : <EmptyState title="No encontramos coincidencias" action={<button className="button button-secondary" onClick={() => { setQuery(""); setFilter("Todas"); }}>Limpiar búsqueda y filtros</button>}>Prueba con otro premio o cambia los filtros para explorar las rifas demo.</EmptyState>}</>;
}
