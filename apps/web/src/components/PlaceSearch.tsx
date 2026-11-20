import { SearchIcon, XIcon } from 'lucide-react'
import { useId, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { SettlementSummary } from '@/api/types'
import { placeName } from '@/lib/format'
import { cn } from '@/lib/utils'

const MAX_RESULTS = 8

/** Lower-case, no stress marks, so "Габрово", "габрово" and "gabrovo" all match. */
const norm = (s: string) => s.toLocaleLowerCase('bg').normalize('NFD').replace(/[̀-ͯ]/g, '').trim()

/**
 * Searchable place picker (ARIA combobox). Matches Bulgarian and English names, the municipality
 * and the district; names that start with the query come first.
 */
export function PlaceSearch({
  id,
  options,
  value,
  onChange,
  invalid,
  describedBy,
}: {
  id: string
  options: SettlementSummary[]
  value: string
  onChange: (ekatte: string) => void
  invalid?: boolean
  describedBy?: string
}) {
  const { t, i18n } = useTranslation()
  const listId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const selected = options.find((o) => o.ekatte === value)
  const [query, setQuery] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)

  const text = query ?? (selected ? placeName(selected, i18n.language) : '')

  const results = useMemo(() => {
    const q = norm(query ?? '')
    const scored = options
      .map((o) => {
        const names = [o.name_bg, o.name_en].map(norm)
        const where = [o.municipality, o.district].map(norm)
        const rank = !q
          ? 2
          : names.some((n) => n.startsWith(q))
            ? 0
            : names.some((n) => n.includes(q))
              ? 1
              : where.some((w) => w.includes(q))
                ? 2
                : -1
        return { o, rank }
      })
      .filter((x) => x.rank >= 0)
    scored.sort(
      (a, b) =>
        a.rank - b.rank ||
        (b.o.population ?? 0) - (a.o.population ?? 0) ||
        placeName(a.o, i18n.language).localeCompare(placeName(b.o, i18n.language)),
    )
    return scored.slice(0, MAX_RESULTS).map((x) => x.o)
  }, [options, query, i18n.language])

  const choose = (o: SettlementSummary) => {
    onChange(o.ekatte)
    setQuery(null)
    setOpen(false)
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setOpen(true)
      setActive((i) => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && open) {
      e.preventDefault()
      const o = results.at(active)
      if (o) choose(o)
    } else if (e.key === 'Escape') {
      setOpen(false)
      setQuery(null)
    }
  }

  const activeId = open && results.at(active) ? `${listId}-${active}` : undefined

  return (
    <div className="relative">
      <SearchIcon
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
      />
      <input
        ref={inputRef}
        id={id}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={activeId}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        autoComplete="off"
        placeholder={t('startKnown.search')}
        value={text}
        onChange={(e) => {
          setQuery(e.target.value)
          setActive(0)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          // let a click on an option land first
          setTimeout(() => {
            setOpen(false)
            setQuery(null)
          }, 120)
        }}
        onKeyDown={onKeyDown}
        className="h-11 w-full min-w-0 rounded-xl border border-input bg-card pr-10 pl-10 text-base shadow-xs outline-none placeholder:text-muted-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive md:text-sm"
      />
      {value && (
        <button
          type="button"
          aria-label={t('startKnown.clear')}
          onClick={() => {
            onChange('')
            setQuery('')
            inputRef.current?.focus()
          }}
          className="absolute top-1/2 right-2 grid size-7 -translate-y-1/2 place-items-center rounded-full text-muted-foreground hover:bg-accent"
        >
          <XIcon aria-hidden className="size-4" />
        </button>
      )}
      {open && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-80 w-full overflow-auto rounded-xl border bg-popover p-1 text-popover-foreground shadow-lg"
        >
          {results.length === 0 ? (
            <li className="px-3 py-2 text-sm text-muted-foreground">{t('startKnown.noResults')}</li>
          ) : (
            results.map((o, i) => (
              <li
                key={o.ekatte}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={o.ekatte === value}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(o)}
                className={cn(
                  'flex cursor-pointer items-baseline justify-between gap-3 rounded-lg px-3 py-2',
                  i === active && 'bg-accent',
                )}
              >
                <span className="font-medium">{placeName(o, i18n.language)}</span>
                <span className="text-xs text-muted-foreground">
                  {t(`common.${o.type}`)} · {o.district}
                </span>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  )
}
