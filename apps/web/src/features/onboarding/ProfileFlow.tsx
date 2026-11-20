import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { usePatchProfile, useProfile } from '@/api/queries'
import { ErrorState, Loading } from '@/components/States'
import { Progress } from '@/components/ui/progress'
import { afterProfilePath, type Flow, useJourneyStore } from '@/lib/journey'
import { resumeIndex, stepsFor } from './steps'
import { StepView } from './StepView'

/**
 * Runs Quick or Detailed Match over the same server-side profile. Every answer is PATCHed as
 * soon as it is given, and the current step is persisted, so a reload resumes where you were.
 */
export function ProfileFlow({ flow }: { flow: Flow }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const profileQuery = useProfile()
  const patch = usePatchProfile()
  const { journey, destination, stepId, setStep } = useJourneyStore()

  if (profileQuery.isPending) return <Loading />
  if (profileQuery.isError) return <ErrorState onRetry={() => void profileQuery.refetch()} />

  const answers = profileQuery.data.answers
  const steps = stepsFor(flow, answers)
  const index = resumeIndex(steps, answers, stepId[flow])
  const step = steps[index]!
  const isLast = index === steps.length - 1

  const submit = async (value: unknown) => {
    const answersPatch = { [step.field]: value }
    if (isLast) {
      await patch.mutateAsync({ answers: answersPatch, completeness: flow })
      setStep(flow, undefined)
      void navigate(afterProfilePath(journey, destination))
      return
    }
    const profile = await patch.mutateAsync({ answers: answersPatch })
    // Recompute visible steps with the new answer (adaptive branching).
    const next = stepsFor(flow, profile.answers)
    const pos = next.findIndex((s) => s.id === step.id)
    setStep(flow, next[pos + 1]?.id)
  }

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6">
      <div className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground">
          {t(flow === 'quick' ? 'onboarding.quickTitle' : 'onboarding.detailedTitle')} ·{' '}
          {t('common.stepOf', { current: index + 1, total: steps.length })}
        </p>
        <Progress
          value={((index + 1) / steps.length) * 100}
          aria-label={t('common.stepOf', { current: index + 1, total: steps.length })}
        />
      </div>
      <StepView
        key={step.id}
        step={step}
        initial={answers[step.field]}
        isLast={isLast}
        submitting={patch.isPending}
        onBack={index > 0 ? () => setStep(flow, steps[index - 1]!.id) : undefined}
        onSubmit={(v) => void submit(v)}
      />
      <p className="text-xs text-muted-foreground">{t('onboarding.resumeNote')}</p>
    </div>
  )
}
