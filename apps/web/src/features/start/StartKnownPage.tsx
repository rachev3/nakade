import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { z } from 'zod'
import { usePatchProfile, useProfile, useSettlements } from '@/api/queries'
import { PlaceSearch } from '@/components/PlaceSearch'
import { ProfileModePicker } from '@/components/ProfileModePicker'
import { ErrorState, Loading } from '@/components/States'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { placeName } from '@/lib/format'
import { nextAfterStart, useJourneyStore } from '@/lib/journey'

const schema = z
  .object({
    from: z.string(),
    to: z.string().min(1, 'startKnown.toRequired'),
    mode: z.enum(['quick', 'detailed']),
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
      mode: profile?.completeness === 'detailed' ? 'detailed' : 'quick',
    },
  })

  if (settlements.isPending) return <Loading />
  if (settlements.isError) return <ErrorState onRetry={() => void settlements.refetch()} />

  const onSubmit = form.handleSubmit(async ({ from, to, mode }) => {
    await patch.mutateAsync({ answers: { current_location: from || null, destination: to } })
    start('known', to)
    void navigate(nextAfterStart(mode, profile?.completeness, `/places/${to}`))
  })

  const options = [...settlements.data].sort((a, b) =>
    placeName(a, i18n.language).localeCompare(placeName(b, i18n.language), i18n.language),
  )
  const error = form.formState.errors.to?.message

  return (
    <form onSubmit={onSubmit} className="mx-auto flex max-w-xl flex-col gap-6" noValidate>
      <h1 className="text-3xl sm:text-4xl">{t('startKnown.title')}</h1>
      <div className="space-y-2">
        <Label htmlFor="from">
          {t('startKnown.from')}{' '}
          <span className="text-muted-foreground">({t('common.optional')})</span>
        </Label>
        <Controller
          control={form.control}
          name="from"
          render={({ field }) => (
            <PlaceSearch
              id="from"
              options={options}
              value={field.value}
              onChange={field.onChange}
            />
          )}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="to">{t('startKnown.to')}</Label>
        <Controller
          control={form.control}
          name="to"
          render={({ field }) => (
            <PlaceSearch
              id="to"
              options={options}
              value={field.value}
              onChange={field.onChange}
              invalid={!!error}
              describedBy={error ? 'to-error' : undefined}
            />
          )}
        />
        {error && (
          <p id="to-error" className="text-sm text-destructive">
            {t(error)}
          </p>
        )}
      </div>
      <Controller
        control={form.control}
        name="mode"
        render={({ field }) => <ProfileModePicker value={field.value} onChange={field.onChange} />}
      />
      <Button type="submit" size="lg" disabled={form.formState.isSubmitting}>
        {t('common.continue')}
      </Button>
    </form>
  )
}
