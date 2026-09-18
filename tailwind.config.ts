import type { Config } from "tailwindcss";
import defaultTheme from "tailwindcss/defaultTheme";

// ─────────────────────────────────────────────────────────────────────────────
// BRAND PALETTE — Digital Stallions Forum (black & gold). One place to tune it.
// Every button, header, chip, and launcher reads from these tokens.
// Contrast rules: gold is an ACCENT — gold text only on dark; gold buttons/chips
// use near-black text (never white); body text stays near-black on white.
// ─────────────────────────────────────────────────────────────────────────────
const brand = {
  primary: "#D9B150", // gold — main brand color
  primaryBright: "#F0CF39", // brighter gold — highlights / hover glow
  primaryDark: "#80641E", // deep bronze — hover-darken / borders
  dark: "#0B0B0C", // near-black — header & dark surfaces
  surface: "#FFFFFF", // light surface
  fg: "#111111", // near-black body text / text on gold
};

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        // Inter is loaded via next/font in app/layout.tsx (--font-inter).
        sans: ["var(--font-inter)", ...defaultTheme.fontFamily.sans],
        // Playfair Display via next/font (--font-display) for editorial headings.
        display: ["var(--font-display)", "Georgia", ...defaultTheme.fontFamily.serif],
      },
      colors: {
        brand: {
          DEFAULT: brand.primary,
          primary: brand.primary,
          "primary-bright": brand.primaryBright,
          "primary-dark": brand.primaryDark,
          dark: brand.dark,
          surface: brand.surface,
          fg: brand.fg,
        },
        // Backward-compatible aliases used by existing markup (admin, etc.).
        stallion: {
          DEFAULT: brand.dark,
          accent: brand.primary,
        },
      },
      borderRadius: {
        // Consistent brand radius for cards, chips, inputs.
        brand: "0.75rem",
      },
      boxShadow: {
        bubble: "0 1px 2px rgba(11, 11, 12, 0.10)",
        card: "0 8px 30px rgba(11, 11, 12, 0.12)",
        launcher: "0 10px 30px rgba(217, 177, 80, 0.40)",
      },
      keyframes: {
        "typing-bounce": {
          "0%, 80%, 100%": { transform: "translateY(0)", opacity: "0.4" },
          "40%": { transform: "translateY(-3px)", opacity: "1" },
        },
      },
      animation: {
        "typing-bounce": "typing-bounce 1.2s infinite ease-in-out",
      },
    },
  },
  plugins: [],
};

export default config;
