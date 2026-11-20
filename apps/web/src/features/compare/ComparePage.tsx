import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router'
import { useMatches } from '@/api/queries'
import type { Dimension } from '@/api/types'
import { ErrorState, Loading } from '@/components/States'
import { Button } from '@/components/ui/button'
import { percent, placeName } from '@/lib/format'

export default function ComparePage() {
  const { t, i18n } = useTranslation()
  const [params] = useSearchParams()
  const ids = (params.get('ids') ?? '')
    .split(',')
    .filter((x) => /^\d{5}$/.test(x))
    .slice(0, 3)
  const matches = useMatches({ ekatte: ids }, ids.length > 0)

  if (ids.length === 0)
    return (
      <div className="flex flex-col items-start gap-4">
        <h1 className="text-3xl font-semibold tracking-tight">{t('compare.title')}</h1>
        <p className="text-muted-foreground">{t('compare.empty')}</p>
        <Button asChild>
          <Link to="/saved">{t('nav.saved')}</Link>
        </Button>
      </div>
    )
  if (matches.isPending) return <Loading />
  if (matches.isError) return <ErrorState onRetry={() => void matches.refetch()} />

  // Keep the order the user picked
  const cols = ids.flatMap((id) => matches.data.filter((m) => m.ekatte === id))
  const dimensions = (cols[0]?.dimensions.map((d) => d.key) ?? []) as Dimension[]
  const cell = (v: number | null | undefined) =>
    v === null || v === undefined ? t('place.noScore') : `${percent(v)}%`

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-3xl font-semibold tracking-tight">{t('compare.title')}</h1>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[32rem] text-sm">
          <thead>
            <tr className="border-b">
              <th className="py-2 text-left font-medium" />
              {cols.map((m) => (
                <th key={m.ekatte} scope="col" className="py-2 text-left font-semibold">
                  <Link to={`/places/${m.ekatte}`} className="underline-offset-4 hover:underline">
                    {placeName(m.settlement, i18n.language)}
                  </Link>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="border-b">
              <th scope="row" className="py-2 text-left font-medium">
                {t('compare.fit')}
              </th>
              {cols.map((m) => (
                <td key={m.ekatte} className="py-2 font-semibold tabular-nums">
                  {cell(m.score)}
                </td>
              ))}
            </tr>
            {dimensions.map((d) => (
              <tr key={d} className="border-b">
                <th scope="row" className="py-2 text-left font-normal text-muted-foreground">
                  {t(`dimension.${d}`)}
                </th>
                {cols.map((m) => (
                  <td key={m.ekatte} className="py-2 tabular-nums">
                    {cell(m.dimensions.find((x) => x.key === d)?.score)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
