import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'
import type { ProfileAnswers } from '@/api/types'
import { ChoiceChips } from '@/components/ChoiceChips'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { StepDef } from './steps'

type Value = ProfileAnswers[keyof ProfileAnswers]

/** Form state is always a string[] (chips) or a string (inputs); converted at the edges. */
function toForm(step: StepDef, value: Value): string[] | string {
  const k = step.kind
  switch (k.type) {
    case 'single':
      return value ? [String(value)] : []
    case 'multi':
      return Array.isArray(value) ? value.map(String) : []
    case 'boolean':
      return value === undefined || value === null ? [] : [value ? 'yes' : 'no']
    case 'number':
      return value === undefined || value === null ? '' : String(value)
    case 'numberList':
      return Array.isArray(value) ? value.join(', ') : ''
  }
}

function schemaFor(step: StepDef) {
  const k = step.kind
  switch (k.type) {
    case 'single':
    case 'boolean':
      return z.array(z.string()).length(1)
    case 'multi':
      return z.array(z.string()).max(k.max ?? 99)
    case 'number':
      return z
        .string()
        .regex(/^\d*$/)
        .refine((s) => s === '' || (Number(s) >= k.min && Number(s) <= k.max))
    case 'numberList':
      return z.string().refine((s) =>
        s
          .split(',')
          .map((x) => x.trim())
          .filter(Boolean)
          .every((x) => /^\d+$/.test(x) && Number(x) >= k.min && Number(x) <= k.max),
      )
  }
}

function fromForm(step: StepDef, v: string[] | string): Value {
  const k = step.kind
  switch (k.type) {
    case 'single':
      return (v as string[])[0] as Value
    case 'multi':
      return v as Value
    case 'boolean':
      return (v as string[])[0] === 'yes'
    case 'number':
      return v === '' ? null : Number(v)
    case 'numberList':
      return (v as string)
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean)
        .map(Number)
  }
}

export function StepView({
  step,
  initial,
  onBack,
  onSubmit,
  isLast,
  submitting,
}: {
  step: StepDef
  initial: Value
  onBack?: () => void
  onSubmit: (value: Value) => void
  isLast: boolean
  submitting: boolean
}) {
  const { t } = useTranslation()
  const base = `onboarding.steps.${step.i18n}`
  const form = useForm<{ value: string[] | string }>({
    resolver: zodResolver(z.object({ value: schemaFor(step) })),
    defaultValues: { value: toForm(step, initial) },
  })
  const k = step.kind
  const title = t(`${base}.title`)
  const hint = t(`${base}.hint`, { defaultValue: '' })
  const invalid = !!form.formState.errors.value

  const optionLabel = (o: string) =>
    k.type !== 'single' && k.type !== 'multi'
      ? o
      : k.optionKey === 'dimension'
        ? t(`dimension.${o}`)
        : t(`onboarding.steps.${k.optionKey}.options.${o}`)

  return (
    <form
      noValidate
      onSubmit={form.handleSubmit(({ value }) => onSubmit(fromForm(step, value)))}
      className="flex flex-col gap-6"
    >
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
        {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
      </div>

      <Controller
        control={form.control}
        name="value"
        render={({ field }) => {
          if (k.type === 'single' || k.type === 'multi' || k.type === 'boolean') {
            const options =
              k.type === 'boolean'
                ? [
                    { value: 'yes', label: t(`${base}.yes`) },
                    { value: 'no', label: t(`${base}.no`) },
                  ]
                : k.options.map((o) => ({ value: o, label: optionLabel(o) }))
            return (
              <ChoiceChips
                label={title}
                multiple={k.type === 'multi'}
                max={k.type === 'multi' ? k.max : undefined}
                options={options}
                value={field.value as string[]}
                onChange={field.onChange}
              />
            )
          }
          return (
            <div className="max-w-xs space-y-2">
              <Label htmlFor={step.id}>{t(`${base}.label`)}</Label>
              <Input
                id={step.id}
                inputMode={k.type === 'number' ? 'numeric' : 'text'}
                aria-invalid={invalid}
                value={field.value as string}
                onChange={field.onChange}
                onBlur={field.onBlur}
              />
            </div>
          )
        }}
      />
      {invalid && (
        <p role="alert" className="text-sm text-destructive">
          {t(`${base}.invalid`, { defaultValue: t('common.error') })}
        </p>
      )}

      <div className="flex gap-2">
        {onBack && (
          <Button type="button" variant="outline" onClick={onBack}>
            {t('common.back')}
          </Button>
        )}
        <Button type="submit" className="flex-1 sm:flex-none" disabled={submitting}>
          {isLast ? t('onboarding.done') : t('common.next')}
        </Button>
      </div>
    </form>
  )
}
