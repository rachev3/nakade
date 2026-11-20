import { AlertTriangleIcon, CheckIcon, MinusIcon } from 'lucide-react'
import { motion, type PanInfo, useMotionValue, useReducedMotion, useTransform } from 'motion/react'
import { useTranslation } from 'react-i18next'
import type { Match, SwipeAction } from '@/api/types'
import { PlaceHeading } from '@/components/PlaceHeading'
import { percent, placeName } from '@/lib/format'

const THRESHOLD = 120

export type ExitDirection = -1 | 0 | 1

export function SwipeCard({
  match,
  onSwipe,
  exitDirection,
}: {
  match: Match
  onSwipe: (action: SwipeAction) => void
  exitDirection: ExitDirection
}) {
  const { t, i18n } = useTranslation()
  const reduced = useReducedMotion()
  const x = useMotionValue(0)
  const rotate = useTransform(x, [-300, 300], [-12, 12])
  const likeOpacity = useTransform(x, [20, THRESHOLD], [0, 1])
  const nopeOpacity = useTransform(x, [-THRESHOLD, -20], [1, 0])

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x > THRESHOLD || info.velocity.x > 800) onSwipe('like')
    else if (info.offset.x < -THRESHOLD || info.velocity.x < -800) onSwipe('dislike')
  }

  return (
    <motion.article
      aria-roledescription="card"
      aria-label={placeName(match.settlement, i18n.language)}
      className="absolute inset-0 flex cursor-grab touch-pan-y flex-col gap-4 overflow-hidden rounded-2xl border bg-card p-6 shadow-lg select-none active:cursor-grabbing"
      style={{ x, rotate }}
      drag={reduced ? false : 'x'}
      dragSnapToOrigin
      dragElastic={0.7}
      onDragEnd={onDragEnd}
      initial={reduced ? { opacity: 0 } : { scale: 0.95, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={
        reduced || exitDirection === 0
          ? { opacity: 0, transition: { duration: 0.15 } }
          : { x: exitDirection * 600, opacity: 0, transition: { duration: 0.3 } }
      }
    >
      <motion.span
        aria-hidden
        style={{ opacity: likeOpacity }}
        className="absolute top-6 right-6 rounded-md border-2 border-like px-2 py-1 text-sm font-bold text-like uppercase"
      >
        {t('discover.like')}
      </motion.span>
      <motion.span
        aria-hidden
        style={{ opacity: nopeOpacity }}
        className="absolute top-6 right-6 rounded-md border-2 border-dislike px-2 py-1 text-sm font-bold text-dislike uppercase"
      >
        {t('discover.dislike')}
      </motion.span>

      {/* Placeholder for a photo until we have licensed images */}
      <div
        aria-hidden
        className="h-32 shrink-0 rounded-xl bg-gradient-to-br from-muted to-secondary"
      />

      <PlaceHeading place={match.settlement} as="h2" />
      <p className="text-base">{match.settlement.hook}</p>

      <p className="text-sm font-medium">
        {t('discover.fit', { score: percent(match.score) })}
        <span className="ml-2 font-normal text-muted-foreground">
          {t('place.confidence', { value: percent(match.confidence) })}
        </span>
      </p>

      {!match.passes_constraints && (
        <p className="flex items-center gap-2 text-sm text-destructive">
          <AlertTriangleIcon aria-hidden className="size-4" />
          {t('discover.excluded')}
        </p>
      )}

      <ul className="space-y-1 text-sm">
        {match.reasons.slice(0, 2).map((r) => (
          <li key={r.text_key} className="flex items-center gap-2">
            <CheckIcon aria-hidden className="size-4 text-like" />
            {t(r.text_key, r.params ?? {})}
          </li>
        ))}
        {match.tradeoffs.slice(0, 1).map((r) => (
          <li key={r.text_key} className="flex items-center gap-2 text-muted-foreground">
            <MinusIcon aria-hidden className="size-4" />
            {t(r.text_key, r.params ?? {})}
          </li>
        ))}
      </ul>
    </motion.article>
  )
}
