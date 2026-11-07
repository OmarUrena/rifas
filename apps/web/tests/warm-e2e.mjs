// Complete cold route compilation before opening concurrent browser contexts.
// This performs only GETs against the isolated DEMO server; no business retries.
export default async function warmE2e(config) {
  const base = config.projects[0]?.use.baseURL;
  if (!base || !/^http:\/\/127\.0\.0\.1:\d+$/.test(base)) throw new Error('E2E requiere servidor loopback aislado');
  for (const path of ['/', '/rifas', '/ayuda', '/admin/login', '/admin', '/ruta-que-no-existe',
    '/rifas/suv-premium-demo', '/rifas/suv-premium-demo/participar', '/rifas/suv-pausada-demo',
    '/rifas/suv-cerrada-demo', '/rifas/portatil-sin-cupo-demo', '/orden/confirmacion', '/orden/recuperar', '/privacidad']) {
    const response = await fetch(base + path, { signal: AbortSignal.timeout(60000) });
    await response.text();
    if (![200,404].includes(response.status)) throw new Error(`Preparación E2E: ${path} devolvió ${response.status}`);
  }
}
