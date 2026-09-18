/**
 * Answer states (File 01 §5) made operational.
 *
 * Every reply is exactly one of SUPPORTED / ADVISORY / UNSUPPORTED. The model
 * declares the state by ending its reply with a one-line marker
 * (`[[state:supported]]` etc.). The app owns what happens next:
 *  - `answerStateTransform` strips the marker from the live stream so the
 *    visitor never sees it and reports the state to the route;
 *  - `extractAnswerState` is the non-streaming equivalent (defensive re-check
 *    of the final text);
 *  - `inferAnswerState` is the fallback classifier used when the model omits
 *    the marker, so a state is ALWAYS recorded (and the omission is logged).
 *
 * The route stores the state on the message, auto-logs UNSUPPORTED turns as
 * unanswered questions, and surfaces the state to clients as a message
 * annotation. Pure and dependency-free so it is unit-testable.
 */
import type { TextStreamPart, ToolSet } from "ai";
import { NO_CONFIRMED_INFO } from "@/lib/ai/guardrails";
import type { AnswerState } from "@/lib/types";

/** One marker, anywhere in a string (case-insensitive). */
const MARKER_RE = /\[\[\s*state\s*:\s*(supported|advisory|unsupported)\s*\]\]/i;

/** Exact marker strings the model is told to emit. */
export const ANSWER_STATE_MARKERS: Record<AnswerState, string> = {
  supported: "[[state:supported]]",
  advisory: "[[state:advisory]]",
  unsupported: "[[state:unsupported]]",
};

/** Remove every marker from `text`. The last marker wins. */
export function extractAnswerState(text: string): { text: string; state: AnswerState | null } {
  let state: AnswerState | null = null;
  let out = text;
  let m: RegExpMatchArray | null;
  while ((m = out.match(MARKER_RE))) {
    state = m[1]!.toLowerCase() as AnswerState;
    out = out.replace(MARKER_RE, "");
  }
  return { text: state ? out.trimEnd() : out, state };
}

const UNSUPPORTED_RE =
  /don'?t have confirmed information|isn'?t confirmed|not confirmed|needs? (to be )?confirm|can'?t confirm|cannot confirm|unable to confirm|pass (the|your|this) (question|request) to the team/i;
const ADVISORY_RE =
  /potentially relevant|may be relevant|appears? (to be )?relevant|could fit|may fit|might fit|may be an option|possible categor/i;

/**
 * Heuristic state for a reply that carried no marker. Conservative: any
 * not-confirmed phrasing → unsupported; suggestion phrasing → advisory;
 * otherwise supported.
 */
export function inferAnswerState(text: string): AnswerState {
  const t = text.toLowerCase();
  if (t.includes(NO_CONFIRMED_INFO.toLowerCase()) || UNSUPPORTED_RE.test(t)) return "unsupported";
  if (ADVISORY_RE.test(t)) return "advisory";
  return "supported";
}

/**
 * Stream transform for `streamText({ experimental_transform })`. Holds back
 * only what could be the start of a marker (an unclosed `[[` and trailing
 * whitespace), so normal text streams through unchanged and the marker is
 * removed even when the provider splits it across chunks. Runs before the
 * SDK's text recorder, so `onFinish` receives the clean text.
 */
export function answerStateTransform<TOOLS extends ToolSet>(onState: (state: AnswerState) => void) {
  return (): TransformStream<TextStreamPart<TOOLS>, TextStreamPart<TOOLS>> => {
    let buf = "";
    let sawMarker = false;

    const textPart = (textDelta: string) => ({ type: "text-delta", textDelta }) as TextStreamPart<TOOLS>;

    const consumeMarkers = () => {
      let m: RegExpMatchArray | null;
      while ((m = buf.match(MARKER_RE))) {
        sawMarker = true;
        onState(m[1]!.toLowerCase() as AnswerState);
        buf = buf.replace(MARKER_RE, "");
      }
    };

    /** Index up to which `buf` is safe to emit. */
    const safeUpTo = () => {
      let i = buf.length;
      const open = buf.lastIndexOf("[[");
      if (open >= 0 && buf.indexOf("]]", open) < 0) i = open;
      else if (buf.endsWith("[")) i = buf.length - 1;
      while (i > 0 && /\s/.test(buf[i - 1]!)) i--;
      return i;
    };

    const flushStep = (controller: TransformStreamDefaultController<TextStreamPart<TOOLS>>) => {
      consumeMarkers();
      const out = sawMarker ? buf.trimEnd() : buf;
      if (out) controller.enqueue(textPart(out));
      buf = "";
      sawMarker = false;
    };

    return new TransformStream<TextStreamPart<TOOLS>, TextStreamPart<TOOLS>>({
      transform(chunk, controller) {
        if (chunk.type === "text-delta") {
          buf += chunk.textDelta;
          consumeMarkers();
          const i = safeUpTo();
          if (i > 0) {
            controller.enqueue(textPart(buf.slice(0, i)));
            buf = buf.slice(i);
          }
          return;
        }
        if (chunk.type === "step-finish" || chunk.type === "finish") flushStep(controller);
        controller.enqueue(chunk);
      },
      flush(controller) {
        flushStep(controller);
      },
    });
  };
}
