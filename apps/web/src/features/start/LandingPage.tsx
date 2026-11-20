import { ArrowRightIcon, CompassIcon, MapPinIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { useProfile } from '@/api/queries'
import { Landscape } from '@/components/Landscape'
import { Button } from '@/components/ui/button'
import { afterProfilePath, useJourneyStore } from '@/lib/journey'
import { cn } from '@/lib/utils'

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
    {
      to: '/start/known',
      icon: MapPinIcon,
      key: 'known',
      tone: 'bg-primary text-primary-foreground',
    },
    {
      to: '/start/discover',
      icon: CompassIcon,
      key: 'discover',
      tone: 'bg-clay text-clay-foreground',
    },
  ] as const

  return (
    <div className="flex flex-col gap-8 pb-6">
      <div className="-mx-4 -mt-6 h-44 overflow-hidden sm:mx-0 sm:mt-0 sm:h-56 sm:rounded-3xl">
        <Landscape seed="nakade" type="village" />
      </div>
      <section className="max-w-2xl space-y-4">
        <h1 className="text-4xl leading-[1.1] sm:text-5xl">{t('landing.title')}</h1>
        <p className="text-lg text-muted-foreground">{t('landing.lead')}</p>
        {resumeTo && (
          <Button asChild variant="outline" size="sm">
            <Link to={resumeTo}>
              {t('landing.resume')}
              <ArrowRightIcon aria-hidden />
            </Link>
          </Button>
        )}
      </section>
      <div className="grid gap-3 sm:grid-cols-2">
        {journeys.map(({ to, icon: Icon, key, tone }) => (
          <Link
            key={key}
            to={to}
            className="group flex items-center gap-4 rounded-2xl border bg-card p-4 transition-colors outline-none hover:border-primary/40 hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:p-5"
          >
            <span className={cn('grid size-12 shrink-0 place-items-center rounded-full', tone)}>
              <Icon aria-hidden className="size-6" />
            </span>
            <span className="flex-1 space-y-0.5">
              <span className="block font-serif text-xl font-medium">
                {t(`landing.${key}.title`)}
              </span>
              <span className="block text-[15px] text-muted-foreground">
                {t(`landing.${key}.body`)}
              </span>
            </span>
            <ArrowRightIcon
              aria-hidden
              className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
            />
          </Link>
        ))}
      </div>
      <p className="font-serif text-muted-foreground italic">{t('app.tagline')}</p>
    </div>
  )
}
