import { motion } from 'motion/react'
import { useTranslation } from 'react-i18next'
import type { DimensionScore } from '@/api/types'
import { percent } from '@/lib/format'
import { smooth } from '@/lib/motion'

/** `index` staggers the fill animation when several bars appear together. */
export function ScoreBar({ dimension, index = 0 }: { dimension: DimensionScore; index?: number }) {
  const { t } = useTranslation()
  const label = t(`dimension.${dimension.key}`)
  const value = dimension.score === null ? null : percent(dimension.score)
  return (
    <div className="grid grid-cols-[7.5rem_1fr_4.5rem] items-center gap-3 text-sm sm:grid-cols-[10rem_1fr_5rem]">
      <span className="truncate" title={label}>
        {label}
      </span>
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
          <motion.span
            className="block h-full rounded-full bg-primary"
            initial={{ width: 0 }}
            animate={{ width: `${value}%` }}
            transition={smooth(0.7, 0.1 + index * 0.05)}
          />
        </span>
      )}
      <span className="text-right text-xs text-muted-foreground tabular-nums">
        {value === null ? t('place.noScoreShort') : `${value}%`}
      </span>
    </div>
  )
}
