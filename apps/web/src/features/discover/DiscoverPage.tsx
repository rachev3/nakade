import { BookmarkIcon, HeartIcon, InfoIcon, XIcon } from 'lucide-react'
import { AnimatePresence } from 'motion/react'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'
import { useMatches, useProfile, useRecordSwipe } from '@/api/queries'
import type { SwipeAction } from '@/api/types'
import { ErrorState, Loading } from '@/components/States'
import { UpgradeCard } from '@/components/UpgradeCard'
import { Button } from '@/components/ui/button'
import { type ExitDirection, StackedCard, SwipeCard } from './SwipeCard'

const EXIT: Record<SwipeAction, ExitDirection> = { like: 1, dislike: -1, save: 0 }

export default function DiscoverPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { data: profile } = useProfile()
  // Fetch once per visit; swiped cards are removed optimistically on the client.
  const matches = useMatches({ exclude_swiped: true })
  const swipe = useRecordSwipe()
  const [gone, setGone] = useState<string[]>([])
  const [exitDirection, setExitDirection] = useState<ExitDirection>(0)

  const deck = (matches.data ?? []).filter((m) => !gone.includes(m.ekatte))
  const top = deck[0]
  const next = deck[1]

  const act = useCallback(
    (action: SwipeAction) => {
      if (!top) return
      setExitDirection(EXIT[action])
      setGone((g) => [...g, top.ekatte])
      swipe.mutate({ ekatte: top.ekatte, action })
    },
    [top, swipe],
  )

  // Keyboard equivalents: ← dislike, → like, S save, Enter details.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (
        e.metaKey ||
        e.ctrlKey ||
        e.altKey ||
        target.closest('input, textarea, select, [role="dialog"]')
      )
        return
      if (e.key === 'ArrowLeft') act('dislike')
      else if (e.key === 'ArrowRight') act('like')
      else if (e.key.toLowerCase() === 's') act('save')
      else if (e.key === 'Enter' && top && target === document.body)
        void navigate(`/places/${top.ekatte}`)
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [act, navigate, top])

  if (matches.isPending) return <Loading />
  if (matches.isError) return <ErrorState onRetry={() => void matches.refetch()} />

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4">
      <h1 className="sr-only">{t('discover.title')}</h1>
      {profile?.completeness === 'none' && (
        <Button
          asChild
          variant="outline"
          className="h-auto min-h-11 py-2 text-center whitespace-normal"
        >
          <Link to="/profile/quick">{t('discover.personalise')}</Link>
        </Button>
      )}

      <div className="relative h-[33rem]" aria-live="polite">
        {next && <StackedCard key={`stack-${next.ekatte}`} match={next} />}
        <AnimatePresence custom={exitDirection} initial={false}>
          {top ? (
            <SwipeCard key={top.ekatte} match={top} onSwipe={act} />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-4 rounded-2xl border border-dashed text-center">
              <p>{t('discover.empty')}</p>
              <Button asChild>
                <Link to="/saved">{t('discover.emptyCta')}</Link>
              </Button>
            </div>
          )}
        </AnimatePresence>
      </div>

      {top && (
        <>
          <div className="flex items-center justify-center gap-3">
            <Button
              variant="outline"
              size="icon"
              className="size-16 rounded-full border-2 border-dislike/50 hover:bg-dislike/10 active:scale-90"
              aria-label={t('discover.dislike')}
              aria-keyshortcuts="ArrowLeft"
              onClick={() => act('dislike')}
            >
              <XIcon className="size-7 text-dislike" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-12 rounded-full"
              aria-label={t('discover.save')}
              aria-keyshortcuts="S"
              onClick={() => act('save')}
            >
              <BookmarkIcon className="size-5" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-12 rounded-full"
              aria-label={t('discover.details')}
              asChild
            >
              <Link to={`/places/${top.ekatte}`} aria-keyshortcuts="Enter">
                <InfoIcon className="size-5" />
              </Link>
            </Button>
            <Button
              size="icon"
              className="size-16 rounded-full active:scale-90"
              aria-label={t('discover.like')}
              aria-keyshortcuts="ArrowRight"
              onClick={() => act('like')}
            >
              <HeartIcon className="size-7" />
            </Button>
          </div>
          <p className="hidden text-center text-xs text-muted-foreground sm:block">
            {t('discover.keyboardHint')}
          </p>
        </>
      )}
      <UpgradeCard />
    </div>
  )
}
