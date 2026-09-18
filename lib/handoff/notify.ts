/**
 * Team notification adapter for handoffs (server-only).
 *
 * Channel is chosen via HANDOFF_CHANNEL (email | slack | whatsapp). v1 ships the
 * email channel (Resend); if RESEND_API_KEY is absent we log to the console so
 * dev works without credentials. Slack/WhatsApp are stubs for a later phase.
 *
 * This is the ONE outward notification the app sends, and it goes to the team
 * (HANDOFF_EMAIL), never to the visitor. The assistant itself takes no other
 * external action in this phase.
 */
import "server-only";
import type { Event } from "@/lib/db/schema";
import type { HandoffChannel } from "@/lib/types";

export interface NotifyHandoffInput {
  handoffId: string;
  event: Event;
  reason: string;
  summary: string;
  conversationId: string;
}

export async function notifyHandoff(input: NotifyHandoffInput): Promise<{ delivered: boolean }> {
  const channel = (process.env.HANDOFF_CHANNEL ?? "email").toLowerCase() as HandoffChannel;
  switch (channel) {
    case "email":
      return sendEmail(input);
    case "slack":
    case "whatsapp":
      // TODO(phase-2): implement Slack/WhatsApp handoff channels.
      console.warn(`[handoff] channel "${channel}" not implemented yet; logging instead.`);
      logHandoff(input);
      return { delivered: false };
    default:
      logHandoff(input);
      return { delivered: false };
  }
}

function subjectFor(input: NotifyHandoffInput): string {
  return `[Stallion Handoff] ${input.event.name} — ${input.reason}`;
}

function bodyFor(input: NotifyHandoffInput): string {
  return [
    `A visitor conversation needs the team's attention.`,
    ``,
    `Event: ${input.event.name} (${input.event.slug})`,
    `Reason: ${input.reason}`,
    `Conversation: ${input.conversationId}`,
    `Handoff: ${input.handoffId}`,
    ``,
    `Summary:`,
    input.summary,
  ].join("\n");
}

async function sendEmail(input: NotifyHandoffInput): Promise<{ delivered: boolean }> {
  const to = process.env.HANDOFF_EMAIL;
  const apiKey = process.env.RESEND_API_KEY;

  if (!to) {
    console.warn("[handoff] HANDOFF_EMAIL not set; logging handoff instead of emailing.");
    logHandoff(input);
    return { delivered: false };
  }

  if (!apiKey) {
    // Dev-friendly fallback: no email provider configured.
    console.info(`[handoff] (dev) would email ${to}:\n${subjectFor(input)}\n\n${bodyFor(input)}`);
    return { delivered: false };
  }

  const { Resend } = await import("resend");
  const resend = new Resend(apiKey);
  const from = process.env.HANDOFF_FROM ?? "Stallion Assistant <onboarding@resend.dev>";
  const { error } = await resend.emails.send({
    from,
    to,
    subject: subjectFor(input),
    text: bodyFor(input),
  });
  if (error) {
    console.error("[handoff] Resend error:", error);
    return { delivered: false };
  }
  return { delivered: true };
}

function logHandoff(input: NotifyHandoffInput): void {
  console.info(`[handoff] ${subjectFor(input)}\n${bodyFor(input)}`);
}
