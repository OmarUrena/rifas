import { expect, test } from "@playwright/test";

test("pre-reserva demo permanece sin escrituras ni cupo ficticio", async ({ page }) => {
  const writes: string[] = [];
  page.on("request", request => { if (["POST", "DELETE"].includes(request.method()) && /\/api\/v1\//.test(request.url())) writes.push(request.url()); });
  await page.goto("/rifas/suv-premium-demo/participar");
  await expect(page.getByRole("heading", { name: "Comprar boletos" })).toBeVisible();
  await expect(page.getByText("Sin pre-reservas en demo", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Confirmar cupo" })).toHaveCount(0);
  await expect(page.getByRole("timer")).toHaveCount(0);
  expect(writes).toEqual([]);
});
