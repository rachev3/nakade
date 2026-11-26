/**
 * Loads the Google Maps JavaScript API once, on demand (maps are lazy, they never block the first screen).
 * The key comes from VITE_GOOGLE_MAPS_API_KEY (apps/web/.env.local, or the Cloudflare build env).
 */
export const GOOGLE_MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? ''
export const HAS_GOOGLE_MAPS_KEY = GOOGLE_MAPS_KEY.length > 0

/** Google's demo map id: enables Advanced Markers without creating a map style in the Cloud console. */
export const MAP_ID = 'DEMO_MAP_ID'

let loading: Promise<void> | null = null

export function loadGoogleMaps(language: string): Promise<void> {
  if (!HAS_GOOGLE_MAPS_KEY) return Promise.reject(new Error('VITE_GOOGLE_MAPS_API_KEY is not set'))
  if ((window as { google?: { maps?: unknown } }).google?.maps) return Promise.resolve()
  loading ??= new Promise<void>((resolve, reject) => {
    const callback = '__nakadeMapsReady'
    ;(window as unknown as Record<string, () => void>)[callback] = () => resolve()
    const params = new URLSearchParams({
      key: GOOGLE_MAPS_KEY,
      v: 'weekly',
      loading: 'async',
      language,
      region: 'BG',
      callback,
    })
    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`
    script.async = true
    script.onerror = () => {
      loading = null
      reject(new Error('Google Maps failed to load'))
    }
    document.head.appendChild(script)
  })
  return loading
}

/** Keyless Google Maps embed for a single point (used when no API key is configured). */
export function embedUrl(lat: number, lon: number, zoom = 13, language = 'bg') {
  // Same target maps.google.com/maps?q=…&output=embed redirects to, minus the redirect (which sends
  // X-Frame-Options: SAMEORIGIN and can leave the frame blank).
  return `https://www.google.com/maps/embed?origin=mfe&pb=!1m3!2m1!1s${lat},${lon}!6i${zoom}!3m1!1s${language}!5m1!1s${language}`
}
