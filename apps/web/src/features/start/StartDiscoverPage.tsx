import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { z } from 'zod'
import { usePatchProfile, useProfile } from '@/api/queries'
import { ChoiceChips } from '@/components/ChoiceChips'
import { ProfileModePicker } from '@/components/ProfileModePicker'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { nextAfterStart, useJourneyStore } from '@/lib/journey'

const CHIPS = [
  'quiet',
  'nature',
  'mountains',
  'near_city',
  'good_schools',
  'community',
  'affordable',
  'remote_work',
] as const

const schema = z
  .object({
    text: z.string().max(500),
    chips: z.array(z.string()),
    mode: z.enum(['quick', 'detailed']),
  })
  .refine((v) => v.text.trim().length > 0 || v.chips.length > 0, {
    path: ['chips'],
    message: 'startDiscover.atLeastOne',
  })

type Values = z.infer<typeof schema>

export default function StartDiscoverPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { data: profile } = useProfile()
  const patch = usePatchProfile()
  const start = useJourneyStore((s) => s.start)

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    values: {
      text: profile?.answers.lifestyle_text ?? '',
      chips: profile?.answers.lifestyle_chips ?? [],
      mode: profile?.completeness === 'detailed' ? 'detailed' : 'quick',
    },
  })

  const onSubmit = form.handleSubmit(async ({ text, chips, mode }) => {
    await patch.mutateAsync({
      answers: { lifestyle_text: text.trim() || null, lifestyle_chips: chips },
    })
    start('discover')
    void navigate(nextAfterStart(mode, profile?.completeness, '/discover'))
  })

  const error = form.formState.errors.chips?.message

  return (
    <form onSubmit={onSubmit} className="mx-auto flex max-w-xl flex-col gap-6" noValidate>
      <h1 className="text-3xl sm:text-4xl">{t('startDiscover.title')}</h1>
      <div className="space-y-2">
        <Label htmlFor="text">{t('startDiscover.textLabel')}</Label>
        <Textarea
          id="text"
          placeholder={t('startDiscover.textPlaceholder')}
          {...form.register('text')}
        />
      </div>
      <div className="space-y-3">
        <p className="text-sm font-medium">{t('startDiscover.chipsLabel')}</p>
        <Controller
          control={form.control}
          name="chips"
          render={({ field }) => (
            <ChoiceChips
              multiple
              label={t('startDiscover.chipsLabel')}
              value={field.value}
              onChange={field.onChange}
              options={CHIPS.map((c) => ({ value: c, label: t(`startDiscover.chips.${c}`) }))}
            />
          )}
        />
        {error && (
          <p role="alert" className="text-sm text-destructive">
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
