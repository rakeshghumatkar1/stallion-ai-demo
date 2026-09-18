"use client";

/**
 * Hero CTA that opens the embedded chat launcher (window.StallionWidget, exposed
 * by public/embed.js). Falls back to the standalone /widget page if the embed
 * script hasn't loaded yet. Presentation only — no chat logic here.
 */
declare global {
  interface Window {
    StallionWidget?: { open: () => void; close: () => void; toggle: () => void };
  }
}

export function LaunchButton({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        if (typeof window !== "undefined" && window.StallionWidget) {
          window.StallionWidget.open();
        } else {
          window.location.href = "/widget";
        }
      }}
    >
      {children}
    </button>
  );
}
