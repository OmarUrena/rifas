import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";
import { readAdminEnvironment, readEnvironment } from "./src/lib/config";

readEnvironment(process.env);
readAdminEnvironment(process.env);

const imageBase = process.env.PUBLIC_PRIZE_IMAGE_BASE_URL;
const remotePatterns: NonNullable<NonNullable<NextConfig["images"]>["remotePatterns"]> = [];
if (imageBase) {
  const url = new URL(imageBase);
  const local = !["staging", "production"].includes(process.env.APP_ENV ?? "development") && url.protocol === "http:" && ["127.0.0.1", "localhost"].includes(url.hostname) && url.pathname === "/api/v1/media";
  if ((!local && url.protocol !== "https:") || url.username || url.password || url.search || url.hash || url.pathname === "/" || /[*]/.test(imageBase)) throw new Error("PUBLIC_PRIZE_IMAGE_BASE_URL debe ser un directorio HTTPS público específico, sin comodines.");
  remotePatterns.push({ protocol: url.protocol === "http:" ? "http" : "https", hostname: url.hostname, port: url.port, pathname: `${url.pathname.replace(/\/$/, "")}/**`, search: "" });
}

const nextConfig: NextConfig = {
  poweredByHeader: false,
  devIndicators: false,
  turbopack: { root: fileURLToPath(new URL("../..", import.meta.url)) },
  transpilePackages: ["@sorteos/api-client"],
  images: {
    remotePatterns,
    // Match mobile displays without downloading the default 640px minimum.
    // Uploaded prize photos are normalized to at most 2000px by the API.
    deviceSizes: [360, 384, 480, 640, 750, 828, 1080, 1200, 1600, 1920],
    imageSizes: [32, 48, 64, 96, 128, 192, 256],
  },
  async headers() {
    return [{ source: "/:path*", headers: [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
    ] }, { source: "/consultar-boletos", headers: [
      { key: "Cache-Control", value: "private, no-store, max-age=0" },
      { key: "Referrer-Policy", value: "no-referrer" },
      { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
    ] }, { source: "/admin/:path*", headers: [
      { key: "Cache-Control", value: "private, no-store, max-age=0" },
      { key: "Referrer-Policy", value: "no-referrer" },
      { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
      { key: "Content-Security-Policy", value: "frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'" },
    ] }];
  },
};
export default nextConfig;
