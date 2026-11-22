import { useTranslation } from 'react-i18next'
import { Card } from '@/components/ui/card'

interface Source {
  name: string
  url: string
  licence: string
  licenceUrl?: string
  what: string
}

/** Every data source with what we take from it and its licence (attribution the licences require). */
export default function SourcesPage() {
  const { t } = useTranslation()
  const sources = t('legal.sources.list', { returnObjects: true }) as Source[]
  const statuses = t('legal.sources.statuses', { returnObjects: true }) as string[]

  return (
    <article className="mx-auto flex max-w-3xl flex-col gap-6">
      <header className="space-y-2">
        <h1 className="text-3xl sm:text-4xl">{t('legal.sources.title')}</h1>
        <p>{t('legal.sources.lead')}</p>
      </header>

      <ul className="grid gap-3">
        {sources.map((s) => (
          <li key={s.name}>
            <Card className="gap-1.5">
              <a
                href={s.url}
                target="_blank"
                rel="noreferrer"
                className="font-medium underline underline-offset-4"
              >
                {s.name}
              </a>
              <p className="text-[15px]">{s.what}</p>
              <p className="text-sm text-muted-foreground">
                {t('legal.sources.licence')}:{' '}
                {s.licenceUrl ? (
                  <a href={s.licenceUrl} target="_blank" rel="noreferrer" className="underline">
                    {s.licence}
                  </a>
                ) : (
                  s.licence
                )}
              </p>
            </Card>
          </li>
        ))}
      </ul>

      <section className="space-y-2">
        <h2 className="text-xl font-medium">{t('legal.sources.howTitle')}</h2>
        <ul className="list-disc space-y-1 pl-5 text-[15px]">
          {statuses.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
        <p className="text-sm text-muted-foreground">{t('legal.sources.updated')}</p>
      </section>
    </article>
  )
}
