import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { leads } from "@/lib/db/schema";
import { getActiveEvent } from "@/lib/event/active";
import { fmtDateTime } from "../_lib/format";

export const dynamic = "force-dynamic";

export default async function LeadsPage() {
  const event = await getActiveEvent();
  const rows = await db
    .select()
    .from(leads)
    .where(eq(leads.eventId, event.id))
    .orderBy(desc(leads.createdAt))
    .limit(200);

  return (
    <div>
      <h1 className="mb-3 text-xl font-semibold">Leads</h1>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="py-2">Captured</th>
              <th>Name</th>
              <th>Org / role</th>
              <th>Contact</th>
              <th>Type</th>
              <th>Entries</th>
              <th>Categories</th>
              <th>Purpose / notes</th>
              <th>Conv</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((l) => (
              <tr key={l.id} className="border-t border-slate-200 align-top">
                <td className="py-2 whitespace-nowrap">{fmtDateTime(l.createdAt)}</td>
                <td>{l.name ?? "—"}</td>
                <td>
                  {l.org ?? "—"}
                  {l.role ? <div className="text-xs text-slate-500">{l.role}</div> : null}
                </td>
                <td>
                  {l.email ?? ""}
                  {l.phone ? <div className="text-xs text-slate-500">{l.phone}</div> : null}
                </td>
                <td>{l.visitorType ?? "—"}</td>
                <td>{l.approxEntries ?? "—"}</td>
                <td className="max-w-xs text-xs">{(l.categoriesDiscussed ?? []).join(", ")}</td>
                <td className="max-w-sm text-xs text-slate-600">
                  {l.purpose}
                  {l.notes ? <div className="mt-1 whitespace-pre-wrap">{l.notes}</div> : null}
                </td>
                <td>
                  {l.conversationId ? (
                    <Link href={`/admin/conversations?id=${l.conversationId}`} className="underline">
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
                <td colSpan={9} className="py-4 text-slate-500">
                  No leads yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
