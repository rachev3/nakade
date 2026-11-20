import { SparklesIcon } from 'lucide-react'
import type * as React from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'

/**
 * Hypothetical AI / simulation narrative. Deliberately styled differently from <Fact>
 * (tinted, italic, "Imagined" label) so it can never be mistaken for data.
 */
export function Scenario({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  const { t } = useTranslation()
  return (
    <p
      data-kind="scenario"
      className={cn(
        'rounded-md border-l-4 border-scenario bg-scenario-bg px-3 py-2 text-sm italic',
        className,
      )}
    >
      <span
        className="mr-2 inline-flex items-center gap-1 align-middle text-xs font-medium text-scenario uppercase not-italic"
        title={t('scenario.hint')}
      >
        <SparklesIcon aria-hidden className="size-3" />
        {t('scenario.label')}
      </span>
      {children}
    </p>
  )
}
