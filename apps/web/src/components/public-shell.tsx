import { Header } from "./header";
import { Footer } from "./footer";
import { BottomNavigation } from "./bottom-navigation";
import { SectionContainer } from "./ui";
import { readEnvironment } from "@/lib/config";

export function PublicShell({ children }: { children: React.ReactNode }) {
  const { mode } = readEnvironment(process.env);
  return <><a href="#contenido" className="skip-link" tabIndex={0}>Saltar al contenido</a><Header />{mode === "mock" && <div className="environment-note"><SectionContainer><strong>DEMO · Sin transacciones reales</strong><span>Imágenes y cifras ilustrativas. No se aceptan compras.</span></SectionContainer></div>}<main id="contenido" tabIndex={-1}>{children}</main><Footer /><BottomNavigation /></>;
}
