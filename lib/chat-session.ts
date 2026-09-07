/**
 * Ask panel conversation lives outside ChatPanel so opening Ask from the
 * command palette (which mounts/unmounts a Dialog) cannot wipe messages.
 */
export type StoredChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  mode?: "firm" | "legal";
  error?: boolean;
  actions?: unknown;
};

let firmMessages: StoredChatMessage[] = [];
let legalMessages: StoredChatMessage[] = [];
let askMode: "firm" | "legal" = "firm";

export function readFirmMessages<T extends StoredChatMessage>(): T[] {
  return firmMessages as T[];
}

export function writeFirmMessages<T extends StoredChatMessage>(next: T[]) {
  firmMessages = next;
}

export function readLegalMessages<T extends StoredChatMessage>(): T[] {
  return legalMessages as T[];
}

export function writeLegalMessages<T extends StoredChatMessage>(next: T[]) {
  legalMessages = next;
}

export function readAskMode(): "firm" | "legal" {
  return askMode;
}

export function writeAskMode(next: "firm" | "legal") {
  askMode = next;
}
