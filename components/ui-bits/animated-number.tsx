"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { cn } from "cn";
import { easeOut, motionDuration, transitionStandard } from "@/lib/motion";

/**
 * Count-up on first mount only; later value changes cross-fade.
 * Tween only — no spring/bounce.
 */
export function AnimatedNumber({
  value,
  className,
  format = (n: number) => String(Math.round(n)),
  risk,
}: {
  value: number;
  className?: string;
  format?: (n: number) => string;
  risk?: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const [display, setDisplay] = useState(value);
  const [swapKey, setSwapKey] = useState(0);
  const prev = useRef<number | null>(null);
  const counted = useRef(false);

  useEffect(() => {
    // Framer may report null before the preference is known — wait.
    if (reduceMotion === null) return;

    if (reduceMotion) {
      setDisplay(value);
      prev.current = value;
      counted.current = true;
      return;
    }

    if (!counted.current) {
      let raf = 0;
      let cancelled = false;
      const from = 0;
      const to = value;
      const start = performance.now();
      const dur = Math.min(900, 400 + Math.abs(to) * 8);
      setDisplay(0);
      const tick = (now: number) => {
        if (cancelled) return;
        const t = Math.min(1, (now - start) / dur);
        const e = 1 - Math.pow(1 - t, 3);
        setDisplay(from + (to - from) * e);
        if (t < 1) {
          raf = requestAnimationFrame(tick);
        } else {
          setDisplay(to);
          counted.current = true;
          prev.current = to;
        }
      };
      raf = requestAnimationFrame(tick);
      return () => {
        cancelled = true;
        cancelAnimationFrame(raf);
      };
    }

    if (prev.current !== value) {
      prev.current = value;
      setSwapKey((k) => k + 1);
      setDisplay(value);
    }
  }, [value, reduceMotion]);

  const riskStyle =
    risk && value > 0 ? ({ color: "var(--status-risk-fg)" } as const) : undefined;

  if (reduceMotion) {
    return (
      <span className={cn("num", className)} style={riskStyle}>
        {format(value)}
      </span>
    );
  }

  if (swapKey > 0) {
    return (
      <span className={cn("relative inline-flex", className)}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={swapKey}
            className="num inline-block"
            style={riskStyle}
            initial={{ opacity: 0, y: 3 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -3 }}
            transition={transitionStandard}
          >
            {format(value)}
          </motion.span>
        </AnimatePresence>
      </span>
    );
  }

  return (
    <motion.span
      className={cn("num", className)}
      style={riskStyle}
      initial={{ opacity: 0.45 }}
      animate={{ opacity: 1 }}
      transition={{ duration: motionDuration.standard, ease: easeOut }}
    >
      {format(display)}
    </motion.span>
  );
}

export function CrossfadeSwap({
  loading,
  skeleton,
  children,
  className,
}: {
  loading: boolean;
  skeleton: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  const reduceMotion = useReducedMotion();

  if (reduceMotion) {
    return <div className={className}>{loading ? skeleton : children}</div>;
  }

  return (
    <div className={cn("relative", className)}>
      <AnimatePresence mode="wait" initial={false}>
        {loading ? (
          <motion.div
            key="skeleton"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={transitionStandard}
          >
            {skeleton}
          </motion.div>
        ) : (
          <motion.div
            key="content"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={transitionStandard}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
