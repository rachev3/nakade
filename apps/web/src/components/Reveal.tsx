import { motion } from 'motion/react'
import type * as React from 'react'
import { rise, smooth } from '@/lib/motion'

/** Fades a block in with a small rise. Use `index` to stagger lists (60ms apart, capped). */
export function Reveal({
  children,
  index = 0,
  className,
}: {
  children: React.ReactNode
  index?: number
  className?: string
}) {
  return (
    <motion.div
      {...rise}
      transition={smooth(0.35, Math.min(index, 8) * 0.06)}
      className={className}
    >
      {children}
    </motion.div>
  )
}
