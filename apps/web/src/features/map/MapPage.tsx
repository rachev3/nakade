import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router'
import { useMatches, useProfile } from '@/api/queries'
import type { Dimension, Match } from '@/api/types'
import { GoogleMap, type MapMarker } from '@/components/GoogleMap'
import { ErrorState, Loading } from '@/components/States'
import { Button } from '@/components/ui/button'
import { Card, CardTitle } from '@/components/ui/card'
import { NativeSelect } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { percent, placeName } from '@/lib/format'
import { cn } from '@/lib/utils'

/** Score bands for the pins; the same colours are used in the legend. */
const BANDS = [
  { min: 0.85, color: '#2f6b4c', key: 'great' },
  { min: 0.7, color: '#6aa37c', key: 'good' },
  { min: 0.55, color: '#d6a547', key: 'ok' },
  { min: 0, color: '#b86b4b', key: 'weak' },
] as const
const EXCLUDED = '#8a8f8c'

const DIMENSIONS: Dimension[] = [
  'transport',
  'healthcare',
  'education',
  'amenities',
  'nature',
  'employment',
  'demographics',
]
const MIN_SCORES = ['0', '60', '70', '80', '90'] as const
const TYPES = ['all', 'town', 'village'] as const

const colorFor = (m: Match) =>
  m.passes_constraints ? BANDS.find((b) => m.score >= b.min)!.color : EXCLUDED

const dimScore = (m: Match, key: string) => m.dimensions.find((d) => d.key === key)?.score ?? null

