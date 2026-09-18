import type { Event } from "@/lib/db/schema";

/** A fully-populated sample event (mirrors scripts/seed.ts values). */
export function makeEvent(overrides: Partial<Event> = {}): Event {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    slug: "INDIA-2027",
    name: "Digital Stallion Awards India 2027",
    country: "IN",
    year: 2027,
    editionNumber: 3,
    eventDate: new Date("2027-03-19T13:00:00Z"),
    venue: "Mumbai, India",
    eligibilityPeriod: "Work live between 1 January 2026 and 31 December 2026",
    nominationOpen: new Date("2026-10-01T00:00:00Z"),
    nominationDeadline: new Date("2027-01-31T18:29:00Z"),
    fees: { standard: { amount: 15000, currency: "INR", note: "per entry" } },
    taxes: { gst: { label: "GST", rate: 18 } },
    contact: { team: "Digital Stallion Awards Team", email: "awards@example.com" },
    sponsors: [{ name: "Sample Sponsor", tier: "Gold" }],
    announcements: [
      { text: "Early-bird rate applies before 15 December 2026.", effectiveDate: "2026-09-01", expiryDate: "2026-12-15" },
      { text: "Super early-bird rate closed.", effectiveDate: "2026-06-01", expiryDate: "2026-08-31" },
    ],
    status: "open",
    active: true,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  };
}
