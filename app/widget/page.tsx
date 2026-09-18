"use client";

/**
 * The chat widget. Rendered inside an iframe injected by public/embed.js (or
 * visited directly at /widget). Talks to the server ONLY through /api/chat.
 *
 * The event is pinned server-side; the widget never chooses or sends one. It
 * generates a conversation id once so all turns attach to one conversation.
 */
import { useChat } from "@ai-sdk/react";
import { useEffect, useRef, useState } from "react";
import { QUICK_ACTIONS } from "@/lib/types";

// UI strings as data so a second language can be added by translation only.
const UI_EN = {
  title: "Stallion AI Assistant",
  subtitle: "AI chatbot by Digital Stallion",
  disclosure:
    "You're chatting with an AI assistant. It shares only confirmed event information and can connect you with the team for anything else.",
  welcome: "Hi! I'm the Stallion AI Assistant. How can I help you with the awards today?",
  placeholder: "Ask about the event, categories, or how to nominate…",
  send: "Send",
  thinking: "Checking…",
  error: "Something went wrong. Please try again, or ask to speak with the team.",
  you: "You",
  assistant: "Assistant",
};

function newConversationId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  // Non-secure-context fallback (plain http embeds). Only needs to be unique.
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/** Render plain text with newlines preserved and bare URLs made clickable. */
function RichText({ text }: { text: string }) {
  const pieces = text.split(/(https?:\/\/[^\s<>)]+)/g);
  return (
    <span className="whitespace-pre-wrap break-words">
      {pieces.map((piece, i) =>
        /^https?:\/\//.test(piece) ? (
          <a
            key={i}
            href={piece}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-brand-primary-dark underline"
          >
            {piece}
          </a>
        ) : (
          <span key={i}>{piece}</span>
        ),
      )}
    </span>
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

  return (
    <div className="flex h-full min-h-screen flex-col bg-white text-brand-fg">
      <header className="flex items-center gap-3 bg-brand-dark px-4 py-3">
        {/* White rounded tile — the brand mark is a white-background JPG, so it
            never sits flat on the black header. */}
        <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-brand bg-white p-1 shadow-sm">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/mark-2026.jpg"
            alt="The Great Marketing &amp; Business Minds UAE 2026"
            className="h-full w-full object-contain"
          />
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold leading-tight text-brand-primary">{UI_EN.title}</div>
          <div className="truncate text-xs text-white/60">{UI_EN.subtitle}</div>
        </div>
      </header>

      <p className="border-b border-slate-200 bg-white px-4 py-2 text-[11px] leading-snug text-slate-500">
        {UI_EN.disclosure}
      </p>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="space-y-3">
          <Bubble role="assistant" label={UI_EN.assistant}>
            {UI_EN.welcome}
          </Bubble>

          {messages.length === 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {QUICK_ACTIONS.map((qa) => (
                <button
                  key={qa.label}
                  type="button"
                  disabled={isBusy}
                  onClick={() => append({ role: "user", content: qa.send })}
                  className="rounded-full border border-brand-primary bg-white px-3 py-1.5 text-xs font-medium text-brand-fg shadow-sm transition hover:bg-brand-primary hover:text-brand-fg disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {qa.label}
                </button>
              ))}
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

          {error && <p className="text-xs text-red-600">{UI_EN.error}</p>}
          <div ref={bottomRef} />
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex items-center gap-2 border-t border-slate-200 bg-white p-3">
        <input
          value={input}
          onChange={handleInputChange}
          placeholder={UI_EN.placeholder}
          maxLength={4000}
          autoComplete="off"
          className="flex-1 rounded-full border border-slate-300 px-4 py-2.5 text-sm outline-none transition focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
        />
        <button
          type="submit"
          disabled={isBusy || !input.trim()}
          className="shrink-0 rounded-full bg-brand-primary px-5 py-2.5 text-sm font-semibold text-brand-fg shadow-sm transition hover:bg-brand-primary-dark hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
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
        className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm shadow-bubble ${
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
