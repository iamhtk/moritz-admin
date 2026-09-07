"use client";

import { useEffect } from "react";

const HIDE_AFTER_MS = 900;

/**
 * App-wide: native scrollbars stay hidden until a scroll container is
 * actively scrolled, then fade back out after idle. Pairs with the
 * `.is-scrolling` rules in globals.css. Containers marked `no-scrollbar`
 * (AutoHideScroll) keep their custom overlay thumb instead.
 */
export function ScrollbarsAutoHide() {
  useEffect(() => {
    const timers = new WeakMap<Element, ReturnType<typeof setTimeout>>();

    const onScroll = (event: Event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.classList.contains("no-scrollbar")) return;

      target.classList.add("is-scrolling");
      const prev = timers.get(target);
      if (prev) clearTimeout(prev);
      timers.set(
        target,
        setTimeout(() => {
          target.classList.remove("is-scrolling");
        }, HIDE_AFTER_MS)
      );
    };

    document.addEventListener("scroll", onScroll, {
      capture: true,
      passive: true,
    });
    return () => {
      document.removeEventListener("scroll", onScroll, true);
    };
  }, []);

  return null;
}
