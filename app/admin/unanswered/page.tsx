import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { unansweredQuestions } from "@/lib/db/schema";
import { getActiveEvent } from "@/lib/event/active";
import { fmtDateTime } from "../_lib/format";

export const dynamic = "force-dynamic";

/**
 * Questions the approved KB could not answer. This is the feedback loop for
 * the knowledge base: answer them by adding approved content, never by letting
 * the model guess.
 */
export default async function UnansweredPage() {
  const event = await getActiveEvent();
  const rows = await db
    .select()
    .from(unansweredQuestions)
    .where(eq(unansweredQuestions.eventId, event.id))
    .orderBy(desc(unansweredQuestions.createdAt))
    .limit(200);

  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold">Unanswered questions</h1>
      <p className="mb-3 text-sm text-slate-500">
        Add approved knowledge under <Link className="underline" href="/admin/knowledge">Knowledge</Link> to close these gaps.
      </p>
      <table className="w-full text-sm">
        <thead className="text-left text-xs uppercase text-slate-500">
          <tr>
            <th className="py-2">Asked</th>
            <th>Question</th>
            <th>Conv</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((q) => (
            <tr key={q.id} className="border-t border-slate-200 align-top">
              <td className="py-2 whitespace-nowrap">{fmtDateTime(q.createdAt)}</td>
              <td className="whitespace-pre-wrap">{q.question}</td>
              <td>
                {q.conversationId ? (
                  <Link href={`/admin/conversations?id=${q.conversationId}`} className="underline">
                    open
                  </Link>
                ) : (
                  "—"
                )}
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={3} className="py-4 text-slate-500">
                Nothing logged yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
