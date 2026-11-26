import { MapPinIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { embedUrl, HAS_GOOGLE_MAPS_KEY, loadGoogleMaps, MAP_ID } from '@/lib/googleMaps'
import { cn } from '@/lib/utils'

export interface MapMarker {
  id: string
  lat: number
  lon: number
  title: string
  /** Second line in the info window (e.g. "86% съвпадение · Град с 3575 жители") */
  subtitle?: string
  /** In-app link opened from the info window */
  href?: string
  /** Pin colour (CSS colour) */
  color?: string
  /** Bigger pin, drawn on top */
  primary?: boolean
  /** Faded pin (e.g. places that fail a must-have) */
  muted?: boolean
}

/**
 * Google Maps with coloured pins and an info window per place.
 * With VITE_GOOGLE_MAPS_API_KEY: the JavaScript API (all markers, fit to bounds).
 * Without it: Google's keyless embed of the primary marker, or a note when there are many markers.
 */
export function GoogleMap({ markers, className }: { markers: MapMarker[]; className?: string }) {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const ref = useRef<HTMLDivElement>(null)
  const [failed, setFailed] = useState(false)
  const lang = i18n.language.startsWith('en') ? 'en' : 'bg'
  const key = markers.map((m) => `${m.id}:${m.color ?? ''}:${m.muted ? 1 : 0}`).join('|')

  useEffect(() => {
    if (!HAS_GOOGLE_MAPS_KEY || !ref.current || markers.length === 0) return
    let cancelled = false
    const cleanup: (() => void)[] = []

    loadGoogleMaps(lang)
      .then(async () => {
        const [{ Map, InfoWindow }, { AdvancedMarkerElement, PinElement }] = await Promise.all([
          google.maps.importLibrary('maps') as Promise<google.maps.MapsLibrary>,
          google.maps.importLibrary('marker') as Promise<google.maps.MarkerLibrary>,
        ])
        const first = markers.find((m) => m.primary) ?? markers[0]
        if (cancelled || !ref.current || !first) return
        const dark = document.documentElement.classList.contains('dark')
        const map = new Map(ref.current, {
          mapId: MAP_ID,
          center: { lat: first.lat, lng: first.lon },
          zoom: 11,
          colorScheme: (dark ? 'DARK' : 'LIGHT') as google.maps.ColorScheme,
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: true,
        })
        const info = new InfoWindow()
        const bounds = new google.maps.LatLngBounds()

        // Primary last, so it is drawn on top.
        for (const m of [...markers].sort((a, b) => Number(a.primary) - Number(b.primary))) {
          const pin = new PinElement({
            background: m.color ?? '#4f8a6b',
            borderColor: 'rgba(0,0,0,0.35)',
            glyphColor: '#ffffff',
            scale: m.primary ? 1.4 : 1,
          })
          // PinElement is itself an HTMLElement; its old `.element` property is deprecated.
          if (m.muted) pin.style.opacity = '0.45'
          const marker = new AdvancedMarkerElement({
            map,
            position: { lat: m.lat, lng: m.lon },
            title: m.title,
            content: pin,
            zIndex: m.primary ? 1000 : undefined,
            gmpClickable: true,
          })
          bounds.extend({ lat: m.lat, lng: m.lon })
          marker.addEventListener('gmp-click', () => {
            info.setOptions({ headerContent: m.title, content: infoContent(m) })
            info.open({ map, anchor: marker })
          })
          cleanup.push(() => (marker.map = null))
        }

        function infoContent(m: MapMarker) {
          const el = document.createElement('div')
          el.style.cssText = 'font: 14px system-ui, sans-serif; color: #1f2a24; max-width: 240px'
          if (m.subtitle) {
            const p = document.createElement('p')
            p.textContent = m.subtitle
            p.style.margin = '0 0 6px'
            el.appendChild(p)
          }
          if (m.href) {
            const a = document.createElement('a')
            a.href = m.href
            a.textContent = t('map.open')
            a.style.cssText = 'color: #2f6b4c; text-decoration: underline; font-weight: 600'
            a.addEventListener('click', (e) => {
              e.preventDefault()
              void navigate(m.href!)
            })
            el.appendChild(a)
          }
          return el
        }

        if (markers.length > 1) map.fitBounds(bounds, 48)
      })
      .catch(() => !cancelled && setFailed(true))

    return () => {
      cancelled = true
      cleanup.forEach((f) => f())
    }
    // `key` captures the marker list; re-creating the map on every render would flicker.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, lang])

  const frame = cn('h-64 w-full overflow-hidden rounded-lg border', className)

  if (markers.length === 0) return null

  if (!HAS_GOOGLE_MAPS_KEY || failed) {
    const primary =
      markers.find((m) => m.primary) ?? (markers.length === 1 ? markers[0] : undefined)
    if (primary) {
      return (
        <iframe
          title={t('map.title', { name: primary.title })}
          src={embedUrl(primary.lat, primary.lon, 12, lang)}
          className={frame}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
      )
    }
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center gap-2 p-4 text-center text-sm text-muted-foreground',
          frame,
          'border-dashed',
        )}
      >
        <MapPinIcon aria-hidden />
        <p>{t('map.needsKey')}</p>
      </div>
    )
  }

  return <div ref={ref} className={frame} role="region" aria-label={t('map.region')} />
}
