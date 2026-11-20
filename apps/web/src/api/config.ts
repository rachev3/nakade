/**
 * API mode.
 * - `mock` (default for now): MSW intercepts `/api/*` in the browser and serves fixtures.
 *   Used in local dev AND in the deployed build until the backend exists.
 * - `live`: requests go to the real `/api/*` (proxied by the web Worker).
 *
 * Switch with `VITE_API_MODE=live` at build time.
 */
export const API_MODE: 'mock' | 'live' = import.meta.env.VITE_API_MODE === 'live' ? 'live' : 'mock'
export const IS_MOCK = API_MODE === 'mock'
