import type { OverviewPayload } from "@/lib/supabase";

type Brief = NonNullable<OverviewPayload["ai"]["brief"]>;

const STORAGE_KEY = "moritz-brief-dismissed";

export function briefFingerprint(brief: Brief): string {
  const action = brief.action;
  return [
    brief.headline,
    brief.detail,
    action?.id ?? "",
    action?.matterId ?? "",
    action?.lawyerId ?? "",
  ].join("|");
}

export function readBriefDismissed(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function writeBriefDismissed(fingerprint: string) {
  try {
    window.localStorage.setItem(STORAGE_KEY, fingerprint);
  } catch {
    /* ignore quota / private mode */
  }
}
