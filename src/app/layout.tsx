import type { Metadata, Viewport } from "next";
import "@fontsource-variable/geist";
import "@fontsource-variable/newsreader";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "GeoBY", template: "%s · GeoBY" },
  description:
    "Markanızın ChatGPT, Gemini, Claude, Perplexity ve Google AI Overview cevaplarında ne kadar önerildiğini ölçer.",
  icons: { icon: "/icon.svg" },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#f6f4ef",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}
