"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "./ui/icon";

const destinations: { href: string; label: string; icon: IconName }[] = [
  { href: "/", label: "Inicio", icon: "home" },
  { href: "/rifas", label: "Rifas", icon: "ticket" },
  { href: "/consultar-boletos", label: "Mis boletos", icon: "search" },
  { href: "/ayuda", label: "Ayuda", icon: "help" },
];
export function BottomNavigation() {
  const path = usePathname();
  if (path.startsWith("/admin") || path.startsWith("/rifas/")) return null;
  return <nav className="bottom-nav" aria-label="Navegación móvil">{destinations.map(item => <Link href={item.href} key={item.href} aria-current={path === item.href ? "page" : undefined}><Icon name={item.icon} /><span>{item.label}</span></Link>)}</nav>;
}
