import Script from "next/script";
import Link from "next/link";
import { getActiveEventSlug } from "@/lib/event/active";
import { UAE_EVENT, UAE_CATEGORIES } from "@/lib/demo/uae-knowledge";
import { PRODUCT_IDENTITY_EN } from "@/lib/types";
import { LaunchButton } from "./launch-button";

/**
 * Demo host page — stands in for the award site. It includes /embed.js exactly
 * the way a real site would, and everything factual on it (dates, venue,
 * deadline, categories, contact) is read from the organiser-approved event
 * configuration, never typed here. Presentation only; no chat logic.
 */
export const dynamic = "force-dynamic";

const BRAND_GOLD = "#D9B150";

function loadPageData() {
  return {
    event: UAE_EVENT,
    facts: [
      { field: "location", confirmed: true, value: "Dubai, UAE" },
      { field: "event_date", confirmed: false, value: null },
      { field: "nomination_deadline", confirmed: false, value: null },
      { field: "eligibility_period", confirmed: false, value: null },
    ],
    cats: UAE_CATEGORIES,
  };
}

const FACT_LABELS: Record<string, string> = {
  location: "Location",
  event_date: "Event date",
  nomination_deadline: "Nomination deadline",
  eligibility_period: "Eligibility period",
};

const primaryBtn =
  "inline-flex items-center justify-center rounded-full bg-brand-primary px-7 py-3 text-sm font-semibold text-brand-fg transition-colors hover:bg-brand-primary-bright focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/60";
const outlineBtn =
  "inline-flex items-center justify-center rounded-full border border-brand-primary/50 px-6 py-2.5 text-sm font-medium text-brand-primary transition-colors hover:border-brand-primary hover:bg-brand-primary/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/60";

