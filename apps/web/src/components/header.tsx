"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { SectionContainer } from "./ui";
import { Icon } from "./ui/icon";
import { useHydrated } from "@/lib/use-hydrated";

export function Header() {
  const path = usePathname();
  const hydrated = useHydrated();
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  return <header className="header"><SectionContainer className="header-inner">
    <Link href="/" className="brand" onClick={close}><Icon name="crown" /><span>AppSorteos<span className="brand-caption">REPÚBLICA DOMINICANA</span></span></Link>
    <nav className="desktop-nav" aria-label="Navegación principal"><Link href="/" aria-current={path === "/" ? "page" : undefined}>Inicio</Link><Link href="/rifas" aria-current={path.startsWith("/rifas") ? "page" : undefined}>Rifas</Link><Link href="/consultar-boletos" aria-current={path === "/consultar-boletos" ? "page" : undefined}>Consultar mis boletos</Link><Link href="/ayuda" aria-current={path === "/ayuda" ? "page" : undefined}>Cómo funciona</Link></nav>
    <div className="header-actions"><Link href="/rifas#buscar" className="icon-button" aria-label="Buscar rifas" onClick={close}><Icon name="search" /></Link><button type="button" className="icon-button menu-button" disabled={!hydrated} aria-label={open ? "Cerrar menú" : "Abrir menú"} aria-expanded={open} aria-controls="mobile-menu" onClick={() => setOpen(!open)}><Icon name={open ? "close" : "menu"} /></button></div>
    {open && <nav className="mobile-menu" id="mobile-menu" aria-label="Menú móvil"><Link href="/" onClick={close}>Inicio</Link><Link href="/rifas" onClick={close}>Explorar rifas</Link><Link href="/consultar-boletos" onClick={close}>Consultar mis boletos</Link><Link href="/ayuda" onClick={close}>Ayuda y cómo funciona</Link></nav>}
  </SectionContainer></header>;
}
