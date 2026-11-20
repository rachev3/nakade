import { FlaskConicalIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { IS_MOCK } from '@/api/config'
import { Badge } from '@/components/ui/badge'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

/** App-wide marker while the UI runs on mock data. Disappears in `live` API mode. */
export function DemoBadge() {
  const { t } = useTranslation()
  if (!IS_MOCK) return null
  return (
    <Popover>
      <PopoverTrigger
        aria-label={t('app.demoBadge')}
        className="rounded-full outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <Badge variant="demo">
          <FlaskConicalIcon aria-hidden />
          {t('app.demoBadge')}
        </Badge>
      </PopoverTrigger>
      <PopoverContent>{t('app.demoNotice')}</PopoverContent>
    </Popover>
  )
}