/** All matches of the current profile: filters + sort, then the same list on the map and below it. */
export default function MapPage() {
  const { t, i18n } = useTranslation()
  const { data: profile } = useProfile()
  const matches = useMatches({ limit: 100 })
  const [params, setParams] = useSearchParams()

  // Filters live in the URL, so a filtered view can be shared or bookmarked.
  const sort = params.get('sort') ?? 'score'
  const min = Number(params.get('min') ?? '0')
  const type = (params.get('type') ?? 'all') as (typeof TYPES)[number]
  const district = params.get('district') ?? ''
  const hideExcluded = params.get('hide') === '1'
  const set = (key: string, value: string, fallback: string) =>
    setParams(
      (p) => {
        if (value === fallback) p.delete(key)
        else p.set(key, value)
        return p
      },
      { replace: true },
    )

  if (matches.isPending) return <Loading />
  if (matches.isError) return <ErrorState onRetry={() => void matches.refetch()} />

  const all = matches.data
  const districts = [...new Set(all.map((m) => m.settlement.district))].sort((a, b) =>
    a.localeCompare(b, 'bg'),
  )
  const sortValue = (m: Match) => (sort === 'score' ? m.score : (dimScore(m, sort) ?? -1))
  const list = all
    .filter((m) => m.score * 100 >= min)
    .filter((m) => type === 'all' || m.settlement.type === type)
    .filter((m) => !district || m.settlement.district === district)
    .filter((m) => !hideExcluded || m.passes_constraints)
    .sort(
      (a, b) =>
        Number(b.passes_constraints) - Number(a.passes_constraints) ||
        sortValue(b) - sortValue(a) ||
        b.score - a.score,
    )
  const filtered = sort !== 'score' || min > 0 || type !== 'all' || district !== '' || hideExcluded

  const markers: MapMarker[] = list.map((m) => ({
    id: m.ekatte,
    lat: m.settlement.lat,
    lon: m.settlement.lon,
    title: placeName(m.settlement, i18n.language),
    subtitle: `${t('map.fit', { value: percent(m.score) })} · ${m.settlement.hook}`,
    href: `/places/${m.ekatte}`,
    color: colorFor(m),
    muted: !m.passes_constraints,
  }))
  const noProfile = !profile || profile.completeness === 'none'

  const chip = (active: boolean) =>
    cn(
      'inline-flex min-h-9 items-center rounded-full border px-3.5 text-sm transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
      active
        ? 'border-primary bg-primary text-primary-foreground'
        : 'border-input bg-card hover:border-primary/40 hover:bg-accent',
    )

  return (
    <div className="flex flex-col gap-6">
      <div className="space-y-1">
        <h1 className="text-3xl sm:text-4xl">{t('map.heading')}</h1>
        <p className="text-muted-foreground">
          {noProfile ? t('map.introNoProfile') : t('map.intro', { count: all.length })}
        </p>
      </div>

      {noProfile && (
        <Button asChild className="self-start">
          <Link to="/start/discover">{t('map.startProfile')}</Link>
        </Button>
      )}

      <Card className="gap-5">
        <CardTitle className="font-serif text-xl font-medium">{t('map.filters.title')}</CardTitle>

        <div className="space-y-2">
          <p className="text-sm font-medium">{t('map.filters.sort')}</p>
          <div
            role="radiogroup"
            aria-label={t('map.filters.sort')}
            className="flex flex-wrap gap-2"
          >
            {['score', ...DIMENSIONS].map((key) => (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={sort === key}
                onClick={() => set('sort', key, 'score')}
                className={chip(sort === key)}
              >
                {key === 'score' ? t('map.filters.sortScore') : t(`dimension.${key}`)}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">{t('map.filters.min')}</p>
          <div role="radiogroup" aria-label={t('map.filters.min')} className="flex flex-wrap gap-2">
            {MIN_SCORES.map((v) => (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={String(min) === v}
                onClick={() => set('min', v, '0')}
                className={chip(String(min) === v)}
              >
                {v === '0' ? t('map.filters.any') : `${v}%+`}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
          <div className="space-y-2">
            <p className="text-sm font-medium">{t('map.filters.type')}</p>
            <div role="radiogroup" aria-label={t('map.filters.type')} className="flex gap-2">
              {TYPES.map((v) => (
                <button
                  key={v}
                  type="button"
                  role="radio"
                  aria-checked={type === v}
                  onClick={() => set('type', v, 'all')}
                  className={chip(type === v)}
                >
                  {v === 'all' ? t('map.filters.all') : t(`map.filters.${v}`)}
                </button>
              ))}
            </div>
          </div>
          <div className="min-w-48 space-y-2">
            <Label htmlFor="district" className="text-sm font-medium">
              {t('map.filters.district')}
            </Label>
            <NativeSelect
              id="district"
              value={district}
              onChange={(e) => set('district', e.target.value, '')}
              className="h-9"
            >
              <option value="">{t('map.filters.allDistricts')}</option>
              {districts.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </NativeSelect>
          </div>
          <label className="flex min-h-9 cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={hideExcluded}
              onChange={(e) => set('hide', e.target.checked ? '1' : '0', '0')}
              className="size-4 accent-primary"
            />
            {t('map.filters.hideExcluded')}
          </label>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
          <span role="status">
            {t('map.filters.shown', { shown: list.length, total: all.length })}
          </span>
          {filtered && (
            <Button variant="ghost" size="sm" onClick={() => setParams({}, { replace: true })}>
              {t('map.filters.reset')}
            </Button>
          )}
        </div>
      </Card>

      <GoogleMap markers={markers} className="h-[28rem] sm:h-[34rem]" />

      <ul
        className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground"
        aria-label={t('map.legend')}
      >
        {BANDS.map((b) => (
          <li key={b.key} className="flex items-center gap-1.5">
            <span aria-hidden className="size-3 rounded-full" style={{ background: b.color }} />
            {t(`map.band.${b.key}`)}
          </li>
        ))}
        <li className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="size-3 rounded-full opacity-50"
            style={{ background: EXCLUDED }}
          />
          {t('map.band.excluded')}
        </li>
      </ul>

      <Card>
        <CardTitle className="font-serif text-xl font-medium">
          {sort === 'score'
            ? t('map.listTitle')
            : t('map.listTitleBy', { dimension: t(`dimension.${sort}`) })}
        </CardTitle>
        {list.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('map.filters.empty')}</p>
        ) : (
          <ol className="space-y-2 text-sm">
            {list.map((m, i) => {
              const by = sort === 'score' ? null : dimScore(m, sort)
              const firstExcluded =
                !m.passes_constraints && list[i - 1]?.passes_constraints !== false
              const why = m.excluded_because?.map((e) => t(e.text_key)).join(' · ')
              return (
                <li key={m.ekatte} className="space-y-2">
                  {firstExcluded && (
                    <p className="border-t pt-3 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                      {t('map.excludedHeading')}
                    </p>
                  )}
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="flex min-w-0 items-baseline gap-2">
                      <span className="w-6 shrink-0 text-right text-muted-foreground tabular-nums">
                        {i + 1}.
                      </span>
                      <span
                        aria-hidden
                        className="size-2.5 shrink-0 rounded-full"
                        style={{ background: colorFor(m) }}
                      />
                      <Link
                        to={`/places/${m.ekatte}`}
                        className={cn(
                          'underline underline-offset-4',
                          !m.passes_constraints && 'text-muted-foreground',
                        )}
                      >
                        {placeName(m.settlement, i18n.language)}
                      </Link>
                      <span className="truncate text-muted-foreground">
                        {t(`common.${m.settlement.type}`)} · {m.settlement.district}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-baseline gap-3 tabular-nums">
                      {by !== null && (
                        <span className="text-muted-foreground">
                          {t(`dimension.${sort}`)} {percent(by)}%
                        </span>
                      )}
                      <span className="font-medium">{percent(m.score)}%</span>
                    </span>
                  </div>
                  {why && <p className="pl-[3.25rem] text-xs text-muted-foreground">{why}</p>}
                </li>
              )
            })}
          </ol>
        )}
      </Card>
    </div>
  )
}
