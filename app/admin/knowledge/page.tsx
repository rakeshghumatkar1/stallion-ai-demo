import Link from "next/link";
import { and, desc, eq, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { kbDocuments, type KbDocument } from "@/lib/db/schema";
import { getActiveEvent } from "@/lib/event/active";
import { saveKbDocumentAction, setKbApprovalAction } from "../actions";
import { fmtDateTime, param, toDateTimeLocal, type SearchParams } from "../_lib/format";

export const dynamic = "force-dynamic";

/**
 * Knowledge editor. Saving re-chunks and re-embeds the document. Only
 * `approved` + active + in-date documents ever reach the model, so new content
 * defaults to draft until someone reviews it.
 */
export default async function KnowledgePage({ searchParams }: { searchParams: SearchParams }) {
  const event = await getActiveEvent();
  const sp = await searchParams;
  const error = param(sp.error);
  const saved = param(sp.saved) === "1";
  const isNew = param(sp.new) === "1";
  const id = z.string().uuid().safeParse(param(sp.id));

  const scoped = or(eq(kbDocuments.eventId, event.id), eq(kbDocuments.scope, "evergreen"));

  let editing: KbDocument | null = null;
  if (id.success) {
    const [doc] = await db
      .select()
      .from(kbDocuments)
      .where(and(eq(kbDocuments.id, id.data), scoped))
      .limit(1);
    editing = doc ?? null;
  }

  const docs = await db.select().from(kbDocuments).where(scoped).orderBy(desc(kbDocuments.updatedAt)).limit(200);

  const input = "mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm";
  const label = "block text-sm text-slate-600";

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_1.2fr]">
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h1 className="text-xl font-semibold">Knowledge base</h1>
          <Link href="/admin/knowledge?new=1" className="rounded-md bg-stallion-accent px-3 py-1.5 text-sm text-white">
            New document
          </Link>
        </div>
        <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
          {docs.map((d) => (
            <li key={d.id} className="flex items-start justify-between gap-3 p-3 text-sm">
              <div className="min-w-0">
                <Link href={`/admin/knowledge?id=${d.id}`} className="font-medium underline">
                  {d.title}
                </Link>
                <div className="text-xs text-slate-500">
                  {d.scope} · v{d.version} · {d.approvalStatus}
                  {!d.active && " · inactive"} · {fmtDateTime(d.updatedAt)}
                </div>
              </div>
              <form action={setKbApprovalAction} className="shrink-0">
                <input type="hidden" name="id" value={d.id} />
                <input type="hidden" name="approvalStatus" value={d.approvalStatus === "approved" ? "draft" : "approved"} />
                <button
                  type="submit"
                  className={`rounded px-2 py-1 text-xs ${
                    d.approvalStatus === "approved" ? "bg-slate-200 text-slate-700" : "bg-green-600 text-white"
                  }`}
                >
                  {d.approvalStatus === "approved" ? "Unapprove" : "Approve"}
                </button>
              </form>
            </li>
          ))}
          {docs.length === 0 && <li className="p-3 text-sm text-slate-500">No documents yet.</li>}
        </ul>
      </section>

      {(isNew || editing) && (
        <section>
          <h2 className="mb-3 text-lg font-semibold">{editing ? "Edit document" : "New document"}</h2>
          {saved && <p className="mb-3 rounded bg-green-50 p-2 text-sm text-green-700">Saved and re-embedded.</p>}
          {error && <p className="mb-3 rounded bg-red-50 p-2 text-sm text-red-700">{error}</p>}
          <form action={saveKbDocumentAction} className="space-y-4">
            <input type="hidden" name="id" value={editing?.id ?? ""} />
            <label className={label}>
              Title
              <input name="title" defaultValue={editing?.title ?? ""} required className={input} />
            </label>
            <div className="grid grid-cols-2 gap-4">
              <label className={label}>
                Scope
                <select name="scope" defaultValue={editing?.scope ?? "event"} className={input}>
                  <option value="event">event ({event.slug} only)</option>
                  <option value="evergreen">evergreen (shared across events)</option>
                </select>
              </label>
              <label className={label}>
                Approval
                <select name="approvalStatus" defaultValue={editing?.approvalStatus ?? "draft"} className={input}>
                  <option value="draft">draft (not visible to the assistant)</option>
                  <option value="approved">approved (live)</option>
                </select>
              </label>
              <label className={label}>
                Effective from (UTC, optional)
                <input name="effectiveDate" type="datetime-local" defaultValue={toDateTimeLocal(editing?.effectiveDate)} className={input} />
              </label>
              <label className={label}>
                Expires (UTC, optional)
                <input name="expiryDate" type="datetime-local" defaultValue={toDateTimeLocal(editing?.expiryDate)} className={input} />
              </label>
            </div>
            <label className={label}>
              Source (optional, e.g. a doc URL or owner)
              <input name="source" defaultValue={editing?.source ?? ""} className={input} />
            </label>
            <label className={label}>
              Body
              <textarea name="body" rows={16} required defaultValue={editing?.body ?? ""} className={input} />
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" name="active" defaultChecked={editing?.active ?? true} />
              Active
            </label>
            <button type="submit" className="rounded-md bg-stallion-accent px-4 py-2 text-sm font-medium text-white">
              Save &amp; re-embed
            </button>
          </form>
        </section>
      )}
    </div>
  );
}
