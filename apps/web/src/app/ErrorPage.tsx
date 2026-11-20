import { useTranslation } from 'react-i18next'
import { isRouteErrorResponse, Link, useRouteError } from 'react-router'
import { Button } from '@/components/ui/button'

export function ErrorPage() {
  const error = useRouteError()
  const { t } = useTranslation()
  const notFound = isRouteErrorResponse(error) && error.status === 404
  if (!notFound) console.error(error)
  return (
    <div role="alert" className="flex flex-col items-center gap-4 py-16 text-center">
      <h1 className="text-2xl font-semibold">
        {notFound ? t('common.notFound') : t('common.error')}
      </h1>
      <Button asChild>
        <Link to="/">{t('common.goHome')}</Link>
      </Button>
    </div>
  )
}
