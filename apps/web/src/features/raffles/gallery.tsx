"use client";

import { PrizeImage as Image } from "./prize-image";
import { useState } from "react";
import type { RaffleImage } from "./types";
import { useHydrated } from "@/lib/use-hydrated";

export function PrizeGallery({ images, title, demo = false }: { images: RaffleImage[]; title: string; demo?: boolean }) {
  const [index, setIndex] = useState(0);
  const hydrated = useHydrated();
  const current = images[index] ?? images[0];
  if (!current) return <div className="gallery-placeholder">Imagen del premio pendiente.</div>;
  return <div className="prize-gallery"><div className="gallery-main"><Image src={current.src} alt={current.alt} fill sizes="(max-width: 767px) calc(100vw - 32px), (max-width: 1023px) calc(100vw - 64px), (max-width: 1263px) calc(61.54vw - 61.54px), 716px" preload className="prize-image" />{demo && <span className="gallery-label">Imagen conceptual · DEMO</span>}</div>{images.length > 1 && <div className="gallery-thumbnails" role="group" aria-label={`Imágenes de ${title}`}>{images.map((image, item) => <button type="button" disabled={!hydrated} key={image.src} aria-label={`Ver imagen ${item + 1} de ${title}`} aria-pressed={item === index} onClick={() => setIndex(item)}><Image src={image.src} alt="" width={100} height={70} /></button>)}</div>}</div>;
}
