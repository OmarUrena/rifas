import { expect, test } from "@playwright/test";

test("búsqueda espera JavaScript y conserva la primera entrada del usuario", async ({ page }) => {
  let release = () => {};
  const scriptsReady = new Promise<void>(resolve => { release = resolve; });
  await page.route(url => url.pathname.startsWith("/_next/static/") && url.pathname.endsWith(".js"), async route => {
    await scriptsReady;
    await route.continue();
  });
  try {
    await page.goto("/rifas", { waitUntil: "commit" });
    const search = page.getByRole("searchbox", { name: "Buscar rifas" });
    await expect(search).toBeDisabled();
    release();
    await page.waitForLoadState("load");
    await expect(search).toBeEnabled({ timeout: 30000 });
    await search.fill("portatil");
    await expect(page.getByRole("article")).toHaveCount(2);
  } finally { release(); }
});

test("búsqueda sin tildes, filtros y recuperación del catálogo vacío", async ({ page }) => {
  await page.goto("/rifas");
  await page.getByRole("searchbox", { name: "Buscar rifas" }).fill("portatil");
  await expect(page.getByRole("article")).toHaveCount(2);
  await page.getByRole("button", { name: "Sin cupo", exact: true }).click();
  await expect(page.getByRole("article")).toHaveCount(1);
  await expect(page.getByRole("article")).toContainText("Sin cupo disponible");
  await page.getByRole("searchbox").fill("sin coincidencias");
  await expect(page.getByRole("heading", { name: "No encontramos coincidencias" })).toBeVisible();
  await page.getByRole("button", { name: "Limpiar búsqueda y filtros" }).click();
  await expect(page.getByRole("article")).toHaveCount(5);
});

test("detalle explorable, cantidad válida y ninguna compra simulada", async ({ page }) => {
  const writes: string[] = [];
  page.on("request", request => { if (request.method() === "POST") writes.push(request.url()); });
  await page.goto("/rifas/suv-premium-demo");
  await expect(page.getByRole("heading", { name: "SUV premium", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Aumentar cantidad" }).click();
  await expect(page.getByRole("spinbutton", { name: "Cantidad de boletos" })).toHaveValue("2");
  await page.getByRole("spinbutton").fill("101");
  await expect(page.getByRole("spinbutton")).toHaveAccessibleDescription(/Introduce una cantidad entera/);
  await page.getByRole("spinbutton").fill("10");
  await expect(page.getByRole("button", { name: "Compra no habilitada en demo" })).toBeDisabled();
  await expect(page.getByText("Vista previa: 10 boletos. No reserva cupo.")).toBeVisible();
  await page.getByRole("link", { name: "Leer reglas de la demostración" }).click();
  await expect(page).toHaveURL(/#reglas$/);
  expect(writes.filter(url => /\/api\/v1\//.test(url))).toEqual([]);
});

test("pausa, cierre y cupo agotado mantienen su significado", async ({ page }) => {
  for (const [slug, label] of [["suv-pausada-demo", "Pausada"], ["suv-cerrada-demo", "Cerrada"], ["portatil-sin-cupo-demo", "Sin cupo disponible"]]) {
    await page.goto(`/rifas/${slug}`);
    await expect(page.getByRole("button", { name: label, exact: true })).toBeDisabled();
    await expect(page.getByRole("spinbutton")).toBeDisabled();
  }
  await expect(page.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "70");
  await expect(page.getByRole("progressbar")).toHaveAttribute("aria-valuemax", "100");
  await expect(page.getByText("El cupo está comprometido.", { exact: false })).toBeVisible();
});

test("ayuda usa preguntas desplegables accesibles", async ({ page }) => {
  await page.goto("/ayuda");
  await page.getByText("¿Puedo comprar en esta demostración?", { exact: true }).click();
  await expect(page.getByText("Esta vista permite explorar el diseño.", { exact: false })).toBeVisible();
});

test("galería cambia de imagen conservando una alternativa descriptiva", async ({ page }) => {
  await page.goto("/rifas/suv-premium-demo");
  await page.getByRole("button", { name: "Ver imagen 2 de SUV premium" }).click();
  await expect(page.getByRole("img", { name: "Ilustración demo del SUV blanco visto desde atrás en la misma villa" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Ver imagen 2 de SUV premium" })).toHaveAttribute("aria-pressed", "true");
});

test("navegación se adapta al teléfono y cierra el menú al cambiar de ruta", async ({ page }) => {
  await page.goto("/");
  if ((page.viewportSize()?.width ?? 1280) < 768) {
    await page.getByRole("button", { name: "Abrir menú" }).click();
    await page.getByRole("navigation", { name: "Menú móvil" }).getByRole("link", { name: "Ayuda y cómo funciona" }).click();
    await page.waitForURL(/\/ayuda$/);
    await expect(page).toHaveURL(/\/ayuda$/);
    await expect(page.getByRole("button", { name: "Abrir menú" })).toHaveAttribute("aria-expanded", "false");
    await expect(page.getByRole("navigation", { name: "Navegación móvil" }).getByRole("link", { name: "Ayuda" })).toHaveAttribute("aria-current", "page");
  } else {
    await page.getByRole("navigation", { name: "Navegación principal" }).getByRole("link", { name: "Cómo funciona" }).click();
    await page.waitForURL(/\/ayuda$/);
    await expect(page).toHaveURL(/\/ayuda$/);
  }
});