export default async function DemoPage() {
  const slug = getActiveEventSlug();
  const { event, facts, cats } = await loadPageData();

  const eyebrow = event ? "DUBAI · UAE · 2027" : slug;
  const title = event?.name ?? "Digital Stallions Forum";
  const contact = event?.contact ?? null;

  return (
    <div className="min-h-screen bg-brand-dark text-slate-200 selection:bg-brand-primary/30">
      {/* ---------------------------------------------------------------- Nav */}
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <a href="#top" className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-white p-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/dsf-middle-east.svg" alt="Digital Stallions Forum" className="h-full w-full object-contain" />
            </span>
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">Digital Stallions Forum · Middle East</span>
          </a>
          <nav className="hidden items-center gap-8 text-sm text-slate-400 md:flex">
            <a href="#event" className="transition-colors hover:text-white">
              The event
            </a>
            <a href="#categories" className="transition-colors hover:text-white">
              Categories
            </a>
            <a href="#contact" className="transition-colors hover:text-white">
              Contact
            </a>
            <LaunchButton className={outlineBtn}>Chat with the assistant</LaunchButton>
          </nav>
        </div>
      </header>

      <main id="top">
        {/* --------------------------------------------------------------- Hero */}
        <section className="mx-auto grid max-w-6xl gap-14 px-6 pb-20 pt-16 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:pt-24">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-brand-primary">{eyebrow}</p>
            <h1 className="mt-5 font-display text-4xl font-semibold leading-[1.08] tracking-tight text-white sm:text-5xl lg:text-6xl">
              {title}
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-slate-400">
              Recognising marketing, digital and business achievement across the UAE. Explore the event, discover the categories that may fit your work, and move towards nomination with the organising team one step away.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-5">
              <LaunchButton className={primaryBtn}>Start a conversation</LaunchButton>
              <a href="#categories" className="text-sm font-medium text-slate-300 underline-offset-4 hover:text-white hover:underline">
                See the categories
              </a>
            </div>
            <p className="mt-8 max-w-lg text-xs leading-relaxed text-slate-500">
              {PRODUCT_IDENTITY_EN.name}. It shares only organiser-approved event
              information and connects you with the team for anything it cannot confirm.
            </p>
          </div>

          <div className="space-y-6">
            {/* Middle East / UAE brand identity from the organiser-provided Drive assets. */}
            <div className="rounded-lg border border-brand-primary/30 bg-white p-7 sm:p-10">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/brand/dsf-middle-east.svg"
                alt="Digital Stallions Forum Middle East"
                className="mx-auto block h-auto w-full max-w-md object-contain"
              />
              <div className="mt-6 border-t border-slate-200 pt-5 text-center">
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">Dubai · UAE · 2027</p>
                <p className="mt-2 text-sm font-semibold text-slate-900">The Great Marketing &amp; Business Minds</p>
              </div>
            </div>
            <dl className="divide-y divide-white/10 rounded-lg border border-white/10 bg-white/[0.03]">
              {facts.map((f) => (
                <div key={f.field} className="flex items-baseline justify-between gap-6 px-5 py-3.5">
                  <dt className="text-xs uppercase tracking-[0.18em] text-slate-500">{FACT_LABELS[f.field] ?? f.field}</dt>
                  <dd className={`text-right text-sm ${f.confirmed ? "text-slate-100" : "italic text-slate-500"}`}>
                    {f.confirmed ? f.value : "To be announced"}
                  </dd>
                </div>
              ))}
              {facts.length === 0 && (
                <div className="px-5 py-3.5 text-sm italic text-slate-500">
                  Event details will appear once the event is configured.
                </div>
              )}
            </dl>
          </div>
        </section>

        {/* ---------------------------------------------------- How it helps */}
        <section id="event" className="border-t border-white/10">
          <div className="mx-auto max-w-6xl px-6 py-20">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-brand-primary">Your awards concierge</p>
              <h2 className="mt-4 font-display text-3xl font-semibold text-white sm:text-4xl">Three things it can do for you today</h2>
            </div>
            <ol className="mt-12 grid gap-px overflow-hidden rounded-lg border border-white/10 bg-white/10 md:grid-cols-3">
              {[
                {
                  n: "01",
                  t: "Understand the event",
                  d: "Dates, venue, eligibility period, fees and the nomination process — straight from the organiser's approved configuration.",
                },
                {
                  n: "02",
                  t: "Find categories that may fit",
                  d: "Describe your work and get the categories that appear potentially relevant, with the reasoning. The awards team makes the final call.",
                },
                {
                  n: "03",
                  t: "Nominate, or talk to the team",
                  d: "Get the right form when you're ready. For sponsorship, bulk entries or anything unusual, it hands you to the team with a summary.",
                },
              ].map((s) => (
                <li key={s.n} className="bg-brand-dark p-8">
                  <span className="font-display text-3xl text-brand-primary">{s.n}</span>
                  <h3 className="mt-5 text-lg font-semibold text-white">{s.t}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-slate-400">{s.d}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ------------------------------------------------------- Categories */}
        <section id="categories" className="border-t border-white/10">
          <div className="mx-auto max-w-6xl px-6 py-20">
            <div className="flex flex-wrap items-end justify-between gap-6">
              <div className="max-w-2xl">
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-brand-primary">Award categories</p>
                <h2 className="mt-4 font-display text-3xl font-semibold text-white sm:text-4xl">
                  {cats.length ? `${cats.length} UAE 2027 award categories to explore` : "UAE 2027 award categories"}
                </h2>
              </div>
              <LaunchButton className={outlineBtn}>Help me choose a category</LaunchButton>
            </div>
            {cats.length > 0 ? (
              <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {cats.map((c) => (
                  <li
                    key={c.name}
                    className="rounded-lg border border-white/10 bg-white/[0.03] p-6 transition-colors hover:border-brand-primary/50"
                  >
                    <h3 className="font-semibold text-white">{c.officialName ?? c.name}</h3>
                    {c.officialName && c.officialName !== c.name && <p className="mt-0.5 text-xs text-slate-500">{c.name}</p>}

                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-12 text-sm italic text-slate-500">The UAE category catalogue is being prepared.</p>
            )}
            <p className="mt-8 text-xs text-slate-500">
              Category suggestions from the assistant are advisory. Eligibility and final placement are decided by the awards
              team.
            </p>
          </div>
        </section>

        {/* ---------------------------------------------------------- Contact */}
        <section id="contact" className="border-t border-white/10">
          <div className="mx-auto grid max-w-6xl gap-10 px-6 py-20 lg:grid-cols-[1fr_auto] lg:items-center">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-brand-primary">Speak with the team</p>
              <h2 className="mt-4 font-display text-3xl font-semibold text-white sm:text-4xl">
                Sponsorship, partnerships and bulk entries are handled in person
              </h2>
              <p className="mt-5 text-slate-400">
                Start with the assistant and it will pass the team a summary of your enquiry, or reach the organisers
                directly.
              </p>
              {contact && (contact.team || contact.email || contact.phone || contact.website) && (
                <dl className="mt-8 grid gap-x-10 gap-y-3 text-sm sm:grid-cols-2">
                  {contact.team && (
                    <div>
                      <dt className="text-xs uppercase tracking-[0.18em] text-slate-500">Team</dt>
                      <dd className="mt-1 text-slate-100">{contact.team}</dd>
                    </div>
                  )}
                  {contact.email && (
                    <div>
                      <dt className="text-xs uppercase tracking-[0.18em] text-slate-500">Email</dt>
                      <dd className="mt-1">
                        <a
                          href={`mailto:${contact.email}`}
                          className="text-slate-100 underline-offset-4 hover:text-brand-primary hover:underline"
                        >
                          {contact.email}
                        </a>
                      </dd>
                    </div>
                  )}
                  {contact.phone && (
                    <div>
                      <dt className="text-xs uppercase tracking-[0.18em] text-slate-500">Phone</dt>
                      <dd className="mt-1 text-slate-100">{contact.phone}</dd>
                    </div>
                  )}
                  {contact.website && (
                    <div>
                      <dt className="text-xs uppercase tracking-[0.18em] text-slate-500">Website</dt>
                      <dd className="mt-1">
                        <a
                          href={contact.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-slate-100 underline-offset-4 hover:text-brand-primary hover:underline"
                        >
                          {contact.website.replace(/^https?:\/\//, "")}
                        </a>
                      </dd>
                    </div>
                  )}
                </dl>
              )}
            </div>
            <LaunchButton className={primaryBtn}>Start a conversation</LaunchButton>
          </div>
        </section>
      </main>

      {/* ------------------------------------------------------------- Footer */}
      <footer className="border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-8 text-xs text-slate-500">
          <p>
            {PRODUCT_IDENTITY_EN.name}
          </p>
          <p>Event information on this page comes from the organiser-approved configuration.</p>
        </div>
        <details className="mx-auto max-w-6xl px-6 pb-8 text-xs text-slate-500">
          <summary className="cursor-pointer select-none hover:text-slate-300">Developer details</summary>
          <div className="mt-3 space-y-2 rounded-lg border border-white/10 p-4">
            <div>
              Pinned event: <code className="rounded bg-white/10 px-1.5 py-0.5 text-slate-300">{slug}</code>
            </div>
            <div>
              Embed snippet:{" "}
              <code className="rounded bg-white/10 px-1.5 py-0.5 text-slate-300">
                {'<script src="https://<assistant-host>/embed.js" async></script>'}
              </code>
            </div>
            <div className="space-x-4 pt-1">
              <Link className="underline hover:text-brand-primary" href="/widget">
                /widget
              </Link>
              <Link className="underline hover:text-brand-primary" href="/admin">
                /admin
              </Link>
              <Link className="underline hover:text-brand-primary" href="/api/health">
                /api/health
              </Link>
            </div>
          </div>
        </details>
      </footer>

      <Script src="/embed.js" strategy="afterInteractive" data-color={BRAND_GOLD} />
    </div>
  );
}
