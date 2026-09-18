import Link from "next/link";
import { and, count, eq, or } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  conversations,
  handoffs,
  kbDocuments,
  leads,
  unansweredQuestions,
  type Event,
} from "@/lib/db/schema";
import { getActiveEvent } from "@/lib/event/active";
import { resolveFacts } from "@/lib/ai/tools";

export const dynamic = "force-dynamic";

async function loadCounts(event: Event) {
  const kbScope = or(eq(kbDocuments.eventId, event.id), eq(kbDocuments.scope, "evergreen"));
  const [[conv], [lead], [openHandoffs], [unanswered], [kbApproved], [kbDraft]] = await Promise.all([
    db.select({ n: count() }).from(conversations).where(eq(conversations.eventId, event.id)),
    db.select({ n: count() }).from(leads).where(eq(leads.eventId, event.id)),
    db
      .select({ n: count() })
      .from(handoffs)
      .where(and(eq(handoffs.eventId, event.id), eq(handoffs.status, "open"))),
    db.select({ n: count() }).from(unansweredQuestions).where(eq(unansweredQuestions.eventId, event.id)),
    db
      .select({ n: count() })
      .from(kbDocuments)
      .where(and(kbScope, eq(kbDocuments.approvalStatus, "approved"))),
    db
      .select({ n: count() })
      .from(kbDocuments)
      .where(and(kbScope, eq(kbDocuments.approvalStatus, "draft"))),
  ]);
  return {
    conversations: conv?.n ?? 0,
    leads: lead?.n ?? 0,
    openHandoffs: openHandoffs?.n ?? 0,
    unanswered: unanswered?.n ?? 0,
    kbApproved: kbApproved?.n ?? 0,
    kbDraft: kbDraft?.n ?? 0,
  };
}

export default async function DashboardPage() {
  let event: Event;
  try {
    event = await getActiveEvent();
  } catch (err) {
    return (
      <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm">
        <p className="font-medium">No active event loaded.</p>
        <p className="mt-1 text-amber-800">{err instanceof Error ? err.message : String(err)}</p>
        <p className="mt-2 text-slate-600">
          Set <code>ACTIVE_EVENT_ID</code>, run <code>npm run db:migrate</code> and <code>npm run seed</code>.
        </p>
      </div>
    );
  }

  const counts = await loadCounts(event);
  // The same resolver the chatbot uses — what you see here is what it can say.
  const facts = resolveFacts(event, []);

  const cards: Array<[string, number, string]> = [
    ["Conversations", counts.conversations, "/admin/conversations"],
    ["Leads", counts.leads, "/admin/leads"],
    ["Open handoffs", counts.openHandoffs, "/admin/handoffs"],
    ["Unanswered questions", counts.unanswered, "/admin/unanswered"],
    ["KB approved", counts.kbApproved, "/admin/knowledge"],
    ["KB drafts", counts.kbDraft, "/admin/knowledge"],
  ];

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-xl font-semibold">{event.name}</h1>
        <p className="text-sm text-slate-500">
          {event.slug} · {event.country} · {event.year} · status: {event.status}
        </p>
      </section>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {cards.map(([label, n, href]) => (
          <Link key={label} href={href} className="rounded-lg border border-slate-200 bg-white p-4 hover:border-slate-400">
            <div className="text-2xl font-semibold">{n}</div>
            <div className="text-sm text-slate-500">{label}</div>
          </Link>
        ))}
      </section>

      <section>
        <h2 className="mb-2 font-medium">Facts the assistant can state (from typed columns)</h2>
        <table className="w-full text-sm">
          <tbody>
            {facts.map((f) => (
              <tr key={f.field} className="border-t border-slate-200">
                <td className="py-1.5 pr-4 font-mono text-xs text-slate-500">{f.field}</td>
                <td className="py-1.5">
                  {f.confirmed ? f.value : <span className="text-amber-700">not confirmed — the bot will offer the team</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-xs text-slate-500">
          Edit under <Link className="underline" href="/admin/event">Event</Link>.
        </p>
      </section>
    </div>
  );
}
