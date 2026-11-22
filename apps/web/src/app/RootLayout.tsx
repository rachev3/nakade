import { HeartIcon, MapIcon, MonitorIcon, MoonIcon, SearchIcon, SunIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { motion } from 'motion/react'
import { Link, NavLink, Outlet, ScrollRestoration, useLocation, useNavigation } from 'react-router'
import { DemoBadge } from '@/components/DemoBadge'
import { LogoMark } from '@/components/Logo'
import { Button } from '@/components/ui/button'
import { LANGUAGES } from '@/lib/i18n'
import { rise, smooth } from '@/lib/motion'
import { applyTheme, type Theme, useThemeStore } from '@/lib/theme'
import { cn } from '@/lib/utils'

const THEMES: { value: Theme; icon: typeof SunIcon }[] = [
  { value: 'light', icon: SunIcon },
  { value: 'dark', icon: MoonIcon },
  { value: 'system', icon: MonitorIcon },
]

/** Crossfades the whole page when the theme changes (View Transitions API, if available). */
function switchTheme(next: Theme, setTheme: (t: Theme) => void) {
  const run = () => {
    applyTheme(next)
    setTheme(next)
  }
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (!reduced && 'startViewTransition' in document) document.startViewTransition(run)
  else run()
}

export function RootLayout() {
  const { t, i18n } = useTranslation()
  const navigation = useNavigation()
  const location = useLocation()
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
            className="mr-1 flex items-center gap-2 font-serif text-xl font-medium tracking-tight"
          >
            <LogoMark className="size-7 text-primary" />
            {t('app.name')}
          </Link>
          <DemoBadge />
          <nav aria-label="Main" className="ml-auto flex items-center gap-0.5 sm:gap-1">
            <NavLink to="/discover" className={navClass} aria-label={t('nav.discover')}>
              <SearchIcon aria-hidden className="size-4" />
              <span className="hidden sm:inline">{t('nav.discover')}</span>
            </NavLink>
            <NavLink to="/map" className={navClass} aria-label={t('nav.map')}>
              <MapIcon aria-hidden className="size-4" />
              <span className="hidden sm:inline">{t('nav.map')}</span>
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
            onClick={() => switchTheme(nextTheme.value, setTheme)}
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
        {/* Each route fades in gently; same-route updates (e.g. onboarding steps) don't re-trigger it */}
        <motion.div key={location.pathname} {...rise} transition={smooth(0.3)}>
          <Outlet />
        </motion.div>
      </main>
      <footer className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-x-4 gap-y-1 px-4 pt-2 pb-6 text-xs text-muted-foreground">
        <Link to="/privacy" className="hover:underline">
          {t('footer.privacy')}
        </Link>
        <Link to="/sources" className="hover:underline">
          {t('footer.sources')}
        </Link>
        <a
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noreferrer"
          className="hover:underline"
        >
          {t('footer.osm')}
        </a>
      </footer>
      <ScrollRestoration />
    </div>
  )
}
