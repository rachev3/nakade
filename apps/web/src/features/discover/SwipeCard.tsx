import { AlertTriangleIcon, CheckIcon, MinusIcon } from 'lucide-react'
import {
  motion,
  type PanInfo,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type Variants,
} from 'motion/react'
import { useTranslation } from 'react-i18next'
import type { Match, SwipeAction } from '@/api/types'
import { SettlementPhoto } from '@/components/SettlementPhoto'
import { PlaceHeading } from '@/components/PlaceHeading'
import { percent, placeName } from '@/lib/format'
import { cn } from '@/lib/utils'
import { smooth } from '@/lib/motion'

const THRESHOLD = 120

export type ExitDirection = -1 | 0 | 1

/** Where the waiting card sits behind the top one. The top card enters from here, so the
 *  hand-off looks like the stack moving up rather than a new card popping in. */
const STACKED = { scale: 0.94, y: 14, opacity: 0.7 }

/**
 * Exit depends on how the card left. AnimatePresence passes `custom` to exiting children, which
 * is the only way an already-removed card can know the direction.
 */
const cardVariants: Variants = {
  stacked: STACKED,
  top: { scale: 1, y: 0, opacity: 1, transition: smooth(0.35) },
  exit: (dir: ExitDirection) =>
    dir === 0
      ? { y: -28, scale: 0.97, opacity: 0, transition: smooth(0.3) }
      : {
          x: dir * 480,
          rotate: dir * 12,
          opacity: 0,
          transition: { x: smooth(0.4), rotate: smooth(0.4), opacity: smooth(0.25, 0.15) },
        },
}

/** Non-interactive copy of the next card, sitting behind the top one. */
export function StackedCard({ match }: { match: Match }) {
  return (
    <motion.div
      aria-hidden
      className="pointer-events-none absolute inset-0"
      initial={{ ...STACKED, opacity: 0 }}
      animate={STACKED}
      transition={smooth(0.35)}
    >
      <div className={cn('h-full', SHELL)}>
        <CardBody match={match} />
      </div>
    </motion.div>
  )
}

export function SwipeCard({
  match,
  onSwipe,
}: {
  match: Match
  onSwipe: (action: SwipeAction) => void
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
      className={cn('absolute inset-0 cursor-grab touch-pan-y select-none', SHELL)}
      style={{ x, rotate }}
      drag={reduced ? false : 'x'}
      dragSnapToOrigin
      dragElastic={0.6}
      dragTransition={{ bounceStiffness: 300, bounceDamping: 26 }}
      whileDrag={{ scale: 1.02, cursor: 'grabbing' }}
      onDragEnd={onDragEnd}
      variants={cardVariants}
      initial="stacked"
      animate="top"
      exit="exit"
    >
      <motion.span
        aria-hidden
        style={{ opacity: likeOpacity }}
        className="absolute top-5 left-5 z-10 -rotate-6 rounded-lg border-2 border-like bg-card/90 px-2 py-1 text-sm font-bold text-like uppercase"
      >
        {t('discover.like')}
      </motion.span>
      <motion.span
        aria-hidden
        style={{ opacity: nopeOpacity }}
        className="absolute top-5 right-5 z-10 rotate-6 rounded-lg border-2 border-dislike bg-card/90 px-2 py-1 text-sm font-bold text-dislike uppercase"
      >
        {t('discover.dislike')}
      </motion.span>

      <CardBody match={match} />
    </motion.article>
  )
}

const SHELL =
  'flex flex-col overflow-hidden rounded-3xl border bg-card shadow-[0_16px_40px_-16px_rgb(0_0_0/0.3)]'

function CardBody({ match }: { match: Match }) {
  const { t } = useTranslation()
  return (
    <>
      <div className="relative h-44 shrink-0">
        <SettlementPhoto ekatte={match.ekatte} type={match.settlement.type} linkCredit={false} />
        <span className="absolute bottom-3 left-4 rounded-full bg-card px-3 py-1 text-sm font-semibold">
          {t('discover.fit', { score: percent(match.score) })}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-5">
        <PlaceHeading place={match.settlement} as="h2" />
        <p className="font-serif text-[17px] leading-snug italic">{match.settlement.hook}</p>

        {!match.passes_constraints && (
          <p className="flex items-center gap-2 text-sm text-destructive">
            <AlertTriangleIcon aria-hidden className="size-4" />
            {t('discover.excluded')}
          </p>
        )}

        <ul className="space-y-1.5 text-[15px]">
          {match.reasons.slice(0, 2).map((r) => (
            <li key={r.text_key} className="flex items-center gap-2">
              <CheckIcon aria-hidden className="size-4 shrink-0 text-like" />
              {t(r.text_key, r.params ?? {})}
            </li>
          ))}
          {match.tradeoffs.slice(0, 1).map((r) => (
            <li key={r.text_key} className="flex items-center gap-2 text-muted-foreground">
              <MinusIcon aria-hidden className="size-4 shrink-0 text-clay" />
              {t(r.text_key, r.params ?? {})}
            </li>
          ))}
        </ul>
        <p className="mt-auto text-xs text-muted-foreground">
          {t('place.confidence', { value: percent(match.confidence) })}
        </p>
      </div>
    </>
  )
}
