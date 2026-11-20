import { MapPinIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'

/** Placeholder until MapLibre GL is added (lazy-loaded, see docs/frontend.md §1). */
export function MapView({ lat, lon }: { lat: number; lon: number }) {
  const { t } = useTranslation()
  return (
    <div className="flex h-40 flex-col items-center justify-center gap-1 rounded-lg border border-dashed text-sm text-muted-foreground">
      <MapPinIcon aria-hidden />
      <span>{t('place.mapPlaceholder')}</span>
      <span className="text-xs tabular-nums">
        {lat.toFixed(3)}, {lon.toFixed(3)}
      </span>
    </div>
  )
}
