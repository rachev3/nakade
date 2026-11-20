import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'

export function Loading({ label }: { label?: string }) {
  const { t } = useTranslation()
  return (
    <p role="status" className="py-12 text-center text-muted-foreground">
      {label ?? t('common.loading')}
    </p>
  )
}

export function ErrorState({ onRetry }: { onRetry?: () => void }) {
  const { t } = useTranslation()
  return (
    <div role="alert" className="flex flex-col items-center gap-3 py-12 text-center">
      <p>{t('common.error')}</p>
      {onRetry && (
        <Button variant="outline" onClick={onRetry}>
          {t('common.retry')}
        </Button>
      )}
    </div>
  )
}
