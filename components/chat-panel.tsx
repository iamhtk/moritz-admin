"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUp, Square } from "lucide-react";
import { transitionStandard } from "@/lib/motion";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  ChatMessage,
  extractChatActions,
  type ChatMessageData,
} from "@/components/chat-message";
import { useOverview } from "@/hooks/use-overview";
import { useDashboardActions } from "@/components/actions-provider";
import type { OverviewPayload, ServiceLine } from "@/lib/supabase";
import { cn } from "cn";
import { useSheetSide } from "@/hooks/use-sheet-side";
import { SheetHandle } from "@/components/sheet-handle";
import {
  readAskMode,
  readFirmMessages,
  readLegalMessages,
  writeAskMode,
  writeFirmMessages,
  writeLegalMessages,
} from "@/lib/chat-session";

type ApiMessage = { role: "user" | "assistant"; content: string };

function formatUpdatedAt(iso: string | undefined): string {
  if (!iso) return "just now";
  return new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function topServiceLine(payload: OverviewPayload): ServiceLine {
  const counts = new Map<ServiceLine, number>();
  for (const m of payload.matters) {
    if (m.stage === "delivered") continue;
    counts.set(m.service_line, (counts.get(m.service_line) ?? 0) + 1);
  }
  let best: ServiceLine = "Commercial";
  let max = -1;
  for (const [line, n] of counts) {
    if (n > max) {
      max = n;
      best = line;
    }
  }
  return best;
}

function turnaroundPrompt(payload: OverviewPayload): string {
  const thisWeek = payload.finance.turnaroundThisWeek;
  const lastWeek = payload.finance.turnaroundLastWeek;

  if (
    thisWeek &&
    lastWeek &&
    thisWeek.avgMinutes > lastWeek.avgMinutes
  ) {
    return "Why is turnaround slower this week?";
  }
  return "What is our average turnaround this week?";
}

function buildSuggestions(payload: OverviewPayload | undefined): string[] {
  if (!payload) {
    return ["Show me everything at risk."];
  }
  return [
    `Who can take a ${topServiceLine(payload)} matter in the next hour?`,
    turnaroundPrompt(payload),
    "Show me everything at risk.",
  ];
}

export function ChatPanel({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data } = useOverview();
  const { assignSheetOpen } = useDashboardActions();
  const side = useSheetSide();
  const [input, setInput] = useState("");
  const [askMode, setAskMode] = useState<"firm" | "legal">(() => readAskMode());
  const [firmMessages, setFirmMessages] = useState<ChatMessageData[]>(() =>
    readFirmMessages<ChatMessageData>()
  );
  const [legalMessages, setLegalMessages] = useState<ChatMessageData[]>(() =>
    readLegalMessages<ChatMessageData>()
  );
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const askModeRef = useRef(askMode);
  const firmMessagesRef = useRef(firmMessages);
  const legalMessagesRef = useRef(legalMessages);

  const messages = askMode === "firm" ? firmMessages : legalMessages;
  const empty = messages.length === 0;

  useEffect(() => {
    askModeRef.current = askMode;
    writeAskMode(askMode);
  }, [askMode]);

  useEffect(() => {
    firmMessagesRef.current = firmMessages;
    writeFirmMessages(firmMessages);
  }, [firmMessages]);

  useEffect(() => {
    legalMessagesRef.current = legalMessages;
    writeLegalMessages(legalMessages);
  }, [legalMessages]);

  useEffect(() => {
    const el = listRef.current;
    if (!el || empty) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, streamingId, empty, askMode]);

  const suggestions = useMemo(() => {
    if (askMode === "legal") {
      return [
        "What is a force majeure clause?",
        "What does indemnification mean in a contract?",
        "What is a data processing agreement?",
      ];
    }
    return buildSuggestions(data);
  }, [data, askMode]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStreamingId(null);
  }, []);

  const setActiveMessages = useCallback(
    (updater: (prev: ChatMessageData[]) => ChatMessageData[]) => {
      if (askModeRef.current === "legal") {
        setLegalMessages(updater);
      } else {
        setFirmMessages(updater);
      }
    },
    []
  );

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || abortRef.current) return;

      const mode = askModeRef.current;
      setInput("");

      const userMsg: ChatMessageData = {
        id: `u-${Date.now()}`,
        role: "user",
        content: trimmed,
        mode,
      };
      const assistantId = `a-${Date.now()}`;
      const assistantMsg: ChatMessageData = {
        id: assistantId,
        role: "assistant",
        content: "",
        mode,
      };

      const prior =
        mode === "legal" ? legalMessagesRef.current : firmMessagesRef.current;
      const history: ApiMessage[] = [...prior, userMsg]
        .filter(
          (m) => m.role === "user" || (m.role === "assistant" && m.content)
        )
        .map((m) => ({ role: m.role, content: m.content }));

      setActiveMessages((prev) => [...prev, userMsg, assistantMsg]);
      setStreamingId(assistantId);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch("/api/ask", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: history, mode }),
          signal: controller.signal,
        });

        if (!res.ok || !res.body) {
          const errText =
            (await res.text().catch(() => "")) ||
            "Couldn't reach the assistant. Try again.";
          setActiveMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, content: errText, error: true, mode }
                : m
            )
          );
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let full = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          full += decoder.decode(value, { stream: true });
          const snapshot = full;
          setActiveMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, content: snapshot, mode }
                : m
            )
          );
        }

        const actions =
          mode === "firm" && data ? extractChatActions(full, data) : [];
        setActiveMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: full, actions, mode }
              : m
          )
        );
      } catch (e) {
        if ((e as Error).name === "AbortError") {
          // Keep partial text; append nothing.
        } else {
          setActiveMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? {
                    ...m,
                    content: "Couldn't reach the assistant. Try again.",
                    error: true,
                    mode,
                  }
                : m
            )
          );
        }
      } finally {
        abortRef.current = null;
        setStreamingId(null);
      }
    },
    [data, setActiveMessages]
  );

  const retryLast = useCallback(() => {
    const mode = askModeRef.current;
    const prev =
      mode === "legal" ? legalMessagesRef.current : firmMessagesRef.current;
    let lastUser = "";
    const next = [...prev];
    if (next.at(-1)?.role === "assistant") next.pop();
    const user = next.at(-1);
    if (user?.role === "user") {
      lastUser = user.content;
      next.pop();
    }
    if (mode === "legal") setLegalMessages(next);
    else setFirmMessages(next);
    if (lastUser) void send(lastUser);
  }, [send]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send(input);
    }
  };

  const switchMode = (next: "firm" | "legal") => {
    if (next === askMode) return;
    stop();
    setAskMode(next);
  };

  const composer = (
    <div className="shrink-0 border-t border-border px-5 py-3">
      {askMode === "legal" ? (
        <p
          className="mb-2 text-text-tertiary"
          style={{ fontSize: "var(--text-11)" }}
          role="note"
        >
          General legal information, not legal advice. Not a substitute for
          advice from a qualified attorney.
        </p>
      ) : null}
      <div
        className={cn(
          "flex min-w-0 items-end gap-1.5 rounded-xl border border-input bg-card/40 p-1.5",
          "transition-[border-color,box-shadow] duration-150 ease-out",
          "focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50"
        )}
      >
        <div className="min-w-0 flex-1">
          <label htmlFor="chat-ask" className="sr-only">
            {askMode === "legal"
              ? "Ask a general legal information question"
              : "Ask about the firm"}
          </label>
          <Textarea
            id="chat-ask"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={
              askMode === "legal"
                ? "Ask for a general legal definition…"
                : "Ask about matters, lawyers, or the month."
            }
            rows={1}
            className="max-h-[4.5rem] min-h-8 w-full resize-none overflow-y-auto border-0 bg-transparent px-1.5 py-1.5 shadow-none focus-visible:border-transparent focus-visible:ring-0"
            style={{ fontSize: "var(--text-13)" }}
            aria-describedby="chat-ask-hint"
          />
          <p id="chat-ask-hint" className="sr-only">
            Press Enter to send. Shift+Enter for a new line.
          </p>
        </div>
        <AnimatePresence mode="wait" initial={false}>
          {streamingId ? (
            <motion.div
              key="stop"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={transitionStandard}
            >
              <Button
                type="button"
                size="icon"
                variant="outline"
                className="mb-0.5 shrink-0 min-h-11 min-w-11 md:min-h-8 md:min-w-8"
                aria-label="Stop generating"
                onClick={stop}
              >
                <Square className="size-3.5 fill-current" aria-hidden />
              </Button>
            </motion.div>
          ) : (
            <motion.div
              key="send"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={transitionStandard}
            >
              <Button
                type="button"
                size="icon"
                className="mb-0.5 shrink-0 min-h-11 min-w-11 md:min-h-8 md:min-w-8"
                disabled={!input.trim()}
                aria-label="Send message"
                onClick={() => void send(input)}
              >
                <ArrowUp className="size-4" aria-hidden />
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        // Assign opens as a sibling sheet; Radix dismisses this one on the
        // outside pointer. Keep Ask mounted so the conversation survives.
        if (!next && assignSheetOpen) return;
        onOpenChange(next);
      }}
    >
      <SheetContent
        side={side}
        className={cn(
          "gap-0 border-0 p-0",
          side === "right" &&
            "h-full w-[400px] max-w-[400px] border-l sm:max-w-[400px]",
          side === "bottom" && "h-[85vh] max-h-[85vh] w-full border-t"
        )}
      >
        <div className="flex h-full min-h-0 w-full flex-col overflow-hidden">
          <SheetHandle visible={side === "bottom"} />
          <SheetHeader className="shrink-0 border-b border-border px-5 py-4 text-left">
            <SheetTitle style={{ fontSize: "var(--text-14)" }}>
              {askMode === "legal"
                ? "General legal information"
                : "Ask about the firm"}
            </SheetTitle>
            <SheetDescription
              className="text-text-tertiary"
              style={{ fontSize: "var(--text-11)" }}
            >
              {askMode === "legal" ? (
                <>
                  General legal information, not legal advice. Not a substitute
                  for advice from a qualified attorney.
                </>
              ) : (
                <>
                  Answers come from this firm&apos;s live data. Updated{" "}
                  {formatUpdatedAt(data?.generatedAt)}.
                </>
              )}
            </SheetDescription>
            <div
              className="mt-3 flex gap-1 rounded-lg border border-border p-0.5"
              role="tablist"
              aria-label="Ask mode"
            >
              <button
                type="button"
                role="tab"
                aria-selected={askMode === "firm"}
                className={cn(
                  "min-h-8 flex-1 rounded-md px-2 py-1.5 text-center transition-colors",
                  askMode === "firm"
                    ? "bg-muted font-medium text-foreground"
                    : "text-text-tertiary hover:text-foreground"
                )}
                style={{ fontSize: "var(--text-11)" }}
                onClick={() => switchMode("firm")}
              >
                Firm data
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={askMode === "legal"}
                className={cn(
                  "min-h-8 flex-1 rounded-md px-2 py-1.5 text-center transition-colors",
                  askMode === "legal"
                    ? "bg-muted font-medium text-foreground"
                    : "text-text-tertiary hover:text-foreground"
                )}
                style={{ fontSize: "var(--text-11)" }}
                onClick={() => switchMode("legal")}
              >
                General information
              </button>
            </div>
          </SheetHeader>

          {empty ? (
            <div className="flex min-h-0 flex-1 flex-col justify-center overflow-y-auto px-5 py-6">
              <div className="mx-auto flex w-full max-w-sm flex-col gap-6">
                <div className="space-y-1 text-center">
                  <p
                    className="font-medium text-foreground"
                    style={{ fontSize: "var(--text-14)" }}
                  >
                    {askMode === "legal"
                      ? "Ask for general legal information"
                      : "Ask about the firm"}
                  </p>
                  <p
                    className="text-text-tertiary"
                    style={{ fontSize: "var(--text-12)" }}
                  >
                    {askMode === "legal" ? (
                      <>
                        You&apos;re chatting with Nora in general-information
                        mode. This is not legal advice.
                      </>
                    ) : (
                      <>
                        You&apos;re chatting with Nora, grounded in this
                        firm&apos;s live data.
                      </>
                    )}
                  </p>
                </div>
                <div className="flex flex-col gap-2">
                  <p
                    className="text-text-tertiary"
                    style={{ fontSize: "var(--text-11)" }}
                  >
                    Try asking
                  </p>
                  {suggestions.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      className="flex min-h-14 w-full items-center rounded-lg border border-border bg-card/60 px-3 py-2.5 text-left text-text-secondary hover:bg-surface-hover"
                      style={{ fontSize: "var(--text-12)" }}
                      onClick={() => void send(prompt)}
                    >
                      <span className="line-clamp-2">{prompt}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div
              ref={listRef}
              className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-5 py-4"
              aria-live="polite"
              aria-relevant="additions text"
            >
              {messages.map((m) => (
                <ChatMessage
                  key={m.id}
                  message={m}
                  streaming={m.id === streamingId}
                  onRetry={m.error ? retryLast : undefined}
                />
              ))}
            </div>
          )}
          {composer}
        </div>
      </SheetContent>
    </Sheet>
  );
}
