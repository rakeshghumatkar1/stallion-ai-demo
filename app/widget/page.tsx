"use client";

/**
 * The chat widget. Rendered inside an iframe injected by public/embed.js (or
 * visited directly at /widget). Talks to the server ONLY through /api/chat.
 *
 * The event is pinned server-side; the widget never chooses or sends one. It
 * generates a conversation id once so all turns attach to one conversation.
 */
import { useChat } from "@ai-sdk/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { PRODUCT_IDENTITY_EN, QUICK_ACTIONS, type QuickAction } from "@/lib/types";
import { parseMarkdownLite, type Inline } from "@/lib/markdown-lite";

// UI strings as data so a second language can be added by translation only.
// Product identity is shared with the system prompt.
const UI_EN = {
  title: PRODUCT_IDENTITY_EN.name,
  subtitle: "AI Chatbot by Digital Stallion",
  disclosure:
    "You're chatting with an AI assistant using organiser-approved event information. It can help you explore categories, start a nomination, or connect you with the team.",
  welcome: PRODUCT_IDENTITY_EN.greeting,
  placeholder: "Ask about the event, categories, or how to nominate…",
  send: "Send",
  thinking: "Checking…",
  error: "Something went wrong. Restart the conversation to return to the main menu.",
  you: "You",
  assistant: "Assistant",
  restart: "Restart",
  mainMenu: "Main menu",
  startOver: "Start over",
  restartMenu: "Restart / main menu",
  nextStep: "Next step",
};

const CONTINUE_ACTIONS: QuickAction[] = [
  {
    label: "Find categories",
    send: "Help me find the most relevant categories for my work.",
  },
  {
    label: "Start nomination",
    send: "I'm interested in participating. Help me take the next step toward nomination.",
  },
  {
    label: "Talk to the team",
    send: "I'd like to speak with the team about participating.",
  },
];

function newConversationId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  // Non-secure-context fallback (plain http embeds). Only needs to be unique.
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

const RESET_COMMANDS = new Set([
  "restart",
  "restart chat",
  "restart conversation",
  "reset",
  "reset chat",
  "start over",
  "start again",
  "main menu",
  "menu",
]);

function isResetCommand(value: string): boolean {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[.!?]+$/g, "")
    .replace(/\s+/g, " ");
  return RESET_COMMANDS.has(normalized);
}

function restartConversation(): void {
  // A full reload guarantees both UI state and the conversation id are reset.
  // It is intentionally deterministic and does not depend on model behaviour.
  window.location.reload();
}

function Inlines({ inlines }: { inlines: Inline[] }) {
  return (
    <>
      {inlines.map((n, i) =>
        n.type === "bold" ? (
          <strong key={i} className="font-semibold">
            {n.text}
          </strong>
        ) : n.type === "link" ? (
          <a
            key={i}
            href={n.href}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-brand-primary-dark underline break-all"
          >
            {n.href}
          </a>
        ) : (
          <span key={i}>{n.text}</span>
        ),
      )}
    </>
  );
}

/**
 * Render the assistant's text: the markdown subset it writes (bold, lists,
 * headings, links) becomes React elements via lib/markdown-lite — never raw
 * HTML, so nothing in a reply can inject markup.
 */
function RichText({ text }: { text: string }) {
  const blocks = useMemo(() => parseMarkdownLite(text), [text]);
  return (
    <div className="space-y-2 break-words">
      {blocks.map((b, i) => {
        if (b.type === "heading") {
          return (
            <p key={i} className="font-semibold">
              <Inlines inlines={b.inlines} />
            </p>
          );
        }
        if (b.type === "list") {
          const cls = `${b.ordered ? "list-decimal" : "list-disc"} space-y-1 pl-5`;
          const items = b.items.map((item, j) => (
            <li key={j}>
              <Inlines inlines={item} />
            </li>
          ));
          return b.ordered ? (
            <ol key={i} className={cls}>
              {items}
            </ol>
          ) : (
            <ul key={i} className={cls}>
              {items}
            </ul>
          );
        }
        return (
          <p key={i}>
            {b.lines.map((line, j) => (
              <span key={j}>
                {j > 0 && <br />}
                <Inlines inlines={line} />
              </span>
            ))}
          </p>
        );
      })}
    </div>
  );
}

function ActionChips({
  actions,
  disabled,
  onAction,
}: {
  actions: QuickAction[];
  disabled: boolean;
  onAction: (send: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((qa) => (
        <button
          key={qa.label}
          type="button"
          disabled={disabled}
          onClick={() => onAction(qa.send)}
          className="flex min-h-10 flex-[1_1_calc(50%-0.25rem)] items-center justify-center rounded-full border border-brand-primary bg-white px-3 py-2 text-center text-xs font-medium leading-tight text-brand-fg shadow-sm transition hover:bg-brand-primary hover:text-brand-fg disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-0 sm:flex-none sm:px-3 sm:py-1.5"
        >
          {qa.label}
        </button>
      ))}
    </div>
  );
}

