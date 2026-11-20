import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { useSaved } from '@/api/queries'
import { PlaceHeading } from '@/components/PlaceHeading'
import { ErrorState, Loading } from '@/components/States'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { placeName } from '@/lib/format'

const MAX_COMPARE = 3

export default function SavedPage() {
  const { t, i18n } = useTranslation()
  const saved = useSaved()
  const [selected, setSelected] = useState<string[]>([])

  if (saved.isPending) return <Loading />
  if (saved.isError) return <ErrorState onRetry={() => void saved.refetch()} />

  const toggle = (ekatte: string, on: boolean) =>
    setSelected((s) =>
      on ? (s.length < MAX_COMPARE ? [...s, ekatte] : s) : s.filter((x) => x !== ekatte),
    )

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-semibold tracking-tight">{t('saved.title')}</h1>
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
        <ul className="grid gap-4 sm:grid-cols-2">
          {saved.data.map(({ settlement, action }) => {
            const name = placeName(settlement, i18n.language)
            const checked = selected.includes(settlement.ekatte)
            return (
              <li key={settlement.ekatte}>
                <Card className="h-full">
                  <div className="flex items-start justify-between gap-3">
                    <PlaceHeading place={settlement} as="h2" />
                    <Checkbox
                      checked={checked}
                      disabled={!checked && selected.length >= MAX_COMPARE}
                      onCheckedChange={(v) => toggle(settlement.ekatte, v === true)}
                      aria-label={t('saved.select', { name })}
                    />
                  </div>
                  <p className="text-sm">{settlement.hook}</p>
                  <div className="mt-auto flex items-center justify-between">
                    <Badge variant="secondary">
                      {t(action === 'save' ? 'saved.saved' : 'saved.liked')}
                    </Badge>
                    <Button asChild variant="link" className="px-0">
                      <Link to={`/places/${settlement.ekatte}`}>{t('discover.details')} →</Link>
                    </Button>
                  </div>
                </Card>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
