import { CalculatorIcon, CircleCheckIcon, CircleHelpIcon, TriangleAlertIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { Fact as FactData } from '@/api/types'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { formatDate, formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'

const STATUS_STYLE = {
  verified: { icon: CircleCheckIcon, className: 'text-fact-verified', value: 'font-semibold' },
  derived: { icon: CalculatorIcon, className: 'text-fact-derived', value: 'font-semibold' },
  // Estimates must never look like verified numbers: lighter weight, dashed underline, "≈".
  estimated: {
    icon: TriangleAlertIcon,
    className: 'text-fact-estimated',
    value: 'font-normal underline decoration-dashed underline-offset-4',
  },
} as const

/**
 * Renders one API fact with its status and provenance (docs/frontend.md §4).
 * - verified: solid, source on tap/hover
 * - derived: shows how it was calculated
 * - estimated: visibly marked as an estimate
 * - value null: "No reliable data", never hidden, never guessed
 */
export function Fact({
  fact,
  label,
  className,
}: {
  fact: FactData
  label?: string
  className?: string
}) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const name = label ?? t(`metric.${fact.metric}`, { defaultValue: fact.metric })
  const isDemo = fact.source.id === 'demo'

  if (fact.value === null) {
    return (
      <span
        data-fact-status="missing"
        className={cn('inline-flex flex-wrap items-baseline gap-x-2 text-fact-missing', className)}
      >
        <span className="text-muted-foreground">{name}</span>
        <span className="inline-flex items-center gap-1 italic">
          <CircleHelpIcon aria-hidden className="size-3.5 self-center" />
          {t('fact.noData')}
        </span>
      </span>
    )
  }

  const style = STATUS_STYLE[fact.status]
  const Icon = style.icon
  const display = formatValue(fact, lang, t)

  return (
    <span
      data-fact-status={fact.status}
      className={cn('inline-flex flex-wrap items-baseline gap-x-2', className)}
    >
      <span className="text-muted-foreground">{name}</span>
      <Popover>
        <PopoverTrigger
          className={cn(
            'inline-flex items-baseline gap-1 rounded-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
            style.className,
          )}
          aria-label={`${name}: ${display}. ${isDemo ? t('fact.demo') : t(`fact.${fact.status}`)}`}
        >
          <Icon aria-hidden className="size-3.5 self-center" />
          <span className={cn('text-foreground', style.value)}>
            {fact.status === 'estimated' ? '≈ ' : ''}
            {display}
          </span>
          {/* Demo placeholders never carry a "verified" label: they are not real data. */}
          {isDemo ? (
            <span className="rounded bg-demo/30 px-1 text-[10px] font-medium text-foreground uppercase">
              {t('fact.demo')}
            </span>
          ) : (
            <span className="text-xs">{t(`fact.${fact.status}`)}</span>
          )}
        </PopoverTrigger>
        <PopoverContent className="space-y-1.5">
          <p className="font-medium">{name}</p>
          {isDemo && (
            <p className="rounded bg-demo/20 p-2 text-xs">
              {t('fact.demoNote', { status: t(`fact.${fact.status}`) })}
            </p>
          )}
          <p>
            <span className="text-muted-foreground">{t('fact.source')}: </span>
            {fact.source.url ? (
              <a href={fact.source.url} target="_blank" rel="noreferrer" className="underline">
                {fact.source.name}
              </a>
            ) : (
              fact.source.name
            )}
          </p>
          {fact.method && (
            <p>
              <span className="text-muted-foreground">{t('fact.method')}: </span>
              {fact.method}
            </p>
          )}
          <p className="text-muted-foreground">
            {t('fact.retrieved', { date: formatDate(fact.retrieved_at, lang) })}
          </p>
        </PopoverContent>
      </Popover>
    </span>
  )
}

function formatValue(fact: FactData, lang: string, t: (k: string) => string) {
  const { value, unit } = fact
  if (typeof value === 'string') {
    return value === 'yes' ? t('fact.yes') : value === 'no' ? t('fact.no') : value
  }
  const n = formatNumber(value as number, lang)
  switch (unit) {
    case '%':
      return `${n}%`
    case 'min':
      return `${n} ${t('unit.min')}`
    case 'years':
      return `${n} ${t('unit.years')}`
    default:
      return n
  }
}
