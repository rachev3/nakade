import { HeartIcon, MonitorIcon, MoonIcon, SearchIcon, SunIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, NavLink, Outlet, ScrollRestoration, useNavigation } from 'react-router'
import { DemoBadge } from '@/components/DemoBadge'
import { Button } from '@/components/ui/button'
import { LANGUAGES } from '@/lib/i18n'
import { type Theme, useThemeStore } from '@/lib/theme'
import { cn } from '@/lib/utils'

const THEMES: { value: Theme; icon: typeof SunIcon }[] = [
  { value: 'light', icon: SunIcon },
  { value: 'dark', icon: MoonIcon },
  { value: 'system', icon: MonitorIcon },
]

export function RootLayout() {
  const { t, i18n } = useTranslation()
  const navigation = useNavigation()
  const { theme, setTheme } = useThemeStore()
  const nextTheme = THEMES[(THEMES.findIndex((x) => x.value === theme) + 1) % THEMES.length]!
  const ThemeIcon = THEMES.find((x) => x.value === theme)!.icon

  const navClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      'inline-flex size-9 items-center justify-center gap-1.5 rounded-full text-sm sm:size-auto sm:min-h-10 sm:px-3',
      isActive ? 'bg-accent font-medium' : 'text-muted-foreground hover:text-foreground',
    )

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only z-50 rounded bg-background p-2 focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        {t('app.skipToContent')}
      </a>
      <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-1 px-4 sm:gap-2">
          <Link
            to="/"
            className="mr-1 flex items-baseline gap-0.5 font-serif text-xl font-medium tracking-tight"
          >
            {t('app.name')}
            <span aria-hidden className="size-1.5 rounded-full bg-clay" />
          </Link>
          <DemoBadge />
          <nav aria-label="Main" className="ml-auto flex items-center gap-0.5 sm:gap-1">
            <NavLink to="/discover" className={navClass} aria-label={t('nav.discover')}>
              <SearchIcon aria-hidden className="size-4" />
              <span className="hidden sm:inline">{t('nav.discover')}</span>
            </NavLink>
            <NavLink to="/saved" className={navClass} aria-label={t('nav.saved')}>
              <HeartIcon aria-hidden className="size-4" />
              <span className="hidden sm:inline">{t('nav.saved')}</span>
            </NavLink>
          </nav>
          <Button
            variant="ghost"
            size="sm"
            className="w-9 px-0 sm:w-auto sm:px-3"
            aria-label={`${t('nav.language')}: ${i18n.language.toUpperCase()}`}
            onClick={() => {
              const next =
                LANGUAGES[(LANGUAGES.indexOf(i18n.language as 'bg') + 1) % LANGUAGES.length]
              void i18n.changeLanguage(next)
            }}
          >
            {i18n.language === 'en' ? 'BG' : 'EN'}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-9"
            aria-label={`${t('nav.theme')}: ${t(`theme.${theme}`)}`}
            title={t(`theme.${nextTheme.value}`)}
            onClick={() => setTheme(nextTheme.value)}
          >
            <ThemeIcon aria-hidden />
          </Button>
        </div>
        <div
          aria-hidden
          className={cn(
            'h-0.5 origin-left bg-primary transition-transform duration-300',
            navigation.state === 'loading' ? 'scale-x-75' : 'scale-x-0',
          )}
        />
      </header>
      <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
        <Outlet />
      </main>
      <ScrollRestoration />
    </div>
  )
}
