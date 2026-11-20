import { motion } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { useSettlement, useSimulation } from '@/api/queries'
import type { Fact as FactData, Statement } from '@/api/types'
import { Fact } from '@/components/Fact'
import { Scenario } from '@/components/Scenario'
import { ErrorState, Loading } from '@/components/States'
import { Button } from '@/components/ui/button'
import { placeName } from '@/lib/format'

/**
 * "Try Your New Life" stub. Each statement is tagged by the API: `fact` statements render as
 * data with their cited <Fact>s; `scenario` statements render as <Scenario> (imagined).
 */
export default function SimulationPage() {
  const { ekatte = '' } = useParams()
  const { t, i18n } = useTranslation()
  const settlement = useSettlement(ekatte)
  const simulation = useSimulation(ekatte)

  if (settlement.isPending || simulation.isPending)
    return <Loading label={t('simulation.loading')} />
  if (settlement.isError || simulation.isError)
    return (
      <ErrorState onRetry={() => void Promise.all([settlement.refetch(), simulation.refetch()])} />
    )

  const factsById = new Map(simulation.data.facts.map((f) => [f.id, f]))
  const name = placeName(settlement.data, i18n.language)

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">
          {t('simulation.title', { place: name })}
        </h1>
        <p className="text-sm text-muted-foreground">{t('simulation.intro')}</p>
        <div className="flex flex-wrap gap-4 text-xs">
          <span className="inline-flex items-center gap-1.5">
            <span className="size-3 rounded-sm bg-fact-verified" /> {t('simulation.legendFact')}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-3 rounded-sm border-l-4 border-scenario bg-scenario-bg" />
            {t('simulation.legendScenario')}
          </span>
        </div>
      </div>

      <ol className="relative space-y-6 border-l pl-6">
        {simulation.data.scenes.map((scene, i) => (
          <motion.li
            key={scene.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            className="relative space-y-2"
          >
            <span
              aria-hidden
              className="absolute top-1.5 -left-[1.95rem] size-3 rounded-full border-2 border-background bg-primary"
            />
            <h2 className="flex items-baseline gap-3">
              <span className="text-sm text-muted-foreground tabular-nums">{scene.time}</span>
              <span className="text-lg font-semibold">{scene.title}</span>
            </h2>
            <div className="space-y-2">
              {scene.statements.map((s, j) => (
                <StatementView key={j} statement={s} factsById={factsById} />
              ))}
            </div>
          </motion.li>
        ))}
      </ol>

      <div className="flex flex-wrap gap-2">
        <Button asChild>
          <Link to={`/plan/${ekatte}`}>{t('place.plan')}</Link>
        </Button>
        <Button asChild variant="outline">
          <Link to={`/places/${ekatte}`}>{t('common.back')}</Link>
        </Button>
      </div>
    </div>
  )
}

function StatementView({
  statement,
  factsById,
}: {
  statement: Statement
  factsById: Map<string, FactData>
}) {
  if (statement.kind === 'scenario') return <Scenario>{statement.text}</Scenario>
  const facts = statement.fact_ids.flatMap((id) => (factsById.has(id) ? [factsById.get(id)!] : []))
  return (
    <div data-kind="fact" className="space-y-1 rounded-md border px-3 py-2 text-sm">
      <p>{statement.text}</p>
      {facts.map((f) => (
        <Fact key={f.id} fact={f} className="text-xs" />
      ))}
    </div>
  )
}
