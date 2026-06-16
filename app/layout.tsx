import type { Metadata } from "next";
import { Poppins, Libre_Baskerville } from "next/font/google";
import "./globals.css";

// UI / body typeface — matches the official bandhaniindia.com store, which uses
// Poppins for headings and body throughout.
const poppins = Poppins({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

// Display serif — the store's decorative typeface (Libre Baskerville). Reserved
// for the brand wordmark and hero headlines.
const libreBaskerville = Libre_Baskerville({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  weight: ["400", "700"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: { default: "Bandhani / Siddhartha Daga", template: "%s | Bandhani / Siddhartha Daga" },
  description: "Bandhani / Siddhartha Daga — Couture Operating System",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${poppins.variable} ${libreBaskerville.variable}`}>
      <body>{children}</body>
    </html>
  );
}
