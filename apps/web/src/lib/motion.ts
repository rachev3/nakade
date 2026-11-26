/**
 * Shared motion language: one easing curve, short durations, small distances.
 * Calm rather than bouncy. All Motion animations respect `prefers-reduced-motion` through
 * <MotionConfig reducedMotion="user"> (transforms are skipped, opacity fades stay).
 */
import type { Transition } from 'motion/react'

/** Soft ease-out ("easeOutQuint"-like). Mirrors --ease-smooth in styles/index.css. */
export const EASE = [0.22, 1, 0.36, 1] as const

export const DURATION = { fast: 0.15, base: 0.25, slow: 0.45 } as const

export const smooth = (duration: number = DURATION.base, delay = 0): Transition => ({
  duration,
  ease: EASE,
  delay,
})

/** Fade + 8px rise. Used for page and section entrances. */
export const rise = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
}
