import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Stallion AI Assistant",
  description: "AI chatbot by Digital Stallion for award event and nomination enquiries.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      {/* suppressHydrationWarning: browser extensions (e.g. Grammarly) inject
          data-* attributes on <body> before React hydrates, which would
          otherwise log a hydration mismatch. Only this element is affected. */}
      <body className="h-full bg-slate-50 text-slate-900 antialiased" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
