import { ArrowRightIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { useProfile } from '@/api/queries'
import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

/**
 * "Upgrade to Detailed Match" entry point. Shown once a Quick Match exists. The detailed flow
 * reuses the same profile, so nothing is lost (progressive profiling).
 */
export function UpgradeCard() {
  const { t } = useTranslation()
  const { data: profile } = useProfile()
  if (profile?.completeness !== 'quick') return null
  return (
    <Card className="gap-3 border-dashed sm:flex-row sm:items-center sm:justify-between">
      <CardHeader>
        <CardTitle>{t('onboarding.upgrade')}</CardTitle>
        <CardDescription>{t('onboarding.upgradeBody')}</CardDescription>
      </CardHeader>
      <Button asChild variant="outline">
        <Link to="/profile/detailed">
          {t('onboarding.upgrade')}
          <ArrowRightIcon aria-hidden />
        </Link>
      </Button>
    </Card>
  )
}
