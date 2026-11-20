import { QueryClientProvider } from '@tanstack/react-query'
import { MotionConfig } from 'motion/react'
import { useEffect, type ReactNode } from 'react'
import { applyTheme, useThemeStore } from '@/lib/theme'
import { queryClient } from './queryClient'

export function Providers({ children }: { children: ReactNode }) {
  const theme = useThemeStore((s) => s.theme)
  useEffect(() => {
    applyTheme(theme)
    if (theme !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => applyTheme('system')
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [theme])

  return (
    <QueryClientProvider client={queryClient}>
      {/* "user": Motion skips transform/layout animations when prefers-reduced-motion is set */}
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </QueryClientProvider>
  )
}
