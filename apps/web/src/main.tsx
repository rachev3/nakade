import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router/dom'
import { IS_MOCK } from '@/api/config'
import { ensureSession } from '@/api/queries'
import { Providers } from '@/app/Providers'
import { createRouter } from '@/app/router'
import '@/lib/i18n'
import '@/styles/index.css'

async function bootstrap() {
  if (IS_MOCK) {
    const { startMockApi } = await import('@/api/mocks/browser')
    await startMockApi()
  }
  await ensureSession().catch((e: unknown) => console.warn('Session init failed', e))

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <Providers>
        <RouterProvider router={createRouter()} />
      </Providers>
    </StrictMode>,
  )
}

void bootstrap()
