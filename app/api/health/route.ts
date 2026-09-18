/** Liveness probe. Reports the application-owned pinned event. */
import { getActiveEventSlug } from "@/lib/event/active";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ ok: true, event: getActiveEventSlug(), knowledgeMode: "single-event-only" });
}
