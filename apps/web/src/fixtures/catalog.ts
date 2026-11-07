import type { RaffleView } from "@/features/raffles/types";

const rules = [
  "Esta es una rifa de demostración: no hay un premio ofrecido ni se aceptan compras o transferencias.",
  "En el flujo real elegirás la cantidad. El servidor asignará los números aleatoriamente al recibir la orden y su comprobante.",
  "Un comprobante recibido no equivale a un pago confirmado. La transferencia se revisa manualmente.",
  "Las fechas, condiciones definitivas y requisitos de participación deberán publicarse antes de habilitar una rifa real.",
];
const suv: RaffleView = {
  demo: true,
  slug: "suv-premium-demo", title: "SUV premium", subtitle: "Una nueva perspectiva",
  category: "Vehículos", featured: true, status: "PUBLISHED",
  description: "Presencia que inspira. Espacio para nuevos caminos. Explora cómo se verá una rifa de vehículo, conoce su información y descubre cada paso antes de participar.",
  images: [
    { src: "/images/demo/suv-stitch.webp", alt: "Ilustración demo de un SUV blanco frente a una villa iluminada de noche" },
    { src: "/images/demo/suv-rear.png", alt: "Ilustración demo del SUV blanco visto desde atrás en la misma villa" },
  ],
  ticketPriceMinor: 50000, minPurchase: 1, maxPurchase: 100,
  total: 10000, sold: 7428, reserved: 420, held: 152, available: 2000,
  highlights: ["Imagen conceptual", "Asignación aleatoria", "Revisión manual del pago"], rules,
};
const laptop: RaffleView = {
  demo: true,
  slug: "portatil-premium-demo", title: "Portátil de alto rendimiento", subtitle: "Ideas sin límites",
  category: "Tecnología", status: "PUBLISHED",
  description: "Un espacio para tus próximas ideas. Descubre la presentación de un premio tecnológico en esta demostración. Las especificaciones y condiciones de un premio real se publicarán junto a su rifa.",
  images: [{ src: "/images/demo/laptop-night.png", alt: "Ilustración demo de un portátil de grafito abierto sobre una mesa con iluminación cálida" }],
  ticketPriceMinor: 25000, minPurchase: 1, maxPurchase: 50,
  total: 2000, sold: 520, reserved: 100, held: 80, available: 1300,
  highlights: ["Imagen conceptual", "Cantidad a tu elección", "Reglas antes de participar"], rules,
};

export const demoRaffles: RaffleView[] = [
  suv, laptop,
  { ...suv, slug: "suv-pausada-demo", title: "SUV · edición especial", subtitle: "Una pausa en el camino", featured: false, status: "PAUSED", total: 1000, sold: 300, reserved: 60, held: 40, available: 600 },
  { ...laptop, slug: "portatil-sin-cupo-demo", title: "Portátil · edición limitada", subtitle: "Cupo comprometido", total: 1000, sold: 700, reserved: 300, held: 0, available: 0 },
  { ...suv, slug: "suv-cerrada-demo", title: "SUV · colección anterior", subtitle: "Participación cerrada", featured: false, status: "CLOSED", total: 1000, sold: 800, reserved: 0, held: 0, available: 200 },
];
