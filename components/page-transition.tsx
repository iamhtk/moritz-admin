"use client";

import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { easeOut, motionDuration } from "@/lib/motion";

/** Subtle route enter: fade + slight rise. Uses pathname as key. */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();

  if (reduceMotion) {
    return <>{children}</>;
  }

  return (
    <motion.div
      key={pathname}
      className="flex min-h-0 min-w-0 flex-1 flex-col"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: motionDuration.standard, ease: easeOut }}
    >
      {children}
    </motion.div>
  );
}
