"use client";

import { useEffect } from "react";
import { useDashboardActions } from "@/components/actions-provider";
import { CommandPalette } from "@/components/command-palette";
import { NewMatterSheet } from "@/components/new-matter-sheet";
import { ChatPanel } from "@/components/chat-panel";
import { shouldSuppressGlobalLetterShortcut } from "@/lib/keyboard";

/** Command palette, chat, and new-matter sheet. */
export function DashboardOverlays() {
  const {
    commandPaletteOpen,
    setCommandPaletteOpen,
    newMatterOpen,
    setNewMatterOpen,
    chatOpen,
    setChatOpen,
    openNewMatter,
  } = useDashboardActions();

  // Global single-letter: N → New matter (Gmail/Linear pattern).
  // Suppressed while typing, with modifiers, or while any overlay is open.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== "n") return;
      if (shouldSuppressGlobalLetterShortcut(e)) return;
      e.preventDefault();
      openNewMatter();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [openNewMatter]);

  return (
    <>
      <CommandPalette
        open={commandPaletteOpen}
        onOpenChange={setCommandPaletteOpen}
      />
      <ChatPanel open={chatOpen} onOpenChange={setChatOpen} />
      <NewMatterSheet open={newMatterOpen} onOpenChange={setNewMatterOpen} />
    </>
  );
}
