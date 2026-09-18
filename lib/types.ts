/**
 * Shared application types. Kept framework-agnostic so both server modules and
 * (type-only) client code can import them.
 */
import type { Event } from "@/lib/db/schema";

export type VisitorType = "brand" | "agency" | "individual" | "sponsor" | "unknown";

export const VISITOR_TYPES: VisitorType[] = [
  "brand",
  "agency",
  "individual",
  "sponsor",
  "unknown",
];

export type HandoffChannel = "email" | "slack" | "whatsapp";

/**
 * The fields the model may request via get_event_facts. These map to typed
 * columns on the event — never to model free text.
 */
export type FactField =
  | "event_date"
  | "venue"
  | "eligibility_period"
  | "nomination_open"
  | "nomination_deadline"
  | "fees"
  | "taxes"
  | "contact"
  | "sponsors"
  | "announcements";

export const FACT_FIELDS: FactField[] = [
  "event_date",
  "venue",
  "eligibility_period",
  "nomination_open",
  "nomination_deadline",
  "fees",
  "taxes",
  "contact",
  "sponsors",
  "announcements",
];

/**
 * Where a knowledge document came from (File 01 §2 source priority, highest
 * first). `website` content is historical evidence only and is always
 * provisional.
 */
export type SourceType = "edition_config" | "evergreen" | "meeting_notes" | "website";

export const SOURCE_TYPES: SourceType[] = ["edition_config", "evergreen", "meeting_notes", "website"];

/** The three answer states (File 01 §5). Recorded on every assistant message. */
export type AnswerState = "supported" | "advisory" | "unsupported";

export const ANSWER_STATES: AnswerState[] = ["supported", "advisory", "unsupported"];

/** Product identity (File 01 §12). Shared by the system prompt and the widget. */
export const PRODUCT_IDENTITY_EN = {
  name: "Stallion AI Assistant",
  /** The public greeting; may be adapted to the event. */
  greeting:
    "Hi, I'm Stallion AI Assistant. I can help you understand the event, find the categories that may fit your work, and get your nomination started. What would you like to explore?",
} as const;

/**
 * One resolved fact. `confirmed=false` means the column is unset and the model
 * MUST use the not-confirmed line rather than guessing.
 */
export interface ResolvedFact {
  field: FactField;
  confirmed: boolean;
  value: string | null;
}

/**
 * Per-request context handed to tools. `eventId` is the single active event
 * (ACTIVE_EVENT_ID) resolved SERVER SIDE — the model never supplies it.
 */
export interface ToolContext {
  event: Event;
  eventId: string;
  conversationId: string;
}

export interface RetrievedChunk {
  id: string;
  content: string;
  score: number;
  documentTitle?: string;
  source?: string;
  scope: string;
  /** Source priority bucket (File 01 §2). */
  sourceType?: SourceType | string;
  /** Historical / website-derived: never to be presented as current. */
  provisional?: boolean;
}

/** Result of the output grounding scan. */
export interface GroundingResult {
  ok: boolean;
  flags: GroundingFlag[];
}

export interface GroundingFlag {
  kind: "date" | "number" | "currency";
  value: string;
  reason: string;
}

/** Quick-action chips shown when the widget opens. `send` is the text submitted. */
export interface QuickAction {
  label: string;
  send: string;
}

export const QUICK_ACTIONS: QuickAction[] = [
  { label: "About the event", send: "Tell me about this event and who it is for." },
  {
    label: "Find my categories",
    send: "Help me find the most relevant award categories for my work.",
  },
  {
    label: "Start a nomination",
    send: "I'm interested in participating. Help me start a nomination.",
  },
  {
    label: "Agency / multiple entries",
    send: "I represent an agency and may have multiple entries or clients.",
  },
  {
    label: "Sponsorship / partnership",
    send: "I'm interested in sponsorship or partnership opportunities.",
  },
  { label: "Speak with the team", send: "I'd like to speak with the team about participating." },
];
