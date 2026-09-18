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
            className="underline text-stallion-accent"
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
    <div className="flex h-full min-h-screen flex-col bg-white text-slate-900">
      <header className="border-b border-slate-200 bg-stallion px-4 py-3 text-white">
        <div className="text-sm font-semibold">{UI_EN.title}</div>
        <div className="text-xs text-slate-300">{UI_EN.subtitle}</div>
      </header>

      <p className="bg-slate-50 px-4 py-2 text-[11px] leading-snug text-slate-500">{UI_EN.disclosure}</p>

      <div className="flex-1 overflow-y-auto px-4 py-3">
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
                  className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs text-slate-700 hover:border-stallion-accent hover:text-stallion-accent disabled:opacity-50"
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
              <span className="text-slate-400">{UI_EN.thinking}</span>
            </Bubble>
          )}

          {error && <p className="text-xs text-red-600">{UI_EN.error}</p>}
          <div ref={bottomRef} />
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2 border-t border-slate-200 p-3">
        <input
          value={input}
          onChange={handleInputChange}
          placeholder={UI_EN.placeholder}
          maxLength={4000}
          autoComplete="off"
          className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-stallion-accent"
        />
        <button
          type="submit"
          disabled={isBusy || !input.trim()}
          className="rounded-md bg-stallion-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {UI_EN.send}
        </button>
      </form>
    </div>
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
        className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
          isUser ? "bg-stallion-accent text-white" : "bg-slate-100 text-slate-900"
        }`}
      >
        <div className={`mb-0.5 text-[10px] uppercase tracking-wide ${isUser ? "text-indigo-100" : "text-slate-400"}`}>
          {label}
        </div>
        {children}
      </div>
    </div>
  );
}
