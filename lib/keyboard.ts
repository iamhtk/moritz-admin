/** True when the event target is (or is inside) a typing surface. */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const el =
    target.closest(
      "input, textarea, select, [contenteditable=''], [contenteditable=true]"
    ) ?? target;
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName.toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "select") return true;
  return el.isContentEditable;
}

/**
 * True when a sheet, dialog, command palette, menu, or select is open,
 * or when focus is inside one of those overlays.
 */
export function isUiOverlayOpen(): boolean {
  if (
    document.querySelector(
      [
        '[role="dialog"][data-state="open"]',
        '[role="alertdialog"][data-state="open"]',
        '[role="menu"][data-state="open"]',
        '[role="listbox"][data-state="open"]',
        '[data-slot="sheet-content"][data-state="open"]',
        '[data-slot="dialog-content"][data-state="open"]',
        '[data-slot="dropdown-menu-content"][data-state="open"]',
        '[data-slot="select-content"][data-state="open"]',
        "[cmdk-dialog]",
      ].join(", ")
    )
  ) {
    return true;
  }

  const active = document.activeElement;
  if (!(active instanceof HTMLElement)) return false;
  return Boolean(
    active.closest(
      [
        '[role="dialog"]',
        '[role="alertdialog"]',
        '[role="menu"]',
        '[role="listbox"]',
        '[data-slot="sheet-content"]',
        '[data-slot="dialog-content"]',
        '[data-slot="dropdown-menu-content"]',
        '[data-slot="select-content"]',
        "[cmdk-root]",
      ].join(", ")
    )
  );
}

/**
 * Single-letter global shortcuts must not run while typing, with modifiers,
 * or while an overlay owns the UI.
 */
export function shouldSuppressGlobalLetterShortcut(
  e: KeyboardEvent
): boolean {
  if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return true;
  if (isEditableTarget(e.target)) return true;
  if (isUiOverlayOpen()) return true;
  return false;
}
