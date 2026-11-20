import { useTranslation } from 'react-i18next'
import type { DimensionScore } from '@/api/types'
import { percent } from '@/lib/format'

export function ScoreBar({ dimension }: { dimension: DimensionScore }) {
  const { t } = useTranslation()
  const label = t(`dimension.${dimension.key}`)
  const value = dimension.score === null ? null : percent(dimension.score)
  return (
    <div className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3 text-sm">
      <span className="truncate">{label}</span>
      {value === null ? (
        <span className="h-2 rounded-full border border-dashed border-fact-missing" />
      ) : (
        <span
          role="meter"
          aria-label={label}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={value}
          className="h-2 overflow-hidden rounded-full bg-secondary"
        >
          <span className="block h-full rounded-full bg-primary" style={{ width: `${value}%` }} />
        </span>
      )}
      <span className="w-24 text-right text-xs text-muted-foreground tabular-nums">
        {value === null ? t('place.noScore') : `${value}%`}
      </span>
    </div>
  )
}
