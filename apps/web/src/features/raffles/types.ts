// Presentation model for F1. This does not replace backend-generated DTOs.
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
  featured?: boolean;
  ticketPriceMinor: number;
  minPurchase: number;
  maxPurchase: number;
  total: number;
  progressPercent?: number | null;
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

export type RaffleSummary = Pick<RaffleView, "slug" | "title" | "images" | "status" | "ticketPriceMinor" | "total" | "sold" | "available" | "demo" | "featured" | "progressPercent"> & Partial<Pick<RaffleView, "category" | "subtitle">>;

export function availabilityLabel(raffle: Pick<RaffleView, "status" | "available">) {
  if (raffle.status === "PAUSED") return "Pausada";
  if (raffle.status === "CLOSED") return "Cerrada";
  if (raffle.status === "DRAWN") return "Finalizada";
  if (raffle.status === "DRAFT") return "En preparación";
  return raffle.available > 0 ? "Con cupo" : "Sin cupo disponible";
}
