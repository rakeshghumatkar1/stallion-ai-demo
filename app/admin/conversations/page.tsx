import Link from "next/link";
import { and, asc, count, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { conversations, messages } from "@/lib/db/schema";
import { getActiveEvent } from "@/lib/event/active";
import { fmtDateTime, param, pretty, type SearchParams } from "../_lib/format";

export const dynamic = "force-dynamic";

/**
 * Answer state per assistant turn (File 01 §5) so reviewers can audit where
 * the assistant was confident, advising, or unsure.
 */
function AnswerStateBadge({ state }: { state: string | null }) {
  const styles: Record<string, string> = {
    supported: "bg-green-100 text-green-800",
    advisory: "bg-amber-100 text-amber-800",
    unsupported: "bg-red-100 text-red-800",
  };
  const cls = state ? (styles[state] ?? "bg-slate-100 text-slate-600") : "bg-slate-100 text-slate-500";
  return (
    <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold normal-case tracking-normal ${cls}`}>
      {state ?? "no state"}
    </span>
  );
}

export default async function ConversationsPage({ searchParams }: { searchParams: SearchParams }) {
  const event = await getActiveEvent();
  const id = z.string().uuid().safeParse(param((await searchParams).id));

  if (id.success) {
    const [conv] = await db
      .select()
      .from(conversations)
      .where(and(eq(conversations.id, id.data), eq(conversations.eventId, event.id)))
      .limit(1);
    if (!conv) {
      return <p className="text-sm text-slate-500">Conversation not found for this event.</p>;
    }
    const rows = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conv.id))
      .orderBy(asc(messages.createdAt));

    return (
      <div className="space-y-4">
        <Link href="/admin/conversations" className="text-sm underline">
          ← All conversations
        </Link>
        <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
          <div className="font-mono text-xs text-slate-500">{conv.id}</div>
          <div className="mt-1">
            status: <b>{conv.status}</b> · visitor: {conv.visitorType ?? "—"} · started {fmtDateTime(conv.createdAt)}
          </div>
          {conv.summary && <p className="mt-2 whitespace-pre-wrap text-slate-700">{conv.summary}</p>}
        </div>
        <ol className="space-y-2">
          {rows.map((m) => (
            <li key={m.id} className={`rounded-lg border p-3 text-sm ${m.role === "user" ? "border-indigo-200 bg-indigo-50" : "border-slate-200 bg-white"}`}>
              <div className="mb-1 flex flex-wrap items-center gap-2 text-xs uppercase tracking-wide text-slate-500">
                <span>
                  {m.role} · {fmtDateTime(m.createdAt)}
                </span>
                {m.role === "assistant" && <AnswerStateBadge state={m.answerState} />}
              </div>
              <div className="whitespace-pre-wrap">{m.content}</div>
              {m.toolCalls != null && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs text-slate-500">tool activity</summary>
                  <pre className="mt-1 overflow-x-auto rounded bg-slate-100 p-2 text-xs">{pretty(m.toolCalls)}</pre>
                </details>
              )}
            </li>
          ))}
        </ol>
      </div>
    );
  }

  const rows = await db
    .select({
      id: conversations.id,
      status: conversations.status,
      visitorType: conversations.visitorType,
      summary: conversations.summary,
      createdAt: conversations.createdAt,
      messageCount: count(messages.id),
    })
    .from(conversations)
    .leftJoin(messages, eq(messages.conversationId, conversations.id))
    .where(eq(conversations.eventId, event.id))
    .groupBy(conversations.id)
    .orderBy(desc(conversations.createdAt))
    .limit(100);

  return (
    <div>
      <h1 className="mb-3 text-xl font-semibold">Conversations</h1>
      <table className="w-full text-sm">
        <thead className="text-left text-xs uppercase text-slate-500">
          <tr>
            <th className="py-2">Started</th>
            <th>Status</th>
            <th>Visitor</th>
            <th>Msgs</th>
            <th>Summary</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-slate-200">
              <td className="py-2">
                <Link href={`/admin/conversations?id=${r.id}`} className="underline">
                  {fmtDateTime(r.createdAt)}
                </Link>
              </td>
              <td>{r.status}</td>
              <td>{r.visitorType ?? "—"}</td>
              <td>{r.messageCount}</td>
              <td className="max-w-md truncate text-slate-600">{r.summary ?? ""}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={5} className="py-4 text-slate-500">
                No conversations yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
