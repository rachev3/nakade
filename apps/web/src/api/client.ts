import createClient, { type Middleware } from 'openapi-fetch'
import i18n from '@/lib/i18n'
import type { paths } from './schema'

/** Sends the UI language so the API localises free text (hooks, simulation, plan). */
const language: Middleware = {
  onRequest({ request }) {
    request.headers.set('Accept-Language', i18n.language || 'bg')
    return request
  },
}

export const api = createClient<paths>({
  baseUrl: typeof window === 'undefined' ? 'http://localhost' : window.location.origin,
  credentials: 'include',
})
api.use(language)

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

/** Unwraps an openapi-fetch result or throws, for use inside TanStack Query functions. */
export function unwrap<T>(result: { data?: T; error?: unknown; response: Response }): T {
  if (result.error !== undefined || result.data === undefined) {
    if (result.response.status === 204) return undefined as T
    const message =
      typeof result.error === 'object' && result.error && 'message' in result.error
        ? String(result.error.message)
        : `HTTP ${result.response.status}`
    throw new ApiError(result.response.status, message)
  }
  return result.data
}
