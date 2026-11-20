import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router'
import { usePlan, useSettlement } from '@/api/queries'
import { ErrorState, Loading } from '@/components/States'
import { Card, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Progress } from '@/components/ui/progress'
import { placeName } from '@/lib/format'
import { usePlanStore } from './store'

const NONE: string[] = []

export default function PlanPage() {
  const { ekatte = '' } = useParams()
  const { t, i18n } = useTranslation()
  const settlement = useSettlement(ekatte)
  const plan = usePlan(ekatte)
  const done = usePlanStore((s) => s.done[ekatte] ?? NONE)
  const toggle = usePlanStore((s) => s.toggle)

  if (settlement.isPending || plan.isPending) return <Loading />
  if (settlement.isError || plan.isError)
    return <ErrorState onRetry={() => void Promise.all([settlement.refetch(), plan.refetch()])} />

  const items = plan.data.sections.flatMap((s) => s.items)
  const doneCount = items.filter((i) => done.includes(i.id)).length

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">
          {t('plan.title', { place: placeName(settlement.data, i18n.language) })}
        </h1>
        <p className="text-muted-foreground">{t('plan.intro')}</p>
        <Progress
          value={items.length ? (doneCount / items.length) * 100 : 0}
          aria-label={t('plan.progress', { done: doneCount, total: items.length })}
        />
        <p className="text-sm text-muted-foreground">
          {t('plan.progress', { done: doneCount, total: items.length })}
        </p>
      </div>
      {plan.data.sections.map((section) => (
        <Card key={section.key}>
          <CardTitle className="text-lg">{t(`plan.sections.${section.key}`)}</CardTitle>
          <ul className="space-y-3">
            {section.items.map((item) => {
              const id = `plan-${item.id}`
              return (
                <li key={item.id} className="flex items-start gap-3">
                  <Checkbox
                    id={id}
                    checked={done.includes(item.id)}
                    onCheckedChange={() => toggle(ekatte, item.id)}
                  />
                  <label
                    htmlFor={id}
                    className="text-sm leading-5 peer-data-[state=checked]:text-muted-foreground peer-data-[state=checked]:line-through"
                  >
                    {item.text}
                  </label>
                </li>
              )
            })}
          </ul>
        </Card>
      ))}
    </div>
  )
}
