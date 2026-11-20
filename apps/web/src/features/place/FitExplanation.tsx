import { CheckIcon, CircleHelpIcon, MinusIcon, OctagonAlertIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { Explanation, Fact as FactData, Match } from '@/api/types'
import { Fact } from '@/components/Fact'
import { Card, CardTitle } from '@/components/ui/card'

/** Every recommendation shows why, the trade-offs and what we don't know (docs/frontend.md §4). */
export function FitExplanation({
  match,
  factsById,
}: {
  match: Match
  factsById: Map<string, FactData>
}) {
  const { t } = useTranslation()

  const evidence = (e: Explanation) =>
    e.fact_ids.flatMap((id) => {
      const f = factsById.get(id)
      return f ? [f] : []
    })

  const list = (items: Explanation[], icon: React.ReactNode) => (
    <ul className="space-y-3">
      {items.map((e) => (
        <li key={e.text_key} className="space-y-1">
          <p className="flex items-center gap-2 font-medium">
            {icon}
            {t(e.text_key, e.params ?? {})}
          </p>
          <ul className="ml-6 space-y-0.5 text-sm">
            {evidence(e).map((f) => (
              <li key={f.id}>
                <Fact fact={f} />
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  )

  return (
    <>
      {!match.passes_constraints && match.excluded_because && (
        <Card className="border-destructive/50">
          <CardTitle className="flex items-center gap-2 font-serif text-xl font-medium text-destructive">
            <OctagonAlertIcon aria-hidden className="size-5" />
            {t('place.excludedBecause')}
          </CardTitle>
          {list(match.excluded_because, null)}
        </Card>
      )}
      <Card>
        <CardTitle className="font-serif text-xl font-medium">{t('place.why')}</CardTitle>
        {list(match.reasons, <CheckIcon aria-hidden className="size-4 text-like" />)}
      </Card>
      {match.tradeoffs.length > 0 && (
        <Card>
          <CardTitle className="font-serif text-xl font-medium">{t('place.tradeoffs')}</CardTitle>
          {list(match.tradeoffs, <MinusIcon aria-hidden className="size-4" />)}
        </Card>
      )}
      <Card>
        <CardTitle className="font-serif text-xl font-medium">{t('place.unknowns')}</CardTitle>
        {match.unknowns.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('place.noUnknowns')}</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {match.unknowns.map((u) => (
              <li key={u.dimension} className="flex items-start gap-2">
                <CircleHelpIcon aria-hidden className="mt-0.5 size-4 text-fact-missing" />
                <span>
                  <span className="font-medium">{t(`dimension.${u.dimension}`)}</span>
                  {u.missing.length > 0 && (
                    <span className="text-muted-foreground">
                      {': '}
                      {u.missing
                        .map((m) => t(`metric.${m}`, { defaultValue: m }))
                        .join(', ')} — {t('fact.noData')}
                    </span>
                  )}
                  {u.missing.length === 0 && (
                    <span className="text-muted-foreground"> — {t('place.noScore')}</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  )
}
