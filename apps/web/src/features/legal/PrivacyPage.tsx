import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDeleteMyData } from '@/api/queries'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

interface Section {
  title: string
  body: string[]
}

/** What we store, why, for how long, who else is involved, and a button that deletes it all. */
export default function PrivacyPage() {
  const { t } = useTranslation()
  const remove = useDeleteMyData()
  const [confirming, setConfirming] = useState(false)
  const sections = t('legal.privacy.sections', { returnObjects: true }) as Section[]

  return (
    <article className="mx-auto flex max-w-2xl flex-col gap-6">
      <header className="space-y-1">
        <h1 className="text-3xl sm:text-4xl">{t('legal.privacy.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('legal.privacy.updated')}</p>
      </header>
      <p>{t('legal.privacy.lead')}</p>

      {sections.map((s) => (
        <section key={s.title} className="space-y-2">
          <h2 className="text-xl font-medium">{s.title}</h2>
          {s.body.map((p) => (
            <p key={p} className="text-[15px] leading-relaxed">
              {p}
            </p>
          ))}
        </section>
      ))}

      <Card className="gap-3">
        <h2 className="text-xl font-medium">{t('legal.privacy.delete.title')}</h2>
        <p className="text-[15px]">{t('legal.privacy.delete.body')}</p>
        {remove.isSuccess ? (
          <p role="status" className="font-medium">
            {t('legal.privacy.delete.done')}
          </p>
        ) : confirming ? (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="destructive"
              onClick={() => remove.mutate()}
              disabled={remove.isPending}
            >
              {t('legal.privacy.delete.confirm')}
            </Button>
            <Button variant="outline" onClick={() => setConfirming(false)}>
              {t('common.back')}
            </Button>
          </div>
        ) : (
          <Button variant="outline" className="self-start" onClick={() => setConfirming(true)}>
            {t('legal.privacy.delete.button')}
          </Button>
        )}
        {remove.isError && (
          <p role="alert" className="text-sm text-destructive">
            {t('common.error')}
          </p>
        )}
      </Card>
    </article>
  )
}
