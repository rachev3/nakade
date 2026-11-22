/**
 * API mode.
 * - `live`: requests go to the real `/api/*` (the web Worker, or the local server through the Vite proxy).
 *   Default for every production build, so a deploy can never ship the demo fixtures by accident.
 * - `mock`: MSW intercepts `/api/*` in the browser and serves fixtures. Default for `pnpm dev`.
 *
 * Override either way with `VITE_API_MODE=mock|live` at build time.
 */
const requested = import.meta.env.VITE_API_MODE
export const API_MODE: 'mock' | 'live' =
  requested === 'mock' || requested === 'live' ? requested : import.meta.env.PROD ? 'live' : 'mock'
export const IS_MOCK = API_MODE === 'mock'
