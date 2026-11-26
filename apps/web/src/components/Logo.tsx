import { useId } from 'react'
import { cn } from '@/lib/utils'

/**
 * nakade mark: the "n" as an arch / doorway with a sunrise over Rodopi hills and a road leading there
 * ("накъде" = "where to"). The arch follows the text colour (`currentColor`), so it adapts to the theme;
 * the view inside keeps the brand colours. Static files: public/brand/.
 */
export function LogoMark({ className }: { className?: string }) {
  const clip = useId()
  return (
    <svg viewBox="12 12 40 40" aria-hidden focusable="false" className={cn('shrink-0', className)}>
      <defs>
        <clipPath id={clip}>
          <path d="M22 52 V32 a10 10 0 0 1 20 0 V52Z" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clip})`}>
        <circle cx="32" cy="35" r="4.2" fill="var(--clay)" />
        <path d="M18 40 C 24 36, 30 37, 34 39.5 S 41 38, 46 37 V56 H18Z" fill="var(--sage-deep)" />
        <path d="M18 45 C 24 43, 29 44, 33 45.5 S 41 44, 46 43 V56 H18Z" fill="#2f6a4f" />
        <path
          d="M26 53 C 28.5 49.5, 34.5 48.5, 33 45.6 L 33.8 45.6 C 36 48.5, 32.5 50.5, 38.5 53Z"
          fill="var(--clay)"
        />
      </g>
      <path
        d="M12 52 V32 a20 20 0 0 1 40 0 V52 H42 V32 a10 10 0 0 0 -20 0 V52Z"
        fill="currentColor"
      />
    </svg>
  )
}
