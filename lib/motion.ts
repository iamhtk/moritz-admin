/**
 * Shared motion system — durations (seconds for Framer, ms for CSS) and
 * cubic-bezier easings. No spring/bounce. Prefer the subtler option.
 *
 * CSS mirrors live in globals.css as --motion-*.
 */
export const motionDuration = {
  /** Most UI transitions */
  standard: 0.18,
  /** Slightly snappier micro-interactions */
  fast: 0.15,
  /** Sheets, larger panel moves */
  deliberate: 0.28,
  /** Background tint settle after data refresh */
  settle: 1.4,
} as const;

export const motionDurationMs = {
  standard: 180,
  fast: 150,
  deliberate: 280,
  settle: 1400,
} as const;

/** ease-out — enters / appears */
export const easeOut = [0.16, 1, 0.3, 1] as const;
/** ease-in — exits / leaves */
export const easeIn = [0.4, 0, 1, 1] as const;
/** ease-in-out — morphs between peers */
export const easeInOut = [0.4, 0, 0.2, 1] as const;

export const transitionStandard = {
  duration: motionDuration.standard,
  ease: easeOut,
} as const;

export const transitionDeliberate = {
  duration: motionDuration.deliberate,
  ease: easeOut,
} as const;

export const transitionExit = {
  duration: motionDuration.fast,
  ease: easeIn,
} as const;

export const transitionSettle = {
  duration: motionDuration.settle,
  ease: easeOut,
} as const;
