import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { PurchaseQuantity } from "@/features/raffles/quantity";
import { AvailabilityMeter } from "@/features/raffles/components";
import { demoRaffles } from "@/fixtures/catalog";
import { availabilityLabel } from "@/features/raffles/types";

test("cantidad valida enteros y límites sin producir una compra", () => {
  render(<PurchaseQuantity min={2} max={4} />);
  expect(screen.getByRole("button", { name: "Reducir cantidad" })).toBeDisabled();
  fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "3.5" } });
  expect(screen.getByRole("spinbutton")).toHaveAttribute("aria-invalid", "true");
  expect(screen.getByRole("alert")).toHaveTextContent("cantidad entera");
  fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "4" } });
  expect(screen.getByRole("button", { name: "Aumentar cantidad" })).toBeDisabled();
  expect(screen.getByRole("status")).toHaveTextContent("No reserva cupo");
});

test("agotamiento de cupo no se representa como 100% vendido", () => {
  const raffle = demoRaffles.find(item => item.slug === "portatil-sin-cupo-demo");
  if (!raffle) throw new Error("Fixture requerida no encontrada");
  render(<AvailabilityMeter raffle={raffle} />);
  expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "70");
  expect(screen.getByRole("progressbar")).toHaveAccessibleName("Progreso de la rifa");
  expect(screen.getByText("70%")).toBeInTheDocument();
  expect(availabilityLabel(raffle)).toBe("Agotada");
});

test("sin objetivo no se inventa progreso y el 100% no cambia la disponibilidad", () => {
  const raffle = { ...demoRaffles[0]!, progressPercent: null };
  const { rerender } = render(<AvailabilityMeter raffle={raffle} />);
  expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  rerender(<AvailabilityMeter raffle={{ ...raffle, progressPercent: 100 }} />);
  expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuemax", "100");
  expect(availabilityLabel(raffle)).toBe("Con cupo");
});

test("fixtures demo conservan los conteos y no confunden pausa con falta de cupo", () => {
  for (const raffle of demoRaffles) expect(raffle.sold + raffle.reserved + raffle.held + raffle.available).toBe(raffle.total);
  expect(availabilityLabel({ status: "PAUSED", available: 600 })).toBe("Ventas pausadas");
  expect(availabilityLabel({ status: "CLOSED", available: 200 })).toBe("Finalizada");
});
