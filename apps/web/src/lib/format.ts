import type { SettlementSummary } from '@/api/types'

export function placeName(s: Pick<SettlementSummary, 'name_bg' | 'name_en'>, lang: string) {
  return lang.startsWith('en') ? s.name_en : s.name_bg
}

export function percent(value: number) {
  return Math.round(value * 100)
}

export function formatNumber(value: number, lang: string) {
  return new Intl.NumberFormat(lang.startsWith('en') ? 'en-GB' : 'bg-BG').format(value)
}

export function formatDate(iso: string, lang: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return new Intl.DateTimeFormat(lang.startsWith('en') ? 'en-GB' : 'bg-BG', {
    dateStyle: 'medium',
  }).format(d)
}