export default function WidgetPage() {
  const [conversationId] = useState(newConversationId);
  const { messages, input, handleInputChange, handleSubmit, append, status, error } = useChat({
    api: "/api/chat",
    body: { conversationId },
  });
  const isBusy = status === "submitted" || status === "streaming";
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, status]);

  const lastMessage = messages[messages.length - 1];
  const showThinking = isBusy && (!lastMessage || lastMessage.role !== "assistant" || !lastMessage.content);
  const showNextActions =
    !isBusy && !error && messages.length > 0 && lastMessage?.role === "assistant" && Boolean(lastMessage.content);

  function handleChatSubmit(event: React.FormEvent<HTMLFormElement>) {
    if (isResetCommand(input)) {
      event.preventDefault();
      restartConversation();
      return;
    }
    handleSubmit(event);
  }

  return (
    <div className="flex h-dvh min-h-0 flex-col overflow-hidden bg-white text-brand-fg">
      <header className="flex items-center justify-between gap-2 bg-brand-dark px-3 py-2.5 sm:gap-3 sm:px-4 sm:py-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-brand bg-white p-1 shadow-sm sm:h-9 sm:w-9">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/dsf-middle-east.svg"
              alt="Digital Stallions Forum Middle East"
              className="h-full w-full object-contain"
            />
          </div>
          <div className="min-w-0">
            <div className="truncate text-[13px] font-semibold leading-tight text-brand-primary sm:text-sm">{UI_EN.title}</div>
            <div className="truncate text-[10px] leading-tight text-slate-400">{UI_EN.subtitle}</div>
          </div>
        </div>
        <button
          type="button"
          onClick={restartConversation}
          className="shrink-0 rounded-full border border-white/20 px-2.5 py-1.5 text-[10px] font-medium text-slate-300 transition hover:border-brand-primary hover:text-brand-primary"
        >
          {UI_EN.restart}
        </button>
      </header>

      <p className="border-b border-slate-200 bg-white px-3 py-2 text-[10px] leading-snug text-slate-500 sm:px-4 sm:text-[11px]">
        {UI_EN.disclosure}
      </p>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 sm:px-4 sm:py-4">
        <div className="space-y-3">
          <Bubble role="assistant" label={UI_EN.assistant}>
            {UI_EN.welcome}
          </Bubble>

          {messages.length === 0 && (
            <div className="pt-1">
              <ActionChips
                actions={QUICK_ACTIONS}
                disabled={isBusy}
                onAction={(send) => append({ role: "user", content: send })}
              />
            </div>
          )}

          {messages.map((m) =>
            m.role === "user" || m.role === "assistant" ? (
              m.content ? (
                <Bubble key={m.id} role={m.role} label={m.role === "user" ? UI_EN.you : UI_EN.assistant}>
                  <RichText text={m.content} />
                </Bubble>
              ) : null
            ) : null,
          )}

          {showThinking && (
            <Bubble role="assistant" label={UI_EN.assistant}>
              <TypingDots />
            </Bubble>
          )}

          {showNextActions && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                {UI_EN.nextStep}
              </p>
              <ActionChips
                actions={CONTINUE_ACTIONS}
                disabled={isBusy}
                onAction={(send) => append({ role: "user", content: send })}
              />
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-3">
              <p className="text-xs leading-relaxed text-red-700">{UI_EN.error}</p>
              <button
                type="button"
                onClick={restartConversation}
                className="mt-2 rounded-full border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-700 transition hover:bg-red-100"
              >
                {UI_EN.restartMenu}
              </button>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-2.5 py-2 sm:justify-between sm:px-3">
        <span className="hidden text-[10px] font-medium uppercase tracking-wider text-slate-400 sm:block">
          Navigation
        </span>
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <button
            type="button"
            onClick={restartConversation}
            className="flex-1 rounded-full border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-600 transition hover:border-brand-primary hover:text-brand-fg sm:flex-none sm:py-1.5"
          >
            {UI_EN.mainMenu}
          </button>
          <button
            type="button"
            onClick={restartConversation}
            className="flex-1 rounded-full border border-brand-primary bg-white px-3 py-2 text-xs font-medium text-brand-fg transition hover:bg-brand-primary sm:flex-none sm:py-1.5"
          >
            {UI_EN.startOver}
          </button>
        </div>
      </div>

      <form onSubmit={handleChatSubmit} className="flex items-center gap-2 border-t border-slate-200 bg-white p-2.5 sm:p-3">
        <input
          value={input}
          onChange={handleInputChange}
          placeholder={UI_EN.placeholder}
          maxLength={4000}
          autoComplete="off"
          className="min-w-0 flex-1 rounded-full border border-slate-300 px-3.5 py-2.5 text-sm outline-none transition focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 sm:px-4"
        />
        <button
          type="submit"
          disabled={isBusy || !input.trim()}
          className="shrink-0 rounded-full bg-brand-primary px-4 py-2.5 text-sm font-semibold text-brand-fg shadow-sm transition hover:bg-brand-primary-dark hover:text-white disabled:cursor-not-allowed disabled:opacity-40 sm:px-5"
        >
          {UI_EN.send}
        </button>
      </form>
    </div>
  );
}

/** Animated three-dot typing indicator (replaces the static "Checking…"). */
function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1 py-1" aria-label={UI_EN.thinking} role="status">
      <span className="h-1.5 w-1.5 rounded-full bg-brand-primary animate-typing-bounce" />
      <span className="h-1.5 w-1.5 rounded-full bg-brand-primary animate-typing-bounce [animation-delay:150ms]" />
      <span className="h-1.5 w-1.5 rounded-full bg-brand-primary animate-typing-bounce [animation-delay:300ms]" />
    </span>
  );
}

function Bubble({
  role,
  label,
  children,
}: {
  role: "user" | "assistant";
  label: string;
  children: React.ReactNode;
}) {
  const isUser = role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[92%] rounded-2xl px-3.5 py-2.5 text-sm shadow-bubble sm:max-w-[85%] ${
          isUser
            ? "rounded-br-md bg-brand-primary text-brand-fg"
            : "rounded-bl-md bg-slate-100 text-brand-fg ring-1 ring-slate-200"
        }`}
      >
        <div
          className={`mb-1 text-[10px] font-semibold uppercase tracking-wider ${
            isUser ? "text-brand-fg/60" : "text-slate-400"
          }`}
        >
          {label}
        </div>
        {children}
      </div>
    </div>
  );
}
