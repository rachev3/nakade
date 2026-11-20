import { useTranslation } from 'react-i18next'
import type { SettlementSummary } from '@/api/types'
import { Badge } from '@/components/ui/badge'
import { placeName } from '@/lib/format'

export function PlaceHeading({
  place,
  as: As = 'h1',
}: {
  place: SettlementSummary
  as?: 'h1' | 'h2'
}) {
  const { t, i18n } = useTranslation()
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        <As
          className={
            As === 'h1' ? 'text-3xl font-semibold tracking-tight' : 'text-2xl font-semibold'
          }
        >
          {placeName(place, i18n.language)}
        </As>
        <Badge variant="outline">{t(`common.${place.type}`)}</Badge>
      </div>
      <p className="text-sm text-muted-foreground">
        {place.municipality} · {place.district}
      </p>
    </div>
  )
}
