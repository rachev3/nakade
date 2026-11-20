import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { useMatches, useProfile } from '@/api/queries'
import type { Match } from '@/api/types'
import { GoogleMap, type MapMarker } from '@/components/GoogleMap'
import { ErrorState, Loading } from '@/components/States'
import { Button } from '@/components/ui/button'
import { Card, CardTitle } from '@/components/ui/card'
import { percent, placeName } from '@/lib/format'

/** Score bands for the pins; the same colours are used in the legend. */
const BANDS = [
  { min: 0.85, color: '#2f6b4c', key: 'great' },
  { min: 0.7, color: '#6aa37c', key: 'good' },
  { min: 0.55, color: '#d6a547', key: 'ok' },
  { min: 0, color: '#b86b4b', key: 'weak' },
] as const
const EXCLUDED = '#8a8f8c'

const colorFor = (m: Match) =>
  m.passes_constraints ? BANDS.find((b) => m.score >= b.min)!.color : EXCLUDED

/** All matches of the current profile on one map, coloured by how well they fit. */
export default function MapPage() {
  const { t, i18n } = useTranslation()
  const { data: profile } = useProfile()
  const matches = useMatches({ limit: 100 })

  if (matches.isPending) return <Loading />
  if (matches.isError) return <ErrorState onRetry={() => void matches.refetch()} />

  const list = matches.data
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

  return (
    <div className="flex flex-col gap-6">
      <div className="space-y-1">
        <h1 className="text-3xl sm:text-4xl">{t('map.heading')}</h1>
        <p className="text-muted-foreground">
          {noProfile ? t('map.introNoProfile') : t('map.intro', { count: list.length })}
        </p>
      </div>

      {noProfile && (
        <Button asChild className="self-start">
          <Link to="/start/discover">{t('map.startProfile')}</Link>
        </Button>
      )}

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
        <CardTitle className="font-serif text-xl font-medium">{t('map.top')}</CardTitle>
        <ol className="space-y-2 text-sm">
          {list.slice(0, 10).map((m, i) => (
            <li key={m.ekatte} className="flex items-baseline justify-between gap-3">
              <span className="flex items-baseline gap-2">
                <span className="w-5 text-right text-muted-foreground tabular-nums">{i + 1}.</span>
                <span
                  aria-hidden
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ background: colorFor(m) }}
                />
                <Link to={`/places/${m.ekatte}`} className="underline underline-offset-4">
                  {placeName(m.settlement, i18n.language)}
                </Link>
                <span className="text-muted-foreground">{m.settlement.district}</span>
              </span>
              <span className="tabular-nums">{percent(m.score)}%</span>
            </li>
          ))}
        </ol>
      </Card>
    </div>
  )
}
