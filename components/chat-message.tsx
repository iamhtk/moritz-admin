"use client";

import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MatterReference } from "@/components/matter-reference";
import { useDashboardActions } from "@/components/actions-provider";
import type { LawyerLoad, MatterStatus, OverviewPayload } from "@/lib/supabase";
import { cn } from "cn";

export type ChatRole = "user" | "assistant";

export type ChatAction =
  | {
      kind: "assign";
      label: string;
      matterId: string;
      lawyerId?: string;
    }
  | { kind: "nudge"; label: string; matterId: string; lawyerName: string }
  | { kind: "reassign"; label: string; lawyerId: string };

export type ChatMessageData = {
  id: string;
  role: ChatRole;
  content: string;
  actions?: ChatAction[];
  error?: boolean;
  /** General legal-information answers are isolated from firm-grounded ones. */
  mode?: "firm" | "legal";
};

/** Turn MOR-#### mentions in assistant copy into Matters links. */
function linkMatterRefs(text: string): ReactNode {
  const parts = text.split(/(MOR-\d+)/gi);
  return parts.map((part, i) =>
    /^MOR-\d+$/i.test(part) ? (
      <MatterReference key={`${part}-${i}`} reference={part.toUpperCase()} />
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

function isAtRisk(m: MatterStatus): boolean {
  if (m.stage === "delivered") return false;
  if (m.risk === "breach") return true;
  return m.risk === "watch" && m.minutes_remaining <= 20;
}

/** After the stream completes, derive up to three grounded action rows. */
export function extractChatActions(
  text: string,
  payload: OverviewPayload
): ChatAction[] {
  const actions: ChatAction[] = [];
  const seen = new Set<string>();

  const refs = [...text.matchAll(/MOR-\d+/gi)].map((m) => m[0].toUpperCase());
  for (const ref of refs) {
    if (actions.length >= 3) break;
    if (seen.has(ref)) continue;
    const matter =
      payload.matters.find((m) => m.reference.toUpperCase() === ref) ??
      payload.deadlines.find((m) => m.reference.toUpperCase() === ref) ??
      payload.finance.unquoted.find((m) => m.reference.toUpperCase() === ref);
    if (!matter) continue;
    seen.add(ref);

    if (!matter.lawyer_id) {
      actions.push({ kind: "assign", label: matter.reference, matterId: matter.id });
    } else if (isAtRisk(matter)) {
      actions.push({
        kind: "nudge",
        label: matter.reference,
        matterId: matter.id,
        lawyerName: matter.lawyer_name ?? "the lawyer",
      });
    }
  }

  const lower = text.toLowerCase();
  const lawyers = [...payload.lawyers].sort(
    (a, b) => b.name.length - a.name.length
  );
  for (const lawyer of lawyers) {
    if (actions.length >= 3) break;
    if (!lower.includes(lawyer.name.toLowerCase())) continue;
    if (seen.has(lawyer.id)) continue;
    seen.add(lawyer.id);

    if (lawyer.capacityState === "over") {
      actions.push({
        kind: "reassign",
        label: lawyer.name,
        lawyerId: lawyer.id,
      });
      continue;
    }

    const matterId = unassignedForLawyer(lawyer, payload);
    if (matterId) {
      actions.push({
        kind: "assign",
        label: lawyer.name,
        matterId,
        lawyerId: lawyer.id,
      });
    }
  }

  return actions.slice(0, 3);
}

function unassignedForLawyer(
  lawyer: LawyerLoad,
  payload: OverviewPayload
): string | null {
  const pool = payload.matters.filter(
    (m) => !m.lawyer_id && m.fee > 0 && m.stage !== "delivered"
  );
  const match = pool.find((m) =>
    lawyer.practice_areas.includes(m.service_line)
  );
  return (match ?? pool[0])?.id ?? null;
}

export function ChatMessage({
  message,
  streaming,
  onRetry,
}: {
  message: ChatMessageData;
  streaming?: boolean;
  onRetry?: () => void;
}) {
  const { openAssign, openAssignForLawyer, nudgeMatter, nudgingMatterId } =
    useDashboardActions();

  if (message.role === "user") {
    return (
      <div className="space-y-1.5">
        <p
          className="font-medium text-text-tertiary"
          style={{ fontSize: "var(--text-11)" }}
        >
          You
        </p>
        <p
          className="leading-relaxed text-foreground"
          style={{ fontSize: "var(--text-13)" }}
        >
          {message.content}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <span
            className="flex size-5 shrink-0 items-center justify-center rounded-[6px] bg-muted font-semibold text-muted-foreground"
            style={{ fontSize: "var(--text-11)" }}
            aria-hidden
          >
            N
          </span>
          <p
            className="font-medium text-text-tertiary"
            style={{ fontSize: "var(--text-11)" }}
          >
            Nora
          </p>
          {message.mode === "legal" ? (
            <span
              className="rounded-md px-1.5 py-0.5 font-medium text-text-tertiary"
              style={{
                fontSize: "var(--text-11)",
                background: "var(--status-info-bg)",
              }}
            >
              General information
            </span>
          ) : null}
        </div>
        {message.mode === "legal" ? (
          <p
            className="text-text-tertiary"
            style={{ fontSize: "var(--text-11)" }}
            role="note"
          >
            General legal information, not legal advice. Not a substitute for
            advice from a qualified attorney.
          </p>
        ) : null}
        {streaming && !message.content ? (
          <div className="flex items-center gap-1 py-1" aria-hidden>
            <span className="typing-dot size-1.5 rounded-full bg-text-tertiary" />
            <span
              className="typing-dot size-1.5 rounded-full bg-text-tertiary"
              style={{ animationDelay: "160ms" }}
            />
            <span
              className="typing-dot size-1.5 rounded-full bg-text-tertiary"
              style={{ animationDelay: "320ms" }}
            />
          </div>
        ) : (
          <p
            className={cn(
              "whitespace-pre-wrap leading-relaxed text-foreground",
              message.error && "text-text-secondary"
            )}
            style={{ fontSize: "var(--text-13)" }}
          >
            {message.mode === "legal"
              ? message.content
              : linkMatterRefs(message.content)}
            {streaming && (
              <span
                aria-hidden
                className="ml-px inline-block h-[1em] w-px align-text-bottom text-text-tertiary opacity-70"
                style={{
                  background: "currentColor",
                  animation: "typing-dot 1.2s var(--motion-ease-in-out) infinite",
                  animationDelay: "0ms",
                }}
              />
            )}
          </p>
        )}
      </div>

      {message.error && onRetry ? (
        <Button type="button" size="sm" variant="outline" onClick={onRetry}>
          Retry
        </Button>
      ) : null}

      {message.mode !== "legal" &&
      message.actions &&
      message.actions.length > 0 ? (
        <ul className="space-y-0 overflow-hidden rounded-lg border border-border">
          {message.actions.map((action, i) => (
            <li
              key={`${action.kind}-${action.label}`}
              className={cn(
                "flex items-center justify-between gap-3 px-3 py-2.5",
                i > 0 && "border-t border-border"
              )}
            >
              <span
                className="truncate font-medium text-foreground"
                style={{ fontSize: "var(--text-12)" }}
              >
                {action.label}
              </span>
              {action.kind === "assign" ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    openAssign(action.matterId, "assign", {
                      preferredLawyerId: action.lawyerId,
                    })
                  }
                >
                  Assign
                </Button>
              ) : null}
              {action.kind === "nudge" ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={nudgingMatterId === action.matterId}
                  onClick={() =>
                    nudgeMatter({
                      matterId: action.matterId,
                      reference: action.label,
                      lawyerName: action.lawyerName,
                    })
                  }
                >
                  {nudgingMatterId === action.matterId ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" />
                      Nudge
                    </>
                  ) : (
                    "Nudge"
                  )}
                </Button>
              ) : null}
              {action.kind === "reassign" ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => openAssignForLawyer(action.lawyerId)}
                >
                  Reassign
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
