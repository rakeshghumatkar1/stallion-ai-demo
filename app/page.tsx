import Script from "next/script";
import Link from "next/link";

/**
 * Demo host page. Stands in for an award site: it includes /embed.js exactly
 * the way a real site would, which injects the launcher + iframe.
 */
export default function DemoPage() {
  const eventSlug = process.env.ACTIVE_EVENT_ID ?? "(ACTIVE_EVENT_ID not set)";
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-2xl font-semibold">Stallion AI Assistant — demo host page</h1>
      <p className="mt-3 text-slate-600">
        This page embeds the assistant the same way an award site would, with a single script tag.
        Use the launcher in the bottom-right corner.
      </p>

      <dl className="mt-8 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
        <dt className="font-medium text-slate-500">Pinned event</dt>
        <dd>
          <code className="rounded bg-slate-200 px-1.5 py-0.5">{eventSlug}</code>
        </dd>
        <dt className="font-medium text-slate-500">Embed snippet</dt>
        <dd>
          <code className="rounded bg-slate-200 px-1.5 py-0.5">
            {'<script src="https://<assistant-host>/embed.js" async></script>'}
          </code>
        </dd>
        <dt className="font-medium text-slate-500">Links</dt>
        <dd className="space-x-4">
          <Link className="underline" href="/widget">
            /widget
          </Link>
          <Link className="underline" href="/admin">
            /admin
          </Link>
          <Link className="underline" href="/api/health">
            /api/health
          </Link>
        </dd>
      </dl>

      <Script src="/embed.js" strategy="afterInteractive" />
    </main>
  );
}
