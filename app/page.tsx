import Script from "next/script";
import Link from "next/link";
import { getActiveEvent } from "@/lib/event/active";
import { LaunchButton } from "./launch-button";

/**
 * Demo host page. Stands in for an award site: it includes /embed.js exactly the
 * way a real site would, which injects the launcher + iframe. Presentation only.
 */
export const dynamic = "force-dynamic";

export default async function DemoPage() {
  const slug = process.env.ACTIVE_EVENT_ID ?? "(ACTIVE_EVENT_ID not set)";

  // Show the real event name in the hero when the DB is reachable; fall back to
  // the pinned slug so the page still renders without a database.
  let eventName = "Digital Stallion Awards";
  let eventMeta = "";
  try {
    const event = await getActiveEvent();
    eventName = event.name;
    eventMeta = [event.country, event.year].filter(Boolean).join(" · ");
  } catch {
    eventName = slug;
  }

  return (
    <main className="relative flex min-h-screen flex-col bg-brand-dark text-white">
      <section className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-6 py-20 text-center">
        {/* White rounded tile — the event badge is a white-background JPG, so it
            gets a tile with padding rather than sitting flat on the black hero. */}
        <div className="mb-7 inline-flex items-center justify-center rounded-brand bg-white p-3 shadow-card">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/stallion-badge.jpg"
            alt="The Great Marketing &amp; Business Minds UAE 2026"
            className="h-24 w-auto object-contain sm:h-28"
          />
        </div>

        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-primary">
          Digital Stallions Forum
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight text-brand-primary sm:text-5xl">
          {eventName}
        </h1>
        {eventMeta && <p className="mt-2 text-white/60">{eventMeta}</p>}

        <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/80">
          Meet your awards concierge. Ask about the event, find the categories that fit your work,
          and start your nomination — with the team a click away.
        </p>

        <div className="mt-9">
          <LaunchButton className="inline-flex items-center gap-2 rounded-full bg-brand-primary px-7 py-3.5 text-sm font-semibold text-brand-fg shadow-launcher transition hover:-translate-y-0.5 hover:bg-brand-primary-bright active:translate-y-0">
            Chat with the assistant
          </LaunchButton>
          <p className="mt-3 text-xs text-white/40">
            Or use the chat launcher in the bottom-right corner.
          </p>
        </div>
      </section>

      {/* Dev-only note — collapsed by default so the page reads as a real site. */}
      <details className="mx-auto mb-10 w-full max-w-3xl px-6 text-sm">
        <summary className="cursor-pointer select-none text-white/40 transition hover:text-white/70">
          Developer details
        </summary>
        <div className="mt-3 space-y-2 rounded-brand border border-white/10 bg-white/5 p-4 text-white/70 shadow-bubble">
          <div>
            Pinned event: <code className="rounded bg-white/10 px-1.5 py-0.5">{slug}</code>
          </div>
          <div>
            Embed snippet:{" "}
            <code className="rounded bg-white/10 px-1.5 py-0.5">
              {'<script src="https://<assistant-host>/embed.js" async></script>'}
            </code>
          </div>
          <div className="space-x-4 pt-1">
            <Link className="text-brand-primary underline hover:text-brand-primary-bright" href="/widget">
              /widget
            </Link>
            <Link className="text-brand-primary underline hover:text-brand-primary-bright" href="/admin">
              /admin
            </Link>
            <Link className="text-brand-primary underline hover:text-brand-primary-bright" href="/api/health">
              /api/health
            </Link>
          </div>
        </div>
      </details>

      <Script src="/embed.js" strategy="afterInteractive" />
    </main>
  );
}
