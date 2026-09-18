import { getActiveEvent } from "@/lib/event/active";
import { updateEventAction } from "../actions";
import { param, pretty, toDateTimeLocal, type SearchParams } from "../_lib/format";

export const dynamic = "force-dynamic";

/**
 * Edits the pinned event's typed fact columns. This is the ONLY way facts
 * enter the system — the model never free-types them. Slug and country are
 * read-only because they are the deployment's identity.
 */
export default async function EventPage({ searchParams }: { searchParams: SearchParams }) {
  const event = await getActiveEvent();
  const sp = await searchParams;
  const error = param(sp.error);
  const saved = param(sp.saved) === "1";

  const input = "mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm";
  const label = "block text-sm text-slate-600";

  return (
    <div className="max-w-3xl">
      <h1 className="text-xl font-semibold">Event configuration</h1>
      <p className="mb-4 text-sm text-slate-500">
        {event.slug} · {event.country} — these values are the assistant&apos;s only source of hard facts. Leave a field
        empty and the assistant will say it is not confirmed.
      </p>
      {saved && <p className="mb-3 rounded bg-green-50 p-2 text-sm text-green-700">Saved.</p>}
      {error && <p className="mb-3 rounded bg-red-50 p-2 text-sm text-red-700">{error}</p>}

      <form action={updateEventAction} className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <label className={`${label} md:col-span-2`}>
          Name
          <input name="name" defaultValue={event.name} required className={input} />
        </label>
        <label className={label}>
          Year
          <input name="year" type="number" defaultValue={event.year} required className={input} />
        </label>
        <label className={label}>
          Edition number (optional)
          <input name="editionNumber" type="number" defaultValue={event.editionNumber ?? ""} className={input} />
        </label>
        <label className={label}>
          Status
          <select name="status" defaultValue={event.status} className={input}>
            <option value="draft">draft</option>
            <option value="open">open</option>
            <option value="closed">closed</option>
          </select>
        </label>
        <label className={label}>
          Event date (UTC)
          <input name="eventDate" type="datetime-local" defaultValue={toDateTimeLocal(event.eventDate)} className={input} />
        </label>
        <label className={label}>
          Nominations open (UTC)
          <input name="nominationOpen" type="datetime-local" defaultValue={toDateTimeLocal(event.nominationOpen)} className={input} />
        </label>
        <label className={label}>
          Nomination deadline (UTC)
          <input
            name="nominationDeadline"
            type="datetime-local"
            defaultValue={toDateTimeLocal(event.nominationDeadline)}
            className={input}
          />
        </label>
        <label className={`${label} md:col-span-2`}>
          Venue
          <input name="venue" defaultValue={event.venue ?? ""} className={input} />
        </label>
        <label className={`${label} md:col-span-2`}>
          Eligibility period (as it should be stated to visitors)
          <input name="eligibilityPeriod" defaultValue={event.eligibilityPeriod ?? ""} className={input} />
        </label>
        <label className={label}>
          Fees (JSON: {'{ "standard": { "amount": 15000, "currency": "INR", "note": "per entry" } }'})
          <textarea name="fees" rows={6} defaultValue={pretty(event.fees)} className={`${input} font-mono text-xs`} />
        </label>
        <label className={label}>
          Taxes (JSON: {'{ "gst": { "label": "GST", "rate": 18 } }'})
          <textarea name="taxes" rows={6} defaultValue={pretty(event.taxes)} className={`${input} font-mono text-xs`} />
        </label>
        <label className={`${label} md:col-span-2`}>
          Contact (JSON: {'{ "team": "...", "email": "...", "phone": "...", "whatsapp": "...", "website": "..." }'})
          <textarea name="contact" rows={5} defaultValue={pretty(event.contact)} className={`${input} font-mono text-xs`} />
        </label>
        <div className="md:col-span-2">
          <button type="submit" className="rounded-md bg-stallion-accent px-4 py-2 text-sm font-medium text-white">
            Save event
          </button>
        </div>
      </form>
    </div>
  );
}
