// Presentation model for F1. This does not replace backend-generated DTOs.
import type { BlessedNumber } from "./blessed-numbers";
export type RaffleStatus = "DRAFT" | "PUBLISHED" | "PAUSED" | "CLOSED" | "DRAWN";
export type RaffleImage = { src: string; alt: string };
export type RaffleView = {
  id?: string;
  slug: string;
  title: string;
  subtitle: string;
  category?: "Vehículos" | "Tecnología";
  description: string;
  images: RaffleImage[];
  status: RaffleStatus;
  canPurchase?: boolean;
  featured?: boolean;
  ticketPriceMinor: number;
  minPurchase: number;
  maxPurchase: number;
  total: number;
  progressPercent?: number | null;
  blessedNumbers?: BlessedNumber[];
  blessedNumberCount?: number;
  sold: number;
  reserved: number;
  held: number;
  available: number;
  highlights: string[];
  rules: string[];
  demo?: boolean;
  asOf?: string;
  numberWidth?: number;
  startsAt?: string | null;
  endsAt?: string | null;
  prize?: string;
  rulesVersion?: string;
};

export type RaffleSummary = Pick<RaffleView, "slug" | "title" | "images" | "status" | "canPurchase" | "ticketPriceMinor" | "total" | "sold" | "available" | "demo" | "featured" | "progressPercent" | "blessedNumbers" | "blessedNumberCount"> & Partial<Pick<RaffleView, "category" | "subtitle">>;

export function salesOpen(raffle:Pick<RaffleView,'status'|'available'|'canPurchase'> & Partial<Pick<RaffleView,'minPurchase'|'startsAt'|'endsAt'>>,now=Date.now()) {
  return raffle.status==='PUBLISHED'&&raffle.available>=(raffle.minPurchase??1)&&raffle.canPurchase!==false
    &&(!raffle.startsAt||Date.parse(raffle.startsAt)<=now)&&(!raffle.endsAt||Date.parse(raffle.endsAt)>now);
}

export function availabilityLabel(raffle: Pick<RaffleView, "status" | "available"> & Partial<Pick<RaffleView,'canPurchase'|'minPurchase'|'startsAt'|'endsAt'>>) {
  if (raffle.status === "PAUSED") return "Ventas pausadas";
  if (raffle.status === "CLOSED") return "Finalizada";
  if (raffle.status === "DRAWN") return "Finalizada";
  if (raffle.status === "DRAFT") return "En preparación";
  if (raffle.startsAt&&Date.parse(raffle.startsAt)>Date.now())return 'Próximamente';
  if (raffle.endsAt&&Date.parse(raffle.endsAt)<=Date.now())return 'Finalizada';
  if (raffle.available>0&&!salesOpen(raffle))return 'Ventas no disponibles';
  return raffle.available > 0 ? "Con cupo" : "Agotada";
}
