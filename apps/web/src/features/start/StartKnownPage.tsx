import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { z } from 'zod'
import { usePatchProfile, useProfile, useSettlements } from '@/api/queries'
import { ErrorState, Loading } from '@/components/States'
import { Button } from '@/components/ui/button'
import { NativeSelect } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { placeName } from '@/lib/format'
import { useJourneyStore } from '@/lib/journey'

const schema = z
  .object({
    from: z.string(),
    to: z.string().min(1, 'startKnown.toRequired'),
  })
  .refine((v) => !v.from || v.from !== v.to, { path: ['to'], message: 'startKnown.same' })

type Values = z.infer<typeof schema>

export default function StartKnownPage() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const settlements = useSettlements()
  const { data: profile } = useProfile()
  const patch = usePatchProfile()
  const start = useJourneyStore((s) => s.start)

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    values: {
      from: profile?.answers.current_location ?? '',
      to: profile?.answers.destination ?? '',
    },
  })

  if (settlements.isPending) return <Loading />
  if (settlements.isError) return <ErrorState onRetry={() => void settlements.refetch()} />

  const onSubmit = form.handleSubmit(async ({ from, to }) => {
    await patch.mutateAsync({ answers: { current_location: from || null, destination: to } })
    start('known', to)
    void navigate(profile?.completeness === 'none' ? '/profile/quick' : `/places/${to}`)
  })

  const options = [...settlements.data].sort((a, b) =>
    placeName(a, i18n.language).localeCompare(placeName(b, i18n.language), i18n.language),
  )
  const error = form.formState.errors.to?.message

  return (
    <form onSubmit={onSubmit} className="mx-auto flex max-w-md flex-col gap-6" noValidate>
      <h1 className="text-3xl font-semibold tracking-tight">{t('startKnown.title')}</h1>
      <div className="space-y-2">
        <Label htmlFor="from">
          {t('startKnown.from')}{' '}
          <span className="text-muted-foreground">({t('common.optional')})</span>
        </Label>
        <NativeSelect id="from" {...form.register('from')}>
          <option value="">{t('startKnown.pick')}</option>
          {options.map((s) => (
            <option key={s.ekatte} value={s.ekatte}>
              {placeName(s, i18n.language)}
            </option>
          ))}
        </NativeSelect>
      </div>
      <div className="space-y-2">
        <Label htmlFor="to">{t('startKnown.to')}</Label>
        <NativeSelect
          id="to"
          aria-invalid={!!error}
          aria-describedby={error ? 'to-error' : undefined}
          {...form.register('to')}
        >
          <option value="">{t('startKnown.pick')}</option>
          {options.map((s) => (
            <option key={s.ekatte} value={s.ekatte}>
              {placeName(s, i18n.language)}
            </option>
          ))}
        </NativeSelect>
        {error && (
          <p id="to-error" className="text-sm text-destructive">
            {t(error)}
          </p>
        )}
      </div>
      <Button type="submit" size="lg" disabled={form.formState.isSubmitting}>
        {t('common.continue')}
      </Button>
    </form>
  )
}
