import { CheckIcon, ListChecksIcon, ZapIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { Flow } from '@/lib/journey'
import { cn } from '@/lib/utils'

const OPTIONS = [
  { value: 'quick', icon: ZapIcon },
  { value: 'detailed', icon: ListChecksIcon },
] as const

/**
 * Lets the user choose Quick or Detailed Match up front. Both build the same profile, so
 * Quick can still be upgraded later without losing anything.
 */
export function ProfileModePicker({
  value,
  onChange,
}: {
  value: Flow
  onChange: (v: Flow) => void
}) {
  const { t } = useTranslation()
  return (
    <fieldset className="space-y-3">
      <legend className="mb-3 text-sm font-medium">{t('profileMode.title')}</legend>
      <div
        role="radiogroup"
        aria-label={t('profileMode.title')}
        className="grid gap-3 sm:grid-cols-2"
      >
        {OPTIONS.map(({ value: v, icon: Icon }) => {
          const selected = value === v
          return (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={`${t(v === 'quick' ? 'onboarding.quickTitle' : 'onboarding.detailedTitle')}. ${t(`profileMode.${v}`)}`}
              onClick={() => onChange(v)}
              className={cn(
                'relative flex items-start gap-3 rounded-2xl border p-4 text-left transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
                selected
                  ? 'border-primary bg-accent ring-1 ring-primary'
                  : 'border-input bg-card hover:border-primary/40',
              )}
            >
              <span
                className={cn(
                  'grid size-10 shrink-0 place-items-center rounded-full',
                  v === 'quick'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-clay text-clay-foreground',
                )}
              >
                <Icon aria-hidden className="size-5" />
              </span>
              <span className="flex-1 space-y-0.5">
                <span className="block font-serif text-lg font-medium">
                  {t(v === 'quick' ? 'onboarding.quickTitle' : 'onboarding.detailedTitle')}
                </span>
                <span className="block text-sm text-muted-foreground">{t(`profileMode.${v}`)}</span>
              </span>
              {selected && (
                <CheckIcon aria-hidden className="absolute top-3 right-3 size-4 text-primary" />
              )}
            </button>
          )
        })}
      </div>
      <p className="text-xs text-muted-foreground">{t('profileMode.note')}</p>
    </fieldset>
  )
}
