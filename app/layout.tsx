import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import "./globals.css";

// Clean sans across the app; exposed as a CSS var and wired to Tailwind's
// font-sans (tailwind.config.ts). Replaces the browser-default serif headings.
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

// Editorial serif for display headings on the public host page (font-display).
const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Stallion AI Assistant",
  description: "AI chatbot by Digital Stallion for award event and nomination enquiries.",
  icons: { icon: "/brand/mark-2026.jpg" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`h-full ${inter.variable} ${playfair.variable}`}>
      {/* suppressHydrationWarning: browser extensions (e.g. Grammarly) inject
          data-* attributes on <body> before React hydrates, which would
          otherwise log a hydration mismatch. Only this element is affected. */}
      <body className="h-full bg-slate-50 font-sans text-slate-900 antialiased" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
