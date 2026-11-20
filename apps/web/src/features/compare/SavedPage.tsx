import { MedalIcon, TrophyIcon } from 'lucide-react'
import { motion } from 'motion/react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { useMatches, useSaved } from '@/api/queries'
import type { Match } from '@/api/types'
import { PlaceHeading } from '@/components/PlaceHeading'
import { ErrorState, Loading } from '@/components/States'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { percent, placeName } from '@/lib/format'
import { rise, smooth } from '@/lib/motion'
import { cn } from '@/lib/utils'

const MAX_COMPARE = 3
const SORTS = ['score', 'recent'] as const
const KINDS = ['all', 'like', 'save'] as const
const TYPES = ['all', 'town', 'village'] as const

/** Gold, silver, bronze for the three best saved places. */
const PODIUM = [
  { color: '#c9a227', Icon: TrophyIcon },
  { color: '#9aa3a8', Icon: MedalIcon },
  { color: '#b0713f', Icon: MedalIcon },
] as const

export default function SavedPage() {
  const { t, i18n } = useTranslation()
  const saved = useSaved()
  const ekatte = (saved.data ?? []).map((s) => s.settlement.ekatte)
  // Scores of the saved places for the current profile (same engine as everywhere else).
  const matches = useMatches({ ekatte, limit: 100 }, ekatte.length > 0)
  const [selected, setSelected] = useState<string[]>([])
  const [sort, setSort] = useState<(typeof SORTS)[number]>('score')
  const [kind, setKind] = useState<(typeof KINDS)[number]>('all')
  const [type, setType] = useState<(typeof TYPES)[number]>('all')

  if (saved.isPending) return <Loading />
  if (saved.isError) return <ErrorState onRetry={() => void saved.refetch()} />

  const byEkatte = new Map<string, Match>((matches.data ?? []).map((m) => [m.ekatte, m]))
  const score = (e: string) => byEkatte.get(e)?.score ?? -1

  // Top 3 = the best scores among places that pass the must-haves, whatever the filters show.
  const podium = saved.data
    .filter((s) => byEkatte.get(s.settlement.ekatte)?.passes_constraints)
    .sort((a, b) => score(b.settlement.ekatte) - score(a.settlement.ekatte))
    .slice(0, 3)
    .map((s) => s.settlement.ekatte)

  const list = saved.data
    .map((s, recent) => ({ ...s, recent }))
    .filter((s) => kind === 'all' || s.action === kind)
    .filter((s) => type === 'all' || s.settlement.type === type)
    .sort((a, b) =>
      sort === 'score'
        ? score(b.settlement.ekatte) - score(a.settlement.ekatte)
        : a.recent - b.recent,
    )

  const toggle = (e: string, on: boolean) =>
    setSelected((s) => (on ? (s.length < MAX_COMPARE ? [...s, e] : s) : s.filter((x) => x !== e)))

  const chip = (active: boolean) =>
    cn(
      'inline-flex min-h-9 items-center rounded-full border px-3.5 text-sm transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
      active
        ? 'border-primary bg-primary text-primary-foreground'
        : 'border-input bg-card hover:border-primary/40 hover:bg-accent',
    )
  const group = <T extends string>(
    label: string,
    values: readonly T[],
    value: T,
    onPick: (v: T) => void,
    text: (v: T) => string,
  ) => (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap items-center gap-2">
      <span className="mr-1 text-sm text-muted-foreground">{label}:</span>
      {values.map((v) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={value === v}
          onClick={() => onPick(v)}
          className={chip(value === v)}
        >
          {text(v)}
        </button>
      ))}
    </div>
  )

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl sm:text-4xl">{t('saved.title')}</h1>
        {saved.data.length > 1 &&
          (selected.length >= 2 ? (
            <Button asChild>
              <Link to={`/compare?ids=${selected.join(',')}`}>
                {t('saved.compare', { count: selected.length })}
              </Link>
            </Button>
          ) : (
            <p className="text-sm text-muted-foreground">{t('saved.pickTwo')}</p>
          ))}
      </div>

      {saved.data.length === 0 ? (
        <p className="text-muted-foreground">{t('saved.empty')}</p>
      ) : (
        <>
          <div className="flex flex-col gap-3">
            {group(t('saved.filters.sort'), SORTS, sort, setSort, (v) => t(`saved.filters.${v}`))}
            {group(t('saved.filters.show'), KINDS, kind, setKind, (v) =>
              v === 'all'
                ? t('saved.filters.all')
                : t(v === 'save' ? 'saved.saved' : 'saved.liked'),
            )}
            {group(t('saved.filters.type'), TYPES, type, setType, (v) =>
              v === 'all' ? t('saved.filters.all') : t(`map.filters.${v}`),
            )}
          </div>

          {list.length === 0 ? (
            <p className="text-muted-foreground">{t('saved.filters.empty')}</p>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2">
              {list.map(({ settlement, action }, i) => {
                const name = placeName(settlement, i18n.language)
                const checked = selected.includes(settlement.ekatte)
                const match = byEkatte.get(settlement.ekatte)
                const rank = podium.indexOf(settlement.ekatte)
                const medal = rank >= 0 ? PODIUM[rank] : undefined
                return (
                  <motion.li
                    key={settlement.ekatte}
                    {...rise}
                    transition={smooth(0.35, Math.min(i, 8) * 0.06)}
                  >
                    <Card
                      className="h-full"
                      style={medal ? { borderColor: medal.color, borderWidth: 2 } : undefined}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-2">
                          {medal && (
                            <span
                              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold text-white"
                              style={{ background: medal.color }}
                            >
                              <medal.Icon aria-hidden className="size-3.5" />
                              {t('saved.top', { rank: rank + 1 })}
                            </span>
                          )}
                          <PlaceHeading place={settlement} as="h2" />
                        </div>
                        <Checkbox
                          checked={checked}
                          disabled={!checked && selected.length >= MAX_COMPARE}
                          onCheckedChange={(v) => toggle(settlement.ekatte, v === true)}
                          aria-label={t('saved.select', { name })}
                        />
                      </div>
                      <p className="text-sm">{settlement.hook}</p>
                      {match && (
                        <p className="text-sm">
                          <span className="text-2xl font-semibold tabular-nums">
                            {percent(match.score)}%
                          </span>{' '}
                          <span className="text-muted-foreground">{t('saved.fit')}</span>
                          {!match.passes_constraints && (
                            <span className="block text-xs text-muted-foreground">
                              {match.excluded_because?.map((e) => t(e.text_key)).join(' · ')}
                            </span>
                          )}
                        </p>
                      )}
                      <div className="mt-auto flex items-center justify-between">
                        <Badge variant="secondary">
                          {t(action === 'save' ? 'saved.saved' : 'saved.liked')}
                        </Badge>
                        <Button asChild variant="link" className="px-0">
                          <Link to={`/places/${settlement.ekatte}`}>{t('discover.details')} →</Link>
                        </Button>
                      </div>
                    </Card>
                  </motion.li>
                )
              })}
            </ul>
          )}
        </>
      )}
    </div>
  )
}
