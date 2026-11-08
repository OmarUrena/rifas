import { expect, test } from "@playwright/test";

test("imágenes completas en marcos 3:2 del catálogo y detalle", async ({ page }) => {
  for (const path of ["/rifas", "/rifas/suv-premium-demo"]) {
    await page.goto(path);
    const frames = page.locator(".raffle-image-link, .gallery-main");
    expect(await frames.count()).toBeGreaterThan(0);
    for (const frame of await frames.all()) {
      const size = await frame.boundingBox();
      expect(size).not.toBeNull();
      expect(size!.width / size!.height).toBeCloseTo(1.5, 1);
      const image = frame.locator("img");
      if (await image.count()) {
        await image.scrollIntoViewIfNeeded();
        await image.evaluate((img: HTMLImageElement) => img.decode());
        await expect(image).toHaveCSS("object-fit", "contain");
        await expect(image).toHaveCSS("object-position", "50% 50%");
      }
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});
