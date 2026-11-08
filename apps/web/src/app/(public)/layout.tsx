import { PublicShell } from "@/components/public-shell";
import localFont from "next/font/local";
import "./public-theme.css";
import "./public-theme-red.css";

// Cambiar a "original" para restaurar la paleta carbón/champán.
const publicTheme: "red" | "original" = "red";

const editorial = localFont({
  src: [
    { path: "../../assets/fonts/playfair-display.ttf", weight: "400 900", style: "normal" },
    { path: "../../assets/fonts/playfair-display-italic.ttf", weight: "400 900", style: "italic" },
  ],
  variable: "--font-editorial", display: "swap", fallback: ["Georgia", "serif"],
});
const interfaceFont = localFont({
  src: "../../assets/fonts/plus-jakarta-sans.ttf", weight: "200 800",
  variable: "--font-interface", display: "swap", fallback: ["Arial", "sans-serif"],
});

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return <div data-public-theme={publicTheme} className={`public-app ${editorial.variable} ${interfaceFont.variable}`}><PublicShell>{children}</PublicShell></div>;
}
