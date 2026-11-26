import { createBrowserRouter, type LoaderFunctionArgs } from 'react-router'
import { settlementQuery } from '@/api/queries'
import i18n from '@/lib/i18n'
import { ErrorPage } from './ErrorPage'
import { queryClient } from './queryClient'
import { RootLayout } from './RootLayout'

/** Route loaders prefetch into the TanStack Query cache; components read with useQuery. */
const prefetchSettlement = async ({ params }: LoaderFunctionArgs) => {
  const ekatte = params.ekatte ?? ''
  if (!/^\d{5}$/.test(ekatte)) throw new Response('Not found', { status: 404 })
  // Don't block navigation on errors: the page renders its own error state.
  await queryClient.prefetchQuery(settlementQuery(ekatte, i18n.language))
  return null
}

const page = (load: () => Promise<{ default: React.ComponentType }>) => async () => ({
  Component: (await load()).default,
})

export const routes = [
  {
    path: '/',
    Component: RootLayout,
    ErrorBoundary: ErrorPage,
    children: [
      {
        ErrorBoundary: ErrorPage,
        children: [
          { index: true, lazy: page(() => import('@/features/start/LandingPage')) },
          { path: 'start/known', lazy: page(() => import('@/features/start/StartKnownPage')) },
          {
            path: 'start/discover',
            lazy: page(() => import('@/features/start/StartDiscoverPage')),
          },
          {
            path: 'profile/quick',
            lazy: page(() => import('@/features/onboarding/QuickMatchPage')),
          },
          {
            path: 'profile/detailed',
            lazy: page(() => import('@/features/onboarding/DetailedMatchPage')),
          },
          { path: 'discover', lazy: page(() => import('@/features/discover/DiscoverPage')) },
          {
            path: 'places/:ekatte',
            loader: prefetchSettlement,
            lazy: page(() => import('@/features/place/PlacePage')),
          },
          {
            path: 'places/:ekatte/try',
            loader: prefetchSettlement,
            lazy: page(() => import('@/features/simulation/SimulationPage')),
          },
          { path: 'map', lazy: page(() => import('@/features/map/MapPage')) },
          { path: 'saved', lazy: page(() => import('@/features/compare/SavedPage')) },
          { path: 'compare', lazy: page(() => import('@/features/compare/ComparePage')) },
          {
            path: 'plan/:ekatte',
            loader: prefetchSettlement,
            lazy: page(() => import('@/features/plan/PlanPage')),
          },
          {
            path: '*',
            loader: () => {
              throw new Response('Not found', { status: 404 })
            },
          },
        ],
      },
    ],
  },
]

export const createRouter = () => createBrowserRouter(routes)
