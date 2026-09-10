export { cn } from "cn";

/** Platform modifier key label for shortcut hints (⌘ on Apple, Ctrl elsewhere). */
export function modKeyLabel() {
  if (typeof navigator === "undefined") return "⌘";
  const plat = navigator.platform || "";
  const ua = navigator.userAgent || "";
  const isApple = /Mac|iPhone|iPad|iPod/.test(plat) || /Mac OS/.test(ua);
  return isApple ? "⌘" : "Ctrl";
}
