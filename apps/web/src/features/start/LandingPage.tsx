import { CompassIcon, MapPinIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { useProfile } from '@/api/queries'
import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { afterProfilePath, useJourneyStore } from '@/lib/journey'

export default function LandingPage() {
  const { t } = useTranslation()
  const { journey, destination } = useJourneyStore()
  const { data: profile } = useProfile()

  const resumeTo =
    journey && profile
      ? profile.completeness === 'none'
        ? '/profile/quick'
        : afterProfilePath(journey, destination)
      : null

  const journeys = [
    { to: '/start/known', icon: MapPinIcon, key: 'known' },
    { to: '/start/discover', icon: CompassIcon, key: 'discover' },
  ] as const

  return (
    <div className="flex flex-col gap-10 py-6 sm:py-12">
      <section className="max-w-2xl space-y-4">
        <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
          {t('landing.title')}
        </h1>
        <p className="text-lg text-muted-foreground">{t('landing.lead')}</p>
        {resumeTo && (
          <Button asChild variant="link" className="px-0">
            <Link to={resumeTo}>{t('landing.resume')} →</Link>
          </Button>
        )}
      </section>
      <div className="grid gap-4 sm:grid-cols-2">
        {journeys.map(({ to, icon: Icon, key }) => (
          <Link
            key={key}
            to={to}
            className="group rounded-xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <Card className="h-full transition-colors group-hover:bg-accent">
              <Icon aria-hidden className="size-8" />
              <CardHeader>
                <CardTitle className="text-xl">{t(`landing.${key}.title`)}</CardTitle>
                <CardDescription className="text-base">{t(`landing.${key}.body`)}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
      <p className="text-sm text-muted-foreground">{t('app.tagline')}</p>
    </div>
  )
}
