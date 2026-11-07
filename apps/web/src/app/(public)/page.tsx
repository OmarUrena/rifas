import Link from "next/link";
import { PrizeImage as Image } from "@/features/raffles/prize-image";
import { CatalogFailure } from "@/features/raffles/catalog-failure";
import { Badge, ButtonLink, EmptyState, SectionContainer } from "@/components/ui";
import { Icon } from "@/components/ui/icon";
import { getCatalog } from "@/features/raffles/data";
import { RaffleCard } from "@/features/raffles/components";

export default async function HomePage() {
  const { items, mode, error } = await getCatalog();
  const featured = items.find(item => item.featured) ?? items[0];
  const image = featured?.images[0];
  return <><SectionContainer>
    <div className="home-intro"><div><p className="eyebrow">App Sorteos · República Dominicana</p><h1 id="hero-title">Grandes premios.<br /><em>Nuevas historias.</em></h1></div><div className="home-intro-description"><p>Tu próxima gran ilusión puede empezar aquí. Descubre cada premio y conoce sus reglas antes de participar.</p><Link href="/ayuda" className="text-link">Cómo funciona <Icon name="arrow" /></Link></div></div>
    <section className={`hero ${image ? "hero-photographic" : "hero-offline"}`} aria-labelledby="hero-title">
      {image && <Image src={image.src} alt="" fill preload sizes="(max-width: 767px) 100vw, 1200px" className="hero-photo" />}
      <div className="hero-shade" />
      <div className="hero-copy"><p className="eyebrow"><Icon name="spark" />{featured ? "El premio destacado" : "Imagina lo que viene"}</p><h2>{featured?.title ?? "Una nueva ilusión está por llegar."}</h2><p>{featured?.subtitle || "Conoce los detalles de nuestras próximas rifas."}</p><ButtonLink href={featured ? `/rifas/${featured.slug}` : "/rifas"}>{featured ? "Descubrir el premio" : "Explorar rifas"}<Icon name="arrow" /></ButtonLink><span className="hero-caption">{image ? (mode === "mock" ? "Imagen conceptual de demostración" : "Conoce el premio y sus reglas") : "Estamos preparando nuestras próximas rifas"}</span></div>
    </section>
    <div className="trust-strip"><span><Icon name="ticket" />Tú eliges la cantidad</span><span><Icon name="spark" />Números aleatorios</span><span><Icon name="shield" />Revisión manual del pago</span></div>
    <section className="section" aria-labelledby="raffles-title"><div className="section-header"><div><p className="eyebrow">Una ilusión a tu alcance</p><h2 id="raffles-title">Explora nuestras rifas<span className="accent">.</span></h2></div><Link href="/rifas" className="text-link">Ver todas <Icon name="arrow" /></Link></div>
      {error ? <CatalogFailure error={error} /> : items.length ? <><p className="section-intro">{mode === "mock" ? "Una muestra de la experiencia. Premios y cifras de demostración." : "Premios publicados por nuestro organizador."}</p><div className="raffle-grid home-raffles">{items.slice(0, 2).map(raffle => <RaffleCard key={raffle.slug} raffle={raffle} />)}<aside className="discovery-card"><Icon name="crown" /><Badge>Un solo organizador</Badge><h3>La ilusión también<br />está en los detalles.</h3><p>Conoce el premio, revisa las reglas y descubre cómo funciona cada paso.</p><Link href="/ayuda" className="text-link">Así funciona <Icon name="arrow" /></Link></aside></div></> : <EmptyState title="Pronto habrá novedades">Todavía no hay rifas publicadas. Vuelve pronto para descubrir novedades.</EmptyState>}
    </section>
  </SectionContainer><section id="como-funciona" className="section soft-section" aria-labelledby="how-title"><SectionContainer><div className="section-header"><div><p className="eyebrow">Información en cada paso</p><h2 id="how-title">Así será participar.</h2></div><Link href="/ayuda" className="text-link">Conocer el proceso <Icon name="arrow" /></Link></div><div className="steps"><article><span className="step-number">01</span><h3>Elige tu próxima ilusión</h3><p>Descubre el premio y sus reglas. Tú eliges la cantidad de boletos; el servidor asigna los números.</p></article><article><span className="step-number">02</span><h3>Envía todo junto</h3><p>Con cupo temporal confirmado, envía tus datos y el comprobante de transferencia en un solo formulario.</p></article><article><span className="step-number">03</span><h3>Espera la verificación</h3><p>Al recibir tu orden, se muestran tus números reservados. El pago se confirma después de una revisión manual.</p></article></div></SectionContainer></section></>;
}
