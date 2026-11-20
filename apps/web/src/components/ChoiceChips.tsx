import { CheckIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ChoiceOption<T extends string> {
  value: T
  label: string
}

/**
 * Chip group for one-question-per-screen steps. Single choice renders a radiogroup,
 * multiple choice renders toggle buttons (aria-pressed).
 */
export function ChoiceChips<T extends string>({
  options,
  value,
  onChange,
  multiple = false,
  max,
  label,
}: {
  options: ChoiceOption<T>[]
  value: T[]
  onChange: (value: T[]) => void
  multiple?: boolean
  max?: number
  label: string
}) {
  const toggle = (v: T) => {
    if (!multiple) return onChange([v])
    if (value.includes(v)) return onChange(value.filter((x) => x !== v))
    if (max && value.length >= max) return
    onChange([...value, v])
  }
  return (
    <div
      role={multiple ? 'group' : 'radiogroup'}
      aria-label={label}
      className="flex flex-wrap gap-2"
    >
      {options.map((o) => {
        const selected = value.includes(o.value)
        return (
          <button
            key={o.value}
            type="button"
            role={multiple ? undefined : 'radio'}
            aria-checked={multiple ? undefined : selected}
            aria-pressed={multiple ? selected : undefined}
            onClick={() => toggle(o.value)}
            className={cn(
              'inline-flex min-h-11 items-center gap-1.5 rounded-full border px-4 text-[15px] transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
              selected
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-input bg-card hover:border-primary/40 hover:bg-accent',
            )}
          >
            {selected && <CheckIcon aria-hidden className="size-4" />}
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
