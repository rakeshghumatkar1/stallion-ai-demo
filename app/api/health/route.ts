/** Liveness probe. Reports which event this deployment is pinned to. */
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ ok: true, event: process.env.ACTIVE_EVENT_ID ?? null });
}
