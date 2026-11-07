import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { writeFile } from "node:fs/promises";

for (const path of ["/", "/rifas", "/admin/login", "/rifas/suv-premium-demo", "/ayuda"]) {
  test(`${path}: navegación accesible, demo y sin desbordamiento`, async ({ page }, testInfo) => {
    await page.addInitScript(() => {
      const state = { cls: 0, lcpMs: null as number | null };
      (window as unknown as { m6Vitals: typeof state }).m6Vitals = state;
      if (PerformanceObserver.supportedEntryTypes.includes("layout-shift")) {
        new PerformanceObserver(list => { for (const item of list.getEntries()) {
          const shift = item as PerformanceEntry & { hadRecentInput: boolean; value: number };
          if (!shift.hadRecentInput) state.cls += shift.value;
        } }).observe({ type: "layout-shift", buffered: true });
      }
      if (PerformanceObserver.supportedEntryTypes.includes("largest-contentful-paint")) {
        new PerformanceObserver(list => { state.lcpMs = list.getEntries().at(-1)?.startTime ?? null; })
          .observe({ type: "largest-contentful-paint", buffered: true });
      }
    });
    await page.goto(path);
    await expect(page.getByRole("main")).toBeVisible();
    if (path.startsWith("/admin")) {
      await expect(page.locator(".header, .footer, .bottom-nav, .environment-note")).toHaveCount(0);
      await expect(page.getByRole("heading", { name: "Administración", exact: true })).toBeVisible();
    } else await expect(page.getByText("DEMO · Sin transacciones reales")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
    expect(result.violations).toEqual([]);
    for (const image of await page.getByRole("img").all()) {
      await image.scrollIntoViewIfNeeded();
      await image.evaluate((element: HTMLImageElement) => element.decode());
    }
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await page.screenshot({ path: testInfo.outputPath("page.png"), fullPage: true });
    const measured = await page.evaluate(() => {
      const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
      const resources = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
      return { ...(window as unknown as { m6Vitals: { cls: number; lcpMs: number | null } }).m6Vitals,
        domContentLoadedMs: nav?.domContentLoadedEventEnd ?? null, loadMs: nav?.loadEventEnd ?? null,
        resourceRequests: resources.length, transferredBytes: resources.reduce((sum, item) => sum + item.transferSize, 0) };
    });
    const measurementPath = testInfo.outputPath("performance.json");
    await writeFile(measurementPath, JSON.stringify({ path, project: testInfo.project.name, environment: "isolated-next-dev-demo", ...measured }, null, 2));
    await testInfo.attach("performance", { path: measurementPath, contentType: "application/json" });
  });
}
test("navegación por teclado y regreso desde catálogo", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Saltar al contenido" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("main")).toBeFocused();
  await page.getByRole("link", { name: "Ver todas" }).click();
  await page.waitForURL(/\/rifas$/);
  await expect(page).toHaveURL(/\/rifas$/);
  await page.getByRole("link", { name: "Volver al inicio" }).click();
  await expect(page).toHaveURL("/");
});
test("admin no expone datos y las rutas inexistentes devuelven 404", async ({ page }) => {
  await page.goto("/admin");
  await page.waitForURL(/\/admin\/login$/);
  await expect(page).toHaveURL(/\/admin\/login$/);
  await expect(page.getByRole("textbox")).toHaveCount(0);
  const response = await page.goto("/ruta-que-no-existe");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "No encontramos esta página" })).toBeVisible();
});
