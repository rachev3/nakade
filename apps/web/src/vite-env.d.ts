/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_MODE?: 'mock' | 'live'
  /** Google Maps JavaScript API key (apps/web/.env.local). Without it, maps fall back to the keyless embed. */
  readonly VITE_GOOGLE_MAPS_API_KEY?: string
}
interface ImportMeta {
  readonly env: ImportMetaEnv
}
