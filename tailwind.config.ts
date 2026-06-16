import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
        display: ["var(--font-display)", "Georgia", "Cambria", "Times New Roman", "serif"],
      },
      // Palette pulled from the official store (bandhaniindia.com):
      // charcoal text/primary, white canvas, turquoise interactive accent,
      // warm gold from the jewellery imagery. The legacy `wine`/`sand` token
      // names are kept (remapped) so existing class usages adopt the brand
      // automatically without touching every file.
      colors: {
        ink: "#222222", // primary text — matches site #222222
        sand: "#f6f6f5", // app canvas (near-white) so white cards separate
        wine: "#222222", // brand primary (buttons, active nav, avatar) — charcoal
        "wine-dark": "#0f0f0f", // gradient depth — near-black
        gold: "#c0973f", // refined gold accent (site jewellery gold)
        accent: "#56cfe1", // turquoise — interactive accent (links, hovers, focus)
        "accent-deep": "#1499b3", // accessible turquoise for text/links on white
      },
      boxShadow: {
        card: "0 1px 2px rgba(38,35,31,.05), 0 6px 20px rgba(38,35,31,.04)",
        "card-lg": "0 2px 4px rgba(38,35,31,.06), 0 18px 44px rgba(38,35,31,.09)",
        pop: "0 12px 32px rgba(38,35,31,.14)",
      },
      keyframes: {
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        "scale-in": {
          from: { opacity: "0", transform: "translateY(8px) scale(.98)" },
          to: { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        "slide-up": {
          from: { opacity: "0", transform: "translateY(12px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "slide-in-right": {
          from: { transform: "translateX(100%)" },
          to: { transform: "translateX(0)" },
        },
        shimmer: { "100%": { transform: "translateX(100%)" } },
      },
      animation: {
        "fade-in": "fade-in .16s ease-out",
        "scale-in": "scale-in .18s ease-out",
        "slide-up": "slide-up .22s ease-out",
        "slide-in-right": "slide-in-right .24s cubic-bezier(.32,.72,0,1)",
      },
    },
  },
  plugins: [],
} satisfies Config;
