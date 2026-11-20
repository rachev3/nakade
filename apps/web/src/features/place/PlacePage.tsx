import {
  BookmarkCheckIcon,
  BookmarkIcon,
  ClipboardListIcon,
  CompassIcon,
  PlayIcon,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { useMatches, useRecordSwipe, useSaved, useSettlement } from '@/api/queries'
import type { Dimension, Fact as FactData } from '@/api/types'
import { Fact } from '@/components/Fact'
import { Landscape } from '@/components/Landscape'
import { MapView } from '@/components/MapView'
import { PlaceHeading } from '@/components/PlaceHeading'
import { ScoreBar } from '@/components/ScoreBar'
import { ErrorState, Loading } from '@/components/States'
import { UpgradeCard } from '@/components/UpgradeCard'
import { Button } from '@/components/ui/button'
import { Card, CardTitle } from '@/components/ui/card'
import { percent, placeName } from '@/lib/format'
import { FitExplanation } from './FitExplanation'

export default function PlacePage() {
  const { ekatte = '' } = useParams()
  const { t, i18n } = useTranslation()
  const settlement = useSettlement(ekatte)
  const matches = useMatches({ ekatte: [ekatte] })
  const saved = useSaved()
  const swipe = useRecordSwipe()

  if (settlement.isPending) return <Loading />
  if (settlement.isError) return <ErrorState onRetry={() => void settlement.refetch()} />

  const place = settlement.data
  const match = matches.data?.[0]
  const isSaved = saved.data?.some((s) => s.settlement.ekatte === ekatte) ?? false
  const factsById = new Map(place.facts.map((f) => [f.id, f]))

  const byDimension = place.facts.reduce<Partial<Record<Dimension, FactData[]>>>((acc, f) => {
    ;(acc[f.dimension] ??= []).push(f)
    return acc
  }, {})

  return (
    <div className="flex flex-col gap-6">
      <div className="-mx-4 -mt-6 h-40 overflow-hidden sm:mx-0 sm:mt-0 sm:h-52 sm:rounded-3xl">
        <Landscape seed={place.ekatte} type={place.type} />
      </div>
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <PlaceHeading place={place} />
          <p className="max-w-prose font-serif text-lg italic">{place.hook}</p>
        </div>
        <Button
          variant={isSaved ? 'secondary' : 'outline'}
          size="sm"
          className="shrink-0"
          aria-pressed={isSaved}
          onClick={() => swipe.mutate({ ekatte, action: 'save' })}
          disabled={swipe.isPending}
        >
          {isSaved ? <BookmarkCheckIcon aria-hidden /> : <BookmarkIcon aria-hidden />}
          {isSaved ? t('place.saved') : t('place.save')}
        </Button>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <Button asChild size="lg">
          <Link to={`/places/${ekatte}/try`}>
            <PlayIcon aria-hidden />
            {t('place.try')}
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link to={`/plan/${ekatte}`}>
            <ClipboardListIcon aria-hidden />
            {t('place.plan')}
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/discover">
            <CompassIcon aria-hidden />
            {t('place.alternatives')}
          </Link>
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        <div className="flex flex-col gap-6">
          {match ? (
            <Card>
              <div className="space-y-1">
                <CardTitle className="font-serif text-xl font-medium">{t('place.fit')}</CardTitle>
                <p className="flex items-baseline gap-2">
                  <span className="font-serif text-4xl text-primary">{percent(match.score)}%</span>
                  <span className="text-sm text-muted-foreground">
                    {t('place.confidence', { value: percent(match.confidence) })}
                  </span>
                </p>
              </div>
              <div className="space-y-2">
                {match.dimensions.map((d, i) => (
                  <ScoreBar key={d.key} dimension={d} index={i} />
                ))}
              </div>
            </Card>
          ) : matches.isPending ? (
            <Loading />
          ) : null}

          {match && <FitExplanation match={match} factsById={factsById} />}

          <Card>
            <CardTitle className="font-serif text-xl font-medium">{t('place.facts')}</CardTitle>
            <div className="space-y-4">
              {Object.entries(byDimension).map(([dimension, facts]) => (
                <section key={dimension} className="space-y-1.5">
                  <h3 className="text-sm font-medium">{t(`dimension.${dimension}`)}</h3>
                  <ul className="space-y-1 text-sm">
                    {facts.map((f) => (
                      <li key={f.id}>
                        <Fact fact={f} />
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <CardTitle className="font-serif text-xl font-medium">{t('place.map')}</CardTitle>
            <MapView lat={place.lat} lon={place.lon} />
          </Card>
          {place.nearby.length > 0 && (
            <Card>
              <CardTitle className="font-serif text-xl font-medium">{t('place.nearby')}</CardTitle>
              <ul className="space-y-2 text-sm">
                {place.nearby.map((n) => (
                  <li key={n.settlement.ekatte} className="flex justify-between gap-2">
                    <Link
                      to={`/places/${n.settlement.ekatte}`}
                      className="underline underline-offset-4"
                    >
                      {placeName(n.settlement, i18n.language)}
                    </Link>
                    {n.drive_min !== null && (
                      <span className="text-muted-foreground">
                        {t('common.minutes', { count: n.drive_min })}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          )}
          <UpgradeCard />
        </div>
      </div>
    </div>
  )
}
