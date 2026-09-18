import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { handoffs } from "@/lib/db/schema";
import { getActiveEvent } from "@/lib/event/active";
import { updateHandoffAction } from "../actions";
import { fmtDateTime, param, type SearchParams } from "../_lib/format";

export const dynamic = "force-dynamic";

const STATUSES = ["open", "acknowledged", "closed"] as const;

export default async function HandoffsPage({ searchParams }: { searchParams: SearchParams }) {
  const event = await getActiveEvent();
  const error = param((await searchParams).error);
  const rows = await db
    .select()
    .from(handoffs)
    .where(eq(handoffs.eventId, event.id))
    .orderBy(desc(handoffs.createdAt))
    .limit(200);

  return (
    <div>
      <h1 className="mb-3 text-xl font-semibold">Handoffs</h1>
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      <ul className="space-y-3">
        {rows.map((h) => (
          <li key={h.id} className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
              <span>{fmtDateTime(h.createdAt)}</span>
              <span>
                status: <b className="text-slate-800">{h.status}</b>
              </span>
              {h.assignedTo && <span>assigned: {h.assignedTo}</span>}
              {h.conversationId && (
                <Link href={`/admin/conversations?id=${h.conversationId}`} className="underline">
                  conversation
                </Link>
              )}
            </div>
            <div className="mt-2 font-medium">{h.reason}</div>
            <p className="mt-1 whitespace-pre-wrap text-slate-700">{h.summary}</p>
            <form action={updateHandoffAction} className="mt-3 flex flex-wrap items-center gap-2">
              <input type="hidden" name="id" value={h.id} />
              <select name="status" defaultValue={h.status} className="rounded border border-slate-300 px-2 py-1 text-xs">
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <input
                name="assignedTo"
                defaultValue={h.assignedTo ?? ""}
                placeholder="assigned to"
                className="rounded border border-slate-300 px-2 py-1 text-xs"
              />
              <button type="submit" className="rounded bg-slate-800 px-3 py-1 text-xs text-white">
                Update
              </button>
            </form>
          </li>
        ))}
        {rows.length === 0 && <li className="text-sm text-slate-500">No handoffs yet.</li>}
      </ul>
    </div>
  );
}
